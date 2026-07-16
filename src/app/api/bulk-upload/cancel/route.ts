import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireRole } from '@/lib/auth';
import { db } from '@/lib/db';

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

    const body = await request.json();
    const { teamIds, participantIds } = body;

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

      // Verify coordinator is assigned to the events/panels associated with the teams
      if (teamIds && Array.isArray(teamIds) && teamIds.length > 0) {
        const teams = await db.team.findMany({
          where: { id: { in: teamIds } },
          select: { eventId: true },
        });
        for (const team of teams) {
          const isAssigned = await db.eventCoordinator.findUnique({
            where: { eventId_userId: { eventId: team.eventId, userId: payload.userId } },
          });
          const panelAssignments = await db.panelCoordinator.findMany({
            where: { userId: payload.userId, panel: { eventId: team.eventId } },
            select: { panelId: true },
          });
          if (!isAssigned && panelAssignments.length === 0) {
            return NextResponse.json(
              { success: false, error: 'Forbidden: Not assigned to the event of these teams' },
              { status: 403 }
            );
          }
        }
      }

      // Verify coordinator is assigned to the events/panels associated with the participants
      if (participantIds && Array.isArray(participantIds) && participantIds.length > 0) {
        const participants = await db.participant.findMany({
          where: { id: { in: participantIds } },
          select: { eventId: true },
        });
        for (const part of participants) {
          const isAssigned = await db.eventCoordinator.findUnique({
            where: { eventId_userId: { eventId: part.eventId, userId: payload.userId } },
          });
          const panelAssignments = await db.panelCoordinator.findMany({
            where: { userId: payload.userId, panel: { eventId: part.eventId } },
            select: { panelId: true },
          });
          if (!isAssigned && panelAssignments.length === 0) {
            return NextResponse.json(
              { success: false, error: 'Forbidden: Not assigned to the event of these participants' },
              { status: 403 }
            );
          }
        }
      }
    }

    // Delete all participants and teams in the arrays
    if (participantIds && Array.isArray(participantIds) && participantIds.length > 0) {
      await db.participant.deleteMany({
        where: { id: { in: participantIds } },
      });
    }

    if (teamIds && Array.isArray(teamIds) && teamIds.length > 0) {
      await db.team.deleteMany({
        where: { id: { in: teamIds } },
      });
    }

    await db.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'BULK_UPLOAD_CANCEL',
        entity: 'BulkUpload',
        details: `Cleaned up ${teamIds?.length || 0} teams and ${participantIds?.length || 0} participants due to cancellation/failure`,
      },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Partially uploaded data cleaned up successfully' },
    });
  } catch (error) {
    console.error('Cancel bulk upload cleanup error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
