'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { TEAM_MEMBERS, TeamRole, TeamMember } from './team-roles';

export interface AuthUser {
  userId: string;
  name: string;
  email: string;
  role: TeamRole;
  permissions: string[];
  mustChangePassword?: boolean;
  loginSetupComplete?: boolean;
  /** When impersonating, this holds the real admin's info */
  impersonatedBy?: {
    userId: string;
    name: string;
    email: string;
    role: TeamRole;
  };
}

type LoginMethod = 'password' | 'pin' | 'picture';

interface AuthContextType {
  user: AuthUser | null;
  /** The real admin user when impersonating, otherwise null */
  realUser: AuthUser | null;
  /** Whether we are currently in impersonation mode */
  isImpersonating: boolean;
  isLoading: boolean;
  login: (email: string, password?: string, staySignedIn?: boolean) => Promise<{ success: boolean; error?: string; mustChangePassword?: boolean }>;
  loginWithPin: (email: string, pin: string, staySignedIn?: boolean) => Promise<{ success: boolean; error?: string }>;
  loginWithPicture: (email: string, points: { x: number; y: number }[], staySignedIn?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  completePasswordChange: (newPassword: string) => Promise<boolean>;
  hasPermission: (permission: string) => boolean;
  canAccessRoute: (route: string) => boolean;
  getLoginMethod: (email: string) => Promise<{ loginMethod: LoginMethod; loginSetupComplete: boolean } | null>;
  /** Stop impersonating and return to admin view */
  stopImpersonating: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Routes accessible by each role
const ROLE_ROUTES: Record<TeamRole, string[]> = {
  owner: ['*'],
  admin: ['*'],
  manager: [
    '/portal/dashboard', '/portal/manager', '/portal/manager/lead-controls',
    '/portal/office', '/portal/office/new-lead', '/portal/billing',
    '/portal/inventory', '/portal/schedule', '/portal/reports',
    '/portal/pm', '/portal/delivery', '/portal/customers',
    '/portal/leads/new', '/portal/admin/lead-distro', '/portal/training',
    '/portal/my-profile', '/portal/monday-notes', '/portal/chat',
    '/portal/settings/notifications', '/portal/login-setup',
    '/portal/admin/credentials',
    '/command-center', '/command-center/leads',
  ],
  sales: [
    '/portal/dashboard', '/portal/sales', '/portal/sales/leads',
    '/portal/sales/customers', '/portal/sales/performance',
    '/portal/sales/settings', '/portal/march-madness',
    '/portal/my-profile', '/portal/monday-notes', '/portal/chat',
    '/portal/inventory', '/portal/schedule', '/portal/insurance-agents',
    '/portal/leads/new', '/portal/settings/notifications', '/portal/login-setup',
    '/command-center/sales', '/command-center/leads',
  ],
  office: [
    '/portal/dashboard', '/portal/office', '/portal/office/new-lead',
    '/portal/billing', '/portal/inventory', '/portal/schedule',
    '/portal/reports', '/portal/my-profile', '/portal/monday-notes',
    '/portal/chat', '/portal/leads/new', '/portal/settings/notifications',
    '/portal/login-setup', '/portal/admin/credentials',
    '/command-center', '/command-center/leads',
  ],
  project_manager: [
    '/portal/dashboard', '/portal/pm', '/portal/schedule',
    '/portal/inventory', '/portal/monday-notes', '/portal/chat',
    '/portal/leads/new', '/portal/insurance-agents', '/portal/sales',
    '/portal/sales/leads', '/portal/sales/customers',
    '/portal/sales/performance', '/portal/my-profile',
    '/portal/settings/notifications', '/portal/delivery',
    '/portal/billing', '/portal/login-setup',
    '/command-center',
  ],
  driver: [
    '/portal/dashboard', '/portal/driver', '/portal/inventory',
    '/portal/monday-notes', '/portal/chat', '/portal/my-profile',
    '/portal/insurance-agents', '/portal/sales', '/portal/sales/leads',
    '/portal/sales/customers', '/portal/sales/performance',
    '/portal/sales/settings', '/portal/leads/new', '/portal/schedule',
    '/portal/settings/notifications', '/portal/login-setup',
  ],
  viewer: [
    '/portal/dashboard', '/portal/office', '/portal/reports',
    '/portal/chat', '/portal/login-setup',
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

// Persistent session key (survives browser close, unlike sessionStorage)
const PERSISTENT_USER_KEY = 'rcrs_persistent_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [realUser, setRealUser] = useState<AuthUser | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Helper: read a cookie value by name (client-side)
  const getCookie = (name: string): string | null => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  };

  // Check impersonation status and swap user context if needed
  const checkImpersonation = async (baseUser: AuthUser): Promise<AuthUser> => {
    const impersonatingEmail = getCookie('impersonating');
    if (!impersonatingEmail) {
      // Not impersonating — clear impersonation state
      setRealUser(null);
      setIsImpersonating(false);
      return baseUser;
    }

    // Only owner/admin can impersonate
    if (baseUser.role !== 'owner' && baseUser.role !== 'admin') {
      // Non-admin has an impersonating cookie — clear it
      setRealUser(null);
      setIsImpersonating(false);
      return baseUser;
    }

    // Find the target member
    const targetMember = TEAM_MEMBERS.find(
      (m) => m.email.toLowerCase() === impersonatingEmail.toLowerCase() && m.isActive
    );

    if (!targetMember) {
      // Target not found — clear impersonation
      setRealUser(null);
      setIsImpersonating(false);
      return baseUser;
    }

    // Store the real admin user
    setRealUser(baseUser);
    setIsImpersonating(true);

    // Return the impersonated user context
    return {
      userId: targetMember.id,
      name: targetMember.name,
      email: targetMember.email,
      role: targetMember.role,
      permissions: targetMember.permissions,
      mustChangePassword: false, // Admin viewing — skip password change
      loginSetupComplete: true,
      impersonatedBy: {
        userId: baseUser.userId,
        name: baseUser.name,
        email: baseUser.email,
        role: baseUser.role as TeamRole,
      },
    };
  };

  // Load user from session on mount — check persistent session first
  useEffect(() => {
    const loadSession = async () => {
      try {
        // Check persistent (stay-signed-in) session first, then regular session
        const persistentUser = localStorage.getItem(PERSISTENT_USER_KEY);
        const sessionUser = sessionStorage.getItem('portalUser');
        const savedData = persistentUser || sessionUser;

        if (savedData) {
          const parsed = JSON.parse(savedData) as AuthUser;

          // Verify the team member still exists and is active
          const member = TEAM_MEMBERS.find(m => m.id === parsed.userId && m.isActive);
          if (!member) {
            // User deactivated — clear everything
            localStorage.removeItem(PERSISTENT_USER_KEY);
            sessionStorage.removeItem('portalUser');
            setIsLoading(false);
            return;
          }

          // Re-check mustChangePassword from localStorage flag
          const passwordChanged = localStorage.getItem(`passwordChanged_${member.id}`) === 'true';
          parsed.mustChangePassword = member.mustChangePassword && !passwordChanged;

          // Check for impersonation before setting user
          const effectiveUser = await checkImpersonation(parsed);
          setUser(effectiveUser);

          // Re-validate server session (JWT cookies)
          try {
            const res = await fetch('/api/portal/auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'validate' }),
            });
            if (!res.ok) {
              // Server cookies expired — try to refresh
              const refreshRes = await fetch('/api/portal/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'refresh' }),
              });
              if (!refreshRes.ok && persistentUser) {
                // Refresh also failed — persistent session is stale
                localStorage.removeItem(PERSISTENT_USER_KEY);
                sessionStorage.removeItem('portalUser');
                setUser(null);
                setRealUser(null);
                setIsImpersonating(false);
              }
            }
          } catch {
            // Network error — keep the local session, APIs will fail gracefully
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

  // Protect routes
  useEffect(() => {
    if (isLoading) return;

    const isPortalRoute = pathname?.startsWith('/portal');
    const isLoginPage = pathname === '/portal' || pathname === '/portal/login';
    const isChangePasswordPage = pathname === '/portal/change-password';

    if (isPortalRoute && !isLoginPage && !user) {
      router.push('/portal');
      return;
    }

    if (user?.mustChangePassword && isPortalRoute && !isChangePasswordPage && !isLoginPage) {
      router.push('/portal/change-password');
    }
  }, [user, isLoading, pathname, router]);

  /** Server-side auth call — returns the user data from the API */
  const callAuthApi = async (action: string, payload: Record<string, any>): Promise<any> => {
    const res = await fetch('/api/portal/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    return res.json();
  };

  /** Shared post-login handler */
  const handleLoginSuccess = (
    authUser: AuthUser,
    member: TeamMember,
    staySignedIn?: boolean
  ) => {
    setUser(authUser);
    sessionStorage.setItem('portalUser', JSON.stringify(authUser));

    // Persist across browser close if stay-signed-in
    if (staySignedIn) {
      localStorage.setItem(PERSISTENT_USER_KEY, JSON.stringify(authUser));
    }

    // Driver compat
    if (member.role === 'driver' || member.roles?.includes('driver')) {
      sessionStorage.setItem('driver', JSON.stringify({
        id: member.id, name: member.name, email: member.email,
        phone: member.phone || '', vehicle: 'Company Truck', isActive: true,
      }));
    }
    sessionStorage.setItem('userRole', member.role);
  };

  // ── Password Login ─────────────────────────────────

  const login = async (
    email: string,
    password?: string,
    staySignedIn?: boolean
  ): Promise<{ success: boolean; error?: string; mustChangePassword?: boolean }> => {
    const member = TEAM_MEMBERS.find(m =>
      m.email.toLowerCase() === email.toLowerCase() && m.isActive
    );
    if (!member) {
      return { success: false, error: 'Email not found. Please contact admin.' };
    }
    if (!password) {
      return { success: false, error: 'Password is required.' };
    }

    // Server-side password verification
    const result = await callAuthApi('login-password', { email, password, staySignedIn });

    if (!result.success) {
      return { success: false, error: result.error || 'Login failed' };
    }

    const passwordChanged = localStorage.getItem(`passwordChanged_${member.id}`) === 'true';
    const mustChange = member.mustChangePassword && !passwordChanged;

    const authUser: AuthUser = {
      userId: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      permissions: member.permissions,
      mustChangePassword: mustChange,
      loginSetupComplete: result.user?.loginSetupComplete ?? false,
    };

    handleLoginSuccess(authUser, member, staySignedIn);
    return { success: true, mustChangePassword: mustChange };
  };

  // ── PIN Login ──────────────────────────────────────

  const loginWithPin = async (
    email: string,
    pin: string,
    staySignedIn?: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    const member = TEAM_MEMBERS.find(m =>
      m.email.toLowerCase() === email.toLowerCase() && m.isActive
    );
    if (!member) {
      return { success: false, error: 'Email not found.' };
    }

    const result = await callAuthApi('login-pin', { email, pin, staySignedIn });

    if (!result.success) {
      return { success: false, error: result.error || 'Invalid PIN.' };
    }

    const authUser: AuthUser = {
      userId: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      permissions: member.permissions,
      loginSetupComplete: true,
    };

    handleLoginSuccess(authUser, member, staySignedIn);
    return { success: true };
  };

  // ── Picture Password Login ─────────────────────────

  const loginWithPicture = async (
    email: string,
    points: { x: number; y: number }[],
    staySignedIn?: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    const member = TEAM_MEMBERS.find(m =>
      m.email.toLowerCase() === email.toLowerCase() && m.isActive
    );
    if (!member) {
      return { success: false, error: 'Email not found.' };
    }

    const result = await callAuthApi('login-picture', { email, points, staySignedIn });

    if (!result.success) {
      return { success: false, error: result.error || 'Incorrect tap points.' };
    }

    const authUser: AuthUser = {
      userId: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      permissions: member.permissions,
      loginSetupComplete: true,
    };

    handleLoginSuccess(authUser, member, staySignedIn);
    return { success: true };
  };

  // ── Get Login Method ───────────────────────────────

  const getLoginMethod = async (email: string): Promise<{ loginMethod: LoginMethod; loginSetupComplete: boolean } | null> => {
    try {
      const result = await callAuthApi('get-login-method', { email });
      if (result.success) {
        return {
          loginMethod: result.loginMethod || 'password',
          loginSetupComplete: result.loginSetupComplete ?? false,
        };
      }
      return null;
    } catch {
      return null;
    }
  };

  // ── Password Change ────────────────────────────────

  const completePasswordChange = async (newPassword: string): Promise<boolean> => {
    if (!user) return false;
    if (newPassword === 'ChangeMe123!') return false;

    // Save to server-side credential store via the change-password action.
    // The server AWAITS the sheet write so by the time we get a 200 back,
    // the new password is durable in the UserCredentials tab.
    try {
      const res = await fetch('/api/portal/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change-password',
          newPassword,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.success) {
        console.error('[auth] change-password failed:', body?.error || res.status);
        return false;
      }
    } catch (err) {
      console.error('[auth] change-password network error:', err);
      return false;
    }

    // Persist in localStorage for backward compat with offline-first flows
    localStorage.setItem(`portalPassword_${user.userId}`, newPassword);
    localStorage.setItem(`passwordChanged_${user.userId}`, 'true');

    const updatedUser: AuthUser = { ...user, mustChangePassword: false };
    setUser(updatedUser);
    sessionStorage.setItem('portalUser', JSON.stringify(updatedUser));

    return true;
  };

  // ── Stop Impersonating ──────────────────────────────

  const stopImpersonating = async () => {
    try {
      await fetch('/api/portal/admin/impersonate', { method: 'DELETE' });
    } catch { /* continue */ }

    // Restore the real admin user
    if (realUser) {
      setUser(realUser);
      setRealUser(null);
      setIsImpersonating(false);
    }

    // Force reload to ensure all components re-render with the correct user
    window.location.href = '/portal/admin/user-profiles';
  };

  // ── Logout ─────────────────────────────────────────

  const logout = async () => {
    // If impersonating, also clear that cookie
    if (isImpersonating) {
      try {
        await fetch('/api/portal/admin/impersonate', { method: 'DELETE' });
      } catch { /* continue */ }
    }

    try {
      await fetch('/api/portal/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
    } catch { /* continue */ }

    setUser(null);
    setRealUser(null);
    setIsImpersonating(false);
    sessionStorage.removeItem('portalUser');
    sessionStorage.removeItem('driver');
    sessionStorage.removeItem('userRole');
    localStorage.removeItem(PERSISTENT_USER_KEY);
    router.push('/portal');
  };

  // ── Permission Checks ──────────────────────────────

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.permissions.includes('*')) return true;
    if (user.permissions.includes(permission)) return true;
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
      user, realUser, isImpersonating, isLoading,
      login, loginWithPin, loginWithPicture,
      logout, completePasswordChange,
      hasPermission, canAccessRoute, getLoginMethod,
      stopImpersonating,
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
