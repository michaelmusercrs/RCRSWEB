'use client';

/**
 * /portal/billing/payments
 *
 * Lists every customer invoice in `sent` status (awaiting payment) and
 * lets the office mark one paid. Marking paid:
 *   1. POSTs to /api/portal/billing/payments
 *   2. Server advances the order PAYMENT_RECEIVED -> JOB_CLOSED
 *   3. Customer receives a receipt PDF email
 *   4. UI refreshes
 *
 * Dark theme matches /portal/inventory (bg-zinc-950, neon green #39FF14
 * accents). Mobile responsive.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Banknote,
  CheckCircle,
  CreditCard,
  DollarSign,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  X,
  AlertCircle,
} from 'lucide-react';

type PaymentMethod = 'check' | 'card' | 'ach' | 'cash' | 'other';

interface InvoiceRow {
  invoiceId: string;
  orderId: string;
  jobNumber: string;
  jobName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryZip: string;
  total: number;
  paidAmount: number;
  balanceDue: number;
  status: 'draft' | 'sent' | 'paid' | 'void';
  createdAt: string;
  sentAt?: string;
  items: Array<{
    productName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
  }>;
  currentStage: string | null;
}

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(n);

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

export default function PaymentsPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Mark-paid modal state
  const [selected, setSelected] = useState<InvoiceRow | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>('check');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/billing/payments?status=sent', {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Request failed: ${res.status}`);
      }
      setInvoices(data.data?.invoices || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Clear success banner after 6 seconds
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 6000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const filtered = useMemo(() => {
    if (!search.trim()) return invoices;
    const q = search.toLowerCase();
    return invoices.filter(
      (i) =>
        i.invoiceId.toLowerCase().includes(q) ||
        i.customerName.toLowerCase().includes(q) ||
        i.jobNumber.toLowerCase().includes(q) ||
        i.jobName.toLowerCase().includes(q) ||
        i.deliveryAddress.toLowerCase().includes(q)
    );
  }, [invoices, search]);

  const totals = useMemo(() => {
    const outstanding = invoices.reduce(
      (s, i) => s + (i.balanceDue || 0),
      0
    );
    return {
      count: invoices.length,
      outstanding,
    };
  }, [invoices]);

  function openModal(inv: InvoiceRow) {
    setSelected(inv);
    setAmount(inv.balanceDue.toFixed(2));
    setDate(new Date().toISOString().slice(0, 10));
    setMethod('check');
    setReference('');
    setNotes('');
    setFormError(null);
  }

  function closeModal() {
    setSelected(null);
    setSubmitting(false);
    setFormError(null);
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;

    const amountNum = parseFloat(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setFormError('Amount must be a positive number');
      return;
    }
    if (!date) {
      setFormError('Payment date is required');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch('/api/portal/billing/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: selected.invoiceId,
          amount: amountNum,
          date: new Date(date).toISOString(),
          method,
          reference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Request failed: ${res.status}`);
      }

      setSuccessMsg(
        `Payment recorded for ${selected.invoiceId}. ${
          data.data?.jobClosed ? 'Job auto-closed.' : 'Job-close pending — check logs.'
        } Receipt PDF emailed to ${selected.customerEmail || 'customer (no email on file)'}.`
      );
      closeModal();
      fetchInvoices();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Payment failed');
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/portal/billing"
              className="text-zinc-400 hover:text-white transition-colors shrink-0"
              aria-label="Back to billing"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Banknote className="w-5 h-5 text-[#39FF14]" />
                Payments
              </h1>
              <p className="text-sm text-zinc-400 truncate">
                Mark paid to close jobs &amp; send receipts
              </p>
            </div>
          </div>
          <button
            onClick={fetchInvoices}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Stats bar */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center gap-4 sm:gap-8">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#39FF14]" />
            <span className="text-sm text-zinc-400">
              Awaiting payment:{' '}
              <strong className="text-white">{totals.count}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#39FF14]" />
            <span className="text-sm text-zinc-400">
              Total outstanding:{' '}
              <strong className="text-white">
                {fmtCurrency(totals.outstanding)}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="mx-4 sm:mx-6 mt-4 p-3 bg-[#39FF14]/10 border border-[#39FF14]/40 rounded-lg flex items-start gap-2">
          <CheckCircle className="w-5 h-5 text-[#39FF14] shrink-0 mt-0.5" />
          <p className="text-sm text-zinc-100">{successMsg}</p>
        </div>
      )}

      {/* Search bar */}
      <div className="px-4 sm:px-6 py-4 bg-zinc-950 border-b border-zinc-800">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice / customer / job / address"
            className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14]"
          />
        </div>
      </div>

      {/* Body */}
      <main className="px-4 sm:px-6 py-6">
        {loading && (
          <div className="flex items-center justify-center py-16 text-zinc-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading invoices...
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/40 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-300">Failed to load</p>
              <p className="text-sm text-zinc-400 mt-1">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-xl">
            <CheckCircle className="w-12 h-12 text-[#39FF14] mx-auto mb-3" />
            <p className="text-zinc-300 font-semibold">
              All caught up — no invoices awaiting payment.
            </p>
            <p className="text-zinc-500 text-sm mt-1">
              When an order reaches Stage 16 (INVOICE_SENT), it&apos;ll show up here.
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <ul className="space-y-3">
            {filtered.map((inv) => (
              <li
                key={inv.invoiceId}
                className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
              >
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-[#39FF14] font-mono text-sm">
                        {inv.invoiceId}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] uppercase tracking-wide rounded bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">
                        {inv.status}
                      </span>
                      {inv.currentStage && (
                        <span className="px-2 py-0.5 text-[10px] uppercase tracking-wide rounded bg-zinc-800 text-zinc-400">
                          {inv.currentStage}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-white font-semibold truncate">
                      {inv.customerName || 'Unknown customer'}
                    </p>
                    <p className="text-sm text-zinc-400 truncate">
                      {inv.jobName || inv.jobNumber}
                      {inv.deliveryAddress
                        ? ` — ${inv.deliveryAddress}, ${inv.deliveryCity || ''}`
                        : ''}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Sent {fmtDate(inv.sentAt || inv.createdAt)}
                      {inv.customerEmail ? ` • ${inv.customerEmail}` : ''}
                    </p>
                  </div>

                  <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-zinc-500 uppercase tracking-wide">
                        Balance Due
                      </p>
                      <p className="text-2xl font-bold text-[#39FF14]">
                        {fmtCurrency(inv.balanceDue)}
                      </p>
                      {inv.paidAmount > 0 && (
                        <p className="text-xs text-zinc-500">
                          paid {fmtCurrency(inv.paidAmount)} of{' '}
                          {fmtCurrency(inv.total)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <a
                        href={`/api/portal/billing/payments/pdf?invoiceId=${encodeURIComponent(inv.invoiceId)}&variant=customer`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-zinc-800 text-zinc-200 font-semibold rounded-lg hover:bg-zinc-700 transition-colors justify-center"
                        title="Preview customer invoice PDF"
                      >
                        <Eye className="w-4 h-4" />
                        <span className="sm:hidden">PDF</span>
                        <span className="hidden sm:inline">View PDF</span>
                      </a>
                      <button
                        onClick={() => openModal(inv)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 transition-colors justify-center"
                      >
                        <CreditCard className="w-4 h-4" />
                        Mark Paid
                      </button>
                    </div>
                  </div>
                </div>

                {/* Compact line-items preview */}
                {inv.items && inv.items.length > 0 && (
                  <div className="border-t border-zinc-800 px-4 sm:px-5 py-3 bg-zinc-950/50">
                    <ul className="text-xs text-zinc-400 space-y-0.5">
                      {inv.items.slice(0, 3).map((it, i) => (
                        <li key={i} className="flex justify-between gap-3">
                          <span className="truncate">
                            {it.quantity} {it.unit} {it.productName}
                          </span>
                          <span className="text-zinc-300 font-mono shrink-0">
                            {fmtCurrency(it.totalPrice)}
                          </span>
                        </li>
                      ))}
                      {inv.items.length > 3 && (
                        <li className="text-zinc-500 italic">
                          + {inv.items.length - 3} more line item
                          {inv.items.length - 3 === 1 ? '' : 's'}
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Mark-paid modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) closeModal();
          }}
        >
          <div className="bg-zinc-900 border border-zinc-700 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Record Payment</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {selected.invoiceId} • {selected.customerName}
                </p>
              </div>
              <button
                onClick={closeModal}
                disabled={submitting}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg disabled:opacity-50"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitPayment} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">
                  Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                    $
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    autoFocus
                    className="w-full pl-7 pr-3 py-2.5 bg-zinc-950 border border-zinc-700 rounded-lg text-white text-lg font-mono focus:outline-none focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14]"
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Balance due: {fmtCurrency(selected.balanceDue)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">
                  Date received
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">
                  Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['check', 'card', 'ach', 'cash', 'other'] as PaymentMethod[]).map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setMethod(m)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold uppercase tracking-wide transition-colors border ${
                        method === m
                          ? 'bg-[#39FF14] text-black border-[#39FF14]'
                          : 'bg-zinc-950 text-zinc-300 border-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">
                  Reference #{' '}
                  <span className="text-zinc-500 normal-case font-normal">
                    (check #, last 4, ACH ref...)
                  </span>
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="optional"
                  className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">
                  Notes{' '}
                  <span className="text-zinc-500 normal-case font-normal">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14] resize-none"
                />
              </div>

              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/40 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{formError}</p>
                </div>
              )}

              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-400">
                Marking paid will:
                <ul className="mt-1 space-y-0.5 ml-4 list-disc">
                  <li>Advance the order to Stage 17 (PAYMENT_RECEIVED)</li>
                  <li>Email a PAID receipt PDF to{' '}
                    {selected.customerEmail ? (
                      <span className="text-zinc-200">{selected.customerEmail}</span>
                    ) : (
                      <span className="text-amber-300">customer (no email on file — receipt will be skipped)</span>
                    )}
                  </li>
                  <li>Auto-advance to Stage 18 (JOB_CLOSED)</li>
                </ul>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-zinc-800 text-zinc-300 font-semibold rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Recording...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Record Payment
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
