import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth-service';
import { portalAuthService, UserRole } from '@/lib/portal-auth';
import { checkRequestSize } from '@/lib/request-size-limit';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (userId) {
      const user = await portalAuthService.getUserById(userId);
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      // Don't expose sensitive fields
      const { pin, tempPasscode, ...safeUser } = user;
      return NextResponse.json(safeUser);
    }

    const users = await portalAuthService.getUsers();
    // Don't expose sensitive fields
    const safeUsers = users.map(({ pin, tempPasscode, ...user }) => user);
    return NextResponse.json(safeUsers);
  } catch (error) {
    console.error('Users API GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  // SECURITY: Enforce request body size limit
  const sizeError = checkRequestSize(request, '100kb');
  if (sizeError) return sizeError;

  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create': {
        const result = await portalAuthService.createUser({
          name: data.name,
          email: data.email,
          phone: data.phone,
          role: data.role as UserRole,
          createdBy: data.createdBy || 'system',
        });

        return NextResponse.json({
          success: true,
          user: {
            userId: result.user.userId,
            name: result.user.name,
            email: result.user.email,
            role: result.user.role,
            // PIN auth removed - email+password only
          },
          tempPasscode: result.tempPasscode,
          message: `User created. Temporary passcode: ${result.tempPasscode} (expires in 24 hours)`,
        });
      }

      case 'generate-passcode': {
        const passcode = await portalAuthService.generateNewTempPasscode(
          data.userId,
          data.generatedBy || 'system'
        );
        return NextResponse.json({
          success: true,
          tempPasscode: passcode,
          message: 'New temporary passcode generated (expires in 24 hours)',
        });
      }

      case 'reset-pin': {
        const newPin = await portalAuthService.resetPin(
          data.userId,
          data.resetBy || 'system'
        );
        return NextResponse.json({
          success: true,
          pin: newPin,
          message: 'PIN has been reset',
        });
      }

      case 'update-status': {
        await portalAuthService.updateUser(
          data.userId,
          { status: data.status },
          data.updatedBy || 'system'
        );
        return NextResponse.json({ success: true, message: 'User status updated' });
      }

      case 'update-role': {
        await portalAuthService.updateUser(
          data.userId,
          { role: data.role },
          data.updatedBy || 'system'
        );
        return NextResponse.json({ success: true, message: 'User role updated' });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Users API POST error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  // SECURITY: Require admin to modify user records (prevents privilege escalation)
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  // SECURITY: Enforce request body size limit
  const sizeError = checkRequestSize(request, '100kb');
  if (sizeError) return sizeError;

  try {
    const body = await request.json();
    const { userId, updatedBy, ...updates } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Don't allow updating sensitive fields directly through PATCH
    delete updates.pin;
    delete updates.tempPasscode;
    delete updates.tempPasscodeExpiry;

    await portalAuthService.updateUser(userId, updates, updatedBy || 'system');
    return NextResponse.json({ success: true, message: 'User updated' });
  } catch (error) {
    console.error('Users API PATCH error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
