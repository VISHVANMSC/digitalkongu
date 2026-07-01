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

    if (payload.role === 'COORDINATOR') {
      const isAssigned = await db.eventCoordinator.findUnique({
        where: { eventId_userId: { eventId, userId: payload.userId } },
      });
      if (!isAssigned) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Not assigned to this event' },
          { status: 403 }
        );
      }
    } else if (payload.role === 'EVALUATOR') {
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

    // Get all submitted evaluations for the event
    const evaluations = await db.evaluation.findMany({
      where: { eventId, status: 'SUBMITTED' },
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

      // Calculate weighted score for this evaluation
      let evalScore = 0;
      for (const score of evaluation.scores) {
        const weightage = score.criteria.weightage || 1;
        evalScore += score.score * weightage;
      }

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
