'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, RotateCcw, Package, Truck, Building2, Camera,
  MapPin, Plus, Search, RefreshCw, Loader2, X, CheckCircle,
  ChevronRight, ChevronDown, Clock, FileText, DollarSign
} from 'lucide-react';

interface ReturnTicket {
  ticketId: string;
  type: string;
  status: string;
  orderId?: string;
  jobId?: string;
  jobName?: string;
  items: { productId: string; productName: string; quantity: number; unitCost: number; unitPrice: number; reason: string }[];
  distributor?: string;
  creditMemoNumber?: string;
  creditAmount?: number;
  createdAt: string;
  createdByName: string;
  pickupPhotos: string[];
  transitPhotos: string[];
  deliveryPhotos: string[];
  notes: string;
  completedAt?: string;
}

const STATUS_COLORS: Record<string, string> = {
  created: 'bg-blue-100 text-blue-800',
  picked_up: 'bg-yellow-100 text-yellow-800',
  in_transit: 'bg-cyan-100 text-cyan-800',
  received: 'bg-green-100 text-green-800',
  credited: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-gray-200 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

const DISTRIBUTORS = [
  'Advance Build Products Huntsville',
  'Beacon Huntsville',
  'Gold Eagle Huntsville',
  'Gold Eagle Decatur',
  "Lowe's",
  'Home Depot',
];

export default function ReturnTicketsPage() {
  const [tickets, setTickets] = useState<ReturnTicket[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ action: 'returnTickets' });
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);

      const [ticketsRes, productsRes] = await Promise.all([
        fetch(`/api/portal/inventory?${params}`),
        fetch('/api/portal/inventory?action=list'),
      ]);
      if (ticketsRes.ok) setTickets(await ticketsRes.json());
      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch return tickets:', error);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (ticketId: string, status: string) => {
    try {
      await fetch('/api/portal/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateReturnStatus', ticketId, status }),
      });
      fetchData();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString() : '—';
  const formatMoney = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/portal/delivery" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Return Tickets</h1>
            <p className="text-sm text-gray-500">Track material returns to warehouse or distributors</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="p-2 hover:bg-gray-100 rounded-lg"><RefreshCw className="w-5 h-5" /></button>
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New Return
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-sm text-gray-500">Total Returns</div>
          <div className="text-2xl font-bold">{tickets.length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-sm text-gray-500">To Warehouse</div>
          <div className="text-2xl font-bold text-blue-600">{tickets.filter(t => t.type === 'return_to_warehouse').length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-sm text-gray-500">To Distributor</div>
          <div className="text-2xl font-bold text-purple-600">{tickets.filter(t => t.type === 'return_to_distributor').length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-sm text-gray-500">Active</div>
          <div className="text-2xl font-bold text-orange-600">{tickets.filter(t => !['completed', 'cancelled'].includes(t.status)).length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">All Types</option>
          <option value="return_to_warehouse">Return to Warehouse</option>
          <option value="return_to_distributor">Return to Distributor</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">All Statuses</option>
          <option value="created">Created</option>
          <option value="picked_up">Picked Up</option>
          <option value="in_transit">In Transit</option>
          <option value="received">Received</option>
          <option value="credited">Credited</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Tickets List */}
      <div className="space-y-3">
        {tickets.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border">
            <RotateCcw className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No return tickets found</p>
          </div>
        ) : (
          tickets.map(ticket => (
            <div key={ticket.ticketId} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                onClick={() => setExpandedTicket(expandedTicket === ticket.ticketId ? null : ticket.ticketId)}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${ticket.type === 'return_to_warehouse' ? 'bg-blue-100' : 'bg-purple-100'}`}>
                    {ticket.type === 'return_to_warehouse' ? <Package className="w-5 h-5 text-blue-600" /> : <Building2 className="w-5 h-5 text-purple-600" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-gray-500">{ticket.ticketId}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status] || 'bg-gray-100'}`}>
                        {ticket.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="font-medium">{ticket.type === 'return_to_warehouse' ? 'Return to Warehouse' : `Return to ${ticket.distributor || 'Distributor'}`}</p>
                    <p className="text-sm text-gray-500">{ticket.jobName || 'No job'} · {ticket.items.length} items · {formatDate(ticket.createdAt)}</p>
                  </div>
                </div>
                {expandedTicket === ticket.ticketId ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
              </div>

              {expandedTicket === ticket.ticketId && (
                <div className="border-t px-4 pb-4 space-y-3">
                  <div className="pt-3">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Items</h4>
                    {ticket.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm py-1 border-b last:border-0">
                        <span>{item.productName} × {item.quantity}</span>
                        <span className="text-gray-500">{item.reason}</span>
                      </div>
                    ))}
                  </div>
                  {ticket.creditMemoNumber && (
                    <div className="text-sm">
                      <span className="text-gray-500">Credit Memo:</span> {ticket.creditMemoNumber}
                      {ticket.creditAmount && <span className="ml-2 font-medium text-green-600">{formatMoney(ticket.creditAmount)}</span>}
                    </div>
                  )}
                  {ticket.notes && <p className="text-sm text-gray-600">{ticket.notes}</p>}

                  {/* Status Actions */}
                  <div className="flex gap-2 pt-2">
                    {ticket.status === 'created' && (
                      <button onClick={() => updateStatus(ticket.ticketId, 'picked_up')} className="px-3 py-1.5 text-sm bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100">
                        Mark Picked Up
                      </button>
                    )}
                    {ticket.status === 'picked_up' && (
                      <button onClick={() => updateStatus(ticket.ticketId, 'in_transit')} className="px-3 py-1.5 text-sm bg-cyan-50 text-cyan-700 rounded-lg hover:bg-cyan-100">
                        Mark In Transit
                      </button>
                    )}
                    {ticket.status === 'in_transit' && (
                      <button onClick={() => updateStatus(ticket.ticketId, 'received')} className="px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100">
                        Mark Received
                      </button>
                    )}
                    {ticket.status === 'received' && (
                      <button onClick={() => updateStatus(ticket.ticketId, 'completed')} className="px-3 py-1.5 text-sm bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100">
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateReturnModal
          products={products}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); fetchData(); }}
        />
      )}
    </div>
  );
}

function CreateReturnModal({ products, onClose, onCreated }: {
  products: any[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [type, setType] = useState<string>('return_to_warehouse');
  const [jobName, setJobName] = useState('');
  const [distributor, setDistributor] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<{ productId: string; quantity: number; reason: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const addItem = () => setItems([...items, { productId: '', quantity: 1, reason: '' }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (items.length === 0) return;
    setSubmitting(true);
    try {
      const enrichedItems = items.map(item => {
        const product = products.find((p: any) => p.productId === item.productId);
        return {
          productId: item.productId,
          productName: product?.productName || 'Unknown',
          quantity: item.quantity,
          unitCost: product?.unitCost || 0,
          unitPrice: product?.unitPrice || 0,
          reason: item.reason,
        };
      });

      const res = await fetch('/api/portal/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createReturnTicket',
          type,
          jobName,
          distributor: type === 'return_to_distributor' ? distributor : undefined,
          items: enrichedItems,
          notes,
        }),
      });
      if (res.ok) onCreated();
    } catch (error) {
      console.error('Failed to create return ticket:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Create Return Ticket</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Return Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setType('return_to_warehouse')}
                className={`p-3 rounded-lg border text-sm text-center ${type === 'return_to_warehouse' ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <Package className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                Return to Warehouse
              </button>
              <button
                onClick={() => setType('return_to_distributor')}
                className={`p-3 rounded-lg border text-sm text-center ${type === 'return_to_distributor' ? 'border-purple-500 bg-purple-50' : 'hover:bg-gray-50'}`}
              >
                <Building2 className="w-5 h-5 mx-auto mb-1 text-purple-600" />
                Return to Distributor
              </button>
            </div>
          </div>

          {type === 'return_to_distributor' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Distributor</label>
              <select value={distributor} onChange={e => setDistributor(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                <option value="">Select distributor...</option>
                {DISTRIBUTORS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Name</label>
            <input type="text" value={jobName} onChange={e => setJobName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Items</label>
              <button onClick={addItem} className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100">
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <select
                  value={item.productId}
                  onChange={e => { const updated = [...items]; updated[idx].productId = e.target.value; setItems(updated); }}
                  className="flex-1 px-2 py-1.5 border rounded text-sm"
                >
                  <option value="">Select product...</option>
                  {products.map((p: any) => <option key={p.productId} value={p.productId}>{p.productName}</option>)}
                </select>
                <input type="number" min="1" value={item.quantity}
                  onChange={e => { const updated = [...items]; updated[idx].quantity = parseInt(e.target.value) || 1; setItems(updated); }}
                  className="w-16 px-2 py-1.5 border rounded text-sm" />
                <input type="text" placeholder="Reason" value={item.reason}
                  onChange={e => { const updated = [...items]; updated[idx].reason = e.target.value; setItems(updated); }}
                  className="w-32 px-2 py-1.5 border rounded text-sm" />
                <button onClick={() => removeItem(idx)} className="p-1 text-red-500"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-lg" />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting || items.length === 0}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Return
          </button>
        </div>
      </div>
    </div>
  );
}
