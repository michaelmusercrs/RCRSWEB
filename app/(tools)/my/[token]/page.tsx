'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Loader2, Calendar, FileText, MessageSquare, Phone, Mail,
  MapPin, Cloud, CloudRain, Sun, CloudSun, CloudSnow, CloudLightning,
  CloudDrizzle, AlertTriangle, CheckCircle, Clock, Send, ChevronRight,
  Home, User, Wrench, Shield, ExternalLink, CloudFog, Upload, X, Image as ImageIcon,
  Truck, Package
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CustomerData {
  customer: {
    accessToken: string;
    customerId: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    customerAddress: string;
    salesRepId: string;
    salesRepName: string;
    salesRepSlug: string;
    jobId?: string;
    createdAt: string;
    isActive: boolean;
  };
  salesRep: {
    name: string;
    slug: string;
    phone: string;
    email: string;
    photo: string;
    position: string;
  };
  appointments: Array<{
    appointmentId: string;
    type: string;
    title: string;
    description?: string;
    scheduledDate: string;
    scheduledTime: string;
    duration: number;
    status: string;
    assignedTo: string;
  }>;
  documents: Array<{
    documentId: string;
    type: string;
    title: string;
    description?: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
    uploadedAt: string;
  }>;
  messages: Array<{
    messageId: string;
    direction: string;
    subject?: string;
    content: string;
    sentAt: string;
    sentBy?: string;
  }>;
  jobStatus?: {
    phase: string;
    progress: number;
    nextMilestone: string;
    estimatedCompletion?: string;
  };
  weather?: Array<{
    date: string;
    dayOfWeek: string;
    high: number;
    low: number;
    condition: string;
    icon: string;
    precipChance: number;
    windSpeed: number;
  }>;
  hailReports?: Array<{
    reportId: string;
    date: string;
    location: string;
    distance: number;
    hailSize: string;
    severity: string;
  }>;
  settings?: Record<string, boolean>;
}

interface DeliveryInfo {
  ticketId: string;
  jobName: string;
  jobAddress: string;
  scheduledDate: string;
  scheduledTime: string;
  driverName: string | null;
  materialsSummary: string;
  status: string;
  eta: {
    estimatedArrival: string;
    estimatedMinutesAway: number;
  } | null;
}

// ── Helper Components ──────────────────────────────────────────────────────────

const getWeatherIcon = (icon: string) => {
  switch (icon) {
    case 'sun': return <Sun className="text-yellow-400" size={32} />;
    case 'cloud-sun': return <CloudSun className="text-yellow-300" size={32} />;
    case 'cloud': return <Cloud className="text-neutral-400" size={32} />;
    case 'cloud-drizzle': return <CloudDrizzle className="text-blue-300" size={32} />;
    case 'cloud-rain': return <CloudRain className="text-blue-400" size={32} />;
    case 'cloud-snow': return <CloudSnow className="text-blue-100" size={32} />;
    case 'cloud-lightning': return <CloudLightning className="text-yellow-500" size={32} />;
    default: return <CloudFog className="text-neutral-400" size={32} />;
  }
};

const getDocumentIcon = (type: string) => {
  switch (type) {
    case 'estimate': return <FileText className="text-[#39FF14]" size={24} />;
    case 'contract': return <FileText className="text-blue-400" size={24} />;
    case 'invoice': return <FileText className="text-amber-400" size={24} />;
    case 'warranty': return <Shield className="text-emerald-400" size={24} />;
    case 'permit': return <FileText className="text-purple-400" size={24} />;
    case 'inspection_report': return <FileText className="text-orange-400" size={24} />;
    case 'photo': return <ImageIcon className="text-cyan-400" size={24} />;
    default: return <FileText className="text-neutral-400" size={24} />;
  }
};

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CustomerPortal() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'documents' | 'messages' | 'weather'>('overview');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [deliveries, setDeliveries] = useState<DeliveryInfo[]>([]);

  // Fetch portal data on mount
  const fetchPortalData = useCallback(async () => {
    try {
      const response = await fetch(`/api/customer/${token}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('This portal link is invalid or has expired.');
        } else if (response.status === 410) {
          setError('This portal link has expired. Please contact your sales representative for a new one.');
        } else {
          setError('Unable to load your portal. Please try again later.');
        }
        return;
      }
      const result = await response.json();
      setData(result);
    } catch {
      setError('Unable to connect. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPortalData();
  }, [fetchPortalData]);

  // Poll for new messages every 30 seconds when on messages tab
  useEffect(() => {
    if (activeTab !== 'messages' || !data) return;

    const pollInterval = setInterval(() => {
      fetch(`/api/customer/${token}/messages`)
        .then(res => res.ok ? res.json() : null)
        .then(result => {
          if (result && result.messages) {
            setData(prev => prev ? { ...prev, messages: result.messages } : prev);
          }
        })
        .catch(() => {}); // Silent fail for polling
    }, 30000);

    return () => clearInterval(pollInterval);
  }, [activeTab, data, token]);

  // Fetch delivery status
  useEffect(() => {
    if (!data?.customer?.customerPhone) return;

    fetch(`/api/customer/delivery-status?token=${token}&phone=${encodeURIComponent(data.customer.customerPhone)}`)
      .then(res => res.ok ? res.json() : null)
      .then(result => {
        if (result?.deliveries) {
          setDeliveries(result.deliveries);
        }
      })
      .catch(() => {}); // Silent fail
  }, [data?.customer?.customerPhone, token]);

  const sendMessage = async () => {
    if (!message.trim()) return;

    setSending(true);
    try {
      const response = await fetch(`/api/customer/${token}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      });

      if (response.ok) {
        setMessageSent(true);
        setMessage('');
        setTimeout(() => setMessageSent(false), 3000);
        // Refresh messages
        fetch(`/api/customer/${token}/messages`)
          .then(res => res.ok ? res.json() : null)
          .then(result => {
            if (result?.messages) {
              setData(prev => prev ? { ...prev, messages: result.messages } : prev);
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async () => {
    if (!uploadFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('description', uploadDescription);
      formData.append('type', uploadFile.type.startsWith('image/') ? 'photo' : 'other');

      const response = await fetch(`/api/customer/${token}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setUploadSuccess(true);
        setUploadFile(null);
        setUploadDescription('');
        setTimeout(() => {
          setShowUploadModal(false);
          setUploadSuccess(false);
        }, 2000);
        fetchPortalData(); // Refresh documents
      }
    } catch (err) {
      console.error('Error uploading file:', err);
    } finally {
      setUploading(false);
    }
  };

  // ── Loading State ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <Image src="/logo-nobg.png" alt="River City Roofing" width={80} height={80} className="mx-auto mb-6 opacity-80" />
          <Loader2 className="animate-spin text-[#39FF14] mx-auto mb-4" size={48} />
          <p className="text-neutral-400">Loading your portal...</p>
        </div>
      </div>
    );
  }

  // ── Error State ────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="text-red-400" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Access Error</h1>
          <p className="text-neutral-400 mb-6">{error}</p>
          <p className="text-sm text-neutral-500 mb-4">
            If you believe this is a mistake, please contact us:
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="tel:+12562748530"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30 rounded-lg text-sm font-medium hover:bg-[#39FF14]/20 transition-colors"
            >
              <Phone size={16} />
              (256) 274-8530
            </a>
            <a
              href="mailto:rcrs@rivercityroofingsolutions.com"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-800 text-neutral-300 rounded-lg text-sm font-medium hover:bg-neutral-700 transition-colors"
            >
              <Mail size={16} />
              Email Us
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { customer, salesRep, appointments, documents, messages: msgs, jobStatus, weather, hailReports } = data;
  const settings = data.settings || {};
  const showWeather = settings.showWeather !== false;
  const showAppointments = settings.showAppointments !== false;
  const showDocuments = settings.showDocuments !== false;
  const showMessages = settings.showMessages !== false;
  const showHailReports = settings.showHailReports !== false;
  const allowFileUpload = settings.allowFileUpload || settings.allowFileUploads || false;
  const upcomingAppointments = appointments.filter(a => new Date(a.scheduledDate) >= new Date() && a.status !== 'cancelled');

  // ── Main Portal Layout ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      {/* Header */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/logo-nobg.png"
                alt="River City Roofing"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <div>
                <h1 className="font-bold text-white text-lg leading-tight">River City Roofing</h1>
                <p className="text-xs text-[#39FF14]/70">Customer Portal</p>
              </div>
            </div>
            <Link
              href={`/team/${salesRep.slug}`}
              className="flex items-center gap-2 text-sm text-[#39FF14] hover:text-[#39FF14]/80 transition-colors"
            >
              <span className="hidden sm:inline">Your Rep</span>
              <ExternalLink size={16} />
            </Link>
          </div>
        </div>
      </header>

      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-800 border-b border-neutral-800">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h2 className="text-2xl font-bold text-white mb-2">
            Welcome, {customer.customerName.split(' ')[0]}!
          </h2>
          <p className="text-neutral-400 flex items-center gap-2">
            <MapPin size={16} className="text-[#39FF14]" />
            {customer.customerAddress}
          </p>
        </div>
      </div>

      {/* Job Progress */}
      {jobStatus && (
        <div className="max-w-4xl mx-auto px-4 -mt-4 relative z-10">
          <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#39FF14]/10 rounded-lg flex items-center justify-center">
                  <Wrench className="text-[#39FF14]" size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Project Status</h3>
                  <p className="text-sm text-[#39FF14]">{jobStatus.phase}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-[#39FF14]">{jobStatus.progress}%</span>
              </div>
            </div>
            <div className="w-full bg-neutral-800 rounded-full h-3 mb-3">
              <div
                className="bg-gradient-to-r from-[#39FF14] to-[#32d911] h-3 rounded-full transition-all duration-500"
                style={{ width: `${jobStatus.progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-neutral-400">
                Next: <span className="font-medium text-neutral-300">{jobStatus.nextMilestone}</span>
              </p>
              {jobStatus.estimatedCompletion && (
                <p className="text-sm text-neutral-500">
                  Est. {jobStatus.estimatedCompletion}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sales Rep Card */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 hover:border-[#39FF14]/30 hover:shadow-lg hover:shadow-[#39FF14]/5 transition-all duration-200">
          <h3 className="font-semibold text-white mb-4">Your Roofing Specialist</h3>
          <div className="flex items-start gap-4">
            <a
              href={salesRep.slug ? `/team/${salesRep.slug}` : '#'}
              target={salesRep.slug ? '_blank' : undefined}
              rel={salesRep.slug ? 'noopener noreferrer' : undefined}
              className="w-16 h-16 bg-neutral-800 rounded-xl overflow-hidden flex-shrink-0 block hover:ring-2 hover:ring-[#39FF14]/40 transition-all"
            >
              {salesRep.photo ? (
                <Image
                  src={salesRep.photo}
                  alt={salesRep.name}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#39FF14]/10">
                  <User className="text-[#39FF14]" size={28} />
                </div>
              )}
            </a>
            <div className="flex-1">
              <a
                href={salesRep.slug ? `/team/${salesRep.slug}` : '#'}
                target={salesRep.slug ? '_blank' : undefined}
                rel={salesRep.slug ? 'noopener noreferrer' : undefined}
                className="group inline-flex items-center gap-1.5"
              >
                <h4 className="font-semibold text-white group-hover:text-[#39FF14] transition-colors">{salesRep.name}</h4>
                {salesRep.slug && <ExternalLink size={14} className="text-neutral-600 group-hover:text-[#39FF14]/70 transition-colors" />}
              </a>
              <p className="text-sm text-neutral-500 mb-3">{salesRep.position}</p>
              <div className="flex flex-wrap gap-2">
                {salesRep.phone && (
                  <a
                    href={`tel:${salesRep.phone}`}
                    className="inline-flex items-center gap-2 px-4 py-3 bg-[#39FF14] text-black rounded-lg text-sm font-medium hover:bg-[#32d911] active:bg-[#2bc810] transition-colors min-h-[44px]"
                  >
                    <Phone size={16} />
                    Call
                  </a>
                )}
                {salesRep.email && (
                  <a
                    href={`mailto:${salesRep.email}`}
                    className="inline-flex items-center gap-2 px-4 py-3 bg-neutral-800 text-neutral-300 rounded-lg text-sm font-medium hover:bg-neutral-700 active:bg-neutral-600 transition-colors min-h-[44px]"
                  >
                    <Mail size={16} />
                    Email
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { id: 'overview', label: 'Overview', icon: Home, visible: true },
            { id: 'appointments', label: 'Appointments', icon: Calendar, count: upcomingAppointments.length, visible: showAppointments },
            { id: 'documents', label: 'Documents', icon: FileText, count: documents.length, visible: showDocuments },
            { id: 'messages', label: 'Messages', icon: MessageSquare, count: msgs.length, visible: showMessages },
            { id: 'weather', label: 'Weather', icon: Cloud, visible: showWeather },
          ].filter(tab => tab.visible).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#39FF14] text-black'
                  : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-300 border border-neutral-800'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-black/20 text-black' : 'bg-[#39FF14]/10 text-[#39FF14]'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 flex-1">

        {/* ─── Overview Tab ──────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Install Countdown + Quick Stats */}
            {(() => {
              // Calculate days until estimated completion / install
              const estDate = jobStatus?.estimatedCompletion;
              let daysUntil: number | null = null;
              if (estDate) {
                const target = new Date(estDate);
                if (!isNaN(target.getTime())) {
                  daysUntil = Math.ceil((target.getTime() - Date.now()) / 86400000);
                }
              }
              // Also check upcoming appointments for an installation appointment
              const installApt = upcomingAppointments.find(a =>
                a.type === 'install_start' || a.type === 'installation' ||
                a.title?.toLowerCase().includes('install')
              );
              if (!daysUntil && installApt) {
                const aptDate = new Date(installApt.scheduledDate);
                if (!isNaN(aptDate.getTime())) {
                  daysUntil = Math.ceil((aptDate.getTime() - Date.now()) / 86400000);
                }
              }

              return daysUntil !== null && daysUntil > 0 ? (
                <div className="bg-gradient-to-r from-[#39FF14]/10 to-neutral-900 rounded-xl border border-[#39FF14]/30 p-6 text-center">
                  <p className="text-5xl font-bold text-[#39FF14]">{daysUntil}</p>
                  <p className="text-neutral-400 text-sm mt-1">days until {installApt ? 'installation' : 'completion'}</p>
                  {(estDate || installApt) && (
                    <p className="text-[#39FF14]/70 text-xs mt-2 font-medium">
                      {installApt
                        ? `${installApt.title} - ${new Date(installApt.scheduledDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                        : `Estimated: ${estDate}`
                      }
                    </p>
                  )}
                </div>
              ) : null;
            })()}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800">
                <Calendar className="text-blue-400 mb-2" size={24} />
                <p className="text-2xl font-bold text-white">{upcomingAppointments.length}</p>
                <p className="text-sm text-neutral-500">Upcoming</p>
              </div>
              <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800">
                <FileText className="text-purple-400 mb-2" size={24} />
                <p className="text-2xl font-bold text-white">{documents.length}</p>
                <p className="text-sm text-neutral-500">Documents</p>
              </div>
              <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800">
                <MessageSquare className="text-[#39FF14] mb-2" size={24} />
                <p className="text-2xl font-bold text-white">{msgs.length}</p>
                <p className="text-sm text-neutral-500">Messages</p>
              </div>
              <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800">
                <Shield className="text-orange-400 mb-2" size={24} />
                <p className="text-2xl font-bold text-white">{hailReports?.length || 0}</p>
                <p className="text-sm text-neutral-500">Hail Reports</p>
              </div>
            </div>

            {/* Delivery Tracking */}
            {deliveries.length > 0 && (
              <div className="bg-neutral-900 rounded-xl border border-[#39FF14]/30 p-6">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <Truck className="text-[#39FF14]" size={20} />
                  Active Deliveries
                </h3>
                <div className="space-y-3">
                  {deliveries.map((delivery) => (
                    <div key={delivery.ticketId} className="bg-neutral-800 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-white">{delivery.jobName || 'Material Delivery'}</h4>
                          <p className="text-sm text-neutral-400 mt-1">
                            {delivery.scheduledDate} at {delivery.scheduledTime}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          delivery.status === 'delivered' ? 'bg-[#39FF14]/10 text-[#39FF14]' :
                          delivery.status === 'in_transit' ? 'bg-blue-900/40 text-blue-400' :
                          'bg-amber-900/40 text-amber-400'
                        }`}>
                          {delivery.status === 'in_transit' ? 'In Transit' :
                           delivery.status === 'delivered' ? 'Delivered' :
                           delivery.status === 'loaded' ? 'Loaded' :
                           delivery.status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Scheduled'}
                        </span>
                      </div>
                      {delivery.driverName && (
                        <p className="text-sm text-neutral-500">
                          Driver: <span className="text-neutral-300">{delivery.driverName}</span>
                        </p>
                      )}
                      {delivery.eta && (
                        <div className="mt-2 bg-[#39FF14]/5 rounded-lg px-3 py-2 border border-[#39FF14]/20">
                          <p className="text-sm text-[#39FF14] font-medium">
                            ETA: ~{delivery.eta.estimatedMinutesAway} min away
                          </p>
                        </div>
                      )}
                      {delivery.materialsSummary && (
                        <div className="mt-2 flex items-start gap-2">
                          <Package size={14} className="text-neutral-500 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-neutral-500">{delivery.materialsSummary}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next Appointment */}
            {upcomingAppointments.length > 0 && (
              <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <Calendar className="text-blue-400" size={20} />
                  Next Appointment
                </h3>
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-white">{upcomingAppointments[0].title}</h4>
                    <p className="text-sm text-neutral-400 mt-1">
                      {new Date(upcomingAppointments[0].scheduledDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })} at {upcomingAppointments[0].scheduledTime}
                    </p>
                    {upcomingAppointments[0].description && (
                      <p className="text-sm text-neutral-500 mt-2">{upcomingAppointments[0].description}</p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    upcomingAppointments[0].status === 'confirmed'
                      ? 'bg-[#39FF14]/10 text-[#39FF14]'
                      : 'bg-amber-900/40 text-amber-400'
                  }`}>
                    {upcomingAppointments[0].status}
                  </span>
                </div>
              </div>
            )}

            {/* Weather Preview */}
            {weather && weather.length > 0 && (
              <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <Cloud className="text-blue-400" size={20} />
                  Weather Forecast
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                  {weather.slice(0, 5).map((day, i) => (
                    <div key={i} className="text-center">
                      <p className="text-sm font-medium text-neutral-400 mb-2">
                        {i === 0 ? 'Today' : day.dayOfWeek.slice(0, 3)}
                      </p>
                      <div className="flex justify-center mb-2">
                        {getWeatherIcon(day.icon)}
                      </div>
                      <p className="text-lg font-bold text-white">{day.high}°</p>
                      <p className="text-sm text-neutral-500">{day.low}°</p>
                      {day.precipChance > 20 && (
                        <p className="text-xs text-blue-400 mt-1">{day.precipChance}%</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hail Reports */}
            {showHailReports && hailReports && hailReports.length > 0 && (
              <div className="bg-gradient-to-r from-orange-950/40 to-red-950/40 rounded-xl p-6 border border-orange-800/40">
                <h3 className="font-semibold text-orange-300 mb-4 flex items-center gap-2">
                  <AlertTriangle className="text-orange-400" size={20} />
                  Recent Hail Activity in Your Area
                </h3>
                <div className="space-y-3">
                  {hailReports.slice(0, 3).map((report) => (
                    <div key={report.reportId} className="flex items-center justify-between bg-neutral-900/60 rounded-lg p-3">
                      <div>
                        <p className="font-medium text-white">{report.location}</p>
                        <p className="text-sm text-neutral-400">
                          {new Date(report.date).toLocaleDateString()} &middot; {report.hailSize} hail
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        report.severity === 'severe'
                          ? 'bg-red-900/50 text-red-400'
                          : report.severity === 'moderate'
                          ? 'bg-orange-900/50 text-orange-400'
                          : 'bg-yellow-900/50 text-yellow-400'
                      }`}>
                        {report.distance} mi away
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-orange-300/80 mt-4">
                  Hail damage can be hard to spot. Contact us for a free inspection!
                </p>
              </div>
            )}
          </div>
        )}

        {/* ─── Appointments Tab ──────────────────────────────────────── */}
        {activeTab === 'appointments' && (
          <div className="space-y-4">
            {appointments.length === 0 ? (
              <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-8 text-center">
                <Calendar className="text-neutral-700 mx-auto mb-4" size={48} />
                <h3 className="font-semibold text-white mb-2">No Appointments Yet</h3>
                <p className="text-neutral-500">Your scheduled appointments will appear here.</p>
              </div>
            ) : (
              appointments.map((apt) => (
                <div key={apt.appointmentId} className="bg-neutral-900 rounded-xl border border-neutral-800 p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        apt.status === 'completed' ? 'bg-[#39FF14]/10' :
                        apt.status === 'cancelled' ? 'bg-red-900/30' :
                        'bg-blue-900/30'
                      }`}>
                        {apt.status === 'completed' ? (
                          <CheckCircle className="text-[#39FF14]" size={24} />
                        ) : apt.status === 'cancelled' ? (
                          <AlertTriangle className="text-red-400" size={24} />
                        ) : (
                          <Clock className="text-blue-400" size={24} />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">{apt.title}</h4>
                        <p className="text-sm text-neutral-400 mt-1">
                          {new Date(apt.scheduledDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="text-sm text-neutral-500">{apt.scheduledTime} &middot; {apt.duration} min</p>
                        {apt.description && (
                          <p className="text-sm text-neutral-500 mt-2">{apt.description}</p>
                        )}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      apt.status === 'confirmed' ? 'bg-[#39FF14]/10 text-[#39FF14]' :
                      apt.status === 'completed' ? 'bg-blue-900/40 text-blue-400' :
                      apt.status === 'cancelled' ? 'bg-red-900/40 text-red-400' :
                      'bg-amber-900/40 text-amber-400'
                    }`}>
                      {apt.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── Documents Tab ─────────────────────────────────────────── */}
        {activeTab === 'documents' && (
          <div className="space-y-4">
            {/* Upload Button - only shown when file upload is enabled */}
            {allowFileUpload && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="w-full bg-gradient-to-r from-[#39FF14]/20 to-[#32d911]/20 text-[#39FF14] border border-[#39FF14]/30 rounded-xl p-4 font-medium hover:bg-[#39FF14]/30 transition-all flex items-center justify-center gap-2"
              >
                <Upload size={20} />
                Upload Photos or Documents
              </button>
            )}

            {documents.length === 0 ? (
              <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-8 text-center">
                <FileText className="text-neutral-700 mx-auto mb-4" size={48} />
                <h3 className="font-semibold text-white mb-2">No Documents Yet</h3>
                <p className="text-neutral-500">Estimates, contracts, and warranties will appear here.</p>
              </div>
            ) : (
              documents.map((doc) => (
                <a
                  key={doc.documentId}
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 bg-neutral-900 rounded-xl border border-neutral-800 p-5 hover:border-[#39FF14]/30 transition-colors group"
                >
                  <div className="w-12 h-12 bg-neutral-800 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-[#39FF14]/10 transition-colors">
                    {getDocumentIcon(doc.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-white truncate">{doc.title}</h4>
                    {doc.description && (
                      <p className="text-sm text-neutral-400 mt-1 truncate">{doc.description}</p>
                    )}
                    <p className="text-xs text-neutral-600 mt-2">
                      {new Date(doc.uploadedAt).toLocaleDateString()} &middot; {doc.fileType.toUpperCase()}
                      {doc.fileSize > 0 && ` \u00B7 ${(doc.fileSize / 1024 / 1024).toFixed(1)} MB`}
                    </p>
                  </div>
                  <ChevronRight className="text-neutral-600 group-hover:text-[#39FF14] transition-colors flex-shrink-0" size={20} />
                </a>
              ))
            )}
          </div>
        )}

        {/* ─── Messages Tab ──────────────────────────────────────────── */}
        {activeTab === 'messages' && (
          <div className="space-y-6">
            {/* Rep Contact Card */}
            <div className="bg-neutral-900 rounded-xl p-4 border border-[#39FF14]/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#39FF14]/10 rounded-full flex items-center justify-center overflow-hidden">
                  {salesRep.photo ? (
                    <Image src={salesRep.photo} alt={salesRep.name} width={40} height={40} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <User size={20} className="text-[#39FF14]" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Chat with {salesRep.name}</p>
                  <p className="text-xs text-neutral-500">Your {salesRep.position} &mdash; messages are monitored during business hours</p>
                </div>
              </div>
            </div>

            {/* Message History */}
            <div className="space-y-3">
              {msgs.length === 0 ? (
                <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-8 text-center">
                  <MessageSquare className="text-neutral-700 mx-auto mb-4" size={48} />
                  <h3 className="font-semibold text-white mb-2">No Messages Yet</h3>
                  <p className="text-neutral-500">Send your first message below. Your rep will be notified immediately.</p>
                </div>
              ) : (
                msgs.map((msg) => (
                  <div
                    key={msg.messageId}
                    className={`rounded-xl p-4 ${
                      msg.direction === 'outbound'
                        ? 'bg-[#39FF14]/5 border border-[#39FF14]/20 ml-8'
                        : 'bg-neutral-900 border border-neutral-800 mr-8'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {msg.direction === 'outbound' ? (
                          <div className="w-6 h-6 bg-[#39FF14]/20 rounded-full flex items-center justify-center">
                            <User size={12} className="text-[#39FF14]" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 bg-neutral-700 rounded-full flex items-center justify-center">
                            <User size={12} className="text-neutral-400" />
                          </div>
                        )}
                        <span className="text-sm font-medium text-neutral-300">
                          {msg.direction === 'outbound' ? (msg.sentBy || salesRep.name || 'River City Roofing') : 'You'}
                        </span>
                      </div>
                      <span className="text-xs text-neutral-600">
                        {new Date(msg.sentAt).toLocaleDateString()} at{' '}
                        {new Date(msg.sentAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                    {msg.subject && (
                      <p className="text-sm font-medium text-neutral-300 mb-1">{msg.subject}</p>
                    )}
                    <p className="text-neutral-400">{msg.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* Message Input */}
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-5 sticky bottom-0">
              <div className="flex gap-3">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={`Message ${salesRep.name || 'your rep'}...`}
                  rows={2}
                  className="flex-1 bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50 focus:border-transparent resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!message.trim() || sending}
                  className="self-end px-5 py-3 bg-[#39FF14] text-black rounded-xl font-medium hover:bg-[#32d911] disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {sending ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </div>
              {messageSent && (
                <p className="text-sm text-[#39FF14] mt-2 flex items-center gap-2">
                  <CheckCircle size={16} />
                  Message sent! {salesRep.name || 'Your rep'} has been notified.
                </p>
              )}
              <p className="text-xs text-neutral-600 mt-2">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </div>
        )}

        {/* ─── Weather Tab ───────────────────────────────────────────── */}
        {activeTab === 'weather' && (
          <div className="space-y-6">
            {/* 5-Day Forecast */}
            {weather && weather.length > 0 ? (
              <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
                <h3 className="font-semibold text-white mb-4">5-Day Forecast</h3>
                <div className="space-y-3">
                  {weather.map((day, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-neutral-800 rounded-xl">
                      <div className="w-16 text-center">
                        <p className="font-medium text-white">
                          {i === 0 ? 'Today' : day.dayOfWeek.slice(0, 3)}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        {getWeatherIcon(day.icon)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-white">{day.condition}</p>
                        <p className="text-sm text-neutral-500">
                          Wind: {day.windSpeed} mph
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-white">{day.high}°</p>
                        <p className="text-sm text-neutral-500">{day.low}°</p>
                      </div>
                      {day.precipChance > 0 && (
                        <div className="text-right w-16">
                          <p className="text-sm text-blue-400 font-medium">{day.precipChance}%</p>
                          <p className="text-xs text-neutral-600">rain</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-8 text-center">
                <Cloud className="text-neutral-700 mx-auto mb-4" size={48} />
                <h3 className="font-semibold text-white mb-2">Weather Unavailable</h3>
                <p className="text-neutral-500">Weather forecast data is not currently available.</p>
              </div>
            )}

            {/* Hail Reports on Weather Tab */}
            {hailReports && hailReports.length > 0 && (
              <div className="bg-gradient-to-r from-orange-950/40 to-red-950/40 rounded-xl p-6 border border-orange-800/40">
                <h3 className="font-semibold text-orange-300 mb-4 flex items-center gap-2">
                  <AlertTriangle className="text-orange-400" size={20} />
                  Hail Reports Within 50 Miles
                </h3>
                <div className="space-y-3">
                  {hailReports.map((report) => (
                    <div key={report.reportId} className="bg-neutral-900/60 rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-white">{report.location}</h4>
                          <p className="text-sm text-neutral-400 mt-1">
                            {new Date(report.date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            report.severity === 'severe'
                              ? 'bg-red-900/50 text-red-400'
                              : report.severity === 'moderate'
                              ? 'bg-orange-900/50 text-orange-400'
                              : 'bg-yellow-900/50 text-yellow-400'
                          }`}>
                            {report.severity}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-4 mt-3 text-sm">
                        <span className="text-neutral-400">
                          <strong className="text-neutral-300">{report.hailSize}</strong> hail
                        </span>
                        <span className="text-neutral-400">
                          <strong className="text-neutral-300">{report.distance}</strong> miles away
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 bg-neutral-900/80 rounded-xl">
                  <p className="text-sm text-neutral-300 mb-3">
                    <strong>Did you know?</strong> Hail damage often goes unnoticed until it causes bigger problems like leaks. Even small hail can damage shingles.
                  </p>
                  <a
                    href={salesRep.phone ? `tel:${salesRep.phone}` : 'tel:+12562748530'}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-500 transition-colors"
                  >
                    <Phone size={16} />
                    Request Free Hail Inspection
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Footer ──────────────────────────────────────────────────── */}
      <footer className="bg-neutral-900 border-t border-neutral-800 mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Image
                src="/logo-nobg.png"
                alt="River City Roofing"
                width={32}
                height={32}
                className="rounded-lg opacity-80"
              />
              <span className="text-sm text-neutral-400">River City Roofing Solutions</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-neutral-500">
              <a href="tel:+12562748530" className="hover:text-[#39FF14] flex items-center gap-1 transition-colors">
                <Phone size={14} />
                (256) 274-8530
              </a>
              <span className="hidden sm:inline">&bull;</span>
              <a href="mailto:rcrs@rivercityroofingsolutions.com" className="hover:text-[#39FF14] flex items-center gap-1 transition-colors">
                <Mail size={14} />
                rcrs@rivercityroofingsolutions.com
              </a>
              <span className="hidden sm:inline">&bull;</span>
              <span>Hartselle, AL</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ─── Upload Modal ─────────────────────────────────────────── */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-800">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Upload File</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                  setUploadDescription('');
                }}
                className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <X className="text-neutral-400" size={20} />
              </button>
            </div>

            {uploadSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-[#39FF14]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="text-[#39FF14]" size={32} />
                </div>
                <h4 className="font-semibold text-white mb-2">Upload Successful!</h4>
                <p className="text-neutral-400">Your file has been uploaded and shared with your rep.</p>
              </div>
            ) : (
              <>
                {/* File Drop Zone */}
                <label className={`block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  uploadFile ? 'border-[#39FF14]/50 bg-[#39FF14]/5' : 'border-neutral-700 hover:border-[#39FF14]/30 hover:bg-neutral-800/50'
                }`}>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                  {uploadFile ? (
                    <div>
                      <div className="w-12 h-12 bg-[#39FF14]/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                        {uploadFile.type.startsWith('image/') ? (
                          <ImageIcon className="text-[#39FF14]" size={24} />
                        ) : (
                          <FileText className="text-[#39FF14]" size={24} />
                        )}
                      </div>
                      <p className="font-medium text-white">{uploadFile.name}</p>
                      <p className="text-sm text-neutral-400 mt-1">
                        {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setUploadFile(null);
                        }}
                        className="text-sm text-red-400 hover:text-red-300 mt-2"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Upload className="text-neutral-600 mx-auto mb-3" size={32} />
                      <p className="font-medium text-neutral-300">Click to upload or drag and drop</p>
                      <p className="text-sm text-neutral-500 mt-1">
                        Images (JPG, PNG) or Documents (PDF, DOC)
                      </p>
                      <p className="text-xs text-neutral-600 mt-2">Max file size: 10MB</p>
                    </div>
                  )}
                </label>

                {/* Description */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    placeholder="e.g., Photo of roof damage, insurance paperwork..."
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50 focus:border-transparent"
                  />
                </div>

                {/* Upload Button */}
                <button
                  onClick={handleFileUpload}
                  disabled={!uploadFile || uploading}
                  className="w-full mt-6 bg-[#39FF14] text-black py-3 rounded-xl font-medium hover:bg-[#32d911] disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      Upload File
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
