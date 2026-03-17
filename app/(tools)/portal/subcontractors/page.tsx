'use client';

/**
 * RCRS Portal - Subcontractor Management
 *
 * Directory, job assignment, compliance tracking, and performance
 * analytics for all subcontractors.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Building2,
  Wrench,
  HardHat,
  Star,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Filter,
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  RefreshCw,
  ArrowLeft,
  Upload,
  Shield,
  FileCheck,
  Briefcase,
  Phone,
  Mail,
  MapPin,
  Calendar,
  X,
  Loader2,
  Clock,
  Users,
  Eye,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubcontractorJob {
  id: string;
  subcontractorId: string;
  jobId: string;
  customerName: string;
  address: string;
  scope: string;
  startDate: string;
  endDate?: string;
  agreedRate: number;
  rateType: string;
  totalCost: number;
  status: string;
  qualityRating?: number;
  timelinessRating?: number;
  notes: string;
  photos: string[];
  invoiceReceived: boolean;
  invoicePaid: boolean;
  createdAt: string;
}

interface SubcontractorDoc {
  name: string;
  url: string;
  type: string;
  expiresAt?: string;
}

interface Subcontractor {
  id: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  specialty: string[];
  licenseNumber?: string;
  insuranceExpiry?: string;
  rating: number;
  reliability: number;
  quality: number;
  status: string;
  hourlyRate?: number;
  perSquareRate?: number;
  jobHistory: SubcontractorJob[];
  notes: string;
  documents: SubcontractorDoc[];
  createdAt: string;
  updatedAt: string;
}

interface SubStats {
  total: number;
  active: number;
  avgRating: number;
  jobsThisMonth: number;
  pendingInvoices: number;
  expiringInsurance: number;
}

type ViewMode = 'directory' | 'detail';

// ---------------------------------------------------------------------------
// Specialty config
// ---------------------------------------------------------------------------

const SPECIALTIES = [
  { value: 'roofing', label: 'Roofing', color: 'bg-red-500/20 text-red-400' },
  { value: 'gutters', label: 'Gutters', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'siding', label: 'Siding', color: 'bg-green-500/20 text-green-400' },
  { value: 'windows', label: 'Windows', color: 'bg-cyan-500/20 text-cyan-400' },
  { value: 'framing', label: 'Framing', color: 'bg-amber-500/20 text-amber-400' },
  { value: 'drywall', label: 'Drywall', color: 'bg-gray-500/20 text-gray-400' },
  { value: 'painting', label: 'Painting', color: 'bg-purple-500/20 text-purple-400' },
  { value: 'electrical', label: 'Electrical', color: 'bg-yellow-500/20 text-yellow-400' },
  { value: 'plumbing', label: 'Plumbing', color: 'bg-sky-500/20 text-sky-400' },
  { value: 'hvac', label: 'HVAC', color: 'bg-teal-500/20 text-teal-400' },
  { value: 'tree_removal', label: 'Tree Removal', color: 'bg-emerald-500/20 text-emerald-400' },
  { value: 'dumpster', label: 'Dumpster', color: 'bg-orange-500/20 text-orange-400' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-500/20 text-green-400' },
  inactive: { label: 'Inactive', color: 'bg-gray-500/20 text-gray-400' },
  probation: { label: 'Probation', color: 'bg-yellow-500/20 text-yellow-400' },
  blacklisted: { label: 'Blacklisted', color: 'bg-red-500/20 text-red-400' },
};

const JOB_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Scheduled', color: 'bg-blue-500/20 text-blue-400' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-500/20 text-yellow-400' },
  completed: { label: 'Completed', color: 'bg-green-500/20 text-green-400' },
  issue: { label: 'Issue', color: 'bg-red-500/20 text-red-400' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500/20 text-gray-400' },
};

// ---------------------------------------------------------------------------
// Stars component
// ---------------------------------------------------------------------------

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const stars = [];
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5';
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Star
        key={i}
        className={`${iconSize} ${i <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
      />
    );
  }
  return <div className="flex items-center gap-0.5">{stars}</div>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SubcontractorsPage() {
  const [subs, setSubs] = useState<Subcontractor[]>([]);
  const [stats, setStats] = useState<SubStats>({ total: 0, active: 0, avgRating: 0, jobsThisMonth: 0, pendingInvoices: 0, expiringInsurance: 0 });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('directory');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [showFilters, setShowFilters] = useState(false);

  // Selected sub for detail view
  const [selectedSub, setSelectedSub] = useState<Subcontractor | null>(null);
  const [detailTab, setDetailTab] = useState<'profile' | 'jobs' | 'documents' | 'compliance'>('profile');

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addForm, setAddForm] = useState({
    companyName: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    specialty: [] as string[],
    licenseNumber: '',
    insuranceExpiry: '',
    hourlyRate: '',
    perSquareRate: '',
    notes: '',
  });

  // Job assignment modal
  const [showJobModal, setShowJobModal] = useState(false);
  const [jobForm, setJobForm] = useState({
    customerName: '',
    address: '',
    scope: '',
    startDate: '',
    endDate: '',
    agreedRate: '',
    rateType: 'flat_rate',
    totalCost: '',
    notes: '',
  });

  // Expanded card
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchSubcontractors = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (specialtyFilter !== 'all') params.set('specialty', specialtyFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchTerm) params.set('search', searchTerm);
      if (sortBy) params.set('sortBy', sortBy);

      const res = await fetch(`/api/subcontractors?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setSubs(data.subcontractors);
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch subcontractors:', err);
    } finally {
      setLoading(false);
    }
  }, [specialtyFilter, statusFilter, searchTerm, sortBy]);

  useEffect(() => {
    fetchSubcontractors();
  }, [fetchSubcontractors]);

  // ---------------------------------------------------------------------------
  // Add subcontractor
  // ---------------------------------------------------------------------------

  const handleAdd = async () => {
    if (!addForm.companyName || !addForm.contactName) return;
    setSaving(true);
    try {
      const res = await fetch('/api/subcontractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...addForm,
          hourlyRate: addForm.hourlyRate ? parseFloat(addForm.hourlyRate) : undefined,
          perSquareRate: addForm.perSquareRate ? parseFloat(addForm.perSquareRate) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setAddForm({
          companyName: '',
          contactName: '',
          phone: '',
          email: '',
          address: '',
          specialty: [],
          licenseNumber: '',
          insuranceExpiry: '',
          hourlyRate: '',
          perSquareRate: '',
          notes: '',
        });
        fetchSubcontractors();
      }
    } catch (err) {
      console.error('Add failed:', err);
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Assign job
  // ---------------------------------------------------------------------------

  const handleAssignJob = async () => {
    if (!selectedSub || !jobForm.customerName || !jobForm.address || !jobForm.scope || !jobForm.startDate) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/subcontractors/${selectedSub.id}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...jobForm,
          agreedRate: jobForm.agreedRate ? parseFloat(jobForm.agreedRate) : 0,
          totalCost: jobForm.totalCost ? parseFloat(jobForm.totalCost) : 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowJobModal(false);
        setJobForm({
          customerName: '',
          address: '',
          scope: '',
          startDate: '',
          endDate: '',
          agreedRate: '',
          rateType: 'flat_rate',
          totalCost: '',
          notes: '',
        });
        // Refresh sub detail
        const detailRes = await fetch(`/api/subcontractors/${selectedSub.id}`);
        const detailData = await detailRes.json();
        if (detailData.success) {
          setSelectedSub(detailData.subcontractor);
        }
        fetchSubcontractors();
      }
    } catch (err) {
      console.error('Assign job failed:', err);
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // View sub detail
  // ---------------------------------------------------------------------------

  const handleViewDetail = async (sub: Subcontractor) => {
    try {
      const res = await fetch(`/api/subcontractors/${sub.id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedSub(data.subcontractor);
        setViewMode('detail');
        setDetailTab('profile');
      }
    } catch (err) {
      console.error('Failed to load details:', err);
    }
  };

  // ---------------------------------------------------------------------------
  // Deactivate
  // ---------------------------------------------------------------------------

  const handleDeactivate = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this subcontractor?')) return;
    try {
      await fetch(`/api/subcontractors/${id}`, { method: 'DELETE' });
      fetchSubcontractors();
      if (selectedSub?.id === id) {
        setViewMode('directory');
        setSelectedSub(null);
      }
    } catch (err) {
      console.error('Deactivate failed:', err);
    }
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const getInsuranceStatus = (expiry?: string) => {
    if (!expiry) return { label: 'Unknown', color: 'text-gray-400', bg: 'bg-gray-500/20' };
    const exp = new Date(expiry);
    const now = new Date();
    const daysUntil = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) return { label: 'Expired', color: 'text-red-400', bg: 'bg-red-500/20' };
    if (daysUntil <= 30) return { label: `Expires in ${daysUntil}d`, color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    return { label: 'Valid', color: 'text-green-400', bg: 'bg-green-500/20' };
  };

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#39FF14]" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Detail View
  // ---------------------------------------------------------------------------

  if (viewMode === 'detail' && selectedSub) {
    const insuranceStatus = getInsuranceStatus(selectedSub.insuranceExpiry);
    const completedJobs = selectedSub.jobHistory.filter((j) => j.status === 'completed');
    const activeJobs = selectedSub.jobHistory.filter(
      (j) => j.status === 'in_progress' || j.status === 'scheduled'
    );
    const totalEarned = completedJobs.reduce((sum, j) => sum + j.totalCost, 0);

    return (
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setViewMode('directory');
                    setSelectedSub(null);
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <Building2 className="w-6 h-6 text-[#39FF14]" />
                <div>
                  <h1 className="text-xl font-bold">{selectedSub.companyName}</h1>
                  <p className="text-sm text-gray-400">{selectedSub.contactName}</p>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    STATUS_CONFIG[selectedSub.status]?.color || 'bg-gray-500/20 text-gray-400'
                  }`}
                >
                  {STATUS_CONFIG[selectedSub.status]?.label || selectedSub.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowJobModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#39FF14]/10 text-[#39FF14] hover:bg-[#39FF14]/20 text-sm font-medium transition-colors"
                >
                  <Briefcase className="w-4 h-4" />
                  Assign Job
                </button>
                {selectedSub.status === 'active' && (
                  <button
                    onClick={() => handleDeactivate(selectedSub.id)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm transition-colors"
                  >
                    Deactivate
                  </button>
                )}
              </div>
            </div>

            {/* Detail Tabs */}
            <div className="flex gap-1 mt-4">
              {(
                [
                  { key: 'profile', label: 'Profile', icon: Building2 },
                  { key: 'jobs', label: `Jobs (${selectedSub.jobHistory.length})`, icon: Briefcase },
                  { key: 'documents', label: 'Documents', icon: FileCheck },
                  { key: 'compliance', label: 'Compliance', icon: Shield },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setDetailTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                    detailTab === tab.key
                      ? 'bg-gray-800 text-[#39FF14] border-t-2 border-[#39FF14]'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-xs text-gray-400 uppercase mb-1">Rating</div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-yellow-400">{selectedSub.rating > 0 ? selectedSub.rating.toFixed(1) : '-'}</span>
                <StarRating rating={selectedSub.rating} size="sm" />
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-xs text-gray-400 uppercase mb-1">Total Earned</div>
              <div className="text-2xl font-bold text-[#39FF14]">${totalEarned.toLocaleString()}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-xs text-gray-400 uppercase mb-1">Completed Jobs</div>
              <div className="text-2xl font-bold">{completedJobs.length}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-xs text-gray-400 uppercase mb-1">Active Jobs</div>
              <div className="text-2xl font-bold text-blue-400">{activeJobs.length}</div>
            </div>
          </div>

          {/* Profile Tab */}
          {detailTab === 'profile' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-4">
                <h3 className="font-semibold text-lg">Contact Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{selectedSub.phone || 'Not provided'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span>{selectedSub.email || 'Not provided'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{selectedSub.address || 'Not provided'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-4">
                <h3 className="font-semibold text-lg">Specialties & Rates</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedSub.specialty.map((sp) => {
                    const meta = SPECIALTIES.find((s) => s.value === sp);
                    return (
                      <span key={sp} className={`px-2.5 py-1 rounded-full text-xs font-medium ${meta?.color || 'bg-gray-500/20 text-gray-400'}`}>
                        {meta?.label || sp}
                      </span>
                    );
                  })}
                </div>
                <div className="space-y-2 text-sm">
                  {selectedSub.hourlyRate !== undefined && selectedSub.hourlyRate > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Hourly Rate</span>
                      <span className="font-medium">${selectedSub.hourlyRate}/hr</span>
                    </div>
                  )}
                  {selectedSub.perSquareRate !== undefined && selectedSub.perSquareRate > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Per Square Rate</span>
                      <span className="font-medium">${selectedSub.perSquareRate}/sq</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-4">
                <h3 className="font-semibold text-lg">Performance Ratings</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Quality</span>
                      <span>{selectedSub.quality > 0 ? selectedSub.quality.toFixed(1) : '-'}/5</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#39FF14] rounded-full transition-all"
                        style={{ width: `${(selectedSub.quality / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Reliability</span>
                      <span>{selectedSub.reliability > 0 ? selectedSub.reliability.toFixed(1) : '-'}/5</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-400 rounded-full transition-all"
                        style={{ width: `${(selectedSub.reliability / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Overall</span>
                      <span>{selectedSub.rating > 0 ? selectedSub.rating.toFixed(1) : '-'}/5</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 rounded-full transition-all"
                        style={{ width: `${(selectedSub.rating / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {selectedSub.notes && (
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                  <h3 className="font-semibold text-lg mb-2">Notes</h3>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{selectedSub.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Jobs Tab */}
          {detailTab === 'jobs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Job History</h3>
                <button
                  onClick={() => setShowJobModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#39FF14]/10 text-[#39FF14] hover:bg-[#39FF14]/20 text-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Assign New Job
                </button>
              </div>

              {selectedSub.jobHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>No jobs assigned yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {[...selectedSub.jobHistory]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((job) => {
                      const jsc = JOB_STATUS_CONFIG[job.status] || { label: job.status, color: 'bg-gray-500/20 text-gray-400' };
                      return (
                        <div key={job.id} className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{job.customerName}</h4>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${jsc.color}`}>
                                  {jsc.label}
                                </span>
                              </div>
                              <p className="text-sm text-gray-400">{job.address}</p>
                              <p className="text-sm text-gray-300 mt-1">{job.scope}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-[#39FF14]">${job.totalCost.toLocaleString()}</div>
                              <div className="text-xs text-gray-400">{job.rateType.replace('_', ' ')}</div>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(job.startDate)}
                              {job.endDate && ` - ${formatDate(job.endDate)}`}
                            </span>
                            {job.qualityRating && (
                              <span className="flex items-center gap-1">
                                <Star className="w-3 h-3 text-yellow-400" />
                                Quality: {job.qualityRating}/5
                              </span>
                            )}
                            {job.timelinessRating && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-blue-400" />
                                Timeliness: {job.timelinessRating}/5
                              </span>
                            )}
                            <span className={job.invoicePaid ? 'text-green-400' : job.invoiceReceived ? 'text-yellow-400' : 'text-gray-500'}>
                              {job.invoicePaid ? 'Paid' : job.invoiceReceived ? 'Invoice Received' : 'No Invoice'}
                            </span>
                          </div>
                          {job.notes && (
                            <p className="mt-2 text-xs text-gray-400 italic">{job.notes}</p>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* Documents Tab */}
          {detailTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Documents</h3>
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors">
                  <Upload className="w-4 h-4" />
                  Upload Document
                </button>
              </div>

              {selectedSub.documents.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileCheck className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>No documents uploaded yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedSub.documents.map((doc, i) => {
                    const docExpiry = doc.expiresAt ? getInsuranceStatus(doc.expiresAt) : null;
                    return (
                      <div key={i} className="bg-gray-800 rounded-lg border border-gray-700 p-4 flex items-center gap-4">
                        <FileCheck className="w-8 h-8 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.name}</p>
                          <p className="text-xs text-gray-400">{doc.type}</p>
                          {docExpiry && (
                            <span className={`text-xs ${docExpiry.color}`}>{docExpiry.label}</span>
                          )}
                        </div>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#39FF14] hover:text-[#39FF14]/80 text-sm"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Compliance Tab */}
          {detailTab === 'compliance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-400" />
                    Insurance Status
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Status</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${insuranceStatus.bg} ${insuranceStatus.color}`}>
                        {insuranceStatus.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Expiry Date</span>
                      <span>{selectedSub.insuranceExpiry ? formatDate(selectedSub.insuranceExpiry) : 'Not set'}</span>
                    </div>
                  </div>
                  {insuranceStatus.label === 'Expired' && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      Insurance has expired. Do not assign new jobs until renewed.
                    </div>
                  )}
                  {insuranceStatus.label.startsWith('Expires') && (
                    <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-2 text-yellow-400 text-sm">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      Insurance expiring soon. Request renewal documentation.
                    </div>
                  )}
                </div>

                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-green-400" />
                    License Verification
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">License Number</span>
                      <span>{selectedSub.licenseNumber || 'Not provided'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Verification</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${selectedSub.licenseNumber ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {selectedSub.licenseNumber ? 'On File' : 'Missing'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Document expiry alerts */}
              {selectedSub.documents.filter((d) => d.expiresAt).length > 0 && (
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    Document Expiry Alerts
                  </h3>
                  <div className="space-y-2">
                    {selectedSub.documents
                      .filter((d) => d.expiresAt)
                      .map((doc, i) => {
                        const status = getInsuranceStatus(doc.expiresAt);
                        return (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-900">
                            <span className="text-sm">{doc.name}</span>
                            <span className={`text-xs ${status.color}`}>
                              {doc.expiresAt ? formatDate(doc.expiresAt) : ''} - {status.label}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Job Assignment Modal */}
        {showJobModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg max-h-[80vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800">
                <h3 className="font-semibold text-lg">Assign Job to {selectedSub.companyName}</h3>
                <button onClick={() => setShowJobModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    value={jobForm.customerName}
                    onChange={(e) => setJobForm({ ...jobForm, customerName: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-[#39FF14] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Address *</label>
                  <input
                    type="text"
                    value={jobForm.address}
                    onChange={(e) => setJobForm({ ...jobForm, address: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-[#39FF14] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Scope of Work *</label>
                  <textarea
                    value={jobForm.scope}
                    onChange={(e) => setJobForm({ ...jobForm, scope: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-[#39FF14] focus:outline-none resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Start Date *</label>
                    <input
                      type="date"
                      value={jobForm.startDate}
                      onChange={(e) => setJobForm({ ...jobForm, startDate: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-[#39FF14] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">End Date</label>
                    <input
                      type="date"
                      value={jobForm.endDate}
                      onChange={(e) => setJobForm({ ...jobForm, endDate: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-[#39FF14] focus:outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Rate Type</label>
                    <select
                      value={jobForm.rateType}
                      onChange={(e) => setJobForm({ ...jobForm, rateType: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-[#39FF14] focus:outline-none"
                    >
                      <option value="flat_rate">Flat Rate</option>
                      <option value="hourly">Hourly</option>
                      <option value="per_square">Per Square</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Agreed Rate ($)</label>
                    <input
                      type="number"
                      value={jobForm.agreedRate}
                      onChange={(e) => setJobForm({ ...jobForm, agreedRate: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-[#39FF14] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Total Cost ($)</label>
                    <input
                      type="number"
                      value={jobForm.totalCost}
                      onChange={(e) => setJobForm({ ...jobForm, totalCost: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-[#39FF14] focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                  <textarea
                    value={jobForm.notes}
                    onChange={(e) => setJobForm({ ...jobForm, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-[#39FF14] focus:outline-none resize-none"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-gray-700 flex justify-end gap-3 sticky bottom-0 bg-gray-800">
                <button
                  onClick={() => setShowJobModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignJob}
                  disabled={saving || !jobForm.customerName || !jobForm.address || !jobForm.scope || !jobForm.startDate}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#39FF14] text-black font-medium text-sm hover:bg-[#39FF14]/90 transition-colors disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Briefcase className="w-4 h-4" />}
                  Assign Job
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Directory View
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/portal" className="text-gray-400 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <HardHat className="w-6 h-6 text-[#39FF14]" />
              <div>
                <h1 className="text-xl font-bold">Subcontractor Management</h1>
                <p className="text-sm text-gray-400">Directory, job assignment, and compliance tracking</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#39FF14] text-black font-medium text-sm hover:bg-[#39FF14]/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Subcontractor
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Dashboard Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-xs text-gray-400 uppercase mb-1">
              <Users className="w-3.5 h-3.5" />
              Total
            </div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-xs text-gray-400 uppercase mb-1">
              <CheckCircle className="w-3.5 h-3.5 text-green-400" />
              Active
            </div>
            <div className="text-2xl font-bold text-green-400">{stats.active}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-xs text-gray-400 uppercase mb-1">
              <Star className="w-3.5 h-3.5 text-yellow-400" />
              Avg Rating
            </div>
            <div className="text-2xl font-bold text-yellow-400">{stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '-'}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-xs text-gray-400 uppercase mb-1">
              <Briefcase className="w-3.5 h-3.5 text-blue-400" />
              Jobs/Month
            </div>
            <div className="text-2xl font-bold text-blue-400">{stats.jobsThisMonth}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-xs text-gray-400 uppercase mb-1">
              <DollarSign className="w-3.5 h-3.5 text-[#39FF14]" />
              Pending $
            </div>
            <div className="text-2xl font-bold text-[#39FF14]">{stats.pendingInvoices}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-xs text-gray-400 uppercase mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
              Exp. Insurance
            </div>
            <div className={`text-2xl font-bold ${stats.expiringInsurance > 0 ? 'text-yellow-400' : 'text-gray-400'}`}>
              {stats.expiringInsurance}
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, phone, specialty..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#39FF14] focus:outline-none"
            />
          </div>
          <select
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
            className="px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-[#39FF14] focus:outline-none"
          >
            <option value="all">All Specialties</option>
            {SPECIALTIES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-[#39FF14] focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="probation">Probation</option>
            <option value="blacklisted">Blacklisted</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-[#39FF14] focus:outline-none"
          >
            <option value="name">Sort: Name</option>
            <option value="rating">Sort: Rating</option>
            <option value="reliability">Sort: Reliability</option>
            <option value="recent">Sort: Recent</option>
          </select>
        </div>

        {/* Subcontractor Cards */}
        {subs.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <HardHat className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No subcontractors found</p>
            <p className="text-sm mt-1">
              {searchTerm || specialtyFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Add your first subcontractor to get started'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subs.map((sub) => {
              const insStatus = getInsuranceStatus(sub.insuranceExpiry);
              const isExpanded = expandedId === sub.id;

              return (
                <div
                  key={sub.id}
                  className="bg-gray-800 rounded-xl border border-gray-700 hover:border-gray-600 transition-all overflow-hidden"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate">{sub.companyName}</h3>
                        <p className="text-sm text-gray-400">{sub.contactName}</p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                          STATUS_CONFIG[sub.status]?.color || 'bg-gray-500/20 text-gray-400'
                        }`}
                      >
                        {STATUS_CONFIG[sub.status]?.label || sub.status}
                      </span>
                    </div>

                    {/* Rating */}
                    <div className="flex items-center gap-2 mb-3">
                      <StarRating rating={sub.rating} />
                      {sub.rating > 0 && (
                        <span className="text-sm text-gray-400">{sub.rating.toFixed(1)}</span>
                      )}
                    </div>

                    {/* Specialties */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {sub.specialty.slice(0, 4).map((sp) => {
                        const meta = SPECIALTIES.find((s) => s.value === sp);
                        return (
                          <span key={sp} className={`px-2 py-0.5 rounded-full text-xs ${meta?.color || 'bg-gray-500/20 text-gray-400'}`}>
                            {meta?.label || sp}
                          </span>
                        );
                      })}
                      {sub.specialty.length > 4 && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-gray-600/20 text-gray-400">
                          +{sub.specialty.length - 4}
                        </span>
                      )}
                    </div>

                    {/* Contact info */}
                    <div className="text-xs text-gray-400 space-y-1 mb-3">
                      {sub.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3" />
                          {sub.phone}
                        </div>
                      )}
                      {sub.email && (
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          {sub.email}
                        </div>
                      )}
                    </div>

                    {/* Insurance status */}
                    {sub.insuranceExpiry && (
                      <div className={`flex items-center gap-1.5 text-xs ${insStatus.color}`}>
                        <Shield className="w-3 h-3" />
                        Insurance: {insStatus.label}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="border-t border-gray-700 px-5 py-3 flex items-center justify-between bg-gray-800/50">
                    <span className="text-xs text-gray-500">
                      {sub.jobHistory.length} job{sub.jobHistory.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => handleViewDetail(sub)}
                      className="flex items-center gap-1.5 text-[#39FF14] hover:text-[#39FF14]/80 text-sm font-medium transition-colors"
                    >
                      View Details
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Subcontractor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800 z-10">
              <h3 className="font-semibold text-lg">Add New Subcontractor</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Company Name *</label>
                  <input
                    type="text"
                    value={addForm.companyName}
                    onChange={(e) => setAddForm({ ...addForm, companyName: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-[#39FF14] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Contact Name *</label>
                  <input
                    type="text"
                    value={addForm.contactName}
                    onChange={(e) => setAddForm({ ...addForm, contactName: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-[#39FF14] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-[#39FF14] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-[#39FF14] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Address</label>
                <input
                  type="text"
                  value={addForm.address}
                  onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-[#39FF14] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Specialties</label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALTIES.map((sp) => {
                    const isSelected = addForm.specialty.includes(sp.value);
                    return (
                      <button
                        key={sp.value}
                        type="button"
                        onClick={() => {
                          const newSpec = isSelected
                            ? addForm.specialty.filter((s) => s !== sp.value)
                            : [...addForm.specialty, sp.value];
                          setAddForm({ ...addForm, specialty: newSpec });
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          isSelected
                            ? sp.color + ' ring-1 ring-current'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}
                      >
                        {sp.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">License Number</label>
                  <input
                    type="text"
                    value={addForm.licenseNumber}
                    onChange={(e) => setAddForm({ ...addForm, licenseNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-[#39FF14] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Insurance Expiry</label>
                  <input
                    type="date"
                    value={addForm.insuranceExpiry}
                    onChange={(e) => setAddForm({ ...addForm, insuranceExpiry: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-[#39FF14] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Hourly Rate ($)</label>
                  <input
                    type="number"
                    value={addForm.hourlyRate}
                    onChange={(e) => setAddForm({ ...addForm, hourlyRate: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-[#39FF14] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Per Square Rate ($)</label>
                  <input
                    type="number"
                    value={addForm.perSquareRate}
                    onChange={(e) => setAddForm({ ...addForm, perSquareRate: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-[#39FF14] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                <textarea
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-[#39FF14] focus:outline-none resize-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-700 flex justify-end gap-3 sticky bottom-0 bg-gray-800">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={saving || !addForm.companyName || !addForm.contactName}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#39FF14] text-black font-medium text-sm hover:bg-[#39FF14]/90 transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Subcontractor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
