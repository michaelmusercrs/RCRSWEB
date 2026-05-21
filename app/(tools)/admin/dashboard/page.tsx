'use client';

/**
 * Admin Dashboard — Unified Operational Aggregator
 *
 * Single-page overview that surfaces signal from across the system.
 * Replaces the older simple health-check page. Lives at
 * /admin/dashboard.
 *
 * Auth: parent app/(tools)/admin/layout.tsx already gates this route
 * behind the admin login form + session cookie. Every API this page
 * touches also runs its own requireRoleAtLeast([owner,admin,office,manager])
 * or requireAdmin() check (defense in depth).
 *
 * Layout (3-column responsive grid):
 *   - <  md  (<768px) : stacked single column
 *   - md (768px+)     : 2-column (col-3 stacks below col-1+col-2)
 *   - xl (1280px+)    : true 3-column
 *
 * Data: fans out via Promise.all to EXISTING admin API routes:
 *   /api/admin/system-health
 *   /api/admin/email-log         (recent + counts)
 *   /api/admin/spam-log          (recent + counts)
 *   /api/admin/owner-setup-checklist (markdown parser for OWNER-SETUP.md +
 *                                     sweep-branches + verification-pass doc)
 *   /api/invoices                (last 5 invoices)
 *   /api/portal/tickets?limit=5  (last 5 delivery tickets)
 *   /api/leads?limit=5           (last 5 customer leads)
 *
 * Auto-refreshes every 60s. Manual refresh button also present.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  GitBranch,
  Mail,
  Package,
  RefreshCw,
  ShieldAlert,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';

// ─── Types (mirror existing API responses) ────────────────────────────────────

type SubsystemStatus = 'healthy' | 'degraded' | 'not_configured' | 'error';

interface SystemHealthLite {
  overall: 'healthy' | 'degraded' | 'critical';
  timestamp: string;
  subsystems: Record<
    string,
    {
      status: SubsystemStatus;
      details: string;
      configured: boolean;
      envVars?: Array<{ name: string; set: boolean }>;
    }
  > & {
    crons?: {
      activeCount: number;
      disabledCount: number;
      configuredCrons: Array<{
        path: string;
        schedule: string;
        active: boolean;
        lastRunAt: string | null;
        lastStatus: 'success' | 'error' | 'unknown';
      }>;
    };
  };
}

interface EmailLogResp {
  success: boolean;
  data?: {
    rows: Array<{ timestamp: string; status: string }>;
    counts: Record<string, number>;
    total: number;
  };
}

interface SpamLogResp {
  success: boolean;
  data?: {
    rows: Array<{ timestamp: string; gate: string }>;
    counts: Record<string, number>;
    total: number;
  };
}

interface OwnerStep {
  number: number;
  title: string;
  body: string;
  markedDone: boolean;
  needsOwnerFlags: string[];
  checkKey: string;
}
interface OwnerSetupResp {
  steps: OwnerStep[];
  sweepBranchesAwaiting: Array<{ branch: string; verdict: string; notes: string }>;
  topFindings: Array<{ id: string; title: string; tag: string }>;
  source: { ownerSetupPath: string };
}

interface InvoiceLite {
  invoiceId?: string;
  invoiceNumber?: string;
  customerName?: string;
  total?: number;
  status?: string;
  createdAt?: string;
}
interface InvoicesResp {
  success?: boolean;
  data?: { invoices?: InvoiceLite[] };
}

interface TicketLite {
  ticketId?: string;
  jobName?: string;
  jobAddress?: string;
  status?: string;
  createdAt?: string;
  scheduledDate?: string;
}

interface LeadLite {
  leadId?: string;
  customerName?: string;
  customerAddress?: string;
  status?: string;
  createdAt?: string;
  source?: string;
}
interface LeadsResp {
  success?: boolean;
  data?: LeadLite[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string | undefined | null): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function fmtMoney(n: number | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

/** Count rows whose timestamp is within the last hour. */
function lastHourCount(rows: Array<{ timestamp: string }> | undefined): number {
  if (!rows) return 0;
  const cutoff = Date.now() - 60 * 60 * 1000;
  let n = 0;
  for (const r of rows) {
    const t = Date.parse(r.timestamp);
    if (!Number.isNaN(t) && t >= cutoff) n++;
  }
  return n;
}

/** Filter rows to last hour, group-by a field, return the largest group. */
function topGroupLastHour<T extends { timestamp: string }>(
  rows: T[] | undefined,
  pick: (row: T) => string,
): { key: string; count: number } | null {
  if (!rows || rows.length === 0) return null;
  const cutoff = Date.now() - 60 * 60 * 1000;
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const t = Date.parse(r.timestamp);
    if (Number.isNaN(t) || t < cutoff) continue;
    const k = pick(r) || '(unknown)';
    counts[k] = (counts[k] ?? 0) + 1;
  }
  let best: { key: string; count: number } | null = null;
  for (const [k, c] of Object.entries(counts)) {
    if (!best || c > best.count) best = { key: k, count: c };
  }
  return best;
}

function statusBadge(s: SubsystemStatus | undefined) {
  switch (s) {
    case 'healthy':
      return { cls: 'bg-green-500/15 text-green-300 border-green-500/30', label: 'OK' };
    case 'degraded':
      return { cls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30', label: 'DEG' };
    case 'error':
      return { cls: 'bg-red-500/15 text-red-300 border-red-500/30', label: 'ERR' };
    case 'not_configured':
    default:
      return { cls: 'bg-neutral-700/30 text-neutral-300 border-neutral-600', label: 'OFF' };
  }
}

// ─── Loaders ──────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface DashboardData {
  health: SystemHealthLite | null;
  email: EmailLogResp | null;
  spam: SpamLogResp | null;
  owner: OwnerSetupResp | null;
  invoices: InvoicesResp | null;
  tickets: TicketLite[] | null;
  leads: LeadsResp | null;
  loadedAt: string;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const [health, email, spam, owner, invoices, ticketsResp, leads] = await Promise.all([
      fetchJson<SystemHealthLite>('/api/admin/system-health'),
      fetchJson<EmailLogResp>('/api/admin/email-log?limit=500'),
      fetchJson<SpamLogResp>('/api/admin/spam-log?limit=500'),
      fetchJson<OwnerSetupResp>('/api/admin/owner-setup-checklist'),
      fetchJson<InvoicesResp>('/api/invoices'),
      fetchJson<unknown>('/api/portal/tickets?limit=5'),
      fetchJson<LeadsResp>('/api/leads?limit=5'),
    ]);

    // /api/portal/tickets returns either an array or an object; normalize.
    let ticketsArr: TicketLite[] | null = null;
    if (Array.isArray(ticketsResp)) {
      ticketsArr = ticketsResp as TicketLite[];
    } else if (ticketsResp && typeof ticketsResp === 'object') {
      const obj = ticketsResp as Record<string, unknown>;
      if (Array.isArray(obj.tickets)) ticketsArr = obj.tickets as TicketLite[];
      else if (Array.isArray(obj.data)) ticketsArr = obj.data as TicketLite[];
    }

    setData({
      health,
      email,
      spam,
      owner,
      invoices,
      tickets: ticketsArr,
      leads,
      loadedAt: new Date().toISOString(),
    });
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-green" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header refreshing={refreshing} loadedAt={data.loadedAt} onRefresh={() => void load()} />
      {/*
        Grid: 1 col by default; at md (768px) goes 2 col; at xl (1280px) goes 3 col.
        Each "Column" is actually a wrapping div containing one or more cards so
        we keep semantic grouping on smaller breakpoints.
      */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <ColOperationalStatus data={data} />
        <ColRecentActivity data={data} />
        <ColInsightsActions data={data} />
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({
  refreshing,
  loadedAt,
  onRefresh,
}: {
  refreshing: boolean;
  loadedAt: string;
  onRefresh: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Activity className="w-8 h-8 text-brand-green" />
          Admin Dashboard
        </h1>
        <p className="text-neutral-400 mt-1 text-sm">
          Unified operational overview. Auto-refreshes every 60s. Loaded {relTime(loadedAt)}.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/admin/system/health"
          className="px-3 py-2 text-sm text-neutral-300 hover:text-white border border-white/10 rounded-lg"
        >
          System Health
        </Link>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-brand-green hover:bg-lime-400 disabled:bg-neutral-700 disabled:text-neutral-400 text-black font-medium rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
    </div>
  );
}

// ─── Column 1 — Operational status ────────────────────────────────────────────

function ColOperationalStatus({ data }: { data: DashboardData }) {
  const subsystems = data.health?.subsystems ?? {};
  const rows: Array<{ key: string; label: string }> = [
    { key: 'email', label: 'Email transport' },
    { key: 'resend', label: 'Resend API key' },
    { key: 'turnstile', label: 'Turnstile' },
    { key: 'kv', label: 'Vercel KV' },
    { key: 'sheets', label: 'Google Sheets' },
    { key: 'jn', label: 'JobNimbus CRM' },
  ];

  const emailLastHour = lastHourCount(data.email?.data?.rows);
  const emailRows = data.email?.data?.rows ?? [];
  const cutoff = Date.now() - 60 * 60 * 1000;
  const recentEmails = emailRows.filter((r) => {
    const t = Date.parse(r.timestamp);
    return !Number.isNaN(t) && t >= cutoff;
  });
  const sentLast = recentEmails.filter((r) => /sent|delivered/i.test(r.status)).length;
  const droppedLast = recentEmails.filter((r) => /dropp/i.test(r.status)).length;
  const failedLast = recentEmails.filter((r) => /fail|error/i.test(r.status)).length;

  const spamLastHour = lastHourCount(data.spam?.data?.rows);
  const topGate = topGroupLastHour(data.spam?.data?.rows, (r) => r.gate);

  return (
    <section className="space-y-4">
      <Card title="Subsystems" Icon={Activity}>
        <div className="space-y-2">
          {rows.map((r) => {
            const sub = subsystems[r.key];
            const b = statusBadge(sub?.status);
            return (
              <div key={r.key} className="flex items-center justify-between text-sm">
                <span className="text-neutral-300">{r.label}</span>
                <span className={`px-2 py-0.5 rounded text-[11px] border ${b.cls} font-mono`}>
                  {b.label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="pt-3 mt-3 border-t border-white/5 text-xs text-neutral-400">
          Overall:{' '}
          <span
            className={
              data.health?.overall === 'healthy'
                ? 'text-green-300'
                : data.health?.overall === 'critical'
                ? 'text-red-300'
                : 'text-yellow-300'
            }
          >
            {data.health?.overall?.toUpperCase() ?? 'UNKNOWN'}
          </span>
        </div>
      </Card>

      <Card title="Email (last hour)" Icon={Mail}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat n={sentLast} label="Sent" cls="text-green-300" />
          <Stat n={droppedLast} label="Dropped" cls="text-yellow-300" />
          <Stat n={failedLast} label="Failed" cls="text-red-300" />
        </div>
        <p className="text-[11px] text-neutral-500 mt-2">
          {emailLastHour} total events in the last 60 min.
        </p>
      </Card>

      <Card title="Spam blocked (last hour)" Icon={ShieldAlert}>
        <div className="flex items-baseline justify-between">
          <span className="text-3xl font-bold text-yellow-300">{spamLastHour}</span>
          <span className="text-xs text-neutral-500">requests dropped</span>
        </div>
        <p className="text-xs text-neutral-400 mt-2">
          Top gate:{' '}
          {topGate ? (
            <span className="text-neutral-200 font-mono">
              {topGate.key} ({topGate.count})
            </span>
          ) : (
            <span className="text-neutral-500">— none</span>
          )}
        </p>
      </Card>

      <Card title="Sweep branches awaiting review" Icon={GitBranch}>
        {data.owner?.sweepBranchesAwaiting?.length ? (
          <ul className="space-y-2">
            {data.owner.sweepBranchesAwaiting.map((s) => (
              <li key={s.branch} className="text-xs">
                <code className="text-neutral-200">{s.branch}</code>
                <span className="ml-2 px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-300 text-[10px] border border-yellow-500/30">
                  {s.verdict}
                </span>
                <p className="text-neutral-400 mt-1 line-clamp-2">{s.notes}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-neutral-500">
            All sweep branches are INERT. No action required.
          </p>
        )}
      </Card>
    </section>
  );
}

// ─── Column 2 — Recent activity ───────────────────────────────────────────────

function ColRecentActivity({ data }: { data: DashboardData }) {
  const invoices = (data.invoices?.data?.invoices ?? []).slice(0, 5);
  const tickets = (data.tickets ?? []).slice(0, 5);
  const leads = (data.leads?.data ?? []).slice(0, 5);

  return (
    <section className="space-y-4">
      <Card title="Last 5 invoices" Icon={FileText}>
        {invoices.length === 0 ? (
          <p className="text-xs text-neutral-500">No invoices yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {invoices.map((inv, i) => (
              <li
                key={inv.invoiceId ?? `${inv.invoiceNumber ?? 'inv'}-${i}`}
                className="py-2 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-white font-mono truncate">
                    {inv.invoiceNumber ?? inv.invoiceId ?? '—'}
                  </p>
                  <p className="text-[11px] text-neutral-400 truncate">
                    {inv.customerName ?? 'Unknown customer'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm text-neutral-200 font-mono">{fmtMoney(inv.total)}</p>
                  <p className="text-[10px] text-neutral-500">{relTime(inv.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Last 5 delivery tickets" Icon={Package}>
        {tickets.length === 0 ? (
          <p className="text-xs text-neutral-500">No tickets yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {tickets.map((t, i) => (
              <li key={t.ticketId ?? `t-${i}`} className="py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-white font-mono truncate">
                    {t.ticketId ?? `Ticket ${i + 1}`}
                  </p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-neutral-300 border border-white/10">
                    {t.status ?? 'pending'}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 truncate">{t.jobName ?? '—'}</p>
                <p className="text-[10px] text-neutral-500 truncate">
                  {t.jobAddress ?? '—'} • {relTime(t.createdAt ?? t.scheduledDate)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Last 5 customer leads" Icon={Users}>
        {leads.length === 0 ? (
          <p className="text-xs text-neutral-500">No leads yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {leads.map((l, i) => (
              <li key={l.leadId ?? `l-${i}`} className="py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-white truncate">
                    {l.customerName ?? 'Unknown lead'}
                  </p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-neutral-300 border border-white/10">
                    {l.status ?? 'new'}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 truncate">
                  {l.customerAddress ?? '—'}
                </p>
                <p className="text-[10px] text-neutral-500">
                  {l.source ?? 'unknown'} • {relTime(l.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

// ─── Column 3 — Insights & next actions ───────────────────────────────────────

function ColInsightsActions({ data }: { data: DashboardData }) {
  const subs = data.health?.subsystems ?? {};
  const checkDone = (key: string): boolean => {
    switch (key) {
      case 'resend':
        return subs.resend?.status === 'healthy' || subs.email?.status === 'healthy';
      case 'turnstile':
        return subs.turnstile?.status === 'healthy';
      case 'kv':
        return subs.kv?.status === 'healthy';
      default:
        return false;
    }
  };

  const findings = data.owner?.topFindings ?? [];
  const steps = data.owner?.steps ?? [];

  const crons = data.health?.subsystems?.crons;

  return (
    <section className="space-y-4">
      <Card title="Top 5 verification-pass findings" Icon={AlertCircle}>
        {findings.length === 0 ? (
          <p className="text-xs text-neutral-500">No findings parsed.</p>
        ) : (
          <ul className="space-y-2">
            {findings.map((f) => (
              <li key={f.id} className="text-xs flex items-start gap-2">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 ${
                    f.tag === 'CRITICAL'
                      ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                      : f.tag === 'HIGH'
                      ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30'
                      : f.tag === 'MEDIUM'
                      ? 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30'
                      : f.tag === 'LOW'
                      ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                      : 'bg-neutral-700/40 text-neutral-300 border border-neutral-600'
                  }`}
                >
                  {f.id}
                </span>
                <span className="text-neutral-200">{f.title}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[10px] text-neutral-500 mt-3">
          Source:{' '}
          <code className="text-neutral-300">docs/2026-05-20-verification-pass.md</code>
        </p>
      </Card>

      <Card title="Owner setup checklist" Icon={CheckCircle2}>
        {steps.length === 0 ? (
          <p className="text-xs text-neutral-500">OWNER-SETUP.md not found.</p>
        ) : (
          <ul className="space-y-2">
            {steps.map((s) => {
              const done = checkDone(s.checkKey) || s.markedDone;
              return (
                <li key={s.number} className="text-xs flex items-start gap-2">
                  {done ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-4 h-4 rounded border-2 border-neutral-500 shrink-0 mt-0.5" />
                  )}
                  <span className={done ? 'text-neutral-500 line-through' : 'text-neutral-200'}>
                    <strong className="font-semibold">{s.number}.</strong> {s.title}
                    {s.needsOwnerFlags.length > 0 && (
                      <AlertTriangle className="inline ml-1 w-3.5 h-3.5 text-yellow-400" />
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <Link
          href="/admin/system/health"
          className="inline-flex items-center gap-1 mt-3 text-[11px] text-blue-400 hover:text-blue-300"
        >
          <ExternalLink className="w-3 h-3" /> Open full checklist
        </Link>
      </Card>

      <Card title="Cron status" Icon={Clock}>
        {!crons || crons.configuredCrons.length === 0 ? (
          <p className="text-xs text-neutral-500">No crons configured.</p>
        ) : (
          <>
            <div className="flex gap-2 mb-3">
              <span className="px-2 py-0.5 rounded text-[11px] bg-green-500/15 text-green-300 border border-green-500/30">
                {crons.activeCount} active
              </span>
              {crons.disabledCount > 0 && (
                <span className="px-2 py-0.5 rounded text-[11px] bg-neutral-700/30 text-neutral-300 border border-neutral-600">
                  {crons.disabledCount} disabled
                </span>
              )}
            </div>
            <ul className="space-y-1.5 max-h-48 overflow-y-auto">
              {crons.configuredCrons.slice(0, 8).map((c) => {
                const ok = c.lastStatus === 'success';
                return (
                  <li
                    key={c.path}
                    className="flex items-center justify-between text-[11px] gap-2"
                  >
                    <code className="text-neutral-300 truncate flex-1">{c.path}</code>
                    <span
                      className={`shrink-0 ${
                        ok
                          ? 'text-green-300'
                          : c.lastStatus === 'error'
                          ? 'text-red-300'
                          : 'text-neutral-400'
                      }`}
                    >
                      {ok ? <CheckCircle2 className="inline w-3 h-3" /> :
                       c.lastStatus === 'error' ? <XCircle className="inline w-3 h-3" /> :
                       <Zap className="inline w-3 h-3" />}{' '}
                      {relTime(c.lastRunAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </section>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────

function Card({
  title,
  Icon,
  children,
}: {
  title: string;
  Icon: typeof Activity;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-neutral-900 border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-neutral-400" />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Stat({ n, label, cls }: { n: number; label: string; cls: string }) {
  return (
    <div>
      <p className={`text-2xl font-bold font-mono ${cls}`}>{n}</p>
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
    </div>
  );
}
