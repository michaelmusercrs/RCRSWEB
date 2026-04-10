'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Users, Search, Shield, Key, Lock, Unlock, Save,
  Mail, Phone, CheckCircle2, AlertCircle, User, ChevronUp,
  ChevronDown, LayoutDashboard, Trophy, Hash, Package, Target,
  Calendar, FileText, Globe, PhoneCall, CreditCard, BarChart3,
  GraduationCap, UserCircle, UsersRound, MessageSquare, Truck,
  ShieldCheck, ClipboardCheck, Star, MapPin, Clock, ClipboardList,
  Bell, ToggleLeft, ToggleRight, Sparkles, RotateCcw, X, Eye, Loader2
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  TEAM_MEMBERS,
  type TeamMember,
  type TeamRole,
  ROLE_DISPLAY_NAMES,
  ROLE_COLORS,
  ROLE_DESCRIPTIONS,
} from '@/lib/team-roles';
import { ROLE_PERMISSIONS } from '@/lib/permissions';
// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

interface PortalSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  category: string;
}

interface UserConfig {
  userId: string;
  role: TeamRole;
  isActive: boolean;
  enabledSections: string[];
  sectionOrder: string[];
  leadDistribution: {
    enabled: boolean;
    status: 'receiving' | 'paused';
  };
  mondayNotes: {
    required: boolean;
  };
  permissionOverrides: Record<string, boolean>;
  security: {
    passwordChanged: boolean;
    lastLogin: string | null;
    isLocked: boolean;
  };
  updatedAt: string;
}

const ALL_PORTAL_SECTIONS: PortalSection[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} />, category: 'Core' },
  { id: 'sales-leaderboard', label: 'Sales Leaderboard', icon: <Trophy size={16} />, category: 'Sales' },
  { id: 'weekly-numbers', label: 'Weekly Numbers Entry', icon: <Hash size={16} />, category: 'Sales' },
  { id: 'inventory', label: 'Inventory', icon: <Package size={16} />, category: 'Operations' },
  { id: 'lead-management', label: 'Lead Management', icon: <Target size={16} />, category: 'Sales' },
  { id: 'calendar', label: 'Calendar / Schedule', icon: <Calendar size={16} />, category: 'Core' },
  { id: 'monday-notes', label: 'Monday Notes', icon: <FileText size={16} />, category: 'Core' },
  { id: 'customer-portal', label: 'Customer Portal', icon: <Globe size={16} />, category: 'Customer' },
  { id: 'phone-system', label: 'Phone System', icon: <PhoneCall size={16} />, category: 'Communication' },
  { id: 'billing', label: 'Billing / Invoicing', icon: <CreditCard size={16} />, category: 'Finance' },
  { id: 'reports', label: 'Reports', icon: <BarChart3 size={16} />, category: 'Analytics' },
  { id: 'training', label: 'Training', icon: <GraduationCap size={16} />, category: 'Core' },
  { id: 'my-profile', label: 'My Profile', icon: <UserCircle size={16} />, category: 'Core' },
  { id: 'team-directory', label: 'Team Directory', icon: <UsersRound size={16} />, category: 'Team' },
  { id: 'chat', label: 'Chat / Messages', icon: <MessageSquare size={16} />, category: 'Communication' },
  { id: 'delivery-tracking', label: 'Delivery Tracking', icon: <Truck size={16} />, category: 'Operations' },
  { id: 'warranties', label: 'Warranties', icon: <ShieldCheck size={16} />, category: 'Customer' },
  { id: 'inspections', label: 'Inspections', icon: <ClipboardCheck size={16} />, category: 'Operations' },
  { id: 'reviews', label: 'Reviews', icon: <Star size={16} />, category: 'Customer' },
  { id: 'gps-routes', label: 'GPS Routes', icon: <MapPin size={16} />, category: 'Operations' },
  { id: 'time-tracking', label: 'Time Tracking', icon: <Clock size={16} />, category: 'Team' },
  { id: 'surveys', label: 'Surveys', icon: <ClipboardList size={16} />, category: 'Analytics' },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={16} />, category: 'Core' },
];

const SECTION_IDS = ALL_PORTAL_SECTIONS.map(s => s.id);

// Auto-reorder templates per role
const ROLE_SECTION_ORDER: Record<string, string[]> = {
  sales: [
    'weekly-numbers', 'sales-leaderboard', 'lead-management', 'dashboard', 'calendar',
    'monday-notes', 'my-profile', 'training', 'chat', 'customer-portal', 'phone-system',
    'inspections', 'reviews', 'notifications', 'team-directory', 'surveys',
    'delivery-tracking', 'gps-routes', 'time-tracking', 'inventory', 'billing',
    'reports', 'warranties',
  ],
  admin: [
    'dashboard', 'billing', 'inventory', 'calendar', 'team-directory', 'reports',
    'customer-portal', 'lead-management', 'phone-system', 'sales-leaderboard',
    'weekly-numbers', 'monday-notes', 'chat', 'delivery-tracking', 'training',
    'inspections', 'warranties', 'reviews', 'time-tracking', 'surveys',
    'gps-routes', 'my-profile', 'notifications',
  ],
  office: [
    'dashboard', 'billing', 'inventory', 'calendar', 'team-directory', 'reports',
    'customer-portal', 'lead-management', 'phone-system', 'sales-leaderboard',
    'weekly-numbers', 'monday-notes', 'chat', 'delivery-tracking', 'training',
    'inspections', 'warranties', 'reviews', 'time-tracking', 'surveys',
    'gps-routes', 'my-profile', 'notifications',
  ],
  driver: [
    'dashboard', 'delivery-tracking', 'calendar', 'gps-routes', 'time-tracking',
    'inventory', 'inspections', 'chat', 'my-profile', 'notifications', 'training',
    'phone-system', 'monday-notes', 'team-directory', 'surveys', 'customer-portal',
    'reviews', 'warranties', 'sales-leaderboard', 'weekly-numbers', 'lead-management',
    'billing', 'reports',
  ],
  owner: [
    'dashboard', 'sales-leaderboard', 'reports', 'billing', 'inventory',
    'team-directory', 'lead-management', 'calendar', 'phone-system',
    'weekly-numbers', 'monday-notes', 'customer-portal', 'chat',
    'delivery-tracking', 'training', 'inspections', 'warranties', 'reviews',
    'time-tracking', 'surveys', 'gps-routes', 'my-profile', 'notifications',
  ],
  manager: [
    'dashboard', 'sales-leaderboard', 'reports', 'lead-management', 'calendar',
    'team-directory', 'inventory', 'billing', 'phone-system', 'weekly-numbers',
    'monday-notes', 'customer-portal', 'chat', 'delivery-tracking', 'training',
    'inspections', 'warranties', 'reviews', 'time-tracking', 'surveys',
    'gps-routes', 'my-profile', 'notifications',
  ],
  project_manager: [
    'dashboard', 'calendar', 'inventory', 'delivery-tracking', 'inspections',
    'gps-routes', 'time-tracking', 'team-directory', 'chat', 'phone-system',
    'my-profile', 'training', 'monday-notes', 'notifications', 'customer-portal',
    'reviews', 'warranties', 'surveys', 'sales-leaderboard', 'weekly-numbers',
    'lead-management', 'billing', 'reports',
  ],
  viewer: [
    'dashboard', 'reports', 'calendar', 'team-directory', 'my-profile',
    'notifications', 'training', 'chat', 'customer-portal', 'reviews',
    'monday-notes', 'phone-system', 'inventory', 'billing', 'sales-leaderboard',
    'weekly-numbers', 'lead-management', 'delivery-tracking', 'inspections',
    'warranties', 'gps-routes', 'time-tracking', 'surveys',
  ],
};

// Permission modules grouped for the overrides panel
const PERMISSION_MODULES: { module: string; label: string; permissions: { key: string; label: string }[] }[] = [
  {
    module: 'dashboard',
    label: 'Dashboard',
    permissions: [
      { key: 'dashboard.view', label: 'View Dashboard' },
      { key: 'dashboard.viewAll', label: 'View All Dashboard Data' },
    ],
  },
  {
    module: 'sales',
    label: 'Sales',
    permissions: [
      { key: 'sales.view', label: 'View Sales' },
      { key: 'sales.viewOwn', label: 'View Own Stats' },
      { key: 'sales.viewCommissions', label: 'View Commissions' },
    ],
  },
  {
    module: 'inventory',
    label: 'Inventory',
    permissions: [
      { key: 'inventory.view', label: 'View Inventory' },
      { key: 'inventory.viewCosts', label: 'View Costs' },
      { key: 'inventory.edit', label: 'Edit Inventory' },
      { key: 'inventory.delete', label: 'Delete Inventory' },
    ],
  },
  {
    module: 'marketing',
    label: 'Marketing',
    permissions: [
      { key: 'marketing.view', label: 'View Marketing' },
      { key: 'marketing.edit', label: 'Edit Marketing' },
    ],
  },
  {
    module: 'phone',
    label: 'Phone System',
    permissions: [
      { key: 'phone.view', label: 'View Phone' },
      { key: 'phone.viewAll', label: 'View All Calls' },
      { key: 'phone.manage', label: 'Manage Phone System' },
    ],
  },
  {
    module: 'team',
    label: 'Team',
    permissions: [
      { key: 'team.view', label: 'View Team' },
      { key: 'team.edit', label: 'Edit Team' },
    ],
  },
  {
    module: 'billing',
    label: 'Billing',
    permissions: [
      { key: 'billing.view', label: 'View Billing' },
      { key: 'billing.edit', label: 'Edit Billing' },
    ],
  },
  {
    module: 'schedule',
    label: 'Schedule',
    permissions: [
      { key: 'schedule.view', label: 'View Schedule' },
      { key: 'schedule.edit', label: 'Edit Schedule' },
    ],
  },
  {
    module: 'reports',
    label: 'Reports',
    permissions: [
      { key: 'reports.view', label: 'View Reports' },
      { key: 'reports.export', label: 'Export Reports' },
    ],
  },
];

const ALL_ROLES: TeamRole[] = ['owner', 'admin', 'manager', 'sales', 'office', 'project_manager', 'driver', 'viewer'];

// Map TeamRole lowercase to the Permission system's Role type
function toPermissionRole(role: TeamRole): string {
  const map: Record<TeamRole, string> = {
    owner: 'Owner', admin: 'Admin', manager: 'Manager', sales: 'Sales',
    office: 'Office', project_manager: 'Manager', driver: 'Driver', viewer: 'Driver',
  };
  return map[role] || 'Driver';
}

function getRoleDefaultPermissions(role: TeamRole): string[] {
  const permRole = toPermissionRole(role) as keyof typeof ROLE_PERMISSIONS;
  const perms = ROLE_PERMISSIONS[permRole];
  return perms ? [...perms] : [];
}

function getDefaultEnabledSections(role: TeamRole): string[] {
  // All roles get core sections; beyond that it depends on the role
  const coreSections = ['dashboard', 'my-profile', 'notifications', 'training', 'chat', 'calendar', 'monday-notes'];
  const roleSections: Record<string, string[]> = {
    owner: SECTION_IDS, // everything
    admin: SECTION_IDS,
    manager: [...coreSections, 'sales-leaderboard', 'weekly-numbers', 'inventory', 'lead-management', 'customer-portal', 'phone-system', 'billing', 'reports', 'team-directory', 'delivery-tracking', 'inspections', 'warranties', 'reviews', 'time-tracking', 'surveys', 'gps-routes'],
    sales: [...coreSections, 'sales-leaderboard', 'weekly-numbers', 'lead-management', 'customer-portal', 'phone-system', 'inspections', 'reviews', 'team-directory'],
    office: [...coreSections, 'billing', 'inventory', 'reports', 'customer-portal', 'phone-system', 'team-directory', 'delivery-tracking', 'lead-management'],
    project_manager: [...coreSections, 'inventory', 'delivery-tracking', 'inspections', 'gps-routes', 'time-tracking', 'team-directory', 'phone-system'],
    driver: [...coreSections, 'delivery-tracking', 'gps-routes', 'time-tracking', 'inventory', 'inspections'],
    viewer: [...coreSections, 'reports'],
  };
  return roleSections[role] || coreSections;
}

function buildDefaultConfig(member: TeamMember): UserConfig {
  const enabledSections = getDefaultEnabledSections(member.role);
  const orderTemplate = ROLE_SECTION_ORDER[member.role] || SECTION_IDS;
  return {
    userId: member.id,
    role: member.role,
    isActive: member.isActive,
    enabledSections,
    sectionOrder: orderTemplate,
    leadDistribution: {
      enabled: member.role === 'sales' || (member.role === 'owner' && member.slug !== 'admin'),
      status: 'receiving',
    },
    mondayNotes: {
      required: ['sales', 'owner', 'manager'].includes(member.role),
    },
    permissionOverrides: {},
    security: {
      passwordChanged: !member.mustChangePassword,
      lastLogin: null,
      isLocked: false,
    },
    updatedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOAST COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function Toast({ message, show, onClose }: { message: string; show: boolean; onClose: () => void }) {
  useEffect(() => {
    if (show) {
      const t = setTimeout(onClose, 3000);
      return () => clearTimeout(t);
    }
  }, [show, onClose]);

  if (!show) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-brand-green text-black px-5 py-3 rounded-xl shadow-lg shadow-brand-green/20 flex items-center gap-3 font-medium">
        <CheckCircle2 size={20} />
        {message}
        <button onClick={onClose} className="ml-2 hover:opacity-70"><X size={16} /></button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function UserProfileManagerPage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '' });
  const [expandedPermModules, setExpandedPermModules] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isImpersonating, setIsImpersonatingLocal] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const router = useRouter();
  const { user: currentUser } = useAuth();

  const selectedMember = TEAM_MEMBERS.find(m => m.id === selectedUserId) || null;

  // Check if current user can impersonate (owner or admin)
  const canImpersonate = currentUser?.role === 'owner' || currentUser?.role === 'admin';

  // Handle "View As" impersonation
  const handleViewAs = async (member: TeamMember) => {
    if (!canImpersonate) return;
    if (currentUser?.email.toLowerCase() === member.email.toLowerCase()) {
      setToast({ show: true, message: 'You cannot impersonate yourself.' });
      return;
    }

    setIsImpersonatingLocal(true);
    try {
      const res = await fetch('/api/portal/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail: member.email }),
      });
      const data = await res.json();
      if (data.success) {
        // Redirect to dashboard as the impersonated user
        window.location.href = '/portal/dashboard';
      } else {
        setToast({ show: true, message: data.error || 'Failed to start impersonation.' });
        setIsImpersonatingLocal(false);
      }
    } catch {
      setToast({ show: true, message: 'Network error. Could not start impersonation.' });
      setIsImpersonatingLocal(false);
    }
  };

  // Load config from localStorage or build defaults
  const loadConfig = useCallback((member: TeamMember) => {
    const stored = localStorage.getItem(`userConfig_${member.id}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as UserConfig;
        // Ensure any new sections are included
        const existingSections = new Set(parsed.sectionOrder);
        SECTION_IDS.forEach(s => { if (!existingSections.has(s)) parsed.sectionOrder.push(s); });
        setConfig(parsed);
      } catch {
        setConfig(buildDefaultConfig(member));
      }
    } else {
      setConfig(buildDefaultConfig(member));
    }
    setHasUnsavedChanges(false);
  }, []);

  useEffect(() => {
    if (selectedMember) {
      loadConfig(selectedMember);
    }
  }, [selectedMember, loadConfig]);

  // Load the team member's existing profile image (from team-members blob/file)
  // whenever the selected user changes. Falls back to null if none on record.
  useEffect(() => {
    if (!selectedMember?.slug) {
      setProfileImageUrl(null);
      setPhotoError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/team-members/${selectedMember.slug}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setProfileImageUrl(data?.member?.profileImage || null);
        setPhotoError(null);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load team member photo:', err);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [selectedMember]);

  // Upload a new profile photo. Validates client-side, posts to the
  // admin upload endpoint, then refreshes the displayed URL.
  const handlePhotoUpload = async (file: File) => {
    if (!selectedMember?.slug) return;
    setPhotoError(null);

    // Client-side validation (server validates again)
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(file.type)) {
      setPhotoError(`Unsupported file type: ${file.type}`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 5MB.`);
      return;
    }
    if (file.size === 0) {
      setPhotoError('File is empty');
      return;
    }

    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('slug', selectedMember.slug);
      formData.append('field', 'profileImage');

      const res = await fetch('/api/admin/team-photo-upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok && res.status !== 207) {
        throw new Error(data?.error || `Upload failed (${res.status})`);
      }

      // Even on partial-success (207), the URL is in the response and we
      // can show it. The user can re-save the form to retry the metadata write.
      if (data?.url) {
        setProfileImageUrl(data.url);
        setToast({
          show: true,
          message: res.status === 207
            ? 'Photo uploaded but team save failed — re-save to retry'
            : `Photo updated for ${selectedMember.name}`,
        });
      }
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setPhotoUploading(false);
    }
  };

  // Filtered members
  const filteredMembers = TEAM_MEMBERS.filter(m => {
    const matchSearch = !searchTerm ||
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = !roleFilter || m.role === roleFilter;
    return matchSearch && matchRole;
  });

  // Handlers
  const updateConfig = (partial: Partial<UserConfig>) => {
    if (!config) return;
    setConfig({ ...config, ...partial });
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    if (!config || !selectedUserId) return;
    const toSave = { ...config, updatedAt: new Date().toISOString() };
    localStorage.setItem(`userConfig_${selectedUserId}`, JSON.stringify(toSave));
    setConfig(toSave);
    setHasUnsavedChanges(false);
    setToast({ show: true, message: `Profile saved for ${selectedMember?.name}` });
  };

  const handleRoleChange = (newRole: TeamRole) => {
    if (!config) return;
    const enabledSections = getDefaultEnabledSections(newRole);
    const orderTemplate = ROLE_SECTION_ORDER[newRole] || SECTION_IDS;
    updateConfig({
      role: newRole,
      enabledSections,
      sectionOrder: orderTemplate,
      leadDistribution: {
        enabled: newRole === 'sales',
        status: 'receiving',
      },
      mondayNotes: {
        required: ['sales', 'owner', 'manager'].includes(newRole),
      },
      permissionOverrides: {},
    });
  };

  const toggleSection = (sectionId: string) => {
    if (!config) return;
    const enabled = new Set(config.enabledSections);
    if (enabled.has(sectionId)) {
      enabled.delete(sectionId);
    } else {
      enabled.add(sectionId);
    }
    updateConfig({ enabledSections: Array.from(enabled) });
  };

  const moveSection = (sectionId: string, direction: 'up' | 'down') => {
    if (!config) return;
    const order = [...config.sectionOrder];
    const idx = order.indexOf(sectionId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= order.length) return;
    [order[idx], order[swapIdx]] = [order[swapIdx], order[idx]];
    updateConfig({ sectionOrder: order });
  };

  const handleAutoReorder = () => {
    if (!config) return;
    const template = ROLE_SECTION_ORDER[config.role] || SECTION_IDS;
    updateConfig({ sectionOrder: [...template] });
  };

  const togglePermOverride = (permKey: string) => {
    if (!config) return;
    const overrides = { ...config.permissionOverrides };
    if (permKey in overrides) {
      delete overrides[permKey];
    } else {
      // Toggle: if user's role already grants it, override to OFF; else override to ON
      const rolePerms = getRoleDefaultPermissions(config.role);
      overrides[permKey] = !rolePerms.includes(permKey);
    }
    updateConfig({ permissionOverrides: overrides });
  };

  const getEffectivePermission = (permKey: string): boolean => {
    if (!config) return false;
    if (permKey in config.permissionOverrides) {
      return config.permissionOverrides[permKey];
    }
    return getRoleDefaultPermissions(config.role).includes(permKey);
  };

  const isPermOverridden = (permKey: string): boolean => {
    return config ? permKey in config.permissionOverrides : false;
  };

  const handleResetPassword = () => {
    if (!config) return;
    updateConfig({
      security: { ...config.security, passwordChanged: false },
    });
    setToast({ show: true, message: 'Password reset queued' });
  };

  const handleUnlockAccount = () => {
    if (!config) return;
    updateConfig({
      security: { ...config.security, isLocked: false },
    });
  };

  const handleResetToDefaults = () => {
    if (!selectedMember) return;
    setConfig(buildDefaultConfig(selectedMember));
    setHasUnsavedChanges(true);
  };

  const togglePermModule = (mod: string) => {
    const next = new Set(expandedPermModules);
    if (next.has(mod)) next.delete(mod); else next.add(mod);
    setExpandedPermModules(next);
  };

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════

  const enabledSectionsOrdered = config
    ? config.sectionOrder.filter(s => config.enabledSections.includes(s))
    : [];

  const disabledSections = config
    ? SECTION_IDS.filter(s => !config.enabledSections.includes(s))
    : [];

  const roleDefaultPerms = config ? getRoleDefaultPermissions(config.role) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background pattern */}
      <div className="fixed inset-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)',
          backgroundSize: '50px 50px',
        }} />
      </div>

      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 flex-shrink-0">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
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
                    User Profile Manager
                  </h1>
                  <p className="text-sm text-neutral-400">Configure roles, sections, permissions per user</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {hasUnsavedChanges && (
                  <span className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-lg">
                    Unsaved changes
                  </span>
                )}
                {config && (
                  <>
                    <button
                      onClick={handleResetToDefaults}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 text-sm transition-colors"
                    >
                      <RotateCcw size={15} />
                      Reset
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!hasUnsavedChanges}
                      className={`flex items-center gap-2 px-5 py-2 rounded-xl font-medium text-sm transition-all
                        ${hasUnsavedChanges
                          ? 'bg-[#39FF14] text-black hover:bg-[#39FF14]/90 shadow-lg shadow-[#39FF14]/20'
                          : 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
                        }`}
                    >
                      <Save size={15} />
                      Save Changes
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar - User List */}
          <aside className={`${sidebarOpen ? 'w-80' : 'w-0'} flex-shrink-0 border-r border-white/5 bg-black/10 backdrop-blur-sm transition-all duration-300 overflow-hidden flex flex-col`}>
            <div className="p-4 border-b border-white/5 space-y-3 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-neutral-800/80 border border-neutral-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#39FF14]/50 focus:ring-1 focus:ring-[#39FF14]/20 transition-colors"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full bg-neutral-800/80 border border-neutral-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#39FF14]/50 transition-colors"
              >
                <option value="">All Roles</option>
                {ALL_ROLES.map(r => (
                  <option key={r} value={r}>{ROLE_DISPLAY_NAMES[r]}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredMembers.map(member => {
                const isSelected = member.id === selectedUserId;
                const initials = member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                const roleColor = ROLE_COLORS[member.role];
                const textColor = roleColor.replace('bg-', 'text-');
                const isSelf = currentUser?.email.toLowerCase() === member.email.toLowerCase();

                return (
                  <button
                    key={member.id}
                    onClick={() => {
                      setSelectedUserId(member.id);
                      setExpandedPermModules(new Set());
                    }}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-white/[0.03]
                      ${isSelected
                        ? 'bg-[#39FF14]/10 border-l-2 border-l-[#39FF14]'
                        : 'hover:bg-white/[0.03] border-l-2 border-l-transparent'
                      }`}
                  >
                    <div className={`w-9 h-9 rounded-lg ${roleColor}/20 flex items-center justify-center flex-shrink-0 text-xs font-bold ${textColor}`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium truncate ${isSelected ? 'text-white' : 'text-neutral-200'}`}>
                          {member.name}
                        </span>
                        {!member.isActive && (
                          <span className="flex-shrink-0 w-2 h-2 rounded-full bg-red-500" title="Inactive" />
                        )}
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${roleColor}/20 ${textColor}`}>
                        {ROLE_DISPLAY_NAMES[member.role]}
                      </span>
                    </div>
                    {canImpersonate && !isSelf && (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); handleViewAs(member); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleViewAs(member); } }}
                        className="flex-shrink-0 w-7 h-7 rounded-lg bg-amber-500/10 hover:bg-amber-500/25 flex items-center justify-center transition-colors"
                        title={`View as ${member.name}`}
                      >
                        <Eye size={14} className="text-amber-400" />
                      </div>
                    )}
                  </button>
                );
              })}
              {filteredMembers.length === 0 && (
                <div className="px-4 py-8 text-center text-neutral-500 text-sm">No users match filters</div>
              )}
            </div>
          </aside>

          {/* Sidebar toggle for small screens */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex-shrink-0 w-6 bg-neutral-900 hover:bg-neutral-800 border-r border-white/5 flex items-center justify-center transition-colors"
          >
            {sidebarOpen
              ? <ChevronDown size={14} className="text-neutral-500 -rotate-90" />
              : <ChevronDown size={14} className="text-neutral-500 rotate-90" />
            }
          </button>

          {/* Main Content Panel */}
          <main className="flex-1 overflow-y-auto">
            {!config || !selectedMember ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Users className="mx-auto text-neutral-700 mb-4" size={64} />
                  <h2 className="text-xl text-neutral-400 font-medium">Select a User</h2>
                  <p className="text-neutral-600 mt-2 text-sm">Choose a team member from the sidebar to edit their profile</p>
                </div>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

                {/* ─── PROFILE HEADER ─── */}
                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-5">
                      {/* Profile photo with click-to-upload + hover overlay */}
                      <label
                        className={`relative group w-20 h-20 rounded-2xl overflow-hidden cursor-pointer flex-shrink-0 ${
                          profileImageUrl
                            ? 'bg-zinc-900'
                            : `${ROLE_COLORS[config.role]}/20 flex items-center justify-center text-2xl font-bold ${ROLE_COLORS[config.role].replace('bg-', 'text-')}`
                        }`}
                        title="Click to upload a new photo"
                      >
                        {profileImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={profileImageUrl}
                            alt={selectedMember.name}
                            className="w-full h-full object-cover"
                            onError={() => setProfileImageUrl(null)}
                          />
                        ) : (
                          <span>
                            {selectedMember.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </span>
                        )}
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          {photoUploading ? (
                            <Loader2 className="w-6 h-6 text-brand-green animate-spin" />
                          ) : (
                            <span className="text-[10px] text-white font-bold uppercase tracking-wider">
                              Change
                              <br />Photo
                            </span>
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/heic"
                          className="sr-only"
                          disabled={photoUploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePhotoUpload(file);
                            // Reset so re-uploading the same file fires onChange
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <div>
                        <h2 className="text-2xl font-bold text-white">{selectedMember.name}</h2>
                        {photoError && (
                          <div className="mt-1 text-xs text-red-400 flex items-center gap-1">
                            <AlertCircle size={12} />
                            {photoError}
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-1.5 text-sm text-neutral-400">
                          <span className="flex items-center gap-1.5"><Mail size={14} />{selectedMember.email}</span>
                          {selectedMember.phone && (
                            <span className="flex items-center gap-1.5"><Phone size={14} />{selectedMember.phone}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${ROLE_COLORS[config.role]} text-white`}>
                            {ROLE_DISPLAY_NAMES[config.role]}
                          </span>
                          <span className="text-xs text-neutral-500">ID: {selectedMember.id}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* View As button */}
                      {canImpersonate && selectedMember.email.toLowerCase() !== currentUser?.email.toLowerCase() && (
                        <button
                          onClick={() => handleViewAs(selectedMember)}
                          disabled={isImpersonating}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:text-amber-300 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          title={`View portal as ${selectedMember.name}`}
                        >
                          <Eye size={16} />
                          {isImpersonating ? 'Switching...' : 'View As'}
                        </button>
                      )}
                      {/* Active toggle */}
                      <button
                        onClick={() => updateConfig({ isActive: !config.isActive })}
                        className="flex items-center gap-2 group"
                      >
                        {config.isActive ? (
                          <>
                            <span className="text-sm text-green-400 group-hover:text-green-300 transition-colors">Active</span>
                            <ToggleRight className="text-green-400 group-hover:text-green-300 transition-colors" size={32} />
                          </>
                        ) : (
                          <>
                            <span className="text-sm text-red-400 group-hover:text-red-300 transition-colors">Inactive</span>
                            <ToggleLeft className="text-red-400 group-hover:text-red-300 transition-colors" size={32} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </section>

                {/* ─── ROLE SELECTOR ─── */}
                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                    <Shield size={18} className="text-[#39FF14]" />
                    Role Assignment
                  </h3>
                  <p className="text-sm text-neutral-500 mb-4">Changing the role resets section defaults and permissions to the new role template.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {ALL_ROLES.map(role => {
                      const isActive = config.role === role;
                      const roleColor = ROLE_COLORS[role];
                      return (
                        <button
                          key={role}
                          onClick={() => handleRoleChange(role)}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center
                            ${isActive
                              ? `${roleColor}/20 border-current ring-1 ring-current ${roleColor.replace('bg-', 'text-')}`
                              : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04] text-neutral-400'
                            }`}
                        >
                          <span className="text-sm font-medium">{ROLE_DISPLAY_NAMES[role]}</span>
                          <span className="text-[10px] opacity-60 leading-tight">{ROLE_DESCRIPTIONS[role]?.slice(0, 40)}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* ─── PORTAL SECTIONS TOGGLE ─── */}
                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <LayoutDashboard size={18} className="text-[#39FF14]" />
                        Portal Sections
                      </h3>
                      <p className="text-sm text-neutral-500 mt-0.5">
                        Toggle which sections this user sees. {config.enabledSections.length} of {SECTION_IDS.length} enabled.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {ALL_PORTAL_SECTIONS.map(section => {
                      const isEnabled = config.enabledSections.includes(section.id);
                      return (
                        <button
                          key={section.id}
                          onClick={() => toggleSection(section.id)}
                          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left text-sm transition-all
                            ${isEnabled
                              ? 'bg-[#39FF14]/10 border-[#39FF14]/30 text-white'
                              : 'bg-white/[0.01] border-white/5 text-neutral-500 hover:bg-white/[0.03]'
                            }`}
                        >
                          <div className={`flex-shrink-0 ${isEnabled ? 'text-[#39FF14]' : 'text-neutral-600'}`}>
                            {section.icon}
                          </div>
                          <span className="truncate">{section.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* ─── SECTION REORDER ─── */}
                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <ChevronUp size={18} className="text-[#39FF14]" />
                        Section Order
                      </h3>
                      <p className="text-sm text-neutral-500 mt-0.5">Reorder enabled sections. Top appears first in the user&apos;s portal.</p>
                    </div>
                    <button
                      onClick={handleAutoReorder}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#39FF14]/10 border border-[#39FF14]/20 text-[#39FF14] text-sm font-medium hover:bg-[#39FF14]/20 transition-colors"
                    >
                      <Sparkles size={15} />
                      Auto-Reorder
                    </button>
                  </div>

                  {enabledSectionsOrdered.length === 0 ? (
                    <p className="text-neutral-500 text-sm py-4 text-center">No sections enabled</p>
                  ) : (
                    <div className="space-y-1">
                      {enabledSectionsOrdered.map((sectionId, idx) => {
                        const section = ALL_PORTAL_SECTIONS.find(s => s.id === sectionId);
                        if (!section) return null;
                        return (
                          <div
                            key={sectionId}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors group"
                          >
                            <span className="w-6 text-center text-xs text-neutral-600 font-mono">{idx + 1}</span>
                            <div className={`text-[#39FF14]/70`}>{section.icon}</div>
                            <span className="flex-1 text-sm text-neutral-200">{section.label}</span>
                            <span className="text-[10px] text-neutral-600 px-1.5 py-0.5 rounded bg-white/[0.03]">{section.category}</span>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => moveSection(sectionId, 'up')}
                                disabled={idx === 0}
                                className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                onClick={() => moveSection(sectionId, 'down')}
                                disabled={idx === enabledSectionsOrdered.length - 1}
                                className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                              >
                                <ChevronDown size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {disabledSections.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <p className="text-xs text-neutral-600 mb-2">Disabled sections (not visible to user):</p>
                      <div className="flex flex-wrap gap-2">
                        {disabledSections.map(sId => {
                          const s = ALL_PORTAL_SECTIONS.find(x => x.id === sId);
                          if (!s) return null;
                          return (
                            <span key={sId} className="text-xs px-2 py-1 rounded bg-white/[0.03] text-neutral-600 border border-white/[0.03]">
                              {s.label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>

                {/* ─── LEAD DISTRIBUTION (sales only) ─── */}
                {(config.role === 'sales' || config.role === 'owner') && (
                  <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                      <Target size={18} className="text-[#39FF14]" />
                      Lead Distribution
                    </h3>
                    <p className="text-sm text-neutral-500 mb-4">Controls whether this user receives leads in the rotation pool.</p>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.leadDistribution.enabled ? 'bg-[#39FF14]/10' : 'bg-red-500/10'}`}>
                          {config.leadDistribution.enabled
                            ? <Target className="text-[#39FF14]" size={20} />
                            : <X className="text-red-400" size={20} />
                          }
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">Lead Rotation</p>
                          <p className="text-xs text-neutral-500">
                            Currently: <span className={config.leadDistribution.enabled && config.leadDistribution.status === 'receiving' ? 'text-green-400' : 'text-yellow-400'}>
                              {config.leadDistribution.enabled
                                ? config.leadDistribution.status === 'receiving' ? 'Receiving Leads' : 'Paused'
                                : 'Off Rotation'
                              }
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {config.leadDistribution.enabled && (
                          <button
                            onClick={() => updateConfig({
                              leadDistribution: {
                                ...config.leadDistribution,
                                status: config.leadDistribution.status === 'receiving' ? 'paused' : 'receiving',
                              }
                            })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                              ${config.leadDistribution.status === 'receiving'
                                ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                              }`}
                          >
                            {config.leadDistribution.status === 'receiving' ? 'Pause' : 'Resume'}
                          </button>
                        )}
                        <button
                          onClick={() => updateConfig({
                            leadDistribution: {
                              ...config.leadDistribution,
                              enabled: !config.leadDistribution.enabled,
                              status: 'receiving',
                            }
                          })}
                          className="group"
                        >
                          {config.leadDistribution.enabled
                            ? <ToggleRight className="text-[#39FF14] group-hover:text-[#39FF14]/80 transition-colors" size={32} />
                            : <ToggleLeft className="text-neutral-600 group-hover:text-neutral-400 transition-colors" size={32} />
                          }
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                {/* ─── MONDAY NOTES ─── */}
                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                    <FileText size={18} className="text-[#39FF14]" />
                    Monday Notes
                  </h3>
                  <p className="text-sm text-neutral-500 mb-4">Require this user to submit monday meeting notes each week.</p>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.mondayNotes.required ? 'bg-[#39FF14]/10' : 'bg-neutral-800'}`}>
                        <FileText className={config.mondayNotes.required ? 'text-[#39FF14]' : 'text-neutral-600'} size={20} />
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">Weekly Submission Required</p>
                        <p className="text-xs text-neutral-500">
                          {config.mondayNotes.required ? 'User must submit notes each Monday' : 'Notes submission is optional'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => updateConfig({ mondayNotes: { required: !config.mondayNotes.required } })}
                      className="group"
                    >
                      {config.mondayNotes.required
                        ? <ToggleRight className="text-[#39FF14] group-hover:text-[#39FF14]/80 transition-colors" size={32} />
                        : <ToggleLeft className="text-neutral-600 group-hover:text-neutral-400 transition-colors" size={32} />
                      }
                    </button>
                  </div>
                </section>

                {/* ─── PERMISSION OVERRIDES ─── */}
                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                    <ShieldCheck size={18} className="text-[#39FF14]" />
                    Permission Overrides
                  </h3>
                  <p className="text-sm text-neutral-500 mb-4">
                    Grant or revoke individual permissions beyond the role defaults.
                    <span className="text-[#39FF14]"> Green</span> = granted,
                    <span className="text-red-400"> Red</span> = denied,
                    <span className="text-yellow-400"> Yellow border</span> = overridden from default.
                  </p>

                  <div className="space-y-2">
                    {PERMISSION_MODULES.map(mod => {
                      const isExpanded = expandedPermModules.has(mod.module);
                      const overrideCount = mod.permissions.filter(p => isPermOverridden(p.key)).length;
                      return (
                        <div key={mod.module} className="border border-white/5 rounded-xl overflow-hidden">
                          <button
                            onClick={() => togglePermModule(mod.module)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-white">{mod.label}</span>
                              {overrideCount > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                  {overrideCount} override{overrideCount > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-neutral-500">
                                {mod.permissions.filter(p => getEffectivePermission(p.key)).length}/{mod.permissions.length}
                              </span>
                              {isExpanded ? <ChevronUp size={14} className="text-neutral-500" /> : <ChevronDown size={14} className="text-neutral-500" />}
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="px-4 py-3 space-y-2 bg-black/20">
                              {mod.permissions.map(perm => {
                                const effective = getEffectivePermission(perm.key);
                                const overridden = isPermOverridden(perm.key);
                                const roleDefault = roleDefaultPerms.includes(perm.key);
                                return (
                                  <div
                                    key={perm.key}
                                    className={`flex items-center justify-between p-2.5 rounded-lg transition-colors
                                      ${overridden ? 'border border-yellow-500/30 bg-yellow-500/5' : 'border border-transparent'}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <button
                                        onClick={() => togglePermOverride(perm.key)}
                                        className="flex-shrink-0"
                                      >
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                                          ${effective
                                            ? 'bg-[#39FF14]/20 border-[#39FF14]'
                                            : 'bg-red-500/10 border-red-500/50'
                                          }`}
                                        >
                                          {effective && <CheckCircle2 size={12} className="text-[#39FF14]" />}
                                          {!effective && <X size={10} className="text-red-400" />}
                                        </div>
                                      </button>
                                      <div>
                                        <span className="text-sm text-neutral-200">{perm.label}</span>
                                        <span className="text-[10px] text-neutral-600 ml-2 font-mono">{perm.key}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {overridden && (
                                        <button
                                          onClick={() => togglePermOverride(perm.key)}
                                          className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
                                          title="Remove override, revert to role default"
                                        >
                                          Revert
                                        </button>
                                      )}
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded
                                        ${roleDefault ? 'bg-green-500/10 text-green-500' : 'bg-neutral-800 text-neutral-500'}`}>
                                        {roleDefault ? 'Role Default' : 'Not in Role'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* ─── SECURITY ─── */}
                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Lock size={18} className="text-[#39FF14]" />
                    Security
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                      <p className="text-xs text-neutral-500 mb-1">Password Status</p>
                      {config.security.passwordChanged ? (
                        <span className="flex items-center gap-1.5 text-green-400 text-sm font-medium">
                          <CheckCircle2 size={14} /> Changed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-orange-400 text-sm font-medium">
                          <AlertCircle size={14} /> Default / Temp
                        </span>
                      )}
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                      <p className="text-xs text-neutral-500 mb-1">Last Login</p>
                      <span className="text-sm text-neutral-200">
                        {config.security.lastLogin
                          ? new Date(config.security.lastLogin).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                          : 'Never'
                        }
                      </span>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                      <p className="text-xs text-neutral-500 mb-1">Account Lock</p>
                      {config.security.isLocked ? (
                        <span className="flex items-center gap-1.5 text-red-400 text-sm font-medium">
                          <Lock size={14} /> Locked
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-green-400 text-sm font-medium">
                          <Unlock size={14} /> Unlocked
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleResetPassword}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium hover:bg-blue-500/20 transition-colors"
                    >
                      <Key size={15} />
                      Reset Password
                    </button>
                    {config.security.isLocked && (
                      <button
                        onClick={handleUnlockAccount}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/20 transition-colors"
                      >
                        <Unlock size={15} />
                        Unlock Account
                      </button>
                    )}
                  </div>
                </section>

                {/* ─── BOTTOM SAVE BAR ─── */}
                {hasUnsavedChanges && (
                  <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-gradient-to-t from-neutral-950 via-neutral-950/95 to-transparent">
                    <div className="flex items-center justify-between bg-neutral-900 border border-white/10 rounded-xl px-5 py-3.5 shadow-2xl">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                        <span className="text-sm text-neutral-300">You have unsaved changes for <span className="text-white font-medium">{selectedMember.name}</span></span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => { if (selectedMember) loadConfig(selectedMember); }}
                          className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 text-sm transition-colors"
                        >
                          Discard
                        </button>
                        <button
                          onClick={handleSave}
                          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#39FF14] text-black font-semibold text-sm hover:bg-[#39FF14]/90 shadow-lg shadow-[#39FF14]/20 transition-all"
                        >
                          <Save size={15} />
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}
          </main>
        </div>
      </div>

      {/* Toast */}
      <Toast
        message={toast.message}
        show={toast.show}
        onClose={() => setToast({ ...toast, show: false })}
      />
    </div>
  );
}
