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
  pin?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  canAccessRoute: (route: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Routes accessible by each role
const ROLE_ROUTES: Record<TeamRole, string[]> = {
  owner: ['*'], // All routes
  admin: ['*'], // All routes
  office: [
    '/portal/dashboard',
    '/portal/office',
    '/portal/billing',
    '/portal/inventory',
    '/portal/schedule',
    '/portal/reports',
  ],
  project_manager: [
    '/portal/dashboard',
    '/portal/pm',
    '/portal/schedule',
  ],
  driver: [
    '/portal/dashboard',
    '/portal/driver',
  ],
  viewer: [
    '/portal/dashboard',
    '/portal/office',
    '/portal/reports',
  ],
};

// Default route for each role after login
export const ROLE_DEFAULT_ROUTES: Record<TeamRole, string> = {
  owner: '/portal/dashboard',
  admin: '/portal/dashboard',
  office: '/portal/dashboard',
  project_manager: '/portal/dashboard',
  driver: '/portal/driver',
  viewer: '/portal/dashboard',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Load user from session on mount
  useEffect(() => {
    const loadSession = () => {
      try {
        const savedUser = sessionStorage.getItem('portalUser');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
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
  useEffect(() => {
    if (isLoading) return;

    const isPortalRoute = pathname?.startsWith('/portal');
    const isLoginPage = pathname === '/portal' || pathname === '/portal/login';

    if (isPortalRoute && !isLoginPage && !user) {
      router.push('/portal');
    }
  }, [user, isLoading, pathname, router]);

  const login = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    // Find team member by email
    const member = TEAM_MEMBERS.find(m =>
      m.email.toLowerCase() === email.toLowerCase() && m.isActive
    );

    if (!member) {
      return { success: false, error: 'Email not found. Please contact admin.' };
    }

    // In production, verify password against stored hash
    // For now, we're using temp password validation
    const authUser: AuthUser = {
      userId: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      permissions: member.permissions,
    };

    setUser(authUser);
    sessionStorage.setItem('portalUser', JSON.stringify(authUser));

    return { success: true };
  };

  const loginWithPin = async (pin: string): Promise<{ success: boolean; error?: string }> => {
    // Find driver by PIN
    const driver = TEAM_MEMBERS.find(m =>
      m.role === 'driver' && m.pin === pin && m.isActive
    );

    if (!driver) {
      return { success: false, error: 'Invalid PIN. Please try again.' };
    }

    const authUser: AuthUser = {
      userId: driver.id,
      name: driver.name,
      email: driver.email,
      role: driver.role,
      permissions: driver.permissions,
      pin: driver.pin,
    };

    setUser(authUser);
    sessionStorage.setItem('portalUser', JSON.stringify(authUser));

    return { success: true };
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('portalUser');
    sessionStorage.removeItem('driver');
    sessionStorage.removeItem('userRole');
    router.push('/portal');
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.permissions.includes('*')) return true;
    return user.permissions.includes(permission);
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
      loginWithPin,
      logout,
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
