import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db } from '@/lib/db';

function escapeCSV(value: any): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function arrayToCSV(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCSV).join(',');
  const dataLines = rows.map((row) => row.map(escapeCSV).join(','));
  return [headerLine, ...dataLines].join('\n');
}

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
    const type = searchParams.get('type');
    const format = searchParams.get('format') || 'json';
    const eventId = searchParams.get('eventId');
    const programId = searchParams.get('programId');

    if (!type) {
      return NextResponse.json(
        { success: false, error: 'Report type is required' },
        { status: 400 }
      );
    }

    let data: any;
    let csvHeaders: string[] = [];
    let csvRows: string[][] = [];
    let filename = 'report';

    switch (type) {
      case 'event-results': {
        if (!eventId) {
          return NextResponse.json(
            { success: false, error: 'Event ID is required for event-results report' },
            { status: 400 }
          );
        }

        const event = await db.event.findUnique({
          where: { id: eventId },
          include: { program: { select: { name: true } } },
        });

        if (!event || event.status === 'DELETED') {
          return NextResponse.json(
            { success: false, error: 'Event not found' },
            { status: 404 }
          );
        }

        const evaluations = await db.evaluation.findMany({
          where: { eventId, status: 'SUBMITTED' },
          include: {
            team: { select: { name: true, college: true } },
            participant: { select: { name: true, college: true } },
            evaluator: { select: { name: true } },
            scores: {
              include: {
                criteria: { select: { name: true, maxMarks: true, maxStars: true } },
              },
            },
          },
          orderBy: { totalScore: 'desc' },
        });

        data = {
          eventName: event.name,
          programName: event.program.name,
          eventType: event.eventType,
          evaluationMode: event.evaluationMode,
          results: evaluations.map((e) => ({
            entityName: e.team?.name || e.participant?.name,
            entityCollege: e.team?.college || e.participant?.college,
            evaluatorName: e.evaluator.name,
            totalScore: e.totalScore,
            status: e.status,
            submittedAt: e.submittedAt,
            scores: e.scores.map((s) => ({
              criteriaName: s.criteria.name,
              score: s.score,
              starRating: s.starRating,
              maxMarks: s.criteria.maxMarks,
            })),
          })),
        };

        csvHeaders = ['Name', 'College', 'Evaluator', 'Total Score', 'Status', 'Submitted At'];
        csvRows = evaluations.map((e) => [
          e.team?.name || e.participant?.name || '',
          e.team?.college || e.participant?.college || '',
          e.evaluator.name,
          String(e.totalScore),
          e.status,
          e.submittedAt ? new Date(e.submittedAt).toISOString() : '',
        ]);

        filename = `event-results-${event.name}`;
        break;
      }

      case 'team-rankings': {
        if (!eventId) {
          return NextResponse.json(
            { success: false, error: 'Event ID is required for team-rankings report' },
            { status: 400 }
          );
        }

        const teams = await db.team.findMany({
          where: { eventId },
          include: {
            evaluations: {
              where: { status: 'SUBMITTED' },
            },
            members: {
              select: { name: true, department: true },
            },
          },
        });

        const ranked = teams
          .map((team) => {
            const avgScore = team.evaluations.length > 0
              ? team.evaluations.reduce((sum, e) => sum + e.totalScore, 0) / team.evaluations.length
              : 0;
            return {
              teamName: team.name,
              college: team.college,
              memberCount: team.members.length,
              evaluationCount: team.evaluations.length,
              averageScore: Math.round(avgScore * 100) / 100,
              members: team.members,
            };
          })
          .sort((a, b) => b.averageScore - a.averageScore)
          .map((entry, index) => ({ ...entry, rank: index + 1 }));

        data = { rankings: ranked };

        csvHeaders = ['Rank', 'Team Name', 'College', 'Members', 'Evaluations', 'Average Score'];
        csvRows = ranked.map((r) => [
          String(r.rank),
          r.teamName,
          r.college || '',
          String(r.memberCount),
          String(r.evaluationCount),
          String(r.averageScore),
        ]);

        filename = 'team-rankings';
        break;
      }

      case 'individual-rankings': {
        if (!eventId) {
          return NextResponse.json(
            { success: false, error: 'Event ID is required for individual-rankings report' },
            { status: 400 }
          );
        }

        const participants = await db.participant.findMany({
          where: { eventId },
          include: {
            evaluations: {
              where: { status: 'SUBMITTED' },
            },
          },
        });

        const ranked = participants
          .map((p) => {
            const avgScore = p.evaluations.length > 0
              ? p.evaluations.reduce((sum, e) => sum + e.totalScore, 0) / p.evaluations.length
              : 0;
            return {
              participantName: p.name,
              department: p.department,
              college: p.college,
              evaluationCount: p.evaluations.length,
              averageScore: Math.round(avgScore * 100) / 100,
            };
          })
          .sort((a, b) => b.averageScore - a.averageScore)
          .map((entry, index) => ({ ...entry, rank: index + 1 }));

        data = { rankings: ranked };

        csvHeaders = ['Rank', 'Name', 'Department', 'College', 'Evaluations', 'Average Score'];
        csvRows = ranked.map((r) => [
          String(r.rank),
          r.participantName,
          r.department || '',
          r.college || '',
          String(r.evaluationCount),
          String(r.averageScore),
        ]);

        filename = 'individual-rankings';
        break;
      }

      case 'evaluator-report': {
        if (!eventId) {
          return NextResponse.json(
            { success: false, error: 'Event ID is required for evaluator-report' },
            { status: 400 }
          );
        }

        const evaluators = await db.eventEvaluator.findMany({
          where: { eventId },
          include: {
            user: { select: { name: true, email: true } },
          },
        });

        const evaluatorStats = await Promise.all(
          evaluators.map(async (ea) => {
            const [total, submitted, draft] = await Promise.all([
              db.evaluation.count({ where: { eventId, evaluatorId: ea.userId } }),
              db.evaluation.count({ where: { eventId, evaluatorId: ea.userId, status: 'SUBMITTED' } }),
              db.evaluation.count({ where: { eventId, evaluatorId: ea.userId, status: 'DRAFT' } }),
            ]);
            return {
              evaluatorName: ea.user.name,
              evaluatorEmail: ea.user.email,
              totalEvaluations: total,
              submittedEvaluations: submitted,
              draftEvaluations: draft,
              completionRate: total > 0 ? Math.round((submitted / total) * 100) : 0,
            };
          })
        );

        data = { evaluators: evaluatorStats };

        csvHeaders = ['Evaluator Name', 'Email', 'Total', 'Submitted', 'Draft', 'Completion Rate (%)'];
        csvRows = evaluatorStats.map((e) => [
          e.evaluatorName,
          e.evaluatorEmail,
          String(e.totalEvaluations),
          String(e.submittedEvaluations),
          String(e.draftEvaluations),
          String(e.completionRate),
        ]);

        filename = 'evaluator-report';
        break;
      }

      case 'program-summary': {
        if (!programId) {
          return NextResponse.json(
            { success: false, error: 'Program ID is required for program-summary report' },
            { status: 400 }
          );
        }

        const program = await db.program.findUnique({
          where: { id: programId },
          include: {
            events: {
              where: { status: { not: 'DELETED' } },
              include: {
                _count: {
                  select: {
                    teams: true,
                    participants: true,
                    evaluations: true,
                    coordinators: true,
                    evaluators: true,
                  },
                },
              },
            },
          },
        });

        if (!program || program.status === 'DELETED') {
          return NextResponse.json(
            { success: false, error: 'Program not found' },
            { status: 404 }
          );
        }

        data = {
          programName: program.name,
          programStatus: program.status,
          venue: program.venue,
          startDate: program.startDate,
          endDate: program.endDate,
          totalEvents: program.events.length,
          events: program.events.map((e) => ({
            eventName: e.name,
            eventType: e.eventType,
            status: e.status,
            teams: e._count.teams,
            participants: e._count.participants,
            evaluations: e._count.evaluations,
            coordinators: e._count.coordinators,
            evaluators: e._count.evaluators,
          })),
        };

        csvHeaders = ['Event Name', 'Type', 'Status', 'Teams', 'Participants', 'Evaluations', 'Coordinators', 'Evaluators'];
        csvRows = program.events.map((e) => [
          e.name,
          e.eventType,
          e.status,
          String(e._count.teams),
          String(e._count.participants),
          String(e._count.evaluations),
          String(e._count.coordinators),
          String(e._count.evaluators),
        ]);

        filename = `program-summary-${program.name}`;
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown report type: ${type}. Supported types: event-results, team-rankings, individual-rankings, evaluator-report, program-summary` },
          { status: 400 }
        );
    }

    if (format === 'csv') {
      const csvContent = arrayToCSV(csvHeaders, csvRows);
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Reports error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
