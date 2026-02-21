'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  LayoutDashboard,
  Plus,
  ClipboardList,
  GitCompare,
  Package,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Truck,
  Users,
  Wrench,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  Calendar,
  Hammer,
  Building2,
  Shield,
  Droplets,
  Layers,
  Trash2,
  RefreshCw,
  Printer,
  TrendingUp,
  CircleDot,
  Circle,
  Check,
  X,
  Edit3,
  Eye,
  Download,
  Loader2,
  ExternalLink,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type ProjectType = 'roof_replacement' | 'roof_repair' | 'gutter_install' | 'siding' | 'commercial' | 'insurance_claim';
type BreakdownStatus = 'draft' | 'pending_approval' | 'approved' | 'in_progress' | 'completed' | 'revised';

interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

interface MaterialItem {
  category: string;
  productName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  supplier: string;
  leadTime: string;
  inStock: boolean;
}

interface LaborItem {
  role: string;
  hours: number;
  rate: number;
  totalCost: number;
  assignedTo: string;
}

interface DeliveryItem {
  deliveryId: string;
  scheduledDate: string;
  materials: string[];
  status: string;
  driver: string;
}

interface StatusHistoryEntry {
  status: string;
  timestamp: string;
  updatedBy: string;
  notes: string;
}

interface JobBreakdown {
  breakdownId: string;
  jobId: string;
  jobName: string;
  customerName: string;
  address: Address;
  projectType: ProjectType;
  status: BreakdownStatus;
  materials: MaterialItem[];
  labor: LaborItem[];
  deliveries: DeliveryItem[];
  materialTotal: number;
  laborTotal: number;
  deliveryFees: number;
  overhead: number;
  profit: number;
  totalEstimate: number;
  estimatedStartDate: string;
  estimatedEndDate: string;
  actualStartDate?: string;
  actualEndDate?: string;
  statusHistory: StatusHistoryEntry[];
  notes: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  approvedBy?: string;
}

interface BreakdownComparison {
  field: string;
  category: string;
  original: string;
  revised: string;
  difference: string;
}

interface Stats {
  total: number;
  pendingApproval: number;
  activeJobs: number;
  totalValue: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  monthlyValues: { month: string; value: number }[];
}

interface JNJobSummary {
  jnid: string;
  jobNumber: string;
  jobName: string;
  customerName: string;
  address: string;
  status: string;
  salesRep: string;
  estimateTotal: number;
  createdAt: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  roof_replacement: 'Roof Replacement',
  roof_repair: 'Roof Repair',
  gutter_install: 'Gutter Install',
  siding: 'Siding',
  commercial: 'Commercial',
  insurance_claim: 'Insurance Claim',
};

const PROJECT_TYPE_ICONS: Record<ProjectType, React.ReactNode> = {
  roof_replacement: <Layers className="w-4 h-4" />,
  roof_repair: <Wrench className="w-4 h-4" />,
  gutter_install: <Droplets className="w-4 h-4" />,
  siding: <Layers className="w-4 h-4" />,
  commercial: <Building2 className="w-4 h-4" />,
  insurance_claim: <Shield className="w-4 h-4" />,
};

const STATUS_STYLES: Record<BreakdownStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-zinc-700', text: 'text-zinc-300', label: 'Draft' },
  pending_approval: { bg: 'bg-yellow-900/50', text: 'text-yellow-400', label: 'Pending Approval' },
  approved: { bg: 'bg-blue-900/50', text: 'text-blue-400', label: 'Approved' },
  in_progress: { bg: 'bg-[#39FF14]/10', text: 'text-[#39FF14]', label: 'In Progress' },
  completed: { bg: 'bg-emerald-900/50', text: 'text-emerald-400', label: 'Completed' },
  revised: { bg: 'bg-orange-900/50', text: 'text-orange-400', label: 'Revised' },
};

const TAB_LIST = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'create', label: 'Create Breakdown', icon: <Plus className="w-4 h-4" /> },
  { id: 'active', label: 'Active Breakdowns', icon: <ClipboardList className="w-4 h-4" /> },
  { id: 'detail', label: 'Detail / Compare', icon: <GitCompare className="w-4 h-4" /> },
];

// ─── Helper Components ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BreakdownStatus }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {style.label}
    </span>
  );
}

function KPICard({ label, value, icon, sub }: { label: string; value: string; icon: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-zinc-400">{label}</span>
        <div className="p-2 bg-zinc-800 rounded-lg text-[#39FF14]">{icon}</div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function formatDate(d: string): string {
  if (!d) return 'TBD';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function JobBreakdownsPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [breakdowns, setBreakdowns] = useState<JobBreakdown[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBreakdown, setSelectedBreakdown] = useState<JobBreakdown | null>(null);
  const [compareId1, setCompareId1] = useState('');
  const [compareId2, setCompareId2] = useState('');
  const [comparisons, setComparisons] = useState<BreakdownComparison[] | null>(null);

  // ── Filters (Active tab) ─────────────────────────────────
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Create form state ────────────────────────────────────
  const [createForm, setCreateForm] = useState({
    jobId: '',
    jobName: '',
    customerName: '',
    street: '',
    city: 'Huntsville',
    state: 'AL',
    zip: '',
    projectType: 'roof_replacement' as ProjectType,
    sqFt: '',
    pitch: '6',
    stories: '1',
    perimeterFt: '',
    pipeBoots: '3',
    notes: '',
    estimatedStartDate: '',
    estimatedEndDate: '',
  });
  const [generatedMaterials, setGeneratedMaterials] = useState<MaterialItem[]>([]);
  const [laborRows, setLaborRows] = useState<LaborItem[]>([
    { role: 'Lead Installer', hours: 16, rate: 45, totalCost: 720, assignedTo: '' },
  ]);
  const [generatedDeliveries, setGeneratedDeliveries] = useState<DeliveryItem[]>([]);
  const [createDeliveryFees, setCreateDeliveryFees] = useState(150);

  // ── JN Import state ────────────────────────────────────
  const [jnJobs, setJnJobs] = useState<JNJobSummary[]>([]);
  const [jnLoading, setJnLoading] = useState(false);
  const [jnError, setJnError] = useState<string | null>(null);
  const [jnConfigured, setJnConfigured] = useState<boolean | null>(null); // null = unknown
  const [showJnPicker, setShowJnPicker] = useState(false);
  const [jnSearchTerm, setJnSearchTerm] = useState('');
  const [jnSelectedJob, setJnSelectedJob] = useState<JNJobSummary | null>(null);
  const [jnDetailLoading, setJnDetailLoading] = useState(false);
  const [jnEstimateRef, setJnEstimateRef] = useState<number | null>(null);

  // ── Fetch data ───────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [bdRes, statsRes] = await Promise.all([
        fetch('/api/portal/delivery/job-breakdowns'),
        fetch('/api/portal/delivery/job-breakdowns?stats=true'),
      ]);
      const bdData = await bdRes.json();
      const statsData = await statsRes.json();
      if (bdData.success) setBreakdowns(bdData.data);
      if (statsData.success) setStats(statsData.data);
    } catch (err) {
      console.error('Failed to fetch breakdowns:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Computed values for create form ──────────────────────
  const createMaterialTotal = generatedMaterials.reduce((s, m) => s + m.totalCost, 0);
  const createLaborTotal = laborRows.reduce((s, l) => s + l.hours * l.rate, 0);
  const createSubtotal = createMaterialTotal + createLaborTotal + createDeliveryFees;
  const createOverhead = Math.round(createSubtotal * 0.15 * 100) / 100;
  const createProfit = Math.round((createSubtotal + createOverhead) * 0.20 * 100) / 100;
  const createTotal = Math.round((createSubtotal + createOverhead + createProfit) * 100) / 100;

  // ── Handlers ─────────────────────────────────────────────
  async function handleAutoGenerate() {
    if (!createForm.sqFt || !createForm.perimeterFt) return;
    try {
      const res = await fetch('/api/portal/delivery/job-breakdowns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-materials',
          projectType: createForm.projectType,
          measurements: {
            sqFt: Number(createForm.sqFt),
            pitch: Number(createForm.pitch),
            stories: Number(createForm.stories),
            perimeterFt: Number(createForm.perimeterFt),
            pipeBoots: Number(createForm.pipeBoots),
          },
        }),
      });
      const data = await res.json();
      if (data.success) setGeneratedMaterials(data.data);
    } catch (err) {
      console.error('Generate materials failed:', err);
    }
  }

  async function handleCreateBreakdown(submitForApproval: boolean) {
    if (!createForm.jobName || !createForm.customerName) return;
    try {
      const res = await fetch('/api/portal/delivery/job-breakdowns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          jobId: createForm.jobId || `JN-${Math.floor(Math.random() * 9000) + 1000}`,
          jobName: createForm.jobName,
          customerName: createForm.customerName,
          address: {
            street: createForm.street,
            city: createForm.city,
            state: createForm.state,
            zip: createForm.zip,
          },
          projectType: createForm.projectType,
          materials: generatedMaterials,
          labor: laborRows.map(l => ({ ...l, totalCost: l.hours * l.rate })),
          notes: createForm.notes,
          estimatedStartDate: createForm.estimatedStartDate,
          estimatedEndDate: createForm.estimatedEndDate,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (submitForApproval) {
          await fetch('/api/portal/delivery/job-breakdowns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update-status',
              breakdownId: data.data.breakdownId,
              status: 'pending_approval',
              notes: 'Submitted for approval',
            }),
          });
        }
        await fetchData();
        setActiveTab('active');
        // Reset form
        setCreateForm({ jobId: '', jobName: '', customerName: '', street: '', city: 'Huntsville', state: 'AL', zip: '', projectType: 'roof_replacement', sqFt: '', pitch: '6', stories: '1', perimeterFt: '', pipeBoots: '3', notes: '', estimatedStartDate: '', estimatedEndDate: '' });
        setGeneratedMaterials([]);
        setLaborRows([{ role: 'Lead Installer', hours: 16, rate: 45, totalCost: 720, assignedTo: '' }]);
        setGeneratedDeliveries([]);
        // Reset JN import state
        setJnSelectedJob(null);
        setJnEstimateRef(null);
        setShowJnPicker(false);
        setJnSearchTerm('');
      }
    } catch (err) {
      console.error('Create breakdown failed:', err);
    }
  }

  async function handleStatusUpdate(id: string, status: BreakdownStatus, notes: string) {
    try {
      await fetch('/api/portal/delivery/job-breakdowns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: status === 'approved' ? 'approve' : 'update-status', breakdownId: id, status, notes }),
      });
      await fetchData();
    } catch (err) {
      console.error('Status update failed:', err);
    }
  }

  async function handleCompare() {
    if (!compareId1 || !compareId2) return;
    try {
      const res = await fetch('/api/portal/delivery/job-breakdowns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compare', breakdownId1: compareId1, breakdownId2: compareId2 }),
      });
      const data = await res.json();
      if (data.success) setComparisons(data.data);
    } catch (err) {
      console.error('Compare failed:', err);
    }
  }

  // ── JN Import Handlers ──────────────────────────────────
  async function handleFetchJNJobs() {
    setJnLoading(true);
    setJnError(null);
    try {
      const res = await fetch('/api/portal/delivery/job-breakdowns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch-jn-jobs', limit: 50 }),
      });
      const data = await res.json();
      if (data.success) {
        setJnJobs(data.jobs || []);
        setJnConfigured(true);
        if ((data.jobs || []).length === 0) {
          setJnError('No jobs found in JobNimbus.');
        }
      } else {
        // If fetching returned success but empty, JN might not be configured
        if (data.jobs && data.jobs.length === 0) {
          setJnConfigured(true);
          setJnError('No jobs found in JobNimbus.');
        } else {
          setJnConfigured(false);
          setJnError(data.error || 'Failed to fetch JobNimbus jobs.');
        }
      }
    } catch (err) {
      console.error('Fetch JN jobs failed:', err);
      setJnConfigured(false);
      setJnError('Could not connect to JobNimbus. Check API configuration.');
    } finally {
      setJnLoading(false);
    }
  }

  async function handleSelectJNJob(job: JNJobSummary) {
    setJnSelectedJob(job);
    setJnDetailLoading(true);
    setJnError(null);
    try {
      const res = await fetch('/api/portal/delivery/job-breakdowns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch-jn-job-detail', jnid: job.jnid }),
      });
      const data = await res.json();
      if (data.success) {
        const jnJob = data.job;
        const jnContact = data.contact;
        const jnEstimates = data.estimates || [];
        const totalEstValue = data.totalEstimateValue || 0;

        // Pre-populate the form from JN data
        const customerName = jnContact
          ? (jnContact.display_name || `${jnContact.first_name || ''} ${jnContact.last_name || ''}`.trim() || 'Customer')
          : (jnJob?.name || 'Unknown Customer');

        // Determine project type from name/description
        const searchText = `${jnJob?.name || ''} ${jnJob?.description || ''}`.toLowerCase();
        let projectType: ProjectType = 'roof_replacement';
        if (searchText.includes('repair') || searchText.includes('leak') || searchText.includes('patch')) {
          projectType = 'roof_repair';
        } else if (searchText.includes('gutter')) {
          projectType = 'gutter_install';
        } else if (searchText.includes('siding') || searchText.includes('hardie')) {
          projectType = 'siding';
        } else if (searchText.includes('commercial') || searchText.includes('flat roof') || searchText.includes('tpo')) {
          projectType = 'commercial';
        } else if (searchText.includes('insurance') || searchText.includes('claim') || searchText.includes('adjuster')) {
          projectType = 'insurance_claim';
        }

        // Build notes
        const notesParts: string[] = [];
        if (jnJob?.description) notesParts.push(`JN Description: ${jnJob.description}`);
        if (totalEstValue > 0) notesParts.push(`JN Estimate Total: $${totalEstValue.toFixed(2)}`);
        if (jnEstimates.length > 0) {
          notesParts.push(`JN Estimates: ${jnEstimates.length} found`);
          jnEstimates.forEach((est: { number?: string; total?: number; amount?: number; description?: string }, i: number) => {
            const estDesc = est.description ? ` - ${est.description}` : '';
            notesParts.push(`  #${est.number || (i + 1)}: $${(est.total || est.amount || 0).toFixed(2)}${estDesc}`);
          });
        }

        setCreateForm(prev => ({
          ...prev,
          jobId: jnJob?.jnid || '',
          jobName: jnJob?.name || jnJob?.description || `Job ${jnJob?.number || jnJob?.jnid || ''}`,
          customerName,
          street: jnJob?.address_line1 || jnContact?.address_line1 || '',
          city: jnJob?.city || jnContact?.city || prev.city,
          state: jnJob?.state_text || jnContact?.state_text || prev.state,
          zip: jnJob?.zip || jnContact?.zip || prev.zip,
          projectType,
          notes: notesParts.join('\n'),
        }));

        setJnEstimateRef(totalEstValue > 0 ? totalEstValue : null);
        setShowJnPicker(false);
      } else {
        setJnError(data.error || 'Failed to fetch job details.');
      }
    } catch (err) {
      console.error('Fetch JN job detail failed:', err);
      setJnError('Failed to load job details from JobNimbus.');
    } finally {
      setJnDetailLoading(false);
    }
  }

  function handleClearJNImport() {
    setJnSelectedJob(null);
    setJnEstimateRef(null);
    setCreateForm({
      jobId: '', jobName: '', customerName: '', street: '', city: 'Huntsville', state: 'AL', zip: '',
      projectType: 'roof_replacement', sqFt: '', pitch: '6', stories: '1', perimeterFt: '', pipeBoots: '3',
      notes: '', estimatedStartDate: '', estimatedEndDate: '',
    });
  }

  // Filtered JN jobs for the picker
  const filteredJnJobs = jnJobs.filter(j => {
    if (!jnSearchTerm) return true;
    const q = jnSearchTerm.toLowerCase();
    return (
      j.jobName.toLowerCase().includes(q) ||
      j.customerName.toLowerCase().includes(q) ||
      j.jobNumber.toLowerCase().includes(q) ||
      j.address.toLowerCase().includes(q) ||
      j.salesRep.toLowerCase().includes(q)
    );
  });

  function viewDetail(b: JobBreakdown) {
    setSelectedBreakdown(b);
    setActiveTab('detail');
  }

  // Filtered breakdowns for Active tab
  const filtered = breakdowns.filter(b => {
    if (filterStatus && b.status !== filterStatus) return false;
    if (filterType && b.projectType !== filterType) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      if (!b.jobName.toLowerCase().includes(q) && !b.customerName.toLowerCase().includes(q) && !b.breakdownId.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // ── Render ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#39FF14] animate-spin" />
          <p className="text-zinc-400">Loading job breakdowns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/portal/delivery" className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-zinc-400" />
              </Link>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Hammer className="w-5 h-5 text-[#39FF14]" />
                  Job Breakdowns
                </h1>
                <p className="text-sm text-zinc-500">Materials, labor, delivery scheduling &amp; cost management</p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('create')}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#39FF14] text-black rounded-lg font-medium text-sm hover:bg-[#39FF14]/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Breakdown
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 -mb-px overflow-x-auto">
            {TAB_LIST.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-[#39FF14] text-[#39FF14] bg-zinc-900/50'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* ════════════════════════════════════════════════════════
            TAB 1: DASHBOARD
        ════════════════════════════════════════════════════════ */}
        {activeTab === 'dashboard' && stats && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard label="Total Breakdowns" value={String(stats.total)} icon={<FileText className="w-5 h-5" />} sub="All time" />
              <KPICard label="Pending Approval" value={String(stats.pendingApproval)} icon={<Clock className="w-5 h-5" />} sub="Needs review" />
              <KPICard label="Active Jobs" value={String(stats.activeJobs)} icon={<Wrench className="w-5 h-5" />} sub="Approved + In Progress" />
              <KPICard label="Total Value" value={formatCurrency(stats.totalValue)} icon={<DollarSign className="w-5 h-5" />} sub="All breakdowns" />
            </div>

            {/* Monthly Trend Chart */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#39FF14]" />
                Monthly Breakdown Value
              </h3>
              <div className="flex items-end gap-3 h-48">
                {stats.monthlyValues.map((m, i) => {
                  const maxVal = Math.max(...stats.monthlyValues.map(v => v.value));
                  const pct = maxVal > 0 ? (m.value / maxVal) * 100 : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <span className="text-xs text-zinc-400">{formatCurrency(m.value)}</span>
                      <div
                        className="w-full bg-[#39FF14]/20 rounded-t-md relative overflow-hidden"
                        style={{ height: `${Math.max(pct, 4)}%` }}
                      >
                        <div className="absolute inset-0 bg-[#39FF14]/40" style={{ height: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-zinc-500 whitespace-nowrap">{m.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Breakdowns */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Recent Breakdowns</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('create')}
                    className="px-3 py-1.5 text-xs font-medium bg-[#39FF14] text-black rounded-lg hover:bg-[#39FF14]/90 transition-colors"
                  >
                    Create New
                  </button>
                  <button
                    onClick={() => { setFilterStatus('pending_approval'); setActiveTab('active'); }}
                    className="px-3 py-1.5 text-xs font-medium bg-yellow-900/30 text-yellow-400 border border-yellow-800 rounded-lg hover:bg-yellow-900/50 transition-colors"
                  >
                    View Pending ({stats.pendingApproval})
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {breakdowns.slice(0, 5).map(b => (
                  <div
                    key={b.breakdownId}
                    onClick={() => viewDetail(b)}
                    className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg cursor-pointer hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-zinc-700 rounded-lg shrink-0">
                        {PROJECT_TYPE_ICONS[b.projectType]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{b.jobName}</p>
                        <p className="text-sm text-zinc-400 truncate">{b.customerName} - {b.breakdownId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <StatusBadge status={b.status} />
                      <span className="text-sm font-medium text-zinc-300 hidden sm:block">{formatCurrency(b.totalEstimate)}</span>
                      <ChevronRight className="w-4 h-4 text-zinc-600" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Project Types & Status Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">By Project Type</h3>
                <div className="space-y-3">
                  {Object.entries(stats.byType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm text-zinc-300">{type}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#39FF14] rounded-full"
                            style={{ width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-sm text-zinc-400 w-6 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">By Status</h3>
                <div className="space-y-3">
                  {(Object.entries(stats.byStatus) as [BreakdownStatus, number][]).map(([status, count]) => {
                    const style = STATUS_STYLES[status];
                    return (
                      <div key={status} className="flex items-center justify-between">
                        <span className={`text-sm ${style.text}`}>{style.label}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${style.bg}`} style={{ width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%`, minWidth: count > 0 ? '8px' : '0' }} />
                          </div>
                          <span className="text-sm text-zinc-400 w-6 text-right">{count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            TAB 2: CREATE BREAKDOWN
        ════════════════════════════════════════════════════════ */}
        {activeTab === 'create' && (
          <div className="space-y-6">
            {/* Import from JobNimbus */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Download className="w-5 h-5 text-[#39FF14]" />
                  Import from JobNimbus
                </h3>
                {jnSelectedJob && (
                  <button
                    onClick={handleClearJNImport}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-lg hover:bg-zinc-700 hover:text-white transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Clear Import
                  </button>
                )}
              </div>

              {/* Selected JN Job Banner */}
              {jnSelectedJob && (
                <div className="flex items-center gap-3 p-3 bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-lg mb-4">
                  <CheckCircle className="w-5 h-5 text-[#39FF14] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">
                      Imported: {jnSelectedJob.jobName}
                    </p>
                    <p className="text-xs text-zinc-400 truncate">
                      {jnSelectedJob.customerName} &middot; {jnSelectedJob.address}
                      {jnEstimateRef ? ` &middot; JN Estimate: ${formatCurrency(jnEstimateRef)}` : ''}
                    </p>
                  </div>
                  {jnEstimateRef ? (
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-zinc-500">JN Estimate Ref</p>
                      <p className="text-sm font-bold text-[#39FF14]">{formatCurrency(jnEstimateRef)}</p>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Import Button / Picker */}
              {!showJnPicker && !jnSelectedJob && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setShowJnPicker(true);
                      if (jnJobs.length === 0 && jnConfigured !== false) {
                        handleFetchJNJobs();
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-green text-black rounded-lg font-medium text-sm hover:bg-brand-green transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Import from JobNimbus
                  </button>
                  <span className="text-xs text-zinc-500">
                    Pre-populate job info from your CRM, or fill in manually below.
                  </span>
                </div>
              )}

              {/* JN Job Picker */}
              {showJnPicker && (
                <div className="space-y-3">
                  {/* Search + Close */}
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="text"
                        value={jnSearchTerm}
                        onChange={e => setJnSearchTerm(e.target.value)}
                        placeholder="Search JN jobs by name, customer, address..."
                        className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]"
                      />
                    </div>
                    <button
                      onClick={() => handleFetchJNJobs()}
                      disabled={jnLoading}
                      className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-sm hover:bg-zinc-700 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${jnLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                    <button
                      onClick={() => { setShowJnPicker(false); setJnSearchTerm(''); setJnError(null); }}
                      className="p-2 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-lg hover:bg-zinc-700 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Error message */}
                  {jnError && (
                    <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-800/50 rounded-lg text-sm text-red-400">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {jnError}
                    </div>
                  )}

                  {/* Loading */}
                  {jnLoading && (
                    <div className="flex items-center justify-center gap-2 py-8 text-zinc-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Loading jobs from JobNimbus...</span>
                    </div>
                  )}

                  {/* JN not configured */}
                  {jnConfigured === false && !jnLoading && (
                    <div className="text-center py-6 text-zinc-500">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">JobNimbus is not configured.</p>
                      <p className="text-xs mt-1">Set JOBNIMBUS_API_KEY in your environment to enable import.</p>
                    </div>
                  )}

                  {/* Job List */}
                  {!jnLoading && jnConfigured !== false && filteredJnJobs.length > 0 && (
                    <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                      {filteredJnJobs.map(j => (
                        <button
                          key={j.jnid}
                          onClick={() => handleSelectJNJob(j)}
                          disabled={jnDetailLoading}
                          className="w-full flex items-center justify-between p-3 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-left hover:bg-zinc-800 hover:border-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-wait"
                        >
                          <div className="min-w-0 flex-1 mr-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm text-white truncate">{j.jobName}</span>
                              {j.jobNumber && (
                                <span className="text-xs text-zinc-500">#{j.jobNumber}</span>
                              )}
                              {j.status && (
                                <span className="px-1.5 py-0.5 bg-zinc-700 rounded text-xs text-zinc-400">{j.status}</span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-400 truncate mt-0.5">
                              {j.customerName}
                              {j.address && j.address !== 'No address' ? ` - ${j.address}` : ''}
                              {j.salesRep ? ` (Rep: ${j.salesRep})` : ''}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            {j.estimateTotal > 0 ? (
                              <span className="text-sm font-medium text-[#39FF14]">{formatCurrency(j.estimateTotal)}</span>
                            ) : (
                              <span className="text-xs text-zinc-600">No estimate</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* No results */}
                  {!jnLoading && jnConfigured !== false && jnJobs.length > 0 && filteredJnJobs.length === 0 && (
                    <div className="text-center py-4 text-zinc-500 text-sm">
                      No jobs match "{jnSearchTerm}"
                    </div>
                  )}

                  {/* Detail loading overlay */}
                  {jnDetailLoading && (
                    <div className="flex items-center justify-center gap-2 py-4 text-[#39FF14]">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Loading job details...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Job Info */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#39FF14]" />
                Job Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Job Name *</label>
                  <input
                    type="text"
                    value={createForm.jobName}
                    onChange={e => setCreateForm(p => ({ ...p, jobName: e.target.value }))}
                    placeholder="e.g., Johnson Roof Replacement"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    value={createForm.customerName}
                    onChange={e => setCreateForm(p => ({ ...p, customerName: e.target.value }))}
                    placeholder="e.g., Robert Johnson"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Project Type</label>
                  <select
                    value={createForm.projectType}
                    onChange={e => setCreateForm(p => ({ ...p, projectType: e.target.value as ProjectType }))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]"
                  >
                    {Object.entries(PROJECT_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Street Address</label>
                  <input
                    type="text"
                    value={createForm.street}
                    onChange={e => setCreateForm(p => ({ ...p, street: e.target.value }))}
                    placeholder="123 Main St"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">City</label>
                    <input
                      type="text"
                      value={createForm.city}
                      onChange={e => setCreateForm(p => ({ ...p, city: e.target.value }))}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">State</label>
                    <input
                      type="text"
                      value={createForm.state}
                      onChange={e => setCreateForm(p => ({ ...p, state: e.target.value }))}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">ZIP</label>
                    <input
                      type="text"
                      value={createForm.zip}
                      onChange={e => setCreateForm(p => ({ ...p, zip: e.target.value }))}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Job ID (optional)</label>
                  <input
                    type="text"
                    value={createForm.jobId}
                    onChange={e => setCreateForm(p => ({ ...p, jobId: e.target.value }))}
                    placeholder="Auto-generated if empty"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]"
                  />
                </div>
              </div>
            </div>

            {/* Measurements + Auto-Generate */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#39FF14]" />
                Measurements
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Roof Sq Ft *</label>
                  <input
                    type="number"
                    value={createForm.sqFt}
                    onChange={e => setCreateForm(p => ({ ...p, sqFt: e.target.value }))}
                    placeholder="1500"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Pitch (x/12)</label>
                  <input
                    type="number"
                    value={createForm.pitch}
                    onChange={e => setCreateForm(p => ({ ...p, pitch: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Stories</label>
                  <input
                    type="number"
                    value={createForm.stories}
                    onChange={e => setCreateForm(p => ({ ...p, stories: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Perimeter Ft *</label>
                  <input
                    type="number"
                    value={createForm.perimeterFt}
                    onChange={e => setCreateForm(p => ({ ...p, perimeterFt: e.target.value }))}
                    placeholder="200"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Pipe Boots</label>
                  <input
                    type="number"
                    value={createForm.pipeBoots}
                    onChange={e => setCreateForm(p => ({ ...p, pipeBoots: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]"
                  />
                </div>
              </div>
              <button
                onClick={handleAutoGenerate}
                disabled={!createForm.sqFt || !createForm.perimeterFt}
                className="flex items-center gap-2 px-4 py-2 bg-[#39FF14] text-black rounded-lg font-medium text-sm hover:bg-[#39FF14]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-4 h-4" />
                Auto-Generate Materials
              </button>
            </div>

            {/* Material List */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#39FF14]" />
                  Materials ({generatedMaterials.length} items)
                </h3>
                <button
                  onClick={() => setGeneratedMaterials(prev => [...prev, {
                    category: '', productName: '', quantity: 1, unit: 'pieces', unitCost: 0,
                    totalCost: 0, supplier: 'ABC Supply - Huntsville', leadTime: '1-2 days', inStock: true,
                  }])}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add Row
                </button>
              </div>
              {generatedMaterials.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No materials yet. Enter measurements above and click "Auto-Generate Materials".</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-zinc-400 text-left border-b border-zinc-800">
                        <th className="pb-2 pr-3">Category</th>
                        <th className="pb-2 pr-3">Product</th>
                        <th className="pb-2 pr-3 text-right">Qty</th>
                        <th className="pb-2 pr-3">Unit</th>
                        <th className="pb-2 pr-3 text-right">Unit Cost</th>
                        <th className="pb-2 pr-3 text-right">Total</th>
                        <th className="pb-2 pr-3">Supplier</th>
                        <th className="pb-2 pr-3">Stock</th>
                        <th className="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedMaterials.map((m, idx) => (
                        <tr key={idx} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                          <td className="py-2 pr-3">
                            <input
                              type="text"
                              value={m.category}
                              onChange={e => {
                                const updated = [...generatedMaterials];
                                updated[idx] = { ...updated[idx], category: e.target.value };
                                setGeneratedMaterials(updated);
                              }}
                              className="w-24 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-white focus:outline-none focus:border-[#39FF14]"
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <input
                              type="text"
                              value={m.productName}
                              onChange={e => {
                                const updated = [...generatedMaterials];
                                updated[idx] = { ...updated[idx], productName: e.target.value };
                                setGeneratedMaterials(updated);
                              }}
                              className="w-full min-w-[160px] px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-white focus:outline-none focus:border-[#39FF14]"
                            />
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <input
                              type="number"
                              value={m.quantity}
                              onChange={e => {
                                const updated = [...generatedMaterials];
                                const qty = Number(e.target.value);
                                updated[idx] = { ...updated[idx], quantity: qty, totalCost: Math.round(qty * updated[idx].unitCost * 100) / 100 };
                                setGeneratedMaterials(updated);
                              }}
                              className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-white text-right focus:outline-none focus:border-[#39FF14]"
                            />
                          </td>
                          <td className="py-2 pr-3 text-zinc-400 text-xs">{m.unit}</td>
                          <td className="py-2 pr-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={m.unitCost}
                              onChange={e => {
                                const updated = [...generatedMaterials];
                                const cost = Number(e.target.value);
                                updated[idx] = { ...updated[idx], unitCost: cost, totalCost: Math.round(updated[idx].quantity * cost * 100) / 100 };
                                setGeneratedMaterials(updated);
                              }}
                              className="w-20 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-white text-right focus:outline-none focus:border-[#39FF14]"
                            />
                          </td>
                          <td className="py-2 pr-3 text-right text-zinc-200 text-xs font-medium">
                            {formatCurrency(m.quantity * m.unitCost)}
                          </td>
                          <td className="py-2 pr-3 text-zinc-400 text-xs truncate max-w-[120px]">{m.supplier}</td>
                          <td className="py-2 pr-3">
                            {m.inStock ? (
                              <span className="text-emerald-400 text-xs">In Stock</span>
                            ) : (
                              <span className="text-yellow-400 text-xs">Order</span>
                            )}
                          </td>
                          <td className="py-2">
                            <button
                              onClick={() => setGeneratedMaterials(prev => prev.filter((_, i) => i !== idx))}
                              className="p-1 hover:bg-red-900/30 rounded text-zinc-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Labor Section */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#39FF14]" />
                  Labor ({laborRows.length} roles)
                </h3>
                <button
                  onClick={() => setLaborRows(prev => [...prev, { role: '', hours: 8, rate: 30, totalCost: 240, assignedTo: '' }])}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add Role
                </button>
              </div>
              <div className="space-y-3">
                {laborRows.map((l, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-3">
                      <label className="block text-xs text-zinc-500 mb-1">Role</label>
                      <input
                        type="text"
                        value={l.role}
                        onChange={e => {
                          const updated = [...laborRows];
                          updated[idx] = { ...updated[idx], role: e.target.value };
                          setLaborRows(updated);
                        }}
                        placeholder="Lead Installer"
                        className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-[#39FF14]"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-zinc-500 mb-1">Hours</label>
                      <input
                        type="number"
                        value={l.hours}
                        onChange={e => {
                          const updated = [...laborRows];
                          updated[idx] = { ...updated[idx], hours: Number(e.target.value) };
                          setLaborRows(updated);
                        }}
                        className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-[#39FF14]"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-zinc-500 mb-1">Rate ($/hr)</label>
                      <input
                        type="number"
                        step="0.50"
                        value={l.rate}
                        onChange={e => {
                          const updated = [...laborRows];
                          updated[idx] = { ...updated[idx], rate: Number(e.target.value) };
                          setLaborRows(updated);
                        }}
                        className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-[#39FF14]"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs text-zinc-500 mb-1">Assigned To</label>
                      <input
                        type="text"
                        value={l.assignedTo}
                        onChange={e => {
                          const updated = [...laborRows];
                          updated[idx] = { ...updated[idx], assignedTo: e.target.value };
                          setLaborRows(updated);
                        }}
                        placeholder="Team Alpha"
                        className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-[#39FF14]"
                      />
                    </div>
                    <div className="col-span-1 text-right text-sm text-zinc-300 font-medium pb-1.5">
                      {formatCurrency(l.hours * l.rate)}
                    </div>
                    <div className="col-span-1 pb-1">
                      <button
                        onClick={() => setLaborRows(prev => prev.filter((_, i) => i !== idx))}
                        className="p-1.5 hover:bg-red-900/30 rounded text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline + Notes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#39FF14]" />
                  Timeline
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Estimated Start</label>
                    <input
                      type="date"
                      value={createForm.estimatedStartDate}
                      onChange={e => setCreateForm(p => ({ ...p, estimatedStartDate: e.target.value }))}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Estimated End</label>
                    <input
                      type="date"
                      value={createForm.estimatedEndDate}
                      onChange={e => setCreateForm(p => ({ ...p, estimatedEndDate: e.target.value }))}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm text-zinc-400 mb-1">Delivery Fees ($)</label>
                  <input
                    type="number"
                    value={createDeliveryFees}
                    onChange={e => setCreateDeliveryFees(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]"
                  />
                </div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">Notes</h3>
                <textarea
                  value={createForm.notes}
                  onChange={e => setCreateForm(p => ({ ...p, notes: e.target.value }))}
                  rows={6}
                  placeholder="Special instructions, customer requests, site conditions..."
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm resize-none focus:outline-none focus:border-[#39FF14]"
                />
              </div>
            </div>

            {/* Cost Summary Panel */}
            <div className="bg-zinc-900 border border-[#39FF14]/30 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[#39FF14]" />
                Cost Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <p className="text-xs text-zinc-500">Materials</p>
                  <p className="text-lg font-bold">{formatCurrency(createMaterialTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Labor</p>
                  <p className="text-lg font-bold">{formatCurrency(createLaborTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Delivery</p>
                  <p className="text-lg font-bold">{formatCurrency(createDeliveryFees)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Overhead (15%)</p>
                  <p className="text-lg font-bold">{formatCurrency(createOverhead)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Profit (20%)</p>
                  <p className="text-lg font-bold">{formatCurrency(createProfit)}</p>
                </div>
                <div className="bg-[#39FF14]/10 rounded-lg p-3 border border-[#39FF14]/30">
                  <p className="text-xs text-[#39FF14]">Total Estimate</p>
                  <p className="text-2xl font-bold text-[#39FF14]">{formatCurrency(createTotal)}</p>
                </div>
              </div>
              {/* JN Estimate Reference Comparison */}
              {jnEstimateRef !== null && jnEstimateRef > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <ExternalLink className="w-4 h-4" />
                    <span>JobNimbus Estimate Reference:</span>
                    <span className="font-medium text-white">{formatCurrency(jnEstimateRef)}</span>
                  </div>
                  {createTotal > 0 && (
                    <div className="text-sm">
                      <span className="text-zinc-500">Difference: </span>
                      <span className={`font-medium ${
                        createTotal > jnEstimateRef ? 'text-red-400' :
                        createTotal < jnEstimateRef ? 'text-emerald-400' :
                        'text-zinc-300'
                      }`}>
                        {createTotal >= jnEstimateRef ? '+' : ''}{formatCurrency(createTotal - jnEstimateRef)}
                        {' '}({((createTotal / jnEstimateRef) * 100).toFixed(1)}% of JN estimate)
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => handleCreateBreakdown(false)}
                disabled={!createForm.jobName || !createForm.customerName}
                className="px-6 py-2.5 bg-zinc-800 text-white rounded-lg font-medium text-sm border border-zinc-700 hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save as Draft
              </button>
              <button
                onClick={() => handleCreateBreakdown(true)}
                disabled={!createForm.jobName || !createForm.customerName}
                className="px-6 py-2.5 bg-[#39FF14] text-black rounded-lg font-medium text-sm hover:bg-[#39FF14]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit for Approval
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            TAB 3: ACTIVE BREAKDOWNS
        ════════════════════════════════════════════════════════ */}
        {activeTab === 'active' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  placeholder="Search jobs, customers, IDs..."
                  className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]"
                />
              </div>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]"
              >
                <option value="">All Statuses</option>
                {Object.entries(STATUS_STYLES).map(([val, s]) => (
                  <option key={val} value={val}>{s.label}</option>
                ))}
              </select>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14]"
              >
                <option value="">All Types</option>
                {Object.entries(PROJECT_TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              {(filterStatus || filterType || filterSearch) && (
                <button
                  onClick={() => { setFilterStatus(''); setFilterType(''); setFilterSearch(''); }}
                  className="px-3 py-2 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  Clear Filters
                </button>
              )}
              <span className="text-sm text-zinc-500">{filtered.length} breakdown{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Breakdown Cards */}
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-zinc-500">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg">No breakdowns match your filters</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(b => (
                  <div key={b.breakdownId} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                    {/* Card Header */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                      onClick={() => setExpandedId(expandedId === b.breakdownId ? null : b.breakdownId)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-zinc-800 rounded-lg shrink-0">
                          {PROJECT_TYPE_ICONS[b.projectType]}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{b.jobName}</span>
                            <span className="text-xs text-zinc-500">{b.breakdownId}</span>
                          </div>
                          <p className="text-sm text-zinc-400 truncate">
                            {b.customerName} &middot; {b.address.street}, {b.address.city}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="hidden sm:block text-xs text-zinc-500">{PROJECT_TYPE_LABELS[b.projectType]}</span>
                        <StatusBadge status={b.status} />
                        <span className="font-semibold text-sm">{formatCurrency(b.totalEstimate)}</span>
                        <div className="flex items-center gap-1">
                          <Truck className="w-3.5 h-3.5 text-zinc-500" />
                          <span className="text-xs text-zinc-500">{b.deliveries.length}</span>
                        </div>
                        {expandedId === b.breakdownId ? (
                          <ChevronDown className="w-4 h-4 text-zinc-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-zinc-500" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Detail */}
                    {expandedId === b.breakdownId && (
                      <div className="border-t border-zinc-800 p-4 space-y-4">
                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2">
                          {b.status === 'pending_approval' && (
                            <button
                              onClick={() => handleStatusUpdate(b.breakdownId, 'approved', 'Approved')}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-900/30 text-blue-400 border border-blue-800 rounded-lg text-xs font-medium hover:bg-blue-900/50 transition-colors"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Approve
                            </button>
                          )}
                          {b.status === 'approved' && (
                            <button
                              onClick={() => handleStatusUpdate(b.breakdownId, 'in_progress', 'Work started')}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30 rounded-lg text-xs font-medium hover:bg-[#39FF14]/20 transition-colors"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                              Start
                            </button>
                          )}
                          {b.status === 'in_progress' && (
                            <button
                              onClick={() => handleStatusUpdate(b.breakdownId, 'completed', 'Job completed')}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/30 text-emerald-400 border border-emerald-800 rounded-lg text-xs font-medium hover:bg-emerald-900/50 transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Complete
                            </button>
                          )}
                          {['approved', 'in_progress'].includes(b.status) && (
                            <button
                              onClick={() => handleStatusUpdate(b.breakdownId, 'revised', 'Revision needed')}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-900/30 text-orange-400 border border-orange-800 rounded-lg text-xs font-medium hover:bg-orange-900/50 transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Revise
                            </button>
                          )}
                          <button
                            onClick={() => viewDetail(b)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-xs font-medium hover:bg-zinc-700 transition-colors ml-auto"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Full Detail
                          </button>
                        </div>

                        {/* Materials Summary */}
                        <div>
                          <h4 className="text-sm font-medium text-zinc-300 mb-2">Materials ({b.materials.length})</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {b.materials.map((m, i) => (
                              <div key={i} className="flex items-center justify-between bg-zinc-800/50 px-3 py-2 rounded-lg text-xs">
                                <span className="text-zinc-300 truncate mr-2">{m.productName}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-zinc-500">{m.quantity} {m.unit}</span>
                                  {m.inStock ? (
                                    <CircleDot className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Circle className="w-3 h-3 text-yellow-400" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Labor Summary */}
                        <div>
                          <h4 className="text-sm font-medium text-zinc-300 mb-2">Labor ({b.labor.length})</h4>
                          <div className="flex flex-wrap gap-2">
                            {b.labor.map((l, i) => (
                              <div key={i} className="bg-zinc-800/50 px-3 py-2 rounded-lg text-xs">
                                <span className="text-zinc-300">{l.role}</span>
                                <span className="text-zinc-500 ml-2">{l.hours}h @ ${l.rate}/hr</span>
                                <span className="text-white ml-2 font-medium">{formatCurrency(l.totalCost)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Deliveries */}
                        {b.deliveries.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-zinc-300 mb-2">Deliveries ({b.deliveries.length})</h4>
                            <div className="space-y-2">
                              {b.deliveries.map((d, i) => (
                                <div key={i} className="flex items-center justify-between bg-zinc-800/50 px-3 py-2 rounded-lg text-xs">
                                  <div className="flex items-center gap-2">
                                    <Truck className="w-3.5 h-3.5 text-zinc-500" />
                                    <span className="text-zinc-300">{d.deliveryId}</span>
                                    <span className="text-zinc-500">{formatDate(d.scheduledDate)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-zinc-400">{d.driver}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                                      d.status === 'delivered' ? 'bg-emerald-900/50 text-emerald-400' :
                                      d.status === 'en_route' ? 'bg-blue-900/50 text-blue-400' :
                                      'bg-zinc-700 text-zinc-300'
                                    }`}>
                                      {d.status}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Status History */}
                        <div>
                          <h4 className="text-sm font-medium text-zinc-300 mb-2">Status History</h4>
                          <div className="relative pl-4 border-l border-zinc-700 space-y-3">
                            {b.statusHistory.map((sh, i) => (
                              <div key={i} className="relative">
                                <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-zinc-700 border-2 border-zinc-600" />
                                <div className="text-xs">
                                  <span className={STATUS_STYLES[sh.status as BreakdownStatus]?.text || 'text-zinc-300'}>
                                    {STATUS_STYLES[sh.status as BreakdownStatus]?.label || sh.status}
                                  </span>
                                  <span className="text-zinc-500 ml-2">{formatDate(sh.timestamp)}</span>
                                  <span className="text-zinc-500 ml-2">by {sh.updatedBy}</span>
                                  {sh.notes && <p className="text-zinc-400 mt-0.5">{sh.notes}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Cost Breakdown */}
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 bg-zinc-800/30 rounded-lg p-3">
                          <div className="text-center">
                            <p className="text-xs text-zinc-500">Materials</p>
                            <p className="text-sm font-medium">{formatCurrency(b.materialTotal)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-zinc-500">Labor</p>
                            <p className="text-sm font-medium">{formatCurrency(b.laborTotal)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-zinc-500">Delivery</p>
                            <p className="text-sm font-medium">{formatCurrency(b.deliveryFees)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-zinc-500">Overhead</p>
                            <p className="text-sm font-medium">{formatCurrency(b.overhead)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-zinc-500">Profit</p>
                            <p className="text-sm font-medium">{formatCurrency(b.profit)}</p>
                          </div>
                          <div className="text-center bg-[#39FF14]/10 rounded-lg p-1">
                            <p className="text-xs text-[#39FF14]">Total</p>
                            <p className="text-sm font-bold text-[#39FF14]">{formatCurrency(b.totalEstimate)}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            TAB 4: DETAIL / COMPARE
        ════════════════════════════════════════════════════════ */}
        {activeTab === 'detail' && (
          <div className="space-y-6">
            {/* Detail View */}
            {selectedBreakdown ? (
              <>
                {/* Header */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-xl font-bold">{selectedBreakdown.jobName}</h2>
                        <StatusBadge status={selectedBreakdown.status} />
                      </div>
                      <div className="space-y-1 text-sm text-zinc-400">
                        <p>{selectedBreakdown.breakdownId} &middot; {selectedBreakdown.jobId}</p>
                        <p>{selectedBreakdown.customerName}</p>
                        <p>{selectedBreakdown.address.street}, {selectedBreakdown.address.city}, {selectedBreakdown.address.state} {selectedBreakdown.address.zip}</p>
                        <p>Type: {PROJECT_TYPE_LABELS[selectedBreakdown.projectType]}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-[#39FF14]">{formatCurrency(selectedBreakdown.totalEstimate)}</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Created {formatDate(selectedBreakdown.createdAt)} by {selectedBreakdown.createdBy}
                      </p>
                      {selectedBreakdown.approvedBy && (
                        <p className="text-xs text-zinc-500">Approved by {selectedBreakdown.approvedBy}</p>
                      )}
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="flex gap-6 text-sm border-t border-zinc-800 pt-4">
                    <div>
                      <span className="text-zinc-500">Est. Start:</span>{' '}
                      <span className="text-white">{formatDate(selectedBreakdown.estimatedStartDate)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Est. End:</span>{' '}
                      <span className="text-white">{formatDate(selectedBreakdown.estimatedEndDate)}</span>
                    </div>
                    {selectedBreakdown.actualStartDate && (
                      <div>
                        <span className="text-zinc-500">Actual Start:</span>{' '}
                        <span className="text-[#39FF14]">{formatDate(selectedBreakdown.actualStartDate)}</span>
                      </div>
                    )}
                    {selectedBreakdown.actualEndDate && (
                      <div>
                        <span className="text-zinc-500">Actual End:</span>{' '}
                        <span className="text-[#39FF14]">{formatDate(selectedBreakdown.actualEndDate)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Full Material Table */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-[#39FF14]" />
                    Materials ({selectedBreakdown.materials.length} items) - {formatCurrency(selectedBreakdown.materialTotal)}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-zinc-400 text-left border-b border-zinc-800">
                          <th className="pb-2 pr-4">Category</th>
                          <th className="pb-2 pr-4">Product</th>
                          <th className="pb-2 pr-4 text-right">Qty</th>
                          <th className="pb-2 pr-4">Unit</th>
                          <th className="pb-2 pr-4 text-right">Unit Cost</th>
                          <th className="pb-2 pr-4 text-right">Total</th>
                          <th className="pb-2 pr-4">Supplier</th>
                          <th className="pb-2 pr-4">Lead Time</th>
                          <th className="pb-2">Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedBreakdown.materials.map((m, i) => (
                          <tr key={i} className="border-b border-zinc-800/50">
                            <td className="py-2 pr-4 text-zinc-400">{m.category}</td>
                            <td className="py-2 pr-4 text-white">{m.productName}</td>
                            <td className="py-2 pr-4 text-right">{m.quantity}</td>
                            <td className="py-2 pr-4 text-zinc-400">{m.unit}</td>
                            <td className="py-2 pr-4 text-right">{formatCurrency(m.unitCost)}</td>
                            <td className="py-2 pr-4 text-right font-medium">{formatCurrency(m.totalCost)}</td>
                            <td className="py-2 pr-4 text-zinc-400 text-xs">{m.supplier}</td>
                            <td className="py-2 pr-4 text-zinc-400 text-xs">{m.leadTime}</td>
                            <td className="py-2">
                              {m.inStock ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                                  <CheckCircle className="w-3 h-3" /> In Stock
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-yellow-400 text-xs">
                                  <AlertCircle className="w-3 h-3" /> Order
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Labor + Deliveries side-by-side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Labor */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-[#39FF14]" />
                      Labor - {formatCurrency(selectedBreakdown.laborTotal)}
                    </h3>
                    <div className="space-y-3">
                      {selectedBreakdown.labor.map((l, i) => (
                        <div key={i} className="flex items-center justify-between bg-zinc-800/50 p-3 rounded-lg">
                          <div>
                            <p className="font-medium text-sm">{l.role}</p>
                            <p className="text-xs text-zinc-400">{l.assignedTo}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-sm">{formatCurrency(l.totalCost)}</p>
                            <p className="text-xs text-zinc-400">{l.hours}h @ ${l.rate}/hr</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Deliveries */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Truck className="w-5 h-5 text-[#39FF14]" />
                      Deliveries ({selectedBreakdown.deliveries.length})
                    </h3>
                    {selectedBreakdown.deliveries.length === 0 ? (
                      <p className="text-zinc-500 text-sm">No deliveries scheduled yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedBreakdown.deliveries.map((d, i) => (
                          <div key={i} className="bg-zinc-800/50 p-3 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{d.deliveryId}</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs ${
                                  d.status === 'delivered' ? 'bg-emerald-900/50 text-emerald-400' :
                                  d.status === 'en_route' ? 'bg-blue-900/50 text-blue-400' :
                                  d.status === 'loaded' ? 'bg-purple-900/50 text-purple-400' :
                                  'bg-zinc-700 text-zinc-300'
                                }`}>
                                  {d.status}
                                </span>
                              </div>
                              <span className="text-xs text-zinc-400">{d.driver}</span>
                            </div>
                            <p className="text-xs text-zinc-500 mb-1">{formatDate(d.scheduledDate)}</p>
                            <div className="flex flex-wrap gap-1">
                              {d.materials.map((mat, mi) => (
                                <span key={mi} className="px-2 py-0.5 bg-zinc-700 rounded text-xs text-zinc-300">
                                  {mat}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Cost Breakdown Pie Chart (CSS) */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-[#39FF14]" />
                    Cost Breakdown
                  </h3>
                  <div className="flex flex-col sm:flex-row items-center gap-8">
                    {/* CSS Pie */}
                    <div className="relative w-48 h-48 shrink-0">
                      {(() => {
                        const total = selectedBreakdown.totalEstimate || 1;
                        const segments = [
                          { label: 'Materials', value: selectedBreakdown.materialTotal, color: '#39FF14' },
                          { label: 'Labor', value: selectedBreakdown.laborTotal, color: '#3B82F6' },
                          { label: 'Delivery', value: selectedBreakdown.deliveryFees, color: '#A855F7' },
                          { label: 'Overhead', value: selectedBreakdown.overhead, color: '#F59E0B' },
                          { label: 'Profit', value: selectedBreakdown.profit, color: '#10B981' },
                        ];
                        let cumulative = 0;
                        const gradientParts = segments.map(s => {
                          const start = (cumulative / total) * 360;
                          cumulative += s.value;
                          const end = (cumulative / total) * 360;
                          return `${s.color} ${start}deg ${end}deg`;
                        });
                        return (
                          <div
                            className="w-full h-full rounded-full"
                            style={{
                              background: `conic-gradient(${gradientParts.join(', ')})`,
                            }}
                          >
                            <div className="absolute inset-6 bg-zinc-900 rounded-full flex items-center justify-center">
                              <div className="text-center">
                                <p className="text-lg font-bold text-[#39FF14]">{formatCurrency(total)}</p>
                                <p className="text-xs text-zinc-500">Total</p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Legend */}
                    <div className="flex-1 space-y-3">
                      {[
                        { label: 'Materials', value: selectedBreakdown.materialTotal, color: '#39FF14', pct: ((selectedBreakdown.materialTotal / (selectedBreakdown.totalEstimate || 1)) * 100).toFixed(1) },
                        { label: 'Labor', value: selectedBreakdown.laborTotal, color: '#3B82F6', pct: ((selectedBreakdown.laborTotal / (selectedBreakdown.totalEstimate || 1)) * 100).toFixed(1) },
                        { label: 'Delivery', value: selectedBreakdown.deliveryFees, color: '#A855F7', pct: ((selectedBreakdown.deliveryFees / (selectedBreakdown.totalEstimate || 1)) * 100).toFixed(1) },
                        { label: 'Overhead (15%)', value: selectedBreakdown.overhead, color: '#F59E0B', pct: ((selectedBreakdown.overhead / (selectedBreakdown.totalEstimate || 1)) * 100).toFixed(1) },
                        { label: 'Profit (20%)', value: selectedBreakdown.profit, color: '#10B981', pct: ((selectedBreakdown.profit / (selectedBreakdown.totalEstimate || 1)) * 100).toFixed(1) },
                      ].map(item => (
                        <div key={item.label} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                            <span className="text-sm text-zinc-300">{item.label}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">{formatCurrency(item.value)}</span>
                            <span className="text-xs text-zinc-500 w-10 text-right">{item.pct}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Notes + Status History */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {selectedBreakdown.notes && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                      <h3 className="text-lg font-semibold mb-3">Notes</h3>
                      <p className="text-sm text-zinc-300 whitespace-pre-wrap">{selectedBreakdown.notes}</p>
                    </div>
                  )}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-3">Status History</h3>
                    <div className="relative pl-4 border-l border-zinc-700 space-y-4">
                      {selectedBreakdown.statusHistory.map((sh, i) => (
                        <div key={i} className="relative">
                          <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-zinc-600 border-2 border-zinc-500" />
                          <div>
                            <div className="flex items-center gap-2 text-sm">
                              <span className={`font-medium ${STATUS_STYLES[sh.status as BreakdownStatus]?.text || 'text-zinc-300'}`}>
                                {STATUS_STYLES[sh.status as BreakdownStatus]?.label || sh.status}
                              </span>
                              <span className="text-zinc-500">-</span>
                              <span className="text-zinc-500">{formatDate(sh.timestamp)}</span>
                            </div>
                            <p className="text-xs text-zinc-500">by {sh.updatedBy}</p>
                            {sh.notes && <p className="text-sm text-zinc-400 mt-1">{sh.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Print button */}
                <div className="flex justify-end">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-sm hover:bg-zinc-700 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Print Breakdown
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-zinc-500">
                <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg mb-2">No breakdown selected</p>
                <p className="text-sm">Select a breakdown from the Active tab, or use the compare tool below.</p>
              </div>
            )}

            {/* ── Compare Section ────────────────────────────── */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-[#39FF14]" />
                Compare Breakdowns
              </h3>
              <div className="flex flex-wrap gap-3 items-end mb-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Breakdown 1 (Original)</label>
                  <select
                    value={compareId1}
                    onChange={e => setCompareId1(e.target.value)}
                    className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14] min-w-[220px]"
                  >
                    <option value="">Select...</option>
                    {breakdowns.map(b => (
                      <option key={b.breakdownId} value={b.breakdownId}>
                        {b.breakdownId} - {b.jobName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Breakdown 2 (Revised)</label>
                  <select
                    value={compareId2}
                    onChange={e => setCompareId2(e.target.value)}
                    className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#39FF14] min-w-[220px]"
                  >
                    <option value="">Select...</option>
                    {breakdowns.map(b => (
                      <option key={b.breakdownId} value={b.breakdownId}>
                        {b.breakdownId} - {b.jobName}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleCompare}
                  disabled={!compareId1 || !compareId2}
                  className="px-4 py-2 bg-[#39FF14] text-black rounded-lg font-medium text-sm hover:bg-[#39FF14]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Compare
                </button>
              </div>

              {/* Comparison Results */}
              {comparisons && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-zinc-400 text-left border-b border-zinc-800">
                        <th className="pb-2 pr-4">Field</th>
                        <th className="pb-2 pr-4">Category</th>
                        <th className="pb-2 pr-4">Original</th>
                        <th className="pb-2 pr-4">Revised</th>
                        <th className="pb-2">Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisons.map((c, i) => (
                        <tr key={i} className="border-b border-zinc-800/50">
                          <td className="py-2 pr-4 text-white font-medium">{c.field}</td>
                          <td className="py-2 pr-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                              c.category === 'cost' ? 'bg-emerald-900/30 text-emerald-400' :
                              c.category === 'material' ? 'bg-blue-900/30 text-blue-400' :
                              c.category === 'labor' ? 'bg-purple-900/30 text-purple-400' :
                              c.category === 'delivery' ? 'bg-orange-900/30 text-orange-400' :
                              'bg-zinc-700 text-zinc-300'
                            }`}>
                              {c.category}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-zinc-400">{c.original}</td>
                          <td className="py-2 pr-4 text-zinc-300">{c.revised}</td>
                          <td className={`py-2 font-medium ${
                            c.difference.includes('+') ? 'text-red-400' :
                            c.difference.includes('-') ? 'text-emerald-400' :
                            c.difference === 'Same' ? 'text-zinc-500' :
                            c.difference === 'Changed' ? 'text-yellow-400' :
                            c.difference === 'Added' ? 'text-blue-400' :
                            c.difference === 'Removed' ? 'text-red-400' :
                            'text-zinc-300'
                          }`}>
                            {c.difference}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
