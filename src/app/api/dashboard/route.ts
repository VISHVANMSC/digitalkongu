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

    if (payload.role === 'ADMIN') {
      // Admin: total programs, events, teams, participants, evaluations completed/pending
      const [
        totalPrograms,
        totalEvents,
        totalTeams,
        totalParticipants,
        totalEvaluations,
        submittedEvaluations,
        draftEvaluations,
        activeEvents,
        completedEvents,
      ] = await Promise.all([
        db.program.count({ where: { status: { not: 'DELETED' } } }),
        db.event.count({ where: { status: { not: 'DELETED' } } }),
        db.team.count({ where: { event: { status: { not: 'DELETED' } } } }),
        db.participant.count({ where: { event: { status: { not: 'DELETED' } } } }),
        db.evaluation.count({ where: { event: { status: { not: 'DELETED' } } } }),
        db.evaluation.count({ where: { status: 'SUBMITTED', event: { status: { not: 'DELETED' } } } }),
        db.evaluation.count({ where: { status: 'DRAFT', event: { status: { not: 'DELETED' } } } }),
        db.event.count({ where: { status: 'ACTIVE' } }),
        db.event.count({ where: { status: 'COMPLETED' } }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          role: 'ADMIN',
          totalPrograms,
          totalEvents,
          activeEvents,
          completedEvents,
          totalTeams,
          totalParticipants,
          totalEvaluations,
          submittedEvaluations,
          draftEvaluations,
        },
      });
    } else if (payload.role === 'COORDINATOR') {
      // Coordinator: stats for assigned events
      const assignments = await db.eventCoordinator.findMany({
        where: { userId: payload.userId },
        select: { eventId: true },
      });
      const assignedEventIds = assignments.map((a) => a.eventId);

      const [
        assignedEvents,
        totalTeams,
        totalParticipants,
        totalEvaluations,
        submittedEvaluations,
        draftEvaluations,
      ] = await Promise.all([
        db.event.count({
          where: { id: { in: assignedEventIds }, status: { not: 'DELETED' } },
        }),
        db.team.count({
          where: { eventId: { in: assignedEventIds }, event: { status: { not: 'DELETED' } } },
        }),
        db.participant.count({
          where: { eventId: { in: assignedEventIds }, event: { status: { not: 'DELETED' } } },
        }),
        db.evaluation.count({
          where: { eventId: { in: assignedEventIds }, event: { status: { not: 'DELETED' } } },
        }),
        db.evaluation.count({
          where: { eventId: { in: assignedEventIds }, status: 'SUBMITTED', event: { status: { not: 'DELETED' } } },
        }),
        db.evaluation.count({
          where: { eventId: { in: assignedEventIds }, status: 'DRAFT', event: { status: { not: 'DELETED' } } },
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          role: 'COORDINATOR',
          assignedEvents,
          totalTeams,
          totalParticipants,
          totalEvaluations,
          submittedEvaluations,
          draftEvaluations,
        },
      });
    } else if (payload.role === 'EVALUATOR') {
      // Evaluator: own evaluation stats
      const [
        totalEvaluations,
        submittedEvaluations,
        draftEvaluations,
        assignedEvents,
      ] = await Promise.all([
        db.evaluation.count({ where: { evaluatorId: payload.userId, event: { status: { not: 'DELETED' } } } }),
        db.evaluation.count({ where: { evaluatorId: payload.userId, status: 'SUBMITTED', event: { status: { not: 'DELETED' } } } }),
        db.evaluation.count({ where: { evaluatorId: payload.userId, status: 'DRAFT', event: { status: { not: 'DELETED' } } } }),
        db.eventEvaluator.count({ where: { userId: payload.userId, event: { status: { not: 'DELETED' } } } }),
      ]);

      // Get event details for assigned events
      const evaluatorAssignments = await db.eventEvaluator.findMany({
        where: { userId: payload.userId },
        include: {
          event: {
            select: {
              id: true,
              name: true,
              status: true,
              _count: {
                select: {
                  teams: true,
                  participants: true,
                },
              },
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          role: 'EVALUATOR',
          assignedEvents,
          totalEvaluations,
          submittedEvaluations,
          draftEvaluations,
          eventDetails: evaluatorAssignments.map((a) => ({
            id: a.event.id,
            name: a.event.name,
            status: a.event.status,
            teams: a.event._count.teams,
            participants: a.event._count.participants,
          })),
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown role' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
