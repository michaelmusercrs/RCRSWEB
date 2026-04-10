'use client';

/**
 * Vendor & Supplier Master
 *
 * Admin-only CRUD page for the vendor list stored in
 * data/breakdown-dropdowns.json. Backed by /api/portal/admin/vendors.
 *
 * Admins can:
 *   - Add new suppliers or subcontractors
 *   - Rename / re-categorize existing ones
 *   - Toggle active/inactive in place
 *   - Hard-delete entries (with confirmation)
 *
 * This replaces hand-editing the JSON file so office staff don't need
 * file system access for day-to-day vendor changes.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  Loader2,
  Shield,
  Store,
  Hammer,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────

interface Supplier {
  name: string;
  category: string;
  active: boolean;
}

interface Subcontractor {
  name: string;
  trade: string;
  active: boolean;
}

type VendorType = 'supplier' | 'subcontractor';

interface EditTarget {
  type: VendorType;
  oldName: string;
  name: string;
  category: string;
  trade: string;
  active: boolean;
  isNew: boolean;
}

// ─── Dropdown options ────────────────────────────────────────────────────

const SUPPLIER_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'roofing_materials', label: 'Roofing Materials' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'metal_specialty', label: 'Metal / Specialty' },
  { value: 'measurement_service', label: 'Measurement Service' },
  { value: 'misc', label: 'Misc' },
  { value: 'other', label: 'Other' },
];

const SUBCONTRACTOR_TRADES: Array<{ value: string; label: string }> = [
  { value: 'install_crew', label: 'Install Crew' },
  { value: 'gutter_crew', label: 'Gutter Crew' },
  { value: 'cleanup_crew', label: 'Cleanup Crew' },
  { value: 'specialty', label: 'Specialty' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_LABEL_MAP: Record<string, string> = Object.fromEntries(
  SUPPLIER_CATEGORIES.map(c => [c.value, c.label])
);
const TRADE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  SUBCONTRACTOR_TRADES.map(t => [t.value, t.label])
);

// ─── Component ───────────────────────────────────────────────────────────

export default function VendorAdminPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  // ─── Loader ────────────────────────────────────────────────────────────

  const loadVendors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/admin/vendors', { cache: 'no-store' });
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Request failed with ${res.status}`);
      }
      setSuppliers(data.suppliers || []);
      setSubcontractors(data.subcontractors || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  // ─── Success banner auto-dismiss ───────────────────────────────────────

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 3000);
    return () => clearTimeout(t);
  }, [success]);

  // ─── Mutations ─────────────────────────────────────────────────────────

  const applyResponse = useCallback((data: { suppliers?: Supplier[]; subcontractors?: Subcontractor[] }) => {
    if (data.suppliers) setSuppliers(data.suppliers);
    if (data.subcontractors) setSubcontractors(data.subcontractors);
  }, []);

  const runMutation = useCallback(
    async (
      method: 'POST' | 'PATCH' | 'DELETE',
      body: Record<string, unknown>,
      successMessage: string
    ) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/portal/admin/vendors', {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || `Request failed with ${res.status}`);
        }
        applyResponse(data);
        setSuccess(successMessage);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Request failed');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [applyResponse]
  );

  const handleSave = useCallback(async () => {
    if (!editTarget) return;
    const trimmedName = editTarget.name.trim();
    if (!trimmedName) {
      setError('Name is required');
      return;
    }

    if (editTarget.isNew) {
      const payload: Record<string, unknown> = {
        type: editTarget.type,
        name: trimmedName,
        active: editTarget.active,
      };
      if (editTarget.type === 'supplier') payload.category = editTarget.category;
      else payload.trade = editTarget.trade;

      const ok = await runMutation('POST', payload, `Added ${editTarget.type}: ${trimmedName}`);
      if (ok) setEditTarget(null);
    } else {
      const updates: Record<string, unknown> = {
        name: trimmedName,
        active: editTarget.active,
      };
      if (editTarget.type === 'supplier') updates.category = editTarget.category;
      else updates.trade = editTarget.trade;

      const ok = await runMutation(
        'PATCH',
        { type: editTarget.type, oldName: editTarget.oldName, updates },
        `Updated ${editTarget.type}: ${trimmedName}`
      );
      if (ok) setEditTarget(null);
    }
  }, [editTarget, runMutation]);

  const handleToggleActive = useCallback(
    async (type: VendorType, name: string, currentActive: boolean) => {
      await runMutation(
        'PATCH',
        {
          type,
          oldName: name,
          updates: { active: !currentActive },
        },
        `${!currentActive ? 'Activated' : 'Deactivated'} ${name}`
      );
    },
    [runMutation]
  );

  const handleDelete = useCallback(
    async (type: VendorType, name: string) => {
      if (!confirm(`Delete ${type} "${name}"? This cannot be undone.`)) return;
      await runMutation('DELETE', { type, name }, `Deleted ${type}: ${name}`);
    },
    [runMutation]
  );

  // ─── Derived ───────────────────────────────────────────────────────────

  const supplierStats = useMemo(
    () => ({
      total: suppliers.length,
      active: suppliers.filter(s => s.active).length,
    }),
    [suppliers]
  );
  const subStats = useMemo(
    () => ({
      total: subcontractors.length,
      active: subcontractors.filter(s => s.active).length,
    }),
    [subcontractors]
  );

  // ─── 403 screen ────────────────────────────────────────────────────────

  if (forbidden) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-red-950/30 border border-red-900/50 rounded-2xl p-8 text-center">
          <Shield className="mx-auto text-red-400 mb-4" size={48} />
          <h1 className="text-xl font-bold text-white mb-2">Admin Only</h1>
          <p className="text-red-300/80 mb-6">
            The vendor master list can only be managed by owners and admins.
          </p>
          <Link
            href="/portal/admin"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Admin
          </Link>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Background pattern */}
      <div className="fixed inset-0 opacity-20 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)',
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-zinc-800 backdrop-blur-xl bg-black/30 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/portal/admin"
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <ArrowLeft size={18} className="text-neutral-400" />
              </Link>
              <div>
                <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                  <Store className="text-[#39FF14]" size={22} />
                  Vendor & Supplier Master
                </h1>
                <p className="text-sm text-neutral-400">
                  Manage suppliers and subcontractors for job breakdowns
                </p>
              </div>
            </div>
            <button
              onClick={loadVendors}
              disabled={loading || saving}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {/* Banners */}
          {success && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14] text-sm">
              <CheckCircle2 size={16} />
              {success}
            </div>
          )}
          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-red-950/40 border border-red-900/60 text-red-300 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div className="text-center py-16">
              <Loader2 className="animate-spin mx-auto text-[#39FF14] mb-4" size={48} />
              <p className="text-neutral-400">Loading vendors...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ─── Suppliers ─── */}
              <section className="bg-white/[0.02] border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#39FF14]/10 flex items-center justify-center">
                      <Store size={20} className="text-[#39FF14]" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-white">Suppliers</h2>
                      <p className="text-xs text-neutral-400">
                        {supplierStats.active} active · {supplierStats.total} total
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setEditTarget({
                        type: 'supplier',
                        oldName: '',
                        name: '',
                        category: 'roofing_materials',
                        trade: '',
                        active: true,
                        isNew: true,
                      })
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#39FF14] hover:bg-[#39FF14]/90 text-black text-sm font-semibold transition-colors"
                  >
                    <Plus size={14} />
                    Add Supplier
                  </button>
                </div>

                <div className="divide-y divide-zinc-800">
                  {suppliers.length === 0 ? (
                    <div className="p-8 text-center text-sm text-neutral-500">
                      No suppliers yet. Click &ldquo;Add Supplier&rdquo; to create one.
                    </div>
                  ) : (
                    suppliers.map(s => (
                      <div
                        key={s.name}
                        className={`flex items-center gap-3 p-3 hover:bg-white/[0.02] transition-colors ${
                          !s.active ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white truncate">{s.name}</div>
                          <div className="text-xs text-neutral-400">
                            {CATEGORY_LABEL_MAP[s.category] || s.category}
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleActive('supplier', s.name, s.active)}
                          disabled={saving}
                          title={s.active ? 'Click to deactivate' : 'Click to activate'}
                          className="flex items-center gap-1 disabled:opacity-50"
                        >
                          {s.active ? (
                            <ToggleRight size={28} className="text-[#39FF14]" />
                          ) : (
                            <ToggleLeft size={28} className="text-neutral-600" />
                          )}
                        </button>
                        <button
                          onClick={() =>
                            setEditTarget({
                              type: 'supplier',
                              oldName: s.name,
                              name: s.name,
                              category: s.category,
                              trade: '',
                              active: s.active,
                              isNew: false,
                            })
                          }
                          disabled={saving}
                          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-300 disabled:opacity-50"
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete('supplier', s.name)}
                          disabled={saving}
                          className="w-8 h-8 rounded-lg bg-red-950/40 hover:bg-red-900/60 flex items-center justify-center text-red-400 disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* ─── Subcontractors ─── */}
              <section className="bg-white/[0.02] border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                      <Hammer size={20} className="text-orange-400" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-white">Subcontractors</h2>
                      <p className="text-xs text-neutral-400">
                        {subStats.active} active · {subStats.total} total
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setEditTarget({
                        type: 'subcontractor',
                        oldName: '',
                        name: '',
                        category: '',
                        trade: 'install_crew',
                        active: true,
                        isNew: true,
                      })
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#39FF14] hover:bg-[#39FF14]/90 text-black text-sm font-semibold transition-colors"
                  >
                    <Plus size={14} />
                    Add Subcontractor
                  </button>
                </div>

                <div className="divide-y divide-zinc-800">
                  {subcontractors.length === 0 ? (
                    <div className="p-8 text-center text-sm text-neutral-500">
                      No subcontractors yet. Click &ldquo;Add Subcontractor&rdquo; to create one.
                    </div>
                  ) : (
                    subcontractors.map(s => (
                      <div
                        key={s.name}
                        className={`flex items-center gap-3 p-3 hover:bg-white/[0.02] transition-colors ${
                          !s.active ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white truncate">{s.name}</div>
                          <div className="text-xs text-neutral-400">
                            {TRADE_LABEL_MAP[s.trade] || s.trade}
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleActive('subcontractor', s.name, s.active)}
                          disabled={saving}
                          title={s.active ? 'Click to deactivate' : 'Click to activate'}
                          className="flex items-center gap-1 disabled:opacity-50"
                        >
                          {s.active ? (
                            <ToggleRight size={28} className="text-[#39FF14]" />
                          ) : (
                            <ToggleLeft size={28} className="text-neutral-600" />
                          )}
                        </button>
                        <button
                          onClick={() =>
                            setEditTarget({
                              type: 'subcontractor',
                              oldName: s.name,
                              name: s.name,
                              category: '',
                              trade: s.trade,
                              active: s.active,
                              isNew: false,
                            })
                          }
                          disabled={saving}
                          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-300 disabled:opacity-50"
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete('subcontractor', s.name)}
                          disabled={saving}
                          className="w-8 h-8 rounded-lg bg-red-950/40 hover:bg-red-900/60 flex items-center justify-center text-red-400 disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

      {/* ─── Edit Modal ─── */}
      {editTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={e => {
            if (e.target === e.currentTarget && !saving) setEditTarget(null);
          }}
        >
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="font-semibold text-white">
                {editTarget.isNew ? 'Add' : 'Edit'}{' '}
                {editTarget.type === 'supplier' ? 'Supplier' : 'Subcontractor'}
              </h3>
              <button
                onClick={() => !saving && setEditTarget(null)}
                disabled={saving}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={editTarget.name}
                  onChange={e => setEditTarget({ ...editTarget, name: e.target.value })}
                  placeholder={
                    editTarget.type === 'supplier'
                      ? 'e.g. ABC Supply'
                      : 'e.g. Martin Roofing'
                  }
                  className="w-full bg-black/40 border border-zinc-700 rounded-xl px-3 py-2 text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#39FF14]/60 focus:ring-1 focus:ring-[#39FF14]/30 transition-all"
                  autoFocus
                />
              </div>

              {editTarget.type === 'supplier' ? (
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                    Category
                  </label>
                  <select
                    value={editTarget.category}
                    onChange={e => setEditTarget({ ...editTarget, category: e.target.value })}
                    className="w-full bg-black/40 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#39FF14]/60 focus:ring-1 focus:ring-[#39FF14]/30 transition-all"
                  >
                    {SUPPLIER_CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                    Trade
                  </label>
                  <select
                    value={editTarget.trade}
                    onChange={e => setEditTarget({ ...editTarget, trade: e.target.value })}
                    className="w-full bg-black/40 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#39FF14]/60 focus:ring-1 focus:ring-[#39FF14]/30 transition-all"
                  >
                    {SUBCONTRACTOR_TRADES.map(t => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editTarget.active}
                  onChange={e => setEditTarget({ ...editTarget, active: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-600 bg-black/40 text-[#39FF14] focus:ring-[#39FF14]/30"
                />
                <span className="text-sm text-white">Active</span>
                <span className="text-xs text-neutral-500">
                  (inactive entries stay in the list but are hidden from new breakdowns)
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-zinc-800">
              <button
                onClick={() => setEditTarget(null)}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editTarget.name.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#39FF14] hover:bg-[#39FF14]/90 text-black text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                {editTarget.isNew ? 'Add' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
