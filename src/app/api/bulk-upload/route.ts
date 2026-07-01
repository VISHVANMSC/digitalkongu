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

    // Coordinator must be assigned to the event
    if (isCoordinator && !isAdmin) {
      const isAssigned = await db.eventCoordinator.findUnique({
        where: { eventId_userId: { eventId, userId: payload.userId } },
      });
      if (!isAssigned) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Not assigned to this event' },
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

      // Create teams and members
      for (const [teamName, members] of teamMap) {
        try {
          if (existingTeamNames.has(teamName.toLowerCase())) {
            results.errorCount++;
            results.errors.push({
              row: 0,
              message: `Team "${teamName}" already exists in this event`,
            });
            continue;
          }

          const team = await db.team.create({
            data: {
              eventId,
              name: teamName,
              college: members[0].college || null,
              members: {
                create: members.map((m) => ({
                  eventId,
                  name: m.name,
                  registerNumber: m.registerNumber,
                  department: m.department,
                  college: m.college,
                  contactNumber: m.contactNumber,
                  email: m.email,
                })),
              },
            },
          });

          results.successCount += members.length;
        } catch (error) {
          results.errorCount += members.length;
          results.errors.push({
            row: 0,
            message: `Failed to create team "${teamName}": ${error instanceof Error ? error.message : 'Unknown error'}`,
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
