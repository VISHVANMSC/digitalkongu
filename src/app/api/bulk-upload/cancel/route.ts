import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const payload = await authenticateRequest(request);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { teamIds, participantIds } = body;

    // Delete all participants and teams in the arrays
    if (participantIds && Array.isArray(participantIds) && participantIds.length > 0) {
      await db.participant.deleteMany({
        where: { id: { in: participantIds } },
      });
    }

    if (teamIds && Array.isArray(teamIds) && teamIds.length > 0) {
      await db.team.deleteMany({
        where: { id: { in: teamIds } },
      });
    }

    await db.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'BULK_UPLOAD_CANCEL',
        entity: 'BulkUpload',
        details: `Cleaned up ${teamIds?.length || 0} teams and ${participantIds?.length || 0} participants due to cancellation/failure`,
      },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Partially uploaded data cleaned up successfully' },
    });
  } catch (error) {
    console.error('Cancel bulk upload cleanup error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
