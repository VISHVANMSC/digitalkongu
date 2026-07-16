import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireRole } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await authenticateRequest(request);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const team = await db.team.findUnique({
      where: { id },
      include: {
        event: {
          select: { id: true, name: true, eventType: true },
        },
        members: {
          orderBy: { name: 'asc' },
        },
        evaluations: {
          include: {
            evaluator: { select: { id: true, name: true } },
            scores: {
              include: {
                criteria: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
    }

    // Role-based access check
    if (payload.role === 'COORDINATOR') {
      const isAssigned = await db.eventCoordinator.findUnique({
        where: { eventId_userId: { eventId: team.eventId, userId: payload.userId } },
      });
      const panelAssignments = await db.panelCoordinator.findMany({
        where: { userId: payload.userId, panel: { eventId: team.eventId } },
        select: { panelId: true },
      });
      if (!isAssigned && panelAssignments.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Not assigned to this event or its panels' },
          { status: 403 }
        );
      }
    } else if (payload.role === 'EVALUATOR') {
      const isAssigned = await db.eventEvaluator.findUnique({
        where: { eventId_userId: { eventId: team.eventId, userId: payload.userId } },
      });
      if (!isAssigned) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Not assigned to this event' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: team,
    });
  } catch (error) {
    console.error('Get team error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const existing = await db.team.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
    }

    // Coordinator must be assigned to the event or its panels
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
        where: { eventId_userId: { eventId: existing.eventId, userId: payload.userId } },
      });
      const panelAssignments = await db.panelCoordinator.findMany({
        where: { userId: payload.userId, panel: { eventId: existing.eventId } },
        select: { panelId: true },
      });
      if (!isAssigned && panelAssignments.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Not assigned to this event or its panels' },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const { name, college, members, panelId } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (college !== undefined) updateData.college = college;
    if (panelId !== undefined) updateData.panelId = panelId || null;

    // Handle member updates
    if (members !== undefined) {
      // Delete existing members and recreate
      await db.participant.deleteMany({ where: { teamId: id } });
      if (members.length > 0) {
        updateData.members = {
          create: members.map((m: any) => ({
            eventId: existing.eventId,
            name: m.name,
            registerNumber: m.registerNumber || null,
            department: m.department || null,
            college: m.college || college || existing.college || null,
            contactNumber: m.contactNumber || null,
            email: m.email || null,
            panelId: panelId !== undefined ? (panelId || null) : (existing.panelId || null),
          })),
        };
      }
    }

    if (panelId !== undefined) {
      await db.participant.updateMany({
        where: { teamId: id },
        data: { panelId: panelId || null },
      });
    }

    const team = await db.team.update({
      where: { id },
      data: updateData,
      include: { members: true },
    });

    await db.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'UPDATE',
        entity: 'Team',
        entityId: id,
        details: `Updated team: ${team.name}`,
      },
    });

    return NextResponse.json({
      success: true,
      data: team,
    });
  } catch (error) {
    console.error('Update team error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const existing = await db.team.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
    }

    // Coordinator must be assigned to the event or its panels
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
        where: { eventId_userId: { eventId: existing.eventId, userId: payload.userId } },
      });
      const panelAssignments = await db.panelCoordinator.findMany({
        where: { userId: payload.userId, panel: { eventId: existing.eventId } },
        select: { panelId: true },
      });
      if (!isAssigned && panelAssignments.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Not assigned to this event or its panels' },
          { status: 403 }
        );
      }
    }

    // Delete team (cascade will delete members)
    await db.team.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'DELETE',
        entity: 'Team',
        entityId: id,
        details: `Deleted team: ${existing.name}`,
      },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Team deleted successfully' },
    });
  } catch (error) {
    console.error('Delete team error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
