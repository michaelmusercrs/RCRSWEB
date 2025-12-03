import { NextRequest, NextResponse } from 'next/server';
import { portalAuthService } from '@/lib/portal-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'login-pin': {
        const result = await portalAuthService.authenticateByPin(data.pin);
        if (result.success && result.user) {
          return NextResponse.json({
            success: true,
            user: {
              userId: result.user.userId,
              name: result.user.name,
              email: result.user.email,
              role: result.user.role,
              permissions: portalAuthService.getPermissions(result.user.role),
            },
          });
        }
        return NextResponse.json({ success: false, error: result.error }, { status: 401 });
      }

      case 'login-passcode': {
        const result = await portalAuthService.authenticateByTempPasscode(data.email, data.passcode);
        if (result.success && result.user) {
          return NextResponse.json({
            success: true,
            user: {
              userId: result.user.userId,
              name: result.user.name,
              email: result.user.email,
              role: result.user.role,
              permissions: portalAuthService.getPermissions(result.user.role),
            },
          });
        }
        return NextResponse.json({ success: false, error: result.error }, { status: 401 });
      }

      case 'check-permission': {
        const user = await portalAuthService.getUserById(data.userId);
        if (!user) {
          return NextResponse.json({ hasPermission: false });
        }
        const hasPermission = portalAuthService.hasPermission(user, data.permission);
        return NextResponse.json({ hasPermission });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Auth API error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
