'use client';

/**
 * Inventory Forecast Page
 *
 * Surfaces the 14-day projected material consumption from
 * lib/predictive-stock-service. Highlights items projected to go
 * negative against current available stock and surfaces a suggested
 * PO quantity (rounded to the vendor's reorderQty step when available).
 *
 * Data comes from /api/portal/inventory/forecast, which calls
 * predictiveStockService.generateForecast() on demand.
 *
 * Surfaces:
 *   - Job count + horizon
 *   - Storm buffer status (with NWS reason)
 *   - Shortfalls table (red rows for the worst projected gaps)
 *   - Full per-item projection table
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  CloudRain,
  Package,
  TrendingDown,
  Calendar,
  Loader2,
} from 'lucide-react';

interface MaterialForecastLine {
  productId: string;
  productName: string;
  category: string;
  unit: string;
  currentQty: number;
  holdQty: number;
  availableQty: number;
  baseProjectedUsage: number;
  stormBufferAdded: number;
  projectedUsage: number;
  projectedShortfall: number;
  suggestedPoQty: number;
  contributingJobCount: number;
}

interface JobForecastInput {
  jnid: string;
  jobNumber: string;
  customerName: string;
  scheduledStartDate: string;
  status: string;
  squares: number;
}

interface ForecastPayload {
  generatedAt: string;
  horizonDays: number;
  jobCount: number;
  jobs: JobForecastInput[];
  stormBufferApplied: boolean;
  stormReason?: string;
  lines: MaterialForecastLine[];
  shortfalls: MaterialForecastLine[];
}

export default function InventoryForecastPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [forecast, setForecast] = useState<ForecastPayload | null>(null);
  const [error, setError] = useState<string>('');
  const [horizonDays, setHorizonDays] = useState(14);

  const load = async (opts?: { silent?: boolean }) => {
    if (opts?.silent) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/portal/inventory/forecast?days=${horizonDays}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setForecast(data.forecast);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load forecast');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // load once on mount; re-runs are triggered by the "Refresh" button so we
    // don't pound the JN/NWS APIs on every nav.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/portal/inventory"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-green transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Inventory
          </Link>

          <button
            onClick={() => load({ silent: true })}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </button>
        </div>

        <h1 className="text-3xl font-bold mb-2">
          <TrendingDown className="inline w-8 h-8 mr-2 text-brand-green" />
          Stock Forecast
        </h1>
        <p className="text-gray-400 mb-8">
          Projected material consumption over the next {horizonDays} days based on
          signed JobNimbus jobs + NWS severe-weather buffer. Planning estimate — refine
          before placing POs.
        </p>

        <div className="flex gap-3 mb-6">
          <label className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-400" />
            Horizon:
            <select
              value={horizonDays}
              onChange={(e) => setHorizonDays(Number(e.target.value))}
              className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={21}>21 days</option>
              <option value={30}>30 days</option>
            </select>
          </label>
          <button
            onClick={() => load({ silent: true })}
            className="px-3 py-1 bg-brand-green text-black rounded text-sm font-semibold hover:bg-brand-green/80"
          >
            Apply
          </button>
        </div>

        {loading && !forecast && (
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading forecast...
          </div>
        )}

        {error && (
          <div className="bg-red-950 border border-red-700 rounded-lg p-4 mb-6 text-red-300">
            <AlertTriangle className="inline w-5 h-5 mr-2" />
            {error}
          </div>
        )}

        {forecast && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <StatCard
                label="Scheduled Jobs"
                value={forecast.jobCount}
                hint={`Next ${forecast.horizonDays}d`}
              />
              <StatCard
                label="Shortfalls"
                value={forecast.shortfalls.length}
                hint="Items below projection"
                tone={forecast.shortfalls.length > 0 ? 'danger' : 'normal'}
              />
              <StatCard
                label="Storm Buffer"
                value={forecast.stormBufferApplied ? 'ON' : 'off'}
                hint={
                  forecast.stormBufferApplied
                    ? `+30% (${forecast.stormReason?.slice(0, 40) || 'NWS alert'})`
                    : 'No severe weather'
                }
                tone={forecast.stormBufferApplied ? 'warn' : 'normal'}
              />
              <StatCard
                label="Generated"
                value={formatTime(forecast.generatedAt)}
                hint={new Date(forecast.generatedAt).toLocaleDateString()}
              />
            </div>

            {forecast.stormBufferApplied && forecast.stormReason && (
              <div className="bg-orange-950 border border-orange-700 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <CloudRain className="w-5 h-5 text-orange-400 mt-0.5" />
                  <div>
                    <div className="font-semibold text-orange-300">
                      Storm buffer applied (+30% to roofing materials)
                    </div>
                    <div className="text-sm text-orange-200/80 mt-1">
                      {forecast.stormReason}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Projected Shortfalls
              <span className="text-sm font-normal text-gray-400">
                ({forecast.shortfalls.length})
              </span>
            </h2>

            {forecast.shortfalls.length === 0 ? (
              <div className="bg-green-950/50 border border-green-700 rounded-lg p-6 text-center mb-8">
                <Package className="w-8 h-8 mx-auto text-green-400 mb-2" />
                <div className="text-green-300 font-semibold">
                  Inventory looks good
                </div>
                <div className="text-sm text-green-200/80 mt-1">
                  No items projected to run short over the next {forecast.horizonDays} days.
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden mb-8">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-800">
                    <tr>
                      <th className="px-4 py-3 text-left">Item</th>
                      <th className="px-4 py-3 text-right">On hand</th>
                      <th className="px-4 py-3 text-right">Projected use</th>
                      <th className="px-4 py-3 text-right">Short by</th>
                      <th className="px-4 py-3 text-right">Suggested PO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.shortfalls.map((s) => (
                      <tr key={s.productId} className="border-t border-zinc-800 hover:bg-zinc-800/40">
                        <td className="px-4 py-3">
                          <div className="font-semibold">{s.productName}</div>
                          <div className="text-xs text-gray-500">
                            {s.category} · {s.productId}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {s.availableQty.toFixed(1)} {s.unit}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {s.projectedUsage.toFixed(1)} {s.unit}
                          {s.stormBufferAdded > 0 && (
                            <div className="text-xs text-orange-400">
                              +{s.stormBufferAdded.toFixed(1)} storm
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-red-400 font-bold">
                          -{s.projectedShortfall.toFixed(1)} {s.unit}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-block px-3 py-1 bg-brand-green text-black rounded font-bold">
                            {s.suggestedPoQty} {s.unit}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
              <Package className="w-5 h-5 text-brand-green" />
              All Items Projection
              <span className="text-sm font-normal text-gray-400">
                ({forecast.lines.length})
              </span>
            </h2>

            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden mb-8">
              <table className="w-full text-sm">
                <thead className="bg-zinc-800">
                  <tr>
                    <th className="px-4 py-3 text-left">Item</th>
                    <th className="px-4 py-3 text-right">On hand</th>
                    <th className="px-4 py-3 text-right">Projected use</th>
                    <th className="px-4 py-3 text-right">After</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.lines.map((line) => {
                    const after = line.availableQty - line.projectedUsage;
                    const rowClass = line.projectedShortfall > 0
                      ? 'bg-red-950/30'
                      : line.projectedUsage > 0 && after < line.availableQty * 0.25
                        ? 'bg-orange-950/20'
                        : '';
                    return (
                      <tr
                        key={line.productId}
                        className={`border-t border-zinc-800 hover:bg-zinc-800/40 ${rowClass}`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold">{line.productName}</div>
                          <div className="text-xs text-gray-500">{line.category}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {line.availableQty.toFixed(1)} {line.unit}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {line.projectedUsage.toFixed(1)} {line.unit}
                        </td>
                        <td className={`px-4 py-3 text-right ${after < 0 ? 'text-red-400 font-bold' : 'text-gray-300'}`}>
                          {after.toFixed(1)} {line.unit}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {forecast.jobs.length > 0 && (
              <details className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <summary className="font-semibold cursor-pointer">
                  Contributing Jobs ({forecast.jobs.length})
                </summary>
                <ul className="mt-3 space-y-2 text-sm">
                  {forecast.jobs.map((j) => (
                    <li key={j.jnid} className="flex justify-between text-gray-300">
                      <span>
                        <strong>{j.jobNumber || j.jnid.slice(0, 8)}</strong>: {j.customerName}
                        <span className="text-xs text-gray-500 ml-2">({j.status})</span>
                      </span>
                      <span className="text-gray-400">
                        {j.squares} sq · {j.scheduledStartDate ? new Date(j.scheduledStartDate).toLocaleDateString() : 'no date'}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = 'normal',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'normal' | 'warn' | 'danger';
}) {
  const toneClass =
    tone === 'danger' ? 'border-red-700' : tone === 'warn' ? 'border-orange-600' : 'border-zinc-700';
  return (
    <div className={`bg-zinc-900 border ${toneClass} rounded-lg p-4`}>
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}
