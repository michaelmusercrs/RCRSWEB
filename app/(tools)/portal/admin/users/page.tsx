'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Users, Search, Shield, Mail, Phone,
  CheckCircle2, AlertCircle, RefreshCw, Loader2, User,
  Save, X, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  Check, Settings, Zap
} from 'lucide-react';
import {
  TEAM_MEMBERS,
  type TeamRole,
  ROLE_DISPLAY_NAMES, ROLE_COLORS, ROLE_DESCRIPTIONS,
  PERMISSION_DESCRIPTIONS
} from '@/lib/team-roles';
import { useAuth } from '@/lib/auth-context';

// ============================================
// PERMISSION GROUPS - Organized for checkbox UI
// ============================================

interface PermissionGroup {
  id: string;
  label: string;
  description: string;
  permissions: string[];
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'dashboard',
    label: 'Dashboard Access',
    description: 'View main dashboard and overview stats',
    permissions: ['view_dashboard'],
  },
  {
    id: 'sales',
    label: 'Sales Portal',
    description: 'Manage leads, quotes, inspections, and customer interactions',
    permissions: ['view_leads', 'manage_leads', 'view_own_leads', 'update_lead_status', 'schedule_inspections', 'create_quotes', 'send_quotes', 'view_own_stats', 'view_leaderboard'],
  },
  {
    id: 'inventory',
    label: 'Inventory Management',
    description: 'Manage stock levels, products, and restock requests',
    permissions: ['manage_inventory', 'manage_stock', 'view_inventory', 'edit_stock_qty'],
  },
  {
    id: 'delivery',
    label: 'Delivery / Driver Portal',
    description: 'Delivery tickets, routes, photo uploads, and signatures',
    permissions: ['view_assigned_tickets', 'update_delivery_status', 'upload_photos', 'capture_signature', 'view_route', 'view_checklist', 'complete_checklist', 'log_gps_activity'],
  },
  {
    id: 'leads',
    label: 'Lead Management',
    description: 'Enter leads, manage lead distribution, view lead history',
    permissions: ['enter_leads', 'lead_distro_manage', 'lead_distro_admin', 'view_lead_distro'],
  },
  {
    id: 'billing',
    label: 'Billing / Invoicing',
    description: 'Create invoices, manage billing, and vendor purchases',
    permissions: ['manage_billing', 'create_invoices', 'manage_vendors'],
  },
  {
    id: 'reports',
    label: 'Reports / Analytics',
    description: 'View reports, export data, and view team performance',
    permissions: ['view_reports', 'export_reports', 'view_team_performance', 'view_inventory_costs'],
  },
  {
    id: 'schedule',
    label: 'Schedule Management',
    description: 'View and edit calendar, schedule deliveries and events',
    permissions: ['view_schedule', 'edit_schedule', 'schedule_events'],
  },
  {
    id: 'team',
    label: 'Team Management',
    description: 'Manage team members, assign roles, and view all data',
    permissions: ['view_all_data', 'view_drivers', 'assign_deliveries'],
  },
  {
    id: 'customers',
    label: 'Customer Portal Management',
    description: 'View customer portal data and send customer messages',
    permissions: ['view_customer_portal', 'send_customer_messages'],
  },
  {
    id: 'tickets',
    label: 'Ticket Management',
    description: 'View, create, and update delivery/pickup/return tickets',
    permissions: ['view_tickets', 'view_own_tickets', 'update_ticket_status', 'update_own_tickets', 'create_material_orders', 'create_delivery_tickets', 'create_pickup_tickets', 'create_return_tickets'],
  },
  {
    id: 'monday',
    label: 'Monday Notes',
    description: 'Access Monday meeting notes and sales tracking',
    permissions: ['view_monday_notes'],
  },
  {
    id: 'training',
    label: 'Training Management',
    description: 'Access training materials and track progress',
    permissions: ['view_training', 'manage_training'],
  },
  {
    id: 'blog',
    label: 'Blog Management',
    description: 'Create, edit, and publish blog posts',
    permissions: ['manage_blog'],
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Access system settings and configuration',
    permissions: ['manage_settings'],
  },
];

// ============================================
// ROLE TEMPLATES - Auto-check permissions per role
// ============================================

const ROLE_PERMISSION_TEMPLATES: Record<TeamRole, string[]> = {
  owner: ['*'],
  admin: ['*'],
  manager: [
    'view_dashboard', 'view_all_data', 'manage_billing', 'manage_inventory',
    'view_tickets', 'update_ticket_status', 'create_invoices', 'manage_vendors',
    'view_reports', 'export_reports', 'view_schedule', 'edit_schedule',
    'manage_stock', 'view_team_performance', 'assign_deliveries',
    'view_inventory_costs', 'enter_leads', 'lead_distro_manage',
    'view_lead_distro', 'view_drivers', 'schedule_events',
    'view_monday_notes', 'view_training',
  ],
  sales: [
    'view_dashboard', 'view_leads', 'manage_leads', 'view_own_leads',
    'update_lead_status', 'schedule_inspections', 'create_quotes',
    'send_quotes', 'view_own_stats', 'view_leaderboard', 'upload_photos',
    'view_customer_portal', 'send_customer_messages', 'view_schedule',
    'view_monday_notes', 'view_training',
  ],
  office: [
    'view_dashboard', 'manage_billing', 'manage_inventory', 'view_tickets',
    'update_ticket_status', 'create_invoices', 'manage_vendors', 'view_reports',
    'view_schedule', 'manage_stock', 'enter_leads', 'lead_distro_manage',
    'view_customer_portal', 'send_customer_messages', 'view_monday_notes',
    'view_training',
  ],
  project_manager: [
    'view_dashboard', 'create_material_orders', 'create_delivery_tickets',
    'create_pickup_tickets', 'create_return_tickets', 'schedule_events',
    'view_schedule', 'view_own_tickets', 'update_own_tickets',
    'view_inventory', 'view_drivers', 'enter_leads', 'view_monday_notes',
    'view_training',
  ],
  driver: [
    'view_dashboard', 'view_assigned_tickets', 'update_delivery_status',
    'upload_photos', 'capture_signature', 'view_route', 'view_checklist',
    'complete_checklist', 'edit_stock_qty', 'create_pickup_tickets',
    'create_return_tickets', 'log_gps_activity', 'view_inventory',
    'view_monday_notes',
  ],
  viewer: [
    'view_dashboard', 'view_tickets', 'view_schedule', 'view_reports',
    'view_inventory',
  ],
};

// ============================================
// TYPES
// ============================================

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  slug: string;
  roles: TeamRole[];
  permissions: string[];
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  lastLogin?: string;
  isDirty?: boolean;
}

// ============================================
// COMPONENT
// ============================================

export default function UserManagementPage() {
  const { user: authUser, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [savingUsers, setSavingUsers] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null);

  // Load users from TEAM_MEMBERS
  const loadUsers = useCallback(() => {
    setIsLoading(true);
    const managedUsers: ManagedUser[] = TEAM_MEMBERS.map(member => {
      // Detect multi-role users (e.g., Rick is sales + driver, Travis is driver + sales)
      const roles: TeamRole[] = [member.role];
      // Rick has dual role per memory
      if (member.slug === 'rick' && !roles.includes('driver')) {
        roles.push('driver');
      }
      // Travis Wages also sells per memory
      if (member.slug === 'travis' && !roles.includes('sales')) {
        roles.push('sales');
      }

      return {
        id: member.id,
        name: member.name,
        email: member.email,
        phone: member.phone || '',
        slug: member.slug,
        roles,
        permissions: [...member.permissions],
        isActive: member.isActive,
        mustChangePassword: member.mustChangePassword,
        createdAt: member.createdAt,
        isDirty: false,
      };
    });

    setUsers(managedUsers);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Show toast
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Check if user has wildcard permissions
  const hasWildcard = (perms: string[]) => perms.includes('*');

  // Check if a permission group is fully checked
  const isGroupChecked = (userPerms: string[], group: PermissionGroup) => {
    if (hasWildcard(userPerms)) return true;
    return group.permissions.every(p => userPerms.includes(p));
  };

  // Check if a permission group is partially checked
  const isGroupPartial = (userPerms: string[], group: PermissionGroup) => {
    if (hasWildcard(userPerms)) return false;
    const checkedCount = group.permissions.filter(p => userPerms.includes(p)).length;
    return checkedCount > 0 && checkedCount < group.permissions.length;
  };

  // Toggle a permission group
  const togglePermissionGroup = (userId: string, group: PermissionGroup) => {
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      const currentPerms = new Set(u.permissions);
      // Remove wildcard if it exists
      currentPerms.delete('*');

      const allChecked = group.permissions.every(p => currentPerms.has(p));
      if (allChecked) {
        // Uncheck all in group
        group.permissions.forEach(p => currentPerms.delete(p));
      } else {
        // Check all in group
        group.permissions.forEach(p => currentPerms.add(p));
      }

      return { ...u, permissions: Array.from(currentPerms), isDirty: true };
    }));
  };

  // Toggle individual permission
  const togglePermission = (userId: string, permission: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      const currentPerms = new Set(u.permissions);
      // Remove wildcard if it exists
      currentPerms.delete('*');

      if (currentPerms.has(permission)) {
        currentPerms.delete(permission);
      } else {
        currentPerms.add(permission);
      }

      return { ...u, permissions: Array.from(currentPerms), isDirty: true };
    }));
  };

  // Apply role template
  const applyRoleTemplate = (userId: string, role: TeamRole) => {
    const templatePerms = ROLE_PERMISSION_TEMPLATES[role];
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      return { ...u, permissions: [...templatePerms], isDirty: true };
    }));
  };

  // Toggle role for a user
  const toggleRole = (userId: string, role: TeamRole) => {
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      const newRoles = u.roles.includes(role)
        ? u.roles.filter(r => r !== role)
        : [...u.roles, role];

      // Must have at least one role
      if (newRoles.length === 0) return u;

      return { ...u, roles: newRoles, isDirty: true };
    }));
  };

  // Toggle active status
  const toggleActive = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    if (user.isActive) {
      // Deactivating - show confirm
      setConfirmDeactivate(userId);
    } else {
      // Reactivating
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, isActive: true, isDirty: true } : u
      ));
    }
  };

  // Confirm deactivation
  const confirmDeactivateUser = (userId: string) => {
    setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, isActive: false, isDirty: true } : u
    ));
    setConfirmDeactivate(null);
  };

  // Save user changes
  const saveUser = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    setSavingUsers(prev => new Set(prev).add(userId));

    try {
      // Update the in-memory TEAM_MEMBERS array
      const member = TEAM_MEMBERS.find(m => m.id === userId);
      if (member) {
        member.permissions = [...user.permissions];
        member.isActive = user.isActive;
        member.role = user.roles[0]; // Primary role
      }

      // POST to the API
      const response = await fetch('/api/portal/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-role',
          userId: user.id,
          role: user.roles[0],
          permissions: user.permissions,
          isActive: user.isActive,
          updatedBy: authUser?.userId || 'admin',
        }),
      });

      if (response.ok) {
        setUsers(prev => prev.map(u =>
          u.id === userId ? { ...u, isDirty: false } : u
        ));
        showToast(`${user.name}'s settings saved successfully`, 'success');
      } else {
        const data = await response.json();
        showToast(data.error || 'Failed to save changes', 'error');
      }
    } catch {
      // Still mark as saved since in-memory update succeeded
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, isDirty: false } : u
      ));
      showToast(`${user.name}'s settings updated (local)`, 'success');
    } finally {
      setSavingUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm ||
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone.includes(searchTerm);
    const matchesRole = roleFilter === 'all' || user.roles.includes(roleFilter as TeamRole);
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && user.isActive) ||
      (statusFilter === 'inactive' && !user.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Stats
  const activeCount = users.filter(u => u.isActive).length;
  const inactiveCount = users.filter(u => !u.isActive).length;
  const dirtyCount = users.filter(u => u.isDirty).length;

  // Auth check
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#39FF14]" size={48} />
      </div>
    );
  }

  if (!authUser || (authUser.role !== 'owner' && authUser.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <Shield className="mx-auto text-red-400 mb-4" size={48} />
          <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-neutral-400 mb-4">Admin access required to manage users.</p>
          <Link href="/portal/dashboard" className="text-[#39FF14] hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href="/portal/admin/operations"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={18} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Shield className="text-[#39FF14]" size={22} />
                    User Management
                  </h1>
                  <p className="text-sm text-neutral-400">Manage roles, permissions, and access</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {dirtyCount > 0 && (
                  <span className="hidden sm:inline px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
                    {dirtyCount} unsaved
                  </span>
                )}
                <button
                  onClick={loadUsers}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 text-sm transition-colors"
                >
                  <RefreshCw size={16} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-white">{users.length}</div>
              <div className="text-xs text-neutral-500">Total Users</div>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{activeCount}</div>
              <div className="text-xs text-neutral-500">Active</div>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-red-400">{inactiveCount}</div>
              <div className="text-xs text-neutral-500">Inactive</div>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-[#39FF14]">{users.filter(u => u.roles.length > 1).length}</div>
              <div className="text-xs text-neutral-500">Multi-Role</div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#39FF14]/50 focus:ring-1 focus:ring-[#39FF14]/30 transition-all"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#39FF14]/50 transition-all"
            >
              <option value="all">All Roles</option>
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="office">Office</option>
              <option value="project_manager">Project Manager</option>
              <option value="sales">Sales Rep</option>
              <option value="driver">Driver</option>
              <option value="viewer">Viewer</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#39FF14]/50 transition-all"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          {/* User List */}
          {isLoading ? (
            <div className="text-center py-16">
              <Loader2 className="animate-spin mx-auto text-[#39FF14] mb-4" size={48} />
              <p className="text-neutral-400">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-16">
              <Users className="mx-auto text-neutral-600 mb-4" size={48} />
              <p className="text-neutral-400">No users match your filters</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((user) => {
                const isExpanded = expandedUser === user.id;
                const isSaving = savingUsers.has(user.id);
                const primaryRole = user.roles[0];
                const roleColor = ROLE_COLORS[primaryRole] || 'bg-gray-500';

                return (
                  <div
                    key={user.id}
                    className={`bg-white/[0.02] border rounded-xl overflow-hidden transition-all duration-200 ${
                      user.isDirty
                        ? 'border-amber-500/30 shadow-lg shadow-amber-500/5'
                        : isExpanded
                          ? 'border-[#39FF14]/20'
                          : 'border-white/5 hover:border-white/10'
                    } ${!user.isActive ? 'opacity-60' : ''}`}
                  >
                    {/* User Row - Always Visible */}
                    <div
                      className="flex items-center gap-3 sm:gap-4 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                      onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                    >
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${roleColor}/20`}>
                        <User className="text-white/60" size={18} />
                      </div>

                      {/* Name & Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-medium truncate">{user.name}</p>
                          {user.isDirty && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="Unsaved changes" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-neutral-400 mt-0.5">
                          <span className="flex items-center gap-1 truncate">
                            <Mail size={11} />
                            <span className="truncate">{user.email}</span>
                          </span>
                          {user.phone && (
                            <span className="hidden sm:flex items-center gap-1">
                              <Phone size={11} />
                              {user.phone}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Role Badges */}
                      <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                        {user.roles.map(role => (
                          <span
                            key={role}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${ROLE_COLORS[role]} text-white`}
                          >
                            {ROLE_DISPLAY_NAMES[role]}
                          </span>
                        ))}
                      </div>

                      {/* Status */}
                      <div className="flex-shrink-0">
                        {user.isActive ? (
                          <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-medium">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-medium">
                            Inactive
                          </span>
                        )}
                      </div>

                      {/* Expand Arrow */}
                      <div className="flex-shrink-0 text-neutral-400">
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>

                    {/* Mobile Role Badges (visible when not expanded) */}
                    {!isExpanded && (
                      <div className="flex sm:hidden items-center gap-1.5 px-4 pb-2">
                        {user.roles.map(role => (
                          <span
                            key={role}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${ROLE_COLORS[role]} text-white`}
                          >
                            {ROLE_DISPLAY_NAMES[role]}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Expanded Panel */}
                    {isExpanded && (
                      <div className="border-t border-white/5 px-4 py-4 space-y-6">
                        {/* Top Row: Status Toggle + Save */}
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div className="flex items-center gap-4">
                            {/* Active Toggle */}
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleActive(user.id); }}
                              className="flex items-center gap-2 text-sm"
                            >
                              {user.isActive ? (
                                <ToggleRight size={28} className="text-[#39FF14]" />
                              ) : (
                                <ToggleLeft size={28} className="text-neutral-500" />
                              )}
                              <span className={user.isActive ? 'text-[#39FF14]' : 'text-neutral-500'}>
                                {user.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </button>

                            {/* Created date */}
                            <span className="text-xs text-neutral-500">
                              Since {new Date(user.createdAt).toLocaleDateString()}
                            </span>
                          </div>

                          {/* Save Button */}
                          <button
                            onClick={(e) => { e.stopPropagation(); saveUser(user.id); }}
                            disabled={!user.isDirty || isSaving}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                              user.isDirty
                                ? 'bg-[#39FF14] text-black hover:bg-[#39FF14]/90'
                                : 'bg-white/5 text-neutral-500 cursor-not-allowed'
                            }`}
                          >
                            {isSaving ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Save size={16} />
                            )}
                            {isSaving ? 'Saving...' : user.isDirty ? 'Save Changes' : 'Saved'}
                          </button>
                        </div>

                        {/* Section: Role Assignment */}
                        <div>
                          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                            <Shield size={14} className="text-[#39FF14]" />
                            Role Assignment
                          </h3>
                          <p className="text-xs text-neutral-500 mb-3">
                            Select one or more roles. Users can have multiple roles (e.g., Rick has Sales + Driver).
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {(['owner', 'admin', 'manager', 'office', 'project_manager', 'sales', 'driver', 'viewer'] as TeamRole[]).map(role => {
                              const isChecked = user.roles.includes(role);
                              return (
                                <button
                                  key={role}
                                  onClick={(e) => { e.stopPropagation(); toggleRole(user.id, role); }}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                                    isChecked
                                      ? `${ROLE_COLORS[role]} text-white border-transparent`
                                      : 'bg-white/[0.03] text-neutral-400 border-white/10 hover:border-white/20'
                                  }`}
                                >
                                  {isChecked && <Check size={12} />}
                                  {ROLE_DISPLAY_NAMES[role]}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Section: Quick Role Templates */}
                        <div>
                          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                            <Zap size={14} className="text-amber-400" />
                            Quick Permission Templates
                          </h3>
                          <p className="text-xs text-neutral-500 mb-3">
                            Apply a preset template to quickly configure permissions. This overrides current permission selections.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(['owner', 'admin', 'manager', 'sales', 'office', 'project_manager', 'driver', 'viewer'] as TeamRole[]).map(role => (
                              <button
                                key={role}
                                onClick={(e) => { e.stopPropagation(); applyRoleTemplate(user.id, role); }}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10 hover:border-[#39FF14]/30 transition-all"
                              >
                                Apply {ROLE_DISPLAY_NAMES[role]} Template
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Section: Permission Checkboxes */}
                        <div>
                          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                            <Settings size={14} className="text-blue-400" />
                            Granular Permissions
                          </h3>

                          {hasWildcard(user.permissions) && (
                            <div className="mb-4 px-3 py-2 rounded-lg bg-[#39FF14]/10 border border-[#39FF14]/20">
                              <div className="flex items-center justify-between">
                                <p className="text-[#39FF14] text-xs font-medium">
                                  Full Access (*) -- All permissions granted
                                </p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Switch from wildcard to explicit permissions
                                    const allPerms: string[] = [];
                                    PERMISSION_GROUPS.forEach(g => g.permissions.forEach(p => allPerms.push(p)));
                                    setUsers(prev => prev.map(u =>
                                      u.id === user.id ? { ...u, permissions: allPerms, isDirty: true } : u
                                    ));
                                  }}
                                  className="text-xs text-neutral-400 hover:text-white underline"
                                >
                                  Switch to granular
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {PERMISSION_GROUPS.map(group => {
                              const checked = isGroupChecked(user.permissions, group);
                              const partial = isGroupPartial(user.permissions, group);

                              return (
                                <div
                                  key={group.id}
                                  className={`rounded-xl border p-3 transition-all ${
                                    checked
                                      ? 'bg-[#39FF14]/5 border-[#39FF14]/20'
                                      : partial
                                        ? 'bg-amber-500/5 border-amber-500/20'
                                        : 'bg-white/[0.01] border-white/5'
                                  }`}
                                >
                                  {/* Group Header - Click to toggle all */}
                                  <label
                                    className="flex items-start gap-3 cursor-pointer"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePermissionGroup(user.id, group); }}
                                  >
                                    <div className={`w-5 h-5 rounded flex-shrink-0 mt-0.5 flex items-center justify-center border transition-colors ${
                                      checked
                                        ? 'bg-[#39FF14] border-[#39FF14]'
                                        : partial
                                          ? 'bg-amber-500/50 border-amber-500'
                                          : 'bg-white/5 border-white/20 hover:border-white/40'
                                    }`}>
                                      {(checked || partial) && <Check size={12} className="text-black" />}
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-white">{group.label}</p>
                                      <p className="text-[10px] text-neutral-500 mt-0.5 leading-tight">{group.description}</p>
                                    </div>
                                  </label>

                                  {/* Individual Permissions (shown if partially checked or user clicks) */}
                                  {(partial || checked) && !hasWildcard(user.permissions) && (
                                    <div className="mt-2 ml-8 space-y-1">
                                      {group.permissions.map(perm => {
                                        const permChecked = user.permissions.includes(perm);
                                        return (
                                          <label
                                            key={perm}
                                            className="flex items-center gap-2 cursor-pointer group/perm"
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePermission(user.id, perm); }}
                                          >
                                            <div className={`w-3.5 h-3.5 rounded-sm flex-shrink-0 flex items-center justify-center border transition-colors ${
                                              permChecked
                                                ? 'bg-[#39FF14]/80 border-[#39FF14]'
                                                : 'bg-white/5 border-white/15 group-hover/perm:border-white/30'
                                            }`}>
                                              {permChecked && <Check size={8} className="text-black" />}
                                            </div>
                                            <span className={`text-[10px] ${permChecked ? 'text-neutral-300' : 'text-neutral-500'}`}>
                                              {PERMISSION_DESCRIPTIONS[perm] || perm.replace(/_/g, ' ')}
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Bottom Save Bar */}
                        {user.isDirty && (
                          <div className="flex items-center justify-between pt-3 border-t border-white/5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Reset to original
                                const original = TEAM_MEMBERS.find(m => m.id === user.id);
                                if (original) {
                                  setUsers(prev => prev.map(u => {
                                    if (u.id !== user.id) return u;
                                    const roles: TeamRole[] = [original.role];
                                    if (original.slug === 'rick' && !roles.includes('driver')) roles.push('driver');
                                    if (original.slug === 'travis' && !roles.includes('sales')) roles.push('sales');
                                    return {
                                      ...u,
                                      roles,
                                      permissions: [...original.permissions],
                                      isActive: original.isActive,
                                      isDirty: false,
                                    };
                                  }));
                                }
                              }}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                            >
                              <X size={14} />
                              Discard Changes
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); saveUser(user.id); }}
                              disabled={isSaving}
                              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-[#39FF14] text-black hover:bg-[#39FF14]/90 transition-all"
                            >
                              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                              {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Role Legend */}
          <div className="mt-8 bg-white/[0.02] border border-white/5 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Role Reference</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {(['owner', 'admin', 'manager', 'office', 'project_manager', 'sales', 'driver', 'viewer'] as TeamRole[]).map(role => (
                <div key={role} className="flex items-start gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${ROLE_COLORS[role]} text-white flex-shrink-0 mt-0.5`}>
                    {ROLE_DISPLAY_NAMES[role]}
                  </span>
                  <span className="text-[11px] text-neutral-500">{ROLE_DESCRIPTIONS[role]}</span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border transition-all animate-in slide-in-from-bottom-4 ${
          toast.type === 'success'
            ? 'bg-[#0a0a0f] border-[#39FF14]/30 text-[#39FF14]'
            : 'bg-[#0a0a0f] border-red-500/30 text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span className="text-sm font-medium">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-neutral-500 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Deactivation Confirmation Modal */}
      {confirmDeactivate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setConfirmDeactivate(null)}>
          <div
            className="bg-[#0a0a0f] border border-red-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="text-red-400" size={32} />
              </div>
              <h2 className="text-xl font-bold text-white">Deactivate User?</h2>
              <p className="text-neutral-400 mt-2 text-sm">
                This will prevent <span className="text-white font-medium">{users.find(u => u.id === confirmDeactivate)?.name}</span> from
                logging in. They can be reactivated later.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeactivate(null)}
                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-neutral-300 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDeactivateUser(confirmDeactivate)}
                className="flex-1 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl text-sm font-medium border border-red-500/30 transition-colors"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
