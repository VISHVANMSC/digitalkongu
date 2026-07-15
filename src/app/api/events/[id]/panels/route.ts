import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireRole } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await authenticateRequest(request);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: eventId } = await params;

    // Verify event exists
    const event = await db.event.findUnique({ where: { id: eventId } });
    if (!event || event.status === 'DELETED') {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
    }

    // Check if any panel exists for this event. If not, auto-create "Panel 1"
    const panelCount = await db.panel.count({ where: { eventId } });
    if (panelCount === 0) {
      const defaultPanel = await db.panel.create({
        data: {
          eventId,
          name: 'Panel 1',
        },
      });

      // Auto-assign any event coordinators to Panel 1 so they can view/manage it
      const eventCoordinators = await db.eventCoordinator.findMany({
        where: { eventId },
      });
      if (eventCoordinators.length > 0) {
        await db.panelCoordinator.createMany({
          data: eventCoordinators.map((ec) => ({
            panelId: defaultPanel.id,
            userId: ec.userId,
          })),
          skipDuplicates: true,
        });
      }

      // Auto-assign any event evaluators to Panel 1 so they can evaluate it
      const eventEvaluators = await db.eventEvaluator.findMany({
        where: { eventId },
      });
      if (eventEvaluators.length > 0) {
        await db.panelEvaluator.createMany({
          data: eventEvaluators.map((ee) => ({
            panelId: defaultPanel.id,
            userId: ee.userId,
          })),
          skipDuplicates: true,
        });
      }
    }

    const where: any = { eventId };

    // Coordinators and Evaluators only see panels they are assigned to
    if (payload.role === 'COORDINATOR') {
      const assignments = await db.panelCoordinator.findMany({
        where: { userId: payload.userId, panel: { eventId } },
        select: { panelId: true },
      });
      where.id = { in: assignments.map((a) => a.panelId) };
    } else if (payload.role === 'EVALUATOR') {
      const assignments = await db.panelEvaluator.findMany({
        where: { userId: payload.userId, panel: { eventId } },
        select: { panelId: true },
      });
      where.id = { in: assignments.map((a) => a.panelId) };
    }

    const panels = await db.panel.findMany({
      where,
      include: {
        coordinators: { include: { user: { select: { id: true, name: true, email: true } } } },
        evaluators: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: {
          select: {
            teams: true,
            participants: true,
            evaluations: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, data: panels });
  } catch (error) {
    console.error('List panels error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await authenticateRequest(request);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id: eventId } = await params;

    // Verify event exists
    const event = await db.event.findUnique({ where: { id: eventId } });
    if (!event || event.status === 'DELETED') {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
    }

    const body = await request.json();
    const { action, name, coordinatorIds = [], evaluatorIds = [], panelCount, namePrefix = 'Panel' } = body;

    // Handle Auto-generation of panels
    if (action === 'auto') {
      if (payload.role !== 'ADMIN') {
        return NextResponse.json({ success: false, error: 'Forbidden: Only Admins can auto-generate panels' }, { status: 403 });
      }

      if (!panelCount || panelCount < 1) {
        return NextResponse.json({ success: false, error: 'Valid panel count is required' }, { status: 400 });
      }

      // Create panels
      const createdPanels: any[] = [];
      for (let i = 0; i < panelCount; i++) {
        const char = String.fromCharCode(65 + i); // Panel A, Panel B...
        const panelName = panelCount <= 26 ? `${namePrefix} ${char}` : `${namePrefix} ${i + 1}`;
        const panel = await db.panel.create({
          data: {
            eventId,
            name: panelName,
          },
        });
        createdPanels.push(panel);
      }

      // Distribute teams or participants round-robin
      if (event.eventType === 'TEAM') {
        const teams = await db.team.findMany({
          where: { eventId },
          orderBy: { createdAt: 'asc' },
        });

        for (let i = 0; i < teams.length; i++) {
          const panelIndex = i % panelCount;
          const panel = createdPanels[panelIndex];
          await db.team.update({
            where: { id: teams[i].id },
            data: { panelId: panel.id },
          });
          // Also update team members panelId
          await db.participant.updateMany({
            where: { teamId: teams[i].id },
            data: { panelId: panel.id },
          });
        }
      } else {
        const participants = await db.participant.findMany({
          where: { eventId, teamId: null }, // Individual participants only
          orderBy: { createdAt: 'asc' },
        });

        for (let i = 0; i < participants.length; i++) {
          const panelIndex = i % panelCount;
          const panel = createdPanels[panelIndex];
          await db.participant.update({
            where: { id: participants[i].id },
            data: { panelId: panel.id },
          });
        }
      }

      await db.auditLog.create({
        data: {
          userId: payload.userId,
          action: 'CREATE',
          entity: 'Panel',
          details: `Auto-generated ${panelCount} panels and distributed entities for event ${eventId}`,
        },
      });

      return NextResponse.json({ success: true, data: createdPanels }, { status: 201 });
    }

    // Handle Manual Creation
    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'Panel name is required' }, { status: 400 });
    }

    const finalCoordinatorIds = [...coordinatorIds];

    const panel = await db.panel.create({
      data: {
        eventId,
        name: name.trim(),
        coordinators: {
          create: finalCoordinatorIds.map((userId: string) => ({ userId })),
        },
        evaluators: {
          create: evaluatorIds.map((userId: string) => ({ userId })),
        },
      },
      include: {
        coordinators: true,
        evaluators: true,
      },
    });

    await db.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'CREATE',
        entity: 'Panel',
        entityId: panel.id,
        details: `Manually created panel ${name} for event ${eventId}`,
      },
    });

    return NextResponse.json({ success: true, data: panel }, { status: 201 });
  } catch (error) {
    console.error('Create panel error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
