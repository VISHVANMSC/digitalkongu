import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireRole } from '@/lib/auth';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
  try {
    const payload = await authenticateRequest(request);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const isAdmin = requireRole('ADMIN')(payload);
    const isCoordinator = requireRole('COORDINATOR')(payload);

    if (!isAdmin && !isCoordinator) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin or Coordinator access required' },
        { status: 403 }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { eventId, type, item, panelId, action } = body;

      if (action === 'clear') {
        if (!eventId) {
          return NextResponse.json(
            { success: false, error: 'Event ID is required to clear data' },
            { status: 400 }
          );
        }

        // Verify event exists
        const event = await db.event.findUnique({ where: { id: eventId } });
        if (!event || event.status === 'DELETED') {
          return NextResponse.json(
            { success: false, error: 'Event not found' },
            { status: 404 }
          );
        }

        // Coordinator must be assigned to the event or the panel, and have editing rights
        if (isCoordinator && !isAdmin) {
          const dbUser = await db.user.findUnique({
            where: { id: payload.userId },
            select: { canEdit: true },
          });
          if (!dbUser || !dbUser.canEdit) {
            return NextResponse.json(
              { success: false, error: 'Forbidden: Coordinator does not have editing rights' },
              { status: 403 }
            );
          }

          const isAssigned = await db.eventCoordinator.findUnique({
            where: { eventId_userId: { eventId, userId: payload.userId } },
          });
          let isPanelAssigned = false;
          if (panelId) {
            const pa = await db.panelCoordinator.findUnique({
              where: { panelId_userId: { panelId, userId: payload.userId } },
            });
            isPanelAssigned = !!pa;
          } else {
            const panelAssignments = await db.panelCoordinator.findMany({
              where: { userId: payload.userId, panel: { eventId } },
              select: { panelId: true },
            });
            isPanelAssigned = panelAssignments.length > 0;
          }
          if (!isAssigned && !isPanelAssigned) {
            return NextResponse.json(
              { success: false, error: 'Forbidden: Not assigned to this event or its panels' },
              { status: 403 }
            );
          }
        }

        // Delete evaluations, teams, participants
        if (panelId) {
          await db.evaluation.deleteMany({ where: { eventId, panelId } });
          await db.team.deleteMany({ where: { eventId, panelId } });
          await db.participant.deleteMany({ where: { eventId, panelId } });

          await db.auditLog.create({
            data: {
              userId: payload.userId,
              action: 'CLEAR_PANEL_DATA',
              entity: 'Panel',
              entityId: panelId,
              details: `Cleared all teams, participants, and evaluations for panel ${panelId} in event ${eventId} before bulk upload`,
            },
          });
        } else {
          await db.evaluation.deleteMany({ where: { eventId } });
          await db.team.deleteMany({ where: { eventId } });
          await db.participant.deleteMany({ where: { eventId } });

          await db.auditLog.create({
            data: {
              userId: payload.userId,
              action: 'CLEAR_EVENT_DATA',
              entity: 'Event',
              entityId: eventId,
              details: `Cleared all teams, participants, and evaluations for event ${eventId} before bulk upload`,
            },
          });
        }

        return NextResponse.json({ success: true, message: 'Event data cleared successfully' });
      }

      if (!eventId || !type || !item) {
        return NextResponse.json(
          { success: false, error: 'Event ID, type, and item are required' },
          { status: 400 }
        );
      }

      // Verify event exists
      const event = await db.event.findUnique({ where: { id: eventId } });
      if (!event || event.status === 'DELETED') {
        return NextResponse.json(
          { success: false, error: 'Event not found' },
          { status: 404 }
        );
      }

      // Coordinator must be assigned to the event or the panel, and have editing rights
      if (isCoordinator && !isAdmin) {
        const dbUser = await db.user.findUnique({
          where: { id: payload.userId },
          select: { canEdit: true },
        });
        if (!dbUser || !dbUser.canEdit) {
          return NextResponse.json(
            { success: false, error: 'Forbidden: Coordinator does not have editing rights' },
            { status: 403 }
          );
        }

        const isAssigned = await db.eventCoordinator.findUnique({
          where: { eventId_userId: { eventId, userId: payload.userId } },
        });
        let isPanelAssigned = false;
        if (panelId) {
          const pa = await db.panelCoordinator.findUnique({
            where: { panelId_userId: { panelId, userId: payload.userId } },
          });
          isPanelAssigned = !!pa;
        } else {
          const panelAssignments = await db.panelCoordinator.findMany({
            where: { userId: payload.userId, panel: { eventId } },
            select: { panelId: true },
          });
          isPanelAssigned = panelAssignments.length > 0;
        }
        if (!isAssigned && !isPanelAssigned) {
          return NextResponse.json(
            { success: false, error: 'Forbidden: Not assigned to this event or its panels' },
            { status: 403 }
          );
        }
      }

      let statusMsg = '';
      let createdTeamId: string | null = null;
      const createdParticipantIds: string[] = [];

      if (type === 'TEAM') {
        const teamName = item.name;
        const members = item.members || [];

        let team = await db.team.findFirst({
          where: { 
            eventId, 
            name: { equals: teamName, mode: 'insensitive' },
            panelId: panelId || null
          },
        });

        const isNew = !team;
        if (!team) {
          team = await db.team.create({
            data: {
              eventId,
              name: teamName,
              college: members[0]?.college || null,
              panelId: panelId || null,
            },
          });
          createdTeamId = team.id;
        }

        let addedCount = 0;
        let existCount = 0;
        for (const m of members) {
          const existingMember = await db.participant.findFirst({
            where: {
              eventId,
              name: m.name,
              teamId: team.id,
              panelId: panelId || null,
            },
          });

          if (!existingMember) {
            const newMember = await db.participant.create({
              data: {
                eventId,
                teamId: team.id,
                name: m.name,
                registerNumber: m.registerNumber,
                department: m.department,
                college: m.college || team.college || null,
                contactNumber: m.contactNumber,
                email: m.email,
                panelId: panelId || null,
              },
            });
            createdParticipantIds.push(newMember.id);
            addedCount++;
          } else {
            existCount++;
          }
        }

        statusMsg = isNew 
          ? `Team "${teamName}" created with ${addedCount} members`
          : `Team "${teamName}" updated: ${addedCount} new members added, ${existCount} already exist`;
      } else {
        // Individual participant
        const participantName = item.name;
        const existingParticipant = await db.participant.findFirst({
          where: {
            eventId,
            name: participantName,
            panelId: panelId || null,
          },
        });

        if (!existingParticipant) {
          const newMember = await db.participant.create({
            data: {
              eventId,
              name: participantName,
              registerNumber: item.registerNumber,
              department: item.department,
              college: item.college,
              contactNumber: item.contactNumber,
              email: item.email,
              panelId: panelId || null,
            },
          });
          createdParticipantIds.push(newMember.id);
          statusMsg = `Participant "${participantName}" created`;
        } else {
          statusMsg = `Participant "${participantName}" already exists`;
        }
      }

      return NextResponse.json({
        success: true,
        data: { 
          statusMsg,
          createdTeamId,
          createdParticipantIds
        },
      });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const eventId = formData.get('eventId') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File is required' },
        { status: 400 }
      );
    }

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Verify event exists
    const event = await db.event.findUnique({ where: { id: eventId } });
    if (!event || event.status === 'DELETED') {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Coordinator must be assigned to the event or its panels, and have editing rights
    if (isCoordinator && !isAdmin) {
      const dbUser = await db.user.findUnique({
        where: { id: payload.userId },
        select: { canEdit: true },
      });
      if (!dbUser || !dbUser.canEdit) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Coordinator does not have editing rights' },
          { status: 403 }
        );
      }

      const isAssigned = await db.eventCoordinator.findUnique({
        where: { eventId_userId: { eventId, userId: payload.userId } },
      });
      const panelId = formData.get('panelId') as string | null;
      let isPanelAssigned = false;
      if (panelId) {
        const pa = await db.panelCoordinator.findUnique({
          where: { panelId_userId: { panelId, userId: payload.userId } },
        });
        isPanelAssigned = !!pa;
      } else {
        const panelAssignments = await db.panelCoordinator.findMany({
          where: { userId: payload.userId, panel: { eventId } },
          select: { panelId: true },
        });
        isPanelAssigned = panelAssignments.length > 0;
      }
      if (!isAssigned && !isPanelAssigned) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Not assigned to this event or its panels' },
          { status: 403 }
        );
      }
    }

    // Parse Excel file
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Excel file is empty' },
        { status: 400 }
      );
    }

    const results = {
      successCount: 0,
      errorCount: 0,
      errors: [] as { row: number; message: string }[],
    };

    if (event.eventType === 'TEAM') {
      // Pre-process rows to handle merged cells or single team-label groupings (carry forward & backward)
      let lastTeamName = '';
      for (let i = 0; i < rows.length; i++) {
        const tName = rows[i]['Team Name']?.toString().trim();
        if (tName) {
          lastTeamName = tName;
        } else if (lastTeamName) {
          rows[i]['Team Name'] = lastTeamName;
        }
      }
      lastTeamName = '';
      for (let i = rows.length - 1; i >= 0; i--) {
        const tName = rows[i]['Team Name']?.toString().trim();
        if (tName) {
          lastTeamName = tName;
        } else if (lastTeamName) {
          rows[i]['Team Name'] = lastTeamName;
        }
      }

      // Team event format:
      // Team Name, Name (or Participant Name), Department, College, Contact Number, Email
      const teamMap = new Map<string, any[]>();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const teamName = row['Team Name']?.toString().trim();
        const memberName = (row['Name'] || row['Participant Name'] || row['Member Name'])?.toString().trim();

        if (!teamName || !memberName) {
          results.errorCount++;
          results.errors.push({
            row: i + 2, // +2 for header row and 0-indexing
            message: 'Missing Team Name or Participant Name',
          });
          continue;
        }

        if (!teamMap.has(teamName)) {
          teamMap.set(teamName, []);
        }

        teamMap.get(teamName)!.push({
          name: memberName,
          registerNumber: row['Register Number']?.toString().trim() || null,
          department: row['Department']?.toString().trim() || null,
          college: row['College']?.toString().trim() || null,
          contactNumber: row['Contact Number']?.toString().trim() || null,
          email: row['Email']?.toString().trim() || null,
        });
      }

      // Check for duplicate team names in the event
      const existingTeams = await db.team.findMany({
        where: { eventId },
        select: { name: true },
      });
      const existingTeamNames = new Set(existingTeams.map((t) => t.name.toLowerCase()));

      // Create/update teams and members
      for (const [teamName, members] of teamMap) {
        try {
          let team = await db.team.findFirst({
            where: { eventId, name: { equals: teamName, mode: 'insensitive' } },
          });

          if (!team) {
            team = await db.team.create({
              data: {
                eventId,
                name: teamName,
                college: members[0].college || null,
              },
            });
          }

          // Add members to the team
          for (const m of members) {
            // Check if member already exists in this team
            const existingMember = await db.participant.findFirst({
              where: {
                eventId,
                name: m.name,
                teamId: team.id,
              },
            });

            if (!existingMember) {
              await db.participant.create({
                data: {
                  eventId,
                  teamId: team.id,
                  name: m.name,
                  registerNumber: m.registerNumber,
                  department: m.department,
                  college: m.college || team.college || null,
                  contactNumber: m.contactNumber,
                  email: m.email,
                },
              });
              results.successCount++;
            } else {
              // Member already exists, skip without error
              results.successCount++;
            }
          }
        } catch (error) {
          results.errorCount += members.length;
          results.errors.push({
            row: 0,
            message: `Failed to process team "${teamName}": ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }
    } else {
      // Individual event format:
      // Name, Department, College, Contact Number, Email
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const participantName = (row['Name'] || row['Participant Name'] || row['Member Name'])?.toString().trim();

        if (!participantName) {
          results.errorCount++;
          results.errors.push({
            row: i + 2,
            message: 'Missing Name or Participant Name',
          });
          continue;
        }

        try {
          await db.participant.create({
            data: {
              eventId,
              name: participantName,
              registerNumber: row['Register Number']?.toString().trim() || null,
              department: row['Department']?.toString().trim() || null,
              college: row['College']?.toString().trim() || null,
              contactNumber: row['Contact Number']?.toString().trim() || null,
              email: row['Email']?.toString().trim() || null,
            },
          });
          results.successCount++;
        } catch (error) {
          results.errorCount++;
          results.errors.push({
            row: i + 2,
            message: `Failed to create participant "${participantName}": ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }
    }

    await db.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'BULK_UPLOAD',
        entity: event.eventType === 'TEAM' ? 'Team' : 'Participant',
        entityId: eventId,
        details: `Bulk uploaded ${results.successCount} records with ${results.errorCount} errors`,
      },
    });

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Bulk upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
