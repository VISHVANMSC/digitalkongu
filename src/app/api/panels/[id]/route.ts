import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireRole } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await authenticateRequest(request);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, coordinatorIds, evaluatorIds, teamIds, participantIds } = body;

    const panel = await db.panel.findUnique({
      where: { id },
      include: { event: true },
    });

    if (!panel) {
      return NextResponse.json({ success: false, error: 'Panel not found' }, { status: 404 });
    }

    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();

    // 1. Handle coordinators
    if (coordinatorIds !== undefined) {
      await db.panelCoordinator.deleteMany({ where: { panelId: id } });
      if (coordinatorIds.length > 0) {
        updateData.coordinators = {
          create: coordinatorIds.map((userId: string) => ({ userId })),
        };
      }
    }

    // 2. Handle evaluators
    if (evaluatorIds !== undefined) {
      await db.panelEvaluator.deleteMany({ where: { panelId: id } });
      if (evaluatorIds.length > 0) {
        updateData.evaluators = {
          create: evaluatorIds.map((userId: string) => ({ userId })),
        };
      }
    }

    // Update panel name/coordinators/evaluators
    const updatedPanel = await db.panel.update({
      where: { id },
      data: updateData,
      include: {
        coordinators: { include: { user: { select: { id: true, name: true } } } },
        evaluators: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    // 3. Handle participant/team reassignments
    const eventId = panel.eventId;
    if (panel.event.eventType === 'TEAM' && teamIds !== undefined) {
      // Set panelId to null for teams currently in this panel but not in the new teamIds list
      await db.team.updateMany({
        where: { eventId, panelId: id, id: { notIn: teamIds } },
        data: { panelId: null },
      });
      // Also update team members' panelId to null
      await db.participant.updateMany({
        where: { eventId, panelId: id, team: { id: { notIn: teamIds } } },
        data: { panelId: null },
      });

      // Set panelId to this panel for teams in the new list
      if (teamIds.length > 0) {
        await db.team.updateMany({
          where: { eventId, id: { in: teamIds } },
          data: { panelId: id },
        });
        await db.participant.updateMany({
          where: { eventId, teamId: { in: teamIds } },
          data: { panelId: id },
        });
      }
    } else if (panel.event.eventType === 'INDIVIDUAL' && participantIds !== undefined) {
      // Set panelId to null for participants currently in this panel but not in the list
      await db.participant.updateMany({
        where: { eventId, panelId: id, id: { notIn: participantIds } },
        data: { panelId: null },
      });

      // Set panelId to this panel for participants in the list
      if (participantIds.length > 0) {
        await db.participant.updateMany({
          where: { eventId, id: { in: participantIds } },
          data: { panelId: id },
        });
      }
    }

    await db.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'UPDATE',
        entity: 'Panel',
        entityId: id,
        details: `Updated panel ${updatedPanel.name} (assignments synced)`,
      },
    });

    return NextResponse.json({ success: true, data: updatedPanel });
  } catch (error) {
    console.error('Update panel error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await authenticateRequest(request);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const panel = await db.panel.findUnique({ where: { id } });

    if (!panel) {
      return NextResponse.json({ success: false, error: 'Panel not found' }, { status: 404 });
    }

    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    if (panel.name.toLowerCase() === 'panel 1') {
      return NextResponse.json({ success: false, error: 'Cannot delete Panel 1, it is the default panel' }, { status: 400 });
    }

    // Delete panel
    await db.panel.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'DELETE',
        entity: 'Panel',
        entityId: id,
        details: `Deleted panel ${panel.name} for event ${panel.eventId}`,
      },
    });

    return NextResponse.json({ success: true, data: { message: 'Panel deleted successfully' } });
  } catch (error) {
    console.error('Delete panel error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
