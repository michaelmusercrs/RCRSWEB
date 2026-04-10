'use client';

/**
 * Public Customer Portal — /view/[token]
 *
 * This is the homeowner-facing landing page for a customer-portal link. It is
 * under the (site) route group, so it ships with the public-site layout
 * (header + footer). No portal auth is required — the token IS the credential.
 *
 * Backing API: GET /api/public/customer-portal/[token]
 *
 * Contract:
 *   200 { success: true, data: { ... sanitized customer payload ... } }
 *   404 { error: 'Invalid or expired link' }          (bad or unknown token)
 *   410 { error: '... expired ...' }                   (token resolved but expired)
 *
 * Design: LIGHT theme, RCRS brand. Mobile-first. No dark portal surfaces.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  User,
  Calendar,
  FileText,
  ShieldCheck,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';

// ─── Types (mirror public API contract) ─────────────────────────────────

interface PublicDocument {
  documentId: string;
  type: string;
  title: string;
  description?: string;
  uploadedAt: string;
}

interface PublicAppointment {
  appointmentId: string;
  type: string;
  title: string;
  description?: string;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
}

interface PublicRep {
  name: string;
  phone: string;
  email: string;
  photo: string;
  position: string;
}

interface PublicCustomerPayload {
  customerName: string;
  customerFirstName: string;
  customerAddress: string;
  projectStatus: string;
  projectPhase: string;
  projectProgress: number;
  nextMilestone: string | null;
  rep: PublicRep;
  appointments: PublicAppointment[];
  documents: PublicDocument[];
  createdAt: string;
}

interface ApiSuccess {
  success: true;
  data: PublicCustomerPayload;
}

interface ApiError {
  error: string;
}

type ApiResponse = ApiSuccess | ApiError;

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatTelHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `tel:${digits}`;
}

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'closed_won') return 'bg-green-100 text-green-800 border-green-200';
  if (s === 'closed_lost') return 'bg-gray-100 text-gray-700 border-gray-200';
  if (s === 'estimate_sent') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (s === 'inspection_scheduled') return 'bg-cyan-100 text-cyan-800 border-cyan-200';
  if (s === 'contacted') return 'bg-indigo-100 text-indigo-800 border-indigo-200';
  return 'bg-amber-100 text-amber-800 border-amber-200'; // new / default
}

// ─── Component ───────────────────────────────────────────────────────────

export default function PublicCustomerPortalPage() {
  const params = useParams();
  const token = typeof params?.token === 'string' ? params.token : '';

  const [data, setData] = useState<PublicCustomerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchPortal = useCallback(async () => {
    if (!token) {
      setErrorCode(404);
      setErrorMsg('Invalid or expired link');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorCode(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/public/customer-portal/${encodeURIComponent(token)}`, {
        cache: 'no-store',
      });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || !('success' in json) || !json.success) {
        const msg = 'error' in json ? json.error : 'Something went wrong';
        setErrorCode(res.status);
        setErrorMsg(msg);
        setData(null);
      } else {
        setData(json.data);
      }
    } catch (err) {
      setErrorCode(0);
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPortal();
  }, [fetchPortal]);

  // ─── Loading ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-[#39FF14] animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading your project details…</p>
        </div>
      </div>
    );
  }

  // ─── Error / invalid token ──────────────────────────────────────────
  if (errorCode !== null || !data) {
    const isExpired = errorCode === 410;
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-white px-4 py-12">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isExpired ? 'This link has expired' : 'Invalid or expired link'}
          </h1>
          <p className="text-gray-600 mb-6">
            {isExpired
              ? 'Your portal link is no longer active. Reach out to your River City Roofing rep for a fresh link.'
              : "We couldn't find a project for this link. It may have been mistyped or the link is no longer active."}
          </p>

          <div className="space-y-3">
            <a
              href="tel:+12562748530"
              className="flex items-center justify-center gap-2 w-full bg-[#39FF14] hover:bg-[#32e012] text-black font-semibold px-5 py-3 rounded-lg transition-colors"
            >
              <Phone className="w-4 h-4" />
              Call Us: (256) 274-8530
            </a>
            <a
              href="mailto:rcrs@rivercityroofingsolutions.com"
              className="flex items-center justify-center gap-2 w-full bg-white hover:bg-gray-50 text-gray-900 font-medium border border-gray-200 px-5 py-3 rounded-lg transition-colors"
            >
              <Mail className="w-4 h-4" />
              Email Support
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center gap-1.5 text-sm text-[#0066CC] hover:underline mt-2"
            >
              Or open our contact page <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Success ─────────────────────────────────────────────────────────
  const { customerFirstName, customerAddress, projectPhase, projectProgress, projectStatus, nextMilestone, rep, appointments, documents } =
    data;

  return (
    <div className="min-h-[70vh] bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-6">
        {/* ─── Welcome header ─── */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 md:p-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm font-medium text-[#0066CC] mb-1">
                River City Roofing Customer Portal
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Welcome, {customerFirstName}!
              </h1>
              {customerAddress && (
                <div className="flex items-center gap-1.5 text-gray-600 mt-2 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {customerAddress}
                </div>
              )}
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${statusBadgeClass(
                projectStatus
              )}`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {projectPhase}
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>Project progress</span>
              <span className="font-semibold text-gray-700">{projectProgress}%</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#39FF14] to-[#0066CC] transition-all duration-700"
                style={{ width: `${Math.min(Math.max(projectProgress, 0), 100)}%` }}
              />
            </div>
            {nextMilestone && (
              <p className="text-sm text-gray-600 mt-2">
                <span className="font-medium text-gray-700">Next up:</span> {nextMilestone}
              </p>
            )}
          </div>
        </div>

        {/* ─── Main grid: rep + content ─── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left: rep card */}
          <div className="md:col-span-1">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Your Roofing Specialist
              </div>
              <div className="flex items-center gap-3 mb-4">
                {rep.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={rep.photo}
                    alt={rep.name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-[#39FF14]/40"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#39FF14] to-[#0066CC] flex items-center justify-center text-white font-bold text-lg">
                    {rep.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{rep.name}</div>
                  <div className="text-xs text-gray-500 truncate">{rep.position}</div>
                </div>
              </div>

              <div className="space-y-2">
                {rep.phone && (
                  <a
                    href={formatTelHref(rep.phone)}
                    className="flex items-center justify-center gap-2 w-full bg-[#39FF14] hover:bg-[#32e012] text-black font-semibold px-4 py-2.5 rounded-lg transition-colors text-sm"
                  >
                    <Phone className="w-4 h-4" />
                    {formatPhoneDisplay(rep.phone)}
                  </a>
                )}
                {rep.email && (
                  <a
                    href={`mailto:${rep.email}`}
                    className="flex items-center justify-center gap-2 w-full bg-white hover:bg-gray-50 text-gray-900 font-medium border border-gray-200 px-4 py-2.5 rounded-lg transition-colors text-sm"
                  >
                    <Mail className="w-4 h-4" />
                    Email {rep.name.split(' ')[0]}
                  </a>
                )}
              </div>

              <div className="mt-5 pt-5 border-t border-gray-100">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Support
                </div>
                <a
                  href="tel:+12562748530"
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-[#0066CC] py-1"
                >
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  (256) 274-8530
                </a>
                <a
                  href="mailto:rcrs@rivercityroofingsolutions.com"
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-[#0066CC] py-1"
                >
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  rcrs@rivercityroofingsolutions.com
                </a>
              </div>
            </div>

            {/* Trust row */}
            <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-[#39FF14]" />
                <span className="text-xs font-semibold text-gray-700">Why River City</span>
              </div>
              <ul className="space-y-1.5 text-xs text-gray-600">
                <li>- IKO ROOFPRO Craftsman Premier</li>
                <li>- Owens Corning Preferred Contractor</li>
                <li>- BBB Accredited A+</li>
                <li>- Locally owned, Decatur AL</li>
              </ul>
            </div>
          </div>

          {/* Right: appointments + documents + next steps */}
          <div className="md:col-span-2 space-y-6">
            {/* Next steps card */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-[#39FF14]" />
                <h2 className="text-lg font-bold text-gray-900">What happens next</h2>
              </div>
              <ol className="space-y-3 text-sm">
                <NextStep
                  num={1}
                  label="Inspection"
                  desc="Your rep will confirm an on-site inspection window."
                  done={projectProgress >= 25}
                />
                <NextStep
                  num={2}
                  label="Estimate"
                  desc="We'll walk you through the scope and pricing."
                  done={projectProgress >= 45}
                />
                <NextStep
                  num={3}
                  label="Installation"
                  desc="Materials scheduled, crew assigned, job completed."
                  done={projectProgress >= 75}
                />
                <NextStep
                  num={4}
                  label="Warranty activated"
                  desc="Final walkthrough and warranty registration."
                  done={projectProgress >= 100}
                />
              </ol>
            </div>

            {/* Appointments */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-[#0066CC]" />
                <h2 className="text-lg font-bold text-gray-900">Upcoming appointments</h2>
              </div>
              {appointments.length === 0 ? (
                <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 text-center">
                  No appointments scheduled yet. Your rep will reach out to schedule your first
                  visit.
                </div>
              ) : (
                <ul className="space-y-2">
                  {appointments.map(apt => (
                    <li
                      key={apt.appointmentId}
                      className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100"
                    >
                      <Calendar className="w-4 h-4 text-[#0066CC] mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-sm">{apt.title}</div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          {apt.scheduledDate} {apt.scheduledTime && `at ${apt.scheduledTime}`}
                        </div>
                        {apt.description && (
                          <div className="text-xs text-gray-500 mt-1">{apt.description}</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Documents */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-[#0066CC]" />
                <h2 className="text-lg font-bold text-gray-900">Documents & photos</h2>
              </div>
              {documents.length === 0 ? (
                <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 text-center">
                  Your estimate, inspection report, and job photos will appear here as they are
                  added.
                </div>
              ) : (
                <ul className="space-y-2">
                  {documents.map(doc => (
                    <li
                      key={doc.documentId}
                      className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100"
                    >
                      <FileText className="w-4 h-4 text-[#0066CC] mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-sm">{doc.title}</div>
                        {doc.description && (
                          <div className="text-xs text-gray-500 mt-0.5 truncate">
                            {doc.description}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Contact support */}
            <div className="bg-gradient-to-br from-[#0066CC] to-[#004999] text-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-5 h-5 text-[#39FF14]" />
                <h2 className="text-lg font-bold">Need help?</h2>
              </div>
              <p className="text-sm text-white/90 mb-4">
                Questions about your project? Your rep is your direct line — or contact our office
                any time.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  href="tel:+12562748530"
                  className="flex-1 flex items-center justify-center gap-2 bg-[#39FF14] hover:bg-[#32e012] text-black font-semibold px-4 py-2.5 rounded-lg transition-colors text-sm"
                >
                  <Phone className="w-4 h-4" />
                  Call (256) 274-8530
                </a>
                <a
                  href="mailto:rcrs@rivercityroofingsolutions.com"
                  className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium border border-white/30 px-4 py-2.5 rounded-lg transition-colors text-sm"
                >
                  <Mail className="w-4 h-4" />
                  Email us
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Footer note ─── */}
        <div className="text-center text-xs text-gray-500 pt-2">
          <User className="w-3 h-3 inline mr-1 opacity-50" />
          This link is private to you. Please don't share it.
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function NextStep({ num, label, desc, done }: { num: number; label: string; desc: string; done: boolean }) {
  return (
    <li className="flex items-start gap-3">
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
          done ? 'bg-[#39FF14] text-black' : 'bg-gray-100 text-gray-500'
        }`}
      >
        {done ? <CheckCircle2 className="w-4 h-4" /> : num}
      </div>
      <div className="flex-1">
        <div className={`font-semibold text-sm ${done ? 'text-gray-900' : 'text-gray-700'}`}>
          {label}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
      </div>
    </li>
  );
}
