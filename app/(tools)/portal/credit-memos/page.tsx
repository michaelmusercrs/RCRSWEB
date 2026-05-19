'use client';

/**
 * Credit Memos Portal
 *
 * Lets office/PM/driver manually create a credit memo when materials come
 * back to the warehouse and get restocked. Issues a CM<job-digits>-<n>
 * record, posts a [Credit Memo …] note on the job in JobNimbus, and
 * deducts the cost from the job's net material spend.
 *
 * For OUTSIDE-vendor returns (SRS/ABC stock we didn't carry), use
 * /portal/delivery/vendor-returns instead.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  Receipt,
  Briefcase,
  Calendar,
} from 'lucide-react';
import JobSearchAutocomplete, { JobSearchHit } from '@/components/JobSearchAutocomplete';

interface CatalogItem {
  productId: string;
  productName: string;
  unitCost?: number;
  unit?: string;
  currentQty?: number;
  category?: string;
}

interface CreditMemoLine {
  key: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  lineCost: number;
}

interface CreditMemoRecord {
  invoiceId: string;
  type: 'invoice' | 'credit_memo';
  status: 'draft' | 'posted' | 'voided';
  ticketId: string;
  referenceNumber: string;
  jobId: string;
  jobNumber: string;
  jobName: string;
  customerName: string;
  customerAddress: string;
  salesRepName: string;
  lines: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitCost: number;
    lineCost: number;
  }>;
  totalCost: number;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  notes: string;
}

function newLine(): CreditMemoLine {
  return {
    key: crypto.randomUUID(),
    productId: '',
    productName: '',
    quantity: 1,
    unitCost: 0,
    lineCost: 0,
  };
}

export default function CreditMemosPage() {
  const [job, setJob] = useState<JobSearchHit | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [lines, setLines] = useState<CreditMemoLine[]>([newLine()]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [existing, setExisting] = useState<CreditMemoRecord[]>([]);
  const [existingLoading, setExistingLoading] = useState(false);

  // Pull catalog once with cost visible (purpose=restock makes the API return
  // costs for any office/admin/manager/PM/driver — same guard as restock).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCatalogLoading(true);
      try {
        const res = await fetch('/api/portal/inventory?action=list&purpose=restock');
        const data = await res.json();
        if (!cancelled) {
          setCatalog(
            (data.items || []).map((i: Record<string, unknown>) => ({
              productId: i.productId as string,
              productName: i.productName as string,
              unitCost: (i.unitCost as number) || 0,
              unit: (i.unit as string) || '',
              currentQty: (i.currentQty as number) || 0,
              category: (i.category as string) || '',
            })),
          );
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load existing credit memos for the selected job.
  const loadExisting = useCallback(async (jobNumber: string) => {
    if (!jobNumber) {
      setExisting([]);
      return;
    }
    setExistingLoading(true);
    try {
      const res = await fetch(`/api/portal/credit-memos?job=${encodeURIComponent(jobNumber)}`);
      const data = await res.json();
      setExisting(data.records || []);
    } catch {
      setExisting([]);
    } finally {
      setExistingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (job?.rNumber) loadExisting(job.rNumber);
  }, [job?.rNumber, loadExisting]);

  const applyJobHit = useCallback((hit: JobSearchHit) => {
    setJob(hit);
    setResultMsg(null);
  }, []);

  const setProduct = useCallback(
    (key: string, productId: string) => {
      const item = catalog.find(c => c.productId === productId);
      setLines(prev =>
        prev.map(l =>
          l.key === key
            ? {
                ...l,
                productId,
                productName: item?.productName || '',
                unitCost: item?.unitCost ?? l.unitCost,
                lineCost: (item?.unitCost ?? l.unitCost) * l.quantity,
              }
            : l,
        ),
      );
    },
    [catalog],
  );

  const setQty = useCallback((key: string, qty: number) => {
    setLines(prev =>
      prev.map(l =>
        l.key === key
          ? { ...l, quantity: qty, lineCost: Math.round(qty * l.unitCost * 100) / 100 }
          : l,
      ),
    );
  }, []);

  const setUnitCost = useCallback((key: string, cost: number) => {
    setLines(prev =>
      prev.map(l =>
        l.key === key
          ? { ...l, unitCost: cost, lineCost: Math.round(l.quantity * cost * 100) / 100 }
          : l,
      ),
    );
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines(prev => (prev.length <= 1 ? prev : prev.filter(l => l.key !== key)));
  }, []);

  const addLine = useCallback(() => {
    setLines(prev => [...prev, newLine()]);
  }, []);

  const total = useMemo(
    () => lines.reduce((s, l) => s + (l.lineCost || 0), 0),
    [lines],
  );

  const canSubmit = useMemo(() => {
    if (!job?.rNumber) return false;
    const valid = lines.filter(l => l.productId && l.quantity > 0);
    return valid.length > 0;
  }, [job, lines]);

  async function handleSubmit() {
    if (!job?.rNumber) return;
    setSubmitting(true);
    setResultMsg(null);
    try {
      const payload = {
        jobNumber: job.rNumber,
        jobId: job.jnid,
        jobName: job.jobName,
        customerName: job.customerName,
        customerAddress: [job.address, job.city, job.state, job.zip]
          .filter(Boolean)
          .join(', '),
        salesRepName: job.salesRep,
        lines: lines
          .filter(l => l.productId && l.quantity > 0)
          .map(l => ({
            productId: l.productId,
            productName: l.productName,
            quantity: l.quantity,
            unitCost: l.unitCost,
            lineCost: l.lineCost,
          })),
        notes: notes.trim() || undefined,
      };
      const res = await fetch('/api/portal/credit-memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success && data.creditMemo) {
        setResultMsg({
          kind: 'ok',
          text: `Created ${data.creditMemo.invoiceId} ($${data.creditMemo.totalCost.toFixed(2)} credited). JN note posted on ${job.rNumber}.`,
        });
        setLines([newLine()]);
        setNotes('');
        await loadExisting(job.rNumber);
      } else {
        setResultMsg({ kind: 'err', text: data.error || 'Submit failed' });
      }
    } catch (err) {
      setResultMsg({
        kind: 'err',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            href="/portal"
            className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Portal
          </Link>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#39FF14]" />
            Credit Memos
          </h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Job picker */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[#39FF14]" />
            1. Find the job
          </h2>
          <JobSearchAutocomplete
            onSelect={applyJobHit}
            placeholder="R-number, customer name, or address…"
          />

          {job && (
            <div className="mt-4 p-4 bg-[#39FF14]/5 border border-[#39FF14]/30 rounded-lg">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="font-mono text-[#39FF14] font-medium">{job.rNumber}</span>
                <span className="font-medium">{job.customerName}</span>
                {job.status && (
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    {job.status}
                  </span>
                )}
              </div>
              {(job.address || job.city) && (
                <div className="text-xs text-zinc-400 mt-1">
                  {[job.address, job.city, job.state, job.zip].filter(Boolean).join(', ')}
                </div>
              )}
              {job.salesRep && (
                <div className="text-xs text-zinc-500 mt-1">Sales rep: {job.salesRep}</div>
              )}
            </div>
          )}
        </section>

        {/* Line items */}
        {job && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#39FF14]" />
                2. Materials being credited
                {catalogLoading && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />
                )}
              </h2>
              <button
                onClick={addLine}
                className="flex items-center gap-1 text-xs text-[#39FF14] hover:text-[#39FF14]/80"
              >
                <Plus className="w-3.5 h-3.5" />
                Add line
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-zinc-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left py-2 pr-3 font-medium">Item</th>
                    <th className="text-right py-2 pr-3 font-medium w-24">Qty</th>
                    <th className="text-right py-2 pr-3 font-medium w-28">Unit cost</th>
                    <th className="text-right py-2 pr-3 font-medium w-28">Line cost</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {lines.map(line => {
                    const item = catalog.find(c => c.productId === line.productId);
                    return (
                      <tr key={line.key}>
                        <td className="py-2 pr-3">
                          <select
                            value={line.productId}
                            onChange={e => setProduct(line.key, e.target.value)}
                            className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm focus:outline-none focus:border-[#39FF14]/50"
                          >
                            <option value="">Select item…</option>
                            {catalog.map(c => (
                              <option key={c.productId} value={c.productId}>
                                {c.productName}
                                {c.unit ? ` (${c.unit})` : ''}
                              </option>
                            ))}
                          </select>
                          {item && (
                            <div className="text-[10px] text-zinc-500 mt-0.5">
                              {item.productId} · in stock: {item.currentQty ?? '—'}
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <input
                            type="number"
                            value={line.quantity}
                            min={0}
                            step="0.01"
                            onChange={e => setQty(line.key, Number(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-right focus:outline-none focus:border-[#39FF14]/50"
                          />
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <input
                            type="number"
                            value={line.unitCost}
                            min={0}
                            step="0.01"
                            onChange={e => setUnitCost(line.key, Number(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-right focus:outline-none focus:border-[#39FF14]/50"
                          />
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-zinc-300">
                          ${line.lineCost.toFixed(2)}
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => removeLine(line.key)}
                            disabled={lines.length <= 1}
                            className="p-1 text-zinc-500 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Remove line"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-700">
                    <td colSpan={3} className="py-2 pr-3 text-right text-sm text-zinc-400">
                      Total credited
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[#39FF14] font-medium">
                      ${total.toFixed(2)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-4">
              <label className="block text-xs text-zinc-500 mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Why are these materials coming back? Anything Sara should know."
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
              />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-zinc-500">
                Will post `[Credit Memo …]` note on {job.rNumber} in JobNimbus.
              </div>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="flex items-center gap-2 px-4 py-2 bg-[#39FF14] text-black rounded-lg font-medium text-sm hover:bg-[#39FF14]/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Post credit memo
              </button>
            </div>

            {resultMsg && (
              <div
                className={`mt-3 text-sm flex items-start gap-2 ${
                  resultMsg.kind === 'ok' ? 'text-[#39FF14]' : 'text-red-400'
                }`}
              >
                {resultMsg.kind === 'ok' ? (
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                )}
                <span>{resultMsg.text}</span>
              </div>
            )}
          </section>
        )}

        {/* Existing credit memos for this job */}
        {job && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#39FF14]" />
              Previous credit memos on {job.rNumber}
              {existingLoading && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />
              )}
            </h2>
            {existing.length === 0 && !existingLoading ? (
              <p className="text-sm text-zinc-500">No credit memos yet for this job.</p>
            ) : (
              <div className="space-y-2">
                {existing.map(cm => (
                  <div
                    key={cm.invoiceId}
                    className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg"
                  >
                    <div className="flex items-baseline justify-between gap-3 flex-wrap">
                      <div className="font-mono text-[#39FF14] text-sm">{cm.invoiceId}</div>
                      <div className="tabular-nums font-medium text-sm">
                        −${cm.totalCost.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">
                      {cm.lines.length} line{cm.lines.length === 1 ? '' : 's'} ·{' '}
                      {new Date(cm.createdAt).toLocaleString()} ·{' '}
                      {cm.createdByName || cm.createdBy || 'system'}
                    </div>
                    {cm.notes && (
                      <div className="text-xs text-zinc-500 mt-1 italic">{cm.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
