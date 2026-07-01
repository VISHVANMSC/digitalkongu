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
    const evaluatorId = searchParams.get('evaluatorId');

    const where: any = {};

    if (eventId) {
      where.eventId = eventId;
    }

    // Role-based filtering
    if (payload.role === 'ADMIN') {
      // Admin sees all
      if (evaluatorId) {
        where.evaluatorId = evaluatorId;
      }
    } else if (payload.role === 'COORDINATOR') {
      // Coordinator sees evaluations from assigned events
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
      // Evaluator sees only own evaluations
      where.evaluatorId = payload.userId;
    }

    const evaluations = await db.evaluation.findMany({
      where,
      include: {
        event: {
          select: { id: true, name: true, eventType: true, evaluationMode: true },
        },
        team: {
          select: { id: true, name: true, college: true },
        },
        participant: {
          select: { id: true, name: true, college: true },
        },
        evaluator: {
          select: { id: true, name: true, email: true },
        },
        scores: {
          include: {
            criteria: {
              select: { id: true, name: true, maxMarks: true, maxStars: true, weightage: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: evaluations,
    });
  } catch (error) {
    console.error('List evaluations error:', error);
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

    if (!requireRole('EVALUATOR')(payload) && !requireRole('ADMIN')(payload)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Evaluator or Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { eventId, teamId, participantId, status, comments, scores } = body;

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Must provide either teamId or participantId
    if (!teamId && !participantId) {
      return NextResponse.json(
        { success: false, error: 'Either teamId or participantId is required' },
        { status: 400 }
      );
    }

    // Evaluator must be assigned to the event (unless admin)
    if (requireRole('EVALUATOR')(payload) && !requireRole('ADMIN')(payload)) {
      const isAssigned = await db.eventEvaluator.findUnique({
        where: { eventId_userId: { eventId, userId: payload.userId } },
      });
      if (!isAssigned) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Not assigned to this event' },
          { status: 403 }
        );
      }
    }

    // Calculate total score
    let totalScore = 0;
    if (scores && scores.length > 0) {
      totalScore = scores.reduce((sum: number, s: any) => sum + (s.score || s.starRating || 0), 0);
    }

    const evaluation = await db.evaluation.create({
      data: {
        eventId,
        teamId: teamId || null,
        participantId: participantId || null,
        evaluatorId: payload.userId,
        status: status || 'DRAFT',
        totalScore,
        comments: comments || null,
        submittedAt: status === 'SUBMITTED' ? new Date() : null,
        scores: scores
          ? {
              create: scores.map((s: any) => ({
                criteriaId: s.criteriaId,
                score: s.score || 0,
                starRating: s.starRating || 0,
                comments: s.comments || null,
              })),
            }
          : undefined,
      },
      include: {
        scores: {
          include: {
            criteria: { select: { id: true, name: true, maxMarks: true, maxStars: true } },
          },
        },
      },
    });

    await db.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'CREATE',
        entity: 'Evaluation',
        entityId: evaluation.id,
        details: `Created evaluation for event ${eventId}`,
      },
    });

    return NextResponse.json(
      { success: true, data: evaluation },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create evaluation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
