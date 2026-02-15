'use client';

/**
 * Portal Shell - Unified layout for all portal pages
 * 
 * Provides:
 * - Responsive sidebar navigation filtered by user role
 * - Auth guard (redirects to /portal if not logged in)
 * - Route access checking via canAccessRoute
 * - Consistent header with user info and logout
 * - Mobile-friendly hamburger menu
 */

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu, X, LogOut, Home, ChevronRight, Loader2, Bell,
  Truck, Package, DollarSign, Calendar, BarChart3, Users,
  Settings, Shield, Command, MessageSquare, Edit3, Megaphone,
  Target, Zap, Plus, MapPin, Box, ClipboardList,
  Eye, UserCircle, BookOpen, Image as ImageIcon, Phone,
  TrendingUp, CheckCircle, FileText,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { TeamRole } from '@/lib/team-roles';

// =============================================================================
// NAV CONFIG - Role-based navigation items
// =============================================================================

interface PortalNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  children?: PortalNavItem[];
}

function getPortalNav(role: TeamRole): PortalNavItem[] {
  const shared: PortalNavItem[] = [
    { id: 'dashboard', label: 'Dashboard', href: '/portal/dashboard', icon: Home },
    { id: 'monday-notes', label: 'Monday Notes', href: '/portal/monday-notes', icon: Megaphone },
    { id: 'chat', label: 'Chat', href: '/portal/chat', icon: MessageSquare },
    { id: 'my-profile', label: 'My Profile', href: '/portal/my-profile', icon: Edit3 },
  ];

  const adminItems: PortalNavItem[] = [
    { id: 'command-center', label: 'RoofStack HQ', href: '/command-center', icon: Command },
    ...shared,
    {
      id: 'operations', label: 'Operations', href: '/portal/office', icon: ClipboardList,
      children: [
        { id: 'office-main', label: 'Overview', href: '/portal/office', icon: ClipboardList },
        { id: 'customers', label: 'MyProject Portals', href: '/portal/customers', icon: Users },
        { id: 'schedule', label: 'Schedule', href: '/portal/schedule', icon: Calendar },
        { id: 'reports', label: 'Reports', href: '/portal/reports', icon: BarChart3 },
      ],
    },
    {
      id: 'logistics', label: 'Logistics', href: '/portal/pm', icon: Package,
      children: [
        { id: 'pm-main', label: 'Create Orders', href: '/portal/pm', icon: Package },
        { id: 'delivery', label: 'Delivery Hub', href: '/portal/delivery', icon: Truck },
      ],
    },
    { id: 'billing', label: 'Finance', href: '/portal/billing', icon: DollarSign },
    { id: 'inventory', label: 'Materials', href: '/portal/inventory', icon: Box },
    {
      id: 'leads', label: 'Leads', href: '/portal/leads/new', icon: Target,
      children: [
        { id: 'new-lead-wizard', label: 'New Lead Wizard', href: '/portal/office/new-lead', icon: Zap },
        { id: 'new-lead', label: 'Quick Entry', href: '/portal/leads/new', icon: Plus },
        { id: 'lead-distro', label: 'Lead Distribution', href: '/portal/admin/lead-distro', icon: Target },
      ],
    },
    {
      id: 'admin', label: 'Admin', href: '/portal/admin', icon: Settings,
      children: [
        { id: 'admin-main', label: 'Settings', href: '/portal/admin', icon: Settings },
        { id: 'users', label: 'Users', href: '/portal/admin/users', icon: Users },
        { id: 'team', label: 'Team Bios', href: '/portal/admin/team', icon: UserCircle },
        { id: 'profile-approvals', label: 'Approvals', href: '/portal/admin/profile-approvals', icon: CheckCircle },
        { id: 'blog', label: 'Blog', href: '/portal/admin/blog', icon: BookOpen },
        { id: 'images', label: 'Images', href: '/portal/admin/images', icon: ImageIcon },
        { id: 'operations-admin', label: 'Operations', href: '/portal/admin/operations', icon: Shield },
        { id: 'notifications', label: 'Notifications', href: '/portal/settings/notifications', icon: Bell },
      ],
    },
    { id: 'training', label: 'Training', href: '/portal/training', icon: BookOpen },
    { id: 'phone', label: 'Phone System', href: '/phone-portal.html', icon: Phone },
  ];

  const salesItems: PortalNavItem[] = [
    ...shared,
    { id: 'sales', label: 'Sales Dashboard', href: '/portal/sales', icon: Target },
    { id: 'leads', label: 'My Leads', href: '/portal/sales/leads', icon: Users },
    { id: 'performance', label: 'Performance', href: '/portal/sales/performance', icon: TrendingUp },
    { id: 'new-lead', label: 'New Lead', href: '/portal/leads/new', icon: Plus },
    { id: 'schedule', label: 'Schedule', href: '/portal/schedule', icon: Calendar },
    { id: 'phone', label: 'Phone', href: '/phone-portal.html', icon: Phone },
    { id: 'lead-settings', label: 'Lead Preferences', href: '/portal/sales/settings', icon: Settings },
    { id: 'notifications', label: 'Notifications', href: '/portal/settings/notifications', icon: Bell },
  ];

  const officeItems: PortalNavItem[] = [
    ...shared,
    { id: 'new-lead-wizard', label: 'New Lead Wizard', href: '/portal/office/new-lead', icon: Zap },
    { id: 'office', label: 'Operations', href: '/portal/office', icon: ClipboardList },
    { id: 'billing', label: 'Finance', href: '/portal/billing', icon: DollarSign },
    { id: 'inventory', label: 'Materials', href: '/portal/inventory', icon: Box },
    { id: 'phone', label: 'Phone', href: '/phone-portal.html', icon: Phone },
    { id: 'schedule', label: 'Schedule', href: '/portal/schedule', icon: Calendar },
    { id: 'reports', label: 'Reports', href: '/portal/reports', icon: BarChart3 },
    { id: 'new-lead', label: 'Quick Lead Entry', href: '/portal/leads/new', icon: Plus },
  ];

  const pmItems: PortalNavItem[] = [
    ...shared,
    { id: 'pm', label: 'Create Orders', href: '/portal/pm', icon: Package },
    { id: 'schedule', label: 'Schedule', href: '/portal/schedule', icon: Calendar },
    { id: 'new-lead', label: 'New Lead', href: '/portal/leads/new', icon: Plus },
  ];

  const driverItems: PortalNavItem[] = [
    ...shared,
    { id: 'driver', label: 'My Deliveries', href: '/portal/driver', icon: Truck },
  ];

  const viewerItems: PortalNavItem[] = [
    ...shared,
    { id: 'office', label: 'View Orders', href: '/portal/office', icon: Eye },
    { id: 'reports', label: 'Reports', href: '/portal/reports', icon: BarChart3 },
  ];

  switch (role) {
    case 'owner':
    case 'admin':
      return adminItems;
    case 'manager':
      return [
        ...adminItems,
        { id: 'lead-controls', label: 'Rep Lead Controls', href: '/portal/manager/lead-controls', icon: Users },
      ];
    case 'sales':
      return salesItems;
    case 'office':
      return officeItems;
    case 'project_manager':
      return pmItems;
    case 'driver':
      return driverItems;
    case 'viewer':
      return viewerItems;
    default:
      return shared;
  }
}

// Role labels
const ROLE_LABELS: Record<TeamRole, { label: string; color: string }> = {
  owner: { label: 'Owner', color: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black' },
  admin: { label: 'Admin', color: 'bg-gradient-to-r from-red-500 to-rose-500 text-white' },
  manager: { label: 'Manager', color: 'bg-gradient-to-r from-orange-500 to-amber-500 text-white' },
  sales: { label: 'Sales', color: 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' },
  office: { label: 'Office', color: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white' },
  project_manager: { label: 'PM', color: 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white' },
  driver: { label: 'Driver', color: 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white' },
  viewer: { label: 'Viewer', color: 'bg-gradient-to-r from-neutral-500 to-neutral-600 text-white' },
};

// =============================================================================
// SIDEBAR NAV ITEM
// =============================================================================

function NavItemComponent({
  item,
  isCollapsed,
  currentPath,
  level = 0,
  onNavigate,
}: {
  item: PortalNavItem;
  isCollapsed: boolean;
  currentPath: string;
  level?: number;
  onNavigate?: () => void;
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const Icon = item.icon;
  const hasChildren = item.children && item.children.length > 0;
  const isActive = currentPath === item.href;
  const isChildActive = hasChildren
    ? item.children!.some(c => currentPath === c.href || currentPath.startsWith(c.href + '/'))
    : false;

  React.useEffect(() => {
    if (isChildActive && !isExpanded) setIsExpanded(true);
  }, [isChildActive]);

  const baseClasses = `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
    level > 0 ? 'ml-6 text-xs' : ''
  } ${
    isActive || isChildActive
      ? 'bg-brand-green/15 text-brand-green'
      : 'text-neutral-400 hover:bg-white/5 hover:text-white'
  }`;

  if (hasChildren && !isCollapsed) {
    return (
      <div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`${baseClasses} w-full`}
        >
          <Icon size={level > 0 ? 16 : 20} className="shrink-0" />
          <span className="flex-1 text-left truncate">{item.label}</span>
          <ChevronRight
            size={16}
            className={`shrink-0 text-neutral-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
          />
        </button>
        {isExpanded && (
          <div className="mt-1 space-y-0.5">
            {item.children!.map(child => (
              <NavItemComponent
                key={child.id}
                item={child}
                isCollapsed={isCollapsed}
                currentPath={currentPath}
                level={level + 1}
                onNavigate={onNavigate}
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
      onClick={onNavigate}
      title={isCollapsed ? item.label : undefined}
    >
      <Icon size={level > 0 ? 16 : 20} className="shrink-0" />
      {!isCollapsed && <span className="flex-1 truncate">{item.label}</span>}
    </Link>
  );
}

// =============================================================================
// PORTAL SHELL
// =============================================================================

export function PortalShell({ children }: { children: React.ReactNode }) {
  const { user, logout, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  // Close mobile menu on route change
  React.useEffect(() => { setIsMobileOpen(false); }, [pathname]);

  // Prevent scroll when mobile menu open
  React.useEffect(() => {
    document.body.style.overflow = isMobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileOpen]);

  // Login page - no shell
  const isLoginPage = pathname === '/portal' || pathname === '/portal/login';
  if (isLoginPage) return <>{children}</>;

  // Loading
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-neutral-800 border-t-brand-green" />
          <p className="text-sm text-neutral-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-white">RoofStack</h1>
          <p className="mb-6 text-neutral-400">Please log in to continue.</p>
          <Link
            href="/portal"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-green px-6 py-3 font-semibold text-black transition-colors hover:bg-brand-green/90"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  const navItems = getPortalNav(user.role);
  const roleInfo = ROLE_LABELS[user.role];
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="flex min-h-screen bg-neutral-950">
      {/* Desktop Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-white/5 bg-neutral-900 transition-all duration-300 lg:flex ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-white/5 px-4">
          {!isCollapsed && (
            <Link href="/portal/dashboard" className="flex items-center gap-2">
              <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-br from-brand-green to-emerald-600 p-0.5">
                <div className="w-full h-full rounded-md bg-neutral-900 flex items-center justify-center">
                  <Image src="/logo-nobg.png" alt="RCRS" width={20} height={20} className="object-contain" />
                </div>
              </div>
              <span className="text-lg font-bold text-white truncate">RoofStack</span>
            </Link>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-white/5 hover:text-white ${isCollapsed ? 'mx-auto' : ''}`}
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map(item => (
            <NavItemComponent key={item.id} item={item} isCollapsed={isCollapsed} currentPath={pathname} />
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/5 p-4">
          {!isCollapsed ? (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-sm font-semibold text-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{user.name}</p>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleInfo.color}`}>
                  {roleInfo.label}
                </span>
              </div>
              <button onClick={logout} className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:text-red-400" title="Sign out">
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button onClick={logout} className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg text-neutral-400 hover:text-red-400" title="Sign out">
              <LogOut size={20} />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 transform bg-neutral-900 shadow-xl transition-transform duration-300 lg:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/5 px-4">
          <Link href="/portal/dashboard" className="flex items-center gap-2" onClick={() => setIsMobileOpen(false)}>
            <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-br from-brand-green to-emerald-600 p-0.5">
              <div className="w-full h-full rounded-md bg-neutral-900 flex items-center justify-center">
                <Image src="/logo-nobg.png" alt="RCRS" width={20} height={20} className="object-contain" />
              </div>
            </div>
            <span className="text-lg font-bold text-white">RoofStack</span>
          </Link>
          <button onClick={() => setIsMobileOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Mobile user info */}
        <div className="border-b border-white/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-800 text-sm font-semibold text-white">{initials}</div>
            <div>
              <p className="font-medium text-white">{user.name}</p>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleInfo.color}`}>{roleInfo.label}</span>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map(item => (
            <NavItemComponent key={item.id} item={item} isCollapsed={false} currentPath={pathname} onNavigate={() => setIsMobileOpen(false)} />
          ))}
        </nav>

        {/* Mobile footer */}
        <div className="border-t border-white/5 p-4 flex gap-2">
          <Link href="/" onClick={() => setIsMobileOpen(false)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm text-neutral-300 hover:bg-white/10">
            <Home size={18} /> View Site
          </Link>
          <button onClick={() => { setIsMobileOpen(false); logout(); }} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/20">
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex min-h-screen flex-1 flex-col transition-all duration-300 ${isCollapsed ? 'lg:pl-16' : 'lg:pl-64'}`}>
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-white/5 bg-neutral-900/95 backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between px-4 lg:px-6">
            <button onClick={() => setIsMobileOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-400 hover:text-white lg:hidden">
              <Menu size={24} />
            </button>
            <div className="hidden lg:block">
              <h1 className="text-lg font-semibold text-white">{getPageTitle(pathname)}</h1>
            </div>
            {/* Mobile logo */}
            <Link href="/portal/dashboard" className="flex items-center gap-2 lg:hidden">
              <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-br from-brand-green to-emerald-600 p-0.5">
                <div className="w-full h-full rounded-md bg-neutral-900 flex items-center justify-center">
                  <Image src="/logo-nobg.png" alt="RCRS" width={20} height={20} className="object-contain" />
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/" target="_blank" className="hidden sm:flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-neutral-300 hover:bg-white/10">
                <Home size={16} /> View Site
              </Link>
              <div className="hidden lg:flex items-center gap-3 rounded-lg bg-white/5 px-3 py-1.5">
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{user.name}</p>
                  <span className={`inline-block px-1.5 py-0 rounded-full text-[10px] font-medium ${roleInfo.color}`}>{roleInfo.label}</span>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-700 text-sm font-semibold text-white">{initials}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-x-auto min-w-0">{children}</main>
      </div>
    </div>
  );
}

function getPageTitle(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'portal') segments.shift();
  if (segments.length === 0) return 'Portal';

  const titles: Record<string, string> = {
    dashboard: 'Dashboard',
    admin: 'Admin',
    billing: 'Finance',
    chat: 'Chat',
    customers: 'Customer Portals',
    delivery: 'Delivery',
    directory: 'Directory',
    documents: 'Documents',
    driver: 'My Deliveries',
    inventory: 'Materials',
    leads: 'Leads',
    locations: 'Locations',
    manager: 'Manager',
    'monday-notes': 'Monday Notes',
    'my-profile': 'My Profile',
    office: 'Operations',
    orders: 'Orders',
    pm: 'Logistics',
    reports: 'Reports',
    sales: 'Sales',
    schedule: 'Schedule',
    settings: 'Settings',
    tasks: 'Tasks',
    training: 'Training',
    transactions: 'Transactions',
  };

  return segments
    .map(s => titles[s] || s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' '))
    .join(' › ');
}
