'use client';

import { TrendingUp, Home, Award, Calendar, BarChart3, Target } from 'lucide-react';

interface RepStatsProps {
  stats: {
    totalJobs: number;
    paidJobs: number;
    avgJobsPerMonth: number;
    monthsActive: number;
    revenueGenerated: string;
    rank: number;
    totalReps: number;
    topPercentile: number;
    bestMonth: string;
    bestMonthJobs: number;
    recentMonthJobs: number;
    companyAvgJobs: number;
  };
  firstName: string;
}

export default function RepStatsCard({ stats, firstName }: RepStatsProps) {
  const isTopPerformer = stats.topPercentile <= 25;
  const isAboveAvg = stats.totalJobs > stats.companyAvgJobs;

  return (
    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/20 rounded-xl p-6 md:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-brand-green/20 flex items-center justify-center">
          <BarChart3 className="text-brand-green" size={20} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Performance Track Record</h3>
          <p className="text-sm text-gray-400">Verified from company records</p>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {/* Total Roofs */}
        <div className="bg-white/5 rounded-lg p-4 text-center">
          <Home className="text-brand-green mx-auto mb-2" size={24} />
          <div className="text-3xl font-bold text-white">{stats.totalJobs.toLocaleString()}</div>
          <div className="text-xs text-gray-400 uppercase tracking-wide mt-1">Roofs Completed</div>
        </div>

        {/* Revenue Generated */}
        <div className="bg-white/5 rounded-lg p-4 text-center">
          <TrendingUp className="text-brand-green mx-auto mb-2" size={24} />
          <div className="text-3xl font-bold text-white">{stats.revenueGenerated}</div>
          <div className="text-xs text-gray-400 uppercase tracking-wide mt-1">Revenue Generated</div>
        </div>

        {/* Monthly Average */}
        <div className="bg-white/5 rounded-lg p-4 text-center">
          <Calendar className="text-brand-green mx-auto mb-2" size={24} />
          <div className="text-3xl font-bold text-white">{stats.avgJobsPerMonth}</div>
          <div className="text-xs text-gray-400 uppercase tracking-wide mt-1">Avg Jobs / Month</div>
        </div>

        {/* Best Month */}
        <div className="bg-white/5 rounded-lg p-4 text-center">
          <Target className="text-brand-green mx-auto mb-2" size={24} />
          <div className="text-3xl font-bold text-white">{stats.bestMonthJobs}</div>
          <div className="text-xs text-gray-400 uppercase tracking-wide mt-1">Best Month</div>
          <div className="text-xs text-gray-500 mt-1">{stats.bestMonth}</div>
        </div>

        {/* Experience */}
        <div className="bg-white/5 rounded-lg p-4 text-center">
          <Award className="text-brand-green mx-auto mb-2" size={24} />
          <div className="text-3xl font-bold text-white">
            {stats.monthsActive >= 12
              ? `${Math.round(stats.monthsActive / 12)}yr${stats.monthsActive >= 24 ? 's' : ''}`
              : `${stats.monthsActive}mo`}
          </div>
          <div className="text-xs text-gray-400 uppercase tracking-wide mt-1">With RCRS</div>
        </div>

        {/* Ranking */}
        {isTopPerformer && (
          <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-lg p-4 text-center border border-yellow-500/30">
            <div className="text-3xl font-bold text-yellow-400">Top {stats.topPercentile}%</div>
            <div className="text-xs text-yellow-300/70 uppercase tracking-wide mt-1">Company-Wide</div>
          </div>
        )}
      </div>

      {/* Comparison Bar */}
      {isAboveAvg && (
        <div className="bg-white/5 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">vs. Company Average</span>
            <span className="text-sm font-semibold text-brand-green">
              {Math.round(((stats.totalJobs - stats.companyAvgJobs) / stats.companyAvgJobs) * 100)}% above avg
            </span>
          </div>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <div className="flex h-full">
              <div
                className="bg-gray-500 h-full rounded-l-full"
                style={{ width: `${Math.min(100, (stats.companyAvgJobs / stats.totalJobs) * 100)}%` }}
              />
              <div
                className="bg-brand-green h-full rounded-r-full"
                style={{ width: `${100 - Math.min(100, (stats.companyAvgJobs / stats.totalJobs) * 100)}%` }}
              />
            </div>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-500">Avg Rep: {stats.companyAvgJobs} jobs</span>
            <span className="text-xs text-gray-400">{firstName}: {stats.totalJobs} jobs</span>
          </div>
        </div>
      )}
    </div>
  );
}
