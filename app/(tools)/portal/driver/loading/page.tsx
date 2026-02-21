'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  Truck,
  CheckCircle,
  Circle,
  MapPin,
  Clock,
  Printer,
  RefreshCw,
  AlertTriangle,
  CheckSquare,
  Square,
  Loader2,
  ClipboardCheck,
} from 'lucide-react';

interface OrderItem {
  itemId: string;
  productId: string;
  productName: string;
  sku?: string;
  quantity: number;
  unit: string;
  category: string;
}

interface DeliveryOrder {
  orderId: string;
  status: string;
  jobName: string;
  customerAddress: string;
  city: string;
  state: string;
  zipCode: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  requestedDeliveryDate: string;
  requestedDeliveryTime?: string;
  scheduledDeliveryDate?: string;
  scheduledDeliveryTime?: string;
  priority: string;
  specialInstructions?: string;
  assignedDriverName?: string;
}

export default function DriverLoadingPage() {
  const [tickets, setTickets] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedItems, setLoadedItems] = useState<Set<string>>(new Set());
  const [verifiedTickets, setVerifiedTickets] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrintView, setIsPrintView] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const fetchTodaysTickets = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/portal/orders/workflow?date=${today}`);
      if (response.ok) {
        const data = await response.json();
        const allOrders: DeliveryOrder[] = Array.isArray(data.orders) ? data.orders : [];
        // Filter to orders that need loading or are ready for delivery
        const loadableOrders = allOrders.filter(
          (o: DeliveryOrder) =>
            ['submitted', 'approved', 'processing', 'loading', 'ready_for_delivery'].includes(o.status)
        );
        setTickets(loadableOrders);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    fetchTodaysTickets();
  }, [fetchTodaysTickets]);

  const toggleItem = (key: string) => {
    setLoadedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isTicketFullyLoaded = (ticket: DeliveryOrder) => {
    return ticket.items.every((_, idx) =>
      loadedItems.has(`${ticket.orderId}-${idx}`)
    );
  };

  const markLoadVerified = async (orderId: string) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/portal/orders/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_status',
          orderId,
          status: 'ready_for_delivery',
          updates: { loadedBy: 'driver' },
        }),
      });

      if (response.ok) {
        setVerifiedTickets(prev => new Set(prev).add(orderId));
        // Refresh to get updated status
        fetchTodaysTickets();
      }
    } catch (error) {
      console.error('Error verifying load:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalItems = tickets.reduce((sum, t) => sum + t.items.length, 0);
  const loadedCount = loadedItems.size;
  const allLoaded = totalItems > 0 && loadedCount === totalItems;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'rush':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default:
        return 'bg-zinc-700 text-zinc-300 border-zinc-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-lime-500 animate-spin" />
          <p className="text-zinc-400">Loading today&apos;s deliveries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-zinc-950 ${isPrintView ? 'print-view' : ''}`}>
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 sm:px-6 py-4 print:bg-white print:border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/portal/driver"
              className="text-zinc-400 hover:text-white print:hidden"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white print:text-black flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-lime-500 print:text-green-400" />
                Loading Checklist
              </h1>
              <p className="text-sm text-zinc-400 print:text-neutral-400">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={() => fetchTodaysTickets()}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 text-zinc-300 hover:text-white rounded-lg border border-zinc-700"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>
      </header>

      {/* Summary Bar */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 sm:px-6 py-3 print:bg-white/10 print:border-white/10">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-lime-500" />
            <span className="text-zinc-300 text-sm print:text-neutral-300">
              <strong className="text-white print:text-black">{tickets.length}</strong> deliveries
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-lime-500" />
            <span className="text-zinc-300 text-sm print:text-neutral-300">
              <strong className="text-white print:text-black">{totalItems}</strong> items total
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-lime-500" />
            <span className="text-zinc-300 text-sm print:text-neutral-300">
              <strong className="text-white print:text-black">{loadedCount}</strong> / {totalItems} loaded
            </span>
          </div>
          {allLoaded && (
            <span className="px-2 py-1 bg-lime-500/20 text-lime-400 text-xs font-bold rounded border border-lime-500/30">
              ALL LOADED
            </span>
          )}
        </div>
        {/* Progress bar */}
        <div className="mt-2 w-full bg-zinc-800 rounded-full h-2 print:bg-white/10">
          <div
            className="bg-lime-500 h-2 rounded-full transition-all duration-300 print:bg-green-600"
            style={{ width: `${totalItems > 0 ? (loadedCount / totalItems) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 py-6 space-y-6 max-w-4xl mx-auto">
        {tickets.length === 0 ? (
          <div className="text-center py-16">
            <Truck className="w-16 h-16 mx-auto mb-4 text-zinc-700" />
            <h2 className="text-xl font-semibold text-white mb-2">No Deliveries Today</h2>
            <p className="text-zinc-400">
              There are no delivery tickets scheduled for loading today.
            </p>
          </div>
        ) : (
          tickets.map(ticket => {
            const ticketLoaded = isTicketFullyLoaded(ticket);
            const isVerified = verifiedTickets.has(ticket.orderId) || ticket.status === 'ready_for_delivery';

            return (
              <div
                key={ticket.orderId}
                className={`bg-zinc-900 border rounded-xl overflow-hidden print:bg-white print:border-white/10 ${
                  isVerified
                    ? 'border-lime-500/40'
                    : 'border-zinc-800'
                }`}
              >
                {/* Ticket Header */}
                <div className="px-4 sm:px-6 py-4 border-b border-zinc-800 print:border-white/10">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm text-lime-500 print:text-green-400">
                          {ticket.orderId}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded border ${getPriorityColor(
                            ticket.priority
                          )}`}
                        >
                          {ticket.priority.toUpperCase()}
                        </span>
                        {isVerified && (
                          <span className="px-2 py-0.5 text-xs font-bold bg-lime-500/20 text-lime-400 rounded border border-lime-500/30 print:bg-green-100 print:text-green-400">
                            VERIFIED
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-white print:text-black">
                        {ticket.jobName}
                      </h3>
                      <div className="flex items-center gap-1 text-sm text-zinc-400 print:text-neutral-400 mt-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {ticket.customerAddress}, {ticket.city}, {ticket.state} {ticket.zipCode}
                      </div>
                      <div className="text-sm text-zinc-500 print:text-neutral-500 mt-1">
                        Customer: {ticket.customerName} | {ticket.customerPhone}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm text-zinc-400 print:text-neutral-400">
                        <Clock className="w-3.5 h-3.5" />
                        {ticket.scheduledDeliveryTime || ticket.requestedDeliveryTime || 'No time set'}
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">
                        {ticket.items.length} items
                      </div>
                    </div>
                  </div>
                  {ticket.specialInstructions && (
                    <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg print:bg-yellow-50 print:border-yellow-500/20">
                      <div className="flex items-center gap-1 text-xs text-amber-400 print:text-yellow-400 font-medium mb-1">
                        <AlertTriangle className="w-3 h-3" />
                        Special Instructions
                      </div>
                      <p className="text-sm text-amber-300 print:text-yellow-400">
                        {ticket.specialInstructions}
                      </p>
                    </div>
                  )}
                </div>

                {/* Materials Checklist */}
                <div className="divide-y divide-zinc-800 print:divide-gray-200">
                  {ticket.items.map((item, idx) => {
                    const key = `${ticket.orderId}-${idx}`;
                    const isLoaded = loadedItems.has(key);

                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-3 px-4 sm:px-6 py-3 cursor-pointer transition-colors print:cursor-default ${
                          isLoaded
                            ? 'bg-lime-500/5 print:bg-green-50'
                            : 'hover:bg-zinc-800/50'
                        }`}
                        onClick={() => toggleItem(key)}
                      >
                        <div className="print:hidden">
                          {isLoaded ? (
                            <CheckSquare className="w-5 h-5 text-lime-500" />
                          ) : (
                            <Square className="w-5 h-5 text-zinc-600" />
                          )}
                        </div>
                        <div className="print:block hidden">
                          {isLoaded ? (
                            <CheckSquare className="w-5 h-5 text-green-400" />
                          ) : (
                            <Square className="w-5 h-5 text-neutral-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className={`font-medium ${
                              isLoaded
                                ? 'text-lime-400 line-through print:text-green-400'
                                : 'text-white print:text-black'
                            }`}
                          >
                            {item.productName}
                          </div>
                          <div className="text-xs text-zinc-500 print:text-neutral-500">
                            {item.sku ? `SKU: ${item.sku}` : `ID: ${item.productId}`}
                            {item.category && ` | ${item.category}`}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div
                            className={`text-lg font-bold ${
                              isLoaded
                                ? 'text-lime-400 print:text-green-400'
                                : 'text-white print:text-black'
                            }`}
                          >
                            {item.quantity}
                          </div>
                          <div className="text-xs text-zinc-500 print:text-neutral-500">
                            {item.unit}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Verify Button */}
                <div className="px-4 sm:px-6 py-4 border-t border-zinc-800 print:border-white/10 print:hidden">
                  {isVerified ? (
                    <div className="flex items-center gap-2 text-lime-400">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Load Verified</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => markLoadVerified(ticket.orderId)}
                      disabled={!ticketLoaded || isSubmitting}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-colors ${
                        ticketLoaded
                          ? 'bg-lime-500 text-black hover:bg-lime-400'
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <CheckCircle className="w-5 h-5" />
                      )}
                      {ticketLoaded
                        ? 'Mark Load as Verified'
                        : `${
                            ticket.items.filter((_, i) =>
                              loadedItems.has(`${ticket.orderId}-${i}`)
                            ).length
                          } / ${ticket.items.length} items checked`}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .print-view {
            background: white !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          .print\\:bg-white {
            background: white !important;
          }
          .print\\:text-black {
            color: black !important;
          }
          .print\\:border-white/10 {
            border-color: #d1d5db !important;
          }
        }
      `}</style>
    </div>
  );
}
