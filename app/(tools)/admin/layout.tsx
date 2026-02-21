'use client';

/**
 * Admin Layout
 * Secure authentication guard for admin pages
 *
 * Security improvements:
 * - Password verification via secure API (not exposed to client)
 * - JWT-based session tokens stored in httpOnly cookies
 * - Rate limiting on login attempts
 * - Automatic session validation
 */

import { useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Lock, LogOut, LayoutDashboard, TrendingUp, Package, Megaphone, Users, UserCog, FileText, Settings, Command, ClipboardCheck, Shield, AlertTriangle } from 'lucide-react';

interface AdminUser {
  userId: string;
  name: string;
  email: string;
  role: string;
}

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Check authentication on mount
  useEffect(() => {
    const validateSession = async () => {
      try {
        const response = await fetch('/api/admin/auth', {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          if (data.authenticated && data.user) {
            setIsAuthenticated(true);
            setUser(data.user);
          }
        }
      } catch (error) {
        console.error('Session validation error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    validateSession();
  }, []);

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'login',
          password,
        }),
      });

      const data = await response.json();

      if (data.success && data.user) {
        setIsAuthenticated(true);
        setUser(data.user);
        setPassword('');
        setRemainingAttempts(null);
      } else {
        setError(data.error || 'Invalid password');
        setPassword('');
        if (data.remainingAttempts !== undefined) {
          setRemainingAttempts(data.remainingAttempts);
        }
      }
    } catch (error) {
      setError('Login failed. Please try again.');
      setPassword('');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'logout' }),
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    setIsAuthenticated(false);
    setUser(null);
    router.push('/');
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <div className="w-full max-w-md p-8">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-green rounded-full mb-4">
                <Lock className="w-8 h-8 text-black" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Access</h1>
              <p className="text-gray-600 mt-2">River City Roofing Solutions</p>
            </div>

            {/* Login form */}
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent outline-none transition-all"
                  placeholder="Enter admin password"
                  required
                  autoFocus
                  disabled={isSubmitting}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-red-600">{error}</p>
                      {remainingAttempts !== null && remainingAttempts > 0 && (
                        <p className="text-xs text-red-500 mt-1">
                          {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining
                        </p>
                      )}
                      {remainingAttempts === 0 && (
                        <p className="text-xs text-red-500 mt-1">
                          Account temporarily locked. Please try again later.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-brand-green hover:bg-lime-400 disabled:bg-gray-400 text-black font-semibold rounded-lg transition-colors"
              >
                {isSubmitting ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            {/* Security notice */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>Security Notice:</strong> This login is protected by rate limiting.
                Multiple failed attempts will temporarily lock access.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Navigation items
  const navItems: Array<{ href: string; label: string; icon: typeof LayoutDashboard; highlight?: boolean; badge?: string }> = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/command-center', label: 'Command Center', icon: Command, highlight: true },
    { href: '/admin/approvals', label: 'Approvals', icon: ClipboardCheck },
    { href: '/admin/sales', label: 'Sales & Commissions', icon: TrendingUp },
    { href: '/admin/inventory', label: 'Inventory', icon: Package },
    { href: '/admin/marketing', label: 'Marketing', icon: Megaphone },
    { href: '/admin/jobnimbus', label: 'JobNimbus CRM', icon: Users },
    { href: '/admin/team', label: 'Team', icon: UserCog },
    { href: '/admin/blog', label: 'Blog', icon: FileText },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
    { href: '/admin/system', label: 'System', icon: Shield },
  ];

  // Get environment badge info
  const getEnvironmentBadge = () => {
    const env = process.env.NODE_ENV || 'development';
    const vercelEnv = process.env.VERCEL_ENV;

    if (env === 'production' && vercelEnv !== 'preview') {
      return { label: 'PROD', bgColor: 'bg-red-500', textColor: 'text-white' };
    } else if (vercelEnv === 'preview') {
      return { label: 'STAGING', bgColor: 'bg-yellow-500', textColor: 'text-black' };
    }
    return { label: 'DEV', bgColor: 'bg-green-500', textColor: 'text-black' };
  };

  const envBadge = getEnvironmentBadge();

  // Show admin layout if authenticated
  return (
    <div className="min-h-screen bg-black">
      {/* Admin Header */}
      <header className="bg-black border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-brand-green rounded-lg flex items-center justify-center">
                <span className="text-black font-bold text-xl">RC</span>
              </div>
              <div>
                <h1 className="text-white font-bold text-lg">Admin Panel</h1>
                <p className="text-gray-400 text-xs">River City Roofing</p>
              </div>
              {/* Environment Badge */}
              <div className={`ml-3 px-2 py-1 rounded text-xs font-bold ${envBadge.bgColor} ${envBadge.textColor}`}>
                {envBadge.label}
              </div>
            </div>

            {/* User menu */}
            <div className="flex items-center space-x-4">
              {user && (
                <span className="text-gray-400 text-sm hidden sm:block">
                  {user.name}
                </span>
              )}
              <Link
                href="/"
                className="text-gray-300 hover:text-white text-sm transition-colors"
              >
                View Site
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Admin Navigation */}
      <nav className="bg-neutral-950 border-b border-white/10 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-4 sm:space-x-8 min-w-max">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href === '/command-center' && pathname?.startsWith('/command-center'));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center space-x-2 py-4 border-b-2 transition-colors whitespace-nowrap flex-shrink-0
                    ${
                      isActive
                        ? 'border-brand-green text-brand-green font-semibold'
                        : item.highlight
                        ? 'border-transparent text-brand-green hover:text-white hover:border-brand-green font-semibold'
                        : 'border-transparent text-neutral-400 hover:text-white hover:border-white/20'
                    }
                  `}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">{item.label}</span>
                  {item.highlight && !isActive && (
                    <span className="ml-1 px-1.5 py-0.5 bg-brand-green text-black text-[10px] font-bold rounded flex-shrink-0">NEW</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-x-auto">{children}</main>

      {/* Footer */}
      <footer className="bg-neutral-950 border-t border-white/10 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-neutral-500">
            River City Roofing Solutions Admin Panel &copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
