'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Phone,
  Mail,
  Lock,
  User,
  Building2,
  LogOut,
  Home,
  Calendar,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudDrizzle,
  CloudLightning,
  CloudSun,
  CloudFog,
  MessageSquare,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sun,
  Wind,
  Send,
  ChevronRight,
  RefreshCw,
  MapPin,
  Upload,
  Download,
  Eye,
  Truck,
  AlertTriangle,
  Camera,
  Droplets,
  Shield,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PortalSettings {
  showJobProgress: boolean;
  showAppointments: boolean;
  showDocuments: boolean;
  showMessages: boolean;
  showWeather: boolean;
  showHailReports: boolean;
  showStormReport: boolean;
  showHailRecon: boolean;
  showWeatherAlerts: boolean;
  showRiskScore: boolean;
  showDeliveryTracking: boolean;
  allowFileUpload: boolean;
  allowMessages: boolean;
  // alternate key names from the API
  allowFileUploads?: boolean;
  allowSendMessages?: boolean;
}

interface StormReportData {
  reportId: string;
  generatedAt: string;
  fullAddress: string;
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Severe';
  riskScore: number;
  riskFactors: string[];
  recommendation: string;
  totalHailReports: number;
  closestHailMiles: number | null;
  largestHailSize: string | null;
  hailEvents: {
    date: string;
    size: string;
    severity: 'minor' | 'moderate' | 'severe';
    distance: number;
    location: string;
  }[];
}

interface CustomerInfo {
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
}

interface SalesRep {
  name: string;
  slug: string;
  phone: string;
  email: string;
  photo: string;
  position: string;
  truckImage?: string;
  bio?: string;
  tagline?: string;
}

interface Appointment {
  appointmentId: string;
  customerId: string;
  type: string;
  title: string;
  description?: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  status: string;
  assignedTo: string;
  notes?: string;
  createdAt: string;
}

interface Document {
  documentId: string;
  customerId: string;
  type: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileType: string;
  fileSize?: number;
  uploadedAt: string;
  uploadedBy: string;
  isVisible: boolean;
}

interface Message {
  messageId: string;
  customerId: string;
  direction: string;
  channel: string;
  subject?: string;
  content: string;
  sentAt: string;
  readAt?: string;
  sentBy?: string;
}

interface JobStatus {
  phase: string;
  progress: number;
  nextMilestone: string;
  estimatedCompletion?: string | null;
}

interface WeatherForecast {
  date: string;
  dayOfWeek: string;
  high: number;
  low: number;
  condition: string;
  icon: string;
  precipChance: number;
  windSpeed: number;
  humidity?: number;
}

interface HailReport {
  reportId?: string;
  id?: string;
  date: string;
  location: string;
  distance: number;
  hailSize: string;
  source: string;
  severity: 'minor' | 'moderate' | 'severe';
}

interface PortalData {
  customer: CustomerInfo;
  salesRep: SalesRep;
  appointments: Appointment[];
  documents: Document[];
  messages: Message[];
  jobStatus: JobStatus | null;
  weather: WeatherForecast[];
  hailReports: HailReport[];
  stormReports: StormReportData[];
  settings: PortalSettings;
  dataSource?: string;
  jobs?: Array<{
    jnid: string;
    name: string;
    status: string;
    phase: string;
    progress: number;
    address: string;
    startDate?: string;
    estimatedCompletion?: string;
  }>;
}

// Delivery tracking types
interface DeliveryInfo {
  id: string;
  status: 'scheduled' | 'loading' | 'in_transit' | 'arriving' | 'delivered';
  driverName: string;
  estimatedArrival?: string;
  scheduledDate: string;
  materials: string;
  proofPhotoUrl?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const JOB_PHASES = [
  { id: 'lead', label: 'Lead', description: 'We received your inquiry and a team member will reach out soon.' },
  { id: 'inspection', label: 'Inspection', description: 'Your roof inspection has been scheduled with our team.' },
  { id: 'estimate', label: 'Estimate', description: 'We are preparing a detailed estimate based on the inspection.' },
  { id: 'contract', label: 'Contract Signed', description: 'Your contract is signed. We are moving forward!' },
  { id: 'permit', label: 'Permit Approved', description: 'Permits have been submitted to the local municipality.' },
  { id: 'materials', label: 'Materials Ordered', description: 'Roofing materials are on order and being prepared.' },
  { id: 'scheduled', label: 'Install Scheduled', description: 'Your installation date has been locked in.' },
  { id: 'in_progress', label: 'In Progress', description: 'Our crew is on-site working on your new roof!' },
  { id: 'quality_check', label: 'Quality Check', description: 'Final inspection to make sure everything is perfect.' },
  { id: 'complete', label: 'Complete', description: 'Your project is complete. Enjoy your new roof!' },
];

const DELIVERY_STAGES = [
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'loading', label: 'Loading' },
  { id: 'in_transit', label: 'In Transit' },
  { id: 'arriving', label: 'Arriving' },
  { id: 'delivered', label: 'Delivered' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWeatherIcon(iconName: string) {
  const map: Record<string, React.ComponentType<{ className?: string }>> = {
    sun: Sun,
    'cloud-sun': CloudSun,
    cloud: Cloud,
    'cloud-drizzle': CloudDrizzle,
    'cloud-rain': CloudRain,
    'cloud-snow': CloudSnow,
    'cloud-lightning': CloudLightning,
    'cloud-fog': CloudFog,
  };
  return map[iconName] || Cloud;
}

function getPhaseIndex(phase: string): number {
  return JOB_PHASES.findIndex((p) => p.id === phase);
}

function extractZipCode(address: string): string {
  const match = address.match(/\b(\d{5})\b/);
  return match ? match[1] : '35640'; // default to Hartselle
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function buildGoogleCalendarUrl(params: {
  title: string;
  startDate: string;
  startTime: string;
  durationMinutes: number;
  description?: string;
  location?: string;
}): string {
  // Parse date parts
  const dateParts = params.startDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const timeParts = params.startTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!dateParts || !timeParts) {
    // Fallback: use the raw strings
    const now = new Date();
    const dateStr = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const end = new Date(now.getTime() + params.durationMinutes * 60000);
    const endStr = end.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(params.title)}&dates=${dateStr}/${endStr}&details=${encodeURIComponent(params.description || '')}&location=${encodeURIComponent(params.location || '')}`;
  }

  let hour = parseInt(timeParts[1], 10);
  const minute = parseInt(timeParts[2], 10);
  const ampm = timeParts[3]?.toUpperCase();
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;

  const year = parseInt(dateParts[3], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const day = parseInt(dateParts[2], 10);

  const start = new Date(year, month, day, hour, minute);
  const end = new Date(start.getTime() + params.durationMinutes * 60000);

  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(params.title)}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent(params.description || '')}&location=${encodeURIComponent(params.location || '')}`;
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'severe':
      return { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' };
    case 'moderate':
      return { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' };
    default:
      return { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' };
  }
}

function canUpload(settings: PortalSettings): boolean {
  return settings.allowFileUpload || settings.allowFileUploads || false;
}

function canSendMessages(settings: PortalSettings): boolean {
  return settings.allowMessages || settings.allowSendMessages || false;
}

// ---------------------------------------------------------------------------
// Skeleton Components
// ---------------------------------------------------------------------------

function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
      <div className="h-5 bg-gray-100 rounded w-1/3 mb-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-gray-100 rounded mb-3" style={{ width: `${70 + Math.random() * 30}%` }} />
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-100 rounded w-48 mb-2" />
        <div className="h-4 bg-gray-100 rounded w-64" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonCard lines={5} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Login Screen
// ---------------------------------------------------------------------------

function LoginScreen({
  onAuthenticated,
  initialToken,
}: {
  onAuthenticated: (token: string) => void;
  initialToken?: string;
}) {
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone' | 'code'>('code');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [accessCode, setAccessCode] = useState(initialToken || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // If initial token provided, auto-submit
  useEffect(() => {
    if (initialToken) {
      onAuthenticated(initialToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (loginMethod === 'code' && accessCode.trim()) {
        // Direct token access
        onAuthenticated(accessCode.trim());
        return;
      }

      const response = await fetch('/api/customer/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: loginMethod,
          email: loginMethod === 'email' ? email : undefined,
          phone: loginMethod === 'phone' ? phone : undefined,
          accessCode: loginMethod === 'code' ? accessCode : undefined,
        }),
      });

      const data = await response.json();

      if (data.success && data.customer) {
        // Session-based login succeeded; store and redirect to dashboard
        sessionStorage.setItem('customerSession', JSON.stringify(data.customer));
        window.location.href = '/customer/dashboard';
      } else {
        setError(data.error || 'Unable to find your account. Please contact us at (256) 274-8530.');
      }
    } catch {
      setError('Connection error. Please try again or call us at (256) 274-8530.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-gray-50 border-b border-[#0066CC]/20 py-4">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8 text-[#0066CC]" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">River City Roofing</h1>
              <p className="text-xs text-gray-500">Customer Portal</p>
            </div>
          </div>
          <a
            href="tel:2562748530"
            className="flex items-center gap-2 text-[#0066CC] hover:text-gray-900 transition-colors"
          >
            <Phone className="w-4 h-4" />
            <span className="hidden sm:inline">(256) 274-8530</span>
          </a>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl border border-[#0066CC]/30 p-8 shadow-2xl shadow-lime-500/5">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#0066CC]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-[#0066CC]" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
              <p className="text-gray-500 mt-2">
                Access your project status, appointments, and more
              </p>
            </div>

            {/* Login Method Tabs */}
            <div className="flex gap-2 mb-6">
              {[
                { id: 'code' as const, label: 'Code', icon: Lock },
                { id: 'email' as const, label: 'Email', icon: Mail },
                { id: 'phone' as const, label: 'Phone', icon: Phone },
              ].map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    onClick={() => setLoginMethod(m.id)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      loginMethod === m.id
                        ? 'bg-[#0066CC] text-white'
                        : 'bg-gray-100 text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 inline mr-1" />
                    {m.label}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {loginMethod === 'code' && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Access Code
                  </label>
                  <input
                    type="text"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder="Enter your access code"
                    className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-all tracking-widest text-center font-mono"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Your access code was provided in your welcome email or text
                  </p>
                </div>
              )}
              {loginMethod === 'email' && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-all"
                    required
                  />
                </div>
              )}
              {loginMethod === 'phone' && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="256-555-1234"
                    className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-all"
                    required
                  />
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-500/15 border border-red-500/40 rounded-lg text-red-400 text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[#0066CC] text-white font-bold rounded-lg hover:bg-[#0077dd] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Signing In...
                  </span>
                ) : (
                  'Access My Portal'
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200 text-center">
              <p className="text-gray-500 text-sm">
                Need help? Call us at{' '}
                <a href="tel:2562748530" className="text-[#0066CC] hover:underline">
                  (256) 274-8530
                </a>
              </p>
            </div>
          </div>

          {/* Feature previews */}
          <div className="mt-8 grid grid-cols-2 gap-4 text-center">
            {[
              { label: 'Track Progress', desc: 'Real-time job status' },
              { label: 'Appointments', desc: 'View & manage schedule' },
              { label: 'Weather', desc: 'Project weather updates' },
              { label: 'Messages', desc: 'Direct communication' },
            ].map((f) => (
              <div key={f.label} className="bg-white/50 rounded-lg p-4 border border-gray-200">
                <div className="text-[#0066CC] font-bold text-lg">{f.label}</div>
                <p className="text-gray-500 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="bg-gray-50 border-t border-gray-200 py-4 text-center text-gray-500 text-sm">
        <p>River City Roofing Solutions - Hartselle, AL</p>
        <p className="mt-1">Family-Owned Since 2018</p>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Section Components
// ---------------------------------------------------------------------------

// --- Job Progress Timeline ---
function JobProgressTimeline({ jobStatus, jobs }: { jobStatus: JobStatus | null; jobs?: PortalData['jobs'] }) {
  if (!jobStatus) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <Home className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Projects</h3>
        <p className="text-gray-500 text-sm mb-4">
          Ready to start your roofing project? Give us a call!
        </p>
        <a
          href="tel:2562748530"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#0066CC] text-white font-bold rounded-lg hover:bg-[#0077dd] transition-all"
        >
          <Phone className="w-5 h-5" />
          Call (256) 274-8530
        </a>
      </div>
    );
  }

  // Determine current phase index from the phase label or id
  const currentPhaseId = JOB_PHASES.find(
    (p) => p.label === jobStatus.phase || p.id === jobStatus.phase
  )?.id;
  const currentIndex = currentPhaseId ? getPhaseIndex(currentPhaseId) : Math.floor((jobStatus.progress / 100) * (JOB_PHASES.length - 1));

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Home className="w-5 h-5 text-[#0066CC]" />
            Project Progress
          </h3>
          <span className="text-[#0066CC] font-bold text-lg">{jobStatus.progress}%</span>
        </div>
        {/* Progress bar */}
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#2ee00d] to-[#39FF14] rounded-full transition-all duration-700 ease-out"
            style={{ width: `${jobStatus.progress}%` }}
          />
        </div>
        {jobStatus.estimatedCompletion && (
          <p className="text-gray-500 text-sm mt-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Estimated completion: <span className="text-[#0066CC] font-medium">{jobStatus.estimatedCompletion}</span>
          </p>
        )}
      </div>

      {/* Timeline */}
      <div className="p-6">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-200" />
          <div className="space-y-1">
            {JOB_PHASES.map((phase, index) => {
              const isComplete = index < currentIndex;
              const isCurrent = index === currentIndex;
              const isFuture = index > currentIndex;

              return (
                <div key={phase.id} className={`relative flex items-start gap-4 py-2 ${isFuture ? 'opacity-40' : ''}`}>
                  {/* Circle */}
                  <div
                    className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      isComplete
                        ? 'bg-[#0066CC]'
                        : isCurrent
                        ? 'bg-white ring-2 ring-[#0066CC] ring-offset-2 ring-offset-zinc-900'
                        : 'bg-gray-200'
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="w-4 h-4 text-black" />
                    ) : isCurrent ? (
                      <div className="w-2.5 h-2.5 bg-[#0066CC] rounded-full animate-pulse" />
                    ) : (
                      <div className="w-2 h-2 bg-zinc-500 rounded-full" />
                    )}
                  </div>

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${isComplete || isCurrent ? 'text-gray-900' : 'text-gray-500'}`}>
                        {phase.label}
                      </span>
                      {isCurrent && (
                        <span className="px-2 py-0.5 bg-[#0066CC]/15 text-[#0066CC] text-xs font-medium rounded-full">
                          Current Stage
                        </span>
                      )}
                    </div>
                    {isCurrent && (
                      <p className="text-gray-500 text-xs mt-1">{phase.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Next milestone */}
      {jobStatus.nextMilestone && jobStatus.progress < 100 && (
        <div className="px-6 pb-6">
          <div className="bg-[#0066CC]/10 border border-[#0066CC]/20 rounded-lg p-4">
            <p className="text-sm text-gray-500">
              <span className="text-[#0066CC] font-medium">Next up:</span> {jobStatus.nextMilestone}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Appointments Widget ---
function AppointmentsWidget({
  appointments,
  customerAddress,
}: {
  appointments: Appointment[];
  customerAddress: string;
}) {
  const now = new Date();
  const upcoming = appointments
    .filter((a) => a.status !== 'cancelled' && a.status !== 'completed')
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  const past = appointments
    .filter((a) => a.status === 'completed')
    .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());

  const [showPast, setShowPast] = useState(false);

  if (appointments.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Appointments Scheduled</h3>
        <p className="text-gray-500 text-sm mb-4">
          We will reach out soon to schedule your first appointment.
        </p>
        <a
          href="tel:2562748530"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0066CC] text-white font-bold rounded-lg hover:bg-[#0077dd] transition-all text-sm"
        >
          <Phone className="w-4 h-4" />
          Call to Schedule
        </a>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-5 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#0066CC]" />
          Appointments
        </h3>
        <span className="text-sm text-gray-500">{upcoming.length} upcoming</span>
      </div>

      {/* Upcoming */}
      <div className="divide-y divide-gray-200">
        {upcoming.length === 0 && (
          <div className="p-5 text-center text-gray-500 text-sm">
            No upcoming appointments. Contact us to schedule.
          </div>
        )}
        {upcoming.map((apt) => {
          const calUrl = buildGoogleCalendarUrl({
            title: `${apt.title} - River City Roofing`,
            startDate: apt.scheduledDate,
            startTime: apt.scheduledTime,
            durationMinutes: apt.duration || 60,
            description: apt.description || `Appointment with ${apt.assignedTo} from River City Roofing Solutions.`,
            location: customerAddress,
          });

          return (
            <div key={apt.appointmentId} className="p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#0066CC]/15 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-6 h-6 text-[#0066CC]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900">{apt.title}</h4>
                  <p className="text-gray-500 text-sm mt-0.5">
                    {apt.scheduledDate} at {apt.scheduledTime}
                  </p>
                  {apt.assignedTo && (
                    <p className="text-gray-500 text-xs mt-1">
                      With {apt.assignedTo}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <a
                      href={calUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-[#0066CC] font-medium transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Add to Google Calendar
                    </a>
                    <a
                      href="tel:2562748530"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-400 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Reschedule
                    </a>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                    apt.status === 'confirmed'
                      ? 'bg-green-500/15 text-green-400'
                      : apt.status === 'rescheduled'
                      ? 'bg-orange-500/15 text-orange-400'
                      : 'bg-[#0066CC]/15 text-[#0066CC]'
                  }`}
                >
                  {apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Past appointments */}
      {past.length > 0 && (
        <div className="border-t border-gray-200">
          <button
            onClick={() => setShowPast(!showPast)}
            className="w-full p-4 flex items-center justify-between text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <span>Past appointments ({past.length})</span>
            {showPast ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showPast && (
            <div className="divide-y divide-gray-200 border-t border-gray-200">
              {past.map((apt) => (
                <div key={apt.appointmentId} className="p-4 flex items-center gap-3 opacity-60">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 text-sm font-medium">{apt.title}</p>
                    <p className="text-gray-500 text-xs">{apt.scheduledDate}</p>
                  </div>
                  <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded">Completed</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Documents Section ---
function DocumentsSection({
  documents,
  allowUpload,
  token,
  customerName: docCustomerName,
  customerEmail: docCustomerEmail,
  customerId: docCustomerId,
  jobId: docJobId,
}: {
  documents: Document[];
  allowUpload: boolean;
  token: string;
  customerName?: string;
  customerEmail?: string;
  customerId?: string;
  jobId?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docTypeIcon: Record<string, { icon: any; color: string }> = {
    estimate: { icon: FileText, color: 'text-blue-400' },
    contract: { icon: Shield, color: 'text-purple-400' },
    invoice: { icon: FileText, color: 'text-green-400' },
    warranty: { icon: Shield, color: 'text-amber-400' },
    permit: { icon: FileText, color: 'text-cyan-400' },
    inspection_report: { icon: FileText, color: 'text-teal-400' },
    photo: { icon: Camera, color: 'text-pink-400' },
    other: { icon: FileText, color: 'text-gray-500' },
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadError('');
    setUploadSuccess('');

    for (let i = 0; i < files.length; i++) {
      try {
        const formData = new FormData();
        formData.append('file', files[i]);
        formData.append('type', 'other');
        formData.append('description', 'Uploaded from customer portal');

        const res = await fetch(`/api/customer/${token}/upload`, {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          setUploadSuccess(`Successfully uploaded ${files[i].name}`);
        } else {
          const data = await res.json();
          setUploadError(data.error || 'Upload failed. Please try again.');
        }
      } catch {
        setUploadError('Upload failed. Please check your connection and try again.');
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (documents.length === 0 && !allowUpload) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Documents Yet</h3>
        <p className="text-gray-500 text-sm">
          Documents will appear here when your project team shares them with you.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#0066CC]" />
            Documents
          </h3>
          <span className="text-sm text-gray-500">{documents.length} file{documents.length !== 1 ? 's' : ''}</span>
        </div>

        {documents.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            No documents shared yet. Check back soon!
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {documents.map((doc) => {
              const config = docTypeIcon[doc.type] || docTypeIcon.other;
              const Icon = config.icon;
              return (
                <div key={doc.documentId} className="p-4 flex items-center gap-4 hover:bg-gray-100/50 transition-colors">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 text-sm font-medium truncate">{doc.title}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                      <span className="capitalize">{doc.type.replace('_', ' ')}</span>
                      {doc.fileSize ? (
                        <>
                          <span>-</span>
                          <span>{formatFileSize(doc.fileSize)}</span>
                        </>
                      ) : null}
                      <span>-</span>
                      <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {doc.fileUrl && doc.fileUrl !== '#' && (
                      <>
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                          title="View"
                          onClick={() => {
                            fetch('/api/customer/portal-log', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                customerName: docCustomerName || '',
                                customerEmail: docCustomerEmail || '',
                                customerId: docCustomerId || '',
                                jobId: docJobId || '',
                                action: 'document_viewed',
                                details: { documentId: doc.documentId, title: doc.title, type: doc.type },
                              }),
                            }).catch(() => {});
                          }}
                        >
                          <Eye className="w-4 h-4 text-gray-400" />
                        </a>
                        <a
                          href={doc.fileUrl}
                          download
                          className="p-2 bg-[#0066CC]/15 hover:bg-[#0066CC]/25 rounded-lg transition-colors"
                          title="Download"
                          onClick={() => {
                            fetch('/api/customer/portal-log', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                customerName: docCustomerName || '',
                                customerEmail: docCustomerEmail || '',
                                customerId: docCustomerId || '',
                                jobId: docJobId || '',
                                action: 'document_downloaded',
                                details: { documentId: doc.documentId, title: doc.title, type: doc.type },
                              }),
                            }).catch(() => {});
                          }}
                        >
                          <Download className="w-4 h-4 text-[#0066CC]" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload section */}
      {allowUpload && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="text-gray-900 font-medium mb-3 flex items-center gap-2">
            <Upload className="w-4 h-4 text-[#0066CC]" />
            Upload Files
          </h4>
          <div className="border-2 border-dashed border-gray-300 hover:border-[#0066CC]/40 rounded-xl p-6 text-center transition-colors">
            <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
            <p className="text-gray-500 text-sm mb-3">
              Share photos, insurance docs, or other project files
            </p>
            <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0066CC] text-white font-bold rounded-lg hover:bg-[#0077dd] transition-all cursor-pointer text-sm">
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Choose Files'}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf,.doc,.docx"
                multiple
                disabled={uploading}
                onChange={handleUpload}
              />
            </label>
            <p className="text-gray-400 text-xs mt-2">JPG, PNG, PDF, DOC - Max 10MB</p>
          </div>
          {uploadSuccess && (
            <div className="mt-3 p-3 bg-green-500/15 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {uploadSuccess}
            </div>
          )}
          {uploadError && (
            <div className="mt-3 p-3 bg-red-500/15 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {uploadError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Messages Section ---
function MessagesSection({
  messages,
  allowSend,
  token,
  customerName,
  customerEmail,
  customerId,
  jobId,
}: {
  messages: Message[];
  allowSend: boolean;
  token: string;
  customerName: string;
  customerEmail?: string;
  customerId?: string;
  jobId?: string;
}) {
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>(messages);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localMessages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);

    const tempMsg: Message = {
      messageId: `temp-${Date.now()}`,
      customerId: '',
      direction: 'inbound',
      channel: 'portal',
      content: newMessage.trim(),
      sentAt: new Date().toISOString(),
      sentBy: customerName,
    };
    setLocalMessages((prev) => [...prev, tempMsg]);
    setNewMessage('');

    try {
      await fetch(`/api/customer/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage.trim(), subject: 'Portal Message' }),
      });

      // Log message_sent to Google Sheets
      fetch('/api/customer/portal-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName || '',
          customerEmail: customerEmail || '',
          customerId: customerId || '',
          jobId: jobId || '',
          action: 'message_sent',
          details: { messageLength: newMessage.trim().length, channel: 'portal' },
        }),
      }).catch(() => {});
    } catch (err) {
      console.error('Failed to send message:', err);
    }
    setSending(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col" style={{ maxHeight: '600px' }}>
      <div className="p-5 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-[#0066CC]" />
          Messages
        </h3>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: '200px', maxHeight: '400px' }}>
        {localMessages.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No messages yet</p>
            {allowSend && <p className="text-gray-500 text-xs mt-1">Send a message below to get started</p>}
          </div>
        ) : (
          localMessages.map((msg) => {
            const isOutbound = msg.direction === 'outbound';
            return (
              <div
                key={msg.messageId}
                className={`flex ${isOutbound ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    isOutbound
                      ? 'bg-gray-100 text-gray-900 rounded-bl-sm'
                      : 'bg-[#0066CC] text-white rounded-br-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <div className={`flex items-center gap-2 mt-1 ${isOutbound ? 'text-gray-500' : 'text-black/50'}`}>
                    <p className="text-xs">
                      {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {msg.readAt && <CheckCircle2 className="w-3 h-3" />}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Send form */}
      {allowSend ? (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Type your message..."
              className="flex-1 px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-all text-sm"
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              className="px-4 py-3 bg-[#0066CC] text-white rounded-lg hover:bg-[#0077dd] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            For urgent matters, call{' '}
            <a href="tel:2562748530" className="text-[#0066CC]">(256) 274-8530</a>
          </p>
        </div>
      ) : (
        <div className="p-4 border-t border-gray-200 bg-gray-50 text-center">
          <p className="text-gray-500 text-sm">
            Contact us at{' '}
            <a href="tel:2562748530" className="text-[#0066CC]">(256) 274-8530</a>{' '}
            to send a message.
          </p>
        </div>
      )}
    </div>
  );
}

// --- Weather Widget ---
function WeatherWidget({ forecasts, location }: { forecasts: WeatherForecast[]; location: string }) {
  if (!forecasts || forecasts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <Cloud className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Weather Unavailable</h3>
        <p className="text-gray-500 text-sm">We could not load weather data at this time.</p>
      </div>
    );
  }

  const today = forecasts[0];
  const Icon = getWeatherIcon(today?.icon || 'cloud');

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Current */}
      <div className="p-6 bg-gradient-to-br from-[#0066CC]/10 to-transparent">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Sun className="w-5 h-5 text-[#0066CC]" />
            Weather
          </h3>
          <span className="text-gray-500 text-sm">{location}</span>
        </div>
        <div className="flex items-center gap-5 mt-4">
          <div className="w-16 h-16 bg-[#0066CC]/15 rounded-2xl flex items-center justify-center">
            <Icon className="w-8 h-8 text-[#0066CC]" />
          </div>
          <div>
            <p className="text-4xl font-bold text-gray-900">{today.high}°F</p>
            <p className="text-gray-500 text-sm">{today.condition}</p>
          </div>
          <div className="ml-auto text-right space-y-1">
            <div className="flex items-center gap-1.5 text-gray-500 text-sm justify-end">
              <Wind className="w-3.5 h-3.5" />
              {today.windSpeed} mph
            </div>
            <div className="flex items-center gap-1.5 text-gray-500 text-sm justify-end">
              <Droplets className="w-3.5 h-3.5" />
              {today.precipChance}% rain
            </div>
          </div>
        </div>
      </div>

      {/* 5-day forecast */}
      <div className="p-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-medium">5-Day Forecast</p>
        <div className="space-y-0 divide-y divide-gray-200/50">
          {forecasts.slice(0, 5).map((day, i) => {
            const DayIcon = getWeatherIcon(day.icon || 'cloud');
            return (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <span className="w-20 text-sm text-gray-500 truncate">{day.dayOfWeek}</span>
                <DayIcon className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <span className="flex-1 text-sm text-gray-500 truncate">{day.condition}</span>
                {day.precipChance > 0 && (
                  <span className="text-xs text-blue-400">{day.precipChance}%</span>
                )}
                <span className="text-sm text-gray-900 font-medium w-20 text-right">
                  {day.high}° / {day.low}°
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Note */}
      <div className="px-4 pb-4">
        <div className="bg-gray-100/50 rounded-lg p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-[#0066CC] flex-shrink-0 mt-0.5" />
          <p className="text-gray-500 text-xs">
            Weather may affect your project schedule. We monitor conditions closely and will notify you of any changes.
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Hail Report Widget ---
function HailReportWidget({ reports, customerAddress }: { reports: HailReport[]; customerAddress: string }) {
  if (!reports || reports.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-[#0066CC]" />
          Hail Reports
        </h3>
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
          <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-green-400 font-medium">No Recent Hail Activity</p>
          <p className="text-gray-500 text-sm mt-1">No hail has been reported near your area in the past 30 days.</p>
        </div>
      </div>
    );
  }

  const severeCounts = {
    severe: reports.filter((r) => r.severity === 'severe').length,
    moderate: reports.filter((r) => r.severity === 'moderate').length,
    minor: reports.filter((r) => r.severity === 'minor').length,
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
            Hail Reports
          </h3>
          <span className="text-sm text-gray-500">{reports.length} reports nearby</span>
        </div>
        {/* Severity summary */}
        <div className="flex gap-3 mt-3">
          {severeCounts.severe > 0 && (
            <span className="px-2.5 py-1 bg-red-500/15 text-red-400 text-xs font-medium rounded-full">
              {severeCounts.severe} Severe
            </span>
          )}
          {severeCounts.moderate > 0 && (
            <span className="px-2.5 py-1 bg-orange-500/15 text-orange-400 text-xs font-medium rounded-full">
              {severeCounts.moderate} Moderate
            </span>
          )}
          {severeCounts.minor > 0 && (
            <span className="px-2.5 py-1 bg-yellow-500/15 text-yellow-400 text-xs font-medium rounded-full">
              {severeCounts.minor} Minor
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
        {reports.slice(0, 5).map((report, i) => {
          const colors = getSeverityColor(report.severity);
          return (
            <div key={report.reportId || report.id || i} className="p-4 flex items-center gap-4">
              <div className={`w-10 h-10 ${colors.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <Cloud className={`w-5 h-5 ${colors.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 text-sm font-medium">{report.location}</p>
                <p className="text-gray-500 text-xs">{new Date(report.date).toLocaleDateString()}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[#0066CC] font-bold text-sm">{report.hailSize}</p>
                <p className="text-gray-500 text-xs">{report.distance} mi away</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="p-4 border-t border-gray-200 bg-[#39FF14]/5">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-gray-900 text-sm font-medium">Worried about hail damage?</p>
            <p className="text-gray-500 text-xs mt-0.5">Hail damage is often invisible from the ground.</p>
          </div>
          <a
            href="tel:2562748530"
            className="px-4 py-2 bg-[#0066CC] text-white text-sm font-bold rounded-lg hover:bg-[#0077dd] transition-all whitespace-nowrap"
          >
            Free Inspection
          </a>
        </div>
      </div>
    </div>
  );
}

// --- Storm Report Widget ---
function StormReportWidget({ reports }: { reports: StormReportData[] }) {
  if (!reports || reports.length === 0) return null;

  const report = reports[0]; // Show the most recent shared report

  const riskColors: Record<string, { bg: string; text: string; border: string }> = {
    Severe: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
    High: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
    Moderate: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    Low: { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30' },
  };

  const colors = riskColors[report.riskLevel] || riskColors.Low;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CloudLightning className="w-5 h-5 text-[#0066CC]" />
            Storm Damage Report
          </h3>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${colors.bg} ${colors.text} ${colors.border} border`}>
            {report.riskLevel} Risk
          </span>
        </div>
      </div>

      {/* Risk Score */}
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <span className="text-gray-500 text-sm">Risk Score</span>
          <span className={`text-2xl font-bold ${colors.text}`}>{report.riskScore}/100</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              report.riskLevel === 'Severe' ? 'bg-red-500' :
              report.riskLevel === 'High' ? 'bg-orange-500' :
              report.riskLevel === 'Moderate' ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${report.riskScore}%` }}
          />
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-3 divide-x divide-gray-200 border-b border-gray-200">
        <div className="p-3 text-center">
          <p className="text-lg font-bold text-gray-900">{report.totalHailReports}</p>
          <p className="text-gray-500 text-xs">Hail Reports</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-lg font-bold text-gray-900">
            {report.closestHailMiles !== null ? `${report.closestHailMiles.toFixed(1)}mi` : 'N/A'}
          </p>
          <p className="text-gray-500 text-xs">Closest</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-lg font-bold text-gray-900">{report.largestHailSize || 'N/A'}</p>
          <p className="text-gray-500 text-xs">Largest</p>
        </div>
      </div>

      {/* Risk Factors */}
      <div className="p-5 border-b border-gray-200">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-medium">Risk Factors</p>
        <div className="space-y-2">
          {report.riskFactors.slice(0, 4).map((factor, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400 mt-0.5 flex-shrink-0" />
              <p className="text-gray-500 text-xs">{factor}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendation */}
      <div className="p-5 border-b border-gray-200">
        <div className="bg-gray-100/50 rounded-lg p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-[#0066CC] flex-shrink-0 mt-0.5" />
          <p className="text-gray-500 text-xs leading-relaxed">{report.recommendation}</p>
        </div>
      </div>

      {/* CTA */}
      <div className="p-4 bg-[#0066CC]/5">
        <a
          href="tel:2562748530"
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#0066CC] text-white font-bold rounded-lg hover:bg-[#0077dd] transition-all text-sm"
        >
          <Phone className="w-4 h-4" />
          Schedule Free Inspection
        </a>
      </div>
    </div>
  );
}

// --- Delivery Tracking ---
function DeliveryTracker({ deliveries }: { deliveries: DeliveryInfo[] }) {
  if (!deliveries || deliveries.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-5 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Truck className="w-5 h-5 text-[#0066CC]" />
          Material Deliveries
        </h3>
      </div>

      {deliveries.map((delivery) => {
        const currentStageIndex = DELIVERY_STAGES.findIndex((s) => s.id === delivery.status);

        return (
          <div key={delivery.id} className="p-5 border-b border-gray-200 last:border-b-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-900 font-medium">{delivery.materials}</p>
                <p className="text-gray-500 text-sm">{delivery.scheduledDate}</p>
              </div>
              {delivery.driverName && (
                <div className="text-right">
                  <p className="text-gray-500 text-xs">Driver</p>
                  <p className="text-gray-900 text-sm">{delivery.driverName}</p>
                </div>
              )}
            </div>

            {/* Delivery timeline */}
            <div className="flex items-center gap-1 mb-3">
              {DELIVERY_STAGES.map((stage, idx) => {
                const isComplete = idx < currentStageIndex;
                const isCurrent = idx === currentStageIndex;
                return (
                  <div key={stage.id} className="flex-1">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        isComplete
                          ? 'bg-[#0066CC]'
                          : isCurrent
                          ? 'bg-[#0066CC]/60 animate-pulse'
                          : 'bg-gray-200'
                      }`}
                    />
                    <p
                      className={`text-xs mt-1 text-center ${
                        isComplete || isCurrent ? 'text-[#0066CC]' : 'text-gray-400'
                      }`}
                    >
                      {stage.label}
                    </p>
                  </div>
                );
              })}
            </div>

            {delivery.estimatedArrival && delivery.status !== 'delivered' && (
              <div className="bg-[#0066CC]/10 border border-[#0066CC]/20 rounded-lg p-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#0066CC]" />
                <p className="text-sm text-gray-400">
                  Estimated arrival: <span className="text-[#0066CC] font-medium">{delivery.estimatedArrival}</span>
                </p>
              </div>
            )}

            {delivery.status === 'delivered' && delivery.proofPhotoUrl && (
              <div className="mt-3">
                <a
                  href={delivery.proofPhotoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-400 transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  View Delivery Photo
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Sales Rep Card ---
function SalesRepCard({ rep }: { rep: SalesRep }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-medium text-gray-500 mb-4">Your Roofing Specialist</h3>
      <div className="flex items-center gap-4">
        {rep.photo ? (
          <img
            src={rep.photo}
            alt={rep.name}
            className="w-14 h-14 rounded-full object-cover border-2 border-[#0066CC]"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-[#0066CC]/20 flex items-center justify-center border-2 border-[#0066CC]">
            <User className="w-7 h-7 text-[#0066CC]" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-gray-900 font-semibold">{rep.name}</p>
          <p className="text-[#0066CC] text-sm">{rep.position}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-4">
        {rep.phone && (
          <a
            href={`tel:${rep.phone}`}
            className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#0066CC] text-white font-semibold rounded-lg hover:bg-[#0077dd] transition-all text-sm"
          >
            <Phone className="w-4 h-4" />
            Call
          </a>
        )}
        {rep.email && (
          <a
            href={`mailto:${rep.email}`}
            className="flex items-center justify-center gap-2 px-3 py-2.5 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-all text-sm"
          >
            <Mail className="w-4 h-4" />
            Email
          </a>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

function CustomerDashboard({
  data,
  token,
  onLogout,
}: {
  data: PortalData;
  token: string;
  onLogout: () => void;
}) {
  const { customer, salesRep, appointments, documents, messages, jobStatus, weather, hailReports, stormReports, settings } = data;

  // Simulate delivery data from job status (when materials phase or later)
  const deliveries: DeliveryInfo[] = [];
  if (jobStatus) {
    const phaseIdx = getPhaseIndex(
      JOB_PHASES.find((p) => p.label === jobStatus.phase || p.id === jobStatus.phase)?.id || 'lead'
    );
    // Show delivery tracking only if at or past materials phase
    if (phaseIdx >= 5) {
      let deliveryStatus: DeliveryInfo['status'] = 'scheduled';
      if (phaseIdx === 5) deliveryStatus = 'in_transit';
      if (phaseIdx >= 6) deliveryStatus = 'delivered';

      deliveries.push({
        id: 'delivery-1',
        status: deliveryStatus,
        driverName: 'Mike T.',
        scheduledDate: 'Materials delivery',
        materials: 'Roofing shingles, underlayment, and flashing',
        estimatedArrival: phaseIdx === 5 ? 'Within 2 business days' : undefined,
      });
    }
  }

  const firstName = customer.customerName?.split(' ')[0] || 'there';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-[#0066CC]/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-7 h-7 text-[#0066CC]" />
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">River City Roofing</h1>
                <p className="text-xs text-gray-500">Customer Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="tel:2562748530"
                className="hidden sm:flex items-center gap-2 text-[#0066CC] hover:text-gray-900 transition-colors text-sm"
              >
                <Phone className="w-4 h-4" />
                (256) 274-8530
              </a>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-gray-500 hover:text-gray-900 transition-colors text-sm"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-[#0066CC]/10 via-lime-500/5 to-transparent border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h2 className="text-2xl font-bold text-gray-900">Welcome back, {firstName}!</h2>
          <p className="text-gray-500 mt-1 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            {customer.customerAddress || 'Hartselle, AL'}
          </p>
        </div>
      </div>

      {/* Dashboard content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Progress */}
            {settings.showJobProgress && (
              <JobProgressTimeline jobStatus={jobStatus} jobs={data.jobs} />
            )}

            {/* Delivery Tracking */}
            {(settings.showDeliveryTracking ?? settings.showJobProgress) && deliveries.length > 0 && (
              <DeliveryTracker deliveries={deliveries} />
            )}

            {/* Appointments */}
            {settings.showAppointments && (
              <AppointmentsWidget
                appointments={appointments}
                customerAddress={customer.customerAddress}
              />
            )}

            {/* Documents */}
            {settings.showDocuments && (
              <DocumentsSection
                documents={documents}
                allowUpload={canUpload(settings)}
                token={token}
                customerName={customer.customerName}
                customerEmail={customer.customerEmail}
                customerId={customer.customerId}
                jobId={customer.jobId}
              />
            )}

            {/* Messages */}
            {settings.showMessages && (
              <MessagesSection
                messages={messages}
                allowSend={canSendMessages(settings)}
                token={token}
                customerName={customer.customerName}
                customerEmail={customer.customerEmail}
                customerId={customer.customerId}
                jobId={customer.jobId}
              />
            )}
          </div>

          {/* Right column - sidebar */}
          <div className="space-y-6">
            {/* Sales Rep */}
            <SalesRepCard rep={salesRep} />

            {/* Weather */}
            {settings.showWeather && (
              <WeatherWidget
                forecasts={weather}
                location={customer.customerAddress || 'Hartselle, AL'}
              />
            )}

            {/* Storm Report (shared by rep) */}
            {settings.showStormReport && stormReports && stormReports.length > 0 && (
              <StormReportWidget reports={stormReports} />
            )}

            {/* Hail Reports */}
            {settings.showHailReports && (
              <HailReportWidget
                reports={hailReports}
                customerAddress={customer.customerAddress}
              />
            )}

            {/* Quick actions */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <a
                  href="tel:2562748530"
                  className="flex items-center gap-3 p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <Phone className="w-5 h-5 text-[#0066CC]" />
                  <span className="text-gray-900 text-sm">Call Office</span>
                  <ChevronRight className="w-4 h-4 text-gray-500 ml-auto" />
                </a>
                {salesRep.phone && (
                  <a
                    href={`tel:${salesRep.phone}`}
                    className="flex items-center gap-3 p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <User className="w-5 h-5 text-[#0066CC]" />
                    <span className="text-gray-900 text-sm">Call {salesRep.name.split(' ')[0]}</span>
                    <ChevronRight className="w-4 h-4 text-gray-500 ml-auto" />
                  </a>
                )}
                <a
                  href={`/team/${salesRep.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-5 h-5 text-[#0066CC]" />
                  <span className="text-gray-900 text-sm">View Rep Profile</span>
                  <ChevronRight className="w-4 h-4 text-gray-500 ml-auto" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-6 text-center text-gray-500 text-sm mt-8">
        <p>River City Roofing Solutions - Hartselle, AL</p>
        <p className="mt-1">Family-Owned Since 2018 | (256) 274-8530</p>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root Page Component
// ---------------------------------------------------------------------------

export default function CustomerPortalPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tokenFromUrl = searchParams.get('token');

  const [state, setState] = useState<'loading' | 'login' | 'dashboard' | 'error'>('loading');
  const [token, setToken] = useState<string>('');
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string>('');

  // Check for saved token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('rcrs_portal_token');

    if (tokenFromUrl) {
      setToken(tokenFromUrl);
      loadPortalData(tokenFromUrl);
    } else if (savedToken) {
      setToken(savedToken);
      loadPortalData(savedToken);
    } else {
      setState('login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenFromUrl]);

  const loadPortalData = useCallback(async (accessToken: string) => {
    setState('loading');
    setError('');

    try {
      const response = await fetch(`/api/customer/${encodeURIComponent(accessToken)}`);

      if (!response.ok) {
        if (response.status === 404) {
          // Invalid / expired token
          localStorage.removeItem('rcrs_portal_token');
          setError('This access link is invalid or has expired. Please use your access code or contact us.');
          setState('login');
          return;
        }
        if (response.status === 429) {
          setError('Too many attempts. Please wait a few minutes and try again.');
          setState('login');
          return;
        }
        throw new Error('Failed to load portal');
      }

      const data = await response.json();

      if (data.error) {
        localStorage.removeItem('rcrs_portal_token');
        setError(data.error);
        setState('login');
        return;
      }

      // Save token for next visit
      localStorage.setItem('rcrs_portal_token', accessToken);

      // Ensure settings has defaults
      const effectiveSettings: PortalSettings = {
        showJobProgress: true,
        showAppointments: true,
        showDocuments: true,
        showMessages: true,
        showWeather: true,
        showHailReports: true,
        showStormReport: true,
        allowFileUpload: true,
        allowMessages: true,
        ...data.settings,
      };

      setPortalData({
        customer: data.customer,
        salesRep: data.salesRep || { name: 'River City Roofing', slug: '', phone: '(256) 274-8530', email: 'rcrs@rivercityroofingsolutions.com', photo: '', position: 'Team' },
        appointments: data.appointments || [],
        documents: data.documents || [],
        messages: data.messages || [],
        jobStatus: data.jobStatus || null,
        weather: data.weather || [],
        hailReports: data.hailReports || [],
        stormReports: data.stormReports || [],
        settings: effectiveSettings,
        dataSource: data.dataSource,
        jobs: data.jobs,
      });

      setState('dashboard');

      // Log portal_opened to Google Sheets for long-term persistence
      try {
        fetch('/api/customer/portal-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: data.customer?.customerName || '',
            customerEmail: data.customer?.customerEmail || '',
            customerId: data.customer?.customerId || '',
            jobId: data.customer?.jobId || '',
            action: 'portal_opened',
            details: {
              accessMethod: 'token',
              dataSource: data.dataSource || 'unknown',
              portalVersion: 'v2',
            },
          }),
        }).catch(() => {}); // Fire-and-forget
      } catch {
        // Silently ignore logging errors to not break the portal experience
      }
    } catch (err) {
      console.error('Portal load error:', err);
      setError('Unable to load your portal. Please check your connection and try again.');
      setState('login');
    }
  }, []);

  const handleAuthenticated = (accessToken: string) => {
    setToken(accessToken);
    loadPortalData(accessToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('rcrs_portal_token');
    setToken('');
    setPortalData(null);
    setState('login');
    // Clean URL
    router.replace('/customer');
  };

  // Loading state
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-[#0066CC]/20 py-4">
          <div className="max-w-7xl mx-auto px-4 flex items-center gap-3">
            <Building2 className="w-7 h-7 text-[#0066CC]" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">River City Roofing</h1>
              <p className="text-xs text-gray-500">Customer Portal</p>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-12">
          <DashboardSkeleton />
        </main>
      </div>
    );
  }

  // Login / error state
  if (state === 'login') {
    return <LoginScreen onAuthenticated={handleAuthenticated} initialToken={tokenFromUrl || undefined} />;
  }

  // Dashboard
  if (state === 'dashboard' && portalData) {
    return <CustomerDashboard data={portalData} token={token} onLogout={handleLogout} />;
  }

  // Fallback
  return <LoginScreen onAuthenticated={handleAuthenticated} />;
}
