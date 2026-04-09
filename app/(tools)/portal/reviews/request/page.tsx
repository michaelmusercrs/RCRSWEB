'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  Phone,
  User,
  Star,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

type RequestStatus = 'pending' | 'sent' | 'opened' | 'completed' | 'declined';

interface ReviewRequest {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  jobId: string;
  jobType?: string;
  completionDate?: string;
  repSlug: string;
  repName?: string;
  method: string;
  sentAt: string;
  status: RequestStatus;
  reminderCount: number;
  lastReminderAt?: string;
  emailSent?: boolean;
  emailError?: string;
  reviewId?: string;
  createdAt: string;
}

// =============================================================================
// SALES REPS (for dropdown)
// =============================================================================

const SALES_REPS = [
  { slug: 'hunter', name: 'Hunter Rivers' },
  { slug: 'aaron', name: 'Aaron Lussi' },
  { slug: 'greg', name: 'Greg Muse' },
  { slug: 'brendon', name: 'Brendon Muse' },
  { slug: 'adam', name: 'Adam Rudell' },
  { slug: 'joseph', name: 'Joseph Dowd' },
  { slug: 'alijah', name: 'Alijah' },
  { slug: 'travis', name: 'Travis Wages' },
  { slug: 'richard', name: 'Richard Geahr' },
];

const JOB_TYPES = [
  'Roof Replacement',
  'Roof Repair',
  'Storm Damage Repair',
  'Gutter Installation',
  'Gutter Repair',
  'Siding Installation',
  'Insurance Claim',
  'Inspection',
  'Other',
];

// =============================================================================
// HELPERS
// =============================================================================

const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'bg-gray-500/20 text-gray-400', icon: <Clock className="w-3 h-3" /> },
  sent: { label: 'Sent', color: 'bg-blue-500/20 text-blue-400', icon: <Mail className="w-3 h-3" /> },
  opened: { label: 'Opened', color: 'bg-yellow-500/20 text-yellow-400', icon: <ExternalLink className="w-3 h-3" /> },
  completed: { label: 'Reviewed', color: 'bg-green-500/20 text-green-400', icon: <CheckCircle2 className="w-3 h-3" /> },
  declined: { label: 'Declined', color: 'bg-red-500/20 text-red-400', icon: <XCircle className="w-3 h-3" /> },
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function ReviewRequestPage() {
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Form state
  const [form, setForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    jobType: '',
    completionDate: '',
    repSlug: '',
  });

  // -------------------------------------------------------------------------
  // DATA LOADING
  // -------------------------------------------------------------------------

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/reviews/request?limit=50');
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Failed to fetch review requests:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // -------------------------------------------------------------------------
  // FORM SUBMISSION
  // -------------------------------------------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    // Find rep name from slug
    const rep = SALES_REPS.find(r => r.slug === form.repSlug);

    try {
      const res = await fetch('/api/reviews/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: form.customerName.trim(),
          customerEmail: form.customerEmail.trim().toLowerCase(),
          customerPhone: form.customerPhone.trim(),
          jobType: form.jobType,
          completionDate: form.completionDate || undefined,
          repSlug: form.repSlug,
          repName: rep?.name || form.repSlug,
          method: 'email',
        }),
      });

      const data = await res.json();

      if (res.status === 429) {
        setErrorMessage(data.error || 'Rate limit exceeded. Only one request per customer per 30 days.');
        return;
      }

      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to send review request.');
        return;
      }

      if (data.success) {
        const emailNote = data.request?.emailSent
          ? 'Email sent successfully!'
          : 'Request logged (email may be pending).';
        setSuccessMessage(`Review request sent to ${form.customerName}. ${emailNote}`);
        setForm({
          customerName: '',
          customerEmail: '',
          customerPhone: '',
          jobType: '',
          completionDate: '',
          repSlug: '',
        });
        await fetchRequests();
      }
    } catch (error) {
      console.error('Failed to send review request:', error);
      setErrorMessage('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // REMIND ACTION
  // -------------------------------------------------------------------------

  const handleRemind = async (requestId: string) => {
    try {
      await fetch('/api/reviews/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remind', requestId }),
      });
      await fetchRequests();
    } catch (error) {
      console.error('Failed to send reminder:', error);
    }
  };

  // -------------------------------------------------------------------------
  // STATS
  // -------------------------------------------------------------------------

  const totalSent = requests.length;
  const totalCompleted = requests.filter(r => r.status === 'completed').length;
  const totalPending = requests.filter(r => r.status === 'sent' || r.status === 'opened').length;
  const conversionRate = totalSent > 0 ? Math.round((totalCompleted / totalSent) * 100) : 0;

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/portal/reviews" className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold">Request Google Reviews</h1>
          </div>
          <p className="text-gray-400 text-sm ml-8">
            Send personalized review requests to customers after job completion
          </p>
        </div>
        <a
          href="https://g.page/r/CdVKlmRIhPZ-EBM/review"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-lg hover:bg-blue-600/30 transition text-sm self-start"
        >
          <ExternalLink className="w-4 h-4" />
          View Google Reviews
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="text-2xl font-bold text-[#39FF14]">{totalSent}</div>
          <div className="text-sm text-gray-400">Total Sent</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="text-2xl font-bold text-blue-400">{totalPending}</div>
          <div className="text-sm text-gray-400">Awaiting Review</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="text-2xl font-bold text-green-400">{totalCompleted}</div>
          <div className="text-sm text-gray-400">Completed</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="text-2xl font-bold text-yellow-400">{conversionRate}%</div>
          <div className="text-sm text-gray-400">Conversion Rate</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ============================================================= */}
        {/* SEND REQUEST FORM - Left Column */}
        {/* ============================================================= */}
        <div className="lg:col-span-2">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 sticky top-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Send className="w-5 h-5 text-[#39FF14]" />
              Send Review Request
            </h2>

            {/* Success Message */}
            {successMessage && (
              <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-400">{successMessage}</p>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{errorMessage}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Customer Name */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Customer Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={form.customerName}
                    onChange={e => setForm(prev => ({ ...prev, customerName: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:border-[#39FF14]/50 focus:outline-none focus:ring-1 focus:ring-[#39FF14]/30"
                    placeholder="John Smith"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Email <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="email"
                    value={form.customerEmail}
                    onChange={e => setForm(prev => ({ ...prev, customerEmail: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:border-[#39FF14]/50 focus:outline-none focus:ring-1 focus:ring-[#39FF14]/30"
                    placeholder="customer@email.com"
                    required
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Phone <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="tel"
                    value={form.customerPhone}
                    onChange={e => setForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:border-[#39FF14]/50 focus:outline-none focus:ring-1 focus:ring-[#39FF14]/30"
                    placeholder="(256) 555-1234"
                    required
                  />
                </div>
              </div>

              {/* Job Type */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Job Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.jobType}
                  onChange={e => setForm(prev => ({ ...prev, jobType: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:border-[#39FF14]/50 focus:outline-none focus:ring-1 focus:ring-[#39FF14]/30"
                  required
                >
                  <option value="">Select job type...</option>
                  {JOB_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Completion Date */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Completion Date
                </label>
                <input
                  type="date"
                  value={form.completionDate}
                  onChange={e => setForm(prev => ({ ...prev, completionDate: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:border-[#39FF14]/50 focus:outline-none focus:ring-1 focus:ring-[#39FF14]/30"
                />
              </div>

              {/* Rep Name */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Sales Rep <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.repSlug}
                  onChange={e => setForm(prev => ({ ...prev, repSlug: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:border-[#39FF14]/50 focus:outline-none focus:ring-1 focus:ring-[#39FF14]/30"
                  required
                >
                  <option value="">Select rep...</option>
                  {SALES_REPS.map(rep => (
                    <option key={rep.slug} value={rep.slug}>{rep.name}</option>
                  ))}
                </select>
              </div>

              {/* Email Preview */}
              <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                <div className="text-xs text-gray-400 mb-2 font-medium">Email Preview</div>
                <div className="bg-white rounded-lg overflow-hidden">
                  <div className="bg-black p-3 text-center">
                    <span className="text-[#39FF14] font-bold text-sm">River City Roofing Solutions</span>
                  </div>
                  <div className="p-4 text-xs text-gray-700 leading-relaxed">
                    <p>Hi {form.customerName ? form.customerName.split(' ')[0] : '[Customer]'},</p>
                    <p className="mt-2">
                      Thank you for choosing River City Roofing Solutions
                      {form.jobType ? ` on your ${form.jobType.toLowerCase()}` : ''}!
                      We truly appreciate your business...
                    </p>
                    <div className="text-center my-3">
                      <span className="inline-block bg-[#39FF14] text-black px-4 py-1.5 rounded font-bold text-xs">
                        Leave a Google Review
                      </span>
                    </div>
                    {form.repSlug && (
                      <p className="text-gray-500 mt-2">
                        Your project was handled by <strong>{SALES_REPS.find(r => r.slug === form.repSlug)?.name}</strong>.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full px-4 py-3 bg-[#39FF14] text-black rounded-lg hover:bg-[#32e612] transition font-bold disabled:opacity-50 flex items-center justify-center gap-2 text-base"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send Review Request
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center">
                Limit: 1 request per email every 30 days
              </p>
            </form>
          </div>
        </div>

        {/* ============================================================= */}
        {/* REQUEST HISTORY - Right Column */}
        {/* ============================================================= */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-400" />
              Request History
            </h2>
            <button
              onClick={() => { setLoading(true); fetchRequests(); }}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-[#39FF14] animate-spin" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16 bg-gray-800 rounded-xl border border-gray-700">
              <Star className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-lg text-gray-400">No review requests sent yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Use the form to send your first review request
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map(req => {
                const statusInfo = STATUS_CONFIG[req.status];
                return (
                  <div
                    key={req.id}
                    className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Customer name and status */}
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="font-semibold text-white">{req.customerName}</span>
                          <span className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${statusInfo.color}`}>
                            {statusInfo.icon}
                            {statusInfo.label}
                          </span>
                          {req.emailSent === false && req.emailError && (
                            <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400 flex items-center gap-1">
                              <XCircle className="w-3 h-3" />
                              Email Failed
                            </span>
                          )}
                        </div>

                        {/* Details row */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {req.customerEmail}
                          </span>
                          {req.customerPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {req.customerPhone}
                            </span>
                          )}
                          {req.jobType && (
                            <span className="text-gray-300 font-medium">{req.jobType}</span>
                          )}
                          {req.repName && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {req.repName}
                            </span>
                          )}
                        </div>

                        {/* Timestamp */}
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1.5">
                          <span>Sent: {formatDate(req.sentAt)} at {formatTime(req.sentAt)}</span>
                          {req.reminderCount > 0 && (
                            <span className="text-yellow-400">
                              {req.reminderCount} reminder{req.reminderCount > 1 ? 's' : ''} sent
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 flex-shrink-0">
                        {(req.status === 'sent' || req.status === 'opened') && (
                          <button
                            onClick={() => handleRemind(req.id)}
                            className="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition text-xs flex items-center gap-1 border border-blue-600/30"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Remind
                          </button>
                        )}
                        {req.status === 'completed' && (
                          <span className="px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-xs flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Done
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
