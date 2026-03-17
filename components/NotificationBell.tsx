'use client';

/**
 * NotificationBell - Floating bell icon with unread badge and dropdown
 *
 * Features:
 * - Red badge with unread count
 * - Click opens dropdown with last 5 notifications
 * - "View All" link to /portal/notifications
 * - Auto-refreshes count every 30 seconds
 * - Subtle pulse animation on new notification
 *
 * Usage: <NotificationBell repSlug="michael-musgrove" />
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Bell,
  BellRing,
  Check,
  Target,
  AlertTriangle,
  PhoneMissed,
  Phone,
  Calendar,
  Truck,
  Package,
  MessageSquare,
  AlertCircle,
  Users,
  FileText,
  DollarSign,
  CloudRain,
  GraduationCap,
  Info,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface NotificationPreview {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  isRead: boolean;
  actionUrl?: string;
  actionLabel?: string;
  createdAt: string;
}

interface Props {
  repSlug: string;
}

// Map notification types to icons
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

const PRIORITY_COLORS: Record<string, string> = {
  low: 'border-l-green-500',
  medium: 'border-l-yellow-500',
  high: 'border-l-orange-500',
  urgent: 'border-l-red-500',
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NotificationBell({ repSlug }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationPreview[]>([]);
  const [hasNewSinceLastOpen, setHasNewSinceLastOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Fetch unread count
  const fetchCount = useCallback(async () => {
    if (!repSlug) return;
    try {
      const res = await fetch(`/api/notifications/center/count?repSlug=${encodeURIComponent(repSlug)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const newCount = data.data.unreadCount;
          // Detect new notifications arriving
          if (newCount > prevCountRef.current && prevCountRef.current >= 0) {
            setHasNewSinceLastOpen(true);
          }
          prevCountRef.current = newCount;
          setUnreadCount(newCount);
        }
      }
    } catch {
      // Silent fail for background polling
    }
  }, [repSlug]);

  // Fetch recent notifications for the dropdown
  const fetchRecent = useCallback(async () => {
    if (!repSlug) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/notifications/center?repSlug=${encodeURIComponent(repSlug)}&limit=5`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNotifications(data.data.notifications || []);
          setUnreadCount(data.data.unreadCount || 0);
        }
      }
    } catch {
      // Silent fail
    }
    setLoading(false);
  }, [repSlug]);

  // Initial load + polling
  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  // Fetch full list when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchRecent();
      setHasNewSinceLastOpen(false);
    }
  }, [isOpen, fetchRecent]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Mark a notification as read
  const markAsRead = async (id: string) => {
    try {
      await fetch('/api/notifications/center', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // Silent fail
    }
  };

  const BellIcon = hasNewSinceLastOpen ? BellRing : Bell;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-neutral-400 hover:bg-white/5 hover:text-white transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <BellIcon
          size={20}
          className={hasNewSinceLastOpen ? 'animate-pulse text-[#39FF14]' : ''}
        />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-lg">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl shadow-black/40">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
                {unreadCount} unread
              </span>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-700 border-t-[#39FF14]" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Check className="mx-auto mb-2 h-8 w-8 text-[#39FF14]" />
                <p className="text-sm text-neutral-400">All caught up!</p>
              </div>
            ) : (
              notifications.map(n => {
                const Icon = TYPE_ICONS[n.type] || Bell;
                const priorityBorder = PRIORITY_COLORS[n.priority] || PRIORITY_COLORS.medium;

                return (
                  <div
                    key={n.id}
                    className={`border-b border-neutral-800/50 border-l-2 ${priorityBorder} px-4 py-3 transition-colors hover:bg-neutral-800/40 ${
                      !n.isRead ? 'bg-neutral-800/20' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="mt-0.5 flex-shrink-0">
                        <Icon size={16} className={!n.isRead ? 'text-[#39FF14]' : 'text-neutral-500'} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm leading-tight ${!n.isRead ? 'font-semibold text-white' : 'text-neutral-300'}`}>
                            {n.title}
                          </p>
                          <span className="flex-shrink-0 text-[10px] text-neutral-500">
                            {timeAgo(n.createdAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-neutral-500 line-clamp-2">{n.message}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          {n.actionUrl && (
                            <Link
                              href={n.actionUrl}
                              onClick={() => {
                                if (!n.isRead) markAsRead(n.id);
                                setIsOpen(false);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#39FF14] hover:underline"
                            >
                              {n.actionLabel || 'View'} <ExternalLink size={10} />
                            </Link>
                          )}
                          {!n.isRead && (
                            <button
                              onClick={() => markAsRead(n.id)}
                              className="text-[11px] text-neutral-500 hover:text-neutral-300"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-neutral-800 px-4 py-2.5">
            <Link
              href="/portal/notifications"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium text-[#39FF14] transition-colors hover:bg-[#39FF14]/10"
            >
              View All Notifications <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
