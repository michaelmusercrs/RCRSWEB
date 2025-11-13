'use client';

/**
 * Admin Layout
 * Basic authentication guard for admin pages
 *
 * IMPORTANT: This is a simple password-based authentication for demonstration.
 * For production, use a proper authentication system like NextAuth, Auth0, or Clerk.
 */

import { useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Lock, LogOut, Upload, FileText, Users, Settings, Home } from 'lucide-react';

// Simple password - In production, use environment variables and proper auth
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin123';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Check authentication on mount
  useEffect(() => {
    const authStatus = sessionStorage.getItem('admin_authenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  // Handle login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_authenticated', 'true');
      setIsAuthenticated(true);
      setPassword('');
    } else {
      setError('Invalid password');
      setPassword('');
    }
  };

  // Handle logout
  const handleLogout = () => {
    sessionStorage.removeItem('admin_authenticated');
    setIsAuthenticated(false);
    router.push('/');
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
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
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[#00FF00] rounded-full mb-4">
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF00] focus:border-transparent outline-none transition-all"
                  placeholder="Enter admin password"
                  required
                  autoFocus
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-[#00FF00] hover:bg-[#00DD00] text-black font-semibold rounded-lg transition-colors"
              >
                Sign In
              </button>
            </form>

            {/* Note for development */}
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800">
                <strong>Development Mode:</strong> Default password is &quot;admin123&quot;
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                For production, set NEXT_PUBLIC_ADMIN_PASSWORD in your environment variables.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Navigation items
  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: Home },
    { href: '/admin/upload', label: 'Upload Images', icon: Upload },
    { href: '/admin/blog', label: 'Blog Posts', icon: FileText },
    { href: '/admin/team', label: 'Team Members', icon: Users },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  // Show admin layout if authenticated
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <header className="bg-black border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#00FF00] rounded-lg flex items-center justify-center">
                <span className="text-black font-bold text-xl">RC</span>
              </div>
              <div>
                <h1 className="text-white font-bold text-lg">Admin Panel</h1>
                <p className="text-gray-400 text-xs">River City Roofing</p>
              </div>
            </div>

            {/* User menu */}
            <div className="flex items-center space-x-4">
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
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center space-x-2 py-4 border-b-2 transition-colors
                    ${
                      isActive
                        ? 'border-[#00FF00] text-black font-semibold'
                        : 'border-transparent text-gray-600 hover:text-black hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500">
            River City Roofing Solutions Admin Panel © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
