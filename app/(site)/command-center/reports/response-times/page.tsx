'use client';

/**
 * RCRS Command Center - Response Time Dashboard
 *
 * Shows per-rep response time grades (A-F), team averages,
 * and response time analytics.
 *
 * Admin: sees all reps
 * Sales: sees own data only (if visibility enabled by Chris)
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  ArrowLeft, RefreshCw, Loader2, ShieldAlert, Clock, Award,
  TrendingUp, Users, AlertTriangle, X, Timer, BarChart3,
  ChevronDown, ChevronUp, Phone, Mail, MessageSquare, FileText
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface RepAverage {
  repName: string;
  avgMinutes: number;
  medianMinutes: number;
  fastestMinutes: number;
  slowestMinutes: number;
  totalLeads: number;
  respondedLeads: number;
  noResponseLeads: number;
  under5Min: number;
  under15Min: number;
  under30Min: number;
  over60Min: number;
  grade: string;
}

interface LeadEntry {
  contactJnid: string;
  contactName: string;
  repName: string;
  createdBy: string;
  leadSource: string;
  contactCreatedAt: number;
  firstActionAt: number | null;
  firstActionType: string | null;
  firstActionBy: string | null;
  responseMinutes: number | null;
}

interface ResponseData {
  repAverages: RepAverage[];
  leads: LeadEntry[];
  summary: {
    totalLeads: number;
    totalResponded: number;
    overallAvgMinutes: number;
    overallMedianMinutes: number;
  };
  meta: {
    daysQueried: number;
    queryTimeMs: number;
    contactsFetched: number;
    timestamp: string;
  };
}

// ============================================================================
// Grade helpers (spec scale: median-based)
// ============================================================================

function getMedianGrade(medianMinutes: number): string {
  if (medianMinutes <= 15) return 'A';
  if (medianMinutes <= 30) return 'B';
  if (medianMinutes <= 60) return 'C';
  if (medianMinutes <= 240) return 'D';
  return 'F';
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'text-green-400';
    case 'B': return 'text-emerald-400';
    case 'C': return 'text-yellow-400';
    case 'D': return 'text-orange-400';
    case 'F': return 'text-red-400';
    default: return 'text-neutral-400';
  }
}

function gradeBg(grade: string): string {
  switch (grade) {
    case 'A': return 'bg-green-500/10 border-green-500/20';
    case 'B': return 'bg-emerald-500/10 border-emerald-500/20';
    case 'C': return 'bg-yellow-500/10 border-yellow-500/20';
    case 'D': return 'bg-orange-500/10 border-orange-500/20';
    case 'F': return 'bg-red-500/10 border-red-500/20';
    default: return 'bg-white/5 border-white/10';
  }
}

function gradeRingColor(grade: string): string {
  switch (grade) {
    case 'A': return 'ring-green-500/30';
    case 'B': return 'ring-emerald-500/30';
    case 'C': return 'ring-yellow-500/30';
    case 'D': return 'ring-orange-500/30';
    case 'F': return 'ring-red-500/30';
    default: return 'ring-white/10';
  }
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.round(minutes / 1440 * 10) / 10;
  return `${d}d`;
}

function actionTypeIcon(type: string | null) {
  switch (type) {
    case 'Phone Call': return <Phone size={12} className="text-green-400" />;
    case 'Email': case 'email': return <Mail size={12} className="text-blue-400" />;
    case 'Text Message': return <MessageSquare size={12} className="text-purple-400" />;
    case 'Note': return <FileText size={12} className="text-amber-400" />;
    default: return <Clock size={12} className="text-neutral-400" />;
  }
}

// ============================================================================
// Component
// ============================================================================

export default function ResponseTimeDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<ResponseData | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(365);
  const [expandedRep, setExpandedRep] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'median' | 'avg' | 'leads' | 'grade'>('median');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/response-times?days=${days}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setIsAdmin(json.isAdmin);
      } else {
        throw new Error(json.error || 'Failed to load data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    }
  }, [authLoading, user, fetchData]);

  // Sort reps
  const sortedReps = data?.repAverages ? [...data.repAverages].sort((a, b) => {
    switch (sortBy) {
      case 'median': return a.medianMinutes - b.medianMinutes;
      case 'avg': return a.avgMinutes - b.avgMinutes;
      case 'leads': return b.totalLeads - a.totalLeads;
      case 'grade': {
        const gradeA = getMedianGrade(a.medianMinutes);
        const gradeB = getMedianGrade(b.medianMinutes);
        const order = 'ABCDF';
        return order.indexOf(gradeA) - order.indexOf(gradeB);
      }
      default: return 0;
    }
  }) : [];

  // Get leads for a specific rep
  const getRepLeads = (repName: string) =>
    data?.leads.filter(l => l.repName === repName).sort((a, b) => b.contactCreatedAt - a.contactCreatedAt) || [];

  // Overall grade
  const overallGrade = data ? getMedianGrade(data.summary.overallMedianMinutes) : 'N/A';

  // Auth gates
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-green" size={48} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center p-6">
        <div className="text-center">
          <ShieldAlert size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Authentication Required</h2>
          <p className="text-neutral-400 mb-6">You must be logged in to view response times.</p>
          <Link href="/portal" className="px-6 py-3 bg-brand-green text-black font-semibold rounded-xl hover:bg-brand-green/90 transition-colors">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)',
          backgroundSize: '50px 50px',
        }} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link
                  href="/command-center/reports"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={20} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Timer size={22} className="text-brand-green" />
                    Response Time Dashboard
                  </h1>
                  <p className="text-xs text-neutral-400">
                    {data ? `${data.summary.totalLeads} leads analyzed · ${data.meta.daysQueried}d window` : 'Loading...'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Time range selector */}
                <select
                  value={days}
                  onChange={(e) => setDays(parseInt(e.target.value))}
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-green/50"
                >
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="180">6 months</option>
                  <option value="365">1 year</option>
                </select>
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <RefreshCw size={16} className={`text-neutral-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
            <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
              <AlertTriangle size={16} />
              {error}
              <button onClick={() => setError(null)} className="ml-auto text-red-400/50 hover:text-red-400">
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* KPI Cards */}
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 animate-pulse">
                  <div className="h-8 w-16 bg-white/5 rounded mb-2" />
                  <div className="h-4 w-24 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : data && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Team Grade */}
              <div className={`border rounded-2xl p-5 ${gradeBg(overallGrade)}`}>
                <div className="flex items-center justify-between mb-1">
                  <Award size={20} className={gradeColor(overallGrade)} />
                </div>
                <div className={`text-4xl font-black ${gradeColor(overallGrade)}`}>{overallGrade}</div>
                <div className="text-sm text-neutral-500 mt-1">Team Grade</div>
              </div>

              {/* Median Response */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-1">
                  <Clock size={20} className="text-amber-400" />
                </div>
                <div className="text-3xl font-bold text-white">{formatDuration(data.summary.overallMedianMinutes)}</div>
                <div className="text-sm text-neutral-500 mt-1">Median Response</div>
              </div>

              {/* Response Rate */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-1">
                  <TrendingUp size={20} className="text-brand-green" />
                </div>
                <div className="text-3xl font-bold text-white">
                  {data.summary.totalLeads > 0
                    ? `${Math.round((data.summary.totalResponded / data.summary.totalLeads) * 100)}%`
                    : '0%'}
                </div>
                <div className="text-sm text-neutral-500 mt-1">Response Rate</div>
              </div>

              {/* Total Leads */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-1">
                  <Users size={20} className="text-blue-400" />
                </div>
                <div className="text-3xl font-bold text-white">{data.summary.totalLeads}</div>
                <div className="text-sm text-neutral-500 mt-1">Total Leads</div>
              </div>
            </div>
          )}

          {/* Grade Scale Reference */}
          {!loading && data && (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="text-neutral-500 font-medium">GRADE SCALE:</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-green-500/20 text-green-400 flex items-center justify-center font-bold text-[10px]">A</span>
                  <span className="text-neutral-400">&lt; 15m</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px]">B</span>
                  <span className="text-neutral-400">&lt; 30m</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-yellow-500/20 text-yellow-400 flex items-center justify-center font-bold text-[10px]">C</span>
                  <span className="text-neutral-400">&lt; 1h</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-[10px]">D</span>
                  <span className="text-neutral-400">&lt; 4h</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-[10px]">F</span>
                  <span className="text-neutral-400">&gt; 4h</span>
                </span>
              </div>
            </div>
          )}

          {/* Rep Leaderboard */}
          {!loading && data && sortedReps.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <BarChart3 size={20} className="text-brand-green" />
                  {isAdmin ? 'Rep Response Times' : 'Your Response Time'}
                </h2>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">Sort:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-brand-green/50"
                    >
                      <option value="median">Median Time</option>
                      <option value="avg">Avg Time</option>
                      <option value="leads">Lead Count</option>
                      <option value="grade">Grade</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {sortedReps.map((rep, idx) => {
                  const grade = getMedianGrade(rep.medianMinutes);
                  const isExpanded = expandedRep === rep.repName;
                  const repLeads = isExpanded ? getRepLeads(rep.repName) : [];
                  const responseRate = rep.totalLeads > 0
                    ? Math.round((rep.respondedLeads / rep.totalLeads) * 100)
                    : 0;

                  return (
                    <div key={rep.repName} className="space-y-0">
                      {/* Rep Card */}
                      <button
                        onClick={() => setExpandedRep(isExpanded ? null : rep.repName)}
                        className={`w-full text-left border rounded-2xl ${isExpanded ? 'rounded-b-none' : ''} p-4 hover:bg-white/[0.04] transition-all ${
                          idx === 0 && isAdmin ? 'bg-brand-green/5 border-brand-green/20' : 'bg-white/[0.02] border-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {/* Rank */}
                            {isAdmin && (
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                                idx === 0 ? 'bg-brand-green/20 text-brand-green' :
                                idx === 1 ? 'bg-amber-500/20 text-amber-400' :
                                idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                                'bg-white/5 text-neutral-400'
                              }`}>
                                #{idx + 1}
                              </div>
                            )}

                            {/* Grade Badge */}
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black ring-2 ${gradeBg(grade)} ${gradeRingColor(grade)} ${gradeColor(grade)}`}>
                              {grade}
                            </div>

                            {/* Rep Info */}
                            <div>
                              <div className="font-semibold text-white">{rep.repName}</div>
                              <div className="flex items-center gap-3 text-xs text-neutral-500 mt-0.5">
                                <span>{rep.totalLeads} leads</span>
                                <span>{rep.respondedLeads} responded</span>
                                {rep.noResponseLeads > 0 && (
                                  <span className="text-red-400">{rep.noResponseLeads} no response</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            {/* Stats */}
                            <div className="hidden sm:flex items-center gap-6 text-right">
                              <div>
                                <div className="text-lg font-bold text-white tabular-nums">{formatDuration(rep.medianMinutes)}</div>
                                <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Median</div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-neutral-300 tabular-nums">{formatDuration(rep.avgMinutes)}</div>
                                <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Avg</div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-neutral-300 tabular-nums">{responseRate}%</div>
                                <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Rate</div>
                              </div>
                            </div>

                            {/* Expand icon */}
                            {isExpanded ? (
                              <ChevronUp size={16} className="text-neutral-400" />
                            ) : (
                              <ChevronDown size={16} className="text-neutral-400" />
                            )}
                          </div>
                        </div>

                        {/* Mobile stats row */}
                        <div className="flex sm:hidden items-center gap-4 mt-3 text-xs">
                          <span className="text-neutral-400">Median: <strong className="text-white">{formatDuration(rep.medianMinutes)}</strong></span>
                          <span className="text-neutral-400">Avg: <strong className="text-neutral-300">{formatDuration(rep.avgMinutes)}</strong></span>
                          <span className="text-neutral-400">Rate: <strong className="text-neutral-300">{responseRate}%</strong></span>
                        </div>

                        {/* Response time distribution bar */}
                        {rep.totalLeads > 0 && (
                          <div className="mt-3 flex h-2 rounded-full overflow-hidden bg-white/5">
                            {rep.under5Min > 0 && (
                              <div
                                className="bg-green-500 h-full"
                                style={{ width: `${(rep.under5Min / rep.respondedLeads) * 100}%` }}
                                title={`Under 5m: ${rep.under5Min}`}
                              />
                            )}
                            {(rep.under15Min - rep.under5Min) > 0 && (
                              <div
                                className="bg-emerald-500 h-full"
                                style={{ width: `${((rep.under15Min - rep.under5Min) / rep.respondedLeads) * 100}%` }}
                                title={`5-15m: ${rep.under15Min - rep.under5Min}`}
                              />
                            )}
                            {(rep.under30Min - rep.under15Min) > 0 && (
                              <div
                                className="bg-yellow-500 h-full"
                                style={{ width: `${((rep.under30Min - rep.under15Min) / rep.respondedLeads) * 100}%` }}
                                title={`15-30m: ${rep.under30Min - rep.under15Min}`}
                              />
                            )}
                            {(rep.respondedLeads - rep.under30Min - rep.over60Min) > 0 && (
                              <div
                                className="bg-orange-500 h-full"
                                style={{ width: `${((rep.respondedLeads - rep.under30Min - rep.over60Min) / rep.respondedLeads) * 100}%` }}
                                title={`30-60m: ${rep.respondedLeads - rep.under30Min - rep.over60Min}`}
                              />
                            )}
                            {rep.over60Min > 0 && (
                              <div
                                className="bg-red-500 h-full"
                                style={{ width: `${(rep.over60Min / rep.respondedLeads) * 100}%` }}
                                title={`Over 60m: ${rep.over60Min}`}
                              />
                            )}
                          </div>
                        )}
                      </button>

                      {/* Expanded: recent leads */}
                      {isExpanded && (
                        <div className="border border-t-0 border-white/5 rounded-b-2xl bg-white/[0.01] p-4 space-y-2 max-h-96 overflow-y-auto">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Recent Leads</span>
                            <div className="flex items-center gap-3 text-[10px] text-neutral-500">
                              <span>Fastest: <strong className="text-green-400">{formatDuration(rep.fastestMinutes)}</strong></span>
                              <span>Slowest: <strong className="text-red-400">{formatDuration(rep.slowestMinutes)}</strong></span>
                            </div>
                          </div>
                          {repLeads.length > 0 ? repLeads.slice(0, 20).map((lead) => (
                            <div key={lead.contactJnid} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5">
                              <div className="flex items-center gap-3">
                                {actionTypeIcon(lead.firstActionType)}
                                <div>
                                  <div className="text-sm text-white">{lead.contactName}</div>
                                  <div className="text-[10px] text-neutral-500">
                                    {lead.leadSource} · {new Date(lead.contactCreatedAt * 1000).toLocaleDateString()} · {lead.firstActionType || 'No response'}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                {lead.responseMinutes !== null ? (
                                  <span className={`text-sm font-medium tabular-nums ${
                                    lead.responseMinutes <= 15 ? 'text-green-400' :
                                    lead.responseMinutes <= 30 ? 'text-emerald-400' :
                                    lead.responseMinutes <= 60 ? 'text-yellow-400' :
                                    lead.responseMinutes <= 240 ? 'text-orange-400' :
                                    'text-red-400'
                                  }`}>
                                    {formatDuration(lead.responseMinutes)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-red-400 font-medium">No Response</span>
                                )}
                              </div>
                            </div>
                          )) : (
                            <p className="text-sm text-neutral-500 text-center py-4">No lead details available</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Uncontacted Leads */}
          {!loading && data && isAdmin && (
            (() => {
              const uncontacted = data.leads.filter(l => l.responseMinutes === null);
              if (uncontacted.length === 0) return null;

              // Group by rep
              const byRep = new Map<string, LeadEntry[]>();
              for (const lead of uncontacted) {
                const list = byRep.get(lead.repName) || [];
                list.push(lead);
                byRep.set(lead.repName, list);
              }

              return (
                <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
                    <AlertTriangle size={18} />
                    Uncontacted Leads ({uncontacted.length})
                  </h3>
                  <div className="space-y-3">
                    {Array.from(byRep.entries())
                      .sort((a, b) => b[1].length - a[1].length)
                      .map(([repName, leads]) => (
                        <div key={repName} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl border border-white/5">
                          <div>
                            <span className="text-sm font-medium text-white">{repName}</span>
                            <div className="text-xs text-neutral-500 mt-0.5">
                              {leads.slice(0, 3).map(l => l.contactName).join(', ')}
                              {leads.length > 3 && ` +${leads.length - 3} more`}
                            </div>
                          </div>
                          <span className="text-lg font-bold text-red-400">{leads.length}</span>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })()
          )}

          {/* Empty state */}
          {!loading && data && sortedReps.length === 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-12 text-center">
              <Timer size={48} className="text-neutral-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No Response Time Data</h3>
              <p className="text-sm text-neutral-500">
                Response times will appear here once leads are assigned and reps take action.
              </p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <Loader2 className="animate-spin text-brand-green mx-auto mb-4" size={32} />
                <p className="text-sm text-neutral-400">Analyzing response times...</p>
                <p className="text-xs text-neutral-600 mt-1">This may take a moment for large date ranges</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
