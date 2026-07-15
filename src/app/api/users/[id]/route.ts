import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireRole, hashPassword } from '@/lib/auth';
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

    // Users can view their own profile; Admins can view any
    if (payload.userId !== id && !requireRole('ADMIN')(payload)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Cannot view other users' },
        { status: 403 }
      );
    }

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        canEdit: true,
        phone: true,
        organization: true,
        createdAt: true,
        updatedAt: true,
        coordinatorAssignments: {
          include: {
            event: { select: { id: true, name: true } },
          },
        },
        evaluatorAssignments: {
          include: {
            event: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: { evaluations: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get user error:', error);
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

    // Users can update their own profile; Admins can update any
    const isOwnProfile = payload.userId === id;
    const isAdmin = requireRole('ADMIN')(payload);

    if (!isOwnProfile && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Cannot update other users' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, email, password, role, phone, organization, canEdit } = body;

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const updateData: any = {};

    // Own profile updates
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (organization !== undefined) updateData.organization = organization;

    // Password change allowed for own profile
    if (password) {
      updateData.password = await hashPassword(password);
    }

    // Admin-only fields
    if (isAdmin) {
      if (canEdit !== undefined) updateData.canEdit = canEdit;
      if (email !== undefined) {
        // Check email uniqueness
        if (email !== existing.email) {
          const emailExists = await db.user.findUnique({ where: { email } });
          if (emailExists) {
            return NextResponse.json(
              { success: false, error: 'Email already exists' },
              { status: 409 }
            );
          }
        }
        updateData.email = email;
      }
      if (role !== undefined) updateData.role = role;
    }

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        canEdit: true,
        phone: true,
        organization: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await db.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'UPDATE',
        entity: 'User',
        entityId: id,
        details: `Updated user: ${user.name}`,
      },
    });

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Update user error:', error);
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

    if (!requireRole('ADMIN')(payload)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Prevent deleting self
    if (payload.userId === id) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const user = await db.user.delete({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    await db.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'DELETE',
        entity: 'User',
        entityId: id,
        details: `Permanently deleted user: ${existing.name} (${existing.email})`,
      },
    });

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
