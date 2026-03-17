'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { TEAM_MEMBERS, TeamRole, TeamMember, hasPermission as checkMemberPermission } from './team-roles';

export interface AuthUser {
  userId: string;
  name: string;
  email: string;
  role: TeamRole;
  permissions: string[];
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string; mustChangePassword?: boolean }>;
  logout: () => void;
  completePasswordChange: (newPassword: string) => boolean;
  hasPermission: (permission: string) => boolean;
  canAccessRoute: (route: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Routes accessible by each role
const ROLE_ROUTES: Record<TeamRole, string[]> = {
  owner: ['*'], // All routes
  admin: ['*'], // All routes
  manager: [
    '/portal/dashboard',
    '/portal/manager',
    '/portal/office',
    '/portal/billing',
    '/portal/inventory',
    '/portal/schedule',
    '/portal/reports',
    '/portal/my-profile',
    '/portal/monday-notes',
    '/portal/chat',
    '/portal/settings/notifications',
    '/command-center',
    '/command-center/leads',
  ],
  sales: [
    '/portal/dashboard',
    '/portal/sales',
    '/portal/sales/leads',
    '/portal/sales/jobs',
    '/portal/sales/stats',
    '/portal/sales/profile',
    '/portal/march-madness',
    '/portal/my-profile',
    '/portal/monday-notes',
    '/portal/chat',
    '/portal/inventory',
    '/portal/schedule',
    '/portal/settings/notifications',
    '/command-center/sales',
    '/command-center/leads',
  ],
  office: [
    '/portal/dashboard',
    '/portal/office',
    '/portal/billing',
    '/portal/inventory',
    '/portal/schedule',
    '/portal/reports',
    '/portal/my-profile',
    '/portal/monday-notes',
    '/portal/chat',
    '/portal/settings/notifications',
    '/command-center',
    '/command-center/leads',
  ],
  project_manager: [
    '/portal/dashboard',
    '/portal/pm',
    '/portal/schedule',
    '/portal/inventory',
    '/portal/monday-notes',
    '/portal/chat',
    '/command-center',
  ],
  driver: [
    '/portal/dashboard',
    '/portal/driver',
    '/portal/inventory',
    '/portal/monday-notes',
    '/portal/chat',
  ],
  viewer: [
    '/portal/dashboard',
    '/portal/office',
    '/portal/reports',
    '/portal/chat',
  ],
};

// Default route for each role after login
export const ROLE_DEFAULT_ROUTES: Record<TeamRole, string> = {
  owner: '/portal/dashboard',
  admin: '/portal/dashboard',
  manager: '/portal/dashboard',
  sales: '/portal/dashboard',
  office: '/portal/dashboard',
  project_manager: '/portal/pm',
  driver: '/portal/driver',
  viewer: '/portal/dashboard',
};

// Call server-side auth API to set JWT cookies (required for API routes)
async function setServerSession(member: TeamMember): Promise<boolean> {
  try {
    const res = await fetch('/api/portal/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'login-passcode',
        email: member.email,
        passcode: member.password,
      }),
    });
    if (res.ok) return true;
    // Fallback: try validate to see if session already exists
    console.warn('Server auth failed, API routes may return 401');
    return false;
  } catch (err) {
    console.warn('Failed to set server session:', err);
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Load user from session on mount and re-validate server cookies
  useEffect(() => {
    const loadSession = async () => {
      try {
        const savedUser = sessionStorage.getItem('portalUser');
        if (savedUser) {
          const parsed = JSON.parse(savedUser) as AuthUser;

          // Re-check mustChangePassword from source of truth (localStorage flag)
          const member = TEAM_MEMBERS.find(m => m.id === parsed.userId && m.isActive);
          if (member) {
            const passwordChanged = localStorage.getItem(`passwordChanged_${member.id}`) === 'true';
            parsed.mustChangePassword = member.mustChangePassword && !passwordChanged;
          }

          setUser(parsed);
          // Re-validate server session - if cookies expired, re-set them
          try {
            const res = await fetch('/api/portal/auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'validate' }),
            });
            if (!res.ok) {
              // Server session expired - re-authenticate using stored member data
              const member = TEAM_MEMBERS.find(m => m.id === parsed.userId && m.isActive);
              if (member) {
                await setServerSession(member);
              }
            }
          } catch {
            // Server validation failed, try to re-auth
            const member = TEAM_MEMBERS.find(m => m.id === parsed.userId && m.isActive);
            if (member) {
              await setServerSession(member);
            }
          }
        }
      } catch (error) {
        console.error('Error loading session:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, []);

  // Protect routes - redirect to login if not authenticated
  // Force password change if mustChangePassword flag is set
  useEffect(() => {
    if (isLoading) return;

    const isPortalRoute = pathname?.startsWith('/portal');
    const isLoginPage = pathname === '/portal' || pathname === '/portal/login';
    const isChangePasswordPage = pathname === '/portal/change-password';
    const isOnboardingPage = isChangePasswordPage || pathname === '/portal/welcome';

    // Not logged in -> go to login
    if (isPortalRoute && !isLoginPage && !isOnboardingPage && !user) {
      router.push('/portal');
      return;
    }

    // Logged in but must change password -> force to change-password page
    if (user?.mustChangePassword && isPortalRoute && !isChangePasswordPage && !isLoginPage) {
      router.push('/portal/change-password');
    }
  }, [user, isLoading, pathname, router]);

  const login = async (email: string, password?: string): Promise<{ success: boolean; error?: string; mustChangePassword?: boolean }> => {
    // Find team member by email
    const member = TEAM_MEMBERS.find(m =>
      m.email.toLowerCase() === email.toLowerCase() && m.isActive
    );

    if (!member) {
      return { success: false, error: 'Email not found. Please contact admin.' };
    }

    // Validate password - required for all logins
    if (!password) {
      return { success: false, error: 'Password is required.' };
    }

    // Check localStorage for changed password first, then fall back to hardcoded
    const storedPassword = typeof window !== 'undefined'
      ? localStorage.getItem(`portalPassword_${member.id}`)
      : null;
    const effectivePassword = storedPassword || member.password;

    if (password !== effectivePassword) {
      return { success: false, error: 'Invalid password. Please try again.' };
    }

    // Check if user must change password
    const passwordChanged = typeof window !== 'undefined'
      ? localStorage.getItem(`passwordChanged_${member.id}`) === 'true'
      : false;
    const mustChange = member.mustChangePassword && !passwordChanged;

    const authUser: AuthUser = {
      userId: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      permissions: member.permissions,
      mustChangePassword: mustChange,
    };

    // Set server-side JWT cookies for API route auth
    await setServerSession(member);

    setUser(authUser);
    sessionStorage.setItem('portalUser', JSON.stringify(authUser));

    // Also set driver object for driver portal compatibility (if driver role)
    if (member.role === 'driver' || member.roles?.includes('driver')) {
      sessionStorage.setItem('driver', JSON.stringify({
        id: member.id,
        name: member.name,
        email: member.email,
        phone: member.phone || '',
        vehicle: 'Company Truck',
        isActive: true,
      }));
    }
    sessionStorage.setItem('userRole', member.role);

    return { success: true, mustChangePassword: mustChange };
  };

  const completePasswordChange = (newPassword: string): boolean => {
    if (!user) return false;

    // Block reuse of the default password (case-sensitive match)
    if (newPassword === 'ChangeMe123!') return false;

    // Persist new password + flag in localStorage
    localStorage.setItem(`portalPassword_${user.userId}`, newPassword);
    localStorage.setItem(`passwordChanged_${user.userId}`, 'true');

    // Clear the mustChangePassword flag on the active session
    const updatedUser: AuthUser = { ...user, mustChangePassword: false };
    setUser(updatedUser);
    sessionStorage.setItem('portalUser', JSON.stringify(updatedUser));

    return true;
  };

  const logout = async () => {
    // Clear server-side JWT cookies
    try {
      await fetch('/api/portal/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
    } catch {
      // Continue with client logout even if server fails
    }
    setUser(null);
    sessionStorage.removeItem('portalUser');
    sessionStorage.removeItem('driver');
    sessionStorage.removeItem('userRole');
    router.push('/portal');
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.permissions.includes('*')) return true;

    // Exact match
    if (user.permissions.includes(permission)) return true;

    // Parent permission check: having 'sales' grants 'sales.leads', etc.
    if (permission.includes('.')) {
      const parent = permission.split('.')[0];
      if (user.permissions.includes(parent)) return true;
    }

    return false;
  };

  const canAccessRoute = (route: string): boolean => {
    if (!user) return false;

    const allowedRoutes = ROLE_ROUTES[user.role];
    if (allowedRoutes.includes('*')) return true;

    return allowedRoutes.some(r => route.startsWith(r));
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login,
      logout,
      completePasswordChange,
      hasPermission,
      canAccessRoute,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
