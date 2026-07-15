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
    const programId = searchParams.get('programId');
    const full = searchParams.get('full') === 'true';

    const where: any = { status: { not: 'DELETED' } };
    if (programId) {
      where.programId = programId;
    }

    // Role-based filtering
    if (payload.role === 'COORDINATOR') {
      const assignments = await db.eventCoordinator.findMany({
        where: { userId: payload.userId },
        select: { eventId: true },
      });
      const panelAssignments = await db.panelCoordinator.findMany({
        where: { userId: payload.userId },
        select: { panel: { select: { eventId: true } } },
      });
      const assignedEventIds = Array.from(new Set([
        ...assignments.map((a) => a.eventId),
        ...panelAssignments.map((pa) => pa.panel.eventId),
      ]));
      where.id = { in: assignedEventIds };
    } else if (payload.role === 'EVALUATOR') {
      const assignments = await db.eventEvaluator.findMany({
        where: { userId: payload.userId },
        select: { eventId: true },
      });
      const panelAssignments = await db.panelEvaluator.findMany({
        where: { userId: payload.userId },
        select: { panel: { select: { eventId: true } } },
      });
      const assignedEventIds = Array.from(new Set([
        ...assignments.map((a) => a.eventId),
        ...panelAssignments.map((pa) => pa.panel.eventId),
      ]));
      where.id = { in: assignedEventIds };
    }

    const include: any = {
      program: {
        select: { id: true, name: true },
      },
      _count: {
        select: {
          teams: true,
          participants: true,
          evaluations: true,
          coordinators: true,
          evaluators: true,
        },
      },
    };

    if (full) {
      include.criteria = {
        orderBy: { order: 'asc' },
      };
      include.coordinators = {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      };
      include.evaluators = {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      };
      include.panels = {
        include: {
          coordinators: { include: { user: { select: { id: true, name: true, email: true } } } },
          evaluators: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      };
    }

    const events = await db.event.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error('List events error:', error);
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

    if (!requireRole('ADMIN')(payload)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      programId,
      name,
      description,
      venue,
      eventDate,
      evaluationStart,
      eventType,
      evaluationMode,
      maxStarRating,
      criteria,
      coordinatorIds,
      evaluatorIds,
    } = body;

    if (!programId || !name) {
      return NextResponse.json(
        { success: false, error: 'Program ID and event name are required' },
        { status: 400 }
      );
    }

    // Verify program exists
    const program = await db.program.findUnique({ where: { id: programId } });
    if (!program || program.status === 'DELETED') {
      return NextResponse.json(
        { success: false, error: 'Program not found' },
        { status: 404 }
      );
    }

    const event = await db.event.create({
      data: {
        programId,
        name,
        description: description || null,
        venue: venue || null,
        eventDate: eventDate ? new Date(eventDate) : null,
        evaluationStart: evaluationStart ? new Date(evaluationStart) : null,
        eventType: eventType || 'TEAM',
        evaluationMode: evaluationMode || 'MARKS',
        maxStarRating: maxStarRating || 5,
        criteria: criteria
          ? {
              create: criteria.map((c: any, index: number) => ({
                name: c.name,
                maxMarks: c.maxMarks || 0,
                maxStars: c.maxStars || 5,
                weightage: c.weightage || 0,
                order: c.order ?? index,
              })),
            }
          : undefined,
        coordinators: coordinatorIds
          ? {
              create: coordinatorIds.map((userId: string) => ({ userId })),
            }
          : undefined,
        evaluators: evaluatorIds
          ? {
              create: evaluatorIds.map((userId: string) => ({ userId })),
            }
          : undefined,
      },
      include: {
        criteria: true,
        coordinators: { include: { user: { select: { id: true, name: true, email: true } } } },
        evaluators: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });

    await db.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'CREATE',
        entity: 'Event',
        entityId: event.id,
        details: `Created event: ${name} in program ${program.name}`,
      },
    });

    return NextResponse.json(
      { success: true, data: event },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create event error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
