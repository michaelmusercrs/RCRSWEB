'use client';

/**
 * RCRS Command Center - Customer Communication Hub
 *
 * Unified view of all customer interactions:
 * - Left panel: Customer list with search, filters, recent activity
 * - Right panel: Selected customer's full communication thread
 * - Quick compose: Note, SMS, Email with templates
 * - Stats sidebar: Interaction counts, response times, job status
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Phone,
  MessageSquare,
  Mail,
  FileText,
  StickyNote,
  Calendar,
  Clock,
  Search,
  Filter,
  Send,
  Paperclip,
  ChevronRight,
  User,
  MapPin,
  Play,
  ArrowUpRight,
  ArrowDownLeft,
  Tag,
  Bell,
  MoreVertical,
  Plus,
  Loader2,
  RefreshCw,
  ArrowLeft,
  X,
  ChevronDown,
  ExternalLink,
  Mic,
  BarChart3,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface CommunicationEvent {
  id: string;
  type: 'call' | 'sms' | 'email' | 'note' | 'voicemail' | 'document' | 'status_change' | 'appointment';
  timestamp: string;
  direction?: 'inbound' | 'outbound';
  from: string;
  to: string;
  subject?: string;
  body: string;
  duration?: number;
  recordingUrl?: string;
  attachments?: { name: string; url: string; type: string }[];
  metadata?: Record<string, string>;
  repId?: string;
  repName?: string;
  isRead: boolean;
  jobId?: string;
  leadId?: string;
}

interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  jobNimbusId?: string;
  leadId?: string;
  jobIds: string[];
  totalCalls: number;
  totalMessages: number;
  lastContact: string;
  assignedRep: string;
  status: string;
  unreadCount?: number;
}

interface ThreadSummary {
  totalInteractions: number;
  lastInbound: string;
  lastOutbound: string;
  avgResponseTime: number;
  openItems: number;
}

// =============================================================================
// Quick response templates
// =============================================================================

const QUICK_TEMPLATES = [
  { label: 'Follow up', text: 'Hi, just following up on our conversation. Do you have any questions about the estimate we provided?' },
  { label: 'Schedule inspection', text: 'Hi, we\'d like to schedule a roof inspection at your convenience. What days/times work best for you?' },
  { label: 'Estimate ready', text: 'Good news! Your roofing estimate is ready. I\'ll send it over shortly. Feel free to call us with any questions.' },
  { label: 'Materials ordered', text: 'We\'ve ordered your roofing materials. We\'ll let you know as soon as the delivery date is confirmed.' },
  { label: 'Job scheduled', text: 'Your roofing project has been scheduled! We\'ll confirm the exact date and time soon.' },
  { label: 'Thank you', text: 'Thank you for choosing River City Roofing Solutions! We appreciate your business.' },
];

// =============================================================================
// Helper functions
// =============================================================================

function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return 'Never';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTimestamp(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^1/, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

// =============================================================================
// Event type config
// =============================================================================

function getEventIcon(type: string) {
  switch (type) {
    case 'call': return Phone;
    case 'sms': return MessageSquare;
    case 'email': return Mail;
    case 'note': return StickyNote;
    case 'voicemail': return Mic;
    case 'document': return FileText;
    case 'status_change': return Tag;
    case 'appointment': return Calendar;
    default: return MessageSquare;
  }
}

function getEventColor(type: string, direction?: string): string {
  switch (type) {
    case 'call': return direction === 'inbound' ? 'text-blue-400' : 'text-green-400';
    case 'sms': return direction === 'outbound' ? 'text-[#39FF14]' : 'text-gray-300';
    case 'email': return 'text-purple-400';
    case 'note': return 'text-yellow-400';
    case 'voicemail': return 'text-orange-400';
    case 'document': return 'text-cyan-400';
    case 'status_change': return 'text-pink-400';
    case 'appointment': return 'text-indigo-400';
    default: return 'text-gray-400';
  }
}

// =============================================================================
// Sub-components
// =============================================================================

function CustomerListItem({
  customer,
  isSelected,
  onClick,
}: {
  customer: CustomerProfile;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 border-b border-gray-700/50 hover:bg-gray-800/50 transition-colors ${
        isSelected ? 'bg-gray-800 border-l-2 border-l-[#39FF14]' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white truncate">{customer.name}</span>
            {(customer.unreadCount || 0) > 0 && (
              <span className="flex-shrink-0 bg-[#39FF14] text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {customer.unreadCount}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 truncate mt-0.5">
            {customer.phone ? formatPhoneDisplay(customer.phone) : customer.email || 'No contact info'}
          </p>
          {customer.assignedRep && (
            <p className="text-xs text-gray-500 mt-0.5">Rep: {customer.assignedRep}</p>
          )}
        </div>
        <div className="flex-shrink-0 text-right ml-2">
          <span className="text-xs text-gray-500">{formatTimeAgo(customer.lastContact)}</span>
          <div className="flex items-center gap-1 mt-1 justify-end">
            {customer.totalCalls > 0 && (
              <span className="text-xs text-gray-500 flex items-center gap-0.5">
                <Phone className="w-3 h-3" />{customer.totalCalls}
              </span>
            )}
            {customer.totalMessages > 0 && (
              <span className="text-xs text-gray-500 flex items-center gap-0.5">
                <MessageSquare className="w-3 h-3" />{customer.totalMessages}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function EventTimelineItem({ event }: { event: CommunicationEvent }) {
  const Icon = getEventIcon(event.type);
  const colorClass = getEventColor(event.type, event.direction);
  const [expanded, setExpanded] = useState(false);

  const isBubbleType = event.type === 'sms' || event.type === 'email';
  const isOutbound = event.direction === 'outbound';

  return (
    <div className="flex gap-3 py-3 group">
      {/* Icon column */}
      <div className="flex-shrink-0 mt-1">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          event.type === 'call' || event.type === 'voicemail'
            ? 'bg-blue-500/10'
            : event.type === 'note'
            ? 'bg-yellow-500/10'
            : event.type === 'sms'
            ? isOutbound ? 'bg-[#39FF14]/10' : 'bg-gray-700'
            : 'bg-gray-700'
        }`}>
          <Icon className={`w-4 h-4 ${colorClass}`} />
        </div>
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 text-sm">
          {event.direction && (
            event.direction === 'inbound'
              ? <ArrowDownLeft className="w-3 h-3 text-blue-400" />
              : <ArrowUpRight className="w-3 h-3 text-green-400" />
          )}
          <span className="text-gray-400">
            {event.from}
            {event.to && <span className="text-gray-600"> &rarr; {event.to}</span>}
          </span>
          <span className="text-gray-600 text-xs">&middot;</span>
          <span className="text-gray-500 text-xs">{formatTimestamp(event.timestamp)}</span>
          {event.repName && (
            <>
              <span className="text-gray-600 text-xs">&middot;</span>
              <span className="text-gray-500 text-xs">{event.repName}</span>
            </>
          )}
        </div>

        {/* Subject (email) */}
        {event.subject && (
          <p className="text-sm font-medium text-white mt-1">{event.subject}</p>
        )}

        {/* Body */}
        {isBubbleType ? (
          <div className={`mt-1 p-3 rounded-lg max-w-lg text-sm ${
            isOutbound
              ? 'bg-[#39FF14]/10 text-gray-200 rounded-br-sm'
              : 'bg-gray-700 text-gray-200 rounded-bl-sm'
          }`}>
            {event.body}
          </div>
        ) : event.type === 'note' ? (
          <div className="mt-1 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-sm text-gray-300">
            {event.body}
          </div>
        ) : event.type === 'status_change' ? (
          <div className="mt-1 flex items-center gap-2">
            <Tag className="w-3 h-3 text-pink-400" />
            <span className="text-sm text-gray-300">{event.body}</span>
          </div>
        ) : event.type === 'appointment' ? (
          <div className="mt-1 p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/20 text-sm text-gray-300">
            <Calendar className="w-3 h-3 text-indigo-400 inline mr-1" />
            {event.body}
          </div>
        ) : (
          <p className="text-sm text-gray-300 mt-1">{event.body}</p>
        )}

        {/* Call-specific details */}
        {(event.type === 'call' || event.type === 'voicemail') && (
          <div className="flex items-center gap-3 mt-2">
            {event.duration !== undefined && event.duration > 0 && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(event.duration)}
              </span>
            )}
            {event.metadata?.status && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                event.metadata.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                event.metadata.status === 'missed' ? 'bg-red-500/10 text-red-400' :
                'bg-gray-700 text-gray-400'
              }`}>
                {event.metadata.status}
              </span>
            )}
            {event.recordingUrl && (
              <button className="text-xs text-[#39FF14] flex items-center gap-1 hover:underline">
                <Play className="w-3 h-3" />
                Play recording
              </button>
            )}
          </div>
        )}

        {/* Attachments */}
        {event.attachments && event.attachments.length > 0 && (
          <div className="mt-2 space-y-1">
            {event.attachments.map((att, i) => (
              <a
                key={i}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-cyan-400 hover:underline"
              >
                <FileText className="w-3 h-3" />
                {att.name}
                <ExternalLink className="w-3 h-3" />
              </a>
            ))}
          </div>
        )}

        {/* Read status indicator */}
        {!event.isRead && (
          <span className="inline-block mt-1 w-2 h-2 rounded-full bg-[#39FF14]" />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function CommunicationsHubPage() {
  // Data state
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [threadEvents, setThreadEvents] = useState<CommunicationEvent[]>([]);
  const [threadSummary, setThreadSummary] = useState<ThreadSummary | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);
  const [recentActivity, setRecentActivity] = useState<CommunicationEvent[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'unread'>('recent');
  const [filterType, setFilterType] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // Compose state
  const [composeChannel, setComposeChannel] = useState<'note' | 'sms' | 'email'>('note');
  const [composeText, setComposeText] = useState('');
  const [sending, setSending] = useState(false);

  const threadEndRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchCustomers = useCallback(async (search?: string) => {
    try {
      const url = search
        ? `/api/communications/search?q=${encodeURIComponent(search)}&limit=50`
        : `/api/communications/search?q=&limit=50`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCustomers(data.data.customers || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  }, []);

  const fetchRecentActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/communications?limit=20');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRecentActivity(data.data.events || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch recent activity:', error);
    }
  }, []);

  const fetchThread = useCallback(async (customerId: string) => {
    setThreadLoading(true);
    try {
      const res = await fetch(`/api/communications/${customerId}?limit=200`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setThreadEvents(data.data.events || []);
          setThreadSummary(data.data.summary || null);
          setSelectedCustomer(data.data.customer || null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch thread:', error);
    } finally {
      setThreadLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true);
      await Promise.all([fetchCustomers(), fetchRecentActivity()]);
      setLoading(false);
    };
    loadInitial();
  }, [fetchCustomers, fetchRecentActivity]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchCustomers(searchTerm || undefined);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchTerm, fetchCustomers]);

  // Load thread when customer selected
  useEffect(() => {
    if (selectedCustomerId) {
      fetchThread(selectedCustomerId);
    }
  }, [selectedCustomerId, fetchThread]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setComposeText('');
    setShowTemplates(false);
  };

  const handleSendMessage = async () => {
    if (!composeText.trim() || !selectedCustomerId || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/communications/${selectedCustomerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: composeChannel,
          content: composeText.trim(),
          author: 'Admin', // In production, use actual logged-in user
        }),
      });

      if (res.ok) {
        setComposeText('');
        // Refresh thread
        await fetchThread(selectedCustomerId);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTemplateSelect = (template: string) => {
    setComposeText(template);
    setShowTemplates(false);
  };

  // ---------------------------------------------------------------------------
  // Sorted/filtered customers
  // ---------------------------------------------------------------------------

  const sortedCustomers = [...customers].sort((a, b) => {
    if (sortBy === 'unread') {
      return (b.unreadCount || 0) - (a.unreadCount || 0);
    }
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    // default: recent
    return new Date(b.lastContact).getTime() - new Date(a.lastContact).getTime();
  });

  // Filter thread events by type
  const filteredEvents = filterType === 'all'
    ? threadEvents
    : threadEvents.filter(e => e.type === filterType);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#39FF14] animate-spin mx-auto mb-3" />
          <p className="text-gray-400">Loading Communication Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/command-center" className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#39FF14]" />
              Communication Hub
            </h1>
            <p className="text-xs text-gray-500">All customer interactions in one place</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStats(!showStats)}
            className={`p-2 rounded-lg transition-colors ${
              showStats ? 'bg-[#39FF14]/10 text-[#39FF14]' : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
            title="Toggle stats panel"
          >
            <BarChart3 className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              fetchCustomers(searchTerm || undefined);
              fetchRecentActivity();
              if (selectedCustomerId) fetchThread(selectedCustomerId);
            }}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Customer List */}
        <div className="w-[380px] flex-shrink-0 border-r border-gray-700 flex flex-col bg-gray-900">
          {/* Search */}
          <div className="p-3 border-b border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search name, phone, email..."
                className="w-full bg-gray-800 text-white text-sm rounded-lg pl-9 pr-3 py-2 border border-gray-700 focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14]/20 outline-none placeholder-gray-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Sort buttons */}
            <div className="flex items-center gap-1 mt-2">
              {(['recent', 'name', 'unread'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setSortBy(mode)}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                    sortBy === mode
                      ? 'bg-[#39FF14]/10 text-[#39FF14]'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  {mode === 'recent' ? 'Recent' : mode === 'name' ? 'A-Z' : 'Unread'}
                </button>
              ))}
              <div className="flex-1" />
              <span className="text-xs text-gray-600">{customers.length} customers</span>
            </div>
          </div>

          {/* Customer list */}
          <div className="flex-1 overflow-y-auto">
            {sortedCustomers.length === 0 ? (
              <div className="p-6 text-center">
                <User className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">
                  {searchTerm ? 'No customers found' : 'No customers yet'}
                </p>
                <p className="text-gray-600 text-xs mt-1">
                  {searchTerm ? 'Try a different search' : 'Add customers via the + button or import from calls'}
                </p>
              </div>
            ) : (
              sortedCustomers.map(customer => (
                <CustomerListItem
                  key={customer.id}
                  customer={customer}
                  isSelected={customer.id === selectedCustomerId}
                  onClick={() => handleSelectCustomer(customer.id)}
                />
              ))
            )}
          </div>

          {/* Recent activity */}
          {!selectedCustomerId && recentActivity.length > 0 && (
            <div className="border-t border-gray-700">
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Recent Activity</span>
                <Bell className="w-3.5 h-3.5 text-gray-500" />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {recentActivity.slice(0, 5).map(event => {
                  const Icon = getEventIcon(event.type);
                  const color = getEventColor(event.type, event.direction);
                  return (
                    <div
                      key={event.id}
                      className="px-3 py-2 flex items-start gap-2 hover:bg-gray-800/50 cursor-pointer border-b border-gray-800/50 last:border-0"
                      onClick={() => {
                        if (event.metadata?.customerId) {
                          handleSelectCustomer(event.metadata.customerId);
                        }
                      }}
                    >
                      <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-300 truncate">{event.body}</p>
                        <p className="text-xs text-gray-600">{formatTimeAgo(event.timestamp)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Thread or Empty State */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedCustomerId ? (
            /* Empty state */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <MessageSquare className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-400 mb-2">Select a Customer</h2>
                <p className="text-gray-600 text-sm">
                  Choose a customer from the list to view their full communication history,
                  or search for someone by name, phone, or email.
                </p>
                <div className="mt-6 flex items-center justify-center gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#39FF14]">{customers.length}</p>
                    <p className="text-xs text-gray-500">Customers</p>
                  </div>
                  <div className="w-px h-8 bg-gray-700" />
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-400">{recentActivity.length}</p>
                    <p className="text-xs text-gray-500">Recent Events</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Customer header */}
              {selectedCustomer && (
                <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#39FF14]/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-[#39FF14]" />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-white">{selectedCustomer.name}</h2>
                          <div className="flex items-center gap-3 text-sm text-gray-400 mt-0.5">
                            {selectedCustomer.phone && (
                              <a
                                href={`tel:${selectedCustomer.phone}`}
                                className="flex items-center gap-1 hover:text-[#39FF14]"
                              >
                                <Phone className="w-3 h-3" />
                                {formatPhoneDisplay(selectedCustomer.phone)}
                              </a>
                            )}
                            {selectedCustomer.email && (
                              <a
                                href={`mailto:${selectedCustomer.email}`}
                                className="flex items-center gap-1 hover:text-[#39FF14]"
                              >
                                <Mail className="w-3 h-3" />
                                {selectedCustomer.email}
                              </a>
                            )}
                            {selectedCustomer.address && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {selectedCustomer.address}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div className="flex items-center gap-2">
                      {selectedCustomer.phone && (
                        <a
                          href={`tel:${selectedCustomer.phone}`}
                          className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                          title="Call"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => { setComposeChannel('sms'); }}
                        className="p-2 rounded-lg bg-[#39FF14]/10 text-[#39FF14] hover:bg-[#39FF14]/20 transition-colors"
                        title="Text"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setComposeChannel('email'); }}
                        className="p-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
                        title="Email"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setComposeChannel('note'); }}
                        className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
                        title="Add Note"
                      >
                        <StickyNote className="w-4 h-4" />
                      </button>
                      {selectedCustomer.jobNimbusId && (
                        <a
                          href={`https://app.jobnimbus.com/contact/${selectedCustomer.jobNimbusId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600 transition-colors"
                          title="View in JobNimbus"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <Link
                        href={`/command-center/communications/${selectedCustomerId}`}
                        className="p-2 rounded-lg bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600 transition-colors"
                        title="Full page view"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>

                  {/* Rep and status line */}
                  <div className="flex items-center gap-4 mt-2 ml-[52px]">
                    {selectedCustomer.assignedRep && (
                      <span className="text-xs text-gray-500">
                        Rep: <span className="text-gray-400">{selectedCustomer.assignedRep}</span>
                      </span>
                    )}
                    {selectedCustomer.status && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        selectedCustomer.status === 'active'
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-gray-700 text-gray-400'
                      }`}>
                        {selectedCustomer.status}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Thread filter bar */}
              <div className="px-6 py-2 border-b border-gray-700/50 flex items-center gap-2">
                <span className="text-xs text-gray-500 mr-1">Filter:</span>
                {['all', 'call', 'sms', 'email', 'note', 'voicemail', 'document', 'status_change', 'appointment'].map(t => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`text-xs px-2 py-1 rounded-full transition-colors ${
                      filterType === t
                        ? 'bg-[#39FF14]/10 text-[#39FF14]'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    {t === 'all' ? 'All' : t === 'status_change' ? 'Status' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
                <div className="flex-1" />
                <span className="text-xs text-gray-600">{filteredEvents.length} events</span>
              </div>

              {/* Thread content */}
              <div className="flex-1 overflow-y-auto px-6">
                {threadLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-[#39FF14] animate-spin" />
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <div className="flex items-center justify-center py-12 text-center">
                    <div>
                      <Clock className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No communication history yet</p>
                      <p className="text-gray-600 text-xs mt-1">Send a message or add a note to start the thread</p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-800/50">
                    {filteredEvents.map(event => (
                      <EventTimelineItem key={event.id} event={event} />
                    ))}
                    <div ref={threadEndRef} />
                  </div>
                )}
              </div>

              {/* Quick compose area */}
              <div className="border-t border-gray-700 bg-gray-800 px-6 py-3">
                {/* Channel selector */}
                <div className="flex items-center gap-2 mb-2">
                  {(['note', 'sms', 'email'] as const).map(ch => (
                    <button
                      key={ch}
                      onClick={() => setComposeChannel(ch)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors ${
                        composeChannel === ch
                          ? ch === 'note'
                            ? 'bg-yellow-500/10 text-yellow-400'
                            : ch === 'sms'
                            ? 'bg-[#39FF14]/10 text-[#39FF14]'
                            : 'bg-purple-500/10 text-purple-400'
                          : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {ch === 'note' && <StickyNote className="w-3 h-3" />}
                      {ch === 'sms' && <MessageSquare className="w-3 h-3" />}
                      {ch === 'email' && <Mail className="w-3 h-3" />}
                      {ch === 'note' ? 'Note' : ch.toUpperCase()}
                    </button>
                  ))}

                  <div className="flex-1" />

                  {/* Template dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowTemplates(!showTemplates)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-700"
                    >
                      <FileText className="w-3 h-3" />
                      Templates
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    {showTemplates && (
                      <div className="absolute bottom-full right-0 mb-1 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 max-h-64 overflow-y-auto">
                        {QUICK_TEMPLATES.map((tmpl, i) => (
                          <button
                            key={i}
                            onClick={() => handleTemplateSelect(tmpl.text)}
                            className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 border-b border-gray-700/50 last:border-0"
                          >
                            <span className="font-medium text-white text-xs">{tmpl.label}</span>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{tmpl.text}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Input area */}
                <div className="flex items-end gap-2">
                  <textarea
                    value={composeText}
                    onChange={e => setComposeText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      composeChannel === 'note'
                        ? 'Add an internal note...'
                        : composeChannel === 'sms'
                        ? 'Type a text message...'
                        : 'Compose an email...'
                    }
                    rows={2}
                    className="flex-1 bg-gray-900 text-white text-sm rounded-lg px-4 py-2.5 border border-gray-700 focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14]/20 outline-none placeholder-gray-500 resize-none"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!composeText.trim() || sending}
                    className={`p-2.5 rounded-lg transition-colors flex-shrink-0 ${
                      composeText.trim() && !sending
                        ? 'bg-[#39FF14] text-black hover:bg-[#39FF14]/90'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {sending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Stats sidebar (collapsible) */}
        {showStats && selectedCustomerId && threadSummary && (
          <div className="w-[240px] flex-shrink-0 border-l border-gray-700 bg-gray-850 p-4 overflow-y-auto" style={{ backgroundColor: '#1a1d23' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-300">Stats</h3>
              <button onClick={() => setShowStats(false)} className="text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Interactions</p>
                <p className="text-2xl font-bold text-white mt-1">{threadSummary.totalInteractions}</p>
              </div>

              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Response Time</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {threadSummary.avgResponseTime > 0
                    ? `${threadSummary.avgResponseTime}m`
                    : 'N/A'
                  }
                </p>
              </div>

              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Last Inbound</p>
                <p className="text-sm text-gray-300 mt-1">
                  {threadSummary.lastInbound
                    ? formatTimeAgo(threadSummary.lastInbound)
                    : 'None'
                  }
                </p>
              </div>

              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Last Outbound</p>
                <p className="text-sm text-gray-300 mt-1">
                  {threadSummary.lastOutbound
                    ? formatTimeAgo(threadSummary.lastOutbound)
                    : 'None'
                  }
                </p>
              </div>

              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Open Items</p>
                <p className="text-2xl font-bold text-white mt-1">{threadSummary.openItems}</p>
              </div>

              {selectedCustomer && (
                <>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Calls</p>
                    <p className="text-lg font-bold text-blue-400 mt-1">{selectedCustomer.totalCalls}</p>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Messages</p>
                    <p className="text-lg font-bold text-[#39FF14] mt-1">{selectedCustomer.totalMessages}</p>
                  </div>

                  {selectedCustomer.status && (
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Job Status</p>
                      <p className={`text-sm font-medium mt-1 ${
                        selectedCustomer.status === 'active' ? 'text-green-400' : 'text-gray-400'
                      }`}>
                        {selectedCustomer.status}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
