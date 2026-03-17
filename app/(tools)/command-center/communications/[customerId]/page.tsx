'use client';

/**
 * RCRS Command Center - Customer Communication Detail Page
 *
 * Full-page view of a single customer's communication history.
 * Accessed from the communication hub or direct link.
 *
 * Features:
 * - Full-width timeline
 * - Detailed customer profile
 * - All communication channel actions
 * - Related jobs sidebar
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
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
  Send,
  ChevronRight,
  User,
  MapPin,
  Play,
  ArrowUpRight,
  ArrowDownLeft,
  Tag,
  Loader2,
  RefreshCw,
  ArrowLeft,
  X,
  ChevronDown,
  ExternalLink,
  Mic,
  BarChart3,
  Briefcase,
  Hash,
  Copy,
  CheckCircle,
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
  { label: 'Job complete', text: 'Your roof is done! Please take a moment to inspect and let us know if you have any concerns. Thank you for choosing River City Roofing!' },
  { label: 'Thank you', text: 'Thank you for choosing River City Roofing Solutions! We appreciate your business.' },
  { label: 'Weather delay', text: 'Due to weather conditions, we need to reschedule your roofing project. We\'ll reach out with new dates as soon as possible.' },
];

// =============================================================================
// Helpers
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
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimestamp(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
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

// Event type config
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

function getEventLabel(type: string): string {
  switch (type) {
    case 'call': return 'Phone Call';
    case 'sms': return 'Text Message';
    case 'email': return 'Email';
    case 'note': return 'Internal Note';
    case 'voicemail': return 'Voicemail';
    case 'document': return 'Document';
    case 'status_change': return 'Status Change';
    case 'appointment': return 'Appointment';
    default: return type;
  }
}

// =============================================================================
// Timeline Event Component (full-width variant)
// =============================================================================

function FullEventItem({ event }: { event: CommunicationEvent }) {
  const Icon = getEventIcon(event.type);
  const colorClass = getEventColor(event.type, event.direction);
  const isOutbound = event.direction === 'outbound';
  const isBubbleType = event.type === 'sms' || event.type === 'email';

  return (
    <div className="flex gap-4 py-4 group">
      {/* Vertical line + icon */}
      <div className="flex flex-col items-center">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          event.type === 'call' || event.type === 'voicemail'
            ? 'bg-blue-500/10'
            : event.type === 'note'
            ? 'bg-yellow-500/10'
            : event.type === 'sms'
            ? isOutbound ? 'bg-[#39FF14]/10' : 'bg-gray-700'
            : event.type === 'email'
            ? 'bg-purple-500/10'
            : event.type === 'appointment'
            ? 'bg-indigo-500/10'
            : event.type === 'status_change'
            ? 'bg-pink-500/10'
            : event.type === 'document'
            ? 'bg-cyan-500/10'
            : 'bg-gray-700'
        }`}>
          <Icon className={`w-5 h-5 ${colorClass}`} />
        </div>
        <div className="w-px flex-1 bg-gray-800 mt-2" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-2">
        {/* Header row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className={`font-medium ${colorClass}`}>
              {getEventLabel(event.type)}
            </span>
            {event.direction && (
              <span className="flex items-center gap-1 text-gray-500 text-xs">
                {event.direction === 'inbound'
                  ? <><ArrowDownLeft className="w-3 h-3 text-blue-400" /> Inbound</>
                  : <><ArrowUpRight className="w-3 h-3 text-green-400" /> Outbound</>
                }
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500 flex-shrink-0">{formatTimestamp(event.timestamp)}</span>
        </div>

        {/* From/To */}
        <p className="text-sm text-gray-400 mt-1">
          <span className="text-gray-500">From:</span> {event.from}
          {event.to && <><span className="text-gray-600 mx-2">&rarr;</span><span className="text-gray-500">To:</span> {event.to}</>}
          {event.repName && <span className="text-gray-600 ml-2">({event.repName})</span>}
        </p>

        {/* Subject */}
        {event.subject && (
          <p className="text-sm font-medium text-white mt-2">{event.subject}</p>
        )}

        {/* Body */}
        {isBubbleType ? (
          <div className={`mt-2 p-4 rounded-lg text-sm leading-relaxed max-w-2xl ${
            isOutbound
              ? 'bg-[#39FF14]/10 text-gray-200 border border-[#39FF14]/20'
              : 'bg-gray-800 text-gray-200 border border-gray-700'
          }`}>
            {event.body}
          </div>
        ) : event.type === 'note' ? (
          <div className="mt-2 p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-sm text-gray-300 leading-relaxed max-w-2xl">
            {event.body}
          </div>
        ) : event.type === 'status_change' ? (
          <div className="mt-2 flex items-center gap-2 p-3 rounded-lg bg-pink-500/5 border border-pink-500/20">
            <Tag className="w-4 h-4 text-pink-400" />
            <span className="text-sm text-gray-300">{event.body}</span>
          </div>
        ) : event.type === 'appointment' ? (
          <div className="mt-2 p-4 rounded-lg bg-indigo-500/5 border border-indigo-500/20 text-sm text-gray-300">
            <Calendar className="w-4 h-4 text-indigo-400 inline mr-2" />
            {event.body}
          </div>
        ) : (
          <p className="text-sm text-gray-300 mt-2 leading-relaxed">{event.body}</p>
        )}

        {/* Call details */}
        {(event.type === 'call' || event.type === 'voicemail') && (
          <div className="flex items-center gap-4 mt-3">
            {event.duration !== undefined && event.duration > 0 && (
              <span className="text-xs text-gray-500 flex items-center gap-1 bg-gray-800 px-2 py-1 rounded">
                <Clock className="w-3 h-3" />
                Duration: {formatDuration(event.duration)}
              </span>
            )}
            {event.metadata?.status && (
              <span className={`text-xs px-2 py-1 rounded ${
                event.metadata.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                event.metadata.status === 'missed' ? 'bg-red-500/10 text-red-400' :
                event.metadata.status === 'voicemail' ? 'bg-orange-500/10 text-orange-400' :
                'bg-gray-700 text-gray-400'
              }`}>
                {event.metadata.status}
              </span>
            )}
            {event.recordingUrl && (
              <button className="text-xs text-[#39FF14] flex items-center gap-1 hover:underline bg-[#39FF14]/5 px-2 py-1 rounded">
                <Play className="w-3 h-3" />
                Play Recording
              </button>
            )}
          </div>
        )}

        {/* Attachments */}
        {event.attachments && event.attachments.length > 0 && (
          <div className="mt-3 space-y-1">
            {event.attachments.map((att, i) => (
              <a
                key={i}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs text-cyan-400 hover:underline bg-cyan-500/5 px-3 py-1.5 rounded mr-2"
              >
                <FileText className="w-3 h-3" />
                {att.name}
                <ExternalLink className="w-3 h-3" />
              </a>
            ))}
          </div>
        )}

        {/* Unread indicator */}
        {!event.isRead && (
          <div className="mt-2">
            <span className="inline-flex items-center gap-1 text-xs text-[#39FF14]">
              <span className="w-2 h-2 rounded-full bg-[#39FF14]" />
              Unread
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function CustomerCommunicationDetailPage() {
  const params = useParams();
  const customerId = params.customerId as string;

  // Data state
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [events, setEvents] = useState<CommunicationEvent[]>([]);
  const [summary, setSummary] = useState<ThreadSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [filterType, setFilterType] = useState<string>('all');
  const [showTemplates, setShowTemplates] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Compose state
  const [composeChannel, setComposeChannel] = useState<'note' | 'sms' | 'email'>('note');
  const [composeText, setComposeText] = useState('');
  const [sending, setSending] = useState(false);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchThread = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/communications/${customerId}?limit=500`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCustomer(data.data.customer || null);
          setEvents(data.data.events || []);
          setSummary(data.data.summary || null);
        } else {
          setError(data.error || 'Failed to load customer data');
        }
      } else {
        setError('Failed to load customer data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleSend = async () => {
    if (!composeText.trim() || !customerId || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/communications/${customerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: composeChannel,
          content: composeText.trim(),
          author: 'Admin',
        }),
      });

      if (res.ok) {
        setComposeText('');
        await fetchThread();
      }
    } catch (err) {
      console.error('Send failed:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  // Filter events
  const filteredEvents = filterType === 'all'
    ? events
    : events.filter(e => e.type === filterType);

  // Group events by date
  const eventsByDate = new Map<string, CommunicationEvent[]>();
  filteredEvents.forEach(event => {
    const dateKey = new Date(event.timestamp).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const group = eventsByDate.get(dateKey) || [];
    group.push(event);
    eventsByDate.set(dateKey, group);
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#39FF14] animate-spin mx-auto mb-3" />
          <p className="text-gray-400">Loading customer communications...</p>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <User className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 mb-4">{error || 'Customer not found'}</p>
          <Link href="/command-center/communications" className="text-[#39FF14] hover:underline text-sm">
            &larr; Back to Communication Hub
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {/* Back link */}
          <Link
            href="/command-center/communications"
            className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-[#39FF14] mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Communication Hub
          </Link>

          {/* Customer profile */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-[#39FF14]/10 flex items-center justify-center flex-shrink-0">
                <User className="w-7 h-7 text-[#39FF14]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{customer.name}</h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                  {customer.phone && (
                    <button
                      onClick={() => handleCopy(customer.phone, 'phone')}
                      className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#39FF14] group"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {formatPhoneDisplay(customer.phone)}
                      {copied === 'phone' ? (
                        <CheckCircle className="w-3 h-3 text-green-400" />
                      ) : (
                        <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                      )}
                    </button>
                  )}
                  {customer.email && (
                    <button
                      onClick={() => handleCopy(customer.email, 'email')}
                      className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#39FF14] group"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      {customer.email}
                      {copied === 'email' ? (
                        <CheckCircle className="w-3 h-3 text-green-400" />
                      ) : (
                        <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                      )}
                    </button>
                  )}
                  {customer.address && (
                    <span className="flex items-center gap-1.5 text-sm text-gray-400">
                      <MapPin className="w-3.5 h-3.5" />
                      {customer.address}
                    </span>
                  )}
                </div>

                {/* Tags row */}
                <div className="flex items-center gap-3 mt-2">
                  {customer.assignedRep && (
                    <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded">
                      Rep: {customer.assignedRep}
                    </span>
                  )}
                  {customer.status && (
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      customer.status === 'active'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-gray-700 text-gray-400'
                    }`}>
                      {customer.status}
                    </span>
                  )}
                  {customer.jobNimbusId && (
                    <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      JN: {customer.jobNimbusId.slice(0, 8)}
                    </span>
                  )}
                  {customer.jobIds.length > 0 && (
                    <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded flex items-center gap-1">
                      <Briefcase className="w-3 h-3" />
                      {customer.jobIds.length} Job{customer.jobIds.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {customer.phone && (
                <a
                  href={`tel:${customer.phone}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors text-sm font-medium"
                >
                  <Phone className="w-4 h-4" />
                  Call
                </a>
              )}
              <button
                onClick={() => setComposeChannel('sms')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#39FF14]/10 text-[#39FF14] hover:bg-[#39FF14]/20 transition-colors text-sm font-medium"
              >
                <MessageSquare className="w-4 h-4" />
                Text
              </button>
              <button
                onClick={() => setComposeChannel('email')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors text-sm font-medium"
              >
                <Mail className="w-4 h-4" />
                Email
              </button>
              <button
                onClick={() => setComposeChannel('note')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors text-sm font-medium"
              >
                <StickyNote className="w-4 h-4" />
                Note
              </button>
              {customer.jobNimbusId && (
                <a
                  href={`https://app.jobnimbus.com/contact/${customer.jobNimbusId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600 transition-colors text-sm font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  JobNimbus
                </a>
              )}
              <button
                onClick={fetchThread}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="max-w-7xl mx-auto flex gap-6 px-6 py-6">
        {/* Main timeline */}
        <div className="flex-1 min-w-0">
          {/* Stats bar */}
          {summary && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Interactions</p>
                <p className="text-2xl font-bold text-white mt-1">{summary.totalInteractions}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Response</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {summary.avgResponseTime > 0 ? `${summary.avgResponseTime}m` : 'N/A'}
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Last Contact</p>
                <p className="text-lg font-semibold text-white mt-1">
                  {customer.lastContact ? formatTimeAgo(customer.lastContact) : 'Never'}
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Open Items</p>
                <p className="text-2xl font-bold text-white mt-1">{summary.openItems}</p>
              </div>
            </div>
          )}

          {/* Filter bar */}
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700/50">
            <span className="text-sm text-gray-500 mr-1">Show:</span>
            {['all', 'call', 'sms', 'email', 'note', 'voicemail', 'document', 'status_change', 'appointment'].map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                  filterType === t
                    ? 'bg-[#39FF14]/10 text-[#39FF14] ring-1 ring-[#39FF14]/20'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                }`}
              >
                {t === 'all' ? 'All' : t === 'status_change' ? 'Status' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
            <div className="flex-1" />
            <span className="text-xs text-gray-600">{filteredEvents.length} events</span>
          </div>

          {/* Timeline grouped by date */}
          {filteredEvents.length === 0 ? (
            <div className="py-16 text-center">
              <Clock className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500">No communication history</p>
              <p className="text-gray-600 text-sm mt-1">Use the compose area below to start a conversation</p>
            </div>
          ) : (
            Array.from(eventsByDate.entries()).map(([dateLabel, dateEvents]) => (
              <div key={dateLabel} className="mb-6">
                <div className="sticky top-0 bg-gray-900 py-2 z-10">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide bg-gray-900 pr-3">
                    {dateLabel}
                  </span>
                  <div className="h-px bg-gray-800 -mt-2.5 ml-[200px]" />
                </div>
                <div className="space-y-0">
                  {dateEvents.map(event => (
                    <FullEventItem key={event.id} event={event} />
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Compose area */}
          <div className="mt-6 bg-gray-800 rounded-lg border border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {(['note', 'sms', 'email'] as const).map(ch => (
                  <button
                    key={ch}
                    onClick={() => setComposeChannel(ch)}
                    className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full transition-colors ${
                      composeChannel === ch
                        ? ch === 'note'
                          ? 'bg-yellow-500/10 text-yellow-400'
                          : ch === 'sms'
                          ? 'bg-[#39FF14]/10 text-[#39FF14]'
                          : 'bg-purple-500/10 text-purple-400'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {ch === 'note' && <StickyNote className="w-3.5 h-3.5" />}
                    {ch === 'sms' && <MessageSquare className="w-3.5 h-3.5" />}
                    {ch === 'email' && <Mail className="w-3.5 h-3.5" />}
                    {ch === 'note' ? 'Note' : ch.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-700"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Templates
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showTemplates && (
                  <div className="absolute bottom-full right-0 mb-1 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 max-h-72 overflow-y-auto">
                    {QUICK_TEMPLATES.map((tmpl, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setComposeText(tmpl.text);
                          setShowTemplates(false);
                        }}
                        className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 border-b border-gray-700/50 last:border-0"
                      >
                        <span className="font-medium text-white text-xs">{tmpl.label}</span>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{tmpl.text}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-end gap-3">
              <textarea
                value={composeText}
                onChange={e => setComposeText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  composeChannel === 'note'
                    ? 'Add an internal note about this customer...'
                    : composeChannel === 'sms'
                    ? 'Type a text message to send...'
                    : 'Compose an email...'
                }
                rows={3}
                className="flex-1 bg-gray-900 text-white text-sm rounded-lg px-4 py-3 border border-gray-700 focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14]/20 outline-none placeholder-gray-500 resize-none"
              />
              <button
                onClick={handleSend}
                disabled={!composeText.trim() || sending}
                className={`px-6 py-3 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium ${
                  composeText.trim() && !sending
                    ? 'bg-[#39FF14] text-black hover:bg-[#39FF14]/90'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {composeChannel === 'note' ? 'Save Note' : 'Send'}
              </button>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-[260px] flex-shrink-0 space-y-4">
          {/* Customer details card */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Customer Details</h3>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Customer ID</p>
                <p className="text-sm text-gray-300 font-mono">{customer.id}</p>
              </div>
              {customer.leadId && (
                <div>
                  <p className="text-xs text-gray-500">Lead ID</p>
                  <p className="text-sm text-gray-300 font-mono">{customer.leadId}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500">Total Calls</p>
                <p className="text-sm text-blue-400 font-semibold">{customer.totalCalls}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Messages</p>
                <p className="text-sm text-[#39FF14] font-semibold">{customer.totalMessages}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Last Contact</p>
                <p className="text-sm text-gray-300">{formatTimeAgo(customer.lastContact)}</p>
              </div>
            </div>
          </div>

          {/* Response time card */}
          {summary && (
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Response Metrics</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Avg Response Time</p>
                  <p className="text-lg font-bold text-white">
                    {summary.avgResponseTime > 0 ? `${summary.avgResponseTime} min` : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Last Inbound</p>
                  <p className="text-sm text-gray-300">
                    {summary.lastInbound ? formatTimeAgo(summary.lastInbound) : 'None'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Last Outbound</p>
                  <p className="text-sm text-gray-300">
                    {summary.lastOutbound ? formatTimeAgo(summary.lastOutbound) : 'None'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Related jobs */}
          {customer.jobIds.length > 0 && (
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-gray-500" />
                Related Jobs
              </h3>
              <div className="space-y-2">
                {customer.jobIds.map(jobId => (
                  <div
                    key={jobId}
                    className="text-xs text-gray-400 bg-gray-900 rounded px-3 py-2 flex items-center justify-between"
                  >
                    <span className="font-mono">{jobId.slice(0, 12)}...</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick links */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Quick Links</h3>
            <div className="space-y-2">
              <Link
                href="/command-center/communications"
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#39FF14] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Communication Hub
              </Link>
              <Link
                href="/command-center/phone"
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#39FF14] transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                Phone Dashboard
              </Link>
              <Link
                href="/command-center/leads"
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#39FF14] transition-colors"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Lead Management
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
