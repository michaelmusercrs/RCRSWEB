'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Phone,
  LogOut,
  Home,
  Calendar,
  Cloud,
  MessageSquare,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sun,
  CloudRain,
  Wind,
  Send,
  ChevronRight,
  RefreshCw,
  MapPin,
  Plus,
  FolderOpen,
  Image,
  Receipt,
  FileSignature,
  Shield,
  ClipboardCheck,
  Download,
  Eye,
  User,
  Star,
  Mail,
  Truck,
  AlertTriangle,
  Upload,
  QrCode,
} from 'lucide-react';
import NextImage from 'next/image';
import ScheduleInspection from '@/components/calendar/ScheduleInspection';
import { trackingService } from '@/lib/tracking-service';

interface CustomerData {
  jnid: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}

interface JobData {
  jnid: string;
  name: string;
  status: string;
  phase: string;
  progress: number;
  address: string;
  startDate?: string;
  estimatedCompletion?: string;
}

interface AppointmentData {
  id: string;
  title: string;
  date: string;
  time: string;
  location?: string;
  type: 'inspection' | 'installation' | 'followup';
  status: 'scheduled' | 'confirmed' | 'completed';
  googleCalendarLink?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  eventType: string;
  status: string;
  customer?: {
    id?: string;
    name: string;
    phone?: string;
    email?: string;
  };
}

interface WeatherData {
  current: {
    temp: number;
    feelsLike?: number;
    humidity?: number;
    windSpeed?: number;
    condition: string;
    icon: string;
    isWorkable?: boolean;
    workabilityReason?: string;
  };
  forecast: Array<{
    date?: string;
    day?: string;
    dayOfWeek?: string;
    high: number;
    low: number;
    condition: string;
    icon?: string;
    precipChance?: number;
    isWorkable?: boolean;
    workable?: boolean;
    workabilityReason?: string;
  }>;
  alerts?: Array<{
    id: string;
    event: string;
    headline: string;
    description: string;
    severity: 'minor' | 'moderate' | 'severe' | 'extreme';
    isHailRelated: boolean;
    affectsRoofing?: boolean;
    expires?: string;
  }>;
  stormRisk?: {
    level: 'low' | 'moderate' | 'high' | 'severe';
    message: string;
    hasActiveAlerts: boolean;
    hasHailRisk: boolean;
    nextBadWeatherDay?: string;
  };
  location?: string;
  lastUpdated?: string;
}

interface HailReport {
  id: string;
  date: string;
  location: string;
  county: string;
  distance: number;
  hailSize: string;
  severity: 'minor' | 'moderate' | 'severe';
}

interface SalesRepReview {
  id: string;
  name: string;
  rating: number;
  text: string;
  date: string;
  source: string;
}

interface SalesRepData {
  slug: string;
  name: string;
  position: string;
  phone: string;
  email: string;
  bio: string;
  tagline?: string;
  profileImage: string;
  truckImage?: string | null;
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  linkedin?: string;
  keyStrengths?: string[];
  reviews: SalesRepReview[];
  averageRating: number;
}

interface Message {
  id: string;
  from: string;
  content: string;
  timestamp: string;
  isCustomer: boolean;
}

interface CustomerDocument {
  id: string;
  jobId: string;
  type: string;
  category: string;
  originalName: string;
  fileUrl: string;
  thumbnailUrl: string | null;
  description: string;
  sharedAt: string;
  repNotes: string | null;
}

// Document type icons and labels
const DOC_TYPE_CONFIG: Record<string, { icon: typeof FileText; color: string; bgColor: string; label: string }> = {
  job_image: { icon: Image, color: 'text-blue-400', bgColor: 'bg-brand-green/20', label: 'Photo' },
  invoice: { icon: Receipt, color: 'text-green-400', bgColor: 'bg-green-500/20', label: 'Invoice' },
  contract: { icon: FileSignature, color: 'text-purple-400', bgColor: 'bg-purple-500/20', label: 'Contract' },
  warranty: { icon: Shield, color: 'text-amber-400', bgColor: 'bg-amber-500/20', label: 'Warranty' },
  inspection_report: { icon: ClipboardCheck, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', label: 'Inspection' },
  insurance_document: { icon: FileText, color: 'text-rose-400', bgColor: 'bg-rose-500/20', label: 'Insurance' },
};

const CATEGORY_LABELS: Record<string, string> = {
  before_photo: 'Before Photo',
  during_photo: 'Progress Photo',
  after_photo: 'After Photo',
  damage_photo: 'Damage Photo',
  completion_photo: 'Completion Photo',
  estimate: 'Estimate',
  progress_invoice: 'Progress Invoice',
  final_invoice: 'Final Invoice',
  credit_memo: 'Credit Memo',
  proposal: 'Proposal',
  signed_contract: 'Signed Contract',
  change_order: 'Change Order',
  addendum: 'Addendum',
  manufacturer_warranty: 'Manufacturer Warranty',
  workmanship_warranty: 'Workmanship Warranty',
  extended_warranty: 'Extended Warranty',
  initial_inspection: 'Initial Inspection',
  progress_inspection: 'Progress Inspection',
  final_inspection: 'Final Inspection',
  third_party_inspection: 'Third Party Inspection',
  claim_documentation: 'Claim Documentation',
  adjuster_report: 'Adjuster Report',
  approval_letter: 'Approval Letter',
  payment_summary: 'Payment Summary',
};

const JOB_PHASES = [
  { id: 'lead', label: 'Initial Contact', icon: Phone },
  { id: 'inspection', label: 'Inspection', icon: Home },
  { id: 'estimate', label: 'Estimate', icon: FileText },
  { id: 'contract', label: 'Contract Signed', icon: CheckCircle2 },
  { id: 'permit', label: 'Permits', icon: FileText },
  { id: 'materials', label: 'Materials Ordered', icon: Building2 },
  { id: 'scheduled', label: 'Scheduled', icon: Calendar },
  { id: 'in_progress', label: 'In Progress', icon: Clock },
  { id: 'complete', label: 'Complete', icon: CheckCircle2 },
];

export default function CustomerDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'status' | 'appointments' | 'weather' | 'messages' | 'documents' | 'rep' | 'upload'>('status');
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [selectedDocType, setSelectedDocType] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  const [salesRep, setSalesRep] = useState<SalesRepData | null>(null);
  const [hailReports, setHailReports] = useState<HailReport[]>([]);
  const [streetViewUrl, setStreetViewUrl] = useState<string>('');
  const [uploadFiles, setUploadFiles] = useState<Array<{ name: string; date: string; url?: string }>>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Fetch appointments from TeamUp calendar
  const fetchCalendarAppointments = async (customerId: string) => {
    setIsLoadingAppointments(true);
    try {
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const response = await fetch(
        `/api/calendar/events?startDate=${startDate}&endDate=${endDate}&customerId=${customerId}`
      );
      const data = await response.json();

      if (data.success && data.events) {
        // Transform calendar events to appointment format
        const calendarAppointments: AppointmentData[] = data.events.map((event: CalendarEvent & { googleCalendarLink?: string }) => {
          const startDate = new Date(event.start);
          return {
            id: event.id,
            title: event.title,
            date: startDate.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
            time: startDate.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            }),
            location: event.location,
            type: event.eventType === 'inspection' ? 'inspection' :
                  event.eventType === 'installation' ? 'installation' : 'followup',
            status: event.status === 'completed' ? 'completed' :
                    event.status === 'confirmed' ? 'confirmed' : 'scheduled',
            googleCalendarLink: event.googleCalendarLink,
          };
        });

        // Merge with existing appointments from JobNimbus
        setAppointments(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const newAppointments = calendarAppointments.filter(a => !existingIds.has(a.id));
          return [...prev, ...newAppointments].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
          );
        });
      }
    } catch (error) {
      console.error('Error fetching calendar appointments:', error);
    } finally {
      setIsLoadingAppointments(false);
    }
  };

  useEffect(() => {
    const session = sessionStorage.getItem('customerSession');
    if (!session) {
      router.push('/customer');
      return;
    }

    const customerData = JSON.parse(session);
    setCustomer(customerData);
    loadDashboardData(customerData.jnid);
  }, [router]);

  const loadDashboardData = async (customerId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/customer/dashboard?customerId=${customerId}`);
      const data = await response.json();

      if (data.success) {
        setJobs(data.jobs || []);
        setAppointments(data.appointments || []);
        setWeather(data.weather || null);
        setMessages(data.messages || []);
        setSalesRep(data.salesRep || null);
        setHailReports(data.hailReports || []);

        // Build Street View URL from customer address
        const session = sessionStorage.getItem('customerSession');
        const sessionData = session ? JSON.parse(session) : {};
        const customerAddress = data.jobs?.[0]?.address || sessionData.address || '';
        if (customerAddress) {
          const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
          if (apiKey) {
            const encoded = encodeURIComponent(customerAddress);
            setStreetViewUrl(
              `https://maps.googleapis.com/maps/api/streetview?size=1200x400&location=${encoded}&key=${apiKey}`
            );
          }
        }

        // Also fetch calendar appointments from TeamUp
        fetchCalendarAppointments(customerId);

        // Fetch customer documents
        fetchCustomerDocuments(customerId);

        // Log portal_opened to Google Sheets for long-term persistence
        try {
          fetch('/api/customer/portal-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerName: sessionData.name || '',
              customerEmail: sessionData.email || '',
              customerId: customerId,
              jobId: data.jobs?.[0]?.jnid || '',
              action: 'portal_opened',
              details: {
                accessMethod: 'session',
                portalVersion: 'v1_dashboard',
                jobCount: (data.jobs || []).length,
              },
            }),
          }).catch(() => {});
        } catch {
          // Silently ignore logging errors
        }
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch customer documents
  const fetchCustomerDocuments = async (customerId: string) => {
    try {
      const response = await fetch(`/api/documents?action=customer-documents&customerId=${customerId}`);
      const data = await response.json();

      if (data.success) {
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('customerSession');
    router.push('/customer');
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !customer) return;

    // Track message sent action
    trackingService.trackPortalAction('message_sent', 'Customer Portal Message');

    const tempMessage: Message = {
      id: Date.now().toString(),
      from: customer.name,
      content: newMessage,
      timestamp: new Date().toISOString(),
      isCustomer: true,
    };

    setMessages([...messages, tempMessage]);
    setNewMessage('');

    try {
      await fetch('/api/customer/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.jnid,
          content: newMessage,
        }),
      });

      // Log message_sent to Google Sheets
      fetch('/api/customer/portal-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customer.name,
          customerEmail: customer.email || '',
          customerId: customer.jnid,
          jobId: jobs[0]?.jnid || '',
          action: 'message_sent',
          details: { messageLength: newMessage.trim().length, channel: 'portal' },
        }),
      }).catch(() => {});
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const getPhaseIndex = (phase: string) => {
    return JOB_PHASES.findIndex(p => p.id === phase);
  };

  const getWeatherIcon = (condition: string) => {
    const lower = condition.toLowerCase();
    if (lower.includes('rain') || lower.includes('storm')) return CloudRain;
    if (lower.includes('cloud')) return Cloud;
    if (lower.includes('wind')) return Wind;
    return Sun;
  };

  if (!customer) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-brand-green animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-neutral-900 border-b border-brand-green/20 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-brand-green" />
              <div>
                <h1 className="text-lg font-bold text-white">River City Roofing</h1>
                <p className="text-xs text-neutral-500">Customer Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="tel:256-274-8530"
                className="hidden sm:flex items-center gap-2 text-brand-green hover:text-white transition-colors"
              >
                <Phone className="w-4 h-4" />
                256-274-8530
              </a>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 bg-neutral-800 rounded-lg text-neutral-500 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Street View Hero */}
      {streetViewUrl && (
        <div className="relative w-full h-48 md:h-64 overflow-hidden border-b border-neutral-800">
          <img
            src={streetViewUrl}
            alt={`Street view of ${customer.address || 'your property'}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 container mx-auto px-0">
            <h2 className="text-2xl font-bold text-white drop-shadow-lg">Welcome, {customer.name.split(' ')[0]}!</h2>
            <p className="text-neutral-400 mt-1 flex items-center gap-2 drop-shadow-lg">
              <MapPin className="w-4 h-4" />
              {customer.address || 'Hartselle, AL'}
            </p>
          </div>
        </div>
      )}

      {/* Welcome Banner (fallback when no Street View) */}
      {!streetViewUrl && (
        <div className="bg-gradient-to-r from-brand-green/20 to-transparent border-b border-brand-green/20 py-6">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold text-white">Welcome, {customer.name.split(' ')[0]}!</h2>
            <p className="text-neutral-500 mt-1 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              {customer.address || 'Hartselle, AL'}
            </p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-neutral-900/50 border-b border-neutral-800 sticky top-[72px] z-40 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="container mx-auto px-4">
          <div className="flex gap-1 py-2 min-w-max">
            {[
              { id: 'status', label: 'Job Status', icon: Home },
              { id: 'rep', label: 'My Rep', icon: User },
              { id: 'documents', label: 'Documents', icon: FolderOpen },
              { id: 'upload', label: 'Upload', icon: Upload },
              { id: 'appointments', label: 'Appointments', icon: Calendar },
              { id: 'weather', label: 'Weather', icon: Cloud },
              { id: 'messages', label: 'Messages', icon: MessageSquare },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                    activeTab === tab.id
                      ? 'bg-brand-green text-black'
                      : 'text-neutral-500 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-brand-green animate-spin" />
          </div>
        ) : (
          <>
            {/* Job Status Tab */}
            {activeTab === 'status' && (
              <div className="space-y-6">
                {jobs.length === 0 ? (
                  <div className="bg-neutral-900 rounded-xl p-8 text-center border border-neutral-800">
                    <Home className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">No Active Projects</h3>
                    <p className="text-neutral-500 mb-4">
                      Ready to start your roofing project? Contact us today!
                    </p>
                    <a
                      href="tel:256-274-8530"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-brand-green text-black font-bold rounded-lg hover:bg-brand-green/90 transition-all"
                    >
                      <Phone className="w-5 h-5" />
                      Call 256-274-8530
                    </a>
                  </div>
                ) : (
                  jobs.map((job) => (
                    <div key={job.jnid} className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
                      <div className="p-6 border-b border-neutral-800">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-xl font-bold text-white">{job.name || 'Roofing Project'}</h3>
                            <p className="text-neutral-500 flex items-center gap-2 mt-1">
                              <MapPin className="w-4 h-4" />
                              {job.address}
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            job.status === 'complete' ? 'bg-green-500/20 text-green-400' :
                            job.status === 'in_progress' ? 'bg-brand-green/20 text-brand-green' :
                            'bg-brand-green/20 text-blue-400'
                          }`}>
                            {job.status?.replace('_', ' ').toUpperCase() || 'ACTIVE'}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-2">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-neutral-500">Progress</span>
                            <span className="text-brand-green font-medium">{job.progress || 0}%</span>
                          </div>
                          <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-green transition-all duration-500"
                              style={{ width: `${job.progress || 0}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Phase Timeline */}
                      <div className="p-6 bg-neutral-950/50">
                        <h4 className="text-sm font-medium text-neutral-500 mb-4">Project Timeline</h4>
                        <div className="relative">
                          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-neutral-700" />
                          <div className="space-y-4">
                            {JOB_PHASES.map((phase, index) => {
                              const currentIndex = getPhaseIndex(job.phase || 'lead');
                              const isComplete = index < currentIndex;
                              const isCurrent = index === currentIndex;
                              const Icon = phase.icon;

                              return (
                                <div key={phase.id} className="flex items-center gap-4 relative">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${
                                    isComplete ? 'bg-brand-green' :
                                    isCurrent ? 'bg-brand-green/50 ring-2 ring-brand-green' :
                                    'bg-neutral-700'
                                  }`}>
                                    {isComplete ? (
                                      <CheckCircle2 className="w-4 h-4 text-black" />
                                    ) : (
                                      <Icon className={`w-4 h-4 ${isCurrent ? 'text-brand-green' : 'text-neutral-500'}`} />
                                    )}
                                  </div>
                                  <span className={`text-sm ${
                                    isComplete || isCurrent ? 'text-white font-medium' : 'text-neutral-500'
                                  }`}>
                                    {phase.label}
                                  </span>
                                  {isCurrent && (
                                    <span className="ml-auto text-xs text-brand-green bg-brand-green/10 px-2 py-1 rounded">
                                      Current
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Next Steps Section */}
                      <div className="p-6 border-t border-neutral-800">
                        <h4 className="text-sm font-medium text-neutral-500 mb-4 flex items-center gap-2">
                          <ChevronRight className="w-4 h-4 text-brand-green" />
                          Next Steps
                        </h4>
                        <div className="space-y-4">
                          {/* Current Step */}
                          {(() => {
                            const currentIndex = getPhaseIndex(job.phase || 'lead');
                            const currentPhase = JOB_PHASES[currentIndex];
                            const nextPhase = JOB_PHASES[currentIndex + 1];
                            const phaseDescriptions: Record<string, string> = {
                              lead: 'We have received your inquiry. A team member will be reaching out to schedule an inspection.',
                              inspection: 'Your roof inspection is being arranged. We will thoroughly assess your roof condition.',
                              estimate: 'We are preparing a detailed estimate based on the inspection findings.',
                              contract: 'Great news! Your contract has been signed. We are moving forward with your project.',
                              permit: 'We are obtaining the necessary permits from your local municipality.',
                              materials: 'Materials for your project have been ordered and are on their way.',
                              scheduled: 'Your installation date has been scheduled. We will confirm the exact timing soon.',
                              in_progress: 'Work is underway on your roof! Our crew is on-site making progress.',
                              complete: 'Your project is complete! We hope you love your new roof.',
                            };
                            return (
                              <>
                                <div className="bg-neutral-800 rounded-lg p-4">
                                  <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 bg-brand-green/20 rounded-full flex items-center justify-center">
                                      <CheckCircle2 className="w-4 h-4 text-brand-green" />
                                    </div>
                                    <div>
                                      <p className="text-white font-medium">Current: {currentPhase?.label || 'In Progress'}</p>
                                    </div>
                                  </div>
                                  <p className="text-neutral-500 text-sm ml-11">
                                    {phaseDescriptions[currentPhase?.id || 'lead']}
                                  </p>
                                </div>
                                {nextPhase && (
                                  <div className="bg-neutral-800/50 rounded-lg p-4 border border-dashed border-neutral-700">
                                    <p className="text-neutral-500 text-xs uppercase mb-1">Up Next</p>
                                    <p className="text-neutral-400 font-medium">{nextPhase.label}</p>
                                  </div>
                                )}
                              </>
                            );
                          })()}

                          {/* Next Appointment */}
                          {appointments.length > 0 && (
                            <div className="bg-neutral-800 rounded-lg p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-brand-green/20 rounded-full flex items-center justify-center">
                                  <Calendar className="w-4 h-4 text-blue-400" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-white font-medium">{appointments[0].title}</p>
                                  <p className="text-neutral-500 text-sm">{appointments[0].date} at {appointments[0].time}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Reminder Buttons */}
                          <div>
                            <p className="text-neutral-500 text-xs uppercase mb-2">Set a Reminder</p>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { label: '1 Day', days: 1 },
                                { label: '3 Days', days: 3 },
                                { label: '1 Week', days: 7 },
                                { label: '1 Month', days: 30 },
                              ].map((reminder) => {
                                const reminderDate = new Date();
                                reminderDate.setDate(reminderDate.getDate() + reminder.days);
                                const dateStr = reminderDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                                const endDate = new Date(reminderDate.getTime() + 30 * 60000);
                                const endStr = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                                const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('River City Roofing - Check Project Status')}&dates=${dateStr}/${endStr}&details=${encodeURIComponent(`Check on your roofing project status at River City Roofing Solutions.\n\nPortal: https://www.rivercityroofingsolutions.com/customer`)}`;
                                return (
                                  <a
                                    key={reminder.label}
                                    href={calUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-400 hover:border-brand-green hover:text-brand-green transition-all"
                                  >
                                    <Calendar className="w-3.5 h-3.5" />
                                    {reminder.label}
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Dates */}
                      {(job.startDate || job.estimatedCompletion) && (
                        <div className="p-6 border-t border-neutral-800 grid grid-cols-2 gap-4">
                          {job.startDate && (
                            <div>
                              <p className="text-xs text-neutral-500 uppercase">Start Date</p>
                              <p className="text-white font-medium">{job.startDate}</p>
                            </div>
                          )}
                          {job.estimatedCompletion && (
                            <div>
                              <p className="text-xs text-neutral-500 uppercase">Est. Completion</p>
                              <p className="text-brand-green font-medium">{job.estimatedCompletion}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* My Rep Tab */}
            {activeTab === 'rep' && salesRep && (
              <div className="space-y-6">
                {/* Sales Rep Profile Card */}
                <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
                  {/* Header with profile image */}
                  <div className="bg-gradient-to-r from-brand-green/20 to-transparent p-6">
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                      {/* Profile Image */}
                      <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-brand-green flex-shrink-0">
                        <NextImage
                          src={salesRep.profileImage}
                          alt={salesRep.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      {/* Info */}
                      <div className="text-center md:text-left flex-1">
                        <h2 className="text-2xl font-bold text-white">{salesRep.name}</h2>
                        <p className="text-brand-green font-medium">{salesRep.position}</p>
                        {salesRep.tagline && (
                          <p className="text-neutral-500 mt-1 italic">&quot;{salesRep.tagline}&quot;</p>
                        )}
                        {/* Rating */}
                        <div className="flex items-center justify-center md:justify-start gap-1 mt-3">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-5 h-5 ${
                                star <= Math.round(salesRep.averageRating)
                                  ? 'text-yellow-400 fill-yellow-400'
                                  : 'text-neutral-400'
                              }`}
                            />
                          ))}
                          <span className="ml-2 text-white font-medium">{salesRep.averageRating.toFixed(1)}</span>
                          <span className="text-neutral-500">({salesRep.reviews.length} reviews)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contact Actions */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border-t border-neutral-800">
                    <a
                      href={`tel:${salesRep.phone}`}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-brand-green text-black font-semibold rounded-lg hover:bg-brand-green/90 transition-all"
                    >
                      <Phone className="w-5 h-5" />
                      Call
                    </a>
                    <a
                      href={`sms:${salesRep.phone}`}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-neutral-800 text-white font-medium rounded-lg hover:bg-neutral-700 transition-all"
                    >
                      <MessageSquare className="w-5 h-5" />
                      Text
                    </a>
                    <a
                      href={`mailto:${salesRep.email}`}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-neutral-800 text-white font-medium rounded-lg hover:bg-neutral-700 transition-all"
                    >
                      <Mail className="w-5 h-5" />
                      Email
                    </a>
                    <a
                      href={`/team/${salesRep.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-neutral-800 text-white font-medium rounded-lg hover:bg-neutral-700 transition-all"
                    >
                      <User className="w-5 h-5" />
                      Profile
                    </a>
                  </div>
                </div>

                {/* Bio Section */}
                <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
                  <h3 className="text-lg font-bold text-white mb-3">About {salesRep.name.split(' ')[0]}</h3>
                  <p className="text-neutral-400 leading-relaxed">{salesRep.bio}</p>

                  {/* Key Strengths */}
                  {salesRep.keyStrengths && salesRep.keyStrengths.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-neutral-500 mb-2">Specialties</h4>
                      <div className="flex flex-wrap gap-2">
                        {salesRep.keyStrengths.map((strength, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-brand-green/20 text-brand-green text-sm rounded-full"
                          >
                            {strength}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Truck Image - What to Expect */}
                {salesRep.truckImage && (
                  <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
                    <div className="p-4 border-b border-neutral-800">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Truck className="w-5 h-5 text-brand-green" />
                        What to Expect
                      </h3>
                      <p className="text-neutral-500 text-sm mt-1">Look for this truck when we arrive at your property</p>
                    </div>
                    <div className="relative aspect-video">
                      <NextImage
                        src={salesRep.truckImage}
                        alt={`${salesRep.name}'s truck`}
                        fill
                        className="object-cover"
                      />
                    </div>
                  </div>
                )}

                {/* Reviews Section */}
                {salesRep.reviews.length > 0 && (
                  <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <Star className="w-5 h-5 text-yellow-400" />
                      Customer Reviews
                    </h3>
                    <div className="space-y-4">
                      {salesRep.reviews.map((review) => (
                        <div key={review.id} className="bg-neutral-800 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-white">{review.name}</span>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-4 h-4 ${
                                    star <= review.rating
                                      ? 'text-yellow-400 fill-yellow-400'
                                      : 'text-neutral-400'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          <p className="text-neutral-400 text-sm">{review.text}</p>
                          <div className="mt-2 text-xs text-neutral-500 flex items-center gap-2">
                            <span>{review.source}</span>
                            <span>•</span>
                            <span>{review.date}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Social Media Links */}
                {(salesRep.facebook || salesRep.instagram || salesRep.tiktok || salesRep.linkedin) && (
                  <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Connect With {salesRep.name.split(' ')[0]}</h3>
                    <div className="flex flex-wrap gap-3">
                      {salesRep.facebook && (
                        <a
                          href={salesRep.facebook}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-brand-green text-black rounded-lg hover:bg-blue-700 transition-all"
                        >
                          Facebook
                        </a>
                      )}
                      {salesRep.instagram && (
                        <a
                          href={salesRep.instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
                        >
                          Instagram
                        </a>
                      )}
                      {salesRep.tiktok && (
                        <a
                          href={salesRep.tiktok}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-black border border-white/20 text-white rounded-lg hover:bg-neutral-800 transition-all"
                        >
                          TikTok
                        </a>
                      )}
                      {salesRep.linkedin && (
                        <a
                          href={salesRep.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-all"
                        >
                          LinkedIn
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Share Your Portal - QR Code */}
                <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
                  <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-brand-green" />
                    Share Your Portal
                  </h3>
                  <p className="text-neutral-500 text-sm mb-4">
                    Download a QR code that links directly to your customer portal. Share it with family members or insurance adjusters for easy access.
                  </p>
                  <a
                    href={`/api/portal/qr/${customer?.jnid || ''}`}
                    download="my-portal-qr.png"
                    className="inline-flex items-center gap-2 px-5 py-3 bg-brand-green text-black font-semibold rounded-lg hover:bg-brand-green/90 transition-all"
                  >
                    <Download className="w-5 h-5" />
                    Download QR Code
                  </a>
                </div>
              </div>
            )}

            {/* No Sales Rep Fallback */}
            {activeTab === 'rep' && !salesRep && (
              <div className="bg-neutral-900 rounded-xl p-8 text-center border border-neutral-800">
                <User className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Team Contact</h3>
                <p className="text-neutral-500 mb-4">
                  Contact our team directly for any questions about your project.
                </p>
                <a
                  href="tel:256-274-8530"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-brand-green text-black font-bold rounded-lg hover:bg-brand-green/90 transition-all"
                >
                  <Phone className="w-5 h-5" />
                  Call (256) 274-8530
                </a>
              </div>
            )}

            {/* Appointments Tab */}
            {activeTab === 'appointments' && (
              <div className="space-y-4">
                {showScheduleForm && customer ? (
                  <ScheduleInspection
                    customerName={customer.name}
                    customerPhone={customer.phone}
                    customerEmail={customer.email}
                    customerId={customer.jnid}
                    customerAddress={customer.address}
                    onScheduled={(event) => {
                      setShowScheduleForm(false);
                      // Refresh appointments
                      fetchCalendarAppointments(customer.jnid);
                    }}
                    onCancel={() => setShowScheduleForm(false)}
                  />
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-white">Your Appointments</h3>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            trackingService.trackPortalAction('schedule_inspection_clicked', 'Customer Portal');
                            setShowScheduleForm(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-brand-green text-black font-medium rounded-lg hover:bg-brand-green/90 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                          Schedule Inspection
                        </button>
                        <a
                          href="tel:256-274-8530"
                          className="text-brand-green hover:underline text-sm"
                        >
                          Need to reschedule? Call us
                        </a>
                      </div>
                    </div>

                    {isLoadingAppointments && (
                      <div className="flex items-center justify-center py-4">
                        <RefreshCw className="w-5 h-5 text-brand-green animate-spin mr-2" />
                        <span className="text-neutral-500 text-sm">Loading appointments...</span>
                      </div>
                    )}

                    {appointments.length === 0 && !isLoadingAppointments ? (
                      <div className="bg-neutral-900 rounded-xl p-8 text-center border border-neutral-800">
                        <Calendar className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">No Scheduled Appointments</h3>
                        <p className="text-neutral-500 mb-4">
                          Ready to get started? Schedule a free roof inspection today.
                        </p>
                        <button
                          onClick={() => setShowScheduleForm(true)}
                          className="inline-flex items-center gap-2 px-6 py-3 bg-brand-green text-black font-bold rounded-lg hover:bg-brand-green/90 transition-all"
                        >
                          <Calendar className="w-5 h-5" />
                          Schedule Free Inspection
                        </button>
                      </div>
                    ) : (
                      appointments.map((apt) => (
                        <div
                          key={apt.id}
                          className="bg-neutral-900 rounded-xl p-6 border border-neutral-800"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                              apt.type === 'inspection' ? 'bg-brand-green/20' :
                              apt.type === 'installation' ? 'bg-brand-green/20' :
                              'bg-purple-500/20'
                            }`}>
                              <Calendar className={`w-6 h-6 ${
                                apt.type === 'inspection' ? 'text-blue-400' :
                                apt.type === 'installation' ? 'text-brand-green' :
                                'text-purple-400'
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-white">{apt.title}</h4>
                              <p className="text-neutral-500 text-sm">{apt.date} at {apt.time}</p>
                              {apt.location && (
                                <p className="text-neutral-500 text-xs flex items-center gap-1 mt-1">
                                  <MapPin className="w-3 h-3" />
                                  {apt.location}
                                </p>
                              )}
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${
                              apt.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                              apt.status === 'completed' ? 'bg-gray-400/20 text-neutral-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {apt.status.toUpperCase()}
                            </span>
                          </div>

                          {/* Google Calendar + Maps actions */}
                          {apt.status !== 'completed' && (
                            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-neutral-800">
                              {apt.googleCalendarLink && (
                                <a
                                  href={apt.googleCalendarLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 px-4 py-2 bg-brand-green text-black text-sm font-medium rounded-lg hover:bg-brand-green/90 transition-all"
                                >
                                  <Calendar className="w-4 h-4" />
                                  Add to Google Calendar
                                </a>
                              )}
                              {apt.location && (
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(apt.location)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 px-4 py-2 bg-neutral-800 text-neutral-300 text-sm rounded-lg hover:bg-neutral-700 transition-colors"
                                >
                                  <MapPin className="w-4 h-4" />
                                  View on Map
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>
            )}

            {/* Weather Tab */}
            {activeTab === 'weather' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">Weather Conditions</h3>
                  <span className="text-neutral-500 text-sm">{weather?.location || customer?.address || 'Hartselle, AL'}</span>
                </div>

                {/* Storm Risk Alert Banner */}
                {weather?.stormRisk && weather.stormRisk.level !== 'low' && (
                  <div className={`rounded-xl p-4 border ${
                    weather.stormRisk.level === 'severe' ? 'bg-red-500/10 border-red-500/30' :
                    weather.stormRisk.level === 'high' ? 'bg-orange-500/10 border-orange-500/30' :
                    'bg-yellow-500/10 border-yellow-500/30'
                  }`}>
                    <div className="flex items-start gap-3">
                      <AlertCircle className={`w-6 h-6 flex-shrink-0 ${
                        weather.stormRisk.level === 'severe' ? 'text-red-400' :
                        weather.stormRisk.level === 'high' ? 'text-orange-400' :
                        'text-yellow-400'
                      }`} />
                      <div className="flex-1">
                        <h4 className={`font-bold ${
                          weather.stormRisk.level === 'severe' ? 'text-red-400' :
                          weather.stormRisk.level === 'high' ? 'text-orange-400' :
                          'text-yellow-400'
                        }`}>
                          {weather.stormRisk.level.charAt(0).toUpperCase() + weather.stormRisk.level.slice(1)} Storm Risk
                        </h4>
                        <p className="text-neutral-500 text-sm mt-1">{weather.stormRisk.message}</p>
                        {weather.stormRisk.hasHailRisk && (
                          <span className="inline-block mt-2 px-2 py-1 bg-brand-green/20 text-blue-400 text-xs rounded">
                            Hail Risk Detected
                          </span>
                        )}
                      </div>
                      <a
                        href="tel:256-274-8530"
                        className="px-4 py-2 bg-brand-green text-black text-sm font-bold rounded-lg hover:bg-brand-green/90 transition-all whitespace-nowrap"
                      >
                        Call About Damage
                      </a>
                    </div>
                  </div>
                )}

                {/* Active Weather Alerts */}
                {weather?.alerts && weather.alerts.length > 0 && (
                  <div className="space-y-3">
                    {weather.alerts.slice(0, 3).map((alert) => (
                      <div
                        key={alert.id}
                        className={`rounded-xl p-4 border ${
                          alert.severity === 'extreme' || alert.severity === 'severe'
                            ? 'bg-red-500/10 border-red-500/30'
                            : alert.severity === 'moderate'
                            ? 'bg-orange-500/10 border-orange-500/30'
                            : 'bg-yellow-500/10 border-yellow-500/30'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <CloudRain className={`w-5 h-5 flex-shrink-0 ${
                            alert.severity === 'extreme' || alert.severity === 'severe'
                              ? 'text-red-400'
                              : alert.severity === 'moderate'
                              ? 'text-orange-400'
                              : 'text-yellow-400'
                          }`} />
                          <div>
                            <p className="font-medium text-white">{alert.event}</p>
                            <p className="text-neutral-500 text-sm mt-1">{alert.headline}</p>
                            {alert.isHailRelated && (
                              <span className="inline-block mt-2 px-2 py-0.5 bg-brand-green/20 text-blue-400 text-xs rounded">
                                Hail Alert
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Current Weather */}
                <div className="bg-gradient-to-br from-brand-green/20 to-transparent rounded-xl p-6 border border-brand-green/30">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-brand-green/20 rounded-2xl flex items-center justify-center">
                      {weather?.current ? (
                        (() => {
                          const WeatherIcon = getWeatherIcon(weather.current.condition);
                          return <WeatherIcon className="w-10 h-10 text-brand-green" />;
                        })()
                      ) : (
                        <Sun className="w-10 h-10 text-brand-green" />
                      )}
                    </div>
                    <div>
                      <p className="text-5xl font-bold text-white">
                        {weather?.current?.temp || 72}°F
                      </p>
                      <p className="text-neutral-500 mt-1">
                        {weather?.current?.condition || 'Partly Cloudy'}
                      </p>
                    </div>
                    <div className="ml-auto text-right">
                      {weather?.current?.windSpeed !== undefined && (
                        <div className="flex items-center gap-2 text-neutral-500 text-sm">
                          <Wind className="w-4 h-4" />
                          <span>{weather.current.windSpeed} mph wind</span>
                        </div>
                      )}
                      {weather?.current?.humidity !== undefined && (
                        <p className="text-neutral-500 text-sm mt-1">
                          {weather.current.humidity}% humidity
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Workability Status */}
                  <div className="mt-4 pt-4 border-t border-brand-green/20">
                    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${
                      weather?.current?.isWorkable !== false
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {weather?.current?.isWorkable !== false ? (
                        <>
                          <Sun className="w-4 h-4" />
                          <span className="font-medium">Good Conditions for Roofing Work</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4" />
                          <span className="font-medium">
                            {weather?.current?.workabilityReason || 'Weather Hold - Not Ideal for Roofing'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* 7-Day Forecast */}
                <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
                  <div className="p-4 border-b border-neutral-800">
                    <h4 className="font-bold text-white">7-Day Forecast</h4>
                    <p className="text-neutral-500 text-sm">Work condition predictions for your project</p>
                  </div>
                  <div className="divide-y divide-neutral-800">
                    {(weather?.forecast || [
                      { dayOfWeek: 'Today', high: 72, low: 58, condition: 'Sunny', isWorkable: true },
                      { dayOfWeek: 'Tomorrow', high: 68, low: 55, condition: 'Partly Cloudy', isWorkable: true },
                      { dayOfWeek: 'Wednesday', high: 65, low: 52, condition: 'Cloudy', isWorkable: true },
                      { dayOfWeek: 'Thursday', high: 60, low: 48, condition: 'Rain', isWorkable: false },
                      { dayOfWeek: 'Friday', high: 70, low: 54, condition: 'Sunny', isWorkable: true },
                      { dayOfWeek: 'Saturday', high: 72, low: 56, condition: 'Partly Cloudy', isWorkable: true },
                      { dayOfWeek: 'Sunday', high: 75, low: 58, condition: 'Sunny', isWorkable: true },
                    ]).map((day, index) => {
                      const WeatherIcon = getWeatherIcon(day.condition);
                      const isWorkable = day.isWorkable ?? day.workable ?? true;
                      const dayName = day.dayOfWeek || day.day || `Day ${index + 1}`;
                      return (
                        <div key={index} className={`p-4 flex items-center gap-4 ${!isWorkable ? 'bg-red-500/5' : ''}`}>
                          <div className="w-24 text-neutral-500">{dayName}</div>
                          <WeatherIcon className={`w-6 h-6 ${isWorkable ? 'text-brand-green' : 'text-red-400'}`} />
                          <div className="flex-1 text-neutral-500">{day.condition}</div>
                          {day.precipChance !== undefined && day.precipChance > 0 && (
                            <div className="text-blue-400 text-sm">{day.precipChance}%</div>
                          )}
                          <div className="text-white font-medium">{day.high}° / {day.low}°</div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            isWorkable
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {isWorkable ? 'Workable' : 'Hold'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Storm Damage CTA */}
                {(weather?.stormRisk?.hasHailRisk || weather?.alerts?.some(a => a.isHailRelated)) && (
                  <div className="bg-brand-green/10 rounded-xl p-6 border border-blue-500/30">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-brand-green/20 rounded-xl flex items-center justify-center">
                        <CloudRain className="w-6 h-6 text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-white">Worried About Storm Damage?</h4>
                        <p className="text-neutral-500 text-sm mt-1">
                          Hail and severe weather can cause hidden roof damage. Get a free inspection to check for issues.
                        </p>
                      </div>
                      <a
                        href="tel:256-274-8530"
                        className="px-6 py-3 bg-brand-green text-black font-bold rounded-lg hover:bg-blue-400 transition-all flex items-center gap-2"
                      >
                        <Phone className="w-5 h-5" />
                        Free Inspection
                      </a>
                    </div>
                  </div>
                )}

                {/* Recent Hail Reports */}
                {hailReports.length > 0 && (
                  <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
                    <div className="p-4 border-b border-neutral-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-white flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-blue-400" />
                            Recent Hail Reports Near You
                          </h4>
                          <p className="text-neutral-500 text-sm">Reports from the past 30 days within 50 miles</p>
                        </div>
                        <a
                          href="tel:256-274-8530"
                          className="px-4 py-2 bg-brand-green text-black text-sm font-bold rounded-lg hover:bg-blue-400 transition-all"
                        >
                          Free Hail Check
                        </a>
                      </div>
                    </div>
                    <div className="divide-y divide-neutral-800 max-h-64 overflow-y-auto">
                      {hailReports.slice(0, 5).map((report) => (
                        <div key={report.id} className="p-4 flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            report.severity === 'severe' ? 'bg-red-500/20' :
                            report.severity === 'moderate' ? 'bg-orange-500/20' :
                            'bg-yellow-500/20'
                          }`}>
                            <Cloud className={`w-5 h-5 ${
                              report.severity === 'severe' ? 'text-red-400' :
                              report.severity === 'moderate' ? 'text-orange-400' :
                              'text-yellow-400'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <p className="text-white font-medium">{report.location}</p>
                            <p className="text-neutral-500 text-sm">{report.county} County • {report.date}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-brand-green font-bold">{report.hailSize}</p>
                            <p className="text-neutral-500 text-sm">{report.distance} mi away</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-4 bg-brand-green/5 border-t border-neutral-800">
                      <p className="text-neutral-500 text-sm text-center">
                        Hail damage is often invisible from the ground. Request a free professional inspection.
                      </p>
                    </div>
                  </div>
                )}

                <div className="bg-neutral-900/50 rounded-lg p-4 border border-neutral-800">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-brand-green flex-shrink-0 mt-0.5" />
                    <p className="text-neutral-500 text-sm">
                      Weather conditions can affect roofing work schedules. We monitor conditions closely
                      and will contact you if any delays are expected due to weather.
                      {weather?.lastUpdated && (
                        <span className="block mt-2 text-neutral-500 text-xs">
                          Last updated: {new Date(weather.lastUpdated).toLocaleString()}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Messages Tab */}
            {activeTab === 'messages' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">Messages</h3>

                <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
                  {/* Messages List */}
                  <div className="h-96 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                      <div className="text-center py-12">
                        <MessageSquare className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                        <p className="text-neutral-500">No messages yet. Send us a message below!</p>
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.isCustomer ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                            msg.isCustomer
                              ? 'bg-brand-green text-black rounded-br-sm'
                              : 'bg-neutral-800 text-white rounded-bl-sm'
                          }`}>
                            <p className="text-sm">{msg.content}</p>
                            <p className={`text-xs mt-1 ${
                              msg.isCustomer ? 'text-black/60' : 'text-neutral-500'
                            }`}>
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Message Input */}
                  <div className="p-4 border-t border-neutral-800 bg-neutral-950">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Type your message..."
                        className="flex-1 px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-gray-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim()}
                        className="px-4 py-3 bg-brand-green text-black rounded-lg hover:bg-brand-green/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-xs text-neutral-500 mt-2">
                      For urgent matters, please call{' '}
                      <a href="tel:256-274-8530" className="text-brand-green">256-274-8530</a>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Documents Tab */}
            {activeTab === 'documents' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">Your Documents</h3>
                  <span className="text-sm text-neutral-500">
                    {documents.length} document{documents.length !== 1 ? 's' : ''} shared
                  </span>
                </div>

                {/* Document Type Filters */}
                <div className="flex gap-2 overflow-x-auto pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <button
                    onClick={() => setSelectedDocType('all')}
                    className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                      selectedDocType === 'all'
                        ? 'bg-brand-green text-black font-medium'
                        : 'bg-neutral-800 text-neutral-500 hover:text-white'
                    }`}
                  >
                    All Types
                  </button>
                  {Object.entries(DOC_TYPE_CONFIG).map(([type, config]) => {
                    const docCount = documents.filter(d => d.type === type).length;
                    if (docCount === 0) return null;
                    const Icon = config.icon;
                    return (
                      <button
                        key={type}
                        onClick={() => setSelectedDocType(type)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                          selectedDocType === type
                            ? `${config.bgColor} ${config.color} font-medium`
                            : 'bg-neutral-800 text-neutral-500 hover:text-white'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {config.label}
                        <span className="text-xs opacity-70">({docCount})</span>
                      </button>
                    );
                  })}
                </div>

                {/* Documents List */}
                {documents.length === 0 ? (
                  <div className="bg-neutral-900 rounded-xl p-8 text-center border border-neutral-800">
                    <FolderOpen className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">No Documents Yet</h3>
                    <p className="text-neutral-500">
                      Documents will appear here when shared by your project manager.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {documents
                      .filter(doc => selectedDocType === 'all' || doc.type === selectedDocType)
                      .map((doc) => {
                        const config = DOC_TYPE_CONFIG[doc.type] || DOC_TYPE_CONFIG.insurance_document;
                        const Icon = config.icon;
                        const categoryLabel = CATEGORY_LABELS[doc.category] || doc.category;

                        return (
                          <div
                            key={doc.id}
                            className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden hover:border-neutral-700 transition-colors"
                          >
                            {/* Document preview/icon */}
                            <div className={`h-32 flex items-center justify-center ${config.bgColor}`}>
                              {doc.thumbnailUrl ? (
                                <img
                                  src={doc.thumbnailUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Icon className={config.color} size={48} />
                              )}
                            </div>

                            {/* Document info */}
                            <div className="p-4">
                              <div className="mb-2">
                                <h4 className="font-medium text-white truncate">{doc.originalName}</h4>
                                <p className="text-sm text-neutral-500 truncate">{doc.description || 'No description'}</p>
                              </div>

                              {/* Category badge */}
                              <div className="flex items-center gap-2 mb-3">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.color}`}>
                                  {categoryLabel}
                                </span>
                                <span className="text-xs text-neutral-500">
                                  {new Date(doc.sharedAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </span>
                              </div>

                              {/* Rep notes */}
                              {doc.repNotes && (
                                <div className="bg-neutral-800 rounded-lg p-2 mb-3">
                                  <p className="text-xs text-neutral-500 flex items-start gap-1">
                                    <MessageSquare size={12} className="mt-0.5 shrink-0" />
                                    {doc.repNotes}
                                  </p>
                                </div>
                              )}

                              {/* Actions */}
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    trackingService.trackPortalAction('document_view', doc.type);
                                    // Log document_viewed to Google Sheets
                                    fetch('/api/customer/portal-log', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        customerName: customer?.name || '',
                                        customerEmail: customer?.email || '',
                                        customerId: customer?.jnid || '',
                                        jobId: doc.jobId || jobs[0]?.jnid || '',
                                        action: 'document_viewed',
                                        details: { documentId: doc.id, documentName: doc.originalName, documentType: doc.type, category: doc.category },
                                      }),
                                    }).catch(() => {});
                                    window.open(doc.fileUrl, '_blank');
                                  }}
                                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-white transition-colors"
                                >
                                  <Eye size={14} />
                                  View
                                </button>
                                <button
                                  onClick={() => {
                                    trackingService.trackPortalAction('document_download', doc.type);
                                    // Log document_downloaded to Google Sheets
                                    fetch('/api/customer/portal-log', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        customerName: customer?.name || '',
                                        customerEmail: customer?.email || '',
                                        customerId: customer?.jnid || '',
                                        jobId: doc.jobId || jobs[0]?.jnid || '',
                                        action: 'document_downloaded',
                                        details: { documentId: doc.id, documentName: doc.originalName, documentType: doc.type, category: doc.category },
                                      }),
                                    }).catch(() => {});
                                    const a = document.createElement('a');
                                    a.href = doc.fileUrl;
                                    a.download = doc.originalName;
                                    a.click();
                                  }}
                                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-brand-green hover:bg-brand-green/90 rounded-lg text-sm text-black font-medium transition-colors"
                                >
                                  <Download size={14} />
                                  Download
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Help text */}
                <div className="bg-neutral-900/50 rounded-lg p-4 border border-neutral-800">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-brand-green flex-shrink-0 mt-0.5" />
                    <p className="text-neutral-500 text-sm">
                      These documents have been shared with you by your River City Roofing team.
                      If you need additional documents or have questions, please contact us at{' '}
                      <a href="tel:256-274-8530" className="text-brand-green">256-274-8530</a>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Upload Tab */}
            {activeTab === 'upload' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-white">Upload Photos & Documents</h3>

                {/* Upload Area */}
                <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
                  <div className="border-2 border-dashed border-neutral-700 rounded-xl p-8 text-center hover:border-brand-green/50 transition-colors">
                    <Upload className="w-12 h-12 text-neutral-500 mx-auto mb-4" />
                    <p className="text-white font-medium mb-2">Upload Photos or Documents</p>
                    <p className="text-neutral-500 text-sm mb-4">
                      Share roof damage photos, insurance documents, or any files related to your project.
                    </p>
                    <label className="inline-flex items-center gap-2 px-6 py-3 bg-brand-green text-black font-bold rounded-lg hover:bg-brand-green/90 transition-all cursor-pointer">
                      <Upload className="w-5 h-5" />
                      {uploadingFile ? 'Uploading...' : 'Choose Files'}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf,.doc,.docx"
                        multiple
                        disabled={uploadingFile}
                        onChange={async (e) => {
                          const files = e.target.files;
                          if (!files || files.length === 0 || !customer) return;
                          setUploadingFile(true);

                          for (let i = 0; i < files.length; i++) {
                            const file = files[i];
                            try {
                              const formData = new FormData();
                              formData.append('file', file);
                              formData.append('customerId', customer.jnid);
                              formData.append('customerName', customer.name);

                              const res = await fetch('/api/customer/upload', {
                                method: 'POST',
                                body: formData,
                              });
                              const data = await res.json();

                              if (data.success) {
                                setUploadFiles((prev) => [
                                  ...prev,
                                  {
                                    name: file.name,
                                    date: new Date().toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    }),
                                    url: data.url,
                                  },
                                ]);
                              }
                            } catch (error) {
                              console.error('Upload error:', error);
                            }
                          }
                          setUploadingFile(false);
                          // Reset the input
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <p className="text-neutral-400 text-xs mt-3">
                      Accepted: Images (JPG, PNG, HEIC), PDFs, Word documents. Max 10MB per file.
                    </p>
                  </div>
                </div>

                {/* Uploaded Files List */}
                {uploadFiles.length > 0 && (
                  <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
                    <div className="p-4 border-b border-neutral-800">
                      <h4 className="font-bold text-white">Uploaded Files</h4>
                      <p className="text-neutral-500 text-sm">{uploadFiles.length} file{uploadFiles.length !== 1 ? 's' : ''} uploaded this session</p>
                    </div>
                    <div className="divide-y divide-neutral-800">
                      {uploadFiles.map((file, index) => (
                        <div key={index} className="p-4 flex items-center gap-4">
                          <div className="w-10 h-10 bg-brand-green/20 rounded-lg flex items-center justify-center">
                            {file.name.match(/\.(jpg|jpeg|png|gif|heic|webp)$/i) ? (
                              <Image className="w-5 h-5 text-brand-green" />
                            ) : (
                              <FileText className="w-5 h-5 text-brand-green" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{file.name}</p>
                            <p className="text-neutral-500 text-sm">{file.date}</p>
                          </div>
                          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload Help */}
                <div className="bg-neutral-900/50 rounded-lg p-4 border border-neutral-800">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-brand-green flex-shrink-0 mt-0.5" />
                    <p className="text-neutral-500 text-sm">
                      Uploaded files will be shared with your River City Roofing project team.
                      This is a great way to share photos of storm damage, insurance paperwork,
                      or any other documents related to your roofing project.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 safe-area-pb">
        <div className="flex justify-around py-2">
          {[
            { id: 'status', icon: Home },
            { id: 'documents', icon: FolderOpen },
            { id: 'upload', icon: Upload },
            { id: 'appointments', icon: Calendar },
            { id: 'weather', icon: Cloud },
            { id: 'messages', icon: MessageSquare },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`p-3 rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'text-brand-green bg-brand-green/10'
                    : 'text-neutral-500'
                }`}
              >
                <Icon className="w-5 h-5" />
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
