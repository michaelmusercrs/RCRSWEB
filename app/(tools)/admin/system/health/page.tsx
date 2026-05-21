'use client';

/**
 * System Health Dashboard
 *
 * Single-screen owner view of which RCRS subsystems are configured + healthy.
 * Drives the OWNER-SETUP.md checklist visually so the owner doesn't have to
 * read the doc — they just look at this page and SEE the missing pieces.
 *
 * Auth: parent app/(tools)/admin/layout.tsx already gates this page behind
 * the admin login. The /api/admin/system-health route does its own
 * requireRoleAtLeast(['owner','admin']) check as defense-in-depth.
 *
 * Data: GET /api/admin/system-health (cheap, read-only, no quota burn).
 * Manual refresh only — no auto-poll (owner glances + closes; polling
 * would waste KV/Sheets reads).
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Key,
  Mail,
  RefreshCw,
  Shield,
  ShieldOff,
  XCircle,
  Zap,
} from 'lucide-react';

// ─── Types (mirror app/api/admin/system-health/route.ts) ──────────────────────

type SubsystemStatus = 'healthy' | 'degraded' | 'not_configured' | 'error';
type OverallStatus = 'healthy' | 'degraded' | 'critical';

interface EnvVarStatus {
  name: string;
  set: boolean;
  preview: string | null;
}

interface SubsystemBase {
  configured: boolean;
  status: SubsystemStatus;
  details: string;
  envVars: EnvVarStatus[];
}

interface EmailSubsystem extends SubsystemBase {
  lastSendAt: string | null;
  lastSendStatus: string | null;
  fromAddress: string | null;
}

interface KvSubsystem extends SubsystemBase {
  pingMs: number | null;
}

interface SheetsSubsystem extends SubsystemBase {
  lastWriteAt: string | null;
  tabsPresent: string[];
  tabsExpected: string[];
  tabsMissing: string[];
  spreadsheetTitle: string | null;
}

interface CronInfo {
  path: string;
  schedule: string;
  active: boolean;
  lastRunAt: string | null;
  lastStatus: 'success' | 'error' | 'unknown';
  lastDurationMs: number | null;
}

interface CronSubsystem {
  activeCount: number;
  disabledCount: number;
  configuredCrons: CronInfo[];
}

interface JnSubsystem extends SubsystemBase {
  lastSyncAt: string | null;
}

interface SystemHealthResponse {
  timestamp: string;
  overall: OverallStatus;
  subsystems: {
    email: EmailSubsystem;
    turnstile: SubsystemBase;
    kv: KvSubsystem;
    sheets: SheetsSubsystem;
    crons: CronSubsystem;
    jn: JnSubsystem;
    resend: EmailSubsystem;
  };
}

// ─── OWNER-SETUP.md checklist (parsed server-side by
//     /api/admin/owner-setup-checklist). Shape mirrors that route. ─────────────

interface OwnerStep {
  number: number;
  title: string;
  body: string;
  markedDone: boolean;
  needsOwnerFlags: string[];
  checkKey: 'resend' | 'turnstile' | 'kv' | 'dead-code-triage' | 'dead-domain' | 'unknown';
}

interface OwnerSetupChecklistResponse {
  steps: OwnerStep[];
  sweepBranchesAwaiting: Array<{ branch: string; verdict: string; notes: string }>;
  topFindings: Array<{ id: string; title: string; tag: string }>;
  source: { ownerSetupPath: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusPill(status: SubsystemStatus): { label: string; cls: string; icon: typeof CheckCircle2 } {
  switch (status) {
    case 'healthy':
      return {
        label: 'Configured',
        cls: 'bg-green-500/20 text-green-300 border border-green-500/30',
        icon: CheckCircle2,
      };
    case 'degraded':
      return {
        label: 'Degraded',
        cls: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
        icon: AlertTriangle,
      };
    case 'not_configured':
      return {
        label: 'Not configured',
        cls: 'bg-neutral-700/30 text-neutral-300 border border-neutral-600',
        icon: XCircle,
      };
    case 'error':
      return {
        label: 'Error',
        cls: 'bg-red-500/20 text-red-300 border border-red-500/30',
        icon: XCircle,
      };
  }
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diffMs = Date.now() - t;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  return `${days}d ago`;
}

// ─── Overall banner ───────────────────────────────────────────────────────────

function OverallBanner({ overall, timestamp }: { overall: OverallStatus; timestamp: string }) {
  const cfg = {
    healthy: {
      label: 'GREEN — All systems operational',
      explain: 'Every configured subsystem responded healthy. Crons reporting on schedule.',
      cls: 'bg-green-500/20 border-green-500/40 text-green-200',
      Icon: CheckCircle2,
    },
    degraded: {
      label: 'YELLOW — Degraded',
      explain:
        'At least one subsystem is missing env vars or hasn\'t reported recently. Site is up; some features inert.',
      cls: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-200',
      Icon: AlertTriangle,
    },
    critical: {
      label: 'RED — Critical',
      explain:
        'A foundational subsystem (Sheets) is failing. Writes will silently no-op until fixed.',
      cls: 'bg-red-500/20 border-red-500/40 text-red-200',
      Icon: XCircle,
    },
  }[overall];

  const Icon = cfg.Icon;
  return (
    <div className={`rounded-xl border-2 ${cfg.cls} p-6`}>
      <div className="flex items-start gap-4">
        <Icon className="w-10 h-10 flex-shrink-0" />
        <div className="flex-1">
          <h2 className="text-xl font-bold">{cfg.label}</h2>
          <p className="text-sm mt-1 opacity-90">{cfg.explain}</p>
          <p className="text-xs mt-2 opacity-70">
            Last checked: {new Date(timestamp).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Env-var row (with reveal toggle) ─────────────────────────────────────────

function EnvVarRow({ env }: { env: EnvVarStatus }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-neutral-900/50 border border-white/5">
      <div className="flex items-center gap-2 min-w-0">
        {env.set ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
        ) : (
          <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
        )}
        <code className="text-neutral-300 truncate">{env.name}</code>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {env.set ? (
          <>
            <code className="text-neutral-400 font-mono">
              {revealed && env.preview ? env.preview : '••••••••'}
            </code>
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              className="p-0.5 text-neutral-500 hover:text-neutral-200"
              aria-label={revealed ? 'Hide masked value' : 'Show masked value'}
            >
              {revealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
          </>
        ) : (
          <span className="text-red-400/80 italic">unset</span>
        )}
      </div>
    </div>
  );
}

// ─── Subsystem card ───────────────────────────────────────────────────────────

interface CardProps {
  title: string;
  Icon: typeof Mail;
  status: SubsystemStatus;
  details: string;
  envVars: EnvVarStatus[];
  activity?: React.ReactNode;
  setupLink?: { label: string; href: string };
  extra?: React.ReactNode;
}

function SubsystemCard({ title, Icon, status, details, envVars, activity, setupLink, extra }: CardProps) {
  const pill = statusPill(status);
  const PillIcon = pill.icon;
  return (
    <div className="bg-neutral-900 border border-white/10 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-neutral-300" />
          <h3 className="text-base font-semibold text-white">{title}</h3>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${pill.cls}`}>
          <PillIcon className="w-3.5 h-3.5" />
          {pill.label}
        </span>
      </div>

      <p className="text-sm text-neutral-400 leading-relaxed">{details}</p>

      {extra}

      {envVars.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
            Environment
          </p>
          <div className="space-y-1">
            {envVars.map((e) => (
              <EnvVarRow key={e.name} env={e} />
            ))}
          </div>
        </div>
      )}

      {activity && (
        <div className="pt-2 border-t border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-1">
            Recent activity
          </p>
          <div className="text-xs text-neutral-300">{activity}</div>
        </div>
      )}

      {setupLink && status !== 'healthy' && (
        <a
          href={setupLink.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
        >
          <ExternalLink className="w-3 h-3" />
          {setupLink.label}
        </a>
      )}
    </div>
  );
}

// ─── Cron table ───────────────────────────────────────────────────────────────

function CronsCard({ crons }: { crons: CronSubsystem }) {
  return (
    <div className="bg-neutral-900 border border-white/10 rounded-xl p-5 space-y-4 col-span-1 md:col-span-2 xl:col-span-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-neutral-300" />
          <h3 className="text-base font-semibold text-white">Cron jobs</h3>
        </div>
        <div className="flex gap-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-300 border border-green-500/30">
            {crons.activeCount} active
          </span>
          {crons.disabledCount > 0 && (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-700/30 text-neutral-300 border border-neutral-600">
              {crons.disabledCount} disabled
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-neutral-400">
        Schedules from <code className="text-neutral-300">vercel.json</code>. Last-run timestamps from the
        SystemHealth sheet (written via <code className="text-neutral-300">lib/cron-heartbeat.ts</code>).
      </p>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-neutral-500 border-b border-white/10">
              <th className="px-2 py-2 font-semibold">Path</th>
              <th className="px-2 py-2 font-semibold">Schedule</th>
              <th className="px-2 py-2 font-semibold">State</th>
              <th className="px-2 py-2 font-semibold">Last run</th>
              <th className="px-2 py-2 font-semibold">Status</th>
              <th className="px-2 py-2 font-semibold">Duration</th>
            </tr>
          </thead>
          <tbody>
            {crons.configuredCrons.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2 py-6 text-center text-neutral-500">
                  No crons configured in vercel.json
                </td>
              </tr>
            )}
            {crons.configuredCrons.map((c) => {
              const statusCls =
                c.lastStatus === 'success'
                  ? 'text-green-400'
                  : c.lastStatus === 'error'
                  ? 'text-red-400'
                  : 'text-neutral-500';
              return (
                <tr key={c.path} className="border-b border-white/5 last:border-b-0">
                  <td className="px-2 py-2 font-mono text-xs text-neutral-300">{c.path}</td>
                  <td className="px-2 py-2 font-mono text-xs text-neutral-400">{c.schedule}</td>
                  <td className="px-2 py-2">
                    {c.active ? (
                      <span className="px-2 py-0.5 text-[10px] rounded bg-green-500/20 text-green-300">
                        active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] rounded bg-neutral-700/40 text-neutral-300">
                        disabled
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-xs text-neutral-300">
                    {relativeTime(c.lastRunAt)}
                  </td>
                  <td className={`px-2 py-2 text-xs font-medium ${statusCls}`}>
                    {c.lastStatus}
                  </td>
                  <td className="px-2 py-2 text-xs text-neutral-400">
                    {c.lastDurationMs != null ? `${c.lastDurationMs}ms` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Setup checklist ──────────────────────────────────────────────────────────

interface ChecklistItemProps {
  done: boolean;
  title: string;
  body: string;
  link?: { label: string; href: string };
}

/**
 * Owner-setup checklist row backed by the markdown body of OWNER-SETUP.md.
 *
 * - `done` derived by the parent from system-health env-var state (same
 *   derivation the legacy ChecklistItem used).
 * - `markedDone` reflects the `☑` glyph in the source file (manual
 *   acknowledge — shown as a smaller secondary indicator).
 * - `needsOwner` true if the step body contains a `[needs-owner]` tag —
 *   surfaced with a yellow exclamation per spec.
 * - The expandable "Show steps" panel renders the raw markdown body as
 *   preformatted text so the owner can read the instructions without
 *   leaving the page.
 */
function OwnerStepRow({
  step,
  done,
}: {
  step: OwnerStep;
  done: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const needsOwner = step.needsOwnerFlags.length > 0;
  return (
    <div className="rounded-lg bg-white/5 border border-white/10">
      <div className="flex items-start gap-3 p-3">
        <div className="flex-shrink-0 mt-0.5">
          {done ? (
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          ) : (
            <div className="w-5 h-5 rounded border-2 border-neutral-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium flex items-center gap-2 flex-wrap ${
              done ? 'text-neutral-400 line-through' : 'text-white'
            }`}
          >
            <span>
              <span className="text-neutral-500 font-mono">{step.number}.</span>{' '}
              {step.title}
            </span>
            {needsOwner && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/15 text-yellow-300 border border-yellow-500/30"
                title={`Step body contains: ${step.needsOwnerFlags.join(', ')}`}
              >
                <AlertTriangle className="w-3 h-3" />
                needs-owner
              </span>
            )}
            {step.markedDone && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-700/40 text-neutral-300 border border-neutral-600">
                marked ☑
              </span>
            )}
          </p>
          <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
            {firstSentence(step.body)}
          </p>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-2 text-[11px] text-blue-400 hover:text-blue-300"
          >
            {expanded ? 'Hide steps' : 'Show steps'}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-white/10 px-4 py-3 bg-black/30">
          <pre className="whitespace-pre-wrap text-xs text-neutral-300 font-mono leading-relaxed">
            {step.body}
          </pre>
        </div>
      )}
    </div>
  );
}

function firstSentence(md: string): string {
  // Strip markdown noise and pick the first non-empty paragraph as the
  // one-line description per the spec.
  const cleaned = md
    .replace(/^[\s\-*]+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*?([^*]+)\*\*?/g, '$1');
  for (const line of cleaned.split(/\r?\n/)) {
    const t = line.trim();
    if (t.length > 0) {
      // Trim to ~140 chars for the one-liner.
      return t.length > 140 ? t.slice(0, 140) + '…' : t;
    }
  }
  return '';
}

function ChecklistItem({ done, title, body, link }: ChecklistItemProps) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
      <div className="flex-shrink-0 mt-0.5">
        {done ? (
          <CheckCircle2 className="w-5 h-5 text-green-400" />
        ) : (
          <div className="w-5 h-5 rounded border-2 border-neutral-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${done ? 'text-neutral-400 line-through' : 'text-white'}`}>
          {title}
        </p>
        <p className="text-xs text-neutral-400 mt-1">{body}</p>
        {link && (
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1 text-xs text-blue-400 hover:text-blue-300"
          >
            <ExternalLink className="w-3 h-3" />
            {link.label}
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SystemHealthPage() {
  const [data, setData] = useState<SystemHealthResponse | null>(null);
  const [ownerChecklist, setOwnerChecklist] = useState<OwnerSetupChecklistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      // Fan out both reads in parallel — the OWNER-SETUP fetch failing
      // should not block the (load-bearing) subsystem grid render. The
      // /api/admin/system-health response shape is NOT changed; the
      // OWNER-SETUP payload is sourced from a separate endpoint.
      const [healthRes, ownerRes] = await Promise.all([
        fetch('/api/admin/system-health', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/admin/owner-setup-checklist', { credentials: 'include', cache: 'no-store' }),
      ]);
      if (!healthRes.ok) {
        throw new Error(`HTTP ${healthRes.status}`);
      }
      const json = (await healthRes.json()) as SystemHealthResponse;
      setData(json);
      if (ownerRes.ok) {
        const ownerJson = (await ownerRes.json()) as OwnerSetupChecklistResponse;
        setOwnerChecklist(ownerJson);
      } else {
        setOwnerChecklist(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-green" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
        <h2 className="text-lg font-bold text-red-300">Failed to load system health</h2>
        <p className="text-sm text-red-200 mt-2">{error ?? 'Unknown error'}</p>
        <button
          onClick={() => void load()}
          className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  const s = data.subsystems;

  // Derive checklist completion from subsystem state.
  const emailDone = s.email.status === 'healthy';
  const turnstileDone = s.turnstile.status === 'healthy';
  const kvDone = s.kv.status === 'healthy';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Activity className="w-8 h-8" />
            System Health
          </h1>
          <p className="text-neutral-400 mt-1">
            One screen, every subsystem. Drives the{' '}
            <code className="text-neutral-300">OWNER-SETUP.md</code> checklist visually.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/system"
            className="px-3 py-2 text-sm text-neutral-300 hover:text-white border border-white/10 rounded-lg"
          >
            Back to System Settings
          </Link>
          <button
            onClick={() => void load()}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-brand-green hover:bg-lime-400 disabled:bg-neutral-700 disabled:text-neutral-400 text-black font-medium rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Overall */}
      <OverallBanner overall={data.overall} timestamp={data.timestamp} />

      {/* Subsystem grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <SubsystemCard
          title="Email (Resend transport)"
          Icon={Mail}
          status={s.email.status}
          details={s.email.details}
          envVars={s.email.envVars}
          activity={
            s.email.lastSendAt
              ? `Last send: ${relativeTime(s.email.lastSendAt)} (${s.email.lastSendStatus ?? 'unknown'})`
              : 'No sends recorded in Email Log tab'
          }
          setupLink={{ label: 'OWNER-SETUP.md §1 — Resend', href: '/OWNER-SETUP.md' }}
        />

        <SubsystemCard
          title="Resend API key"
          Icon={Key}
          status={s.resend.status}
          details={s.resend.details}
          envVars={s.resend.envVars}
          activity={
            s.resend.lastSendAt
              ? `Last activity: ${relativeTime(s.resend.lastSendAt)}`
              : 'No sends since deploy'
          }
          setupLink={{ label: 'OWNER-SETUP.md §1', href: '/OWNER-SETUP.md' }}
        />

        <SubsystemCard
          title="Turnstile (bot challenge)"
          Icon={s.turnstile.status === 'healthy' ? Shield : ShieldOff}
          status={s.turnstile.status}
          details={s.turnstile.details}
          envVars={s.turnstile.envVars}
          setupLink={{ label: 'OWNER-SETUP.md §2 — Turnstile', href: '/OWNER-SETUP.md' }}
        />

        <SubsystemCard
          title="Vercel KV (rate-limit store)"
          Icon={Zap}
          status={s.kv.status}
          details={s.kv.details}
          envVars={s.kv.envVars}
          activity={
            s.kv.pingMs != null
              ? `Ping ${s.kv.pingMs}ms`
              : 'In-memory fallback active'
          }
          setupLink={{ label: 'OWNER-SETUP.md §3 — Vercel KV', href: '/OWNER-SETUP.md' }}
        />

        <SubsystemCard
          title="Google Sheets (master)"
          Icon={Database}
          status={s.sheets.status}
          details={s.sheets.details}
          envVars={s.sheets.envVars}
          activity={
            s.sheets.spreadsheetTitle
              ? `Connected to "${s.sheets.spreadsheetTitle}"`
              : 'Not connected'
          }
          extra={
            s.sheets.tabsExpected.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
                  Tracking tabs
                </p>
                <div className="flex flex-wrap gap-1">
                  {s.sheets.tabsExpected.map((t) => {
                    const present = s.sheets.tabsPresent.includes(t);
                    return (
                      <span
                        key={t}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                          present
                            ? 'bg-green-500/10 text-green-300 border border-green-500/20'
                            : 'bg-neutral-700/30 text-neutral-400 border border-neutral-600'
                        }`}
                        title={present ? 'present' : 'missing (auto-created on first write)'}
                      >
                        {t}
                      </span>
                    );
                  })}
                </div>
              </div>
            )
          }
        />

        <SubsystemCard
          title="JobNimbus CRM"
          Icon={Globe}
          status={s.jn.status}
          details={s.jn.details}
          envVars={s.jn.envVars}
          activity={
            s.jn.lastSyncAt
              ? `Last sync: ${relativeTime(s.jn.lastSyncAt)}`
              : 'No cron-based sync (engine runs on request)'
          }
        />

        <CronsCard crons={s.crons} />
      </div>

      {/* Setup checklist — markdown-driven by OWNER-SETUP.md (parsed server-side
          by /api/admin/owner-setup-checklist). Falls back to a static list if
          the markdown read failed (file moved, perms, etc). */}
      <div className="bg-neutral-900 border border-white/10 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          Setup checklist
        </h2>
        <p className="text-sm text-neutral-400">
          Tasks from <code className="text-neutral-300">OWNER-SETUP.md</code> (read at request
          time). Each item auto-checks when its subsystem reports healthy above. Expand{' '}
          <em>Show steps</em> for the original instructions inline.
        </p>

        {ownerChecklist && ownerChecklist.steps.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ownerChecklist.steps.map((step) => {
              const done = checklistDoneFromHealth(step, {
                emailDone,
                turnstileDone,
                kvDone,
              });
              return <OwnerStepRow key={step.number} step={step} done={done} />;
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ChecklistItem
              done={emailDone}
              title="1. Resend — turn email back on"
              body="Add domain in Resend dashboard, verify DNS, create API key, set RESEND_API_KEY + EMAIL_FROM on all 4 public Vercel projects, redeploy."
              link={{ label: 'Open OWNER-SETUP.md §1', href: '/OWNER-SETUP.md' }}
            />
            <ChecklistItem
              done={turnstileDone}
              title="2. Cloudflare Turnstile"
              body="Create a Turnstile site for rivercityroofingsolutions.com, set NEXT_PUBLIC_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY on all 4 public projects, redeploy."
              link={{ label: 'Open OWNER-SETUP.md §2', href: '/OWNER-SETUP.md' }}
            />
            <ChecklistItem
              done={kvDone}
              title="3. Vercel KV — persistent rate limit"
              body="Create KV database in Vercel Storage tab, connect to all 4 public projects (auto-injects KV_REST_API_*), redeploy."
              link={{ label: 'Open OWNER-SETUP.md §3', href: '/OWNER-SETUP.md' }}
            />
            <ChecklistItem
              done={false}
              title="4. Dead-code triage"
              body="12 open questions in docs/dead-code-triage.md. Decisions feed Phase 4 cleanup."
              link={{ label: 'Open dead-code-triage.md', href: '/docs/dead-code-triage.md' }}
            />
            <ChecklistItem
              done={false}
              title="5. Confirm dead-domain warning"
              body="Vercel still has a typo alias for rivercityroofingsoutions.com (missing 'l'). Easy typosquat — remove it."
              link={{ label: 'Vercel Project Domains', href: 'https://vercel.com/dashboard' }}
            />
          </div>
        )}

        {ownerChecklist && ownerChecklist.sweepBranchesAwaiting.length > 0 && (
          <div className="pt-4 border-t border-white/10">
            <p className="text-xs uppercase tracking-wider text-neutral-500 font-semibold mb-2">
              Sweep branches awaiting review
            </p>
            <ul className="space-y-1">
              {ownerChecklist.sweepBranchesAwaiting.map((b) => (
                <li key={b.branch} className="text-xs text-neutral-300">
                  <code className="text-neutral-200">{b.branch}</code>
                  <span className="ml-2 text-yellow-300">{b.verdict}</span>
                  <span className="ml-2 text-neutral-500">— {b.notes}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-4 border-t border-white/10">
          <p className="text-xs text-neutral-500">
            See also:{' '}
            <code className="text-neutral-300">AGENDA.md</code> for the full [needs-owner] backlog,{' '}
            <code className="text-neutral-300">SECURITY_AUDIT_2026_04_14.md</code> for security
            findings, and{' '}
            <code className="text-neutral-300">docs/dead-code-triage.md</code> for cleanup questions.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Derive checklist done-state from the already-computed system-health booleans.
 *
 * The static legacy version did the same mapping by ordinal position; this
 * version routes on the parsed `checkKey` so re-ordering OWNER-SETUP.md won't
 * silently break the auto-check behavior.
 */
function checklistDoneFromHealth(
  step: OwnerStep,
  flags: { emailDone: boolean; turnstileDone: boolean; kvDone: boolean },
): boolean {
  if (step.markedDone) return true;
  switch (step.checkKey) {
    case 'resend':
      return flags.emailDone;
    case 'turnstile':
      return flags.turnstileDone;
    case 'kv':
      return flags.kvDone;
    case 'dead-code-triage':
    case 'dead-domain':
    case 'unknown':
    default:
      return false;
  }
}
