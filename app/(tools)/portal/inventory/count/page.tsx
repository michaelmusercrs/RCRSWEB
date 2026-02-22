'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, ClipboardCheck, Camera, CheckCircle, AlertTriangle,
  RefreshCw, Loader2, X, Plus, Hash, History, Package
} from 'lucide-react';

interface CountSession {
  sessionId: string;
  startedAt: string;
  startedByName: string;
  status: string;
  completedAt?: string;
  totalItems: number;
  countedItems: number;
  discrepancies: number;
  resolvedDiscrepancies: number;
}

interface CountRecord {
  recordId: string;
  productId: string;
  productName: string;
  systemQty: number;
  countedQty: number;
  discrepancy: number;
  countedByName: string;
  countedAt: string;
  resolved: boolean;
  resolution?: string;
  reason?: string;
}

interface InventoryItem {
  productId: string;
  productName: string;
  currentQty: number;
  unit: string;
  location: string;
  category: string;
}

export default function InventoryCountPage() {
  const [activeSession, setActiveSession] = useState<CountSession | null>(null);
  const [sessions, setSessions] = useState<CountSession[]>([]);
  const [records, setRecords] = useState<CountRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [countingItem, setCountingItem] = useState<string | null>(null);
  const [countValue, setCountValue] = useState('');
  const [countNotes, setCountNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [activeRes, sessionsRes, inventoryRes] = await Promise.all([
        fetch('/api/portal/inventory?action=activeCount'),
        fetch('/api/portal/inventory?action=countSessions'),
        fetch('/api/portal/inventory?action=list'),
      ]);

      if (activeRes.ok) {
        const data = await activeRes.json();
        setActiveSession(data);
        if (data?.sessionId) {
          const recordsRes = await fetch(`/api/portal/inventory?action=countRecords&sessionId=${data.sessionId}`);
          if (recordsRes.ok) setRecords(await recordsRes.json());
        }
      }
      if (sessionsRes.ok) setSessions(await sessionsRes.json());
      if (inventoryRes.ok) {
        const inv = await inventoryRes.json();
        setInventory(inv.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch count data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const startNewCount = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/portal/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initiateCount' }),
      });
      if (res.ok) {
        const session = await res.json();
        setActiveSession(session);
        fetchData();
      }
    } catch (error) {
      console.error('Failed to start count:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const submitCount = async (productId: string) => {
    if (!activeSession || !countValue) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/portal/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'recordCount',
          sessionId: activeSession.sessionId,
          productId,
          countedQty: parseInt(countValue),
          notes: countNotes,
        }),
      });
      if (res.ok) {
        setCountingItem(null);
        setCountValue('');
        setCountNotes('');
        fetchData();
      }
    } catch (error) {
      console.error('Failed to submit count:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const resolveDiscrepancy = async (recordId: string, resolution: string, adjustedQty: number, reason: string) => {
    try {
      await fetch('/api/portal/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolveDiscrepancy',
          recordId, resolution, adjustedQty, reason,
        }),
      });
      fetchData();
    } catch (error) {
      console.error('Failed to resolve:', error);
    }
  };

  const countedProductIds = new Set(records.map(r => r.productId));
  const uncountedItems = inventory.filter(i => !countedProductIds.has(i.productId));
  const discrepancies = records.filter(r => r.discrepancy !== 0 && !r.resolved);

  const progress = activeSession ? Math.round((activeSession.countedItems / Math.max(1, activeSession.totalItems)) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/portal/inventory" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Weekly Inventory Count</h1>
            <p className="text-sm text-gray-500">Verify physical inventory against system records</p>
          </div>
        </div>
        <button onClick={fetchData} className="p-2 hover:bg-gray-100 rounded-lg">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Active Session or Start New */}
      {activeSession ? (
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-blue-600" />
                Active Count: {activeSession.sessionId}
              </h2>
              <p className="text-sm text-gray-500">Started by {activeSession.startedByName} on {new Date(activeSession.startedAt).toLocaleString()}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              activeSession.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {activeSession.status}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>{activeSession.countedItems} of {activeSession.totalItems} items counted</span>
              <span>{progress}%</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-600">{activeSession.countedItems}</div>
              <div className="text-xs text-gray-600">Counted</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-amber-600">{activeSession.discrepancies}</div>
              <div className="text-xs text-gray-600">Discrepancies</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600">{activeSession.resolvedDiscrepancies}</div>
              <div className="text-xs text-gray-600">Resolved</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
          <ClipboardCheck className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Active Count Session</h2>
          <p className="text-gray-500 mb-4">Start a new weekly count to verify inventory levels.</p>
          <button
            onClick={startNewCount}
            disabled={submitting}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 mx-auto"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            Start Weekly Count
          </button>
        </div>
      )}

      {/* Discrepancies */}
      {discrepancies.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            Unresolved Discrepancies ({discrepancies.length})
          </h3>
          <div className="space-y-2">
            {discrepancies.map(rec => (
              <div key={rec.recordId} className="bg-white rounded-lg p-3 flex items-center justify-between">
                <div>
                  <span className="font-medium">{rec.productName}</span>
                  <span className="text-sm text-gray-500 ml-2">
                    System: {rec.systemQty} → Counted: {rec.countedQty}
                    <span className={rec.discrepancy > 0 ? 'text-green-600 ml-1' : 'text-red-600 ml-1'}>
                      ({rec.discrepancy > 0 ? '+' : ''}{rec.discrepancy})
                    </span>
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => resolveDiscrepancy(rec.recordId, 'adjust_system', rec.countedQty, 'miscount')}
                    className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                  >
                    Adjust System
                  </button>
                  <button
                    onClick={() => resolveDiscrepancy(rec.recordId, 'no_action', rec.systemQty, 'miscount')}
                    className="px-2 py-1 text-xs bg-gray-50 text-gray-700 rounded hover:bg-gray-100"
                  >
                    Keep System
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uncounted Items */}
      {activeSession && activeSession.status === 'in_progress' && uncountedItems.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Items to Count ({uncountedItems.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {uncountedItems.map(item => (
              <div key={item.productId} className="bg-white rounded-lg shadow-sm border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-xs text-gray-500">{item.location} · {item.unit} · System: {item.currentQty}</p>
                  </div>
                  {countingItem === item.productId ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={countValue}
                        onChange={e => setCountValue(e.target.value)}
                        placeholder="Qty"
                        className="w-20 px-2 py-1 border rounded text-sm"
                        autoFocus
                      />
                      <button
                        onClick={() => submitCount(item.productId)}
                        disabled={submitting || !countValue}
                        className="p-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setCountingItem(null); setCountValue(''); }} className="p-1 hover:bg-gray-100 rounded">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setCountingItem(item.productId)}
                      className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                    >
                      Count
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {sessions.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <History className="w-5 h-5" />
            Count History
          </h3>
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                  <th className="px-4 py-3">Session</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">By</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Discrepancies</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sessions.slice(0, 10).map(session => (
                  <tr key={session.sessionId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono">{session.sessionId}</td>
                    <td className="px-4 py-3">{new Date(session.startedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{session.startedByName}</td>
                    <td className="px-4 py-3">{session.countedItems}/{session.totalItems}</td>
                    <td className="px-4 py-3">
                      {session.discrepancies > 0 ? (
                        <span className="text-amber-600">{session.discrepancies} unresolved</span>
                      ) : (
                        <span className="text-green-600">All clear</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        session.status === 'completed' ? 'bg-green-100 text-green-800' :
                        session.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {session.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
