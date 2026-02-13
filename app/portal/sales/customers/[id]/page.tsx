'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Phone, MessageSquare, Calendar, FileText, MapPin, Clock, User,
  Loader2, ArrowLeft, Mail, Home, Send, Camera,
  CheckCircle, AlertCircle, Edit, Plus, X, DollarSign, Building,
  ExternalLink, Copy, Star, History, Paperclip, Download,
  MessageCircle, Save, BarChart3, Users, Briefcase, Receipt,
  ClipboardList, RefreshCw
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

// =============================================================================
// Types
// =============================================================================

interface ContactData {
  jnid: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobilePhone: string;
  homePhone: string;
  workPhone: string;
  address: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  status: string;
  portalPhase: string;
  source: string;
  salesRep: string;
  createdAt: string;
  updatedAt: string;
}

interface JobData {
  jnid: string;
  number: string;
  name: string;
  description: string;
  status: string;
  portalStatus: string;
  address: string;
  salesRep: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

interface EstimateData {
  jnid: string;
  number: string;
  status: string;
  amount: number;
  tax: number;
  total: number;
  description: string;
  pdfUrl: string;
  publicUrl: string;
  createdAt: string;
}

interface TaskData {
  jnid: string;
  title: string;
  description: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  assignedTo: string[];
}

interface NoteData {
  jnid: string;
  content: string;
  type: string;
  author: string;
  createdAt: string;
  isPortalNote: boolean;
}

interface AttachmentData {
  jnid: string;
  filename: string;
  description: string;
  url: string;
  thumbnailUrl: string;
  contentType: string;
  size: number;
  createdAt: string;
}

interface InvoiceData {
  jnid: string;
  number: string;
  status: string;
  amount: number;
  amountPaid: number;
  balance: number;
  total: number;
  dueDate: string;
  pdfUrl: string;
  publicUrl: string;
  createdAt: string;
}

interface FullCustomerData {
  contact: ContactData;
  jobs: JobData[];
  estimates: EstimateData[];
  tasks: TaskData[];
  notes: NoteData[];
  attachments: AttachmentData[];
  invoices: InvoiceData[];
}

// =============================================================================
// Status Configurations
// =============================================================================

const jobStatusColors: Record<string, string> = {
  Lead: 'bg-blue-500/20 text-blue-400 ring-blue-500/30',
  New: 'bg-blue-500/20 text-blue-400 ring-blue-500/30',
  Contacted: 'bg-purple-500/20 text-purple-400 ring-purple-500/30',
  'Appointment Set': 'bg-cyan-500/20 text-cyan-400 ring-cyan-500/30',
  Inspected: 'bg-orange-500/20 text-orange-400 ring-orange-500/30',
  'Estimate Sent': 'bg-yellow-500/20 text-yellow-400 ring-yellow-500/30',
  'Contract Signed': 'bg-green-500/20 text-green-400 ring-green-500/30',
  'Material Ordered': 'bg-indigo-500/20 text-indigo-400 ring-indigo-500/30',
  'Work In Progress': 'bg-amber-500/20 text-amber-400 ring-amber-500/30',
  Complete: 'bg-emerald-500/20 text-emerald-400 ring-emerald-500/30',
  Completed: 'bg-emerald-500/20 text-emerald-400 ring-emerald-500/30',
  Lost: 'bg-red-500/20 text-red-400 ring-red-500/30',
  Cancelled: 'bg-red-500/20 text-red-400 ring-red-500/30',
};

function StatusBadge({ status }: { status: string }) {
  const color = jobStatusColors[status] || 'bg-neutral-500/20 text-neutral-400 ring-neutral-500/30';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${color}`}>
      {status}
    </span>
  );
}

// Status options for update modal
const statusOptions = [
  'Lead', 'New', 'Contacted', 'Appointment Set', 'Inspected',
  'Estimate Sent', 'Contract Signed', 'Material Ordered',
  'Work In Progress', 'Complete', 'Lost', 'Cancelled',
];

// Map JN status values to our portal status keys for the update-status API
const jnStatusToPortalKey: Record<string, string> = {
  'Lead': 'lead',
  'New': 'new',
  'Contacted': 'contacted',
  'Appointment Set': 'scheduled',
  'Inspected': 'inspected',
  'Estimate Sent': 'estimate',
  'Contract Signed': 'contract',
  'Material Ordered': 'material_ordered',
  'Work In Progress': 'in_progress',
  'Complete': 'complete',
  'Completed': 'completed',
  'Lost': 'closed_lost',
  'Cancelled': 'cancelled',
};

// =============================================================================
// Customer Detail Page
// =============================================================================

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isLoading } = useAuth();
  const contactJnid = params.id as string;

  const [data, setData] = useState<FullCustomerData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'activity' | 'estimates' | 'documents' | 'invoices' | 'storm_hail' | 'portal_settings'>('overview');
  const [customerSettings, setCustomerSettings] = useState<Record<string, boolean | null>>({});
  const [savingCustomerSettings, setSavingCustomerSettings] = useState(false);
  const [settingsSaveMsg, setSettingsSaveMsg] = useState('');
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [showUpdateStatus, setShowUpdateStatus] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedJobJnid, setSelectedJobJnid] = useState<string | null>(null);

  // Message Customer state
  const [showMessageCustomer, setShowMessageCustomer] = useState(false);
  const [customerMessage, setCustomerMessage] = useState('');
  const [customerMessageSubject, setCustomerMessageSubject] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageSentSuccess, setMessageSentSuccess] = useState(false);
  const [customerMessageHistory, setCustomerMessageHistory] = useState<Array<{
    id: string;
    direction: string;
    content: string;
    sentAt: string;
    sentBy: string;
  }>>([]);
  const [isLoadingMessageHistory, setIsLoadingMessageHistory] = useState(false);

  // Load customer data from JobNimbus API
  const loadCustomerData = async () => {
    if (!contactJnid) return;
    setIsLoadingData(true);
    setError(null);
    try {
      // Fetch full customer data from JobNimbus via our API route
      const response = await fetch(`/api/portal/jobnimbus/customer/${contactJnid}`);
      if (!response.ok) {
        throw new Error('Failed to load customer data');
      }
      const result = await response.json();
      if (result.success && result.data) {
        setData(result.data);
        // Auto-select the first job if any
        if (result.data.jobs.length > 0) {
          setSelectedJobJnid(result.data.jobs[0].jnid);
        }
      } else {
        setError(result.error || 'Customer not found');
      }
    } catch (err) {
      console.error('Error loading customer:', err);
      setError('Unable to load customer data. Please try again.');
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (user && contactJnid) {
      loadCustomerData();
    }
  }, [user, contactJnid]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/portal');
    }
  }, [user, isLoading, router]);

  // Handle actions
  const handleCall = () => {
    if (data?.contact.phone) window.location.href = `tel:${data.contact.phone}`;
  };

  const handleText = () => {
    if (data?.contact.phone) window.location.href = `sms:${data.contact.phone}`;
  };

  const handleEmail = () => {
    if (data?.contact.email) window.location.href = `mailto:${data.contact.email}`;
  };

  const handleDirections = () => {
    if (data?.contact) {
      const address = `${data.contact.address}, ${data.contact.city}, ${data.contact.state} ${data.contact.zip}`;
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  };

  // Add note to JN
  const handleAddNote = async () => {
    if (!newNote.trim() || !data) return;
    setIsSavingNote(true);
    try {
      const response = await fetch('/api/portal/jobnimbus/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactJnid: data.contact.jnid,
          jobJnid: selectedJobJnid,
          content: newNote.trim(),
        }),
      });
      const result = await response.json();
      if (result.success) {
        // Refresh data to show new note
        await loadCustomerData();
        setNewNote('');
        setShowAddNote(false);
      } else {
        alert(result.error || 'Failed to add note');
      }
    } catch {
      alert('Failed to add note. Please try again.');
    } finally {
      setIsSavingNote(false);
    }
  };

  // Send message to customer
  const handleSendCustomerMessage = async () => {
    if (!customerMessage.trim() || !data) return;
    setIsSendingMessage(true);
    setMessageSentSuccess(false);
    try {
      const response = await fetch('/api/portal/chat/customer-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: data.contact.jnid,
          customerName: data.contact.name,
          content: customerMessage.trim(),
          subject: customerMessageSubject.trim() || undefined,
          channel: 'portal',
          repName: user?.name || 'Rep',
          repEmail: user?.email || '',
          contactJnid: data.contact.jnid,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setMessageSentSuccess(true);
        setCustomerMessage('');
        setCustomerMessageSubject('');
        // Reload message history
        loadMessageHistory();
        // Also refresh the main data to show the new note
        await loadCustomerData();
        setTimeout(() => setMessageSentSuccess(false), 3000);
      } else {
        alert(result.error || 'Failed to send message');
      }
    } catch {
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Load customer message history
  const loadMessageHistory = async () => {
    if (!data?.contact.jnid) return;
    setIsLoadingMessageHistory(true);
    try {
      const response = await fetch(`/api/portal/chat/customer-message?customerId=${data.contact.jnid}`);
      const result = await response.json();
      if (result.success) {
        setCustomerMessageHistory(result.messages || []);
      }
    } catch {
      console.error('Failed to load message history');
    } finally {
      setIsLoadingMessageHistory(false);
    }
  };

  // Load message history when opening modal
  useEffect(() => {
    if (showMessageCustomer && data?.contact.jnid) {
      loadMessageHistory();
    }
  }, [showMessageCustomer, data?.contact.jnid]);

  // Update job status in JN
  const handleStatusUpdate = async (newStatus: string) => {
    if (!selectedJobJnid) return;
    setUpdatingStatus(true);
    try {
      const portalStatusKey = jnStatusToPortalKey[newStatus] || newStatus.toLowerCase();
      const response = await fetch('/api/portal/jobnimbus/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobJnid: selectedJobJnid,
          newStatus: portalStatusKey,
        }),
      });
      const result = await response.json();
      if (result.success) {
        // Refresh data
        await loadCustomerData();
        setShowUpdateStatus(false);
      } else {
        alert(result.message || 'Failed to update status');
      }
    } catch {
      alert('Failed to update status. Please try again.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-green" size={48} />
      </div>
    );
  }

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-brand-green mx-auto mb-4" size={48} />
          <p className="text-neutral-400">Loading customer from JobNimbus...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center p-4">
        <div className="bg-white/[0.02] border border-red-500/20 rounded-2xl p-8 max-w-md text-center">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Error</h2>
          <p className="text-neutral-400 mb-4">{error || 'Customer not found'}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-neutral-300"
            >
              Go Back
            </button>
            <button
              onClick={loadCustomerData}
              className="px-4 py-2 bg-brand-green/20 hover:bg-brand-green/30 rounded-xl text-brand-green"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const contact = data.contact;
  const selectedJob = data.jobs.find(j => j.jnid === selectedJobJnid);

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative z-10 pb-24">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.back()}
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={20} className="text-neutral-400" />
                </button>
                <div>
                  <h1 className="text-lg font-bold text-white tracking-tight">{contact.name}</h1>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={contact.status || 'Unknown'} />
                    <span className="text-xs text-neutral-500">
                      {data.jobs.length} job{data.jobs.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadCustomerData}
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                  title="Refresh"
                >
                  <RefreshCw size={18} className="text-neutral-400" />
                </button>
                {selectedJobJnid && (
                  <button
                    onClick={() => setShowUpdateStatus(true)}
                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                    title="Update Status"
                  >
                    <Edit size={18} className="text-neutral-400" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Quick Actions */}
        <div className="sticky top-[73px] z-10 bg-black/80 backdrop-blur-xl border-b border-white/5 px-4 py-3">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-6 gap-2">
              <button onClick={handleCall} className="flex flex-col items-center justify-center p-3 bg-green-500/20 hover:bg-green-500/30 rounded-xl transition-colors active:scale-95">
                <Phone size={22} className="text-green-400" />
                <span className="text-[10px] text-green-400 mt-1">Call</span>
              </button>
              <button onClick={handleText} className="flex flex-col items-center justify-center p-3 bg-brand-green/20 hover:bg-brand-green/30 rounded-xl transition-colors active:scale-95">
                <MessageSquare size={22} className="text-blue-400" />
                <span className="text-[10px] text-blue-400 mt-1">Text</span>
              </button>
              <button onClick={handleEmail} className="flex flex-col items-center justify-center p-3 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl transition-colors active:scale-95">
                <Mail size={22} className="text-purple-400" />
                <span className="text-[10px] text-purple-400 mt-1">Email</span>
              </button>
              <button onClick={handleDirections} className="flex flex-col items-center justify-center p-3 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-xl transition-colors active:scale-95">
                <MapPin size={22} className="text-cyan-400" />
                <span className="text-[10px] text-cyan-400 mt-1">Map</span>
              </button>
              <button onClick={() => setShowMessageCustomer(true)} className="flex flex-col items-center justify-center p-3 bg-lime-500/20 hover:bg-lime-500/30 rounded-xl transition-colors active:scale-95">
                <MessageCircle size={22} className="text-lime-400" />
                <span className="text-[10px] text-lime-400 mt-1">Message</span>
              </button>
              <button onClick={() => setShowAddNote(true)} className="flex flex-col items-center justify-center p-3 bg-orange-500/20 hover:bg-orange-500/30 rounded-xl transition-colors active:scale-95">
                <FileText size={22} className="text-orange-400" />
                <span className="text-[10px] text-orange-400 mt-1">Note</span>
              </button>
            </div>
          </div>
        </div>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          {/* Tab Navigation */}
          <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 mb-4 overflow-x-auto">
            {(['overview', 'jobs', 'activity', 'estimates', 'documents', 'invoices', 'storm_hail', 'portal_settings'] as const).map((tab) => {
              const tabLabels: Record<string, string> = {
                overview: 'Overview', jobs: 'Jobs', activity: 'Activity',
                estimates: 'Estimates', documents: 'Documents', invoices: 'Invoices',
                storm_hail: 'Storm/Hail', portal_settings: 'Settings',
              };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 min-w-[70px] px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab
                      ? 'bg-brand-green text-black'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {tabLabels[tab] || tab}
                  {tab === 'jobs' && data.jobs.length > 0 && (
                    <span className="ml-1 text-xs opacity-70">({data.jobs.length})</span>
                  )}
                  {tab === 'activity' && data.notes.length > 0 && (
                    <span className="ml-1 text-xs opacity-70">({data.notes.length})</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ==================== OVERVIEW TAB ==================== */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Contact Info */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <User size={16} className="text-brand-green" />
                  Contact Information
                </h3>
                <div className="space-y-3">
                  {contact.phone && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Phone size={16} className="text-neutral-500" />
                        <span className="text-white">{contact.phone}</span>
                      </div>
                      <button onClick={() => handleCopy(contact.phone)} className="p-2 hover:bg-white/5 rounded-lg">
                        <Copy size={14} className="text-neutral-500" />
                      </button>
                    </div>
                  )}
                  {contact.email && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Mail size={16} className="text-neutral-500" />
                        <span className="text-white">{contact.email}</span>
                      </div>
                      <button onClick={() => handleCopy(contact.email)} className="p-2 hover:bg-white/5 rounded-lg">
                        <Copy size={14} className="text-neutral-500" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <MapPin size={16} className="text-neutral-500" />
                    <span className="text-white">
                      {[contact.address, contact.addressLine2, contact.city, contact.state, contact.zip].filter(Boolean).join(', ')}
                    </span>
                  </div>
                  {contact.salesRep && (
                    <div className="flex items-center gap-3">
                      <Users size={16} className="text-neutral-500" />
                      <span className="text-neutral-300">Rep: <span className="text-white">{contact.salesRep}</span></span>
                    </div>
                  )}
                  {contact.source && (
                    <div className="flex items-center gap-3">
                      <Star size={16} className="text-neutral-500" />
                      <span className="text-neutral-300">Source: <span className="text-white">{contact.source}</span></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-white">{data.jobs.length}</p>
                  <p className="text-xs text-neutral-500">Jobs</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-white">{data.estimates.length}</p>
                  <p className="text-xs text-neutral-500">Estimates</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-green-400">
                    ${data.estimates.reduce((sum, e) => sum + e.total, 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-neutral-500">Est. Value</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-white">{data.invoices.length}</p>
                  <p className="text-xs text-neutral-500">Invoices</p>
                </div>
              </div>

              {/* Active Job */}
              {selectedJob && (
                <div className="bg-white/[0.02] border border-brand-green/20 rounded-2xl p-4">
                  <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                    <Briefcase size={16} className="text-brand-green" />
                    Active Job
                  </h3>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-white">{selectedJob.name}</p>
                      {selectedJob.number && (
                        <p className="text-xs text-neutral-500">#{selectedJob.number}</p>
                      )}
                    </div>
                    <StatusBadge status={selectedJob.status} />
                  </div>
                  {selectedJob.description && (
                    <p className="text-sm text-neutral-400 mb-2">{selectedJob.description}</p>
                  )}
                  <div className="flex gap-4 text-xs text-neutral-500">
                    {selectedJob.startDate && (
                      <span>Start: {new Date(selectedJob.startDate).toLocaleDateString()}</span>
                    )}
                    {selectedJob.endDate && (
                      <span>End: {new Date(selectedJob.endDate).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Recent Notes Preview */}
              {data.notes.length > 0 && (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-white flex items-center gap-2">
                      <History size={16} className="text-brand-green" />
                      Recent Activity
                    </h3>
                    <button
                      onClick={() => setActiveTab('activity')}
                      className="text-xs text-brand-green hover:text-brand-green/80"
                    >
                      View All
                    </button>
                  </div>
                  {data.notes.slice(0, 3).map(note => (
                    <div key={note.jnid} className="mb-3 last:mb-0 pb-3 last:pb-0 border-b last:border-0 border-white/5">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-medium ${note.isPortalNote ? 'text-brand-green' : 'text-neutral-400'}`}>
                          {note.author}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {note.createdAt ? new Date(note.createdAt).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-300 line-clamp-2">{note.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Tasks */}
              {data.tasks.length > 0 && (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                    <ClipboardList size={16} className="text-brand-green" />
                    Tasks & Appointments
                  </h3>
                  {data.tasks.map(task => (
                    <div key={task.jnid} className="mb-3 last:mb-0 pb-3 last:pb-0 border-b last:border-0 border-white/5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white">{task.title}</span>
                        <span className="text-xs text-neutral-500">{task.status}</span>
                      </div>
                      {task.description && (
                        <p className="text-xs text-neutral-400">{task.description}</p>
                      )}
                      <div className="flex gap-3 mt-1 text-xs text-neutral-500">
                        {task.startDate && <span>{new Date(task.startDate).toLocaleDateString()}</span>}
                        {task.type && <span>{task.type}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ==================== JOBS TAB ==================== */}
          {activeTab === 'jobs' && (
            <div className="space-y-3">
              {data.jobs.length > 0 ? (
                data.jobs.map(job => (
                  <div
                    key={job.jnid}
                    onClick={() => setSelectedJobJnid(job.jnid)}
                    className={`bg-white/[0.02] border rounded-2xl p-4 cursor-pointer transition-colors ${
                      selectedJobJnid === job.jnid ? 'border-brand-green/40' : 'border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-white">{job.name}</h4>
                        {job.number && <p className="text-xs text-neutral-500">#{job.number}</p>}
                      </div>
                      <StatusBadge status={job.status} />
                    </div>
                    {job.description && (
                      <p className="text-sm text-neutral-400 mb-2 line-clamp-2">{job.description}</p>
                    )}
                    {job.address && (
                      <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
                        <MapPin size={12} />
                        <span>{job.address}</span>
                      </div>
                    )}
                    <div className="flex gap-4 text-xs text-neutral-500">
                      {job.salesRep && <span>Rep: {job.salesRep}</span>}
                      {job.createdAt && <span>Created: {new Date(job.createdAt).toLocaleDateString()}</span>}
                    </div>
                    {selectedJobJnid === job.jnid && (
                      <div className="mt-3 pt-3 border-t border-white/5 flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowUpdateStatus(true); }}
                          className="flex-1 py-2 bg-brand-green/20 hover:bg-brand-green/30 rounded-lg text-sm text-brand-green font-medium transition-colors"
                        >
                          Update Status
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowAddNote(true); }}
                          className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-neutral-300 font-medium transition-colors"
                        >
                          Add Note
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-12 text-center">
                  <Briefcase size={48} className="text-neutral-600 mx-auto mb-3" />
                  <p className="text-neutral-500">No jobs found for this contact</p>
                </div>
              )}
            </div>
          )}

          {/* ==================== ACTIVITY TAB ==================== */}
          {activeTab === 'activity' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-neutral-400">Activity Timeline</h3>
                <button
                  onClick={() => setShowAddNote(true)}
                  className="text-xs text-brand-green hover:text-brand-green/80 flex items-center gap-1"
                >
                  <Plus size={14} /> Add Note
                </button>
              </div>
              {data.notes.length > 0 ? (
                data.notes.map(note => (
                  <div key={note.jnid} className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        note.isPortalNote ? 'bg-brand-green/20' : 'bg-white/5'
                      }`}>
                        <MessageCircle size={16} className={note.isPortalNote ? 'text-brand-green' : 'text-neutral-400'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-medium ${note.isPortalNote ? 'text-brand-green' : 'text-neutral-400'}`}>
                            {note.author}
                            {note.isPortalNote && ' (Portal)'}
                          </span>
                          <span className="text-xs text-neutral-500">
                            {note.createdAt ? new Date(note.createdAt).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                            }) : ''}
                          </span>
                        </div>
                        <p className="text-sm text-neutral-300 whitespace-pre-wrap">{note.content}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-12 text-center">
                  <MessageCircle size={48} className="text-neutral-600 mx-auto mb-3" />
                  <p className="text-neutral-500">No activity notes yet</p>
                  <button
                    onClick={() => setShowAddNote(true)}
                    className="mt-3 text-sm text-brand-green hover:text-brand-green/80"
                  >
                    Add the first note
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ==================== ESTIMATES TAB ==================== */}
          {activeTab === 'estimates' && (
            <div className="space-y-3">
              {data.estimates.length > 0 ? (
                data.estimates.map(est => (
                  <div key={est.jnid} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-xl font-bold text-green-400">${est.total.toLocaleString()}</span>
                        {est.number && <span className="ml-2 text-xs text-neutral-500">#{est.number}</span>}
                      </div>
                      <StatusBadge status={est.status || 'Draft'} />
                    </div>
                    {est.description && (
                      <p className="text-sm text-neutral-400 mb-2">{est.description}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-neutral-500 mb-3">
                      <span>Created {est.createdAt ? new Date(est.createdAt).toLocaleDateString() : 'N/A'}</span>
                      {est.tax > 0 && <span>Tax: ${est.tax.toLocaleString()}</span>}
                    </div>
                    {(est.pdfUrl || est.publicUrl) && (
                      <div className="flex gap-2">
                        {est.publicUrl && (
                          <a
                            href={est.publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-2 bg-brand-green/20 hover:bg-brand-green/30 rounded-lg text-sm text-brand-green font-medium transition-colors text-center"
                          >
                            View Estimate
                          </a>
                        )}
                        {est.pdfUrl && (
                          <a
                            href={est.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-neutral-300 font-medium transition-colors text-center"
                          >
                            Download PDF
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-12 text-center">
                  <Receipt size={48} className="text-neutral-600 mx-auto mb-3" />
                  <p className="text-neutral-500">No estimates found</p>
                </div>
              )}
            </div>
          )}

          {/* ==================== DOCUMENTS TAB ==================== */}
          {activeTab === 'documents' && (
            <div className="space-y-3">
              {data.attachments.length > 0 ? (
                data.attachments.map(doc => (
                  <div key={doc.jnid} className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        doc.contentType?.startsWith('image/') ? 'bg-purple-500/20' :
                        doc.contentType === 'application/pdf' ? 'bg-red-500/20' :
                        'bg-white/5'
                      }`}>
                        {doc.contentType?.startsWith('image/') ? (
                          <Camera size={18} className="text-purple-400" />
                        ) : doc.contentType === 'application/pdf' ? (
                          <FileText size={18} className="text-red-400" />
                        ) : (
                          <Paperclip size={18} className="text-neutral-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{doc.filename}</p>
                        <div className="flex items-center gap-3 text-xs text-neutral-500">
                          <span>{formatBytes(doc.size)}</span>
                          {doc.createdAt && <span>{new Date(doc.createdAt).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      {doc.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
                        >
                          <Download size={16} className="text-neutral-400" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-12 text-center">
                  <Paperclip size={48} className="text-neutral-600 mx-auto mb-3" />
                  <p className="text-neutral-500">No documents attached</p>
                </div>
              )}
            </div>
          )}

          {/* ==================== INVOICES TAB ==================== */}
          {activeTab === 'invoices' && (
            <div className="space-y-3">
              {data.invoices.length > 0 ? (
                data.invoices.map(inv => (
                  <div key={inv.jnid} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-xl font-bold text-white">${inv.total.toLocaleString()}</span>
                        {inv.number && <span className="ml-2 text-xs text-neutral-500">#{inv.number}</span>}
                      </div>
                      <StatusBadge status={inv.status || 'Pending'} />
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-neutral-500">Paid</p>
                        <p className="text-sm font-medium text-green-400">${inv.amountPaid.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500">Balance</p>
                        <p className={`text-sm font-medium ${inv.balance > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                          ${inv.balance.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500">Due</p>
                        <p className="text-sm text-neutral-300">
                          {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                    {(inv.pdfUrl || inv.publicUrl) && (
                      <div className="flex gap-2">
                        {inv.publicUrl && (
                          <a href={inv.publicUrl} target="_blank" rel="noopener noreferrer" className="flex-1 py-2 bg-brand-green/20 hover:bg-brand-green/30 rounded-lg text-sm text-brand-green font-medium transition-colors text-center">
                            View Invoice
                          </a>
                        )}
                        {inv.pdfUrl && (
                          <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-neutral-300 font-medium transition-colors text-center">
                            Download PDF
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-12 text-center">
                  <DollarSign size={48} className="text-neutral-600 mx-auto mb-3" />
                  <p className="text-neutral-500">No invoices found</p>
                </div>
              )}
            </div>
          )}

          {/* ==================== STORM/HAIL TAB ==================== */}
          {activeTab === 'storm_hail' && (
            <div className="space-y-4">
              {/* HailRecon Historical Data */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <AlertCircle size={16} className="text-blue-400" />
                  Historical Hail Data (Since 2011)
                </h3>
                <p className="text-neutral-500 text-xs mb-3">Powered by HailRecon - Data loads from customer address area</p>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6 text-center">
                  <p className="text-neutral-400 text-sm">
                    Enter the customer&apos;s address on the Check My Address page to generate a full storm report with HailRecon data.
                  </p>
                  <a
                    href={`/check-my-address`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg text-sm text-blue-400 font-medium transition-colors"
                  >
                    <ExternalLink size={14} />
                    Open Check My Address
                  </a>
                </div>
              </div>

              {/* MeasureMyRoof Embed */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={16} className="text-blue-400" />
                    <h3 className="text-sm font-medium text-white">MeasureMyRoof</h3>
                    <span className="text-xs text-neutral-500">AI-powered roof measurement</span>
                  </div>
                  <a
                    href={`${process.env.NEXT_PUBLIC_MEASUREMYROOF_URL || 'https://www.measuremyroof.tools/'}${contact.address ? '?address=' + encodeURIComponent(`${contact.address}, ${contact.city}, ${contact.state} ${contact.zip}`) : ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink size={12} />
                    Open Full
                  </a>
                </div>
                <iframe
                  src={`${process.env.NEXT_PUBLIC_MEASUREMYROOF_URL || 'https://www.measuremyroof.tools/'}${contact.address ? '?address=' + encodeURIComponent(`${contact.address}, ${contact.city}, ${contact.state} ${contact.zip}`) : ''}`}
                  className="w-full border-0"
                  style={{ height: '500px' }}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                  loading="lazy"
                  title="MeasureMyRoof"
                />
              </div>
            </div>
          )}

          {/* ==================== PORTAL SETTINGS TAB ==================== */}
          {activeTab === 'portal_settings' && (
            <div className="space-y-4">
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                <h3 className="text-sm font-medium text-white mb-1 flex items-center gap-2">
                  <ClipboardList size={16} className="text-brand-green" />
                  Customer Portal Settings
                </h3>
                <p className="text-neutral-500 text-xs mb-4">
                  Control what this customer sees on their portal. &quot;Inherit&quot; uses your default rep settings.
                </p>

                {settingsSaveMsg && (
                  <div className="mb-3 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-xs flex items-center gap-2">
                    <CheckCircle size={14} />
                    {settingsSaveMsg}
                  </div>
                )}

                <div className="space-y-2">
                  {[
                    { key: 'showJobProgress', label: 'Job Progress', desc: 'Progress timeline' },
                    { key: 'showAppointments', label: 'Appointments', desc: 'Scheduled appointments' },
                    { key: 'showDocuments', label: 'Documents', desc: 'Estimates, invoices, contracts' },
                    { key: 'showMessages', label: 'Messages', desc: 'Communication history' },
                    { key: 'showWeather', label: 'Weather', desc: '5-day forecast' },
                    { key: 'showHailReports', label: 'Hail Reports', desc: 'NWS hail activity' },
                    { key: 'showStormReport', label: 'Storm Report', desc: 'Storm damage risk report' },
                    { key: 'showHailRecon', label: 'HailRecon Data', desc: 'Historical hail since 2011' },
                    { key: 'showWeatherAlerts', label: 'Weather Alerts', desc: 'Active NWS alerts' },
                    { key: 'showRiskScore', label: 'Risk Score', desc: 'Storm damage risk score' },
                    { key: 'showDeliveryTracking', label: 'Delivery Tracking', desc: 'Material delivery status' },
                    { key: 'allowFileUpload', label: 'File Uploads', desc: 'Customer can upload files' },
                    { key: 'allowMessages', label: 'Send Messages', desc: 'Customer can message rep' },
                  ].map(({ key, label, desc }) => {
                    const val = customerSettings[key] ?? null;
                    const getNextValue = (): boolean | null => {
                      if (val === null) return true;
                      if (val === true) return false;
                      return null;
                    };
                    const getLabel = (): string => {
                      if (val === null) return 'Inherit';
                      if (val === true) return 'On';
                      return 'Off';
                    };
                    const getStyle = (): string => {
                      if (val === null) return 'bg-neutral-700 text-neutral-300 border-neutral-600';
                      if (val === true) return 'bg-[#39FF14]/20 text-[#39FF14] border-[#39FF14]/40';
                      return 'bg-red-500/20 text-red-400 border-red-500/40';
                    };

                    return (
                      <div key={key} className="flex items-center justify-between px-3 py-2.5 bg-white/[0.02] rounded-xl">
                        <div>
                          <p className="text-white text-sm font-medium">{label}</p>
                          <p className="text-neutral-500 text-xs">{desc}</p>
                        </div>
                        <button
                          onClick={() => setCustomerSettings(prev => ({ ...prev, [key]: getNextValue() }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all min-w-[72px] ${getStyle()}`}
                        >
                          {getLabel()}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={async () => {
                    setSavingCustomerSettings(true);
                    setSettingsSaveMsg('');
                    try {
                      const res = await fetch('/api/portal/customer-settings', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          customerId: contact.jnid,
                          repSlug: contact.salesRep || '',
                          settings: customerSettings,
                        }),
                      });
                      if (res.ok) {
                        setSettingsSaveMsg('Settings saved!');
                        setTimeout(() => setSettingsSaveMsg(''), 3000);
                      }
                    } catch (e) {
                      console.error('Failed to save customer settings:', e);
                    } finally {
                      setSavingCustomerSettings(false);
                    }
                  }}
                  disabled={savingCustomerSettings}
                  className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-brand-green text-black font-medium rounded-xl hover:bg-brand-green/90 transition-colors disabled:opacity-50"
                >
                  {savingCustomerSettings ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  Save Customer Settings
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl border-t border-white/5 px-4 py-2 z-30 sm:hidden">
          <div className="flex items-center justify-around">
            <Link href="/portal/sales" className="flex flex-col items-center p-2 text-neutral-400 hover:text-white">
              <Home size={20} />
              <span className="text-xs mt-1">Home</span>
            </Link>
            <Link href="/portal/sales/customers" className="flex flex-col items-center p-2 text-neutral-400 hover:text-white">
              <Users size={20} />
              <span className="text-xs mt-1">Customers</span>
            </Link>
            <button onClick={handleCall} className="flex flex-col items-center p-3 -mt-4 bg-brand-green rounded-full text-black">
              <Phone size={24} />
            </button>
            <Link href="/portal/sales/performance" className="flex flex-col items-center p-2 text-neutral-400 hover:text-white">
              <BarChart3 size={20} />
              <span className="text-xs mt-1">Stats</span>
            </Link>
            <Link href="/portal/dashboard" className="flex flex-col items-center p-2 text-neutral-400 hover:text-white">
              <Building size={20} />
              <span className="text-xs mt-1">Portal</span>
            </Link>
          </div>
        </nav>
      </div>

      {/* ==================== ADD NOTE MODAL ==================== */}
      {showAddNote && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <h3 className="text-lg font-semibold text-white">Add Note to JobNimbus</h3>
              <button
                onClick={() => { setShowAddNote(false); setNewNote(''); }}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center"
              >
                <X size={18} className="text-neutral-400" />
              </button>
            </div>
            <div className="p-4">
              <div className="mb-3">
                <p className="text-xs text-neutral-400 mb-1">This note will be synced to JobNimbus</p>
                {selectedJob && (
                  <p className="text-xs text-brand-green">Attached to job: {selectedJob.name}</p>
                )}
              </div>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Enter your note..."
                rows={4}
                className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/30 resize-none"
              />
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim() || isSavingNote}
                className="w-full mt-4 py-3 bg-brand-green hover:bg-brand-green/90 disabled:bg-neutral-700 disabled:cursor-not-allowed rounded-xl text-black font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {isSavingNote ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Saving to JobNimbus...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Save Note
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== UPDATE STATUS MODAL ==================== */}
      {showUpdateStatus && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <div>
                <h3 className="text-lg font-semibold text-white">Update Job Status</h3>
                <p className="text-xs text-neutral-400 mt-1">Changes sync to JobNimbus in real-time</p>
              </div>
              <button
                onClick={() => setShowUpdateStatus(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center"
              >
                <X size={18} className="text-neutral-400" />
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
              {statusOptions.map((status) => {
                const isCurrentStatus = selectedJob?.status === status;
                const color = jobStatusColors[status] || 'bg-neutral-500/20 text-neutral-400 ring-neutral-500/30';
                return (
                  <button
                    key={status}
                    onClick={() => !isCurrentStatus && handleStatusUpdate(status)}
                    disabled={updatingStatus || isCurrentStatus}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                      isCurrentStatus ? color : 'bg-white/[0.02] hover:bg-white/[0.05] text-neutral-300'
                    } ${updatingStatus ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className="font-medium">{status}</span>
                    {isCurrentStatus && <CheckCircle size={18} />}
                    {updatingStatus && !isCurrentStatus && (
                      <Loader2 size={16} className="animate-spin text-neutral-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MESSAGE CUSTOMER MODAL ==================== */}
      {showMessageCustomer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-white/5 shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-white">Message {contact.name}</h3>
                <p className="text-xs text-neutral-400 mt-1">Sends to customer portal and logs in JobNimbus</p>
              </div>
              <button
                onClick={() => { setShowMessageCustomer(false); setCustomerMessage(''); setCustomerMessageSubject(''); }}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center"
              >
                <X size={18} className="text-neutral-400" />
              </button>
            </div>

            {/* Message History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {isLoadingMessageHistory ? (
                <div className="flex justify-center py-4">
                  <Loader2 size={20} className="animate-spin text-neutral-500" />
                </div>
              ) : customerMessageHistory.length > 0 ? (
                <>
                  <p className="text-xs text-neutral-500 font-medium mb-2">Message History</p>
                  {customerMessageHistory.slice(0, 10).map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-xl text-sm ${
                        msg.direction === 'outbound'
                          ? 'bg-lime-500/10 border border-lime-500/20 ml-4'
                          : 'bg-white/[0.03] border border-white/5 mr-4'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-medium ${
                          msg.direction === 'outbound' ? 'text-lime-400' : 'text-neutral-400'
                        }`}>
                          {msg.direction === 'outbound' ? msg.sentBy || 'Rep' : 'Customer'}
                        </span>
                        <span className="text-[10px] text-neutral-600">
                          {new Date(msg.sentAt).toLocaleDateString()} {new Date(msg.sentAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-neutral-300 whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ))}
                  {customerMessageHistory.length > 10 && (
                    <p className="text-xs text-neutral-500 text-center">
                      Showing last 10 of {customerMessageHistory.length} messages
                    </p>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <MessageCircle size={32} className="text-neutral-600 mx-auto mb-2" />
                  <p className="text-neutral-500 text-sm">No message history yet</p>
                </div>
              )}
            </div>

            {/* Send Message Form */}
            <div className="p-4 border-t border-white/5 shrink-0 space-y-3">
              {messageSentSuccess && (
                <div className="px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-xs flex items-center gap-2">
                  <CheckCircle size={14} />
                  Message sent and logged successfully!
                </div>
              )}
              <input
                type="text"
                value={customerMessageSubject}
                onChange={(e) => setCustomerMessageSubject(e.target.value)}
                placeholder="Subject (optional)"
                className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-4 py-2.5 text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-lime-500/50 focus:ring-1 focus:ring-lime-500/30"
              />
              <textarea
                value={customerMessage}
                onChange={(e) => setCustomerMessage(e.target.value)}
                placeholder="Type your message to the customer..."
                rows={3}
                className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-lime-500/50 focus:ring-1 focus:ring-lime-500/30 resize-none"
              />
              <button
                onClick={handleSendCustomerMessage}
                disabled={!customerMessage.trim() || isSendingMessage}
                className="w-full py-3 bg-lime-500 hover:bg-lime-400 disabled:bg-neutral-700 disabled:cursor-not-allowed rounded-xl text-black font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {isSendingMessage ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Send Message
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
