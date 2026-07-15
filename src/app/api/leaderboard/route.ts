import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
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

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Check access
    const event = await db.event.findUnique({
      where: { id: eventId },
    });

    if (!event || event.status === 'DELETED') {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    const where: any = { eventId, status: 'SUBMITTED' };

    // Role-based access and panel isolation checks
    if (payload.role === 'COORDINATOR') {
      const isEventCoord = await db.eventCoordinator.findUnique({
        where: { eventId_userId: { eventId, userId: payload.userId } },
      });
      const panelAssignments = await db.panelCoordinator.findMany({
        where: { userId: payload.userId, panel: { eventId } },
        select: { panelId: true },
      });
      const assignedPanelIds = panelAssignments.map((pa) => pa.panelId);

      if (!isEventCoord && panelAssignments.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Not assigned to this event or its panels' },
          { status: 403 }
        );
      }

      if (panelId) {
        if (!isEventCoord && !assignedPanelIds.includes(panelId)) {
          return NextResponse.json(
            { success: false, error: 'Forbidden: Not assigned to this panel' },
            { status: 403 }
          );
        }
        where.panelId = panelId;
      } else if (!isEventCoord) {
        where.panelId = { in: assignedPanelIds };
      }
    } else if (payload.role === 'EVALUATOR') {
      const isEventEval = await db.eventEvaluator.findUnique({
        where: { eventId_userId: { eventId, userId: payload.userId } },
      });
      const panelAssignments = await db.panelEvaluator.findMany({
        where: { userId: payload.userId, panel: { eventId } },
        select: { panelId: true },
      });
      const assignedPanelIds = panelAssignments.map((pa) => pa.panelId);

      if (!isEventEval && panelAssignments.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Not assigned to this event or its panels' },
          { status: 403 }
        );
      }

      if (panelId) {
        if (!isEventEval && !assignedPanelIds.includes(panelId)) {
          return NextResponse.json(
            { success: false, error: 'Forbidden: Not assigned to this panel' },
            { status: 403 }
          );
        }
        where.panelId = panelId;
      } else if (!isEventEval) {
        where.panelId = { in: assignedPanelIds };
      }
    } else if (payload.role === 'ADMIN' && panelId) {
      where.panelId = panelId;
    }

    // Get all submitted evaluations for the event (filtered by panel where appropriate)
    const evaluations = await db.evaluation.findMany({
      where,
      include: {
        team: { select: { id: true, name: true, college: true } },
        participant: { select: { id: true, name: true, college: true } },
        scores: {
          include: {
            criteria: { select: { id: true, name: true, weightage: true, maxMarks: true, maxStars: true } },
          },
        },
      },
    });

    // Calculate average scores per team/participant
    const scoreMap = new Map<string, {
      id: string;
      name: string;
      college: string | null;
      type: 'team' | 'participant';
      totalScore: number;
      evaluationCount: number;
      scores: number[];
    }>();

    for (const evaluation of evaluations) {
      const entityId = evaluation.teamId || evaluation.participantId;
      const entityName = evaluation.team?.name || evaluation.participant?.name || 'Unknown';
      const entityCollege = evaluation.team?.college || evaluation.participant?.college || null;
      const entityType = evaluation.teamId ? 'team' as const : 'participant' as const;

      // Use total score directly from the evaluation
      const evalScore = evaluation.totalScore;

      if (!entityId) continue;

      if (!scoreMap.has(entityId)) {
        scoreMap.set(entityId, {
          id: entityId,
          name: entityName,
          college: entityCollege,
          type: entityType,
          totalScore: 0,
          evaluationCount: 0,
          scores: [],
        });
      }

      const entry = scoreMap.get(entityId)!;
      entry.totalScore += evalScore;
      entry.evaluationCount += 1;
      entry.scores.push(evalScore);
    }

    // Calculate averages and rank
    const leaderboard = Array.from(scoreMap.values()).map((entry) => ({
      id: entry.id,
      name: entry.name,
      college: entry.college,
      type: entry.type,
      totalScore: Math.round(entry.totalScore * 100) / 100,
      averageScore: Math.round((entry.totalScore / entry.evaluationCount) * 100) / 100,
      evaluationCount: entry.evaluationCount,
    }));

    // Sort by average score descending
    leaderboard.sort((a, b) => b.averageScore - a.averageScore);

    // Add rank
    const rankedLeaderboard = leaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

    return NextResponse.json({
      success: true,
      data: {
        eventId,
        eventName: event.name,
        eventType: event.eventType,
        evaluationMode: event.evaluationMode,
        leaderboard: rankedLeaderboard,
      },
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
