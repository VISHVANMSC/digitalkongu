import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, generateAccessToken, generateRefreshToken, handleFailedLogin, handleSuccessfulLogin, checkLoginAttempts } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Account is disabled. Contact administrator.' },
        { status: 403 }
      );
    }

    // Check login attempts / lockout
    const attemptCheck = await checkLoginAttempts(user.id);
    if (!attemptCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Account is locked due to too many failed attempts. Try again after ${attemptCheck.lockedUntil ? new Date(attemptCheck.lockedUntil).toISOString() : '30 minutes'}.`,
        },
        { status: 423 }
      );
    }

    const isValid = await verifyPassword(password, user.password);

    if (!isValid) {
      await handleFailedLogin(user.id);
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    await handleSuccessfulLogin(user.id);

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    return NextResponse.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          organization: user.organization,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
