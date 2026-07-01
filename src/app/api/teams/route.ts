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
      if (eventId) {
        if (!assignedEventIds.includes(eventId)) {
          return NextResponse.json(
            { success: false, error: 'Forbidden: Not assigned to this event' },
            { status: 403 }
          );
        }
      } else {
        where.eventId = { in: assignedEventIds };
      }
    } else if (payload.role === 'EVALUATOR') {
      const assignments = await db.eventEvaluator.findMany({
        where: { userId: payload.userId },
        select: { eventId: true },
      });
      const assignedEventIds = assignments.map((a) => a.eventId);
      if (eventId) {
        if (!assignedEventIds.includes(eventId)) {
          return NextResponse.json(
            { success: false, error: 'Forbidden: Not assigned to this event' },
            { status: 403 }
          );
        }
      } else {
        where.eventId = { in: assignedEventIds };
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

    const team = await db.team.create({
      data: {
        eventId,
        name,
        college: college || null,
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
