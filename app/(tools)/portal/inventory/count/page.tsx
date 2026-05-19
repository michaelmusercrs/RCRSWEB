'use client';

/**
 * /portal/inventory/count — three count modes (Phase 4).
 *
 * Full count   = legacy weekly all-SKU count (default tab)
 * Cycle count  = system picks 5–10 random items per week
 * Item count   = on-demand single SKU
 *
 * All three modes funnel through the same CountSession/Record flow on the
 * service side — the only differences are scope (totalItems + which items
 * show up in the "to count" list) and the countSessionType marker so the
 * History table can label them differently.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, ClipboardCheck, CheckCircle, AlertTriangle, RefreshCw,
  Loader2, X, Plus, History, Package, Shuffle, Search, Layers,
} from 'lucide-react';

type CountSessionType = 'full' | 'cycle' | 'item';

interface CountSession {
  sessionId: string;
  startedAt: string;
  startedByName: string;
  status: string;
  countSessionType?: CountSessionType;
  scopedProductIds?: string[];
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
  sku?: string;
}

const TABS: { key: CountSessionType; label: string; desc: string; Icon: typeof Layers }[] = [
  { key: 'full', label: 'Full count', desc: 'Weekly all-SKU count', Icon: Layers },
  { key: 'cycle', label: 'Cycle count', desc: '5–10 random items per week', Icon: Shuffle },
  { key: 'item', label: 'Item count', desc: 'Single SKU on demand', Icon: Search },
];

export default function InventoryCountPage() {
  const [activeTab, setActiveTab] = useState<CountSessionType>('full');
  const [activeSession, setActiveSession] = useState<CountSession | null>(null);
  const [sessions, setSessions] = useState<CountSession[]>([]);
  const [records, setRecords] = useState<CountRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [countingItem, setCountingItem] = useState<string | null>(null);
  const [countValue, setCountValue] = useState('');
  const [countNotes, setCountNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Cycle count config
  const [cycleTarget, setCycleTarget] = useState(7);

  // Item count selection
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');

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
          // Auto-pin the tab to whatever the active session's type is
          if (data.countSessionType) setActiveTab(data.countSessionType);
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
      const payload: Record<string, unknown> = {
        action: 'initiateCount',
        countSessionType: activeTab,
      };
      if (activeTab === 'cycle') payload.targetCount = cycleTarget;
      if (activeTab === 'item') {
        if (!selectedItemId) {
          setSubmitting(false);
          return;
        }
        payload.productId = selectedItemId;
      }

      const res = await fetch('/api/portal/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const session = await res.json();
        setActiveSession(session);
        setItemSearch('');
        setSelectedItemId('');
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
  const scopedIds = activeSession?.scopedProductIds;
  const inScope = (item: InventoryItem) =>
    !scopedIds || scopedIds.length === 0 || scopedIds.includes(item.productId);
  const uncountedItems = inventory.filter(i => !countedProductIds.has(i.productId) && inScope(i));
  const discrepancies = records.filter(r => r.discrepancy !== 0 && !r.resolved);

  const progress = activeSession ? Math.round((activeSession.countedItems / Math.max(1, activeSession.totalItems)) * 100) : 0;

  const searchMatches = useMemo(() => {
    if (!itemSearch) return inventory.slice(0, 25);
    const q = itemSearch.toLowerCase();
    return inventory.filter(i =>
      i.productName.toLowerCase().includes(q) ||
      i.productId.toLowerCase().includes(q) ||
      (i.sku || '').toLowerCase().includes(q),
    ).slice(0, 25);
  }, [itemSearch, inventory]);

  const sessionTypeBadge = (s: CountSession) => {
    const t = s.countSessionType || 'full';
    const meta = TABS.find(x => x.key === t)!;
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-700 font-medium">
        <meta.Icon className="w-3 h-3" />{meta.label}
      </span>
    );
  };

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
            <h1 className="text-2xl font-bold">Inventory Count</h1>
            <p className="text-sm text-gray-500">Verify physical inventory against system records</p>
          </div>
        </div>
        <button onClick={fetchData} className="p-2 hover:bg-gray-100 rounded-lg">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Mode tabs — disabled while a session is active so we don't fork modes */}
      <div className="bg-white rounded-xl border shadow-sm p-1 grid grid-cols-3 gap-1">
        {TABS.map(t => {
          const isActive = activeTab === t.key;
          const isDisabled = !!activeSession && activeSession.countSessionType !== t.key;
          return (
            <button
              key={t.key}
              disabled={isDisabled}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-600 text-white' : isDisabled ? 'opacity-40 text-gray-500 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'
              }`}
              title={t.desc}
            >
              <t.Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Cycle "Today's items" preview when on cycle tab + no active session */}
      {activeTab === 'cycle' && !activeSession && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-purple-600" />
            Today's cycle items
          </h3>
          <p className="text-sm text-purple-900 mt-1">
            Start a cycle count and the system will randomly pick{' '}
            <input
              type="number"
              min="1"
              max={Math.max(1, inventory.length)}
              value={cycleTarget}
              onChange={e => setCycleTarget(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 px-1 py-0.5 border rounded text-sm mx-1"
            />{' '}
            items for you to count.
          </p>
        </div>
      )}

      {/* Item-count selector when on item tab + no active session */}
      {activeTab === 'item' && !activeSession && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Search className="w-5 h-5 text-amber-600" />
            Pick an item to count
          </h3>
          <div className="relative mt-2">
            <Search className="w-4 h-4 absolute left-2 top-2.5 text-gray-400" />
            <input
              value={itemSearch}
              onChange={e => setItemSearch(e.target.value)}
              placeholder="Search by name or SKU…"
              className="w-full pl-8 pr-3 py-2 border rounded text-sm"
            />
          </div>
          <div className="mt-2 max-h-72 overflow-y-auto border bg-white rounded">
            {searchMatches.length === 0 ? (
              <p className="p-3 text-sm text-gray-500">No matches.</p>
            ) : (
              <ul className="divide-y">
                {searchMatches.map(item => (
                  <li key={item.productId}>
                    <button
                      onClick={() => setSelectedItemId(item.productId)}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                        selectedItemId === item.productId ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="text-sm font-medium">{item.productName}</div>
                      <div className="text-xs text-gray-500">
                        {item.sku ? `${item.sku} · ` : ''}On hand: {item.currentQty} {item.unit}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Active Session card */}
      {activeSession ? (
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-blue-600" />
                Active count: {activeSession.sessionId}
                {sessionTypeBadge(activeSession)}
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
          <h2 className="text-xl font-semibold mb-2">No active count session</h2>
          <p className="text-gray-500 mb-4">
            {activeTab === 'full' && 'Start a new full weekly count to verify every SKU.'}
            {activeTab === 'cycle' && `Start a cycle count and the system will pick ${cycleTarget} random items.`}
            {activeTab === 'item' && (selectedItemId ? 'Selected. Tap below to start.' : 'Pick an item above to start a single-SKU count.')}
          </p>
          <button
            onClick={startNewCount}
            disabled={submitting || (activeTab === 'item' && !selectedItemId)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 mx-auto"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            Start {activeTab} count
          </button>
        </div>
      )}

      {/* Discrepancies */}
      {discrepancies.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            Unresolved discrepancies ({discrepancies.length})
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
                    Adjust system
                  </button>
                  <button
                    onClick={() => resolveDiscrepancy(rec.recordId, 'no_action', rec.systemQty, 'miscount')}
                    className="px-2 py-1 text-xs bg-gray-50 text-gray-700 rounded hover:bg-gray-100"
                  >
                    Keep system
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uncounted Items (scoped to session) */}
      {activeSession && activeSession.status === 'in_progress' && uncountedItems.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Items to count ({uncountedItems.length})
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
            Count history
          </h3>
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                  <th className="px-4 py-3">Session</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">By</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Discrepancies</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sessions.slice(0, 15).map(session => (
                  <tr key={session.sessionId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{session.sessionId}</td>
                    <td className="px-4 py-3">{sessionTypeBadge(session)}</td>
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
