'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  Plus,
  Minus,
  X,
  Calendar,
  Clock,
  Truck,
  Camera,
  FileText
} from 'lucide-react';

// Pipeline order item — matches PipelineOrderItem from material-order-pipeline.ts.
// Use deliveredQty (falls back to quantity) as the maximum returnable amount.
interface OrderItem {
  itemId: string;
  productId: string;
  productName: string;
  sku?: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  pulledQty?: number;
  verifiedQty?: number;
  deliveredQty?: number;
  returnedQty?: number;
}

interface ReturnItem {
  productId: string;
  productName: string;
  originalQty: number;          // max returnable (deliveredQty || quantity)
  returnQty: number;
  unit: string;
  unitPrice: number;
  condition: 'new' | 'used' | 'damaged';
  reason: string;
}

type ReturnType = 'return_to_us' | 'return_to_distributor';

export default function CreateReturnPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [notes, setNotes] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  // Return type drives whether a credit memo or distributor return ticket is created
  const [returnType, setReturnType] = useState<ReturnType>('return_to_us');
  const [distributor, setDistributor] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  async function fetchOrder() {
    try {
      const response = await fetch(`/api/portal/pipeline?action=order&orderId=${orderId}`);
      if (response.ok) {
        const data = await response.json();
        setOrder(data);
      }
    } catch (error) {
      console.error('Error fetching order:', error);
    } finally {
      setLoading(false);
    }
  }

  const addItemToReturn = (item: OrderItem) => {
    const existing = returnItems.find(r => r.productId === item.productId);
    if (existing) return;

    // Max returnable = whatever was actually delivered, minus prior returns.
    // Falls back to ordered quantity if delivery hasn't been confirmed yet.
    const maxReturnable = Math.max(
      0,
      (item.deliveredQty ?? item.quantity) - (item.returnedQty ?? 0)
    );
    if (maxReturnable === 0) return;

    setReturnItems([...returnItems, {
      productId: item.productId,
      productName: item.productName,
      originalQty: maxReturnable,
      returnQty: 1,
      unit: item.unit,
      unitPrice: item.unitPrice,
      condition: 'new',
      reason: '',
    }]);
  };

  const updateReturnItem = (productId: string, field: keyof ReturnItem, value: any) => {
    setReturnItems(returnItems.map(item =>
      item.productId === productId ? { ...item, [field]: value } : item
    ));
  };

  const updateReturnQty = (productId: string, delta: number) => {
    setReturnItems(returnItems.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, Math.min(item.originalQty, item.returnQty + delta));
        return { ...item, returnQty: newQty };
      }
      return item;
    }));
  };

  const removeReturnItem = (productId: string) => {
    setReturnItems(returnItems.filter(item => item.productId !== productId));
  };

  const calculateCreditAmount = () => {
    return returnItems.reduce((sum, item) => {
      // Only new condition items get full credit
      const creditRate = item.condition === 'new' ? 1 :
                        item.condition === 'used' ? 0.5 : 0;
      return sum + (item.returnQty * item.unitPrice * creditRate);
    }, 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const submitReturn = async () => {
    setSubmitError(null);

    if (returnItems.length === 0) {
      setSubmitError('Add at least one item to return');
      return;
    }

    // Validate reasons
    const missingReasons = returnItems.filter(item => !item.reason.trim());
    if (missingReasons.length > 0) {
      setSubmitError('Provide a reason for every return item');
      return;
    }

    if (returnType === 'return_to_distributor' && !distributor.trim()) {
      setSubmitError('Distributor name is required for distributor returns');
      return;
    }

    // Combine all per-item reasons + condition into one top-level reason
    // (the pipeline action takes a single reason field for the whole ticket)
    const summaryReason = returnItems
      .map(i => `${i.productName} (${i.condition}): ${i.reason}`)
      .join('; ');

    setSubmitting(true);
    try {
      const response = await fetch('/api/portal/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createReturnTicket',
          orderId,
          type: returnType,
          reason: summaryReason,
          distributor: returnType === 'return_to_distributor' ? distributor : undefined,
          items: returnItems.map(item => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.returnQty,
            reason: `${item.condition}: ${item.reason}`,
          })),
          notes: [
            notes,
            scheduledDate && `Scheduled pickup: ${scheduledDate}${scheduledTime ? ' ' + scheduledTime : ''}`,
          ].filter(Boolean).join('\n'),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to create return ticket');
      }

      const ticketId = data?.ticket?.ticketId;
      router.push(`/portal/orders/${orderId}${ticketId ? `?returnCreated=${ticketId}` : ''}`);
    } catch (error) {
      console.error('Error creating return:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to create return. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
          <h2 className="text-xl font-semibold text-neutral-900 mb-2">Order Not Found</h2>
          <Link href="/portal/orders" className="text-green-400 hover:text-green-400">
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  const availableItems = order.items?.filter((item: OrderItem) =>
    !returnItems.find(r => r.productId === item.productId)
  ) || [];

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/portal/orders/${orderId}`} className="text-neutral-500 hover:text-neutral-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-neutral-900">Create Return</h1>
              <p className="text-sm text-neutral-500">Order {orderId} - {order.jobName}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Info Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div className="text-amber-800">
              <p className="font-medium">Return Policy</p>
              <p className="text-sm mt-1">
                Items in new/unused condition receive full credit. Used items receive 50% credit.
                Damaged items are not eligible for credit but will be picked up and disposed of properly.
              </p>
            </div>
          </div>
        </div>

        {/* Return Type */}
        <div className="bg-neutral-900 rounded-xl border border-neutral-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Return Destination</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <button
              onClick={() => setReturnType('return_to_us')}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                returnType === 'return_to_us'
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-neutral-300 hover:border-neutral-400'
              }`}
            >
              <div className="font-medium text-neutral-900">Return to Warehouse</div>
              <div className="text-xs text-neutral-500 mt-1">
                Materials come back to RCRS stock. A credit memo is auto-generated.
              </div>
            </button>
            <button
              onClick={() => setReturnType('return_to_distributor')}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                returnType === 'return_to_distributor'
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-neutral-300 hover:border-neutral-400'
              }`}
            >
              <div className="font-medium text-neutral-900">Return to Distributor</div>
              <div className="text-xs text-neutral-500 mt-1">
                Driver delivers back to ABC, Beacon, Gold Eagle, Lowe's, etc.
              </div>
            </button>
          </div>
          {returnType === 'return_to_distributor' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Distributor *
              </label>
              <input
                type="text"
                value={distributor}
                onChange={(e) => setDistributor(e.target.value)}
                placeholder="e.g., Advance Build Products Huntsville"
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
            </div>
          )}
        </div>

        {/* Select Items */}
        <div className="bg-neutral-900 rounded-xl border border-neutral-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-green-400" />
            Select Items to Return
          </h2>

          {availableItems.length > 0 ? (
            <div className="space-y-2 mb-4">
              {availableItems.map((item: OrderItem) => (
                <button
                  key={item.productId}
                  onClick={() => addItemToReturn(item)}
                  className="w-full text-left p-3 bg-neutral-50 rounded-lg hover:bg-green-50 border border-transparent hover:border-green-500/20 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-neutral-900">{item.productName}</div>
                      <div className="text-sm text-neutral-500">
                        Qty: {item.quantity} | {formatCurrency(item.unitPrice)}/{item.unit}
                      </div>
                    </div>
                    <Plus className="w-5 h-5 text-green-400" />
                  </div>
                </button>
              ))}
            </div>
          ) : returnItems.length === 0 ? (
            <p className="text-neutral-500 text-center py-4">No items available for return</p>
          ) : null}
        </div>

        {/* Return Items */}
        {returnItems.length > 0 && (
          <div className="bg-neutral-900 rounded-xl border border-neutral-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-orange-600" />
              Items to Return ({returnItems.length})
            </h2>

            <div className="space-y-4">
              {returnItems.map(item => (
                <div key={item.productId} className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-medium text-neutral-900">{item.productName}</div>
                      <div className="text-sm text-neutral-500">
                        Original: {item.originalQty} {item.unit} | {formatCurrency(item.unitPrice)} each
                      </div>
                    </div>
                    <button
                      onClick={() => removeReturnItem(item.productId)}
                      className="text-red-500 hover:text-red-400"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    {/* Quantity */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Return Qty
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateReturnQty(item.productId, -1)}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-neutral-300 hover:bg-neutral-100"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-12 text-center font-medium">{item.returnQty}</span>
                        <button
                          onClick={() => updateReturnQty(item.productId, 1)}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-neutral-300 hover:bg-neutral-100"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Condition */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Condition
                      </label>
                      <select
                        value={item.condition}
                        onChange={(e) => updateReturnItem(item.productId, 'condition', e.target.value)}
                        className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                      >
                        <option value="new">New/Unused (100% credit)</option>
                        <option value="used">Used (50% credit)</option>
                        <option value="damaged">Damaged (no credit)</option>
                      </select>
                    </div>

                    {/* Credit */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Credit Amount
                      </label>
                      <div className={`text-lg font-bold ${
                        item.condition === 'new' ? 'text-green-400' :
                        item.condition === 'used' ? 'text-yellow-400' : 'text-neutral-400'
                      }`}>
                        {formatCurrency(
                          item.returnQty * item.unitPrice * (
                            item.condition === 'new' ? 1 :
                            item.condition === 'used' ? 0.5 : 0
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Reason for Return *
                    </label>
                    <input
                      type="text"
                      value={item.reason}
                      onChange={(e) => updateReturnItem(item.productId, 'reason', e.target.value)}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., Over-ordered, wrong item, etc."
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Total Credit */}
            <div className="mt-4 pt-4 border-t border-neutral-200 flex justify-between items-center">
              <span className="font-semibold text-neutral-900">Estimated Credit</span>
              <span className="text-xl font-bold text-green-400">{formatCurrency(calculateCreditAmount())}</span>
            </div>
          </div>
        )}

        {/* Pickup Scheduling */}
        <div className="bg-neutral-900 rounded-xl border border-neutral-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5 text-green-400" />
            Schedule Pickup
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Preferred Pickup Date
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Preferred Time
              </label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Additional Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
              rows={3}
              placeholder="Any special instructions for pickup..."
            />
          </div>
        </div>

        {/* Submit Error */}
        {submitError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <strong>Cannot submit:</strong> {submitError}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-between">
          <Link
            href={`/portal/orders/${orderId}`}
            className="px-6 py-3 border border-neutral-300 rounded-lg hover:bg-neutral-50 font-medium"
          >
            Cancel
          </Link>
          <button
            onClick={submitReturn}
            disabled={submitting || returnItems.length === 0}
            className="px-8 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-medium flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Processing...
              </>
            ) : (
              <>
                <RotateCcw className="w-5 h-5" />
                Submit Return Request
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
