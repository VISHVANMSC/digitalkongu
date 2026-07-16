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
    const existing = await db.participant.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Participant not found' },
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
    const { name, registerNumber, department, college, contactNumber, email, teamId, panelId } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (registerNumber !== undefined) updateData.registerNumber = registerNumber;
    if (department !== undefined) updateData.department = department;
    if (college !== undefined) updateData.college = college;
    if (contactNumber !== undefined) updateData.contactNumber = contactNumber;
    if (email !== undefined) updateData.email = email;
    if (teamId !== undefined) updateData.teamId = teamId || null;
    if (panelId !== undefined) updateData.panelId = panelId || null;

    const participant = await db.participant.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: participant,
    });
  } catch (error) {
    console.error('Update participant error:', error);
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
    const existing = await db.participant.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Participant not found' },
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

    await db.participant.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'DELETE',
        entity: 'Participant',
        entityId: id,
        details: `Deleted participant: ${existing.name}`,
      },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Participant deleted successfully' },
    });
  } catch (error) {
    console.error('Delete participant error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
