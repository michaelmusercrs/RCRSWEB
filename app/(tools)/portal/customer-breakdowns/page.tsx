'use client';

/**
 * Customer Breakdown Portal
 *
 * Replaces the generic estimating form with a proper job costing tracker
 * matching the historical Excel breakdown format. Enter an R-number,
 * auto-populate from JobNimbus, then fill in suppliers + subs from
 * dropdowns with live commission calculation.
 *
 * Permissions (read from server):
 *   canCreate: Michael, Chris, Sara, Destin, Tia (owners, admins, managers, office)
 *   canViewAdminTier: Michael, Chris, Sara (owners, admins only) — sees Pres/VP
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Hammer, Search, Plus, Trash2, RefreshCw, Download, AlertCircle,
  CheckCircle, FileText, Users, Package, DollarSign, Clock, ExternalLink,
  Shield, Calculator, Save, X, ChevronRight, Eye, EyeOff, Loader2,
} from 'lucide-react';

// ─── Types (mirror server) ─────────────────────────────────────────────

interface MaterialLineItem {
  supplier: string;
  description?: string;
  amount: number;
  isCredit?: boolean;
  receiptRef?: string;
  /** 'stock' (default) = our warehouse catalog, 'other_vendor' = outside supplier */
  orderSource?: 'stock' | 'other_vendor';
}

interface LaborLineItem {
  subcontractor: string;
  amount: number;
  checkDate?: string;
  checkNumber?: string;
  isWorkersComp?: boolean;
}

interface PaymentLineItem {
  kind: 'deposit' | 'final' | 'progress';
  amount: number;
  date?: string;
  checkNumber?: string;
  method?: 'check' | 'cash' | 'card' | 'ach' | 'other';
}

interface CustomerBreakdown {
  breakdownId?: string;
  rNumber: string;
  jnJobNumber?: string;
  jnJobId?: string;
  customerName: string;
  address: string;
  salesRep: string;
  inspector?: string;
  dateInstalled?: string;
  jobTotal: number;
  permit: number;
  otherCosts: Array<{ label: string; amount: number }>;
  materials: MaterialLineItem[];
  labor: LaborLineItem[];
  paymentsIn: PaymentLineItem[];
  commissionsPaid: {
    onDeposit?: { amount: number; date?: string; checkNumber?: string };
    finalPayout?: { amount: number; date?: string; checkNumber?: string };
    revisions: Array<{ amount: number; reason: string; date: string; enteredBy: string }>;
  };
  notes?: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'in_progress' | 'completed' | 'voided';
  insurance?: {
    isInsuranceClaim: boolean;
    carrierName?: string;
    claimNumber?: string;
    deductible?: number;
    acv?: number;
    rcv?: number;
    depreciation?: number;
    supplements?: Array<{
      description: string;
      amount: number;
      status: 'pending' | 'approved' | 'paid' | 'denied';
      submittedAt?: string;
    }>;
  };
}

interface CalculatedTotals {
  jobTotal: number;
  materialSubtotal: number;
  laborSubtotal: number;
  workersCompAdded: number;
  laborTotal: number;
  permit: number;
  otherCostsTotal: number;
  overheadOnFirst50k: number;
  overheadOver50k: number;
  overheadTotal: number;
  jobProfit: number;
  salesRepCommission: number;
  presCommission?: number;
  vpCommission?: number;
  companyRetained?: number;
  profitPercentDisplay: number;
  paymentsReceived: number;
  balance: number;
  commissionPaidToDate: number;
  commissionOutstanding: number;
}

interface DropdownConfig {
  suppliers: Array<{ name: string; category: string }>;
  subcontractors: Array<{ name: string; trade: string }>;
  workersComp: { enabled: boolean; ratePercent: number; displayAs: string };
  overheadTiers: Array<{ threshold: number; rate: number; label: string }>;
  profitSplits: { salesRep: number; pres: number; vp: number };
  newEntryThresholds: { supplier: number; subcontractor: number };
  inspectors: Array<{ id: string; name: string; initials: string }>;
  salesReps: Array<{ id: string; name: string }>;
  canCreate: boolean;
  canViewAdminTier: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
}

function emptyBreakdown(): CustomerBreakdown {
  return {
    rNumber: '',
    customerName: '',
    address: '',
    salesRep: '',
    inspector: '',
    dateInstalled: '',
    jobTotal: 0,
    permit: 0,
    otherCosts: [],
    materials: [],
    labor: [],
    paymentsIn: [],
    commissionsPaid: { revisions: [] },
    notes: '',
    status: 'draft',
  };
}

// ─── Main Page ─────────────────────────────────────────────────────────

export default function CustomerBreakdownsPage() {
  const [config, setConfig] = useState<DropdownConfig | null>(null);
  const [breakdown, setBreakdown] = useState<CustomerBreakdown>(emptyBreakdown());
  const [totals, setTotals] = useState<CalculatedTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showAdminTier, setShowAdminTier] = useState(true);
  const [vendorAlerts, setVendorAlerts] = useState<Array<{ type: string; name: string; amount: number; threshold: number }>>([]);

  // Sheet sync state — pending changes inbox + sync button
  const [syncChecking, setSyncChecking] = useState(false);
  const [syncApplying, setSyncApplying] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Array<{ field: string; portalValue: unknown; sheetValue: unknown }> | null>(null);

  // ── Load dropdown config on mount ────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/portal/customer-breakdowns?action=dropdowns', {
          credentials: 'include',
        });
        const data = await res.json();
        if (data.success) {
          setConfig(data.config);
          setShowAdminTier(data.config.canViewAdminTier);
        } else {
          setError(data.error || 'Failed to load config');
        }
      } catch (e) {
        setError('Failed to load config: ' + (e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Auto-recalculate totals whenever breakdown changes ───────
  const recalculate = useCallback(
    async (bd: CustomerBreakdown) => {
      try {
        const res = await fetch('/api/portal/customer-breakdowns', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'calculate', breakdown: bd }),
        });
        const data = await res.json();
        if (data.success) setTotals(data.totals);
      } catch (e) {
        console.error('recalculate failed:', e);
      }
    },
    []
  );

  // Debounced recalc
  useEffect(() => {
    if (!config) return;
    const t = setTimeout(() => recalculate(breakdown), 300);
    return () => clearTimeout(t);
  }, [breakdown, config, recalculate]);

  // ── R-number lookup ─────────────────────────────────────────
  async function handleLookup() {
    if (!breakdown.rNumber.trim()) return;
    setLookupLoading(true);
    setLookupMessage(null);
    try {
      const res = await fetch(
        `/api/portal/customer-breakdowns?action=lookup&rNumber=${encodeURIComponent(breakdown.rNumber.trim())}`,
        { credentials: 'include' }
      );
      const data = await res.json();
      if (data.success) {
        const ap = data.autoPopulated || {};
        setBreakdown(prev => ({
          ...prev,
          ...ap,
          jobTotal: ap.jobTotal ?? prev.jobTotal,
          rNumber: prev.rNumber, // keep as typed
        }));
        const sourceLabels: Record<string, string> = {
          'customer-breakdowns': 'Existing breakdown found — loaded all fields',
          'jobnimbus': 'JobNimbus match — populated customer, address, sales rep',
          'commissions': 'Found in commissions log — populated customer and rep',
          'none': `No existing data for ${breakdown.rNumber}. Fill in manually.`,
        };
        setLookupMessage(sourceLabels[data.source] || data.message || 'Lookup complete');
      } else {
        setLookupMessage(data.error || 'Lookup failed');
      }
    } catch (e) {
      setLookupMessage('Lookup failed: ' + (e as Error).message);
    } finally {
      setLookupLoading(false);
    }
  }

  // ── Material handlers ───────────────────────────────────────
  function addMaterial() {
    setBreakdown(prev => ({
      ...prev,
      materials: [
        ...prev.materials,
        { supplier: '', amount: 0, isCredit: false, orderSource: 'stock' },
      ],
    }));
  }
  function addMaterialCredit() {
    setBreakdown(prev => ({
      ...prev,
      materials: [
        ...prev.materials,
        { supplier: 'Material Credit', amount: 0, isCredit: true, orderSource: 'stock' },
      ],
    }));
  }
  function toggleMaterialSource(idx: number) {
    setBreakdown(prev => {
      const updated = [...prev.materials];
      const current = updated[idx].orderSource || 'stock';
      updated[idx] = {
        ...updated[idx],
        orderSource: current === 'stock' ? 'other_vendor' : 'stock',
      };
      return { ...prev, materials: updated };
    });
  }
  function updateMaterial(idx: number, patch: Partial<MaterialLineItem>) {
    setBreakdown(prev => {
      const updated = [...prev.materials];
      updated[idx] = { ...updated[idx], ...patch };
      return { ...prev, materials: updated };
    });
  }
  function removeMaterial(idx: number) {
    setBreakdown(prev => ({ ...prev, materials: prev.materials.filter((_, i) => i !== idx) }));
  }

  // ── Labor handlers ──────────────────────────────────────────
  function addLabor() {
    setBreakdown(prev => ({
      ...prev,
      labor: [...prev.labor, { subcontractor: '', amount: 0 }],
    }));
  }
  function addWorkersCompLine() {
    setBreakdown(prev => ({
      ...prev,
      labor: [
        ...prev.labor,
        { subcontractor: 'Workers Comp', amount: 0, isWorkersComp: true },
      ],
    }));
  }
  function updateLabor(idx: number, patch: Partial<LaborLineItem>) {
    setBreakdown(prev => {
      const updated = [...prev.labor];
      updated[idx] = { ...updated[idx], ...patch };
      return { ...prev, labor: updated };
    });
  }
  function removeLabor(idx: number) {
    setBreakdown(prev => ({ ...prev, labor: prev.labor.filter((_, i) => i !== idx) }));
  }

  // ── Payment handlers ────────────────────────────────────────
  function addPayment(kind: 'deposit' | 'final' | 'progress') {
    setBreakdown(prev => ({
      ...prev,
      paymentsIn: [...prev.paymentsIn, { kind, amount: 0, method: 'check' }],
    }));
  }
  function updatePayment(idx: number, patch: Partial<PaymentLineItem>) {
    setBreakdown(prev => {
      const updated = [...prev.paymentsIn];
      updated[idx] = { ...updated[idx], ...patch };
      return { ...prev, paymentsIn: updated };
    });
  }
  function removePayment(idx: number) {
    setBreakdown(prev => ({ ...prev, paymentsIn: prev.paymentsIn.filter((_, i) => i !== idx) }));
  }

  // ── Sheet sync ──────────────────────────────────────────────
  async function handleCheckSheetChanges() {
    if (!breakdown.breakdownId) {
      setError('Save the breakdown first before checking for sheet changes');
      return;
    }
    setSyncChecking(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/portal/customer-breakdowns?action=pending-changes&breakdownId=${breakdown.breakdownId}`,
        { credentials: 'include' }
      );
      const data = await res.json();
      if (data.success) {
        setPendingChanges(data.changes || []);
        if (!data.hasChanges) {
          setSuccessMsg('Sheet and portal are in sync — no pending changes');
        }
      } else {
        setError(data.error || 'Failed to check for changes');
      }
    } catch (e) {
      setError('Failed to check sheet: ' + (e as Error).message);
    } finally {
      setSyncChecking(false);
    }
  }

  async function handleApplySheetChanges() {
    if (!breakdown.breakdownId) return;
    setSyncApplying(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/customer-breakdowns', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-from-sheet', breakdownId: breakdown.breakdownId }),
      });
      const data = await res.json();
      if (data.success) {
        setBreakdown(data.breakdown);
        setTotals(data.totals);
        setPendingChanges(null);
        setSuccessMsg('Sheet changes applied to portal');
      } else {
        setError(data.error || 'Sync failed');
      }
    } catch (e) {
      setError('Sync failed: ' + (e as Error).message);
    } finally {
      setSyncApplying(false);
    }
  }

  // ── Save ────────────────────────────────────────────────────
  async function handleSave(targetStatus: CustomerBreakdown['status'] = 'draft') {
    if (!breakdown.rNumber || !breakdown.customerName || breakdown.jobTotal <= 0) {
      setError('R-Number, Customer Name, and Job Total are required');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/portal/customer-breakdowns', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: breakdown.breakdownId ? 'update' : 'create',
          breakdown: { ...breakdown, status: targetStatus },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBreakdown(data.breakdown);
        setTotals(data.totals);
        setVendorAlerts(data.alerts || []);
        setSuccessMsg(
          `Saved ${data.breakdown.rNumber}` +
            (data.alerts?.length > 0
              ? ` (${data.alerts.length} vendor alert${data.alerts.length > 1 ? 's' : ''} sent to admins)`
              : '')
        );
      } else {
        setError(data.error || 'Save failed');
      }
    } catch (e) {
      setError('Save failed: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // ── Derived ──────────────────────────────────────────────────
  const canCreate = config?.canCreate ?? false;
  const canViewAdmin = config?.canViewAdminTier ?? false;
  const showAdminContent = canViewAdmin && showAdminTier;

  const supplierOptions = useMemo(() => config?.suppliers || [], [config]);
  const subOptions = useMemo(() => config?.subcontractors || [], [config]);

  // ── Render ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#39FF14] animate-spin" />
          <p className="text-zinc-400 text-sm">Loading customer breakdown tool...</p>
        </div>
      </div>
    );
  }

  if (!canCreate) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
          <p className="text-zinc-400 text-sm">
            Customer breakdowns can only be created by admins, managers, and office staff (Sara,
            Destin, Tia, Michael, Chris). If you need access, contact Michael.
          </p>
          <Link
            href="/portal"
            className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* ── Header ────────────────────────────────────────────── */}
      <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/portal" className="p-2 hover:bg-zinc-800 rounded-lg">
                <ArrowLeft className="w-5 h-5 text-zinc-400" />
              </Link>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Hammer className="w-5 h-5 text-[#39FF14]" />
                  Customer Breakdown
                </h1>
                <p className="text-sm text-zinc-500">
                  Job costing, commission payouts, and vendor tracking
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canViewAdmin && (
                <button
                  onClick={() => setShowAdminTier(s => !s)}
                  title={showAdminTier ? 'Hide Pres/VP (public view)' : 'Show Pres/VP (admin view)'}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg hover:bg-zinc-700"
                >
                  {showAdminTier ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  {showAdminTier ? 'Admin View' : 'Public View'}
                </button>
              )}
              {breakdown.breakdownId && (
                <button
                  onClick={handleCheckSheetChanges}
                  disabled={syncChecking}
                  title="Check the per-job Google Sheet tab for edits made outside the portal"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg hover:bg-zinc-700 disabled:opacity-50"
                >
                  {syncChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Check Sheet
                </button>
              )}
              <button
                onClick={() => handleSave('draft')}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg hover:bg-zinc-700 disabled:opacity-50 no-print"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Draft
              </button>
              <button
                onClick={() => handleSave('pending_approval')}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#39FF14] text-black rounded-lg hover:bg-[#39FF14]/90 disabled:opacity-50 no-print"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Submit for Approval
              </button>
              <button
                onClick={() => window.print()}
                title="Print or save as PDF"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg hover:bg-zinc-700 no-print"
              >
                <FileText className="w-3.5 h-3.5" />
                Print
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Print-only styles: hide interactive chrome, reset dark theme to
          white background with black text so it renders cleanly on paper
          or as a PDF. Applied when the user hits Print from the header. */}
      <style jsx global>{`
        @media print {
          @page { size: Letter; margin: 0.4in; }
          .no-print { display: none !important; }
          header.border-b { display: none !important; }
          body, html {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .bg-zinc-950, .bg-zinc-900, .bg-zinc-800, .bg-black {
            background: white !important;
            color: black !important;
            border-color: #ccc !important;
          }
          .text-white, .text-zinc-300, .text-zinc-400, .text-zinc-500 {
            color: black !important;
          }
          .text-\\[\\#39FF14\\], .text-\\[\\#39ff14\\] {
            color: #0066CC !important; /* replace neon with brand blue for print */
          }
          .border-zinc-800, .border-zinc-700 {
            border-color: #ccc !important;
          }
          button, input[type="checkbox"], input[type="radio"], select {
            /* Show current values but disable interaction cues */
            box-shadow: none !important;
          }
          input, textarea, select {
            background: white !important;
            color: black !important;
            border: 1px solid #ccc !important;
          }
          /* Avoid breaking a section across pages when possible */
          section {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          /* Let the main content fill the page */
          main {
            max-width: 100% !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ── Pending Sheet Changes Inbox ────────────────── */}
        {pendingChanges && pendingChanges.length > 0 && (
          <div className="bg-blue-900/20 border border-blue-800/50 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-blue-300">
                  {pendingChanges.length} pending change{pendingChanges.length > 1 ? 's' : ''} from Google Sheet
                </h3>
              </div>
              <button
                onClick={() => setPendingChanges(null)}
                className="text-zinc-500 hover:text-zinc-300"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1 text-xs font-mono">
              {pendingChanges.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-zinc-400">
                  <span className="text-blue-400 w-40 truncate" title={c.field}>{c.field}:</span>
                  <span className="text-zinc-500">portal=</span>
                  <span className="text-zinc-300">{JSON.stringify(c.portalValue)}</span>
                  <span className="text-zinc-500">→ sheet=</span>
                  <span className="text-[#39FF14]">{JSON.stringify(c.sheetValue)}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4 pt-3 border-t border-blue-900/30">
              <button
                onClick={handleApplySheetChanges}
                disabled={syncApplying}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#39FF14] text-black rounded-lg hover:bg-[#39FF14]/90 disabled:opacity-50"
              >
                {syncApplying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Accept Sheet Changes
              </button>
              <button
                onClick={() => setPendingChanges(null)}
                disabled={syncApplying}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg hover:bg-zinc-700 disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                Reject (Keep Portal)
              </button>
              <span className="ml-auto text-xs text-zinc-500 self-center">
                Accepting overwrites portal values with sheet values.
              </span>
            </div>
          </div>
        )}

        {/* ── Alerts ───────────────────────────────────────── */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-800/50 rounded-lg text-sm text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
            <button onClick={() => setError(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {successMsg && (
          <div className="flex items-start gap-2 p-3 bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-lg text-sm text-[#39FF14]">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">{successMsg}</div>
            <button onClick={() => setSuccessMsg(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {vendorAlerts.length > 0 && (
          <div className="flex items-start gap-2 p-3 bg-yellow-900/20 border border-yellow-800/50 rounded-lg text-sm text-yellow-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold mb-1">New vendor alert sent to admins:</div>
              <ul className="list-disc list-inside space-y-0.5">
                {vendorAlerts.map((a, i) => (
                  <li key={i}>
                    {a.type === 'supplier' ? 'Supplier' : 'Subcontractor'}:{' '}
                    <strong>{a.name}</strong> at {fmtMoney(a.amount)} (threshold: $
                    {a.threshold})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ── R-Number Lookup ───────────────────────────────── */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Search className="w-5 h-5 text-[#39FF14]" />
            Look Up Job
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={breakdown.rNumber}
                onChange={e => setBreakdown(prev => ({ ...prev, rNumber: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleLookup()}
                placeholder="Enter R-Number (e.g., R1295) or JobNimbus Job Number"
                className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14]/30"
              />
            </div>
            <button
              onClick={handleLookup}
              disabled={lookupLoading || !breakdown.rNumber.trim()}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#39FF14] text-black rounded-lg font-medium text-sm hover:bg-[#39FF14]/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {lookupLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Auto-Populate
            </button>
          </div>
          {lookupMessage && (
            <p className="mt-3 text-xs text-zinc-400 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-[#39FF14]" />
              {lookupMessage}
            </p>
          )}
        </section>

        {/* ── Job Info ──────────────────────────────────────── */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-[#39FF14]" />
            Job Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Customer Name *" required>
              <input
                type="text"
                value={breakdown.customerName}
                onChange={e => setBreakdown(p => ({ ...p, customerName: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <Field label="Sales Rep / Inspector">
              <select
                value={breakdown.salesRep}
                onChange={e =>
                  setBreakdown(p => ({
                    ...p,
                    salesRep: e.target.value,
                    // Keep inspector in sync — they're the same person at RCRS
                    inspector: e.target.value,
                  }))
                }
                className={inputCls}
              >
                <option value="">— Select —</option>
                {config?.salesReps.map(r => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Address" className="md:col-span-2">
              <input
                type="text"
                value={breakdown.address}
                onChange={e => setBreakdown(p => ({ ...p, address: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <Field label="Date Installed">
              <input
                type="date"
                value={breakdown.dateInstalled || ''}
                onChange={e => setBreakdown(p => ({ ...p, dateInstalled: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <Field label="Job Total * (contracted price)" required>
              <input
                type="number"
                step="0.01"
                value={breakdown.jobTotal || ''}
                onChange={e => setBreakdown(p => ({ ...p, jobTotal: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
                className={inputCls}
              />
            </Field>
            <Field label="Permit Fees">
              <input
                type="number"
                step="0.01"
                value={breakdown.permit || ''}
                onChange={e => setBreakdown(p => ({ ...p, permit: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
                className={inputCls}
              />
            </Field>
          </div>
          {breakdown.jnJobId && (
            <p className="mt-3 text-xs text-zinc-500 flex items-center gap-1.5">
              <ExternalLink className="w-3 h-3" />
              Linked to JobNimbus: {breakdown.jnJobNumber} ({breakdown.jnJobId})
            </p>
          )}
        </section>

        {/* ── Insurance Claim ──────────────────────────────── */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#39FF14]" />
              Insurance Claim
            </h2>
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={breakdown.insurance?.isInsuranceClaim === true}
                onChange={e => {
                  const on = e.target.checked;
                  setBreakdown(p => ({
                    ...p,
                    insurance: on
                      ? {
                          isInsuranceClaim: true,
                          carrierName: p.insurance?.carrierName || '',
                          claimNumber: p.insurance?.claimNumber || '',
                          deductible: p.insurance?.deductible,
                          acv: p.insurance?.acv,
                          rcv: p.insurance?.rcv,
                          depreciation: p.insurance?.depreciation,
                          supplements: p.insurance?.supplements || [],
                        }
                      : { ...(p.insurance || { isInsuranceClaim: false }), isInsuranceClaim: false },
                  }));
                }}
                className="w-4 h-4 accent-[#39FF14]"
              />
              Insurance Claim?
            </label>
          </div>

          {breakdown.insurance?.isInsuranceClaim && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field label="Carrier">
                  <input
                    type="text"
                    value={breakdown.insurance?.carrierName || ''}
                    onChange={e =>
                      setBreakdown(p => ({
                        ...p,
                        insurance: {
                          ...(p.insurance || { isInsuranceClaim: true }),
                          isInsuranceClaim: true,
                          carrierName: e.target.value,
                        },
                      }))
                    }
                    placeholder="State Farm, Allstate, USAA..."
                    className={inputCls}
                  />
                </Field>
                <Field label="Claim #">
                  <input
                    type="text"
                    value={breakdown.insurance?.claimNumber || ''}
                    onChange={e =>
                      setBreakdown(p => ({
                        ...p,
                        insurance: {
                          ...(p.insurance || { isInsuranceClaim: true }),
                          isInsuranceClaim: true,
                          claimNumber: e.target.value,
                        },
                      }))
                    }
                    placeholder="CLM-123456"
                    className={inputCls}
                  />
                </Field>
                <Field label="Deductible ($)">
                  <input
                    type="number"
                    step="0.01"
                    value={breakdown.insurance?.deductible ?? ''}
                    onChange={e =>
                      setBreakdown(p => ({
                        ...p,
                        insurance: {
                          ...(p.insurance || { isInsuranceClaim: true }),
                          isInsuranceClaim: true,
                          deductible: parseFloat(e.target.value) || 0,
                        },
                      }))
                    }
                    placeholder="1000.00"
                    className={inputCls}
                  />
                </Field>
                <Field label="ACV ($)">
                  <input
                    type="number"
                    step="0.01"
                    value={breakdown.insurance?.acv ?? ''}
                    onChange={e => {
                      const acv = parseFloat(e.target.value) || 0;
                      setBreakdown(p => {
                        const rcv = p.insurance?.rcv ?? 0;
                        return {
                          ...p,
                          insurance: {
                            ...(p.insurance || { isInsuranceClaim: true }),
                            isInsuranceClaim: true,
                            acv,
                            depreciation: Math.max(0, rcv - acv),
                          },
                        };
                      });
                    }}
                    placeholder="0.00"
                    className={inputCls}
                  />
                </Field>
                <Field label="RCV ($)">
                  <input
                    type="number"
                    step="0.01"
                    value={breakdown.insurance?.rcv ?? ''}
                    onChange={e => {
                      const rcv = parseFloat(e.target.value) || 0;
                      setBreakdown(p => {
                        const acv = p.insurance?.acv ?? 0;
                        return {
                          ...p,
                          insurance: {
                            ...(p.insurance || { isInsuranceClaim: true }),
                            isInsuranceClaim: true,
                            rcv,
                            depreciation: Math.max(0, rcv - acv),
                          },
                        };
                      });
                    }}
                    placeholder="0.00"
                    className={inputCls}
                  />
                </Field>
                <Field label="Depreciation ($) — auto (RCV - ACV)">
                  <input
                    type="number"
                    readOnly
                    value={(breakdown.insurance?.depreciation ?? 0).toFixed(2)}
                    className={`${inputCls} opacity-75 cursor-not-allowed`}
                  />
                </Field>
              </div>

              {/* Supplements */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-zinc-300">
                    Supplements ({breakdown.insurance?.supplements?.length || 0})
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      setBreakdown(p => ({
                        ...p,
                        insurance: {
                          ...(p.insurance || { isInsuranceClaim: true }),
                          isInsuranceClaim: true,
                          supplements: [
                            ...(p.insurance?.supplements || []),
                            { description: '', amount: 0, status: 'pending' },
                          ],
                        },
                      }))
                    }
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg hover:bg-zinc-700"
                  >
                    <Plus className="w-3 h-3" />
                    Add Supplement
                  </button>
                </div>
                {(breakdown.insurance?.supplements || []).length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">
                    No supplements yet. Add one for each line item you&apos;re
                    chasing beyond the original scope.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(breakdown.insurance?.supplements || []).map((s, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg bg-zinc-800/30"
                      >
                        <div className="col-span-6">
                          <input
                            type="text"
                            value={s.description}
                            onChange={e => {
                              const val = e.target.value;
                              setBreakdown(p => {
                                const list = [...(p.insurance?.supplements || [])];
                                list[idx] = { ...list[idx], description: val };
                                return {
                                  ...p,
                                  insurance: {
                                    ...(p.insurance || { isInsuranceClaim: true }),
                                    isInsuranceClaim: true,
                                    supplements: list,
                                  },
                                };
                              });
                            }}
                            placeholder="Description"
                            className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-[#39FF14]"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            step="0.01"
                            value={s.amount || ''}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setBreakdown(p => {
                                const list = [...(p.insurance?.supplements || [])];
                                list[idx] = { ...list[idx], amount: val };
                                return {
                                  ...p,
                                  insurance: {
                                    ...(p.insurance || { isInsuranceClaim: true }),
                                    isInsuranceClaim: true,
                                    supplements: list,
                                  },
                                };
                              });
                            }}
                            placeholder="0.00"
                            className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white text-right focus:outline-none focus:border-[#39FF14]"
                          />
                        </div>
                        <div className="col-span-3">
                          <select
                            value={s.status}
                            onChange={e => {
                              const val = e.target.value as 'pending' | 'approved' | 'paid' | 'denied';
                              setBreakdown(p => {
                                const list = [...(p.insurance?.supplements || [])];
                                list[idx] = {
                                  ...list[idx],
                                  status: val,
                                  submittedAt: list[idx].submittedAt || new Date().toISOString(),
                                };
                                return {
                                  ...p,
                                  insurance: {
                                    ...(p.insurance || { isInsuranceClaim: true }),
                                    isInsuranceClaim: true,
                                    supplements: list,
                                  },
                                };
                              });
                            }}
                            className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-[#39FF14]"
                          >
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="paid">Paid</option>
                            <option value="denied">Denied</option>
                          </select>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              setBreakdown(p => {
                                const list = (p.insurance?.supplements || []).filter(
                                  (_, i) => i !== idx
                                );
                                return {
                                  ...p,
                                  insurance: {
                                    ...(p.insurance || { isInsuranceClaim: true }),
                                    isInsuranceClaim: true,
                                    supplements: list,
                                  },
                                };
                              })
                            }
                            className="p-1.5 hover:bg-red-900/30 rounded text-zinc-500 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* ── Materials ────────────────────────────────────── */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Package className="w-5 h-5 text-[#39FF14]" />
              Materials ({breakdown.materials.length})
            </h2>
            <div className="flex gap-2">
              <button
                onClick={addMaterial}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg hover:bg-zinc-700"
              >
                <Plus className="w-3 h-3" />
                Add Supplier
              </button>
              <button
                onClick={addMaterialCredit}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg hover:bg-zinc-700"
              >
                <Plus className="w-3 h-3" />
                Add Credit
              </button>
            </div>
          </div>
          {breakdown.materials.length === 0 ? (
            <div className="text-center py-6 text-zinc-500 text-sm">
              No materials yet. Click &quot;Add Supplier&quot; to add a line item.
            </div>
          ) : (
            <div className="space-y-2">
              {breakdown.materials.map((m, idx) => {
                const src: 'stock' | 'other_vendor' = m.orderSource === 'other_vendor' ? 'other_vendor' : 'stock';
                return (
                <div
                  key={idx}
                  className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg ${
                    m.isCredit ? 'bg-red-900/10 border border-red-900/30' : 'bg-zinc-800/30'
                  }`}
                >
                  <div className="col-span-3">
                    <input
                      list="supplier-list"
                      type="text"
                      value={m.supplier}
                      onChange={e => updateMaterial(idx, { supplier: e.target.value })}
                      placeholder="Supplier name"
                      className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-[#39FF14]"
                    />
                  </div>
                  {/* Source pill — click to toggle stock <-> vendor */}
                  <div className="col-span-2">
                    <button
                      type="button"
                      onClick={() => toggleMaterialSource(idx)}
                      title="Click to toggle between Stock and Outside Vendor"
                      className={`w-full px-2 py-1.5 rounded text-[11px] font-bold uppercase tracking-wide border transition-colors ${
                        src === 'other_vendor'
                          ? 'bg-purple-500/15 text-purple-300 border-purple-500/40 hover:bg-purple-500/25'
                          : 'bg-[#39FF14]/15 text-[#39FF14] border-[#39FF14]/40 hover:bg-[#39FF14]/25'
                      }`}
                    >
                      {src === 'other_vendor' ? 'vendor' : 'stock'}
                    </button>
                  </div>
                  <div className="col-span-3">
                    <input
                      type="text"
                      value={m.description || ''}
                      onChange={e => updateMaterial(idx, { description: e.target.value })}
                      placeholder="Description / receipt #"
                      className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-[#39FF14]"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      value={m.amount || ''}
                      onChange={e => updateMaterial(idx, { amount: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white text-right focus:outline-none focus:border-[#39FF14]"
                    />
                  </div>
                  <div className="col-span-1 text-right text-sm font-medium">
                    {m.isCredit ? (
                      <span className="text-red-400">-{fmtMoney(m.amount)}</span>
                    ) : (
                      <span className="text-zinc-300">{fmtMoney(m.amount)}</span>
                    )}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={() => removeMaterial(idx)}
                      className="p-1.5 hover:bg-red-900/30 rounded text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                );
              })}
              <datalist id="supplier-list">
                {supplierOptions.map(s => (
                  <option key={s.name} value={s.name}>{s.category}</option>
                ))}
              </datalist>
              <div className="flex justify-end pt-3 border-t border-zinc-800 text-sm">
                <span className="text-zinc-400 mr-3">Total Material Cost:</span>
                <span className="font-semibold text-white w-28 text-right">
                  {fmtMoney(totals?.materialSubtotal || 0)}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* ── Labor ────────────────────────────────────────── */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-[#39FF14]" />
              Labor ({breakdown.labor.length})
            </h2>
            <div className="flex gap-2">
              <button
                onClick={addLabor}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg hover:bg-zinc-700"
              >
                <Plus className="w-3 h-3" />
                Add Subcontractor
              </button>
              <button
                onClick={addWorkersCompLine}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg hover:bg-zinc-700"
              >
                <Plus className="w-3 h-3" />
                Add Workers Comp Line
              </button>
            </div>
          </div>
          {breakdown.labor.length === 0 ? (
            <div className="text-center py-6 text-zinc-500 text-sm">
              No labor yet. {config?.workersComp.enabled && (
                <>
                  Workers Comp at <strong>{config.workersComp.ratePercent}%</strong> will be
                  auto-added unless you add an explicit line.
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {breakdown.labor.map((l, idx) => (
                <div
                  key={idx}
                  className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg ${
                    l.isWorkersComp ? 'bg-yellow-900/10 border border-yellow-900/30' : 'bg-zinc-800/30'
                  }`}
                >
                  <div className="col-span-3">
                    <input
                      list="sub-list"
                      type="text"
                      value={l.subcontractor}
                      onChange={e => updateLabor(idx, { subcontractor: e.target.value })}
                      placeholder="Subcontractor name"
                      className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-[#39FF14]"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      value={l.amount || ''}
                      onChange={e => updateLabor(idx, { amount: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white text-right focus:outline-none focus:border-[#39FF14]"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="date"
                      value={l.checkDate || ''}
                      onChange={e => updateLabor(idx, { checkDate: e.target.value })}
                      className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-[#39FF14]"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={l.checkNumber || ''}
                      onChange={e => updateLabor(idx, { checkNumber: e.target.value })}
                      placeholder="Check #"
                      className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-[#39FF14]"
                    />
                  </div>
                  <div className="col-span-2 text-right text-sm text-zinc-300 font-medium">
                    {fmtMoney(l.amount)}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={() => removeLabor(idx)}
                      className="p-1.5 hover:bg-red-900/30 rounded text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <datalist id="sub-list">
                {subOptions.map(s => (
                  <option key={s.name} value={s.name}>{s.trade}</option>
                ))}
              </datalist>
              <div className="pt-3 border-t border-zinc-800 space-y-1 text-sm">
                <div className="flex justify-end">
                  <span className="text-zinc-400 mr-3">Labor Subtotal:</span>
                  <span className="text-white w-28 text-right">{fmtMoney(totals?.laborSubtotal || 0)}</span>
                </div>
                {totals && totals.workersCompAdded > 0 && (
                  <div className="flex justify-end text-yellow-400">
                    <span className="mr-3">
                      Workers Comp {laborHasExplicitWC(breakdown.labor) ? '(from line)' : `(auto ${config?.workersComp.ratePercent}%)`}:
                    </span>
                    <span className="w-28 text-right">+{fmtMoney(totals.workersCompAdded)}</span>
                  </div>
                )}
                <div className="flex justify-end font-semibold">
                  <span className="text-zinc-400 mr-3">Labor Total:</span>
                  <span className="text-white w-28 text-right">{fmtMoney(totals?.laborTotal || 0)}</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Financial Summary (sticky bottom-right) ─────── */}
        <section className="bg-zinc-900 border-2 border-[#39FF14]/30 rounded-xl p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Calculator className="w-5 h-5 text-[#39FF14]" />
            Financial Summary
            {totals && (
              <span className="ml-auto text-sm font-normal text-zinc-500">
                Profit %: <span className="text-[#39FF14] font-semibold">
                  {totals.profitPercentDisplay.toFixed(2)}%
                </span>
              </span>
            )}
          </h2>
          {totals ? (
            <div className="space-y-2 text-sm">
              <SummaryRow label="Job Total" value={totals.jobTotal} bold />
              <SummaryRow
                label={`Overhead (${
                  totals.jobTotal <= 50000
                    ? '15% of job'
                    : `15% first $50K + 10% over`
                })`}
                value={-totals.overheadTotal}
                detail={
                  totals.jobTotal > 50000
                    ? `First $50K: ${fmtMoney(totals.overheadOnFirst50k)} + Over $50K: ${fmtMoney(totals.overheadOver50k)}`
                    : undefined
                }
              />
              <SummaryRow label="Material" value={-totals.materialSubtotal} />
              <SummaryRow
                label={`Labor${totals.workersCompAdded > 0 ? ` (incl. WC ${fmtMoney(totals.workersCompAdded)})` : ''}`}
                value={-totals.laborTotal}
              />
              {totals.permit > 0 && <SummaryRow label="Permit" value={-totals.permit} />}
              {totals.otherCostsTotal > 0 && <SummaryRow label="Other Costs" value={-totals.otherCostsTotal} />}
              <div className="border-t border-zinc-700 my-2" />
              <SummaryRow label="Job Profit" value={totals.jobProfit} bold color="text-[#39FF14]" />
              <div className="border-t border-zinc-700 my-2" />
              <SummaryRow
                label={`Sales Rep (${((config?.profitSplits.salesRep ?? 0.5) * 100).toFixed(0)}%)`}
                value={totals.salesRepCommission}
                color="text-white"
              />

              {showAdminContent && totals.presCommission !== undefined && (
                <>
                  <div className="mt-3 pt-3 border-t-2 border-dashed border-[#39FF14]/30">
                    <p className="text-xs text-[#39FF14]/70 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Admin Tier (Michael, Chris, Sara only)
                    </p>
                  </div>
                  <SummaryRow
                    label={`Pres (${((config?.profitSplits.pres ?? 0.15) * 100).toFixed(0)}%)`}
                    value={totals.presCommission}
                  />
                  <SummaryRow
                    label={`VP (${((config?.profitSplits.vp ?? 0.15) * 100).toFixed(0)}%)`}
                    value={totals.vpCommission || 0}
                  />
                  <SummaryRow
                    label="Company Retained"
                    value={totals.companyRetained || 0}
                    color="text-zinc-400"
                  />
                </>
              )}

              {!canViewAdmin && (
                <p className="mt-3 text-xs text-zinc-600 italic">
                  Pres/VP commission details visible only to Michael, Chris, and Sara.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Enter a job total to see calculations.</p>
          )}
        </section>

        {/* ── Notes ────────────────────────────────────────── */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-[#39FF14]" />
            Notes
          </h2>
          <textarea
            value={breakdown.notes || ''}
            onChange={e => setBreakdown(p => ({ ...p, notes: e.target.value }))}
            rows={3}
            placeholder="Any additional notes about this job..."
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]"
          />
        </section>
      </main>
    </div>
  );
}

// ─── UI helpers ────────────────────────────────────────────────────────

const inputCls =
  'w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14]/30';

function Field({
  label,
  children,
  required,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs text-zinc-400 mb-1">
        {label}
        {required && <span className="text-[#39FF14] ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  bold,
  color = 'text-zinc-200',
  detail,
}: {
  label: string;
  value: number;
  bold?: boolean;
  color?: string;
  detail?: string;
}) {
  return (
    <div className="flex justify-between items-start">
      <div className="flex-1">
        <span className={`text-zinc-400 ${bold ? 'font-semibold' : ''}`}>{label}</span>
        {detail && <div className="text-xs text-zinc-600">{detail}</div>}
      </div>
      <span className={`${color} ${bold ? 'font-semibold' : ''} tabular-nums`}>
        {fmtMoney(value)}
      </span>
    </div>
  );
}

function laborHasExplicitWC(labor: LaborLineItem[]): boolean {
  return labor.some(l => l.isWorkersComp === true || /workers?\s*comp/i.test(l.subcontractor));
}
