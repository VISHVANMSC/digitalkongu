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

function generateDocReport(title: string, subtitle: string, htmlBody: string): string {
  return `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      margin: 20px;
    }
    h1 {
      color: #0f766e;
      font-size: 24px;
      margin-bottom: 5px;
      text-align: center;
    }
    h2 {
      color: #1e293b;
      font-size: 18px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 5px;
      margin-top: 30px;
    }
    .meta {
      text-align: center;
      color: #64748b;
      font-size: 14px;
      margin-bottom: 30px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 15px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      margin-bottom: 20px;
    }
    th {
      background-color: #f1f5f9;
      color: #334155;
      font-weight: bold;
      border: 1px solid #cbd5e1;
      padding: 10px 12px;
      text-align: left;
      font-size: 13px;
    }
    td {
      border: 1px solid #e2e8f0;
      padding: 10px 12px;
      text-align: left;
      vertical-align: top;
      font-size: 13px;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .text-center {
      text-align: center;
    }
    .font-bold {
      font-weight: bold;
    }
    .text-emerald {
      color: #059669;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 4px;
      background-color: #f1f5f9;
      color: #475569;
    }
    .comments {
      font-style: italic;
      color: #475569;
      font-size: 12px;
      margin-top: 4px;
    }
    .criteria-item {
      font-size: 12px;
      margin-bottom: 3.5px;
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">${subtitle}</div>
  ${htmlBody}
</body>
</html>
  `;
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
    const panelId = searchParams.get('panelId');

    if (!type) {
      return NextResponse.json(
        { success: false, error: 'Report type is required' },
        { status: 400 }
      );
    }

    // Role-based permission checks for coordinators/evaluators
    if (payload.role === 'COORDINATOR' || payload.role === 'EVALUATOR') {
      if (eventId) {
        const isEventCoord = payload.role === 'COORDINATOR'
          ? await db.eventCoordinator.findUnique({ where: { eventId_userId: { eventId, userId: payload.userId } } })
          : await db.eventEvaluator.findUnique({ where: { eventId_userId: { eventId, userId: payload.userId } } });

        const panelAssignments = payload.role === 'COORDINATOR'
          ? await db.panelCoordinator.findMany({ where: { userId: payload.userId, panel: { eventId } }, select: { panelId: true } })
          : await db.panelEvaluator.findMany({ where: { userId: payload.userId, panel: { eventId } }, select: { panelId: true } });

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
        }
      }
    }

    let data: any;
    let csvHeaders: string[] = [];
    let csvRows: string[][] = [];
    let filename = 'report';
    let docTitle = '';
    let docSubtitle = '';
    let docHtmlBody = '';

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

        const isTeam = event.eventType === 'TEAM';
        const eventCriteria = await db.evaluationCriteria.findMany({
          where: { eventId },
          orderBy: { order: 'asc' }
        });

        // Query the data needed
        let teamResults: any[] = [];
        let participantResults: any[] = [];

        if (isTeam) {
          const teams = await db.team.findMany({
            where: { eventId, ...(panelId ? { panelId } : {}) },
            include: {
              members: { select: { name: true } },
              evaluations: {
                where: { status: 'SUBMITTED' },
                include: {
                  scores: true,
                  evaluator: { select: { name: true } }
                }
              }
            }
          });

          teamResults = teams.map((t) => {
            const avgScore = t.evaluations.length > 0
              ? t.evaluations.reduce((sum, ev) => sum + ev.totalScore, 0) / t.evaluations.length
              : 0;
            return {
              ...t,
              averageScore: Math.round(avgScore * 100) / 100
            };
          }).sort((a, b) => b.averageScore - a.averageScore);
        } else {
          const participants = await db.participant.findMany({
            where: { eventId, ...(panelId ? { panelId } : {}) },
            include: {
              evaluations: {
                where: { status: 'SUBMITTED' },
                include: {
                  scores: true,
                  evaluator: { select: { name: true } }
                }
              }
            }
          });

          participantResults = participants.map((p) => {
            const avgScore = p.evaluations.length > 0
              ? p.evaluations.reduce((sum, ev) => sum + ev.totalScore, 0) / p.evaluations.length
              : 0;
            return {
              ...p,
              averageScore: Math.round(avgScore * 100) / 100
            };
          }).sort((a, b) => b.averageScore - a.averageScore);
        }

        // 1. Prepare JSON Data (consolidated results)
        data = {
          eventName: event.name,
          programName: event.program.name,
          eventType: event.eventType,
          evaluationMode: event.evaluationMode,
          results: (isTeam ? teamResults : participantResults).map((r) => {
            const scores = eventCriteria.map((crit) => {
              let sum = 0;
              let count = 0;
              r.evaluations.forEach((ev: any) => {
                const scoreObj = ev.scores.find((sc: any) => sc.criteriaId === crit.id);
                if (scoreObj) {
                  sum += event.evaluationMode === 'STARS' ? scoreObj.starRating : scoreObj.score;
                  count++;
                }
              });
              const avgCritScore = count > 0 ? Math.round((sum / count) * 100) / 100 : 0;
              return {
                criteriaName: crit.name,
                score: event.evaluationMode === 'MARKS' ? avgCritScore : 0,
                starRating: event.evaluationMode === 'STARS' ? Math.round(avgCritScore) : 0,
                maxMarks: crit.maxMarks,
                comments: null,
              };
            });

            const evaluators = r.evaluations.map((ev: any) => ev.evaluator?.name || 'Unknown').filter(Boolean);
            const comments = r.evaluations.map((ev: any) => ev.comments).filter(Boolean).join('; ');

            return {
              entityName: r.name,
              entityCollege: r.college || null,
              evaluatorName: evaluators.length > 0 ? evaluators.join(', ') : 'Consolidated',
              totalScore: r.averageScore,
              status: 'SUBMITTED',
              submittedAt: r.evaluations.length > 0 ? r.evaluations[0].submittedAt : null,
              comments: comments || null,
              scores,
            };
          }),
        };

        // 2. Prepare CSV content
        if (isTeam) {
          csvHeaders = ['S.No', 'Team Name', 'Team members', ...eventCriteria.map(c => c.name), 'Total Or Average'];
          csvRows = [];
          teamResults.forEach((t, index) => {
            const critScores = eventCriteria.map((crit) => {
              let sum = 0;
              let count = 0;
              t.evaluations.forEach((ev: any) => {
                const scoreObj = ev.scores.find((sc: any) => sc.criteriaId === crit.id);
                if (scoreObj) {
                  sum += event.evaluationMode === 'STARS' ? scoreObj.starRating : scoreObj.score;
                  count++;
                }
              });
              return count > 0 ? String(Math.round((sum / count) * 100) / 100) : '-';
            });

            if (t.members.length === 0) {
              csvRows.push([
                String(index + 1),
                t.name,
                'No members',
                ...critScores,
                String(t.averageScore)
              ]);
            } else {
              t.members.forEach((m: any, mIdx: number) => {
                csvRows.push([
                  mIdx === 0 ? String(index + 1) : '',
                  mIdx === 0 ? t.name : '',
                  m.name,
                  ...(mIdx === 0 ? critScores : eventCriteria.map(() => '')),
                  mIdx === 0 ? String(t.averageScore) : ''
                ]);
              });
            }
          });
        } else {
          csvHeaders = ['S.No', 'Participant Name', 'Department', 'College', ...eventCriteria.map(c => c.name), 'Total Or Average'];
          csvRows = participantResults.map((p, index) => {
            const critScores = eventCriteria.map((crit) => {
              let sum = 0;
              let count = 0;
              p.evaluations.forEach((ev: any) => {
                const scoreObj = ev.scores.find((sc: any) => sc.criteriaId === crit.id);
                if (scoreObj) {
                  sum += event.evaluationMode === 'STARS' ? scoreObj.starRating : scoreObj.score;
                  count++;
                }
              });
              return count > 0 ? String(Math.round((sum / count) * 100) / 100) : '-';
            });
            return [
              String(index + 1),
              p.name,
              p.department || '',
              p.college || '',
              ...critScores,
              String(p.averageScore)
            ];
          });
        }

        // 3. Prepare DOC Content
        let eventResultsRows = '';
        if (isTeam) {
          teamResults.forEach((t, index) => {
            const membersHtml = t.members.length > 0
              ? `<table style="width:100%; border:none; margin:0; padding:0;">
                  ${t.members.map((m: any, idx: number) => `
                    <tr>
                      <td style="border:none; ${idx < t.members.length - 1 ? 'border-bottom:1px solid #e2e8f0;' : ''} padding:4px 6px;">${m.name}</td>
                    </tr>
                  `).join('')}
                 </table>`
              : 'No members';

            let criteriaCellsHtml = '';
            eventCriteria.forEach((crit) => {
              let sum = 0;
              let count = 0;
              t.evaluations.forEach((ev: any) => {
                const scoreObj = ev.scores.find((sc: any) => sc.criteriaId === crit.id);
                if (scoreObj) {
                  sum += event.evaluationMode === 'STARS' ? scoreObj.starRating : scoreObj.score;
                  count++;
                }
              });
              const avgCritScore = count > 0 ? Math.round((sum / count) * 100) / 100 : '-';
              criteriaCellsHtml += `<td class="text-center font-semibold">${avgCritScore}</td>`;
            });

            eventResultsRows += `
              <tr>
                <td class="text-center font-bold">${index + 1}.</td>
                <td><strong>${t.name}</strong></td>
                <td style="padding:0;">${membersHtml}</td>
                ${criteriaCellsHtml}
                <td class="text-center font-bold text-emerald">${t.averageScore}</td>
              </tr>
            `;
          });
        } else {
          participantResults.forEach((p, index) => {
            let criteriaCellsHtml = '';
            eventCriteria.forEach((crit) => {
              let sum = 0;
              let count = 0;
              p.evaluations.forEach((ev: any) => {
                const scoreObj = ev.scores.find((sc: any) => sc.criteriaId === crit.id);
                if (scoreObj) {
                  sum += event.evaluationMode === 'STARS' ? scoreObj.starRating : scoreObj.score;
                  count++;
                }
              });
              const avgCritScore = count > 0 ? Math.round((sum / count) * 100) / 100 : '-';
              criteriaCellsHtml += `<td class="text-center font-semibold">${avgCritScore}</td>`;
            });

            eventResultsRows += `
              <tr>
                <td class="text-center font-bold">${index + 1}.</td>
                <td><strong>${p.name}</strong></td>
                <td>${p.department || 'N/A'}</td>
                <td>${p.college || 'N/A'}</td>
                ${criteriaCellsHtml}
                <td class="text-center font-bold text-emerald">${p.averageScore}</td>
              </tr>
            `;
          });
        }

        const criteriaHeadersHtml = eventCriteria.map((crit) => `<th class="text-center">${crit.name}</th>`).join('');

        docTitle = 'Detailed Evaluation Report';
        docSubtitle = `<strong>Program:</strong> ${event.program.name} &nbsp;|&nbsp; <strong>Event:</strong> ${event.name} &nbsp;|&nbsp; <strong>Type:</strong> ${event.eventType} &nbsp;|&nbsp; <strong>Mode:</strong> ${event.evaluationMode}`;
        docHtmlBody = `
          <table>
            <thead>
              <tr>
                <th class="text-center" style="width: 50px;">S.No</th>
                <th>${isTeam ? 'Team Name' : 'Participant Name'}</th>
                ${isTeam ? '<th>Team members</th>' : '<th>Department</th><th>College</th>'}
                ${criteriaHeadersHtml}
                <th class="text-center">Total Or Average</th>
              </tr>
            </thead>
            <tbody>
              ${eventResultsRows || `<tr><td colspan="${(isTeam ? 4 : 5) + eventCriteria.length}" class="text-center">No evaluations submitted yet.</td></tr>`}
            </tbody>
          </table>
        `;

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

        const teamWhere: any = { eventId };
        if (panelId) {
          teamWhere.panelId = panelId;
        }

        const evalWhere: any = { status: 'SUBMITTED' };
        if (panelId) {
          evalWhere.panelId = panelId;
        }

        const teams = await db.team.findMany({
          where: teamWhere,
          include: {
            evaluations: {
              where: evalWhere,
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

        const event = await db.event.findUnique({
          where: { id: eventId },
          include: { program: { select: { name: true } } },
        });

        const eventName = event?.name || '';
        const programName = event?.program.name || '';

        // Generate Doc Content
        let teamRankingsRows = '';
        for (const r of ranked) {
          const membersStr = r.members.map((m: any) => m.name).join(', ') || 'No members';
          teamRankingsRows += `
            <tr>
              <td class="text-center font-bold">#${r.rank}</td>
              <td><strong>${r.teamName}</strong></td>
              <td>${r.college || 'N/A'}</td>
              <td class="text-center">${r.memberCount}</td>
              <td class="text-center">${r.evaluationCount}</td>
              <td class="text-center font-bold text-emerald">${r.averageScore}</td>
              <td><span style="font-size: 12px; color: #475569;">${membersStr}</span></td>
            </tr>
          `;
        }

        docTitle = 'Team Rankings Report';
        docSubtitle = `<strong>Program:</strong> ${programName} &nbsp;|&nbsp; <strong>Event:</strong> ${eventName} &nbsp;|&nbsp; <strong>Type:</strong> TEAM`;
        docHtmlBody = `
          <table>
            <thead>
              <tr>
                <th class="text-center" style="width: 60px;">Rank</th>
                <th>Team Name</th>
                <th>College</th>
                <th class="text-center">Members</th>
                <th class="text-center">Evaluations</th>
                <th class="text-center">Average Score</th>
                <th>Team Members</th>
              </tr>
            </thead>
            <tbody>
              ${teamRankingsRows || '<tr><td colspan="7" class="text-center">No team rankings available yet.</td></tr>'}
            </tbody>
          </table>
        `;

        filename = `team-rankings-${eventName}`;
        break;
      }

      case 'individual-rankings': {
        if (!eventId) {
          return NextResponse.json(
            { success: false, error: 'Event ID is required for individual-rankings report' },
            { status: 400 }
          );
        }

        const participantWhere: any = { eventId };
        if (panelId) {
          participantWhere.panelId = panelId;
        }

        const evalWhere: any = { status: 'SUBMITTED' };
        if (panelId) {
          evalWhere.panelId = panelId;
        }

        const participants = await db.participant.findMany({
          where: participantWhere,
          include: {
            evaluations: {
              where: evalWhere,
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

        const event = await db.event.findUnique({
          where: { id: eventId },
          include: { program: { select: { name: true } } },
        });

        const eventName = event?.name || '';
        const programName = event?.program.name || '';

        // Generate Doc Content
        let indRankingsRows = '';
        for (const r of ranked) {
          indRankingsRows += `
            <tr>
              <td class="text-center font-bold">#${r.rank}</td>
              <td><strong>${r.participantName}</strong></td>
              <td>${r.department || 'N/A'}</td>
              <td>${r.college || 'N/A'}</td>
              <td class="text-center">${r.evaluationCount}</td>
              <td class="text-center font-bold text-emerald">${r.averageScore}</td>
            </tr>
          `;
        }

        docTitle = 'Individual Rankings Report';
        docSubtitle = `<strong>Program:</strong> ${programName} &nbsp;|&nbsp; <strong>Event:</strong> ${eventName} &nbsp;|&nbsp; <strong>Type:</strong> INDIVIDUAL`;
        docHtmlBody = `
          <table>
            <thead>
              <tr>
                <th class="text-center" style="width: 60px;">Rank</th>
                <th>Participant Name</th>
                <th>Department</th>
                <th>College</th>
                <th class="text-center">Evaluations</th>
                <th class="text-center">Average Score</th>
              </tr>
            </thead>
            <tbody>
              ${indRankingsRows || '<tr><td colspan="6" class="text-center">No individual rankings available yet.</td></tr>'}
            </tbody>
          </table>
        `;

        filename = `individual-rankings-${eventName}`;
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
              db.evaluation.count({ where: { eventId, evaluatorId: ea.userId, ...(panelId ? { panelId } : {}) } }),
              db.evaluation.count({ where: { eventId, evaluatorId: ea.userId, status: 'SUBMITTED', ...(panelId ? { panelId } : {}) } }),
              db.evaluation.count({ where: { eventId, evaluatorId: ea.userId, status: 'DRAFT', ...(panelId ? { panelId } : {}) } }),
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

        const event = await db.event.findUnique({
          where: { id: eventId },
          include: { program: { select: { name: true } } },
        });

        const eventName = event?.name || '';
        const programName = event?.program.name || '';

        // Generate Doc Content
        let evaluatorRows = '';
        for (const e of evaluatorStats) {
          evaluatorRows += `
            <tr>
              <td><strong>${e.evaluatorName}</strong></td>
              <td>${e.evaluatorEmail}</td>
              <td class="text-center">${e.totalEvaluations}</td>
              <td class="text-center">${e.submittedEvaluations}</td>
              <td class="text-center">${e.draftEvaluations}</td>
              <td class="text-center font-bold">${e.completionRate}%</td>
            </tr>
          `;
        }

        docTitle = 'Evaluator Completion Report';
        docSubtitle = `<strong>Program:</strong> ${programName} &nbsp;|&nbsp; <strong>Event:</strong> ${eventName}`;
        docHtmlBody = `
          <table>
            <thead>
              <tr>
                <th>Evaluator Name</th>
                <th>Email</th>
                <th class="text-center">Total Evaluations</th>
                <th class="text-center">Submitted</th>
                <th class="text-center">Drafts</th>
                <th class="text-center">Completion Rate</th>
              </tr>
            </thead>
            <tbody>
              ${evaluatorRows || '<tr><td colspan="6" class="text-center">No evaluator data available.</td></tr>'}
            </tbody>
          </table>
        `;

        filename = `evaluator-report-${eventName}`;
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

        // Generate Doc Content
        let eventsHtml = '';
        for (const e of data.events) {
          eventsHtml += `
            <tr>
              <td><strong>${e.eventName}</strong></td>
              <td class="text-center">${e.eventType}</td>
              <td class="text-center"><span class="badge">${e.status}</span></td>
              <td class="text-center">${e.teams}</td>
              <td class="text-center">${e.participants}</td>
              <td class="text-center">${e.evaluations}</td>
              <td class="text-center">${e.coordinators}</td>
              <td class="text-center">${e.evaluators}</td>
            </tr>
          `;
        }

        docTitle = 'Program Summary Report';
        docSubtitle = `<strong>Program:</strong> ${data.programName} &nbsp;|&nbsp; <strong>Status:</strong> ${data.programStatus} &nbsp;|&nbsp; <strong>Venue:</strong> ${data.venue || 'N/A'}`;
        docHtmlBody = `
          <h2>Events Summary</h2>
          <table>
            <thead>
              <tr>
                <th>Event Name</th>
                <th class="text-center">Type</th>
                <th class="text-center">Status</th>
                <th class="text-center">Teams</th>
                <th class="text-center">Participants</th>
                <th class="text-center">Evaluations Done</th>
                <th class="text-center">Coordinators</th>
                <th class="text-center">Evaluators</th>
              </tr>
            </thead>
            <tbody>
              ${eventsHtml || '<tr><td colspan="8" class="text-center">No events found in this program.</td></tr>'}
            </tbody>
          </table>
        `;

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

    if (format === 'doc') {
      const docContent = generateDocReport(docTitle, docSubtitle, docHtmlBody);
      return new NextResponse(docContent, {
        status: 200,
        headers: {
          'Content-Type': 'application/msword; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.doc"`,
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
