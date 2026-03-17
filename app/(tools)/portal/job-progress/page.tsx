'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Camera,
  Image,
  ImagePlus,
  Upload,
  Star,
  CheckCircle,
  Clock,
  Calendar,
  User,
  MapPin,
  Truck,
  Hammer,
  Home,
  Sun,
  CloudRain,
  Users,
  Eye,
  EyeOff,
  Share2,
  Link as LinkIcon,
  Filter,
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Flag,
  ArrowLeft,
  X,
  Send,
  Loader2,
  BarChart2,
  ExternalLink,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

type JobPhase =
  | 'pre_inspection' | 'inspection' | 'estimate' | 'contract_signed'
  | 'material_ordered' | 'material_delivered' | 'tear_off'
  | 'install_day1' | 'install_day2' | 'install_day3'
  | 'cleanup' | 'final_inspection' | 'completed' | 'warranty_registered';

interface JobPhoto {
  id: string;
  url: string;
  caption: string;
  category: string;
  uploadedBy: string;
  uploadedAt: string;
  isCustomerVisible: boolean;
}

interface JobProgressEntry {
  id: string;
  jobId: string;
  jobNimbusId?: string;
  customerName: string;
  address: string;
  phase: JobPhase;
  photos: JobPhoto[];
  notes: string;
  weather?: string;
  crewMembers?: string[];
  completedBy: string;
  completedByName: string;
  completedAt: string;
  customerNotified: boolean;
  customerViewedAt?: string;
}

interface JobTimeline {
  jobId: string;
  customerName: string;
  address: string;
  status: string;
  startDate: string;
  completionDate?: string;
  entries: JobProgressEntry[];
  totalPhotos: number;
  completionPercentage: number;
  assignedRep: string;
  shareToken?: string;
}

interface ProgressStats {
  inProgress: number;
  completedThisMonth: number;
  avgDaysToComplete: number;
  totalPhotos: number;
  byPhase: Record<string, number>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PHASE_ORDER: JobPhase[] = [
  'pre_inspection', 'inspection', 'estimate', 'contract_signed',
  'material_ordered', 'material_delivered', 'tear_off',
  'install_day1', 'install_day2', 'install_day3',
  'cleanup', 'final_inspection', 'completed', 'warranty_registered',
];

const PHASE_LABELS: Record<JobPhase, string> = {
  pre_inspection: 'Pre-Inspection',
  inspection: 'Inspection',
  estimate: 'Estimate',
  contract_signed: 'Contract Signed',
  material_ordered: 'Material Ordered',
  material_delivered: 'Material Delivered',
  tear_off: 'Tear Off',
  install_day1: 'Install Day 1',
  install_day2: 'Install Day 2',
  install_day3: 'Install Day 3',
  cleanup: 'Cleanup',
  final_inspection: 'Final Inspection',
  completed: 'Completed',
  warranty_registered: 'Warranty Registered',
};

const PHASE_ICONS: Record<string, React.ReactNode> = {
  pre_inspection: <Search className="w-4 h-4" />,
  inspection: <Eye className="w-4 h-4" />,
  estimate: <BarChart2 className="w-4 h-4" />,
  contract_signed: <CheckCircle className="w-4 h-4" />,
  material_ordered: <Truck className="w-4 h-4" />,
  material_delivered: <Truck className="w-4 h-4" />,
  tear_off: <Hammer className="w-4 h-4" />,
  install_day1: <Hammer className="w-4 h-4" />,
  install_day2: <Hammer className="w-4 h-4" />,
  install_day3: <Hammer className="w-4 h-4" />,
  cleanup: <Home className="w-4 h-4" />,
  final_inspection: <Eye className="w-4 h-4" />,
  completed: <CheckCircle className="w-4 h-4" />,
  warranty_registered: <Flag className="w-4 h-4" />,
};

const PHOTO_CATEGORIES = [
  { value: 'before', label: 'Before' },
  { value: 'during', label: 'During' },
  { value: 'after', label: 'After' },
  { value: 'damage', label: 'Damage' },
  { value: 'material', label: 'Material' },
  { value: 'detail', label: 'Detail' },
  { value: 'crew', label: 'Crew' },
  { value: 'drone', label: 'Drone' },
];

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function daysInPhase(entry: JobProgressEntry): number {
  const now = new Date();
  const completedAt = new Date(entry.completedAt);
  return Math.floor((now.getTime() - completedAt.getTime()) / (1000 * 60 * 60 * 24));
}

function getPhaseColor(phase: JobPhase): string {
  const idx = PHASE_ORDER.indexOf(phase);
  if (idx <= 3) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  if (idx <= 5) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  if (idx <= 9) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
  if (idx <= 11) return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
  return 'bg-green-500/20 text-green-400 border-green-500/30';
}

function getStatusColor(days: number): string {
  if (days <= 3) return 'border-l-green-500';
  if (days <= 7) return 'border-l-yellow-500';
  return 'border-l-red-500';
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function JobProgressPage() {
  const [timelines, setTimelines] = useState<JobTimeline[]>([]);
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<JobTimeline | null>(null);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<JobPhoto | null>(null);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');

  // New entry form state
  const [entryForm, setEntryForm] = useState({
    jobId: '',
    phase: '' as JobPhase | '',
    notes: '',
    customerName: '',
    address: '',
    completedBy: '',
    completedByName: '',
    weather: '',
    crewMembers: '',
    photoUrls: '',
    photoCategory: 'during',
    photoCaptions: '',
    customerVisible: true,
  });

  // -------------------------------------------------------------------------
  // DATA LOADING
  // -------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (phaseFilter !== 'all') params.set('phase', phaseFilter);

      const res = await fetch(`/api/job-progress?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setTimelines(data.timelines || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error('Failed to fetch job progress:', error);
    } finally {
      setLoading(false);
    }
  }, [phaseFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -------------------------------------------------------------------------
  // ACTIONS
  // -------------------------------------------------------------------------

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryForm.jobId || !entryForm.phase || !entryForm.notes) return;

    setSubmitting(true);
    try {
      // Build photos array from URLs
      const photoUrlList = entryForm.photoUrls.split('\n').filter(u => u.trim());
      const captionList = entryForm.photoCaptions.split('\n');
      const photos = photoUrlList.map((url, i) => ({
        url: url.trim(),
        caption: (captionList[i] || '').trim(),
        category: entryForm.photoCategory,
        uploadedBy: entryForm.completedBy || 'admin',
        isCustomerVisible: entryForm.customerVisible,
      }));

      const res = await fetch('/api/job-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: entryForm.jobId,
          phase: entryForm.phase,
          notes: entryForm.notes,
          customerName: entryForm.customerName,
          address: entryForm.address,
          completedBy: entryForm.completedBy || 'admin',
          completedByName: entryForm.completedByName || entryForm.completedBy || 'Admin',
          weather: entryForm.weather || undefined,
          crewMembers: entryForm.crewMembers ? entryForm.crewMembers.split(',').map(s => s.trim()) : undefined,
          photos: photos.length > 0 ? photos : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowNewEntry(false);
        setShowQuickEntry(false);
        setEntryForm({
          jobId: '', phase: '', notes: '', customerName: '', address: '',
          completedBy: '', completedByName: '', weather: '', crewMembers: '',
          photoUrls: '', photoCategory: 'during', photoCaptions: '', customerVisible: true,
        });
        await fetchData();
        // Reload selected job if it matches
        if (selectedJob && selectedJob.jobId === entryForm.jobId) {
          const jobRes = await fetch(`/api/job-progress/${entryForm.jobId}`);
          const jobData = await jobRes.json();
          if (jobData.success) setSelectedJob(jobData.timeline);
        }
      }
    } catch (error) {
      console.error('Failed to add entry:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleShareTimeline = async (jobId: string) => {
    try {
      const res = await fetch(`/api/job-progress/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'share' }),
      });
      const data = await res.json();
      if (data.success) {
        const fullUrl = `${window.location.origin}${data.url}`;
        setShareUrl(fullUrl);
        await navigator.clipboard.writeText(fullUrl).catch(() => {});
      }
    } catch (error) {
      console.error('Failed to share timeline:', error);
    }
  };

  const handleNotifyCustomer = async (jobId: string, entryId: string) => {
    try {
      await fetch(`/api/job-progress/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'notify', entryId }),
      });
      // Refresh the selected job
      const res = await fetch(`/api/job-progress/${jobId}`);
      const data = await res.json();
      if (data.success) setSelectedJob(data.timeline);
    } catch (error) {
      console.error('Failed to notify customer:', error);
    }
  };

  const openJobDetail = async (jobId: string) => {
    try {
      const res = await fetch(`/api/job-progress/${jobId}`);
      const data = await res.json();
      if (data.success) {
        setSelectedJob(data.timeline);
      }
    } catch (error) {
      console.error('Failed to load job detail:', error);
    }
  };

  // -------------------------------------------------------------------------
  // FILTER
  // -------------------------------------------------------------------------

  const filteredTimelines = timelines.filter(t => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      t.customerName.toLowerCase().includes(term) ||
      t.address.toLowerCase().includes(term) ||
      t.jobId.toLowerCase().includes(term) ||
      t.assignedRep.toLowerCase().includes(term)
    );
  });

  // Group timelines by current phase for board view
  const boardColumns = PHASE_ORDER.map(phase => ({
    phase,
    label: PHASE_LABELS[phase],
    jobs: filteredTimelines.filter(t => {
      if (t.entries.length === 0) return phase === 'pre_inspection';
      return t.entries[t.entries.length - 1]?.phase === phase;
    }),
  })).filter(col => col.jobs.length > 0 || phaseFilter === 'all');

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#39FF14] animate-spin" />
      </div>
    );
  }

  // JOB DETAIL VIEW
  if (selectedJob) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => { setSelectedJob(null); setShareUrl(''); }}
            className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{selectedJob.customerName}</h1>
            <p className="text-gray-400 flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {selectedJob.address}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleShareTimeline(selectedJob.jobId)}
              className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition flex items-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              Share Timeline
            </button>
            <button
              onClick={() => {
                setShowNewEntry(true);
                setEntryForm(prev => ({
                  ...prev,
                  jobId: selectedJob.jobId,
                  customerName: selectedJob.customerName,
                  address: selectedJob.address,
                  completedBy: selectedJob.assignedRep,
                }));
              }}
              className="px-4 py-2 bg-[#39FF14] text-black rounded-lg hover:bg-[#32e612] transition font-semibold flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Update
            </button>
          </div>
        </div>

        {/* Share URL */}
        {shareUrl && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-500/30 rounded-lg flex items-center gap-3">
            <LinkIcon className="w-4 h-4 text-green-400" />
            <span className="text-green-400 text-sm">Share link copied to clipboard:</span>
            <code className="text-xs text-green-300 flex-1 truncate">{shareUrl}</code>
            <button onClick={() => setShareUrl('')} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Progress Bar */}
        <div className="mb-6 bg-gray-800 rounded-xl p-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-400">Progress</span>
            <span className="text-sm font-semibold text-[#39FF14]">{selectedJob.completionPercentage}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className="bg-[#39FF14] h-3 rounded-full transition-all duration-500"
              style={{ width: `${selectedJob.completionPercentage}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>Started {formatDate(selectedJob.startDate)}</span>
            <span>{selectedJob.totalPhotos} photos</span>
            {selectedJob.completionDate && <span>Completed {formatDate(selectedJob.completionDate)}</span>}
          </div>
        </div>

        {/* Timeline Entries */}
        <div className="space-y-4">
          {selectedJob.entries.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No progress entries yet. Add the first update!</p>
            </div>
          ) : (
            selectedJob.entries.map((entry, idx) => (
              <div key={entry.id} className="relative">
                {/* Timeline connector */}
                {idx < selectedJob.entries.length - 1 && (
                  <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-gray-700" />
                )}

                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  {/* Entry header */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2 rounded-lg border ${getPhaseColor(entry.phase)}`}>
                      {PHASE_ICONS[entry.phase] || <CheckCircle className="w-4 h-4" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getPhaseColor(entry.phase)}`}>
                          {PHASE_LABELS[entry.phase]}
                        </span>
                        {entry.customerNotified && (
                          <span className="text-xs text-green-400 flex items-center gap-1">
                            <Send className="w-3 h-3" /> Notified
                          </span>
                        )}
                        {entry.customerViewedAt && (
                          <span className="text-xs text-blue-400 flex items-center gap-1">
                            <Eye className="w-3 h-3" /> Viewed
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDateTime(entry.completedAt)} by {entry.completedByName}
                      </p>
                    </div>
                    {!entry.customerNotified && (
                      <button
                        onClick={() => handleNotifyCustomer(selectedJob.jobId, entry.id)}
                        className="px-3 py-1.5 text-xs bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" /> Notify
                      </button>
                    )}
                  </div>

                  {/* Notes */}
                  <p className="text-gray-300 text-sm mb-3">{entry.notes}</p>

                  {/* Metadata */}
                  <div className="flex flex-wrap gap-3 mb-3 text-xs text-gray-400">
                    {entry.weather && (
                      <span className="flex items-center gap-1">
                        {entry.weather.toLowerCase().includes('rain') ? <CloudRain className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
                        {entry.weather}
                      </span>
                    )}
                    {entry.crewMembers && entry.crewMembers.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {entry.crewMembers.join(', ')}
                      </span>
                    )}
                  </div>

                  {/* Photos grid */}
                  {entry.photos.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {entry.photos.map(photo => (
                        <div
                          key={photo.id}
                          className="relative group cursor-pointer rounded-lg overflow-hidden bg-gray-700 aspect-square"
                          onClick={() => setLightboxPhoto(photo)}
                        >
                          <img
                            src={photo.url}
                            alt={photo.caption || 'Job photo'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23374151" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%236B7280" font-size="12">No Image</text></svg>';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-end p-2">
                            <span className="text-xs text-white">{photo.caption || photo.category}</span>
                          </div>
                          <div className="absolute top-1 right-1">
                            {photo.isCustomerVisible ? (
                              <Eye className="w-3 h-3 text-green-400" />
                            ) : (
                              <EyeOff className="w-3 h-3 text-gray-500" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Lightbox */}
        {lightboxPhoto && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightboxPhoto(null)}
          >
            <div className="max-w-4xl max-h-[90vh] relative" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setLightboxPhoto(null)}
                className="absolute -top-10 right-0 text-white hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.caption || 'Photo'}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
              <div className="mt-2 text-center">
                <p className="text-white">{lightboxPhoto.caption}</p>
                <p className="text-gray-400 text-sm">
                  {lightboxPhoto.category} - {formatDateTime(lightboxPhoto.uploadedAt)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Add Entry Modal */}
        {showNewEntry && (
          <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Add Progress Update</h2>
                <button onClick={() => setShowNewEntry(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddEntry} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Phase</label>
                  <select
                    value={entryForm.phase}
                    onChange={e => setEntryForm(prev => ({ ...prev, phase: e.target.value as JobPhase }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white"
                    required
                  >
                    <option value="">Select phase...</option>
                    {PHASE_ORDER.map(p => (
                      <option key={p} value={p}>{PHASE_LABELS[p]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Notes</label>
                  <textarea
                    value={entryForm.notes}
                    onChange={e => setEntryForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white min-h-[80px]"
                    placeholder="Describe what was done..."
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Weather</label>
                    <input
                      type="text"
                      value={entryForm.weather}
                      onChange={e => setEntryForm(prev => ({ ...prev, weather: e.target.value }))}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white"
                      placeholder="e.g., Sunny, 75F"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Crew Members</label>
                    <input
                      type="text"
                      value={entryForm.crewMembers}
                      onChange={e => setEntryForm(prev => ({ ...prev, crewMembers: e.target.value }))}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white"
                      placeholder="Names, comma separated"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Completed By (slug)</label>
                  <input
                    type="text"
                    value={entryForm.completedBy}
                    onChange={e => setEntryForm(prev => ({ ...prev, completedBy: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white"
                    placeholder="e.g., john-doe"
                  />
                </div>

                {/* Photos Section */}
                <div className="border border-gray-600 rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-[#39FF14]" />
                    Photos
                  </h3>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Category</label>
                      <select
                        value={entryForm.photoCategory}
                        onChange={e => setEntryForm(prev => ({ ...prev, photoCategory: e.target.value }))}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white text-sm"
                      >
                        {PHOTO_CATEGORIES.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={entryForm.customerVisible}
                          onChange={e => setEntryForm(prev => ({ ...prev, customerVisible: e.target.checked }))}
                          className="rounded bg-gray-700 border-gray-600"
                        />
                        Customer visible
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Photo URLs (one per line)</label>
                    <textarea
                      value={entryForm.photoUrls}
                      onChange={e => setEntryForm(prev => ({ ...prev, photoUrls: e.target.value }))}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white text-sm min-h-[60px]"
                      placeholder="https://example.com/photo1.jpg&#10;https://example.com/photo2.jpg"
                    />
                  </div>

                  <div className="mt-2">
                    <label className="block text-sm text-gray-400 mb-1">Captions (one per line, matching URLs)</label>
                    <textarea
                      value={entryForm.photoCaptions}
                      onChange={e => setEntryForm(prev => ({ ...prev, photoCaptions: e.target.value }))}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white text-sm min-h-[60px]"
                      placeholder="Front of house before work&#10;Damaged shingles detail"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewEntry(false)}
                    className="flex-1 px-4 py-2.5 bg-gray-700 rounded-lg hover:bg-gray-600 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-[#39FF14] text-black rounded-lg hover:bg-[#32e612] transition font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {submitting ? 'Saving...' : 'Add Entry'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // MAIN VIEW - Board / List
  // =========================================================================

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/portal" className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold">Job Progress Tracker</h1>
          </div>
          <p className="text-gray-400 text-sm ml-8">Track jobs through every phase with photos and updates</p>
        </div>
        <button
          onClick={() => setShowQuickEntry(true)}
          className="px-4 py-2.5 bg-[#39FF14] text-black rounded-lg hover:bg-[#32e612] transition font-semibold flex items-center gap-2 self-start"
        >
          <Camera className="w-4 h-4" />
          Quick Entry
        </button>
      </div>

      {/* Stats Dashboard */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-2xl font-bold text-[#39FF14]">{stats.inProgress}</div>
            <div className="text-sm text-gray-400">In Progress</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-2xl font-bold text-blue-400">{stats.completedThisMonth}</div>
            <div className="text-sm text-gray-400">Completed This Month</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-2xl font-bold text-yellow-400">{stats.avgDaysToComplete || '--'}</div>
            <div className="text-sm text-gray-400">Avg Days to Complete</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-2xl font-bold text-purple-400">{stats.totalPhotos}</div>
            <div className="text-sm text-gray-400">Total Photos</div>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search jobs by name, address, ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-500"
          />
        </div>

        <select
          value={phaseFilter}
          onChange={e => setPhaseFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white"
        >
          <option value="all">All Phases</option>
          {PHASE_ORDER.map(p => (
            <option key={p} value={p}>{PHASE_LABELS[p]}</option>
          ))}
        </select>

        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          <button
            onClick={() => setViewMode('board')}
            className={`px-3 py-2.5 text-sm ${viewMode === 'board' ? 'bg-[#39FF14] text-black' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            Board
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2.5 text-sm ${viewMode === 'list' ? 'bg-[#39FF14] text-black' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            List
          </button>
        </div>
      </div>

      {/* Board View */}
      {viewMode === 'board' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {boardColumns.map(col => (
              <div key={col.phase} className="w-72 flex-shrink-0">
                <div className="bg-gray-800 rounded-t-lg p-3 border border-gray-700 border-b-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getPhaseColor(col.phase)}`}>
                        {col.label}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded-full">
                      {col.jobs.length}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 bg-gray-850 p-2 border border-gray-700 border-t-0 rounded-b-lg min-h-[100px]">
                  {col.jobs.length === 0 ? (
                    <div className="text-center py-6 text-gray-600 text-sm">No jobs</div>
                  ) : (
                    col.jobs.map(job => {
                      const lastEntry = job.entries[job.entries.length - 1];
                      const days = lastEntry ? daysInPhase(lastEntry) : 0;

                      return (
                        <div
                          key={job.jobId}
                          onClick={() => openJobDetail(job.jobId)}
                          className={`bg-gray-800 rounded-lg p-3 border border-gray-700 hover:border-[#39FF14]/40 transition cursor-pointer border-l-4 ${getStatusColor(days)}`}
                        >
                          <div className="font-semibold text-sm truncate">{job.customerName}</div>
                          <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">{job.address}</span>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {job.assignedRep}
                            </span>
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Camera className="w-3 h-3" />
                              {job.totalPhotos}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className={`text-xs ${days <= 3 ? 'text-green-400' : days <= 7 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {days === 0 ? 'Today' : `${days}d in phase`}
                            </span>
                            <div className="w-16 bg-gray-700 rounded-full h-1.5">
                              <div
                                className="bg-[#39FF14] h-1.5 rounded-full"
                                style={{ width: `${job.completionPercentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-2">
          {filteredTimelines.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Hammer className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg">No jobs found</p>
              <p className="text-sm mt-1">Add a progress entry to get started</p>
            </div>
          ) : (
            filteredTimelines.map(job => {
              const lastEntry = job.entries[job.entries.length - 1];
              const currentPhase = lastEntry?.phase || 'pre_inspection';
              const days = lastEntry ? daysInPhase(lastEntry) : 0;

              return (
                <div
                  key={job.jobId}
                  onClick={() => openJobDetail(job.jobId)}
                  className={`bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-[#39FF14]/40 transition cursor-pointer border-l-4 ${getStatusColor(days)}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold truncate">{job.customerName}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold border whitespace-nowrap ${getPhaseColor(currentPhase)}`}>
                          {PHASE_LABELS[currentPhase]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{job.address}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-6 ml-4">
                      <div className="text-center hidden sm:block">
                        <div className="text-xs text-gray-500">Rep</div>
                        <div className="text-sm">{job.assignedRep}</div>
                      </div>
                      <div className="text-center hidden sm:block">
                        <div className="text-xs text-gray-500">Photos</div>
                        <div className="text-sm flex items-center gap-1">
                          <Camera className="w-3 h-3" /> {job.totalPhotos}
                        </div>
                      </div>
                      <div className="text-center hidden sm:block">
                        <div className="text-xs text-gray-500">Progress</div>
                        <div className="text-sm text-[#39FF14]">{job.completionPercentage}%</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Quick Entry FAB Modal */}
      {showQuickEntry && (
        <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#39FF14]" />
                Quick Progress Update
              </h2>
              <button onClick={() => setShowQuickEntry(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEntry} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Job ID</label>
                  <input
                    type="text"
                    value={entryForm.jobId}
                    onChange={e => setEntryForm(prev => ({ ...prev, jobId: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white"
                    placeholder="JOB-001"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Phase</label>
                  <select
                    value={entryForm.phase}
                    onChange={e => setEntryForm(prev => ({ ...prev, phase: e.target.value as JobPhase }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white"
                    required
                  >
                    <option value="">Select...</option>
                    {PHASE_ORDER.map(p => (
                      <option key={p} value={p}>{PHASE_LABELS[p]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={entryForm.customerName}
                    onChange={e => setEntryForm(prev => ({ ...prev, customerName: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white"
                    placeholder="John Smith"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Address</label>
                  <input
                    type="text"
                    value={entryForm.address}
                    onChange={e => setEntryForm(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white"
                    placeholder="123 Main St"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <textarea
                  value={entryForm.notes}
                  onChange={e => setEntryForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white min-h-[80px]"
                  placeholder="What was done at this phase?"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Completed By</label>
                  <input
                    type="text"
                    value={entryForm.completedBy}
                    onChange={e => setEntryForm(prev => ({ ...prev, completedBy: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white"
                    placeholder="rep-slug"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Weather</label>
                  <input
                    type="text"
                    value={entryForm.weather}
                    onChange={e => setEntryForm(prev => ({ ...prev, weather: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white"
                    placeholder="Sunny, 75F"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Photo URLs (one per line)</label>
                <textarea
                  value={entryForm.photoUrls}
                  onChange={e => setEntryForm(prev => ({ ...prev, photoUrls: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white min-h-[60px] text-sm"
                  placeholder="https://example.com/photo.jpg"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowQuickEntry(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-700 rounded-lg hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-[#39FF14] text-black rounded-lg hover:bg-[#32e612] transition font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {submitting ? 'Saving...' : 'Save Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
