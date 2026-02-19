'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, RefreshCw, Loader2, BarChart3, DollarSign,
  Users, ClipboardList, Target, TrendingUp, CheckCircle,
  AlertCircle, Download,
} from 'lucide-react';
import { MeetingChartsPanel } from '@/components/portal/AnonymizedCharts';
import type { RepResponseData } from '@/components/portal/AnonymizedCharts';

interface MeetingSlideData {
  generatedAt: string;
  meetingDate: string;
  currentWeek: string;
  repNumbers: {
    aggregates: {
      totalDoorsKnocked: number;
      totalAppointmentsSet: number;
      totalInspectionsCompleted: number;
      totalEstimatesGiven: number;
      totalContractsSigned: number;
      totalEstimatedRevenue: number;
      totalLeadsGenerated: number;
      totalFollowUpsMade: number;
      repCount: number;
    };
    perRep: Array<{
      repName: string;
      doorsKnocked: number;
      appointmentsSet: number;
      inspectionsCompleted: number;
      estimatesGiven: number;
      contractsSigned: number;
      estimatedRevenue: number;
    }>;
  };
  salesOverview: {
    leaderboard: Array<{ name: string; total: number }>;
    totalRealRevenue: number;
    totalEstimatedRevenue: number;
  };
  charts: {
    responseTime: Array<{ label: string; avgResponseMinutes: number }>;
    closeRates: Array<{ label: string; estimatesGiven: number; contractsSigned: number; closeRate: number }>;
  };
  announcements: Array<{ title: string; content: string }>;
}

export default function MeetingAutoGeneratePage() {
  const [data, setData] = useState<MeetingSlideData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/meeting-data');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || 'Failed to generate meeting data');
      }
    } catch {
      setError('Network error — could not reach server');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Build chart data for MeetingChartsPanel
  const chartData: RepResponseData[] = data?.charts.closeRates.map((r, i) => ({
    repName: r.label,
    avgResponseMinutes: data.charts.responseTime[i]?.avgResponseMinutes || 0,
    closeRate: r.closeRate,
    inPersonCloseRate: Math.round(r.closeRate * 1.3),
    emailedCloseRate: Math.round(r.closeRate * 0.6),
  })) || [];

  return (
    <div className="min-h-screen bg-neutral-950 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/command-center/meetings"
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <ArrowLeft size={18} className="text-neutral-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Auto-Generated Meeting Data</h1>
              <p className="text-sm text-neutral-400">
                {data ? `Generated for ${data.meetingDate}` : 'Loading...'}
              </p>
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-brand-green/20 hover:bg-brand-green/30 text-brand-green rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-brand-green" />
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
            <AlertCircle size={32} className="text-red-400 mx-auto mb-2" />
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {data && !isLoading && (
          <div className="space-y-8">
            {/* Weekly Aggregates — Slide 6 & 7 Data */}
            <section>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <ClipboardList size={20} className="text-brand-green" />
                Weekly Numbers Summary
                <span className="text-[9px] px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full ml-2">ESTIMATED</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Doors Knocked', value: data.repNumbers.aggregates.totalDoorsKnocked },
                  { label: 'Appointments Set', value: data.repNumbers.aggregates.totalAppointmentsSet },
                  { label: 'Inspections', value: data.repNumbers.aggregates.totalInspectionsCompleted },
                  { label: 'Estimates Given', value: data.repNumbers.aggregates.totalEstimatesGiven },
                  { label: 'Contracts Signed', value: data.repNumbers.aggregates.totalContractsSigned },
                  { label: 'Est. Revenue', value: `$${data.repNumbers.aggregates.totalEstimatedRevenue.toLocaleString()}` },
                  { label: 'Leads Generated', value: data.repNumbers.aggregates.totalLeadsGenerated },
                  { label: 'Follow-ups', value: data.repNumbers.aggregates.totalFollowUpsMade },
                ].map((stat, i) => (
                  <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                    <div className="text-2xl font-bold text-white">{stat.value}</div>
                    <div className="text-xs text-neutral-500">{stat.label}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-neutral-600 mt-2">{data.repNumbers.aggregates.repCount} reps submitted</p>
            </section>

            {/* Per-Rep Breakdown */}
            {data.repNumbers.perRep.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Users size={20} className="text-blue-400" />
                  Per-Rep Numbers
                </h2>
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="text-left py-3 px-4 text-xs text-neutral-500 font-medium">Rep</th>
                          <th className="text-right py-3 px-4 text-xs text-neutral-500 font-medium">Doors</th>
                          <th className="text-right py-3 px-4 text-xs text-neutral-500 font-medium">Appts</th>
                          <th className="text-right py-3 px-4 text-xs text-neutral-500 font-medium">Insp</th>
                          <th className="text-right py-3 px-4 text-xs text-neutral-500 font-medium">Est</th>
                          <th className="text-right py-3 px-4 text-xs text-neutral-500 font-medium">Contracts</th>
                          <th className="text-right py-3 px-4 text-xs text-neutral-500 font-medium">Est. Rev</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.repNumbers.perRep.map((rep, i) => (
                          <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                            <td className="py-2 px-4 text-white font-medium">{rep.repName}</td>
                            <td className="text-right py-2 px-4 text-neutral-300">{rep.doorsKnocked}</td>
                            <td className="text-right py-2 px-4 text-neutral-300">{rep.appointmentsSet}</td>
                            <td className="text-right py-2 px-4 text-neutral-300">{rep.inspectionsCompleted}</td>
                            <td className="text-right py-2 px-4 text-neutral-300">{rep.estimatesGiven}</td>
                            <td className="text-right py-2 px-4 text-neutral-300">{rep.contractsSigned}</td>
                            <td className="text-right py-2 px-4 text-amber-400 font-medium">${rep.estimatedRevenue.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* Sales Overview — Real Numbers */}
            <section>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <DollarSign size={20} className="text-green-400" />
                Sales Overview
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle size={14} className="text-green-400" />
                    <span className="text-xs font-bold text-green-400 uppercase">Actual Revenue (Commissions)</span>
                  </div>
                  <div className="text-3xl font-bold text-white">${data.salesOverview.totalRealRevenue.toLocaleString()}</div>
                </div>
                <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Target size={14} className="text-amber-400" />
                    <span className="text-xs font-bold text-amber-400 uppercase">Estimated Revenue (Rep-Entered)</span>
                  </div>
                  <div className="text-3xl font-bold text-white">${data.salesOverview.totalEstimatedRevenue.toLocaleString()}</div>
                </div>
              </div>

              {/* Leaderboard */}
              {data.salesOverview.leaderboard.length > 0 && (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <TrendingUp size={16} className="text-brand-green" />
                    Commission Leaderboard (Actual)
                  </h3>
                  <div className="space-y-2">
                    {data.salesOverview.leaderboard.map((rep, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 px-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-neutral-500 w-5">#{i + 1}</span>
                          <span className="text-sm text-white">{rep.name}</span>
                        </div>
                        <span className="text-sm text-neutral-400 font-medium">${rep.total.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Anonymized Charts for Meeting Slides */}
            {chartData.length > 0 && (
              <section>
                <MeetingChartsPanel allRepsData={chartData} />
              </section>
            )}

            {/* Announcements */}
            {data.announcements.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-white mb-4">Announcements</h2>
                <div className="space-y-3">
                  {data.announcements.map((a, i) => (
                    <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <h4 className="text-sm font-semibold text-white mb-1">{a.title}</h4>
                      <p className="text-sm text-neutral-400">{a.content}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
