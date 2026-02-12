'use client';

// Manager Lead Controls
// Toggle reps on/off for receiving leads, set auto-resume timers

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, ToggleLeft, ToggleRight, Clock, AlertCircle, ArrowLeft, Loader2, CheckCircle, Shield } from 'lucide-react';

interface RepStatus {
  repSlug: string;
  repName: string;
  role: string;
  isActive: boolean;
  isReceivingLeads: boolean;
  adminOverride: boolean;
  adminOverrideBy: string;
  adminOverrideReason: string;
  autoResumeAt: string;
  updatedAt: string;
}

export default function LeadControlsPage() {
  const [reps, setReps] = useState<RepStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showTimerModal, setShowTimerModal] = useState<string | null>(null);
  const [timerHours, setTimerHours] = useState('24');
  const [overrideReason, setOverrideReason] = useState('');

  useEffect(() => {
    loadReps();
  }, []);

  const loadReps = async () => {
    try {
      const response = await fetch('/api/portal/rep-availability');
      if (response.ok) {
        const data = await response.json();
        setReps(data.data || []);
      }
    } catch (error) {
      console.error('Error loading reps:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRep = async (repSlug: string, currentStatus: boolean) => {
    setSaving(repSlug);
    setMessage(null);

    try {
      const response = await fetch('/api/portal/rep-availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repSlug,
          isReceivingLeads: !currentStatus,
          adminOverride: !currentStatus === false,
          adminOverrideBy: 'manager', // In production, use actual user
          adminOverrideReason: overrideReason || (currentStatus ? 'Turned off by manager' : 'Turned on by manager'),
        }),
      });

      if (response.ok) {
        setReps(prev => prev.map(r =>
          r.repSlug === repSlug ? { ...r, isReceivingLeads: !currentStatus, adminOverride: !currentStatus === false } : r
        ));
        setMessage({ type: 'success', text: `${repSlug} ${!currentStatus ? 'enabled' : 'disabled'} for leads` });
      } else {
        setMessage({ type: 'error', text: 'Failed to update' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSaving(null);
    }
  };

  const setAutoResume = async (repSlug: string) => {
    setSaving(repSlug);
    const resumeAt = new Date(Date.now() + parseInt(timerHours) * 60 * 60 * 1000).toISOString();

    try {
      const response = await fetch('/api/portal/rep-availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repSlug,
          isReceivingLeads: false,
          adminOverride: true,
          adminOverrideReason: overrideReason || `Off for ${timerHours} hours`,
          autoResumeAt: resumeAt,
        }),
      });

      if (response.ok) {
        setReps(prev => prev.map(r =>
          r.repSlug === repSlug ? { ...r, isReceivingLeads: false, adminOverride: true, autoResumeAt: resumeAt } : r
        ));
        setMessage({ type: 'success', text: `${repSlug} will resume receiving leads in ${timerHours} hours` });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to set timer' });
    } finally {
      setSaving(null);
      setShowTimerModal(null);
      setOverrideReason('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-3xl mx-auto">
        <Link href="/portal/dashboard" className="inline-flex items-center gap-2 text-neutral-500 hover:text-white mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-green-500" />
            Lead Distribution Controls
          </h1>
          <p className="text-neutral-500 mt-1">Toggle sales reps on/off for receiving new leads</p>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 text-sm ${
            message.type === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center">
            <p className="text-2xl font-bold text-green-400">{reps.filter(r => r.isReceivingLeads).length}</p>
            <p className="text-xs text-neutral-500">Receiving Leads</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center">
            <p className="text-2xl font-bold text-red-400">{reps.filter(r => !r.isReceivingLeads).length}</p>
            <p className="text-xs text-neutral-500">Paused</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center">
            <p className="text-2xl font-bold text-yellow-400">{reps.filter(r => r.autoResumeAt).length}</p>
            <p className="text-xs text-neutral-500">Auto-Resume Set</p>
          </div>
        </div>

        {/* Rep List */}
        <div className="space-y-3">
          {reps.map(rep => (
            <div key={rep.repSlug} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${rep.isReceivingLeads ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div>
                    <p className="text-white font-medium">{rep.repName}</p>
                    <p className="text-xs text-neutral-500">{rep.role} • {rep.repSlug}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Timer button */}
                  <button
                    onClick={() => setShowTimerModal(rep.repSlug)}
                    className="p-2 text-neutral-500 hover:text-yellow-400 transition-colors"
                    title="Set auto-resume timer"
                  >
                    <Clock className="w-4 h-4" />
                  </button>

                  {/* Toggle */}
                  <button
                    onClick={() => toggleRep(rep.repSlug, rep.isReceivingLeads)}
                    disabled={saving === rep.repSlug}
                    className="transition-colors"
                  >
                    {saving === rep.repSlug ? (
                      <Loader2 className="w-8 h-8 text-neutral-500 animate-spin" />
                    ) : rep.isReceivingLeads ? (
                      <ToggleRight className="w-10 h-10 text-green-500" />
                    ) : (
                      <ToggleLeft className="w-10 h-10 text-neutral-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Status details */}
              {rep.adminOverride && (
                <div className="mt-2 text-xs text-yellow-400 bg-yellow-400/10 px-3 py-1.5 rounded">
                  Admin override: {rep.adminOverrideReason || 'No reason given'}
                  {rep.adminOverrideBy && ` (by ${rep.adminOverrideBy})`}
                </div>
              )}
              {rep.autoResumeAt && (
                <div className="mt-2 text-xs text-blue-400 bg-blue-400/10 px-3 py-1.5 rounded flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Auto-resumes: {new Date(rep.autoResumeAt).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Timer Modal */}
        {showTimerModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 w-full max-w-md">
              <h3 className="text-lg font-semibold text-white mb-4">Set Auto-Resume Timer</h3>
              <p className="text-sm text-neutral-500 mb-4">Turn off leads for {showTimerModal} with an auto-resume timer.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Hours until resume</label>
                  <input
                    type="number"
                    value={timerHours}
                    onChange={(e) => setTimerHours(e.target.value)}
                    min="1"
                    max="720"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-brand-green focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Reason (optional)</label>
                  <input
                    type="text"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="e.g., Vacation, Training, Sick"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-brand-green focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowTimerModal(null); setOverrideReason(''); }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setAutoResume(showTimerModal)}
                  disabled={saving !== null}
                  className="flex-1 px-4 py-2 bg-brand-green hover:bg-lime-400 text-black rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Set Timer & Pause'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
