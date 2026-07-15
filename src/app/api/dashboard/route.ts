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

      // Admin panel monitor for real-time progress of all panels
      const allPanels = await db.panel.findMany({
        include: {
          event: { select: { id: true, name: true, eventType: true } },
          coordinators: { include: { user: { select: { id: true, name: true } } } },
          evaluators: { include: { user: { select: { id: true, name: true } } } },
          teams: { select: { id: true } },
          participants: { where: { teamId: null }, select: { id: true } },
          evaluations: { where: { status: 'SUBMITTED' }, select: { totalScore: true } },
        },
      });

      const panelMonitor = allPanels.map((p) => {
        const totalEntities = p.event.eventType === 'TEAM' ? p.teams.length : p.participants.length;
        const totalSubmitted = p.evaluations.length;
        const sumScore = p.evaluations.reduce((sum, ev) => sum + ev.totalScore, 0);
        const averageScore = totalSubmitted > 0 ? Math.round((sumScore / totalSubmitted) * 100) / 100 : 0;

        return {
          id: p.id,
          name: p.name,
          eventId: p.event.id,
          eventName: p.event.name,
          coordinators: p.coordinators.map((c) => c.user.name),
          evaluators: p.evaluators.map((e) => e.user.name),
          totalEntities,
          completedEvaluations: totalSubmitted,
          averageScore,
        };
      });

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
          panelMonitor,
        },
      });
    } else if (payload.role === 'COORDINATOR') {
      const panelAssignments = await db.panelCoordinator.findMany({
        where: { userId: payload.userId },
        select: { panelId: true, panel: { select: { eventId: true } } },
      });

      const eventAssignments = await db.eventCoordinator.findMany({
        where: { userId: payload.userId },
        select: { eventId: true },
      });

      const hasPanels = panelAssignments.length > 0;
      const assignedPanelIds = panelAssignments.map((pa) => pa.panelId);
      const assignedEventIds = Array.from(new Set([
        ...eventAssignments.map((a) => a.eventId),
        ...panelAssignments.map((pa) => pa.panel.eventId),
      ]));

      let assignedEvents = 0;
      let totalTeams = 0;
      let totalParticipants = 0;
      let totalEvaluations = 0;
      let submittedEvaluations = 0;
      let draftEvaluations = 0;

      if (hasPanels) {
        assignedEvents = Array.from(new Set(panelAssignments.map((pa) => pa.panel.eventId))).length;
        [
          totalTeams,
          totalParticipants,
          totalEvaluations,
          submittedEvaluations,
          draftEvaluations,
        ] = await Promise.all([
          db.team.count({ where: { panelId: { in: assignedPanelIds } } }),
          db.participant.count({ where: { panelId: { in: assignedPanelIds } } }),
          db.evaluation.count({ where: { panelId: { in: assignedPanelIds } } }),
          db.evaluation.count({ where: { panelId: { in: assignedPanelIds }, status: 'SUBMITTED' } }),
          db.evaluation.count({ where: { panelId: { in: assignedPanelIds }, status: 'DRAFT' } }),
        ]);
      } else {
        [
          assignedEvents,
          totalTeams,
          totalParticipants,
          totalEvaluations,
          submittedEvaluations,
          draftEvaluations,
        ] = await Promise.all([
          db.event.count({ where: { id: { in: assignedEventIds }, status: { not: 'DELETED' } } }),
          db.team.count({ where: { eventId: { in: assignedEventIds }, event: { status: { not: 'DELETED' } } } }),
          db.participant.count({ where: { eventId: { in: assignedEventIds }, event: { status: { not: 'DELETED' } } } }),
          db.evaluation.count({ where: { eventId: { in: assignedEventIds }, event: { status: { not: 'DELETED' } } } }),
          db.evaluation.count({ where: { eventId: { in: assignedEventIds }, status: 'SUBMITTED', event: { status: { not: 'DELETED' } } } }),
          db.evaluation.count({ where: { eventId: { in: assignedEventIds }, status: 'DRAFT', event: { status: { not: 'DELETED' } } } }),
        ]);
      }

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
      const panelAssignments = await db.panelEvaluator.findMany({
        where: { userId: payload.userId },
        select: { panelId: true, panel: { select: { id: true, name: true, eventId: true } } },
      });

      const eventAssignments = await db.eventEvaluator.findMany({
        where: { userId: payload.userId },
        select: { eventId: true },
      });

      const hasPanels = panelAssignments.length > 0;
      const assignedPanelIds = panelAssignments.map((pa) => pa.panelId);
      const assignedEventIds = Array.from(new Set([
        ...eventAssignments.map((a) => a.eventId),
        ...panelAssignments.map((pa) => pa.panel.eventId),
      ]));

      let assignedEvents = 0;
      let totalEvaluations = 0;
      let submittedEvaluations = 0;
      let draftEvaluations = 0;

      if (hasPanels) {
        assignedEvents = Array.from(new Set(panelAssignments.map((pa) => pa.panel.eventId))).length;
        [
          totalEvaluations,
          submittedEvaluations,
          draftEvaluations,
        ] = await Promise.all([
          db.evaluation.count({ where: { evaluatorId: payload.userId, panelId: { in: assignedPanelIds } } }),
          db.evaluation.count({ where: { evaluatorId: payload.userId, panelId: { in: assignedPanelIds }, status: 'SUBMITTED' } }),
          db.evaluation.count({ where: { evaluatorId: payload.userId, panelId: { in: assignedPanelIds }, status: 'DRAFT' } }),
        ]);
      } else {
        [
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
      }

      // Get event details for assigned events
      let evaluatorAssignments: any[] = [];
      if (hasPanels) {
        evaluatorAssignments = await db.panelEvaluator.findMany({
          where: { userId: payload.userId },
          include: {
            panel: {
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
            },
          },
        });
      } else {
        evaluatorAssignments = await db.eventEvaluator.findMany({
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
      }

      const eventDetails = hasPanels
        ? evaluatorAssignments.map((a: any) => ({
            id: a.panel.event.id,
            name: `${a.panel.event.name} (${a.panel.name})`,
            status: a.panel.event.status,
            teams: a.panel.event._count.teams,
            participants: a.panel.event._count.participants,
          }))
        : (evaluatorAssignments as any[]).map((a: any) => ({
            id: a.event.id,
            name: a.event.name,
            status: a.event.status,
            teams: a.event._count.teams,
            participants: a.event._count.participants,
          }));

      return NextResponse.json({
        success: true,
        data: {
          role: 'EVALUATOR',
          assignedEvents,
          totalEvaluations,
          submittedEvaluations,
          draftEvaluations,
          eventDetails,
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
