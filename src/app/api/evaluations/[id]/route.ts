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
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const evaluation = await db.evaluation.findUnique({
      where: { id },
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
    });

    if (!evaluation) {
      return NextResponse.json(
        { success: false, error: 'Evaluation not found' },
        { status: 404 }
      );
    }

    // Role-based access check
    if (payload.role === 'EVALUATOR' && evaluation.evaluatorId !== payload.userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Can only view own evaluations' },
        { status: 403 }
      );
    } else if (payload.role === 'COORDINATOR') {
      const isAssigned = await db.eventCoordinator.findUnique({
        where: { eventId_userId: { eventId: evaluation.eventId, userId: payload.userId } },
      });
      if (!isAssigned) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Not assigned to this event' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: evaluation,
    });
  } catch (error) {
    console.error('Get evaluation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await authenticateRequest(request);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const existing = await db.evaluation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Evaluation not found' },
        { status: 404 }
      );
    }

    // Can only update if DRAFT or if the evaluator owns it
    const isAdmin = requireRole('ADMIN')(payload);
    const isOwner = existing.evaluatorId === payload.userId;

    if (existing.status === 'SUBMITTED' && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Cannot update a submitted evaluation' },
        { status: 400 }
      );
    }

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Can only update own evaluations' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, comments, scores } = body;

    const updateData: any = {};

    if (comments !== undefined) updateData.comments = comments;

    if (status !== undefined) {
      updateData.status = status;
      if (status === 'SUBMITTED') {
        updateData.submittedAt = new Date();
      }
    }

    // Handle scores update
    if (scores !== undefined) {
      // Delete existing scores and recreate
      await db.evaluationScore.deleteMany({ where: { evaluationId: id } });

      let totalScore = 0;
      if (scores.length > 0) {
        totalScore = scores.reduce((sum: number, s: any) => sum + (s.score || s.starRating || 0), 0);
      }
      updateData.totalScore = totalScore;

      updateData.scores = {
        create: scores.map((s: any) => ({
          criteriaId: s.criteriaId,
          score: s.score || 0,
          starRating: s.starRating || 0,
          comments: s.comments || null,
        })),
      };
    }

    const evaluation = await db.evaluation.update({
      where: { id },
      data: updateData,
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
        action: 'UPDATE',
        entity: 'Evaluation',
        entityId: id,
        details: `Updated evaluation (status: ${evaluation.status})`,
      },
    });

    return NextResponse.json({
      success: true,
      data: evaluation,
    });
  } catch (error) {
    console.error('Update evaluation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await authenticateRequest(request);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const existing = await db.evaluation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Evaluation not found' },
        { status: 404 }
      );
    }

    // Can only delete if DRAFT
    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete a submitted evaluation' },
        { status: 400 }
      );
    }

    const isAdmin = requireRole('ADMIN')(payload);
    const isOwner = existing.evaluatorId === payload.userId;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Can only delete own draft evaluations' },
        { status: 403 }
      );
    }

    // Scores will cascade delete
    await db.evaluation.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'DELETE',
        entity: 'Evaluation',
        entityId: id,
        details: 'Deleted draft evaluation',
      },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Evaluation deleted successfully' },
    });
  } catch (error) {
    console.error('Delete evaluation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
