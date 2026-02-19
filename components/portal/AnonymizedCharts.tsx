'use client';

import { useMemo } from 'react';
import { Clock, Target, BarChart3 } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface RepResponseData {
  repName: string;
  avgResponseMinutes: number;
  closeRate: number;
  inPersonCloseRate: number;
  emailedCloseRate: number;
}

interface AnonymizedChartsProps {
  /** Current rep's slug or name */
  currentRepName: string;
  /** All reps' data */
  allRepsData: RepResponseData[];
  /** If true, show fully anonymized (for meeting slides) */
  meetingMode?: boolean;
}

// =============================================================================
// Bar Component
// =============================================================================

function Bar({
  value,
  maxValue,
  label,
  isCurrentRep,
  color,
  suffix = '',
}: {
  value: number;
  maxValue: number;
  label: string;
  isCurrentRep: boolean;
  color: string;
  suffix?: string;
}) {
  const height = maxValue > 0 ? Math.max((value / maxValue) * 100, 4) : 4;
  return (
    <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
      <span className="text-[10px] text-neutral-400 font-medium">
        {value.toFixed(suffix === '%' ? 0 : 0)}{suffix}
      </span>
      <div className="w-full flex items-end justify-center" style={{ height: '120px' }}>
        <div
          className={`w-full max-w-[40px] rounded-t transition-all ${
            isCurrentRep
              ? `${color} ring-2 ring-offset-1 ring-offset-neutral-900 ring-brand-green`
              : 'bg-white/10'
          }`}
          style={{ height: `${height}%` }}
        />
      </div>
      <span className={`text-[10px] truncate max-w-full ${
        isCurrentRep ? 'text-brand-green font-bold' : 'text-neutral-600'
      }`}>
        {label}
      </span>
    </div>
  );
}

// =============================================================================
// Lead Response Time Chart
// =============================================================================

export function LeadResponseTimeChart({ currentRepName, allRepsData, meetingMode = false }: AnonymizedChartsProps) {
  const sortedData = useMemo(() =>
    [...allRepsData]
      .filter(r => r.avgResponseMinutes > 0)
      .sort((a, b) => a.avgResponseMinutes - b.avgResponseMinutes),
    [allRepsData]
  );

  const maxMinutes = Math.max(...sortedData.map(r => r.avgResponseMinutes), 1);

  if (sortedData.length === 0) {
    return (
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <Clock size={18} className="text-amber-400" />
          <span className="text-sm font-semibold text-white">Lead Response Time</span>
        </div>
        <p className="text-sm text-neutral-500 text-center py-8">No response data available yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-2">
        <Clock size={18} className="text-amber-400" />
        <span className="text-sm font-semibold text-white">Lead Response Time</span>
        <span className="text-[10px] text-neutral-500 ml-auto">Lower is better</span>
      </div>
      <p className="text-xs text-neutral-500 mb-4">Average minutes to first contact</p>
      <div className="flex items-end gap-1">
        {sortedData.map((rep, i) => {
          const isMe = rep.repName.toLowerCase() === currentRepName.toLowerCase();
          const label = meetingMode
            ? `Rep ${i + 1}`
            : isMe
              ? 'You'
              : `Rep ${i + 1}`;
          // Invert: lower response = taller bar (better)
          const invertedValue = maxMinutes - rep.avgResponseMinutes + (maxMinutes * 0.1);
          return (
            <Bar
              key={rep.repName}
              value={rep.avgResponseMinutes}
              maxValue={maxMinutes}
              label={label}
              isCurrentRep={isMe && !meetingMode}
              color="bg-amber-500"
              suffix="m"
            />
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Close Rate Chart (In-Person vs Emailed)
// =============================================================================

export function CloseRateChart({ currentRepName, allRepsData, meetingMode = false }: AnonymizedChartsProps) {
  const dataWithRates = useMemo(() =>
    allRepsData.filter(r => r.inPersonCloseRate > 0 || r.emailedCloseRate > 0),
    [allRepsData]
  );

  if (dataWithRates.length === 0) {
    return (
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <Target size={18} className="text-green-400" />
          <span className="text-sm font-semibold text-white">Closing Percentage</span>
        </div>
        <p className="text-sm text-neutral-500 text-center py-8">No closing data available yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-2">
        <Target size={18} className="text-green-400" />
        <span className="text-sm font-semibold text-white">Closing % — In-Person vs Emailed</span>
      </div>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-500" />
          <span className="text-[10px] text-neutral-400">In-Person</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-blue-500" />
          <span className="text-[10px] text-neutral-400">Emailed</span>
        </div>
      </div>
      <div className="space-y-2">
        {dataWithRates.map((rep, i) => {
          const isMe = rep.repName.toLowerCase() === currentRepName.toLowerCase();
          const label = meetingMode
            ? `Rep ${i + 1}`
            : isMe
              ? 'You'
              : `Rep ${i + 1}`;
          return (
            <div key={rep.repName} className={`rounded-xl p-3 ${isMe && !meetingMode ? 'bg-brand-green/5 border border-brand-green/20' : 'bg-white/[0.02]'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-medium ${isMe && !meetingMode ? 'text-brand-green' : 'text-neutral-400'}`}>{label}</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-neutral-500 w-16">In-Person</span>
                  <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${rep.inPersonCloseRate}%` }}
                    />
                  </div>
                  <span className="text-xs text-green-400 font-medium w-10 text-right">{rep.inPersonCloseRate}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-neutral-500 w-16">Emailed</span>
                  <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${rep.emailedCloseRate}%` }}
                    />
                  </div>
                  <span className="text-xs text-blue-400 font-medium w-10 text-right">{rep.emailedCloseRate}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Combined export for meeting slides (fully anonymized)
// =============================================================================

export function MeetingChartsPanel({ allRepsData }: { allRepsData: RepResponseData[] }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <BarChart3 size={20} className="text-brand-green" />
        Team Performance Charts
      </h3>
      <LeadResponseTimeChart
        currentRepName=""
        allRepsData={allRepsData}
        meetingMode={true}
      />
      <CloseRateChart
        currentRepName=""
        allRepsData={allRepsData}
        meetingMode={true}
      />
    </div>
  );
}

export type { RepResponseData };
