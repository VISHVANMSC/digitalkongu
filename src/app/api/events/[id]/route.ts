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
    const event = await db.event.findUnique({
      where: { id },
      include: {
        program: {
          select: { id: true, name: true },
        },
        criteria: {
          orderBy: { order: 'asc' },
        },
        coordinators: {
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true },
            },
          },
        },
        evaluators: {
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true },
            },
          },
        },
        panels: {
          include: {
            coordinators: { include: { user: { select: { id: true, name: true, email: true } } } },
            evaluators: { include: { user: { select: { id: true, name: true, email: true } } } },
          },
        },
        _count: {
          select: {
            teams: true,
            participants: true,
            evaluations: true,
          },
        },
      },
    });

    if (!event || event.status === 'DELETED') {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Role-based access check for coordinators and evaluators
    if (payload.role === 'COORDINATOR') {
      const isAssigned = await db.eventCoordinator.findUnique({
        where: { eventId_userId: { eventId: id, userId: payload.userId } },
      });
      const isPanelAssigned = await db.panelCoordinator.findFirst({
        where: { userId: payload.userId, panel: { eventId: id } },
      });
      if (!isAssigned && !isPanelAssigned) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Not assigned to this event or any of its panels' },
          { status: 403 }
        );
      }
    } else if (payload.role === 'EVALUATOR') {
      const isAssigned = await db.eventEvaluator.findUnique({
        where: { eventId_userId: { eventId: id, userId: payload.userId } },
      });
      const isPanelAssigned = await db.panelEvaluator.findFirst({
        where: { userId: payload.userId, panel: { eventId: id } },
      });
      if (!isAssigned && !isPanelAssigned) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Not assigned to this event or any of its panels' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error('Get event error:', error);
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

    if (!requireRole('ADMIN')(payload)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const {
      name,
      description,
      venue,
      eventDate,
      evaluationStart,
      eventType,
      evaluationMode,
      maxStarRating,
      status,
      criteria,
      coordinatorIds,
      evaluatorIds,
    } = body;

    const existing = await db.event.findUnique({ where: { id } });
    if (!existing || existing.status === 'DELETED') {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Update basic fields
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (venue !== undefined) updateData.venue = venue;
    if (eventDate !== undefined) updateData.eventDate = eventDate ? new Date(eventDate) : null;
    if (evaluationStart !== undefined) updateData.evaluationStart = evaluationStart ? new Date(evaluationStart) : null;
    if (eventType !== undefined) updateData.eventType = eventType;
    if (evaluationMode !== undefined) updateData.evaluationMode = evaluationMode;
    if (maxStarRating !== undefined) updateData.maxStarRating = maxStarRating;
    if (status !== undefined) updateData.status = status;

    // Handle criteria update robustly to avoid foreign key violations on existing scores
    if (criteria !== undefined) {
      const existingCriteria = await db.evaluationCriteria.findMany({
        where: { eventId: id },
        orderBy: { order: 'asc' },
      });

      // 1. Update existing and create new criteria
      for (let index = 0; index < criteria.length; index++) {
        const c = criteria[index];
        if (index < existingCriteria.length) {
          // Update in place
          await db.evaluationCriteria.update({
            where: { id: existingCriteria[index].id },
            data: {
              name: c.name,
              maxMarks: c.maxMarks || 0,
              maxStars: c.maxStars || 5,
              weightage: c.weightage || 0,
              order: c.order ?? index,
            },
          });
        } else {
          // Create new
          await db.evaluationCriteria.create({
            data: {
              eventId: id,
              name: c.name,
              maxMarks: c.maxMarks || 0,
              maxStars: c.maxStars || 5,
              weightage: c.weightage || 0,
              order: c.order ?? index,
            },
          });
        }
      }

      // 2. Delete extra criteria that were removed
      if (existingCriteria.length > criteria.length) {
        const criteriaIdsToDelete = existingCriteria
          .slice(criteria.length)
          .map((ec) => ec.id);

        // Delete dependent evaluation scores first to avoid constraint violation
        await db.evaluationScore.deleteMany({
          where: { criteriaId: { in: criteriaIdsToDelete } },
        });

        // Delete the criteria
        await db.evaluationCriteria.deleteMany({
          where: { id: { in: criteriaIdsToDelete } },
        });
      }
    }

    // Handle coordinator assignments
    if (coordinatorIds !== undefined) {
      await db.eventCoordinator.deleteMany({ where: { eventId: id } });
      if (coordinatorIds.length > 0) {
        updateData.coordinators = {
          create: coordinatorIds.map((userId: string) => ({ userId })),
        };
      }
    }

    // Handle evaluator assignments
    if (evaluatorIds !== undefined) {
      await db.eventEvaluator.deleteMany({ where: { eventId: id } });
      if (evaluatorIds.length > 0) {
        updateData.evaluators = {
          create: evaluatorIds.map((userId: string) => ({ userId })),
        };
      }
    }

    const event = await db.event.update({
      where: { id },
      data: updateData,
      include: {
        criteria: { orderBy: { order: 'asc' } },
        coordinators: { include: { user: { select: { id: true, name: true, email: true } } } },
        evaluators: { include: { user: { select: { id: true, name: true, email: true } } } },
        panels: {
          include: {
            coordinators: { include: { user: { select: { id: true, name: true, email: true } } } },
            evaluators: { include: { user: { select: { id: true, name: true, email: true } } } },
          },
        },
      },
    });

    await db.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'UPDATE',
        entity: 'Event',
        entityId: id,
        details: `Updated event: ${event.name}`,
      },
    });

    return NextResponse.json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error('Update event error:', error);
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

    if (!requireRole('ADMIN')(payload)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const existing = await db.event.findUnique({ where: { id } });
    if (!existing || existing.status === 'DELETED') {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Hard delete (will automatically cascade delete related records due to onDelete: Cascade schema relations)
    const event = await db.event.delete({
      where: { id },
    });

    await db.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'DELETE',
        entity: 'Event',
        entityId: id,
        details: `Permanently deleted event and all cascading records: ${existing.name}`,
      },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Event deleted successfully' },
    });
  } catch (error) {
    console.error('Delete event error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
