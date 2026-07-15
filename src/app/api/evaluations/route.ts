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
    const panelId = searchParams.get('panelId');

    const where: any = {};

    if (eventId) {
      where.eventId = eventId;
    }

    if (panelId) {
      where.panelId = panelId;
    }

    // Role-based filtering
    if (payload.role === 'ADMIN') {
      // Admin sees all
      if (evaluatorId) {
        where.evaluatorId = evaluatorId;
      }
    } else if (payload.role === 'COORDINATOR') {
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
      // Evaluator sees only own evaluations
      where.evaluatorId = payload.userId;
      if (panelId) {
        where.panelId = panelId;
      }
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

    const event = await db.event.findUnique({
      where: { id: eventId },
    });

    if (!event || event.status === 'DELETED') {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Check evaluation start time
    if (event.evaluationStart && new Date() < new Date(event.evaluationStart)) {
      return NextResponse.json(
        { success: false, error: 'Evaluation has not started yet. Please wait until the scheduled evaluation time.' },
        { status: 403 }
      );
    }

    let targetPanelId: string | null = null;
    if (teamId) {
      const team = await db.team.findUnique({ where: { id: teamId } });
      if (team) targetPanelId = team.panelId;
    } else if (participantId) {
      const participant = await db.participant.findUnique({ where: { id: participantId } });
      if (participant) targetPanelId = participant.panelId;
    }

    // Evaluator must be assigned to the event OR the specific panel (unless admin)
    if (requireRole('EVALUATOR')(payload) && !requireRole('ADMIN')(payload)) {
      // 1. Check if the evaluator is assigned directly at the event level
      const isEventAssigned = await db.eventEvaluator.findUnique({
        where: { eventId_userId: { eventId, userId: payload.userId } },
      });

      // 2. If not assigned at the event level, check if they are assigned to the target panel
      if (!isEventAssigned) {
        if (targetPanelId) {
          const isPanelAssigned = await db.panelEvaluator.findFirst({
            where: { panelId: targetPanelId, userId: payload.userId },
          });
          if (!isPanelAssigned) {
            return NextResponse.json(
              { success: false, error: 'Forbidden: Not assigned to the evaluation panel for this participant/team' },
              { status: 403 }
            );
          }
        } else {
          return NextResponse.json(
            { success: false, error: 'Forbidden: Not assigned to this event' },
            { status: 403 }
          );
        }
      }
    }

    // Check if an evaluation has already been submitted for this team/participant by this evaluator
    const existingSubmitted = await db.evaluation.findFirst({
      where: {
        eventId,
        evaluatorId: payload.userId,
        status: 'SUBMITTED',
        ...(teamId ? { teamId } : { participantId }),
      },
    });

    if (existingSubmitted) {
      return NextResponse.json(
        { success: false, error: 'This team/participant has already been evaluated and submitted.' },
        { status: 400 }
      );
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
        panelId: targetPanelId,
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
