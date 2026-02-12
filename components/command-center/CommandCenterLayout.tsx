'use client';

/**
 * RCRS Command Center - Main Layout Component
 *
 * This is the primary layout component for the Command Center application.
 * It provides:
 * - Responsive sidebar navigation with role-based filtering
 * - Collapsible sidebar (icons only on mobile/collapsed state)
 * - Header with user info, role badge, and notifications
 * - Main content area with proper spacing
 * - Footer with quick links
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  TrendingUp,
  Package,
  Megaphone,
  Phone,
  Users,
  CreditCard,
  Calendar,
  BarChart3,
  Settings,
  Menu,
  X,
  Bell,
  ChevronDown,
  ChevronRight,
  LogOut,
  Home,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { getVisibleNavItems, getMobileNavItems } from '@/lib/permissions';
import { RoleBadge } from '@/components/command-center/RoleBadge';
import type { NavItem, Role } from '@/types/roles';
import type { TeamRole } from '@/lib/team-roles';

// =============================================================================
// ICON MAPPING
// =============================================================================

/**
 * Map of icon names to Lucide icon components.
 * Used to dynamically render icons based on NavItem configuration.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  TrendingUp,
  Package,
  Megaphone,
  Phone,
  Users,
  CreditCard,
  Calendar,
  BarChart3,
  Settings,
  FileText,
};

/**
 * Gets the icon component for a navigation item.
 */
function getNavIcon(iconName?: string): LucideIcon {
  if (!iconName) return LayoutDashboard;
  return ICON_MAP[iconName] || LayoutDashboard;
}

// =============================================================================
// ROLE MAPPING
// =============================================================================

/**
 * Maps TeamRole (from auth-context) to Role (from types/roles).
 * This bridges the two role systems used in the application.
 */
function mapTeamRoleToRole(teamRole: TeamRole): Role {
  const mapping: Record<TeamRole, Role> = {
    owner: 'Owner',
    admin: 'Admin',
    office: 'Office',
    project_manager: 'Manager',
    manager: 'Manager',
    driver: 'Driver',
    sales: 'Sales',
    viewer: 'Sales', // Viewers have similar access to Sales
  };
  return mapping[teamRole] || 'Sales';
}

// =============================================================================
// SIDEBAR NAVIGATION ITEM
// =============================================================================

interface SidebarNavItemProps {
  item: NavItem;
  isCollapsed: boolean;
  currentPath: string;
  level?: number;
}

function SidebarNavItem({
  item,
  isCollapsed,
  currentPath,
  level = 0,
}: SidebarNavItemProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const Icon = getNavIcon(item.icon);

  // Check if this item or any of its children is active
  const isActive = currentPath === item.href;
  const hasChildren = item.children && item.children.length > 0;
  const isChildActive = hasChildren && item.children
    ? item.children.some(
        (child) =>
          currentPath === child.href ||
          currentPath.startsWith(child.href + '/')
      )
    : false;

  // Auto-expand if a child is active
  React.useEffect(() => {
    if (isChildActive && !isExpanded) {
      setIsExpanded(true);
    }
  }, [isChildActive, isExpanded]);

  const handleClick = (e: React.MouseEvent) => {
    if (hasChildren && !isCollapsed) {
      e.preventDefault();
      setIsExpanded(!isExpanded);
    }
  };

  const baseClasses = cn(
    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
    'hover:bg-lime-500/10 focus:outline-none focus:ring-2 focus:ring-lime-500/40 focus:ring-offset-2 focus:ring-offset-zinc-900',
    level > 0 && 'ml-6 text-xs',
    isActive || isChildActive
      ? 'bg-lime-500/15 text-lime-400'
      : 'text-zinc-400 hover:text-white'
  );

  const content = (
    <>
      <Icon
        size={level > 0 ? 16 : 20}
        className={cn(
          'shrink-0 transition-colors',
          isActive || isChildActive ? 'text-lime-400' : 'text-zinc-500 group-hover:text-zinc-300'
        )}
        aria-hidden="true"
      />
      {!isCollapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge !== undefined && (
            <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-lime-500/20 px-1.5 text-xs font-semibold text-lime-400">
              {item.badge}
            </span>
          )}
          {hasChildren && (
            <ChevronRight
              size={16}
              className={cn(
                'ml-auto shrink-0 text-zinc-500 transition-transform duration-200',
                isExpanded && 'rotate-90'
              )}
              aria-hidden="true"
            />
          )}
        </>
      )}
    </>
  );

  if (hasChildren && !isCollapsed) {
    return (
      <div>
        <button
          onClick={handleClick}
          className={cn(baseClasses, 'w-full')}
          aria-expanded={isExpanded}
        >
          {content}
        </button>
        {isExpanded && (
          <div className="mt-1 space-y-1" role="group">
            {item.children!.map((child) => (
              <SidebarNavItem
                key={child.id}
                item={child}
                isCollapsed={isCollapsed}
                currentPath={currentPath}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={baseClasses}
      aria-current={isActive ? 'page' : undefined}
      title={isCollapsed ? item.label : undefined}
    >
      {content}
    </Link>
  );
}

// =============================================================================
// MOBILE NAVIGATION ITEM
// =============================================================================

interface MobileNavItemProps {
  item: NavItem;
  currentPath: string;
  onNavigate: () => void;
}

function MobileNavItem({ item, currentPath, onNavigate }: MobileNavItemProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const Icon = getNavIcon(item.icon);

  const isActive = currentPath === item.href;
  const hasChildren = item.children && item.children.length > 0;
  const isChildActive = hasChildren && item.children
    ? item.children.some((child) => currentPath === child.href)
    : false;

  const handleClick = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    } else {
      onNavigate();
    }
  };

  return (
    <div>
      {hasChildren ? (
        <button
          onClick={handleClick}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors',
            isActive || isChildActive
              ? 'bg-lime-500/15 text-lime-400'
              : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
          )}
        >
          <Icon size={22} aria-hidden="true" />
          <span className="flex-1 text-left">{item.label}</span>
          {item.badge !== undefined && (
            <span className="rounded-full bg-lime-500/20 px-2 py-0.5 text-xs font-semibold text-lime-400">
              {item.badge}
            </span>
          )}
          <ChevronDown
            size={20}
            className={cn(
              'transition-transform duration-200',
              isExpanded && 'rotate-180'
            )}
            aria-hidden="true"
          />
        </button>
      ) : (
        <Link
          href={item.href}
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors',
            isActive
              ? 'bg-lime-500/15 text-lime-400'
              : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
          )}
        >
          <Icon size={22} aria-hidden="true" />
          <span className="flex-1">{item.label}</span>
          {item.badge !== undefined && (
            <span className="rounded-full bg-lime-500/20 px-2 py-0.5 text-xs font-semibold text-lime-400">
              {item.badge}
            </span>
          )}
        </Link>
      )}
      {hasChildren && isExpanded && (
        <div className="ml-6 mt-1 space-y-1 border-l border-zinc-800 pl-4">
          {item.children!.map((child) => (
            <Link
              key={child.id}
              href={child.href}
              onClick={onNavigate}
              className={cn(
                'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                currentPath === child.href
                  ? 'bg-lime-500/15 text-lime-400'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
              )}
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN LAYOUT COMPONENT
// =============================================================================

interface CommandCenterLayoutProps {
  children: React.ReactNode;
}

export function CommandCenterLayout({ children }: CommandCenterLayoutProps) {
  const { user, logout, isLoading } = useAuth();
  const pathname = usePathname();

  // Sidebar state
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // Close mobile menu on route change
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile menu on escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Prevent body scroll when mobile menu is open
  React.useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-800 border-t-lime-500" />
          <p className="text-sm text-zinc-500">Loading RoofStack...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show login prompt
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-white">
            RoofStack
          </h1>
          <p className="mb-6 text-zinc-400">
            Please log in to access RoofStack.
          </p>
          <Link
            href="/portal"
            className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-6 py-3 font-semibold text-zinc-900 transition-colors hover:bg-lime-400"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  // Map the auth user's role to the Role type used by permissions
  const userRole = mapTeamRoleToRole(user.role);

  // Get navigation items filtered by role
  const navItems = getVisibleNavItems(userRole);
  const mobileNavItems = getMobileNavItems(userRole);

  return (
    <div className="flex min-h-screen bg-zinc-950">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-zinc-800 bg-zinc-900 transition-all duration-300 lg:flex',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between border-b border-zinc-800 px-4">
          {!isCollapsed && (
            <Link
              href="/command-center"
              className="flex items-center gap-2 text-lg font-bold text-white"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-500">
                <span className="text-sm font-black text-zinc-900">RS</span>
              </div>
              <span className="truncate">RoofStack</span>
            </Link>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white',
              isCollapsed && 'mx-auto'
            )}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
          <div className="space-y-1">
            {navItems.map((item) => (
              <SidebarNavItem
                key={item.id}
                item={item}
                isCollapsed={isCollapsed}
                currentPath={pathname}
              />
            ))}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t border-zinc-800 p-4">
          {!isCollapsed ? (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-white">
                {user.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {user.name}
                </p>
                <RoleBadge role={user.role} size="sm" />
              </div>
              <button
                onClick={logout}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-red-400"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button
              onClick={logout}
              className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-red-400"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={20} />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 transform bg-zinc-900 shadow-xl transition-transform duration-300 ease-in-out lg:hidden',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Mobile Sidebar Header */}
        <div className="flex h-16 items-center justify-between border-b border-zinc-800 px-4">
          <Link
            href="/command-center"
            className="flex items-center gap-2 text-lg font-bold text-white"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-500">
              <span className="text-sm font-black text-zinc-900">RS</span>
            </div>
            <span>RoofStack</span>
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mobile User Info */}
        <div className="border-b border-zinc-800 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-white">
              {user.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <div>
              <p className="font-medium text-white">{user.name}</p>
              <RoleBadge role={user.role} size="sm" />
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="flex-1 overflow-y-auto p-4" aria-label="Mobile navigation">
          <div className="space-y-1">
            {mobileNavItems.map((item) => (
              <MobileNavItem
                key={item.id}
                item={item}
                currentPath={pathname}
                onNavigate={() => setIsMobileMenuOpen(false)}
              />
            ))}
          </div>
        </nav>

        {/* Mobile Footer */}
        <div className="border-t border-zinc-800 p-4">
          <div className="flex gap-2">
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
            >
              <Home size={18} />
              View Site
            </Link>
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                logout();
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={cn(
          'flex min-h-screen flex-1 flex-col transition-all duration-300',
          isCollapsed ? 'lg:pl-16' : 'lg:pl-64'
        )}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-4 lg:px-6">
            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={24} />
            </button>

            {/* Page Title / Breadcrumb (Desktop) */}
            <div className="hidden lg:block">
              <h1 className="text-lg font-semibold text-white">
                {getPageTitle(pathname)}
              </h1>
            </div>

            {/* Mobile Logo */}
            <Link
              href="/command-center"
              className="flex items-center gap-2 lg:hidden"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-500">
                <span className="text-sm font-black text-zinc-900">RS</span>
              </div>
            </Link>

            {/* Header Actions */}
            <div className="flex items-center gap-2">
              {/* Notifications */}
              <button
                className="relative flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                aria-label="Notifications"
              >
                <Bell size={20} />
                {/* Notification Badge */}
                <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-500" />
                </span>
              </button>

              {/* View Public Site */}
              <Link
                href="/"
                target="_blank"
                className="hidden items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white sm:flex"
              >
                <Home size={16} />
                <span>View Site</span>
              </Link>

              {/* User Info (Desktop) */}
              <div className="hidden items-center gap-3 rounded-lg bg-zinc-800/50 px-3 py-1.5 lg:flex">
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{user.name}</p>
                  <p className="text-xs text-zinc-500">{user.email}</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-700 text-sm font-semibold text-white">
                  {user.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-x-auto min-w-0">{children}</main>

        {/* Footer */}
        <footer className="border-t border-zinc-800 bg-zinc-900/50 px-4 py-4 lg:px-6 overflow-x-auto">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row min-w-max sm:min-w-0">
            {/* Quick Links */}
            <nav className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-sm" aria-label="Footer navigation">
              <Link
                href="/command-center"
                className="text-zinc-500 transition-colors hover:text-zinc-300"
              >
                Dashboard
              </Link>
              <span className="text-zinc-700">|</span>
              <Link
                href="/command-center/team"
                className="text-zinc-500 transition-colors hover:text-zinc-300"
              >
                Team Directory
              </Link>
              <span className="text-zinc-700">|</span>
              <Link
                href="/portal"
                className="text-zinc-500 transition-colors hover:text-zinc-300"
              >
                Legacy Portal
              </Link>
              <span className="text-zinc-700">|</span>
              <a
                href="mailto:support@rivercityroofingsolutions.com"
                className="text-zinc-500 transition-colors hover:text-zinc-300"
              >
                Support
              </a>
            </nav>

            {/* Copyright */}
            <p className="text-xs text-zinc-600">
              &copy; {new Date().getFullYear()} River City Roofing Solutions. All
              rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Gets a human-readable page title from the current pathname.
 */
function getPageTitle(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);

  // Remove 'command-center' prefix
  if (segments[0] === 'command-center') {
    segments.shift();
  }

  if (segments.length === 0) {
    return 'Dashboard';
  }

  // Map route segments to titles
  const titles: Record<string, string> = {
    dashboard: 'HQ',
    sales: 'Sales',
    leaderboard: 'Leaderboard',
    commissions: 'Commissions',
    'my-stats': 'My Stats',
    inventory: 'Materials',
    costs: 'Costs & Pricing',
    edit: 'Edit',
    manage: 'Manage',
    marketing: 'Marketing',
    phone: 'Phone System',
    all: 'All Records',
    team: 'Team',
    billing: 'Finance',
    schedule: 'Schedule',
    reports: 'Reports',
    export: 'Export',
    settings: 'Settings',
    meetings: 'Meetings',
    documents: 'Documents',
    agents: 'Agents',
  };

  // Build title from segments
  return segments
    .map((segment) => titles[segment] || segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' - ');
}

export default CommandCenterLayout;
