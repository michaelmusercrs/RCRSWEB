'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
  Eye,
  RefreshCw,
  Inbox,
  AlertTriangle,
  History,
  FileText,
  ArrowLeft,
} from 'lucide-react';

interface ProfileChanges {
  bio?: string;
  tagline?: string;
  phone?: string;
  email?: string;
  altEmail?: string;
  profileImage?: string;
  facebook?: string;
  instagram?: string;
  x?: string;
  tiktok?: string;
  linkedin?: string;
  keyStrengths?: string[];
  responsibilities?: string[];
}

interface ProfileEditRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userSlug: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  changes: ProfileChanges;
  originalData: ProfileChanges;
}

export default function ApprovalsPage() {
  const [edits, setEdits] = useState<ProfileEditRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedEdit, setExpandedEdit] = useState<string | null>(null);
  const [rejectingEdit, setRejectingEdit] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch pending edits
  const fetchEdits = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/profile/pending?history=${showHistory}`);
      if (response.ok) {
        const data = await response.json();
        setEdits(data.edits);
      }
    } catch (error) {
      console.error('Error fetching edits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEdits();
  }, [showHistory]);

  // Approve an edit
  const handleApprove = async (editId: string) => {
    setIsProcessing(true);
    setMessage(null);

    try {
      const response = await fetch('/api/profile/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          editId,
          reviewerName: 'Admin',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message });
        fetchEdits();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to approve edit' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Reject an edit
  const handleReject = async (editId: string) => {
    if (!rejectReason.trim()) {
      setMessage({ type: 'error', text: 'Please provide a reason for rejection' });
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      const response = await fetch('/api/profile/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          editId,
          reviewerName: 'Admin',
          reason: rejectReason,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Edit rejected successfully' });
        setRejectingEdit(null);
        setRejectReason('');
        fetchEdits();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to reject edit' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            <Clock size={12} />
            Pending
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
            <CheckCircle2 size={12} />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
            <XCircle size={12} />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  // Render change comparison
  const renderChanges = (edit: ProfileEditRequest) => {
    const changeFields = Object.keys(edit.changes) as (keyof ProfileChanges)[];

    return (
      <div className="space-y-4">
        {changeFields.map((field) => {
          const newValue = edit.changes[field];
          const oldValue = edit.originalData[field];

          // Skip if values are the same
          if (JSON.stringify(newValue) === JSON.stringify(oldValue)) return null;

          return (
            <div key={field} className="border border-white/10 rounded-lg overflow-hidden">
              <div className="bg-white/5 px-4 py-2 border-b border-white/10">
                <span className="text-sm font-medium text-neutral-300 capitalize">
                  {field.replace(/([A-Z])/g, ' $1').trim()}
                </span>
              </div>
              <div className="grid md:grid-cols-2 gap-4 p-4">
                {/* Original */}
                <div>
                  <span className="text-xs text-red-400 font-medium uppercase tracking-wide">Original</span>
                  <div className="mt-2 text-sm text-neutral-400 bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                    {Array.isArray(oldValue) ? (
                      <ul className="list-disc list-inside space-y-1">
                        {(oldValue as string[]).map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      oldValue || <span className="italic">Not set</span>
                    )}
                  </div>
                </div>
                {/* New */}
                <div>
                  <span className="text-xs text-green-400 font-medium uppercase tracking-wide">Proposed Change</span>
                  <div className="mt-2 text-sm text-neutral-200 bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                    {Array.isArray(newValue) ? (
                      <ul className="list-disc list-inside space-y-1">
                        {(newValue as string[]).map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      newValue || <span className="italic">Not set</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const pendingCount = edits.filter(e => e.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/admin"
              className="text-neutral-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-2xl font-bold text-white">Profile Approvals</h1>
            {pendingCount > 0 && (
              <span className="px-2 py-1 rounded-full text-xs font-bold bg-yellow-500 text-black">
                {pendingCount} pending
              </span>
            )}
          </div>
          <p className="text-neutral-400">
            Review and approve team member profile changes before they go live.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchEdits}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/10 text-neutral-300 rounded-lg transition-colors"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showHistory
                ? 'bg-brand-green text-black'
                : 'bg-white/10 hover:bg-white/10 text-neutral-300'
            }`}
          >
            <History size={16} />
            {showHistory ? 'Showing All' : 'Show History'}
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 size={20} />
          ) : (
            <AlertTriangle size={20} />
          )}
          {message.text}
          <button
            onClick={() => setMessage(null)}
            className="ml-auto text-current opacity-50 hover:opacity-100"
          >
            <XCircle size={16} />
          </button>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={32} className="animate-spin text-neutral-500" />
        </div>
      ) : edits.length === 0 ? (
        <div className="text-center py-12 bg-neutral-900 rounded-xl border border-white/10">
          <Inbox size={48} className="mx-auto text-neutral-400 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No pending approvals</h3>
          <p className="text-neutral-500">
            {showHistory
              ? 'No profile edit requests have been submitted yet.'
              : 'All profile edit requests have been processed.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {edits.map((edit) => (
            <div
              key={edit.id}
              className="bg-neutral-900 rounded-xl border border-white/10 overflow-hidden "
            >
              {/* Edit Header */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-brand-green/10 flex items-center justify-center">
                    <User size={24} className="text-brand-green" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{edit.userName}</h3>
                      {getStatusBadge(edit.status)}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-500">
                      <Calendar size={14} />
                      Submitted {formatDate(edit.submittedAt)}
                    </div>
                    {edit.reviewedBy && (
                      <div className="text-sm text-neutral-500 mt-1">
                        Reviewed by {edit.reviewedBy} on {formatDate(edit.reviewedAt!)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/team/${edit.userSlug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-neutral-400 hover:text-white border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <Eye size={14} />
                    View Profile
                  </Link>
                  <button
                    onClick={() =>
                      setExpandedEdit(expandedEdit === edit.id ? null : edit.id)
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-neutral-400 hover:text-white border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <FileText size={14} />
                    {expandedEdit === edit.id ? 'Hide' : 'View'} Changes
                    {expandedEdit === edit.id ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded Changes */}
              {expandedEdit === edit.id && (
                <div className="border-t border-white/10 p-4 bg-white/5">
                  <h4 className="font-medium text-white mb-4">Proposed Changes</h4>
                  {renderChanges(edit)}

                  {/* Rejection Reason (if rejected) */}
                  {edit.status === 'rejected' && edit.rejectionReason && (
                    <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <div className="font-medium text-red-400 mb-1">Rejection Reason:</div>
                      <div className="text-red-400">{edit.rejectionReason}</div>
                    </div>
                  )}

                  {/* Action Buttons (only for pending) */}
                  {edit.status === 'pending' && (
                    <div className="mt-6 pt-4 border-t border-white/10">
                      {rejectingEdit === edit.id ? (
                        <div className="space-y-3">
                          <label className="block">
                            <span className="text-sm font-medium text-neutral-300">
                              Rejection Reason
                            </span>
                            <textarea
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              className="mt-1 block w-full rounded-lg border border-white/10 px-3 py-2 text-sm focus:border-brand-green focus:ring-brand-green focus:outline-none"
                              rows={3}
                              placeholder="Please provide a reason for rejection..."
                            />
                          </label>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleReject(edit.id)}
                              disabled={isProcessing}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                              <XCircle size={16} />
                              Confirm Rejection
                            </button>
                            <button
                              onClick={() => {
                                setRejectingEdit(null);
                                setRejectReason('');
                              }}
                              className="px-4 py-2 text-neutral-400 hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleApprove(edit.id)}
                            disabled={isProcessing}
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-green hover:bg-lime-400 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 size={18} />
                            Approve Changes
                          </button>
                          <button
                            onClick={() => setRejectingEdit(edit.id)}
                            disabled={isProcessing}
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/10 hover:bg-white/10 text-neutral-300 font-medium rounded-lg transition-colors disabled:opacity-50"
                          >
                            <XCircle size={18} />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
