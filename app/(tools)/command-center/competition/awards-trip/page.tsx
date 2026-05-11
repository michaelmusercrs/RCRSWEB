'use client';

import * as React from 'react';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plane, Trophy, Calendar, RefreshCw, Save, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Tier { min: number; bonus: number; label: string }
interface Period { name: string; start: string; end: string; tripWindow: string }
interface Rules {
  qualifyingThreshold: number;
  tiers: Tier[];
  periods: Period[];
  reps: string[];
}

interface MonthEntry { month: string; sales: number; tier: Tier | null; bonus: number }
interface RepResult {
  repName: string;
  monthly: MonthEntry[];
  periodTotal: number;
  qualified: boolean;
  accruedBonus: number;
  earnedAllowance: number;
  remainingToQualify: number;
  progressPct: number;
}
interface ApiResponse {
  success: boolean;
  rules: Rules;
  result: {
    period: Period;
    months: string[];
    reps: RepResult[];
    teamTotal: number;
    qualifierCount: number;
    totalAllowance: number;
  };
}

function fmt(n: number) {
  if (!n) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtFull(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short' });
}

export default function AwardsTripPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [activePeriod, setActivePeriod] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const load = useCallback(async (periodName?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = periodName
        ? `/api/command-center/awards-trip?period=${encodeURIComponent(periodName)}`
        : '/api/command-center/awards-trip';
      const res = await fetch(url);
      if (res.status === 401) {
        const here = window.location.pathname + window.location.search;
        window.location.href = `/portal?returnUrl=${encodeURIComponent(here)}`;
        return;
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load');
      setData(json);
      setActivePeriod(json.result.period.name);
      setEdits({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onCellChange = (month: string, rep: string, value: string) => {
    const num = value === '' ? 0 : Number(value.replace(/[^0-9.]/g, ''));
    setEdits(prev => ({
      ...prev,
      [month]: { ...(prev[month] || {}), [rep]: Number.isFinite(num) ? num : 0 },
    }));
  };

  const cellValue = (month: string, rep: string, fallback: number) => {
    if (edits[month]?.[rep] !== undefined) return edits[month][rep];
    return fallback;
  };

  const hasEdits = Object.keys(edits).length > 0;

  const save = async () => {
    if (!hasEdits) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const months = Object.keys(edits);
      for (const month of months) {
        const res = await fetch('/api/command-center/awards-trip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month, sales: edits[month] }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || `Save failed for ${month}`);
      }
      setSavedMsg(`Saved ${months.length} month${months.length === 1 ? '' : 's'}`);
      await load(activePeriod ?? undefined);
      setTimeout(() => setSavedMsg(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white p-8 flex items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white p-8">
        <p className="text-red-400">{error || 'No data'}</p>
      </div>
    );
  }

  const { rules, result } = data;
  const { period, months, reps } = result;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/command-center" className="text-zinc-400 hover:text-white inline-flex items-center gap-2 text-sm">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>

        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Plane className="h-8 w-8 text-cyan-400" />
              Awards Trip Tracker
            </h1>
            <p className="text-zinc-400 mt-1">
              Sell <span className="font-semibold text-white">{fmtFull(rules.qualifyingThreshold)}</span> in a 6-month period to qualify.
              Each qualifying month banks a tier bonus toward your trip allowance — released only if you cross the line.
              Reps choose any trip they want; RCRS covers up to the earned allowance.
            </p>
          </div>

          <div className="flex gap-2">
            {rules.periods.map(p => (
              <button
                key={p.name}
                onClick={() => load(p.name)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium border',
                  activePeriod === p.name
                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Period</p>
            <p className="text-xl font-semibold mt-1">{period.name}</p>
            <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {period.start} → {period.end}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Trip Window</p>
            <p className="text-xl font-semibold mt-1 text-cyan-300">{period.tripWindow}</p>
            <p className="text-xs text-zinc-500 mt-1">~1–2 months after period ends</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Qualifiers</p>
            <p className="text-xl font-semibold mt-1 text-lime-400">
              {result.qualifierCount} / {reps.length}
            </p>
            <p className="text-xs text-zinc-500 mt-1">reps over {fmt(rules.qualifyingThreshold)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Total Allowance Earned</p>
            <p className="text-xl font-semibold mt-1 text-amber-400">{fmtFull(result.totalAllowance)}</p>
            <p className="text-xs text-zinc-500 mt-1">qualified reps only</p>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Bonus Tier Ladder</p>
          <div className="flex flex-wrap gap-2 text-xs">
            {rules.tiers.map(t => (
              <span key={t.min} className="rounded-md bg-zinc-800 border border-zinc-700 px-2 py-1">
                <span className="text-zinc-400">{t.label}</span>
                <span className="text-zinc-600 mx-1">→</span>
                <span className="text-amber-300 font-semibold">${t.bonus.toLocaleString()}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-400" />
              Rep Standings — Tap any cell to edit monthly sales
            </h2>
            <div className="flex items-center gap-3">
              {savedMsg && (
                <span className="inline-flex items-center gap-1 text-sm text-lime-400">
                  <CheckCircle2 className="h-4 w-4" /> {savedMsg}
                </span>
              )}
              {error && (
                <span className="inline-flex items-center gap-1 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4" /> {error}
                </span>
              )}
              <button
                onClick={save}
                disabled={!hasEdits || saving}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
                  hasEdits
                    ? 'bg-lime-500/20 border-lime-500/40 text-lime-300 hover:bg-lime-500/30'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-600 cursor-not-allowed'
                )}
              >
                <Save className={cn('h-4 w-4', saving && 'animate-pulse')} />
                {saving ? 'Saving…' : hasEdits ? `Save ${Object.keys(edits).length} month(s)` : 'No changes'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-950/60 text-zinc-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left py-3 px-4 sticky left-0 bg-zinc-950/60 z-10">Rep</th>
                  {months.map(m => (
                    <th key={m} className="text-right py-3 px-2 min-w-[110px]">{monthLabel(m)}</th>
                  ))}
                  <th className="text-right py-3 px-3 border-l border-zinc-800">Total</th>
                  <th className="text-right py-3 px-3">Status</th>
                  <th className="text-right py-3 px-3">Allowance</th>
                </tr>
              </thead>
              <tbody>
                {reps.map((rep, idx) => (
                  <tr key={rep.repName} className={cn(
                    'border-t border-zinc-800',
                    rep.qualified && 'bg-cyan-500/5'
                  )}>
                    <td className="py-2 px-4 sticky left-0 bg-zinc-900 z-10 font-medium whitespace-nowrap">
                      <span className="text-zinc-500 text-xs mr-2">#{idx + 1}</span>
                      {rep.repName}
                    </td>
                    {rep.monthly.map(entry => {
                      const value = cellValue(entry.month, rep.repName, entry.sales);
                      const isEdited = edits[entry.month]?.[rep.repName] !== undefined;
                      return (
                        <td key={entry.month} className="py-1 px-1 text-right">
                          <div className="flex flex-col items-end">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={value === 0 ? '' : value}
                              onChange={e => onCellChange(entry.month, rep.repName, e.target.value)}
                              placeholder="0"
                              className={cn(
                                'w-24 text-right rounded px-2 py-1 text-sm font-mono bg-transparent border',
                                isEdited
                                  ? 'border-amber-500/50 text-amber-300'
                                  : entry.bonus > 0
                                    ? 'border-zinc-800 text-lime-400'
                                    : 'border-zinc-800 text-zinc-500'
                              )}
                            />
                            {entry.tier && !isEdited && (
                              <span className="text-[10px] text-amber-400/80 mt-0.5">
                                +${entry.bonus}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-right border-l border-zinc-800">
                      <div className="font-semibold">{fmt(rep.periodTotal)}</div>
                      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-1">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            rep.qualified ? 'bg-cyan-400' : 'bg-amber-500'
                          )}
                          style={{ width: `${rep.progressPct}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right">
                      {rep.qualified ? (
                        <span className="inline-flex items-center gap-1 text-cyan-300 font-semibold text-sm">
                          <Plane className="h-3.5 w-3.5" /> Qualified
                        </span>
                      ) : (
                        <span className="text-zinc-500 text-xs">
                          {fmt(rep.remainingToQualify)} to go
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className={cn(
                        'font-semibold',
                        rep.qualified ? 'text-amber-300' : 'text-zinc-600'
                      )}>
                        {fmtFull(rep.earnedAllowance)}
                      </div>
                      {!rep.qualified && rep.accruedBonus > 0 && (
                        <div className="text-[10px] text-zinc-500">
                          {fmtFull(rep.accruedBonus)} pending
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-zinc-500 text-center pt-2">
          Bonus is only released if rep crosses {fmtFull(rules.qualifyingThreshold)} for the period.
          Below the line = $0 allowance, no trip.
        </p>
      </div>
    </div>
  );
}
