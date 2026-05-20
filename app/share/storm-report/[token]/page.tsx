'use client';

/**
 * Public Storm Report Share Page — /share/storm-report/[token]
 *
 * Magic-link landing page for a storm-damage report. NO auth gate — the
 * 24-char base62 token in the URL IS the credential, scoped to a single
 * report. Backed by `GET /api/public/storm-report-share/[token]`.
 *
 * Rendering contract:
 *   200 { success: true, data: { ... }}   — render the report inline.
 *   404                                    — invalid / unknown token → friendly message.
 *   410                                    — expired token → "this link has expired".
 *   429                                    — rate-limited (60/hr) → try-later message.
 *   500                                    — server error → generic retry message.
 *
 * Design: matches the LIGHT/RCRS-brand style of `/view/[token]` so the
 * customer experience is consistent. Mobile-first.
 *
 * Live components:
 *   - Hero with customer first name + property address.
 *   - Risk-level banner (color-coded).
 *   - Key stats (hail count, largest size, closest hail).
 *   - Map embed: OpenStreetMap pin for the address (no API key needed).
 *   - Damage indicators / risk factors.
 *   - Recommended next steps with CTA to /contact?source=storm-share&token=...
 *   - Sales rep contact card (name, photo, phone, email).
 *
 * The page bumps the share row's accessCount as a side effect of the
 * fetch — the API handles that best-effort.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  AlertTriangle,
  Loader2,
  Phone,
  Mail,
  MapPin,
  CloudLightning,
  Wind,
  CheckCircle2,
  ShieldAlert,
  Shield,
  ShieldCheck,
  Calendar,
  ArrowRight,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────

interface HailEvent {
  date: string;
  size: string;
  distance: number;
  location: string;
  severity: string;
}

interface WindEvent {
  date: string;
  event: string;
  description: string;
}

interface Rep {
  name: string;
  phone: string;
  email: string;
  photo: string;
  position: string;
}

interface SharePayload {
  reportId: string;
  customerName: string;
  customerFirstName: string;
  address: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  riskLevel: string;
  riskScore: number;
  totalHailReports: number;
  largestHailSize: string | null;
  closestHailMiles: number | null;
  riskFactors: string[];
  recommendation: string;
  hailEvents: HailEvent[];
  windEvents: WindEvent[];
  rep: Rep;
  generatedAt: string;
  expiresAt: string;
}

interface ApiSuccess {
  success: true;
  data: SharePayload;
}
interface ApiError {
  error: string;
}
type ApiResponse = ApiSuccess | ApiError;

// ─── Helpers ────────────────────────────────────────────────────────────

const riskConfig: Record<
  string,
  { color: string; bg: string; border: string; icon: typeof Shield; label: string }
> = {
  Low: {
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: ShieldCheck,
    label: 'Low Risk',
  },
  Moderate: {
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: Shield,
    label: 'Moderate Risk',
  },
  High: {
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    icon: ShieldAlert,
    label: 'High Risk',
  },
  Severe: {
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: ShieldAlert,
    label: 'Severe Risk',
  },
};

function formatTel(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  return digits ? `tel:${digits}` : 'tel:+12562748530';
}

function formatPhoneDisplay(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

function formatDateRange(start: string, end: string): string {
  try {
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    return `${fmt(start)} – ${fmt(end)}`;
  } catch {
    return `${start} – ${end}`;
  }
}

/**
 * OpenStreetMap embed URL centered on the address text. Uses the
 * iframe-friendly embed endpoint so no API key is needed — the
 * `marker` parameter would require lat/lng we don't have here, so we
 * fall back to a query-based center. Good enough to show the customer
 * "this is the area we looked at."
 */
function buildMapEmbedSrc(address: string): string {
  const q = encodeURIComponent(address || 'Hartselle, AL');
  // The bbox here is a wide regional default; OSM will auto-zoom to
  // the query when we hand it `marker=`-less. We use a static
  // North-Alabama bounding box as a safe fallback.
  return `https://www.openstreetmap.org/export/embed.html?bbox=-87.6,33.5,-85.6,35.2&layer=mapnik&search=${q}`;
}

// ─── Component ──────────────────────────────────────────────────────────

export default function StormReportSharePage() {
  const params = useParams();
  const token =
    typeof params?.token === 'string'
      ? params.token
      : Array.isArray(params?.token)
      ? params!.token[0]
      : '';

  const [data, setData] = useState<SharePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchShare = useCallback(async () => {
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
      const res = await fetch(
        `/api/public/storm-report-share/${encodeURIComponent(token)}`,
        { cache: 'no-store' }
      );
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
    fetchShare();
  }, [fetchShare]);

  // ─── Loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-[#39FF14] animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading your storm report…</p>
        </div>
      </div>
    );
  }

  // ─── Error / invalid / expired ──────────────────────────────────────
  if (errorCode !== null || !data) {
    const isExpired = errorCode === 410;
    const isRateLimited = errorCode === 429;
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4 py-12">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isExpired
              ? 'This link has expired'
              : isRateLimited
              ? 'Too many requests'
              : 'Invalid or expired link'}
          </h1>
          <p className="text-gray-600 mb-6">
            {isExpired
              ? 'Your storm report link is no longer active. Reach out to your River City Roofing rep and they can text you a fresh one.'
              : isRateLimited
              ? 'Please wait a minute and try again.'
              : "We couldn't find a storm report for this link. It may have been mistyped or the link is no longer active."}
          </p>
          <div className="space-y-3">
            <a
              href="tel:+12562748530"
              className="flex items-center justify-center gap-2 w-full bg-[#39FF14] hover:bg-[#32e012] text-black font-semibold px-5 py-3 rounded-lg transition-colors"
            >
              <Phone className="w-5 h-5" />
              Call (256) 274-8530
            </a>
            <Link
              href="/contact"
              className="flex items-center justify-center gap-2 w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold px-5 py-3 rounded-lg transition-colors"
            >
              Request a fresh inspection
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {errorMsg && process.env.NODE_ENV !== 'production' && (
            <p className="mt-6 text-xs text-gray-400">{errorMsg}</p>
          )}
        </div>
      </div>
    );
  }

  // ─── Successful render ──────────────────────────────────────────────
  const cfg = riskConfig[data.riskLevel] || riskConfig.Moderate;
  const RiskIcon = cfg.icon;
  const contactHref = `/contact?source=storm-share&token=${encodeURIComponent(token)}`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo-transparent.png"
              alt="River City Roofing Solutions"
              width={48}
              height={48}
              className="rounded-xl"
            />
            <span className="font-bold text-gray-900 hidden sm:inline">
              River City Roofing Solutions
            </span>
          </Link>
          <a
            href="tel:+12562748530"
            className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-black"
          >
            <Phone className="w-4 h-4" />
            (256) 274-8530
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Hero */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
            Storm Damage Risk Report
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Hi {data.customerFirstName}, here&apos;s what we found.
          </h1>
          <div className="flex items-start gap-2 text-gray-600">
            <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <span className="text-base">{data.address}</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            <span>{formatDateRange(data.dateRangeStart, data.dateRangeEnd)}</span>
          </div>
          <p className="mt-4 text-xs text-gray-400">
            Report ID: {data.reportId}
          </p>
        </section>

        {/* Risk Banner */}
        <section
          className={`rounded-2xl border-2 ${cfg.border} ${cfg.bg} p-6 sm:p-8 flex items-center gap-5`}
        >
          <div
            className={`w-14 h-14 rounded-full bg-white flex items-center justify-center flex-shrink-0 ${cfg.color}`}
          >
            <RiskIcon className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <p className={`text-xs font-semibold uppercase tracking-widest ${cfg.color}`}>
              Risk Level
            </p>
            <h2 className={`text-3xl font-extrabold ${cfg.color}`}>{cfg.label}</h2>
            <p className="text-sm text-gray-600 mt-1">
              Risk Score: <span className="font-semibold">{data.riskScore}/100</span>
            </p>
          </div>
        </section>

        {/* Key Stats */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <CloudLightning className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <div className="text-3xl font-extrabold text-gray-900">
              {data.totalHailReports}
            </div>
            <div className="text-xs uppercase tracking-wider text-gray-500 mt-1">
              Hail Reports
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <Shield className="w-6 h-6 text-orange-500 mx-auto mb-2" />
            <div className="text-3xl font-extrabold text-gray-900">
              {data.largestHailSize || 'N/A'}
            </div>
            <div className="text-xs uppercase tracking-wider text-gray-500 mt-1">
              Largest Hail
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <MapPin className="w-6 h-6 text-purple-500 mx-auto mb-2" />
            <div className="text-3xl font-extrabold text-gray-900">
              {data.closestHailMiles !== null
                ? `${data.closestHailMiles.toFixed(1)} mi`
                : 'N/A'}
            </div>
            <div className="text-xs uppercase tracking-wider text-gray-500 mt-1">
              Closest Hail
            </div>
          </div>
        </section>

        {/* Map Embed */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 pt-5 pb-3">
            <h3 className="text-lg font-bold text-gray-900">Storm Path Near Your Home</h3>
            <p className="text-sm text-gray-500 mt-1">
              Map shows the area we analyzed. Hail and wind events are sourced from
              NOAA and the National Weather Service.
            </p>
          </div>
          <iframe
            title="Map of your property"
            src={buildMapEmbedSrc(data.address)}
            className="w-full h-72 sm:h-96 border-0"
            loading="lazy"
          />
        </section>

        {/* Risk Factors */}
        {data.riskFactors.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              What we noticed
            </h3>
            <ul className="space-y-3">
              {data.riskFactors.map((factor, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${cfg.color.replace(
                      'text-',
                      'bg-'
                    )}`}
                  />
                  <span className="text-gray-700">{factor}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Hail Events */}
        {data.hailEvents.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <CloudLightning className="w-5 h-5 text-blue-500" />
              Recent Hail Events
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <th className="text-left py-2 pr-3">Date</th>
                    <th className="text-left py-2 pr-3">Size</th>
                    <th className="text-left py-2 pr-3">Dist</th>
                    <th className="text-left py-2 pr-3">Location</th>
                    <th className="text-left py-2">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {data.hailEvents.map((e, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-3 text-gray-700">
                        {new Date(e.date).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-3 font-semibold text-gray-900">
                        {e.size}
                      </td>
                      <td className="py-2 pr-3 text-gray-600">
                        {e.distance.toFixed(1)} mi
                      </td>
                      <td className="py-2 pr-3 text-gray-600">
                        {e.location || '—'}
                      </td>
                      <td
                        className={`py-2 capitalize font-medium ${
                          e.severity === 'severe'
                            ? 'text-red-600'
                            : e.severity === 'moderate'
                            ? 'text-orange-600'
                            : 'text-yellow-600'
                        }`}
                      >
                        {e.severity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Wind Events */}
        {data.windEvents.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Wind className="w-5 h-5 text-gray-500" />
              Recent Wind Events
            </h3>
            <ul className="space-y-3">
              {data.windEvents.map((e, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 border-b border-gray-100 last:border-0 pb-3 last:pb-0"
                >
                  <Wind className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      {e.event}{' '}
                      <span className="text-gray-500 font-normal">
                        · {new Date(e.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">{e.description}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Recommended next steps + CTA */}
        <section className="bg-white rounded-2xl border-2 border-[#39FF14] p-6 sm:p-8 shadow-sm">
          <h3 className="text-xl font-bold text-gray-900 mb-3">
            Recommended Next Steps
          </h3>
          {data.recommendation && (
            <p className="text-gray-700 mb-5 leading-relaxed">
              {data.recommendation}
            </p>
          )}
          <div className="space-y-3 sm:space-y-0 sm:flex sm:gap-3">
            <Link
              href={contactHref}
              className="flex-1 flex items-center justify-center gap-2 bg-[#39FF14] hover:bg-[#32e012] text-black font-bold px-6 py-4 rounded-xl transition-colors"
            >
              <CheckCircle2 className="w-5 h-5" />
              Schedule a Free Inspection
            </Link>
            <a
              href="tel:+12562748530"
              className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold px-6 py-4 rounded-xl transition-colors"
            >
              <Phone className="w-5 h-5" />
              Call (256) 274-8530
            </a>
          </div>
        </section>

        {/* Sales rep card */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Your River City Contact
          </p>
          <div className="flex items-center gap-4">
            {data.rep.photo ? (
              <Image
                src={data.rep.photo}
                alt={data.rep.name}
                width={72}
                height={72}
                className="rounded-full object-cover w-[72px] h-[72px] border border-gray-200"
              />
            ) : (
              <div className="w-[72px] h-[72px] rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 text-2xl font-bold">
                {data.rep.name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-lg font-bold text-gray-900 truncate">
                {data.rep.name}
              </h4>
              <p className="text-sm text-gray-500 truncate">{data.rep.position}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                {data.rep.phone && (
                  <a
                    href={formatTel(data.rep.phone)}
                    className="inline-flex items-center gap-1 text-[#0084FF] hover:underline"
                  >
                    <Phone className="w-4 h-4" />
                    {formatPhoneDisplay(data.rep.phone)}
                  </a>
                )}
                {data.rep.email && (
                  <a
                    href={`mailto:${data.rep.email}`}
                    className="inline-flex items-center gap-1 text-[#0084FF] hover:underline truncate"
                  >
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{data.rep.email}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Footer / data source note */}
        <footer className="text-center text-xs text-gray-400 pt-2 pb-6">
          <p>
            Data sourced from NOAA / National Weather Service public storm reports.
            This report is for informational purposes only and is not a guarantee
            of damage.
          </p>
          <p className="mt-2">
            River City Roofing Solutions · Hartselle, AL ·{' '}
            <a href="tel:+12562748530" className="hover:underline">
              (256) 274-8530
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
