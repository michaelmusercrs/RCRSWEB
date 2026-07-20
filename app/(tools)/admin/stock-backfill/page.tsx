'use client';

/**
 * Stock Backfill admin page
 *
 * Use after deploying the Apps Script in stock@rcrsal.com Gmail. Workflow:
 *   1. Apps Script forwards every Material Order email to the webhook
 *   2. Each forwarded email creates a Tickets row in status='created'
 *   3. Click "Process all" here to advance every pending ticket through
 *      load_verified — deducts stock, dual-writes the legacy app, emails
 *      a price-only invoice to rcrs@rcrsal.com.
 *
 * Safe to run repeatedly: already-verified tickets are filtered out.
 */

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, RefreshCw, Play, CheckCircle2, AlertTriangle, Package } from 'lucide-react';

interface PendingTicket {
  ticketId: string;
  jobNumber: string;
  customerName: string;
  materialsCount: number;
  totalPrice: number;
  createdAt: string;
}

interface BackfillResult {
  ticketId: string;
  jobNumber: string;
  customerName: string;
  materialsCount: number;
  totalPrice: number;
  status: 'processed' | 'skipped' | 'failed';
  reason?: string;
}

interface BackfillResponse {
  success: boolean;
  summary: {
    total: number;
    processed: number;
    failed: number;
    performedBy: string;
    performedAt: string;
  };
  results: BackfillResult[];
}

const fmt = (n: number) => `$${n.toFixed(2)}`;

export default function StockBackfillPage() {
  const [pending, setPending] = useState<PendingTicket[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<BackfillResponse | null>(null);
  // Silent mode = no office email. Use for historical emails where the
  // materials were already physically delivered weeks/months ago.
  const [silent, setSilent] = useState(true);

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/stock-backfill', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPending(data.tickets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const processAll = useCallback(async () => {
    if (!pending || pending.length === 0) return;
    const emailNote = silent
      ? 'NO email will be sent (silent mode).'
      : 'A price-only invoice email will be sent to rcrs@rcrsal.com per ticket.';
    if (!confirm(`Process ${pending.length} ticket${pending.length === 1 ? '' : 's'}? This will deduct stock. ${emailNote}`)) return;

    setProcessing(true);
    setError(null);
    setResponse(null);
    try {
      const res = await fetch('/api/admin/stock-backfill', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ silent }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setResponse(data);
      // Refresh the pending list so the count drops to 0 (or to whatever still failed)
      await loadPending();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessing(false);
    }
  }, [pending, loadPending, silent]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <Link href="/admin" className="inline-flex items-center text-sm text-gray-600 hover:text-black mb-4">
          <ArrowLeft size={16} className="mr-1" />Back to Admin
        </Link>

        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Package size={24} className="text-brand-green-dark" />
            <h1 className="text-2xl font-bold">Stock Backfill</h1>
          </div>
          <p className="text-sm text-gray-600">
            Catches historical Material Order emails up to current state. For each ticket in
            <code className="px-1 mx-1 bg-gray-100 rounded text-xs">status=&apos;created&apos;</code>
            this will deduct stock from the master Inventory tab, mark the ticket as load-verified,
            and email a price-only invoice to <code className="px-1 mx-1 bg-gray-100 rounded text-xs">rcrs@rcrsal.com</code>.
            Already-verified tickets are skipped, so running twice is safe.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">1. Preview pending tickets</h2>
            <button
              onClick={loadPending}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {pending === null ? 'Load pending' : 'Refresh'}
            </button>
          </div>

          {pending !== null && (
            <div>
              <p className="text-sm text-gray-700 mb-3">
                <strong>{pending.length}</strong> ticket{pending.length === 1 ? '' : 's'} waiting to be processed.
              </p>
              {pending.length > 0 && (
                <div className="border border-gray-200 rounded overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Ticket</th>
                        <th className="text-left px-3 py-2 font-medium">Job</th>
                        <th className="text-left px-3 py-2 font-medium">Customer</th>
                        <th className="text-right px-3 py-2 font-medium">Items</th>
                        <th className="text-right px-3 py-2 font-medium">Total Price</th>
                        <th className="text-left px-3 py-2 font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pending.map(t => (
                        <tr key={t.ticketId} className="border-t border-gray-100">
                          <td className="px-3 py-2 font-mono text-xs">{t.ticketId}</td>
                          <td className="px-3 py-2">{t.jobNumber}</td>
                          <td className="px-3 py-2">{t.customerName}</td>
                          <td className="px-3 py-2 text-right">{t.materialsCount}</td>
                          <td className="px-3 py-2 text-right">{fmt(t.totalPrice)}</td>
                          <td className="px-3 py-2 text-xs text-gray-500">{t.createdAt?.slice(0, 10)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">2. Process all</h2>
            <button
              onClick={processAll}
              disabled={processing || !pending || pending.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-green hover:opacity-90 text-black rounded font-medium disabled:opacity-50"
            >
              {processing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              Process {pending?.length || 0} ticket{pending?.length === 1 ? '' : 's'}
            </button>
          </div>

          <label className="flex items-start gap-2 mb-4 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={silent}
              onChange={e => setSilent(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-sm">
              <span className="font-medium">Silent mode — no office email</span>
              <span className="block text-xs text-gray-600 mt-0.5">
                Use for historical/catch-up batches where materials were already delivered.
                Stock is still deducted and invoice records still written; only the
                outbound email to rcrs@rcrsal.com is suppressed.
              </span>
            </span>
          </label>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 flex items-start gap-2">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <div><strong>Error:</strong> {error}</div>
            </div>
          )}

          {response && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-900 flex items-start gap-2">
                <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Done.</strong> Processed {response.summary.processed} of {response.summary.total}.
                  {response.summary.failed > 0 && <> {response.summary.failed} failed.</>}
                </div>
              </div>

              <div className="border border-gray-200 rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Ticket</th>
                      <th className="text-left px-3 py-2 font-medium">Job</th>
                      <th className="text-left px-3 py-2 font-medium">Status</th>
                      <th className="text-left px-3 py-2 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {response.results.map(r => (
                      <tr key={r.ticketId} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-mono text-xs">{r.ticketId}</td>
                        <td className="px-3 py-2">{r.jobNumber}</td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              r.status === 'processed'
                                ? 'text-green-700'
                                : r.status === 'failed'
                                ? 'text-red-700'
                                : 'text-gray-500'
                            }
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">{r.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-500">
          Need help? See <code className="px-1 bg-gray-100 rounded">apps-script/stock-email-forwarder.gs</code>
          {' '}for the Apps Script setup; once it&apos;s running, this page handles every email backfill in one click.
        </p>
      </div>
    </div>
  );
}
