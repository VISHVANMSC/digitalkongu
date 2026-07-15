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

    // Role-based filtering for coordinators and evaluators
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

    const teams = await db.team.findMany({
      where,
      include: {
        event: {
          select: { id: true, name: true, eventType: true },
        },
        _count: {
          select: { members: true, evaluations: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: teams,
    });
  } catch (error) {
    console.error('List teams error:', error);
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
    const { eventId, name, college, members } = body;

    if (!eventId || !name) {
      return NextResponse.json(
        { success: false, error: 'Event ID and team name are required' },
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

    const team = await db.team.create({
      data: {
        eventId,
        name,
        college: college || null,
        panelId: assignedPanelId || body.panelId || null,
        members: members
          ? {
              create: members.map((m: any) => ({
                eventId,
                name: m.name,
                registerNumber: m.registerNumber || null,
                department: m.department || null,
                college: m.college || college || null,
                contactNumber: m.contactNumber || null,
                email: m.email || null,
                panelId: assignedPanelId || body.panelId || null,
              })),
            }
          : undefined,
      },
      include: {
        members: true,
        event: {
          select: { id: true, name: true },
        },
      },
    });

    await db.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'CREATE',
        entity: 'Team',
        entityId: team.id,
        details: `Created team: ${name} in event ${eventId}`,
      },
    });

    return NextResponse.json(
      { success: true, data: team },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create team error:', error);
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
        { success: false, error: 'Array of team IDs is required' },
        { status: 400 }
      );
    }

    // Delete teams (cascade deletes members and evaluations)
    await db.team.deleteMany({
      where: {
        id: { in: ids },
      },
    });

    await db.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'BULK_DELETE',
        entity: 'Team',
        details: `Bulk deleted ${ids.length} teams`,
      },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Teams deleted successfully' },
    });
  } catch (error) {
    console.error('Bulk delete teams error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

