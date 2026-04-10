'use client';

/**
 * Invoice Detail / Print View
 *
 * Renders a single pipeline invoice in a clean, print-friendly layout.
 * Pulls from /api/portal/pipeline?action=invoice&invoiceId=...
 *
 * Two viewing modes:
 *   - Customer invoice (final price only) — safe to share / print / email
 *   - Internal invoice (with cost + margin) — admin/office only
 *
 * Hit Cmd/Ctrl+P or click Print to print. Click "Email to Customer"
 * to fire emailService.send via /api/portal/pipeline POST emailInvoice.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Printer,
  Mail,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Building2,
  User,
  MapPin,
  Calendar,
  DollarSign,
  Lock,
} from 'lucide-react';

interface InvoiceItem {
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  unitCost?: number;
  totalCost?: number;
}

interface PipelineInvoice {
  invoiceId: string;
  orderId: string;
  type: 'customer' | 'internal';
  jobNumber: string;
  jobName: string;
  customerName: string;
  customerEmail?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  costTotal?: number;
  margin?: number;
  status: 'draft' | 'sent' | 'paid' | 'void';
  createdAt: string;
  sentAt?: string;
  paidAt?: string;
  paidAmount?: number;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<PipelineInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailing, setEmailing] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);

  const fetchInvoice = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/pipeline?action=invoice&invoiceId=${invoiceId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Invoice fetch failed: ${res.status}`);
      }
      const data = await res.json();
      setInvoice(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const handlePrint = () => {
    window.print();
  };

  const handleEmailToCustomer = async () => {
    if (!invoice?.customerEmail) {
      setEmailMessage('No customer email on file — add one to the order first.');
      return;
    }
    setEmailing(true);
    setEmailMessage(null);
    try {
      const res = await fetch('/api/portal/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'emailInvoice',
          invoiceId: invoice.invoiceId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Email send failed');
      }
      setEmailMessage(`Sent to ${invoice.customerEmail}`);
      // Refetch to pick up the new sentAt timestamp
      await fetchInvoice();
    } catch (err) {
      setEmailMessage(`Failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setEmailing(false);
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const formatDate = (s: string) => {
    if (!s) return '—';
    try {
      return new Date(s).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return s;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-brand-green animate-spin" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white mb-2">Invoice Not Found</h2>
          <p className="text-zinc-400">{error || `Invoice ${invoiceId} does not exist`}</p>
          <Link
            href="/portal/delivery/invoices"
            className="mt-4 inline-block text-brand-green hover:underline"
          >
            Back to Invoices
          </Link>
        </div>
      </div>
    );
  }

  const isInternal = invoice.type === 'internal';

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Print-only styles: hide everything except the invoice paper */}
      <style jsx global>{`
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .print-paper {
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
            max-width: 100% !important;
            padding: 0 !important;
          }
          .print-paper * {
            color: black !important;
            border-color: #ccc !important;
          }
        }
      `}</style>

      {/* Toolbar — hidden on print */}
      <header className="no-print bg-zinc-900 border-b border-zinc-800 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link
              href={`/portal/orders/${invoice.orderId}`}
              className="text-zinc-500 hover:text-brand-green"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                {invoice.invoiceId}
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    isInternal
                      ? 'bg-purple-500/20 text-purple-300'
                      : 'bg-brand-green/20 text-brand-green'
                  }`}
                >
                  {isInternal ? 'INTERNAL' : 'CUSTOMER'}
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    invoice.status === 'paid'
                      ? 'bg-brand-green/20 text-brand-green'
                      : invoice.status === 'sent'
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'bg-zinc-700/50 text-zinc-400'
                  }`}
                >
                  {invoice.status.toUpperCase()}
                </span>
              </h1>
              <p className="text-xs text-zinc-500">{invoice.jobName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isInternal && invoice.customerEmail && (
              <button
                onClick={handleEmailToCustomer}
                disabled={emailing}
                className="flex items-center gap-2 px-3 py-2 bg-brand-green/15 text-brand-green border border-brand-green/30 rounded-xl hover:bg-brand-green/25 text-sm font-bold disabled:opacity-50"
              >
                {emailing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Email to Customer
              </button>
            )}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-xl hover:bg-zinc-700 text-sm font-bold"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>
        {emailMessage && (
          <div className="max-w-4xl mx-auto mt-3 px-3 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-xs text-cyan-200 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {emailMessage}
          </div>
        )}
      </header>

      {/* The actual invoice paper — what gets printed */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="print-paper bg-white text-black rounded-xl shadow-xl p-12">
          {/* Letterhead */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-black">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Building2 className="w-10 h-10" />
                <div>
                  <h2 className="text-2xl font-black tracking-tight">River City Roofing Solutions</h2>
                  <p className="text-xs text-neutral-600">IKO ROOFPRO Craftsman Premier · BBB A+</p>
                </div>
              </div>
              <p className="text-sm text-neutral-600 mt-2">
                Decatur, AL · (256) 274-8530<br />
                rcrs@rivercityroofingsolutions.com
              </p>
            </div>
            <div className="text-right">
              <h1 className="text-4xl font-black mb-1">INVOICE</h1>
              <p className="text-sm font-bold">{invoice.invoiceId}</p>
              {isInternal && (
                <div className="mt-3 inline-flex items-center gap-1 px-2 py-1 bg-purple-100 border border-purple-300 rounded text-xs font-bold text-purple-800">
                  <Lock className="w-3 h-3" />
                  INTERNAL · DO NOT SEND
                </div>
              )}
            </div>
          </div>

          {/* Bill-to + dates */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Bill To</h3>
              <div className="text-base">
                <p className="font-bold flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {invoice.customerName}
                </p>
                {invoice.customerEmail && (
                  <p className="text-sm text-neutral-600 mt-1">{invoice.customerEmail}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Invoice Date</h3>
              <p className="text-base font-bold flex items-center justify-end gap-2">
                <Calendar className="w-4 h-4" />
                {formatDate(invoice.createdAt)}
              </p>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mt-3 mb-1">Job</h3>
              <p className="text-sm">{invoice.jobNumber}</p>
              <p className="text-sm font-bold">{invoice.jobName}</p>
            </div>
          </div>

          {/* Line items table */}
          <table className="w-full mb-8 border-collapse">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="text-left py-3 text-xs font-bold uppercase tracking-wider">Description</th>
                <th className="text-right py-3 text-xs font-bold uppercase tracking-wider w-20">Qty</th>
                <th className="text-right py-3 text-xs font-bold uppercase tracking-wider w-24">Unit</th>
                {isInternal && (
                  <th className="text-right py-3 text-xs font-bold uppercase tracking-wider w-28 bg-purple-50">
                    Cost
                  </th>
                )}
                <th className="text-right py-3 text-xs font-bold uppercase tracking-wider w-28">Price</th>
                <th className="text-right py-3 text-xs font-bold uppercase tracking-wider w-32">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, idx) => (
                <tr key={idx} className="border-b border-neutral-200">
                  <td className="py-3 text-sm">{item.productName}</td>
                  <td className="py-3 text-sm text-right">{item.quantity}</td>
                  <td className="py-3 text-sm text-right text-neutral-500">{item.unit}</td>
                  {isInternal && (
                    <td className="py-3 text-sm text-right bg-purple-50">
                      {item.totalCost !== undefined ? formatCurrency(item.totalCost) : '—'}
                    </td>
                  )}
                  <td className="py-3 text-sm text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-3 text-sm text-right font-bold">
                    {formatCurrency(item.totalPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <table className="w-80">
              <tbody>
                <tr>
                  <td className="py-1 text-sm text-neutral-600">Subtotal</td>
                  <td className="py-1 text-sm text-right">{formatCurrency(invoice.subtotal)}</td>
                </tr>
                {invoice.tax > 0 && (
                  <tr>
                    <td className="py-1 text-sm text-neutral-600">Tax</td>
                    <td className="py-1 text-sm text-right">{formatCurrency(invoice.tax)}</td>
                  </tr>
                )}
                {isInternal && invoice.costTotal !== undefined && (
                  <>
                    <tr className="bg-purple-50">
                      <td className="py-1 text-sm text-purple-900 font-bold">Total Cost</td>
                      <td className="py-1 text-sm text-right text-purple-900 font-bold">
                        {formatCurrency(invoice.costTotal)}
                      </td>
                    </tr>
                    <tr className="bg-purple-50">
                      <td className="py-1 text-sm text-purple-900 font-bold">Margin</td>
                      <td className="py-1 text-sm text-right text-purple-900 font-bold">
                        {formatCurrency(invoice.margin || 0)}
                      </td>
                    </tr>
                  </>
                )}
                <tr className="border-t-2 border-black">
                  <td className="py-3 text-lg font-black">TOTAL</td>
                  <td className="py-3 text-lg font-black text-right">
                    {formatCurrency(invoice.total)}
                  </td>
                </tr>
                {invoice.paidAmount && (
                  <tr>
                    <td className="py-1 text-sm text-green-700">Paid</td>
                    <td className="py-1 text-sm text-right text-green-700 font-bold">
                      {formatCurrency(invoice.paidAmount)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Payment status badge */}
          {invoice.status === 'paid' && (
            <div className="mb-6 p-4 bg-green-50 border-2 border-green-700 rounded-lg flex items-center justify-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-700" />
              <p className="text-lg font-bold text-green-700">
                PAID IN FULL{invoice.paidAt ? ` · ${formatDate(invoice.paidAt)}` : ''}
              </p>
            </div>
          )}

          {/* Footer / payment terms */}
          <div className="pt-6 border-t border-neutral-300 text-xs text-neutral-600">
            <p className="mb-2">
              <strong>Payment Terms:</strong> Net 30. Make checks payable to River City Roofing Solutions.
              Bitcoin and credit cards accepted via the customer portal.
            </p>
            <p className="mb-2">
              <strong>Questions?</strong> Call (256) 274-8530 or email rcrs@rivercityroofingsolutions.com
            </p>
            <p className="text-center mt-4 text-neutral-400">
              Thank you for choosing River City Roofing Solutions
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
