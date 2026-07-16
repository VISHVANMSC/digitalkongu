import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireRole } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const payload = await authenticateRequest(request);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const panelId = searchParams.get('panelId');

    const where: any = {};

    if (eventId) {
      where.eventId = eventId;
    }

    // Role-based filtering
    if (payload.role === 'COORDINATOR') {
      const assignments = await db.eventCoordinator.findMany({
        where: { userId: payload.userId },
        select: { eventId: true },
      });
      const assignedEventIds = assignments.map((a) => a.eventId);

      const panelAssignments = await db.panelCoordinator.findMany({
        where: { userId: payload.userId },
        select: { panel: { select: { id: true, eventId: true } } },
      });
      const panelAssignedEventIds = panelAssignments.map((pa) => pa.panel.eventId);

      const allAssignedEventIds = Array.from(new Set([...assignedEventIds, ...panelAssignedEventIds]));

      if (eventId) {
        if (!allAssignedEventIds.includes(eventId)) {
          return NextResponse.json(
            { success: false, error: 'Forbidden: Not assigned to this event or its panels' },
            { status: 403 }
          );
        }

        const specificPanels = panelAssignments.filter((pa) => pa.panel.eventId === eventId).map((pa) => pa.panel.id);
        if (specificPanels.length > 0) {
          if (panelId) {
            if (!specificPanels.includes(panelId)) {
              return NextResponse.json(
                { success: false, error: 'Forbidden: Not assigned to this panel' },
                { status: 403 }
              );
            }
            where.panelId = panelId;
          } else {
            where.panelId = { in: specificPanels };
          }
        } else if (panelId) {
          where.panelId = panelId;
        }
      } else {
        where.OR = [
          { eventId: { in: assignedEventIds } },
          { panelId: { in: panelAssignments.map((pa) => pa.panel.id) } },
        ];
      }
    } else if (payload.role === 'EVALUATOR') {
      const assignments = await db.eventEvaluator.findMany({
        where: { userId: payload.userId },
        select: { eventId: true },
      });
      const assignedEventIds = assignments.map((a) => a.eventId);

      const panelAssignments = await db.panelEvaluator.findMany({
        where: { userId: payload.userId },
        select: { panel: { select: { id: true, eventId: true } } },
      });
      const panelAssignedEventIds = panelAssignments.map((pa) => pa.panel.eventId);

      const allAssignedEventIds = Array.from(new Set([...assignedEventIds, ...panelAssignedEventIds]));

      if (eventId) {
        if (!allAssignedEventIds.includes(eventId)) {
          return NextResponse.json(
            { success: false, error: 'Forbidden: Not assigned to this event or its panels' },
            { status: 403 }
          );
        }

        const specificPanels = panelAssignments.filter((pa) => pa.panel.eventId === eventId).map((pa) => pa.panel.id);
        if (specificPanels.length > 0) {
          if (panelId) {
            if (!specificPanels.includes(panelId)) {
              return NextResponse.json(
                { success: false, error: 'Forbidden: Not assigned to this panel' },
                { status: 403 }
              );
            }
            where.panelId = panelId;
          } else {
            where.panelId = { in: specificPanels };
          }
        } else if (panelId) {
          where.panelId = panelId;
        }
      } else {
        where.OR = [
          { eventId: { in: assignedEventIds } },
          { panelId: { in: panelAssignments.map((pa) => pa.panel.id) } },
        ];
      }
    }

    const participants = await db.participant.findMany({
      where,
      include: {
        event: {
          select: { id: true, name: true, eventType: true },
        },
        team: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: participants,
    });
  } catch (error) {
    console.error('List participants error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
    const { eventId, teamId, name, registerNumber, department, college, contactNumber, email } = body;

    if (!eventId || !name) {
      return NextResponse.json(
        { success: false, error: 'Event ID and participant name are required' },
        { status: 400 }
      );
    }

    // Coordinator must be assigned to the event or its panels
    let assignedPanelId: string | null = null;
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

      const panelAssignments = await db.panelCoordinator.findMany({
        where: { userId: payload.userId, panel: { eventId } },
        select: { panelId: true },
      });

      if (!isAssigned && panelAssignments.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Not assigned to this event or its panels' },
          { status: 403 }
        );
      }

      if (panelAssignments.length > 0) {
        assignedPanelId = panelAssignments[0].panelId;
      }
    }

    const participant = await db.participant.create({
      data: {
        eventId,
        teamId: teamId || null,
        panelId: assignedPanelId || body.panelId || null,
        name,
        registerNumber: registerNumber || null,
        department: department || null,
        college: college || null,
        contactNumber: contactNumber || null,
        email: email || null,
      },
    });

    await db.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'CREATE',
        entity: 'Participant',
        entityId: participant.id,
        details: `Added participant: ${name} to event ${eventId}`,
      },
    });

    return NextResponse.json(
      { success: true, data: participant },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create participant error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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

    // Coordinator must have canEdit privileges
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
    }

    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Array of participant IDs is required' },
        { status: 400 }
      );
    }

    // Verify coordinator is assigned to the events associated with these participants
    if (isCoordinator && !isAdmin) {
      const participants = await db.participant.findMany({
        where: { id: { in: ids } },
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

    await db.participant.deleteMany({
      where: {
        id: { in: ids },
      },
    });

    await db.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'BULK_DELETE',
        entity: 'Participant',
        details: `Bulk deleted ${ids.length} participants`,
      },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Participants deleted successfully' },
    });
  } catch (error) {
    console.error('Bulk delete participants error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

