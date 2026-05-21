'use client';

/**
 * Notification Center Page
 *
 * Full notification management UI with filtering, sorting, bulk actions,
 * and per-notification read/archive/delete controls.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Bell, BellOff, Check, CheckCheck, Trash2, Archive, Filter,
  Phone, PhoneMissed, MessageSquare, Mail, Truck, Package,
  AlertTriangle, AlertCircle, Info, Calendar, FileText, Users,
  DollarSign, CloudRain, GraduationCap, Settings, MoreVertical,
  ChevronRight, ChevronDown, X, ExternalLink, Target, Loader2,
  ArrowLeft, RefreshCw, SortDesc,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

// =============================================================================
// TYPES
// =============================================================================

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  recipient: string;
  sender?: string;
  isRead: boolean;
  isArchived: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, string>;
  createdAt: string;
  readAt?: string;
  expiresAt?: string;
  groupId?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

type FilterTab = 'all' | 'unread' | 'leads' | 'calls' | 'deliveries' | 'system' | 'archived';
type SortMode = 'newest' | 'priority';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'leads', label: 'Leads' },
  { key: 'calls', label: 'Calls' },
  { key: 'deliveries', label: 'Deliveries' },
  { key: 'system', label: 'System' },
  { key: 'archived', label: 'Archived' },
];

const TYPE_ICONS: Record<string, typeof Bell> = {
  lead_assigned: Target,
  lead_warning: AlertTriangle,
  lead_reassigned: Target,
  voicemail: Phone,
  missed_call: PhoneMissed,
  appointment_reminder: Calendar,
  delivery_update: Truck,
  inventory_alert: Package,
  customer_message: MessageSquare,
  system_alert: AlertCircle,
  team_announcement: Users,
  document_shared: FileText,
  approval_needed: Check,
  payment_received: DollarSign,
  job_status_change: Info,
  weather_alert: CloudRain,
  training_due: GraduationCap,
};

const TYPE_LABELS: Record<string, string> = {
  lead_assigned: 'Lead Assigned',
  lead_warning: 'Lead Warning',
  lead_reassigned: 'Lead Reassigned',
  voicemail: 'Voicemail',
  missed_call: 'Missed Call',
  appointment_reminder: 'Appointment',
  delivery_update: 'Delivery',
  inventory_alert: 'Inventory',
  customer_message: 'Message',
  system_alert: 'System',
  team_announcement: 'Announcement',
  document_shared: 'Document',
  approval_needed: 'Approval',
  payment_received: 'Payment',
  job_status_change: 'Job Update',
  weather_alert: 'Weather',
  training_due: 'Training',
};

const PRIORITY_BORDER_COLORS: Record<string, string> = {
  low: 'border-l-green-500',
  medium: 'border-l-yellow-500',
  high: 'border-l-orange-500',
  urgent: 'border-l-red-500',
};

const PRIORITY_BG: Record<string, string> = {
  low: 'bg-green-500/10 text-green-400',
  medium: 'bg-yellow-500/10 text-yellow-400',
  high: 'bg-orange-500/10 text-orange-400',
  urgent: 'bg-red-500/10 text-red-400',
};

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// Types that fall under each filter tab
const LEAD_TYPES = new Set(['lead_assigned', 'lead_warning', 'lead_reassigned']);
const CALL_TYPES = new Set(['voicemail', 'missed_call']);
const DELIVERY_TYPES = new Set(['delivery_update', 'inventory_alert']);
const SYSTEM_TYPES = new Set(['system_alert', 'team_announcement', 'weather_alert', 'training_due']);

// =============================================================================
// HELPERS
// =============================================================================

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin === 1) return '1 min ago';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour === 1) return '1 hour ago';
  if (diffHour < 24) return `${diffHour} hours ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function NotificationCenterPage() {
  const { user } = useAuth();
  const repSlug = (user as any)?.userId || user?.name?.toLowerCase().replace(/\s+/g, '-') || '';

  // State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadByType, setUnreadByType] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!repSlug) return;
    setLoading(true);
    try {
      const includeArchived = activeTab === 'archived' ? '&includeArchived=true' : '';
      const res = await fetch(
        `/api/notifications/center?repSlug=${encodeURIComponent(repSlug)}&limit=200${includeArchived}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNotifications(data.data.notifications || []);
          setUnreadCount(data.data.unreadCount || 0);
          setUnreadByType(data.data.unreadByType || {});
        }
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
    setLoading(false);
  }, [repSlug, activeTab]);

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user, fetchNotifications]);

  // Filter notifications based on active tab
  const filteredNotifications = notifications.filter(n => {
    switch (activeTab) {
      case 'unread':
        return !n.isRead && !n.isArchived;
      case 'leads':
        return LEAD_TYPES.has(n.type) && !n.isArchived;
      case 'calls':
        return CALL_TYPES.has(n.type) && !n.isArchived;
      case 'deliveries':
        return DELIVERY_TYPES.has(n.type) && !n.isArchived;
      case 'system':
        return SYSTEM_TYPES.has(n.type) && !n.isArchived;
      case 'archived':
        return n.isArchived;
      default: // 'all'
        return !n.isArchived;
    }
  });

  // Sort
  const sortedNotifications = [...filteredNotifications].sort((a, b) => {
    if (sortMode === 'priority') {
      const pa = PRIORITY_ORDER[a.priority] ?? 2;
      const pb = PRIORITY_ORDER[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
    }
    // Secondary sort or default: newest first
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Group by groupId
  const groupedNotifications: Notification[][] = [];
  const seenGroups = new Set<string>();

  for (const n of sortedNotifications) {
    if (n.groupId && seenGroups.has(n.groupId)) continue;
    if (n.groupId) {
      seenGroups.add(n.groupId);
      const group = sortedNotifications.filter(x => x.groupId === n.groupId);
      groupedNotifications.push(group);
    } else {
      groupedNotifications.push([n]);
    }
  }

  // Actions
  const markAsRead = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch('/api/notifications/center', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* silent */ }
    setActionLoading(null);
    setMenuOpenId(null);
  };

  const markAsUnread = async (id: string) => {
    // Client-only toggle for UX (the API only supports mark-read, not mark-unread)
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: false, readAt: undefined } : n))
    );
    setUnreadCount(prev => prev + 1);
    setMenuOpenId(null);
  };

  const markAllRead = async () => {
    setActionLoading('all');
    try {
      await fetch('/api/notifications/center', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true, repSlug }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch { /* silent */ }
    setActionLoading(null);
  };

  const archiveNotification = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch('/api/notifications/center', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id], action: 'archive' }),
      });
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isArchived: true } : n))
      );
    } catch { /* silent */ }
    setActionLoading(null);
    setMenuOpenId(null);
  };

  const deleteNotification = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch('/api/notifications/center', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id], action: 'delete' }),
      });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch { /* silent */ }
    setActionLoading(null);
    setMenuOpenId(null);
  };

  // Build quick action summary
  const leadAlerts = (unreadByType.lead_assigned || 0) + (unreadByType.lead_warning || 0) + (unreadByType.lead_reassigned || 0);
  const missedCalls = (unreadByType.missed_call || 0) + (unreadByType.voicemail || 0);
  const systemAlerts = (unreadByType.system_alert || 0) + (unreadByType.team_announcement || 0) + (unreadByType.weather_alert || 0);
  const deliveryAlerts = (unreadByType.delivery_update || 0) + (unreadByType.inventory_alert || 0);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Header */}
      <div className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/portal/dashboard" className="text-neutral-400 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-[#39FF14]" />
                <h1 className="text-xl font-bold">Notifications</h1>
                {unreadCount > 0 && (
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={actionLoading === 'all'}
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white hover:border-neutral-600 transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'all' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <CheckCheck className="w-3 h-3" />
                  )}
                  Mark All Read
                </button>
              )}
              <button
                onClick={fetchNotifications}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <Link
                href="/portal/settings/notifications"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                title="Notification Settings"
              >
                <Settings className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Panel */}
      {unreadCount > 0 && (
        <div className="bg-neutral-900/60 border-b border-neutral-800/50">
          <div className="max-w-4xl mx-auto px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400">
              <span className="text-neutral-500 font-medium">Unread:</span>
              {leadAlerts > 0 && (
                <button
                  onClick={() => setActiveTab('leads')}
                  className="flex items-center gap-1 rounded-full bg-orange-500/10 px-2.5 py-1 text-orange-400 hover:bg-orange-500/20 transition-colors"
                >
                  <Target size={12} /> Lead alerts: {leadAlerts}
                </button>
              )}
              {missedCalls > 0 && (
                <button
                  onClick={() => setActiveTab('calls')}
                  className="flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <PhoneMissed size={12} /> Missed calls: {missedCalls}
                </button>
              )}
              {deliveryAlerts > 0 && (
                <button
                  onClick={() => setActiveTab('deliveries')}
                  className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-blue-400 hover:bg-blue-500/20 transition-colors"
                >
                  <Truck size={12} /> Deliveries: {deliveryAlerts}
                </button>
              )}
              {systemAlerts > 0 && (
                <button
                  onClick={() => setActiveTab('system')}
                  className="flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-1 text-purple-400 hover:bg-purple-500/20 transition-colors"
                >
                  <AlertCircle size={12} /> System: {systemAlerts}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs + Sort */}
      <div className="max-w-4xl mx-auto px-4 mt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {FILTER_TABS.map(tab => {
              // Count for badge
              let count = 0;
              if (tab.key === 'unread') count = unreadCount;
              else if (tab.key === 'leads') count = leadAlerts;
              else if (tab.key === 'calls') count = missedCalls;
              else if (tab.key === 'deliveries') count = deliveryAlerts;
              else if (tab.key === 'system') count = systemAlerts;

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'bg-[#39FF14]/15 text-[#39FF14]'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  {tab.label}
                  {count > 0 && tab.key !== 'all' && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-700 px-1 text-[10px] font-bold text-neutral-300">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setSortMode(prev => (prev === 'newest' ? 'priority' : 'newest'))}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-white hover:border-neutral-700 transition-colors"
            title={`Sort: ${sortMode === 'newest' ? 'Newest first' : 'Priority first'}`}
          >
            <SortDesc size={14} />
            {sortMode === 'newest' ? 'Newest' : 'Priority'}
          </button>
        </div>
      </div>

      {/* Notification List */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#39FF14] mb-3" />
            <p className="text-neutral-500 text-sm">Loading notifications...</p>
          </div>
        ) : groupedNotifications.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#39FF14]/10 mb-4">
              <Check className="w-8 h-8 text-[#39FF14]" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-1">All caught up!</h2>
            <p className="text-sm text-neutral-500 max-w-xs text-center">
              {activeTab === 'archived'
                ? 'No archived notifications.'
                : activeTab === 'all'
                  ? 'No notifications yet. They will appear here as events occur.'
                  : `No ${activeTab} notifications.`}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {groupedNotifications.map((group) => {
              const isGrouped = group.length > 1;
              const firstNotification = group[0];

              if (isGrouped) {
                return (
                  <NotificationGroup
                    key={firstNotification.groupId || firstNotification.id}
                    notifications={group}
                    expandedId={expandedId}
                    menuOpenId={menuOpenId}
                    actionLoading={actionLoading}
                    onExpand={setExpandedId}
                    onMenuToggle={setMenuOpenId}
                    onMarkAsRead={markAsRead}
                    onMarkAsUnread={markAsUnread}
                    onArchive={archiveNotification}
                    onDelete={deleteNotification}
                  />
                );
              }

              return (
                <NotificationCard
                  key={firstNotification.id}
                  notification={firstNotification}
                  isExpanded={expandedId === firstNotification.id}
                  menuOpen={menuOpenId === firstNotification.id}
                  actionLoading={actionLoading}
                  onExpand={() => setExpandedId(expandedId === firstNotification.id ? null : firstNotification.id)}
                  onMenuToggle={() => setMenuOpenId(menuOpenId === firstNotification.id ? null : firstNotification.id)}
                  onMarkAsRead={() => markAsRead(firstNotification.id)}
                  onMarkAsUnread={() => markAsUnread(firstNotification.id)}
                  onArchive={() => archiveNotification(firstNotification.id)}
                  onDelete={() => deleteNotification(firstNotification.id)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// NOTIFICATION CARD
// =============================================================================

function NotificationCard({
  notification: n,
  isExpanded,
  menuOpen,
  actionLoading,
  onExpand,
  onMenuToggle,
  onMarkAsRead,
  onMarkAsUnread,
  onArchive,
  onDelete,
}: {
  notification: Notification;
  isExpanded: boolean;
  menuOpen: boolean;
  actionLoading: string | null;
  onExpand: () => void;
  onMenuToggle: () => void;
  onMarkAsRead: () => void;
  onMarkAsUnread: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const Icon = TYPE_ICONS[n.type] || Bell;
  const priorityBorder = PRIORITY_BORDER_COLORS[n.priority] || PRIORITY_BORDER_COLORS.medium;
  const priorityBadge = PRIORITY_BG[n.priority] || PRIORITY_BG.medium;
  const isLoading = actionLoading === n.id;

  return (
    <div
      className={`relative rounded-lg border border-neutral-800 border-l-[3px] ${priorityBorder} transition-all ${
        !n.isRead ? 'bg-neutral-900/80' : 'bg-neutral-900/40'
      } hover:border-neutral-700`}
    >
      {/* Main row */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Type icon */}
        <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
          !n.isRead ? 'bg-[#39FF14]/10' : 'bg-neutral-800'
        }`}>
          <Icon size={16} className={!n.isRead ? 'text-[#39FF14]' : 'text-neutral-500'} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button
              onClick={onExpand}
              className="text-left min-w-0 flex-1"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`text-sm leading-tight ${!n.isRead ? 'font-semibold text-white' : 'text-neutral-300'}`}>
                  {n.title}
                </p>
                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${priorityBadge}`}>
                  {n.priority}
                </span>
                <span className="text-[10px] text-neutral-600">
                  {TYPE_LABELS[n.type] || n.type}
                </span>
              </div>
              <p className={`mt-1 text-xs text-neutral-500 ${isExpanded ? '' : 'line-clamp-2'}`}>
                {n.message}
              </p>
            </button>

            {/* Timestamp + menu */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[11px] text-neutral-600 whitespace-nowrap">
                {timeAgo(n.createdAt)}
              </span>
              <div className="relative">
                <button
                  onClick={onMenuToggle}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
                >
                  <MoreVertical size={14} />
                </button>

                {/* Dropdown menu */}
                {menuOpen && (
                  <div className="absolute right-0 top-8 z-30 w-44 rounded-lg border border-neutral-800 bg-neutral-900 py-1 shadow-xl shadow-black/40">
                    {n.isRead ? (
                      <button
                        onClick={onMarkAsUnread}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white"
                      >
                        <Bell size={13} /> Mark as unread
                      </button>
                    ) : (
                      <button
                        onClick={onMarkAsRead}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white"
                      >
                        <Check size={13} /> Mark as read
                      </button>
                    )}
                    <button
                      onClick={onArchive}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white"
                    >
                      <Archive size={13} /> Archive
                    </button>
                    <div className="my-1 border-t border-neutral-800" />
                    <button
                      onClick={onDelete}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Expanded content */}
          {isExpanded && (
            <div className="mt-3 space-y-2 border-t border-neutral-800/60 pt-3">
              {/* Full timestamp */}
              <p className="text-[11px] text-neutral-600">
                {formatFullDate(n.createdAt)}
                {n.readAt && ` \u2022 Read ${formatFullDate(n.readAt)}`}
              </p>

              {/* Metadata */}
              {n.metadata && Object.keys(n.metadata).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(n.metadata).map(([key, value]) => (
                    <span
                      key={key}
                      className="inline-flex items-center rounded-md bg-neutral-800 px-2 py-1 text-[11px] text-neutral-400"
                    >
                      <span className="text-neutral-600 mr-1">{key}:</span> {value}
                    </span>
                  ))}
                </div>
              )}

              {/* Sender */}
              {n.sender && (
                <p className="text-[11px] text-neutral-600">
                  From: <span className="text-neutral-400">{n.sender}</span>
                </p>
              )}

              {/* Action button */}
              {n.actionUrl && (
                <Link
                  href={n.actionUrl}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#39FF14]/10 px-3 py-1.5 text-xs font-medium text-[#39FF14] hover:bg-[#39FF14]/20 transition-colors"
                >
                  {n.actionLabel || 'View Details'} <ExternalLink size={12} />
                </Link>
              )}
            </div>
          )}

          {/* Action button (collapsed view) */}
          {!isExpanded && n.actionUrl && (
            <div className="mt-2">
              <Link
                href={n.actionUrl}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#39FF14] hover:underline"
              >
                {n.actionLabel || 'View'} <ChevronRight size={11} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-neutral-900/60">
          <Loader2 className="w-5 h-5 animate-spin text-[#39FF14]" />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// NOTIFICATION GROUP
// =============================================================================

function NotificationGroup({
  notifications,
  expandedId,
  menuOpenId,
  actionLoading,
  onExpand,
  onMenuToggle,
  onMarkAsRead,
  onMarkAsUnread,
  onArchive,
  onDelete,
}: {
  notifications: Notification[];
  expandedId: string | null;
  menuOpenId: string | null;
  actionLoading: string | null;
  onExpand: (id: string | null) => void;
  onMenuToggle: (id: string | null) => void;
  onMarkAsRead: (id: string) => void;
  onMarkAsUnread: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [isGroupExpanded, setIsGroupExpanded] = useState(false);
  const first = notifications[0];
  const unreadInGroup = notifications.filter(n => !n.isRead).length;

  return (
    <div className="rounded-lg border border-neutral-800 overflow-hidden">
      {/* Group header */}
      <button
        onClick={() => setIsGroupExpanded(!isGroupExpanded)}
        className="flex w-full items-center justify-between gap-3 bg-neutral-900/60 px-4 py-2.5 hover:bg-neutral-900/80 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm text-neutral-300">
          <Users size={14} className="text-neutral-500" />
          <span className="font-medium">{first.title}</span>
          <span className="text-xs text-neutral-600">({notifications.length} related)</span>
          {unreadInGroup > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500/20 px-1 text-[10px] font-bold text-red-400">
              {unreadInGroup}
            </span>
          )}
        </div>
        <ChevronDown
          size={14}
          className={`text-neutral-500 transition-transform ${isGroupExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Group items */}
      {isGroupExpanded && (
        <div className="divide-y divide-neutral-800/50">
          {notifications.map(n => (
            <NotificationCard
              key={n.id}
              notification={n}
              isExpanded={expandedId === n.id}
              menuOpen={menuOpenId === n.id}
              actionLoading={actionLoading}
              onExpand={() => onExpand(expandedId === n.id ? null : n.id)}
              onMenuToggle={() => onMenuToggle(menuOpenId === n.id ? null : n.id)}
              onMarkAsRead={() => onMarkAsRead(n.id)}
              onMarkAsUnread={() => onMarkAsUnread(n.id)}
              onArchive={() => onArchive(n.id)}
              onDelete={() => onDelete(n.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
