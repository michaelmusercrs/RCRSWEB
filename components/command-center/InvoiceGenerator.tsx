'use client';

/**
 * InvoiceGenerator Component
 *
 * Allows users to generate, view, and manage invoices from customer breakdowns.
 * Supports PDF export and sending to customer portal.
 */

import * as React from 'react';
import {
  FileText,
  Send,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  DollarSign,
  Calendar,
  User,
  Building2,
  Printer,
  ExternalLink,
  Loader2,
  Copy,
  Mail,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface LineItem {
  lineId: string;
  type: 'material' | 'labor' | 'fee' | 'discount';
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

interface Invoice {
  invoiceId: string;
  invoiceNumber: string;
  breakdownId: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  jobId: string;
  jobName: string;
  jobAddress: string;
  lineItems: LineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  discountReason?: string;
  total: number;
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled' | 'disputed';
  dueDate: string;
  paidDate?: string;
  paidAmount?: number;
  paymentMethod?: string;
  createdAt: string;
  createdByName: string;
  sentAt?: string;
  sentTo?: string;
  notes: string[];
  terms?: string;
}

interface InvoiceGeneratorProps {
  invoice?: Invoice;
  onSend?: (email: string) => Promise<void>;
  onMarkPaid?: (amount: number, method: string, reference: string) => Promise<void>;
  onViewPdf?: () => void;
  onCopyLink?: () => void;
  canEdit?: boolean;
  isLoading?: boolean;
}

export default function InvoiceGenerator({
  invoice,
  onSend,
  onMarkPaid,
  onViewPdf,
  onCopyLink,
  canEdit = false,
  isLoading = false,
}: InvoiceGeneratorProps) {
  const [showSendModal, setShowSendModal] = React.useState(false);
  const [showPaymentModal, setShowPaymentModal] = React.useState(false);
  const [sendEmail, setSendEmail] = React.useState('');
  const [paymentAmount, setPaymentAmount] = React.useState('');
  const [paymentMethod, setPaymentMethod] = React.useState('');
  const [paymentReference, setPaymentReference] = React.useState('');
  const [processing, setProcessing] = React.useState(false);

  React.useEffect(() => {
    if (invoice?.customerEmail) {
      setSendEmail(invoice.customerEmail);
    }
    if (invoice?.total) {
      setPaymentAmount(invoice.total.toString());
    }
  }, [invoice]);

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-zinc-600 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No Invoice Selected</h3>
        <p className="text-zinc-400">
          Select an invoice from the list or generate one from a breakdown.
        </p>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { color: string; icon: any; label: string }> = {
      draft: { color: 'bg-zinc-500/20 text-zinc-400', icon: FileText, label: 'Draft' },
      sent: { color: 'bg-blue-500/20 text-blue-400', icon: Send, label: 'Sent' },
      viewed: { color: 'bg-purple-500/20 text-purple-400', icon: Eye, label: 'Viewed' },
      paid: { color: 'bg-lime-500/20 text-lime-400', icon: CheckCircle2, label: 'Paid' },
      overdue: { color: 'bg-red-500/20 text-red-400', icon: AlertTriangle, label: 'Overdue' },
      cancelled: { color: 'bg-zinc-500/20 text-zinc-500', icon: X, label: 'Cancelled' },
      disputed: { color: 'bg-orange-500/20 text-orange-400', icon: AlertTriangle, label: 'Disputed' }
    };
    return configs[status] || configs.draft;
  };

  const statusConfig = getStatusConfig(invoice.status);
  const StatusIcon = statusConfig.icon;

  const handleSend = async () => {
    if (!onSend || !sendEmail) return;
    setProcessing(true);
    try {
      await onSend(sendEmail);
      setShowSendModal(false);
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!onMarkPaid || !paymentAmount || !paymentMethod) return;
    setProcessing(true);
    try {
      await onMarkPaid(parseFloat(paymentAmount), paymentMethod, paymentReference);
      setShowPaymentModal(false);
    } finally {
      setProcessing(false);
    }
  };

  const handlePrint = () => {
    window.open(`/api/invoices/${invoice.invoiceId}?format=html`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Invoice Header */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-white">{invoice.invoiceNumber}</h2>
              <span className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium',
                statusConfig.color
              )}>
                <StatusIcon size={14} />
                {statusConfig.label}
              </span>
            </div>
            <p className="text-zinc-400">
              Created {formatDate(invoice.createdAt)} by {invoice.createdByName}
            </p>
          </div>

          {/* Quick Stats */}
          <div className="flex flex-wrap gap-4">
            <div className="text-right">
              <p className="text-sm text-zinc-500">Total Amount</p>
              <p className="text-2xl font-bold text-lime-400">{formatCurrency(invoice.total)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-zinc-500">Due Date</p>
              <p className={cn(
                'text-lg font-medium',
                new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid'
                  ? 'text-red-400'
                  : 'text-white'
              )}>
                {formatDate(invoice.dueDate)}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-3 border-t border-zinc-800 pt-4">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            <Printer size={16} />
            Print / PDF
          </button>

          {onCopyLink && (
            <button
              onClick={onCopyLink}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
            >
              <Copy size={16} />
              Copy Link
            </button>
          )}

          {canEdit && invoice.status === 'draft' && (
            <button
              onClick={() => setShowSendModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-400"
            >
              <Send size={16} />
              Send Invoice
            </button>
          )}

          {canEdit && ['sent', 'viewed', 'overdue'].includes(invoice.status) && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-lime-400"
            >
              <DollarSign size={16} />
              Mark as Paid
            </button>
          )}
        </div>

        {/* Payment Info */}
        {invoice.status === 'paid' && invoice.paidDate && (
          <div className="mt-4 rounded-lg bg-lime-500/10 border border-lime-500/20 p-4">
            <div className="flex items-center gap-2 text-lime-400 mb-2">
              <CheckCircle2 size={18} />
              <span className="font-medium">Payment Received</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 text-sm">
              <div>
                <span className="text-zinc-500">Amount: </span>
                <span className="text-white">{formatCurrency(invoice.paidAmount || invoice.total)}</span>
              </div>
              <div>
                <span className="text-zinc-500">Date: </span>
                <span className="text-white">{formatDate(invoice.paidDate)}</span>
              </div>
              {invoice.paymentMethod && (
                <div>
                  <span className="text-zinc-500">Method: </span>
                  <span className="text-white">{invoice.paymentMethod}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sent Info */}
        {invoice.sentAt && invoice.status !== 'draft' && (
          <div className="mt-4 flex items-center gap-2 text-sm text-zinc-400">
            <Mail size={14} />
            <span>Sent to {invoice.sentTo} on {formatDate(invoice.sentAt)}</span>
          </div>
        )}
      </div>

      {/* Customer & Job Info */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <User size={16} />
            Bill To
          </h3>
          <div>
            <p className="text-lg font-medium text-white">{invoice.customerName}</p>
            <p className="text-zinc-400 mt-1">{invoice.billingAddress}</p>
            <p className="text-zinc-400">
              {invoice.billingCity}, {invoice.billingState} {invoice.billingZip}
            </p>
            {invoice.customerPhone && (
              <p className="text-zinc-400 mt-2">{invoice.customerPhone}</p>
            )}
            {invoice.customerEmail && (
              <p className="text-zinc-400">{invoice.customerEmail}</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Building2 size={16} />
            Job Details
          </h3>
          <div>
            <p className="text-lg font-medium text-white">{invoice.jobName}</p>
            <p className="text-zinc-400 mt-1">{invoice.jobAddress}</p>
            <p className="text-zinc-500 mt-2 text-sm">Job ID: {invoice.jobId}</p>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="border-b border-zinc-800 px-6 py-4">
          <h3 className="font-medium text-white">Line Items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-sm text-zinc-500">
                <th className="px-6 py-3 font-medium">Description</th>
                <th className="px-6 py-3 font-medium text-center">Quantity</th>
                <th className="px-6 py-3 font-medium text-right">Unit Price</th>
                <th className="px-6 py-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((item) => (
                <tr
                  key={item.lineId}
                  className="border-b border-zinc-800 last:border-0"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {item.type === 'discount' ? (
                        <span className="text-orange-400">{item.description}</span>
                      ) : (
                        <span className="text-white">{item.description}</span>
                      )}
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded',
                        item.type === 'material' && 'bg-blue-500/20 text-blue-400',
                        item.type === 'labor' && 'bg-purple-500/20 text-purple-400',
                        item.type === 'fee' && 'bg-zinc-500/20 text-zinc-400',
                        item.type === 'discount' && 'bg-orange-500/20 text-orange-400'
                      )}>
                        {item.type}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-zinc-400">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="px-6 py-4 text-right text-zinc-400">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className={cn(
                    'px-6 py-4 text-right font-medium',
                    item.type === 'discount' ? 'text-orange-400' : 'text-white'
                  )}>
                    {formatCurrency(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-zinc-800 bg-zinc-800/30 px-6 py-4">
          <div className="max-w-xs ml-auto space-y-2">
            <div className="flex justify-between text-zinc-400">
              <span>Subtotal</span>
              <span>{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.discountAmount > 0 && (
              <div className="flex justify-between text-orange-400">
                <span>Discount</span>
                <span>-{formatCurrency(invoice.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-zinc-400">
              <span>Tax ({invoice.taxRate}%)</span>
              <span>{formatCurrency(invoice.taxAmount)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold text-white border-t border-zinc-700 pt-2">
              <span>Total</span>
              <span className="text-lime-400">{formatCurrency(invoice.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Terms & Notes */}
      {(invoice.terms || invoice.notes.length > 0) && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          {invoice.terms && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-2">
                Payment Terms
              </h4>
              <p className="text-zinc-400 text-sm">{invoice.terms}</p>
            </div>
          )}
          {invoice.notes.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-2">
                Notes
              </h4>
              <ul className="space-y-1 text-sm text-zinc-400">
                {invoice.notes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Send Invoice Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Send Invoice</h3>
              <button
                onClick={() => setShowSendModal(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Recipient Email
                </label>
                <input
                  type="email"
                  value={sendEmail}
                  onChange={(e) => setSendEmail(e.target.value)}
                  placeholder="customer@email.com"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white placeholder-zinc-500 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowSendModal(false)}
                  className="flex-1 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={processing || !sendEmail}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-400 disabled:opacity-50"
                >
                  {processing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  Send Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mark as Paid Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Record Payment</h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Amount Received
                </label>
                <div className="relative">
                  <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 pl-9 pr-4 py-2 text-white placeholder-zinc-500 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
                >
                  <option value="">Select method...</option>
                  <option value="check">Check</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="financing">Financing</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Reference Number (Optional)
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Check #, Transaction ID, etc."
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white placeholder-zinc-500 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMarkPaid}
                  disabled={processing || !paymentAmount || !paymentMethod}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-lime-500 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-lime-400 disabled:opacity-50"
                >
                  {processing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  Record Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
