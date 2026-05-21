'use client';

/**
 * Admin Insurance Claim Coordination
 *
 * Owner / admin / office / manager view of every customer's insurance
 * claim. The single highest-friction admin task this page replaces:
 * the weekly "what's the status of the Smith claim?" phone call.
 *
 * Auth: parent /admin layout gates the page behind login. The API route
 * does its own requireRoleAtLeast() check as defense-in-depth.
 *
 * Data: /api/admin/insurance-claims (GET list + counts, PATCH advance).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldAlert,
  RefreshCw,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  ChevronRight,
} from 'lucide-react';

type InsuranceClaimStatus =
  | 'damage_reported'
  | 'claim_filed'
  | 'awaiting_adjuster'
  | 'adjuster_visited'
  | 'claim_approved'
  | 'supplement_submitted'
  | 'supplement_approved'
  | 'final_settlement'
  | 'depreciation_released'
  | 'complete'
  | 'denied';

const ALL_STATUSES: InsuranceClaimStatus[] = [
  'damage_reported',
  'claim_filed',
  'awaiting_adjuster',
  'adjuster_visited',
  'claim_approved',
  'supplement_submitted',
  'supplement_approved',
  'final_settlement',
  'depreciation_released',
  'complete',
  'denied',
];

const STATUS_LABEL: Record<InsuranceClaimStatus, string> = {
  damage_reported: 'Damage Reported',
  claim_filed: 'Claim Filed',
  awaiting_adjuster: 'Awaiting Adjuster',
  adjuster_visited: 'Adjuster Visited',
  claim_approved: 'Claim Approved',
  supplement_submitted: 'Supplement Submitted',
  supplement_approved: 'Supplement Approved',
  final_settlement: 'Final Settlement',
  depreciation_released: 'Depreciation Released',
  complete: 'Complete',
  denied: 'Denied',
};

interface ClaimRow {
  claimId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  jobId: string;
  repSlug: string;
  repName: string;
  insuranceCarrier: string;
  claimNumber: string;
  adjusterName: string;
  adjusterPhone: string;
  adjusterEmail: string;
  dateOfLoss: string;
  dateClaimFiled: string;
  dateAdjusterVisit: string;
  dateAdjusterAccepted: string;
  dateSupplementSubmitted: string;
  dateSupplementApproved: string;
  dateFinalApproved: string;
  dateDepreciationReleased: string;
  initialEstimate: string;
  supplementAmount: string;
  finalSettlement: string;
  depreciationAmount: string;
  deductible: string;
  status: InsuranceClaimStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

type SortKey = 'status' | 'carrier' | 'age';

function statusBadgeClasses(status: InsuranceClaimStatus): string {
  switch (status) {
    case 'complete':
      return 'bg-green-500/20 text-green-400 border border-green-500/30';
    case 'denied':
      return 'bg-red-500/20 text-red-400 border border-red-500/30';
    case 'final_settlement':
    case 'depreciation_released':
    case 'claim_approved':
    case 'supplement_approved':
      return 'bg-green-500/10 text-green-300 border border-green-500/20';
    case 'awaiting_adjuster':
    case 'supplement_submitted':
      return 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30';
    default:
      return 'bg-white/5 text-neutral-300 border border-white/10';
  }
}

function daysSince(iso: string): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000)));
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

function fmtMoney(s: string): string {
  if (!s) return '—';
  const n = Number(String(s).replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(n)) return s;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default function AdminInsuranceClaimsPage() {
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters + sort
  const [statusFilter, setStatusFilter] = useState<'' | InsuranceClaimStatus>('');
  const [carrierFilter, setCarrierFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('age');

  // Update modal state
  const [modalClaim, setModalClaim] = useState<ClaimRow | null>(null);
  const [modalStatus, setModalStatus] = useState<InsuranceClaimStatus>('damage_reported');
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalFields, setModalFields] = useState<Partial<ClaimRow>>({});

  const fetchClaims = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch('/api/admin/insurance-claims', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setClaims(data.claims || []);
      setCounts(data.counts || {});
      setConfigured(!!data.configured);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insurance claims');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchClaims(false);
  }, [fetchClaims]);

  const carriers = useMemo(() => {
    const set = new Set<string>();
    claims.forEach(c => { if (c.insuranceCarrier) set.add(c.insuranceCarrier); });
    return Array.from(set).sort();
  }, [claims]);

  const filtered = useMemo(() => {
    let list = claims.slice();
    if (statusFilter) list = list.filter(c => c.status === statusFilter);
    if (carrierFilter) list = list.filter(c => c.insuranceCarrier === carrierFilter);
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter(c =>
        c.customerName.toLowerCase().includes(q) ||
        c.claimNumber.toLowerCase().includes(q) ||
        c.adjusterName.toLowerCase().includes(q) ||
        c.repName.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      if (sortKey === 'status') {
        return ALL_STATUSES.indexOf(a.status) - ALL_STATUSES.indexOf(b.status);
      }
      if (sortKey === 'carrier') {
        return (a.insuranceCarrier || '').localeCompare(b.insuranceCarrier || '');
      }
      // age = oldest first (most stale claims surface up)
      return daysSince(b.updatedAt) - daysSince(a.updatedAt);
    });
    return list;
  }, [claims, statusFilter, carrierFilter, searchText, sortKey]);

  const openModal = (claim: ClaimRow) => {
    setModalClaim(claim);
    setModalStatus(claim.status);
    setModalFields({});
    setModalError(null);
  };

  const closeModal = () => {
    setModalClaim(null);
    setModalFields({});
    setModalError(null);
  };

  const saveModal = async () => {
    if (!modalClaim) return;
    setModalSaving(true);
    setModalError(null);
    try {
      const res = await fetch('/api/admin/insurance-claims', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimId: modalClaim.claimId,
          status: modalStatus,
          updates: modalFields,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      closeModal();
      fetchClaims(true);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setModalSaving(false);
    }
  };

  const chaseCount = (counts['awaiting_adjuster'] || 0) + (counts['damage_reported'] || 0);
  const inProgressCount =
    (counts['claim_filed'] || 0) +
    (counts['adjuster_visited'] || 0) +
    (counts['claim_approved'] || 0) +
    (counts['supplement_submitted'] || 0) +
    (counts['supplement_approved'] || 0) +
    (counts['final_settlement'] || 0);
  const completeCount = counts['complete'] || 0;
  const deniedCount = counts['denied'] || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ShieldAlert className="w-8 h-8" />
            Insurance Claims
          </h1>
          <p className="text-neutral-400 mt-1">
            Coordinate every customer&apos;s claim — damage report through depreciation release.
          </p>
        </div>
        <button
          onClick={() => fetchClaims(false)}
          disabled={loading || refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-neutral-300 rounded-lg transition-colors text-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing || loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {!configured && !loading && (
        <div className="bg-yellow-500/10 border-l-4 border-yellow-500/40 p-4 rounded-r-lg">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-yellow-400 mr-3" />
            <div>
              <p className="text-sm font-medium text-yellow-400">
                Google Sheets credentials not configured
              </p>
              <p className="text-sm text-yellow-400">
                Set GOOGLE_SHEETS_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and
                GOOGLE_PRIVATE_KEY to read the Insurance_Claims tab.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border-l-4 border-red-500/40 p-4 rounded-r-lg">
          <div className="flex items-center">
            <XCircle className="w-5 h-5 text-red-400 mr-3" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Summary counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setStatusFilter('awaiting_adjuster')}
          className="bg-neutral-900 rounded-xl border border-yellow-500/30 p-4 flex items-center gap-3 hover:border-yellow-500/60 text-left transition-colors"
        >
          <div className="p-2 rounded-lg bg-yellow-500/20">
            <Clock className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <p className="text-xs text-neutral-500">Need to chase</p>
            <p className="text-xl font-bold text-yellow-400">{chaseCount}</p>
          </div>
        </button>
        <div className="bg-neutral-900 rounded-xl border border-white/10 p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/20">
            <Filter className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-neutral-500">In progress</p>
            <p className="text-xl font-bold text-blue-300">{inProgressCount}</p>
          </div>
        </div>
        <div className="bg-neutral-900 rounded-xl border border-white/10 p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/20">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="text-xs text-neutral-500">Complete</p>
            <p className="text-xl font-bold text-green-400">{completeCount}</p>
          </div>
        </div>
        <div className="bg-neutral-900 rounded-xl border border-white/10 p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/20">
            <XCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-xs text-neutral-500">Denied</p>
            <p className="text-xl font-bold text-red-400">{deniedCount}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-neutral-900 rounded-xl border border-white/10 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as '' | InsuranceClaimStatus)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
            >
              <option value="">All statuses</option>
              {ALL_STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_LABEL[s]} ({counts[s] || 0})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Carrier</label>
            <select
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
            >
              <option value="">All carriers</option>
              {carriers.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-neutral-500 pointer-events-none" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="customer, claim #, adjuster, rep..."
                className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-neutral-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Sort</label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
            >
              <option value="age">Stalest first</option>
              <option value="status">By status</option>
              <option value="carrier">By carrier</option>
            </select>
          </div>
        </div>
        <div className="mt-3 text-xs text-neutral-500">
          Showing {filtered.length} of {claims.length} claim{claims.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Table */}
      <div className="bg-neutral-900 rounded-xl border border-white/10 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-6 h-6 animate-spin text-neutral-500 mx-auto mb-2" />
            <p className="text-neutral-500 text-sm">Loading claims...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldAlert className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <p className="text-neutral-500">No claims match these filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase text-neutral-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Customer</th>
                  <th className="px-3 py-2 text-left font-medium">Carrier / Claim #</th>
                  <th className="px-3 py-2 text-left font-medium">Adjuster</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Settlement</th>
                  <th className="px-3 py-2 text-right font-medium">Age</th>
                  <th className="px-3 py-2 text-right font-medium">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(c => (
                  <tr key={c.claimId} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2 align-top">
                      <div className="text-white font-medium">{c.customerName || '—'}</div>
                      <div className="text-xs text-neutral-500">{c.repName || ''}</div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="text-neutral-200">{c.insuranceCarrier || '—'}</div>
                      <div className="text-xs text-neutral-500 font-mono">{c.claimNumber || ''}</div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="text-neutral-200">{c.adjusterName || '—'}</div>
                      <div className="text-xs text-neutral-500">{c.adjusterPhone || ''}</div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${statusBadgeClasses(c.status)}`}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top text-right text-neutral-200">
                      {fmtMoney(c.finalSettlement || c.initialEstimate)}
                    </td>
                    <td className="px-3 py-2 align-top text-right text-neutral-400">
                      {daysSince(c.updatedAt)}d
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      <button
                        onClick={() => openModal(c)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-green/20 hover:bg-brand-green/30 text-brand-green rounded-md text-xs font-medium"
                      >
                        Update <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Update modal */}
      {modalClaim && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-neutral-900 border border-white/10 rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Update Claim</h2>
                <p className="text-sm text-neutral-400 mt-1">
                  {modalClaim.customerName} — {modalClaim.insuranceCarrier} #{modalClaim.claimNumber || modalClaim.claimId}
                </p>
              </div>
              <button onClick={closeModal} className="text-neutral-500 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Status</label>
                <select
                  value={modalStatus}
                  onChange={(e) => setModalStatus(e.target.value as InsuranceClaimStatus)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
                >
                  {ALL_STATUSES.map(s => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Adjuster name</label>
                  <input
                    type="text"
                    defaultValue={modalClaim.adjusterName}
                    onChange={(e) => setModalFields(f => ({ ...f, adjusterName: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Adjuster phone</label>
                  <input
                    type="text"
                    defaultValue={modalClaim.adjusterPhone}
                    onChange={(e) => setModalFields(f => ({ ...f, adjusterPhone: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Date adjuster visit</label>
                  <input
                    type="date"
                    defaultValue={modalClaim.dateAdjusterVisit}
                    onChange={(e) => setModalFields(f => ({ ...f, dateAdjusterVisit: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Date adjuster accepted</label>
                  <input
                    type="date"
                    defaultValue={modalClaim.dateAdjusterAccepted}
                    onChange={(e) => setModalFields(f => ({ ...f, dateAdjusterAccepted: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Initial estimate (price)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    defaultValue={modalClaim.initialEstimate}
                    onChange={(e) => setModalFields(f => ({ ...f, initialEstimate: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Supplement amount (price)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    defaultValue={modalClaim.supplementAmount}
                    onChange={(e) => setModalFields(f => ({ ...f, supplementAmount: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Final settlement (price)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    defaultValue={modalClaim.finalSettlement}
                    onChange={(e) => setModalFields(f => ({ ...f, finalSettlement: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Depreciation amount (price)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    defaultValue={modalClaim.depreciationAmount}
                    onChange={(e) => setModalFields(f => ({ ...f, depreciationAmount: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1">Notes (internal)</label>
                <textarea
                  defaultValue={modalClaim.notes}
                  onChange={(e) => setModalFields(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
                />
              </div>

              <div className="text-xs text-neutral-500">
                Last loss: <span className="text-neutral-300">{fmtDate(modalClaim.dateOfLoss)}</span>
                {' · '}Created: <span className="text-neutral-300">{fmtDate(modalClaim.createdAt)}</span>
                {' · '}Updated: <span className="text-neutral-300">{fmtDate(modalClaim.updatedAt)}</span>
              </div>

              {modalError && (
                <div className="text-sm text-red-400">{modalError}</div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-neutral-300 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={saveModal}
                  disabled={modalSaving}
                  className="px-4 py-2 bg-brand-green text-black hover:bg-brand-green/90 disabled:opacity-50 rounded-lg text-sm font-medium"
                >
                  {modalSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
