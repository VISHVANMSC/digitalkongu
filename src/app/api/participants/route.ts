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

    // Role-based filtering
    if (payload.role === 'COORDINATOR') {
      const assignments = await db.eventCoordinator.findMany({
        where: { userId: payload.userId },
        select: { eventId: true },
      });
      const assignedEventIds = assignments.map((a) => a.eventId);
      if (eventId) {
        // If filtering by specific event, check if assigned
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

    const participant = await db.participant.create({
      data: {
        eventId,
        teamId: teamId || null,
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
