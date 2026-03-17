'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield, FileCheck, AlertTriangle, Calendar, DollarSign,
  Plus, Search, Filter, Download, Upload, Camera,
  FileText, Check, X, Clock, Wrench, ChevronDown, ChevronRight,
  Loader2, Send, Hammer, Package, TrendingUp,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface WarrantyDoc {
  name: string;
  url: string;
  uploadedAt: string;
}

interface WarrantyClaim {
  id: string;
  warrantyId: string;
  claimDate: string;
  issueDescription: string;
  category: string;
  severity: string;
  status: string;
  resolution?: string;
  repairDate?: string;
  repairCost?: number;
  coveredByWarranty: boolean;
  photos: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface Warranty {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: string;
  jobId: string;
  jobNimbusId?: string;
  type: string;
  manufacturer?: string;
  productLine?: string;
  startDate: string;
  endDate: string;
  durationYears: number;
  status: string;
  claims: WarrantyClaim[];
  certificateUrl?: string;
  documents: WarrantyDoc[];
  installedBy: string;
  inspectedBy?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface WarrantyStats {
  active: number;
  expiringSoon: number;
  expired: number;
  totalClaims: number;
  openClaims: number;
  totalProtectedValue: number;
}

// =============================================================================
// Constants
// =============================================================================

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  expiring_soon: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  expired: 'bg-red-500/20 text-red-400 border-red-500/30',
  claimed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  voided: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
  claimed: 'Claimed',
  voided: 'Voided',
};

const TYPE_LABELS: Record<string, string> = {
  manufacturer: 'Manufacturer',
  workmanship: 'Workmanship',
  extended: 'Extended',
  leak_free: 'Leak-Free Guarantee',
};

const CLAIM_STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-500/20 text-blue-400',
  under_review: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-green-500/20 text-green-400',
  denied: 'bg-red-500/20 text-red-400',
  completed: 'bg-gray-500/20 text-gray-300',
};

const CLAIM_STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  denied: 'Denied',
  completed: 'Completed',
};

const SEVERITY_COLORS: Record<string, string> = {
  minor: 'text-gray-400',
  moderate: 'text-yellow-400',
  major: 'text-orange-400',
  emergency: 'text-red-400',
};

const MANUFACTURERS = ['GAF', 'Owens Corning', 'CertainTeed', 'IKO', 'Atlas', 'Tamko', 'Malarkey', 'Boral', 'DaVinci', 'DECRA'];
const DURATION_OPTIONS = [5, 10, 15, 20, 25, 30, 50, 99]; // 99 = lifetime
const CLAIM_CATEGORIES = [
  { value: 'leak', label: 'Leak' },
  { value: 'shingle_damage', label: 'Shingle Damage' },
  { value: 'flashing', label: 'Flashing Issue' },
  { value: 'gutter', label: 'Gutter Problem' },
  { value: 'ventilation', label: 'Ventilation' },
  { value: 'other', label: 'Other' },
];
const CLAIM_SEVERITIES = [
  { value: 'minor', label: 'Minor' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'major', label: 'Major' },
  { value: 'emergency', label: 'Emergency' },
];

// =============================================================================
// Component
// =============================================================================

export default function WarrantiesPage() {
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [stats, setStats] = useState<WarrantyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [manufacturerFilter, setManufacturerFilter] = useState('all');
  const [expandedWarranty, setExpandedWarranty] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showClaimForm, setShowClaimForm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // New warranty form
  const [newWarranty, setNewWarranty] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    address: '',
    jobId: '',
    type: 'manufacturer',
    manufacturer: '',
    productLine: '',
    startDate: new Date().toISOString().split('T')[0],
    durationYears: 25,
    installedBy: '',
    inspectedBy: '',
    notes: '',
  });

  // New claim form
  const [newClaim, setNewClaim] = useState({
    issueDescription: '',
    category: 'other',
    severity: 'moderate',
    notes: '',
  });

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------

  const fetchWarranties = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (manufacturerFilter !== 'all') params.set('manufacturer', manufacturerFilter);

      const res = await fetch(`/api/warranties?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setWarranties(data.warranties);
        setStats(data.stats);
      }
    } catch (e) {
      console.error('Failed to fetch warranties:', e);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, typeFilter, manufacturerFilter]);

  useEffect(() => {
    fetchWarranties();
  }, [fetchWarranties]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleCreateWarranty = async () => {
    if (!newWarranty.customerName || !newWarranty.address || !newWarranty.installedBy) return;
    setSaving(true);
    try {
      const res = await fetch('/api/warranties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWarranty),
      });
      const data = await res.json();
      if (data.success) {
        setShowNewForm(false);
        setNewWarranty({
          customerName: '', customerPhone: '', customerEmail: '',
          address: '', jobId: '', type: 'manufacturer', manufacturer: '',
          productLine: '', startDate: new Date().toISOString().split('T')[0],
          durationYears: 25, installedBy: '', inspectedBy: '', notes: '',
        });
        fetchWarranties();
      }
    } catch (e) {
      console.error('Failed to create warranty:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitClaim = async (warrantyId: string) => {
    if (!newClaim.issueDescription) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/warranties/${warrantyId}/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClaim),
      });
      const data = await res.json();
      if (data.success) {
        setShowClaimForm(null);
        setNewClaim({ issueDescription: '', category: 'other', severity: 'moderate', notes: '' });
        fetchWarranties();
      }
    } catch (e) {
      console.error('Failed to submit claim:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm('Are you sure you want to void this warranty?')) return;
    try {
      await fetch(`/api/warranties/${id}`, { method: 'DELETE' });
      fetchWarranties();
    } catch (e) {
      console.error('Failed to archive warranty:', e);
    }
  };

  const daysUntilExpiry = (endDate: string) => {
    const diff = new Date(endDate).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#39FF14]" />
      </div>
    );
  }

  const expiringCount = warranties.filter(w => w.status === 'expiring_soon').length;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-7 h-7 text-[#39FF14]" />
            Warranty Management
          </h1>
          <p className="text-gray-400 text-sm mt-1">Track warranties, claims, and expirations</p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#32e612] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Warranty
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Shield className="w-4 h-4 text-green-400" />
            Active
          </div>
          <div className="text-2xl font-bold text-green-400">{stats?.active || 0}</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            Expiring (90d)
          </div>
          <div className="text-2xl font-bold text-yellow-400">{stats?.expiringSoon || 0}</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Wrench className="w-4 h-4 text-blue-400" />
            Open Claims
          </div>
          <div className="text-2xl font-bold text-blue-400">{stats?.openClaims || 0}</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <DollarSign className="w-4 h-4 text-[#39FF14]" />
            Protected Value
          </div>
          <div className="text-2xl font-bold text-[#39FF14]">
            ${((stats?.totalProtectedValue || 0) / 1000).toFixed(0)}k
          </div>
        </div>
      </div>

      {/* Expiring Soon Alert */}
      {expiringCount > 0 && (
        <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <div>
            <span className="text-yellow-400 font-medium">{expiringCount} warrant{expiringCount > 1 ? 'ies' : 'y'}</span>
            <span className="text-gray-300"> expiring within 90 days. Review and notify customers.</span>
          </div>
          <button
            onClick={() => setStatusFilter('expiring_soon')}
            className="ml-auto text-sm text-yellow-400 hover:text-yellow-300 whitespace-nowrap"
          >
            View All
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, address, job ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#39FF14]/50"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="expiring_soon">Expiring Soon</option>
          <option value="expired">Expired</option>
          <option value="claimed">Claimed</option>
          <option value="voided">Voided</option>
        </select>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#39FF14]/50"
        >
          <option value="all">All Types</option>
          <option value="manufacturer">Manufacturer</option>
          <option value="workmanship">Workmanship</option>
          <option value="extended">Extended</option>
          <option value="leak_free">Leak-Free</option>
        </select>
        <select
          value={manufacturerFilter}
          onChange={e => setManufacturerFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#39FF14]/50"
        >
          <option value="all">All Manufacturers</option>
          {MANUFACTURERS.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Warranty List */}
      {warranties.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
          <Shield className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No warranties found. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {warranties.map(warranty => {
            const isExpanded = expandedWarranty === warranty.id;
            const days = daysUntilExpiry(warranty.endDate);

            return (
              <div
                key={warranty.id}
                className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden"
              >
                {/* Row Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-700/30 transition-colors"
                  onClick={() => setExpandedWarranty(isExpanded ? null : warranty.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4 text-gray-400" />
                          : <ChevronRight className="w-4 h-4 text-gray-400" />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-white truncate">{warranty.customerName}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_COLORS[warranty.status] || STATUS_COLORS.active}`}>
                            {STATUS_LABELS[warranty.status] || warranty.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                          <span className="truncate">{warranty.address}</span>
                          <span className="hidden md:inline">{TYPE_LABELS[warranty.type] || warranty.type}</span>
                          {warranty.manufacturer && (
                            <span className="hidden md:inline text-gray-500">{warranty.manufacturer}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                      <div className="text-right hidden sm:block">
                        <div className="text-xs text-gray-500">
                          {new Date(warranty.startDate).toLocaleDateString()} - {new Date(warranty.endDate).toLocaleDateString()}
                        </div>
                        <div className={`text-xs ${days < 0 ? 'text-red-400' : days < 90 ? 'text-yellow-400' : 'text-gray-400'}`}>
                          {days < 0
                            ? `Expired ${Math.abs(days)} days ago`
                            : days === 0
                              ? 'Expires today'
                              : `${days} days remaining`
                          }
                        </div>
                      </div>
                      {warranty.claims.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full">
                          <Wrench className="w-3 h-3" />
                          {warranty.claims.length}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-gray-700/50 px-4 pb-4 pt-3 space-y-4">
                    {/* Detail Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <h4 className="text-xs text-gray-500 uppercase tracking-wider font-medium">Customer</h4>
                        <p className="text-white text-sm">{warranty.customerName}</p>
                        {warranty.customerPhone && (
                          <a href={`tel:${warranty.customerPhone}`} className="text-sm text-blue-400 hover:underline block">
                            {warranty.customerPhone}
                          </a>
                        )}
                        {warranty.customerEmail && (
                          <a href={`mailto:${warranty.customerEmail}`} className="text-sm text-blue-400 hover:underline block">
                            {warranty.customerEmail}
                          </a>
                        )}
                        <p className="text-sm text-gray-400">{warranty.address}</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-xs text-gray-500 uppercase tracking-wider font-medium">Warranty Details</h4>
                        <p className="text-white text-sm">{TYPE_LABELS[warranty.type]}</p>
                        {warranty.manufacturer && (
                          <p className="text-sm text-gray-400">Manufacturer: {warranty.manufacturer}</p>
                        )}
                        {warranty.productLine && (
                          <p className="text-sm text-gray-400">Product: {warranty.productLine}</p>
                        )}
                        <p className="text-sm text-gray-400">
                          Duration: {warranty.durationYears >= 99 ? 'Lifetime' : `${warranty.durationYears} years`}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-xs text-gray-500 uppercase tracking-wider font-medium">Installation</h4>
                        <p className="text-sm text-gray-400">Installed by: <span className="text-white">{warranty.installedBy}</span></p>
                        {warranty.inspectedBy && (
                          <p className="text-sm text-gray-400">Inspected by: <span className="text-white">{warranty.inspectedBy}</span></p>
                        )}
                        <p className="text-sm text-gray-400">Job ID: <span className="text-gray-300">{warranty.jobId}</span></p>
                      </div>
                    </div>

                    {/* Notes */}
                    {warranty.notes && (
                      <div>
                        <h4 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Notes</h4>
                        <p className="text-sm text-gray-300 bg-gray-900/50 p-3 rounded-lg">{warranty.notes}</p>
                      </div>
                    )}

                    {/* Documents */}
                    {(warranty.certificateUrl || warranty.documents.length > 0) && (
                      <div>
                        <h4 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Documents</h4>
                        <div className="flex flex-wrap gap-2">
                          {warranty.certificateUrl && (
                            <a
                              href={warranty.certificateUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-blue-400 hover:border-blue-500/50 transition-colors"
                            >
                              <FileCheck className="w-4 h-4" />
                              Certificate
                            </a>
                          )}
                          {warranty.documents.map((doc, i) => (
                            <a
                              key={i}
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-gray-300 hover:border-gray-600 transition-colors"
                            >
                              <FileText className="w-4 h-4" />
                              {doc.name}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Claims History */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs text-gray-500 uppercase tracking-wider font-medium">
                          Claims ({warranty.claims.length})
                        </h4>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowClaimForm(warranty.id); }}
                          className="flex items-center gap-1 text-xs text-[#39FF14] hover:text-[#32e612] transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          Submit Claim
                        </button>
                      </div>

                      {warranty.claims.length > 0 ? (
                        <div className="space-y-2">
                          {warranty.claims.map(claim => (
                            <div
                              key={claim.id}
                              className="bg-gray-900/50 border border-gray-700/50 rounded-lg p-3"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${CLAIM_STATUS_COLORS[claim.status] || 'bg-gray-500/20 text-gray-400'}`}>
                                      {CLAIM_STATUS_LABELS[claim.status] || claim.status}
                                    </span>
                                    <span className="text-xs text-gray-500 capitalize">{claim.category.replace('_', ' ')}</span>
                                    <span className={`text-xs ${SEVERITY_COLORS[claim.severity] || 'text-gray-400'}`}>
                                      {claim.severity}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-300 mt-1">{claim.issueDescription}</p>
                                  {claim.resolution && (
                                    <p className="text-xs text-gray-400 mt-1">
                                      Resolution: {claim.resolution}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right text-xs text-gray-500 flex-shrink-0 ml-3">
                                  <div>{new Date(claim.claimDate).toLocaleDateString()}</div>
                                  {claim.repairCost !== undefined && claim.repairCost > 0 && (
                                    <div className="text-gray-400">${claim.repairCost.toLocaleString()}</div>
                                  )}
                                  <div className={claim.coveredByWarranty ? 'text-green-400' : 'text-red-400'}>
                                    {claim.coveredByWarranty ? 'Covered' : 'Not Covered'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No claims filed</p>
                      )}

                      {/* Submit Claim Form */}
                      {showClaimForm === warranty.id && (
                        <div className="mt-3 bg-gray-900/70 border border-gray-600 rounded-lg p-4 space-y-3">
                          <h5 className="text-sm font-medium text-white">New Warranty Claim</h5>
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Issue Description *</label>
                            <textarea
                              value={newClaim.issueDescription}
                              onChange={e => setNewClaim({ ...newClaim, issueDescription: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50 resize-none"
                              rows={3}
                              placeholder="Describe the issue..."
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Category</label>
                              <select
                                value={newClaim.category}
                                onChange={e => setNewClaim({ ...newClaim, category: e.target.value })}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#39FF14]/50"
                              >
                                {CLAIM_CATEGORIES.map(c => (
                                  <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Severity</label>
                              <select
                                value={newClaim.severity}
                                onChange={e => setNewClaim({ ...newClaim, severity: e.target.value })}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#39FF14]/50"
                              >
                                {CLAIM_SEVERITIES.map(s => (
                                  <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Notes</label>
                            <input
                              type="text"
                              value={newClaim.notes}
                              onChange={e => setNewClaim({ ...newClaim, notes: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50"
                              placeholder="Additional notes..."
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setShowClaimForm(null)}
                              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSubmitClaim(warranty.id)}
                              disabled={saving || !newClaim.issueDescription}
                              className="flex items-center gap-1 px-4 py-1.5 bg-[#39FF14] text-black font-medium text-sm rounded-lg hover:bg-[#32e612] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                              Submit Claim
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-700/50">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowClaimForm(warranty.id); }}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/10 transition-colors"
                      >
                        <Wrench className="w-3 h-3" />
                        Submit Claim
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleArchive(warranty.id); }}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
                      >
                        <X className="w-3 h-3" />
                        Void
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Warranty Modal */}
      {showNewForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowNewForm(false)}>
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#39FF14]" />
                New Warranty
              </h2>
              <button onClick={() => setShowNewForm(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Customer Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Customer Name *</label>
                  <input
                    type="text"
                    value={newWarranty.customerName}
                    onChange={e => setNewWarranty({ ...newWarranty, customerName: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Phone</label>
                  <input
                    type="tel"
                    value={newWarranty.customerPhone}
                    onChange={e => setNewWarranty({ ...newWarranty, customerPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50"
                    placeholder="(256) 555-0000"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Email</label>
                  <input
                    type="email"
                    value={newWarranty.customerEmail}
                    onChange={e => setNewWarranty({ ...newWarranty, customerEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50"
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Job ID</label>
                  <input
                    type="text"
                    value={newWarranty.jobId}
                    onChange={e => setNewWarranty({ ...newWarranty, jobId: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50"
                    placeholder="JOB-xxxxx or JN ID"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Address *</label>
                <input
                  type="text"
                  value={newWarranty.address}
                  onChange={e => setNewWarranty({ ...newWarranty, address: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50"
                  placeholder="123 Main St, Huntsville, AL 35801"
                />
              </div>

              {/* Warranty Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Warranty Type *</label>
                  <select
                    value={newWarranty.type}
                    onChange={e => setNewWarranty({ ...newWarranty, type: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#39FF14]/50"
                  >
                    <option value="manufacturer">Manufacturer</option>
                    <option value="workmanship">Workmanship</option>
                    <option value="extended">Extended</option>
                    <option value="leak_free">Leak-Free Guarantee</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Manufacturer</label>
                  <select
                    value={newWarranty.manufacturer}
                    onChange={e => setNewWarranty({ ...newWarranty, manufacturer: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#39FF14]/50"
                  >
                    <option value="">Select...</option>
                    {MANUFACTURERS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Product Line</label>
                  <input
                    type="text"
                    value={newWarranty.productLine}
                    onChange={e => setNewWarranty({ ...newWarranty, productLine: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50"
                    placeholder="e.g., Timberline HDZ"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={newWarranty.startDate}
                    onChange={e => setNewWarranty({ ...newWarranty, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#39FF14]/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Duration (years) *</label>
                  <select
                    value={newWarranty.durationYears}
                    onChange={e => setNewWarranty({ ...newWarranty, durationYears: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#39FF14]/50"
                  >
                    {DURATION_OPTIONS.map(d => (
                      <option key={d} value={d}>{d >= 99 ? 'Lifetime' : `${d} years`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Installed By *</label>
                  <input
                    type="text"
                    value={newWarranty.installedBy}
                    onChange={e => setNewWarranty({ ...newWarranty, installedBy: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50"
                    placeholder="Installer / Rep name"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Inspected By</label>
                <input
                  type="text"
                  value={newWarranty.inspectedBy}
                  onChange={e => setNewWarranty({ ...newWarranty, inspectedBy: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50"
                  placeholder="Inspector name"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Notes</label>
                <textarea
                  value={newWarranty.notes}
                  onChange={e => setNewWarranty({ ...newWarranty, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]/50 resize-none"
                  rows={3}
                  placeholder="Additional details..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowNewForm(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWarranty}
                disabled={saving || !newWarranty.customerName || !newWarranty.address || !newWarranty.installedBy}
                className="flex items-center gap-2 px-6 py-2 bg-[#39FF14] text-black font-semibold text-sm rounded-lg hover:bg-[#32e612] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Create Warranty
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
