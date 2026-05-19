'use client';

/**
 * /portal/inventory/vendors — inventory vendor catalog (admin only).
 *
 * CRUD over the Vendors Sheets tab via /api/portal/inventory/vendors.
 * Seeded on first load with the 6 known distributors (Advance, Beacon,
 * Gold Eagle Hsv, Gold Eagle Decatur, Lowe's, Home Depot).
 *
 * Distinct from /portal/admin/vendors — that page edits the supplier
 * dropdown for the customer-breakdown form. THIS one manages inventory
 * restock vendors and their contact details.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Edit, Save, X, Loader2, Shield, RefreshCw,
  Store, Mail, Phone, MapPin, Trash2, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface Vendor {
  vendorId: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  terms: string;
  paymentMethod: string;
  city: string;
  state: string;
  notes: string;
  active: boolean;
}

const EMPTY_VENDOR: Omit<Vendor, 'vendorId'> = {
  name: '',
  contact: '',
  email: '',
  phone: '',
  address: '',
  terms: 'Net 30',
  paymentMethod: 'check',
  city: '',
  state: 'AL',
  notes: '',
  active: true,
};

export default function InventoryVendorsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [creating, setCreating] = useState<Omit<Vendor, 'vendorId'> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/inventory/vendors?action=list');
      if (!res.ok) {
        setError(`Failed to load vendors (HTTP ${res.status})`);
        return;
      }
      const json = await res.json();
      setVendors(json.vendors || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const { vendorId, ...updates } = editing;
      const res = await fetch('/api/portal/inventory/vendors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId, updates }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        setError(`Save failed: ${text || res.status}`);
        return;
      }
      setEditing(null);
      flashSuccess('Vendor saved');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveNew = async () => {
    if (!creating || !creating.name) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/inventory/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', vendor: creating }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        setError(`Create failed: ${text || res.status}`);
        return;
      }
      setCreating(null);
      flashSuccess('Vendor created');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (vendor: Vendor) => {
    if (!confirm(`Deactivate vendor "${vendor.name}"?`)) return;
    try {
      const res = await fetch(`/api/portal/inventory/vendors?vendorId=${encodeURIComponent(vendor.vendorId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setError(`Delete failed: HTTP ${res.status}`);
        return;
      }
      flashSuccess('Vendor deactivated');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  if (user && !isAdmin) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
          <Shield className="w-6 h-6 text-red-600 shrink-0" />
          <div>
            <h2 className="font-semibold text-red-900">Access restricted</h2>
            <p className="text-sm text-red-700 mt-1">
              The vendor catalog is admin/owner only.
            </p>
            <Link href="/portal/inventory" className="inline-flex items-center gap-2 mt-3 text-sm text-red-800 underline">
              <ArrowLeft className="w-4 h-4" /> Back to inventory
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/portal/inventory" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Store className="w-6 h-6" /> Inventory Vendors
            </h1>
            <p className="text-sm text-gray-500">
              Restock distributors used by auto-PO drafts and the receive-stock flow.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreating({ ...EMPTY_VENDOR })}
            className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add vendor
          </button>
          <button onClick={load} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}

      {/* Create form */}
      {creating && (
        <VendorForm
          title="New vendor"
          value={creating}
          onChange={setCreating as (v: any) => void}
          onCancel={() => setCreating(null)}
          onSave={saveNew}
          saving={saving}
        />
      )}

      {/* Edit form */}
      {editing && (
        <VendorForm
          title={`Edit: ${editing.name}`}
          value={editing}
          onChange={setEditing as (v: any) => void}
          onCancel={() => setEditing(null)}
          onSave={saveEdit}
          saving={saving}
        />
      )}

      {/* Vendor list */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading && vendors.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        ) : vendors.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            No vendors yet. Add one above.
          </div>
        ) : (
          <div className="divide-y">
            {vendors.map(v => (
              <div key={v.vendorId} className={`p-4 ${!v.active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{v.name}</h3>
                      {!v.active && (
                        <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">Inactive</span>
                      )}
                      {v.terms && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">{v.terms}</span>
                      )}
                      {v.paymentMethod && (
                        <span className="text-xs px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded">{v.paymentMethod}</span>
                      )}
                    </div>
                    <div className="mt-1 grid grid-cols-1 md:grid-cols-3 gap-1.5 text-xs text-gray-600">
                      {v.contact && (
                        <div className="inline-flex items-center gap-1"><Store className="w-3 h-3" />{v.contact}</div>
                      )}
                      {v.email && (
                        <div className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{v.email}</div>
                      )}
                      {v.phone && (
                        <div className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{v.phone}</div>
                      )}
                      {(v.address || v.city) && (
                        <div className="inline-flex items-center gap-1 md:col-span-2">
                          <MapPin className="w-3 h-3" />
                          {[v.address, v.city, v.state].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </div>
                    {v.notes && (
                      <p className="mt-1.5 text-xs text-gray-500 italic">{v.notes}</p>
                    )}
                    <p className="mt-1 text-[10px] font-mono text-gray-400">{v.vendorId}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setEditing({ ...v })}
                      className="p-1.5 hover:bg-gray-100 rounded text-gray-700"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {v.active && (
                      <button
                        onClick={() => remove(v)}
                        className="p-1.5 hover:bg-red-50 rounded text-red-600"
                        title="Deactivate"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Vendor form (shared for create + edit) ──────────────────────────────────

interface VendorFormProps {
  title: string;
  value: any;
  onChange: (v: any) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}

function VendorForm({ title, value, onChange, onCancel, onSave, saving }: VendorFormProps) {
  const set = (k: string, v: string | boolean) => onChange({ ...value, [k]: v });

  return (
    <div className="bg-white rounded-xl border-2 border-blue-200 shadow p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <Field label="Name *">
          <input value={value.name} onChange={e => set('name', e.target.value)} className="w-full px-3 py-2 border rounded" placeholder="Beacon Roofing Supply" />
        </Field>
        <Field label="Contact name">
          <input value={value.contact} onChange={e => set('contact', e.target.value)} className="w-full px-3 py-2 border rounded" placeholder="Salesperson or AR rep" />
        </Field>
        <Field label="Email">
          <input type="email" value={value.email} onChange={e => set('email', e.target.value)} className="w-full px-3 py-2 border rounded" placeholder="orders@vendor.com" />
        </Field>
        <Field label="Phone">
          <input value={value.phone} onChange={e => set('phone', e.target.value)} className="w-full px-3 py-2 border rounded" placeholder="(256) 555-1234" />
        </Field>
        <Field label="Address">
          <input value={value.address} onChange={e => set('address', e.target.value)} className="w-full px-3 py-2 border rounded" placeholder="Street address" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="City">
            <input value={value.city} onChange={e => set('city', e.target.value)} className="w-full px-3 py-2 border rounded" />
          </Field>
          <Field label="State">
            <input value={value.state} onChange={e => set('state', e.target.value)} className="w-full px-3 py-2 border rounded" maxLength={2} />
          </Field>
        </div>
        <Field label="Payment terms">
          <select value={value.terms} onChange={e => set('terms', e.target.value)} className="w-full px-3 py-2 border rounded bg-white">
            <option value="">— Select —</option>
            <option>COD</option>
            <option>Net 15</option>
            <option>Net 30</option>
            <option>Net 45</option>
            <option>Net 60</option>
            <option>Prepaid</option>
          </select>
        </Field>
        <Field label="Payment method">
          <select value={value.paymentMethod} onChange={e => set('paymentMethod', e.target.value)} className="w-full px-3 py-2 border rounded bg-white">
            <option value="">— Select —</option>
            <option value="check">Check</option>
            <option value="ach">ACH</option>
            <option value="card">Card</option>
            <option value="house_account">House account</option>
            <option value="cash">Cash</option>
          </select>
        </Field>
        <Field label="Notes" full>
          <textarea value={value.notes} onChange={e => set('notes', e.target.value)} className="w-full px-3 py-2 border rounded" rows={2} />
        </Field>
        <label className="inline-flex items-center gap-2 col-span-full text-sm">
          <input type="checkbox" checked={value.active !== false} onChange={e => set('active', e.target.checked)} />
          Active
        </label>
      </div>
      <div className="flex items-center justify-end gap-2 pt-2 border-t">
        <button onClick={onCancel} className="px-3 py-2 text-sm rounded hover:bg-gray-100">Cancel</button>
        <button
          onClick={onSave}
          disabled={saving || !value.name}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </button>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
