'use client';

/**
 * RCRS March Madness 2026 - Admin Control Panel
 *
 * Mission control for the tournament. Manage visibility, overrides, prizes,
 * announcements, and bracket preview. Only accessible to owners/admins.
 *
 * Data sources:
 *   GET /api/data/march-madness/settings   -> settings
 *   GET /api/data/march-madness/bracket?mode=live -> bracket data
 *
 * Save endpoints:
 *   POST /api/data/march-madness/settings  -> visibility, overrides, prizes, announcements
 *   POST /api/data/march-madness/bracket   -> update rep weekly sales (Google Sheet direct)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff,
  Monitor,
  MonitorOff,
  Megaphone,
  Save,
  Trash2,
  Trophy,
  Target,
  Users,
  X,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Crown,
  ChevronRight,
  Crosshair,
  Zap,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

// =============================================================================
// Types
// =============================================================================

interface Participant {
  seed: number;
  name: string;
  slug: string;
  nickname: string;
  ytdSales: number;
}

interface MatchSeed {
  seed: number;
  name: string;
  weekSales: number;
  carryForward: number;
  effectiveTotal: number;
  winner: boolean;
}

interface Match {
  matchId: string;
  topSeed: MatchSeed | null;
  bottomSeed: MatchSeed | null;
}

interface Bracket {
  round1: Match[];
  round2: Match[];
  round3: Match[];
}

interface RoundInfo {
  round: number;
  name: string;
  weekStart: string;
  weekEnd: string;
  status: 'upcoming' | 'active' | 'completed';
}

interface BracketData {
  tournament: { name: string; startDate: string; endDate: string; status: string };
  participants: Participant[];
  bracket: Bracket;
  rounds: RoundInfo[];
  salesByRep: Record<string, { week1: number; week2: number; week3: number }>;
  rules: { carryoverRate: number };
  prizes: Record<string, string>;
}

interface SettingsData {
  showToReps: boolean;
  showOnMondayMeeting: boolean;
  tournamentStatus: string;
  marchMadnessAdmins: string[];
  announcementEnabled: boolean;
  announcementMessage: string;
  overrides: Record<string, Record<string, number | null>>;
  prizes: Record<string, string>;
  lastUpdatedBy: string;
  lastUpdatedAt: string;
}

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

// =============================================================================
// Helpers
// =============================================================================

function fmt(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtFull(n: number): string {
  return `$${n.toLocaleString()}`;
}

function timeAgo(iso: string): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const WEEKS = [
  { key: 'week1', label: 'Week 1', dates: 'Mar 16 - 22' },
  { key: 'week2', label: 'Week 2', dates: 'Mar 23 - 29' },
  { key: 'week3', label: 'Week 3', dates: 'Mar 30 - Apr 5' },
] as const;

// =============================================================================
// Toggle Component
// =============================================================================

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      className={cn('flex items-center gap-3', disabled && 'opacity-50 cursor-not-allowed')}
      disabled={disabled}
    >
      <div
        className={cn(
          'relative w-14 h-7 rounded-full transition-colors duration-200',
          checked ? 'bg-brand-green' : 'bg-red-500/50'
        )}
      >
        <div
          className={cn(
            'absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200',
            checked ? 'translate-x-7' : 'translate-x-0.5'
          )}
        />
      </div>
      <span className={cn('font-semibold', checked ? 'text-brand-green' : 'text-red-400')}>
        {label}
      </span>
    </button>
  );
}

// =============================================================================
// Main Admin Page
// =============================================================================

export default function MarchMadnessAdminPage() {
  const { user } = useAuth();

  // ---- State ----
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [bracketData, setBracketData] = useState<BracketData | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Overrides local state (keyed by "RepName.weekN")
  const [localOverrides, setLocalOverrides] = useState<Record<string, string>>({});

  // Announcement local state
  const [announcementMsg, setAnnouncementMsg] = useState('');
  const [announcementEnabled, setAnnouncementEnabled] = useState(false);

  // Prize local state (keys must match settings JSON: champion, topNonChampion, hundredK, note)
  const [prizes, setPrizes] = useState({
    champion: '',
    topNonChampion: '',
    hundredK: '',
    note: '',
    runnerUp: '',
    mvp: '',
  });

  // Quick Update state
  const [quickRep, setQuickRep] = useState('');
  const [quickWeek, setQuickWeek] = useState<1 | 2 | 3>(1);
  const [quickSales, setQuickSales] = useState('');

  // ---- Auth check ----
  const isAdmin = user && ['owner', 'admin'].includes(user.role);
  const isNamedAdmin =
    user &&
    settings?.marchMadnessAdmins?.includes(user.name);
  const hasAccess = isAdmin || isNamedAdmin;

  // ---- Toast helper ----
  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // ---- Fetch data ----
  const fetchData = useCallback(async () => {
    try {
      const [settingsRes, bracketRes] = await Promise.all([
        fetch('/api/data/march-madness/settings'),
        fetch('/api/data/march-madness/bracket?mode=live'),
      ]);

      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        const s = sData.settings || sData;
        setSettings(s);
        setAnnouncementMsg(s.announcementMessage || '');
        setAnnouncementEnabled(s.announcementEnabled || false);
        setPrizes({
          champion: s.prizes?.champion || '',
          topNonChampion: s.prizes?.topNonChampion || '',
          hundredK: s.prizes?.hundredK || '',
          note: s.prizes?.note || '',
          runnerUp: s.prizes?.runnerUp || '',
          mvp: s.prizes?.mvp || '',
        });

        // Build localOverrides from settings
        const ov: Record<string, string> = {};
        if (s.overrides) {
          for (const rep of Object.keys(s.overrides)) {
            for (const week of ['week1', 'week2', 'week3']) {
              const val = s.overrides[rep]?.[week];
              if (val !== null && val !== undefined) {
                ov[`${rep}.${week}`] = String(val);
              }
            }
          }
        }
        setLocalOverrides(ov);
      }

      if (bracketRes.ok) {
        const bData = await bracketRes.json();
        setBracketData(bData);
        if (!quickRep && bData.participants?.length > 0) {
          setQuickRep(bData.participants[0].name);
        }
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
      addToast('error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [addToast, quickRep]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- Save helpers ----
  async function saveSettings(body: Record<string, unknown>, label: string) {
    setSaving(label);
    try {
      const res = await fetch('/api/data/march-madness/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings || data);
        addToast('success', `${label} saved`);
      } else {
        const err = await res.json().catch(() => ({}));
        addToast('error', err.error || `Failed to save ${label}`);
      }
    } catch {
      addToast('error', `Failed to save ${label}`);
    } finally {
      setSaving(null);
    }
  }

  async function handleToggleShowToReps(val: boolean) {
    await saveSettings({ showToReps: val }, 'Visibility');
  }

  async function handleToggleMondayMeeting(val: boolean) {
    await saveSettings({ showOnMondayMeeting: val }, 'Monday Meeting');
  }

  async function handleSaveAnnouncement() {
    await saveSettings(
      { announcementEnabled, announcementMessage: announcementMsg },
      'Announcement'
    );
  }

  function makeKey(rep: string, week: string): string {
    return `${rep}.${week}`;
  }

  async function handleSaveOverrides() {
    // Build overrides object from localOverrides
    const overrides: Record<string, Record<string, number | null>> = {};
    for (const ovKey of Object.keys(localOverrides)) {
      const [rep, week] = ovKey.split('.');
      if (!overrides[rep]) overrides[rep] = {};
      const val = localOverrides[ovKey];
      overrides[rep][week] = val === '' ? null : parseFloat(val);
    }
    // Also include cleared overrides (set to null) for reps that had overrides before
    if (settings?.overrides) {
      for (const rep of Object.keys(settings.overrides)) {
        if (!overrides[rep]) overrides[rep] = {};
        for (const week of ['week1', 'week2', 'week3']) {
          if (
            settings.overrides[rep]?.[week] !== null &&
            settings.overrides[rep]?.[week] !== undefined &&
            !(makeKey(rep, week) in localOverrides)
          ) {
            overrides[rep][week] = null;
          }
        }
      }
    }
    await saveSettings({ overrides }, 'Overrides');
    // Refresh bracket data to see new effective values
    const bracketRes = await fetch('/api/data/march-madness/bracket?mode=live');
    if (bracketRes.ok) {
      setBracketData(await bracketRes.json());
    }
  }

  async function handleClearAllOverrides() {
    const overrides: Record<string, Record<string, null>> = {};
    if (bracketData?.participants) {
      for (const p of bracketData.participants) {
        overrides[p.name] = { week1: null, week2: null, week3: null };
      }
    }
    setLocalOverrides({});
    await saveSettings({ overrides }, 'Overrides cleared');
    const bracketRes = await fetch('/api/data/march-madness/bracket?mode=live');
    if (bracketRes.ok) {
      setBracketData(await bracketRes.json());
    }
  }

  async function handleQuickUpdate() {
    if (!quickRep || !quickSales) {
      addToast('error', 'Enter rep name and sales amount');
      return;
    }
    setSaving('Quick Update');
    try {
      const res = await fetch('/api/data/march-madness/bracket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repName: quickRep,
          week: quickWeek,
          sales: parseFloat(quickSales),
        }),
      });
      if (res.ok) {
        addToast('success', `Updated ${quickRep} Week ${quickWeek}: $${quickSales}`);
        setQuickSales('');
        // Refresh
        const bracketRes = await fetch('/api/data/march-madness/bracket?mode=live');
        if (bracketRes.ok) {
          setBracketData(await bracketRes.json());
        }
      } else {
        const err = await res.json().catch(() => ({}));
        addToast('error', err.error || 'Failed to update');
      }
    } catch {
      addToast('error', 'Failed to update');
    } finally {
      setSaving(null);
    }
  }

  async function handleSavePrizes() {
    await saveSettings({ prizes }, 'Prizes');
  }

  // ---- Override helpers ----
  function getOverrideValue(repName: string, weekKey: string): string {
    return localOverrides[makeKey(repName, weekKey)] ?? '';
  }

  function setOverrideValue(repName: string, weekKey: string, val: string) {
    setLocalOverrides((prev) => ({
      ...prev,
      [makeKey(repName, weekKey)]: val,
    }));
  }

  function clearOverride(repName: string, weekKey: string) {
    setLocalOverrides((prev) => {
      const next = { ...prev };
      delete next[makeKey(repName, weekKey)];
      return next;
    });
  }

  function hasOverride(repName: string, weekKey: string): boolean {
    const k = makeKey(repName, weekKey);
    return k in localOverrides && localOverrides[k] !== '';
  }

  function getAutoValue(repName: string, weekKey: string): number {
    if (!bracketData?.salesByRep?.[repName]) return 0;
    return (bracketData.salesByRep[repName] as Record<string, number>)[weekKey] || 0;
  }

  function getEffectiveValue(repName: string, weekKey: string): number {
    const ov = getOverrideValue(repName, weekKey);
    if (ov !== '') return parseFloat(ov) || 0;
    return getAutoValue(repName, weekKey);
  }

  function getMarchTotal(repName: string): number {
    return (
      getEffectiveValue(repName, 'week1') +
      getEffectiveValue(repName, 'week2') +
      getEffectiveValue(repName, 'week3')
    );
  }

  // ---- Render: Access Denied ----
  if (!loading && !hasAccess) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-neutral-400 mb-6">
            Only owners and admins can access the March Madness control panel.
          </p>
          <Link
            href="/command-center/competition/march-madness"
            className="inline-flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white px-5 py-2.5 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tournament
          </Link>
        </div>
      </div>
    );
  }

  // ---- Render: Loading ----
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-green animate-spin" />
          <p className="text-neutral-400 text-sm">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  const participants = bracketData?.participants || [];
  const sortedParticipants = [...participants].sort((a, b) => a.seed - b.seed);
  const statusLabel = settings?.tournamentStatus || bracketData?.tournament?.status || 'upcoming';

  // ---- Render: Main ----
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in slide-in-from-right',
              t.type === 'success'
                ? 'bg-green-900/90 text-green-200 border border-green-700'
                : 'bg-red-900/90 text-red-200 border border-red-700'
            )}
          >
            {t.type === 'success' ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            {t.message}
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* ================================================================
            Section 1: Header
        ================================================================ */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-green/10 rounded-xl">
              <Settings className="w-6 h-6 text-brand-green" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">March Madness Admin</h1>
              <p className="text-neutral-400 text-sm">
                Tournament Control Panel
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-xs text-neutral-500">
              {settings?.lastUpdatedBy && (
                <p>
                  Updated by{' '}
                  <span className="text-neutral-300">{settings.lastUpdatedBy}</span>{' '}
                  {timeAgo(settings.lastUpdatedAt)}
                </p>
              )}
            </div>
            <Link
              href="/command-center/competition/march-madness"
              className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 px-4 py-2 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Bracket
            </Link>
          </div>
        </div>

        {/* ================================================================
            Section 2: Master Controls
        ================================================================ */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Eye className="w-5 h-5 text-brand-green" />
            <h2 className="text-lg font-bold">Master Controls</h2>
            <span
              className={cn(
                'ml-auto px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide',
                statusLabel === 'upcoming' && 'bg-blue-500/20 text-blue-300',
                statusLabel === 'active' || statusLabel === 'in_progress'
                  ? 'bg-brand-green/20 text-brand-green'
                  : '',
                statusLabel === 'completed' && 'bg-amber-500/20 text-amber-300'
              )}
            >
              {statusLabel === 'in_progress' ? 'Active' : statusLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-neutral-800/50 rounded-xl p-5 border border-neutral-700/50">
              <div className="flex items-center gap-2 mb-3">
                {settings?.showToReps ? (
                  <Eye className="w-5 h-5 text-brand-green" />
                ) : (
                  <EyeOff className="w-5 h-5 text-red-400" />
                )}
                <span className="text-sm font-medium text-neutral-300">Rep Visibility</span>
              </div>
              <Toggle
                checked={settings?.showToReps || false}
                onChange={handleToggleShowToReps}
                label="Show to Sales Reps"
                disabled={saving === 'Visibility'}
              />
              <p className="text-xs text-neutral-500 mt-2">
                {settings?.showToReps
                  ? 'Reps can see the bracket and their standings'
                  : 'Bracket is hidden from sales reps'}
              </p>
            </div>

            <div className="bg-neutral-800/50 rounded-xl p-5 border border-neutral-700/50">
              <div className="flex items-center gap-2 mb-3">
                {settings?.showOnMondayMeeting ? (
                  <Monitor className="w-5 h-5 text-brand-green" />
                ) : (
                  <MonitorOff className="w-5 h-5 text-red-400" />
                )}
                <span className="text-sm font-medium text-neutral-300">Presentation Mode</span>
              </div>
              <Toggle
                checked={settings?.showOnMondayMeeting || false}
                onChange={handleToggleMondayMeeting}
                label="Show on Monday Meeting"
                disabled={saving === 'Monday Meeting'}
              />
              <p className="text-xs text-neutral-500 mt-2">
                {settings?.showOnMondayMeeting
                  ? 'Bracket will appear on the Monday meeting screen'
                  : 'Hidden from Monday meeting display'}
              </p>
            </div>
          </div>
        </div>

        {/* ================================================================
            Section 3: Announcement Banner
        ================================================================ */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Megaphone className="w-5 h-5 text-brand-green" />
            <h2 className="text-lg font-bold">Announcement Banner</h2>
          </div>

          <div className="space-y-4">
            <Toggle
              checked={announcementEnabled}
              onChange={setAnnouncementEnabled}
              label={announcementEnabled ? 'Banner Enabled' : 'Banner Disabled'}
            />

            <textarea
              value={announcementMsg}
              onChange={(e) => setAnnouncementMsg(e.target.value)}
              placeholder="Tournament starts next Monday! Sell to win a 10/22!"
              rows={3}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder-neutral-500 resize-none focus:outline-none focus:border-brand-green transition-colors"
            />

            {announcementEnabled && announcementMsg && (
              <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-3">
                <p className="text-sm text-amber-200">
                  <span className="font-bold">Preview:</span> {announcementMsg}
                </p>
              </div>
            )}

            <button
              onClick={handleSaveAnnouncement}
              disabled={saving === 'Announcement'}
              className="flex items-center gap-2 bg-brand-green text-black font-bold px-6 py-3 rounded-xl hover:bg-brand-green/90 transition-colors disabled:opacity-50"
            >
              {saving === 'Announcement' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Announcement
            </button>
          </div>
        </div>

        {/* ================================================================
            Section 4: Sales Data & Override Table
        ================================================================ */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Target className="w-5 h-5 text-brand-green" />
            <h2 className="text-lg font-bold">Sales Data &amp; Overrides</h2>
            <span className="ml-auto text-xs text-neutral-500">
              Override values take priority over auto (Google Sheets) data
            </span>
          </div>

          {/* Scrollable table */}
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-700">
                  <th className="text-left text-neutral-400 font-medium px-2 py-3 whitespace-nowrap">
                    Rep
                  </th>
                  <th className="text-center text-neutral-400 font-medium px-2 py-3 w-12">
                    Seed
                  </th>
                  {WEEKS.map((w) => (
                    <th key={w.key} className="text-center text-neutral-400 font-medium px-2 py-3 min-w-[160px]">
                      <div>{w.label}</div>
                      <div className="text-xs text-neutral-500 font-normal">{w.dates}</div>
                    </th>
                  ))}
                  <th className="text-center text-neutral-400 font-medium px-2 py-3 whitespace-nowrap">
                    March Total
                  </th>
                  <th className="text-center text-neutral-400 font-medium px-2 py-3 w-20">
                    Override?
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedParticipants.map((p) => {
                  const repHasOverride = WEEKS.some((w) => hasOverride(p.name, w.key));
                  const marchTotal = getMarchTotal(p.name);

                  return (
                    <tr
                      key={p.name}
                      className="border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors"
                    >
                      {/* Rep name */}
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{p.name}</span>
                          <span className="text-neutral-500 text-xs">{p.nickname}</span>
                        </div>
                      </td>

                      {/* Seed */}
                      <td className="px-2 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-neutral-800 text-brand-green font-bold text-xs border border-neutral-700">
                          #{p.seed}
                        </span>
                      </td>

                      {/* Week cells */}
                      {WEEKS.map((w) => {
                        const autoVal = getAutoValue(p.name, w.key);
                        const overrideVal = getOverrideValue(p.name, w.key);
                        const isOverridden = hasOverride(p.name, w.key);

                        return (
                          <td key={w.key} className="px-2 py-3">
                            <div className="flex flex-col items-center gap-1">
                              {/* Auto value label */}
                              <span className="text-xs text-neutral-500">
                                auto: {fmt(autoVal)}
                              </span>

                              {/* Override input */}
                              <div className="relative">
                                <input
                                  type="number"
                                  value={overrideVal}
                                  onChange={(e) =>
                                    setOverrideValue(p.name, w.key, e.target.value)
                                  }
                                  placeholder={String(autoVal)}
                                  className={cn(
                                    'w-32 bg-neutral-800 border rounded-lg px-3 py-2 text-white text-xl font-mono text-center focus:outline-none transition-colors',
                                    isOverridden
                                      ? 'border-amber-500 focus:border-amber-400'
                                      : 'border-neutral-700 focus:border-brand-green'
                                  )}
                                />
                                {isOverridden && (
                                  <button
                                    onClick={() => clearOverride(p.name, w.key)}
                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center transition-colors"
                                    title="Clear override"
                                  >
                                    <X className="w-3 h-3 text-white" />
                                  </button>
                                )}
                              </div>

                              {isOverridden && (
                                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                  OVERRIDE
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      {/* March Total */}
                      <td className="px-2 py-3 text-center">
                        <span
                          className={cn(
                            'text-xl font-bold font-mono',
                            marchTotal >= 100000
                              ? 'text-brand-green'
                              : marchTotal >= 50000
                                ? 'text-amber-400'
                                : 'text-white'
                          )}
                        >
                          {fmt(marchTotal)}
                        </span>
                      </td>

                      {/* Override indicator */}
                      <td className="px-2 py-3 text-center">
                        {repHasOverride ? (
                          <span className="inline-flex items-center gap-1 text-amber-400 text-xs font-semibold">
                            <AlertTriangle className="w-3 h-3" />
                            YES
                          </span>
                        ) : (
                          <span className="text-neutral-600 text-xs">--</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Save / Clear buttons */}
          <div className="flex items-center gap-4 mt-5">
            <button
              onClick={handleSaveOverrides}
              disabled={saving === 'Overrides'}
              className="flex items-center gap-2 bg-brand-green text-black font-bold px-6 py-3 rounded-xl hover:bg-brand-green/90 transition-colors disabled:opacity-50"
            >
              {saving === 'Overrides' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save All Overrides
            </button>
            <button
              onClick={handleClearAllOverrides}
              disabled={saving === 'Overrides cleared'}
              className="text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              Clear All Overrides
            </button>
          </div>

          {/* Quick Update */}
          <div className="mt-6 pt-6 border-t border-neutral-800">
            <h3 className="text-sm font-bold text-neutral-300 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-brand-green" />
              Quick Update (writes directly to Google Sheet)
            </h3>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Rep</label>
                <select
                  value={quickRep}
                  onChange={(e) => setQuickRep(e.target.value)}
                  className="bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-green"
                >
                  {sortedParticipants.map((p) => (
                    <option key={p.name} value={p.name}>
                      #{p.seed} {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Week</label>
                <select
                  value={quickWeek}
                  onChange={(e) => setQuickWeek(Number(e.target.value) as 1 | 2 | 3)}
                  className="bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-green"
                >
                  <option value={1}>Week 1 (Mar 16 - 22)</option>
                  <option value={2}>Week 2 (Mar 23 - 29)</option>
                  <option value={3}>Week 3 (Mar 30 - Apr 5)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Sales ($)</label>
                <input
                  type="number"
                  value={quickSales}
                  onChange={(e) => setQuickSales(e.target.value)}
                  placeholder="25000"
                  className="bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white text-xl font-mono w-40 focus:outline-none focus:border-brand-green"
                />
              </div>
              <button
                onClick={handleQuickUpdate}
                disabled={saving === 'Quick Update'}
                className="flex items-center gap-2 bg-brand-green text-black font-bold px-6 py-3 rounded-xl hover:bg-brand-green/90 transition-colors disabled:opacity-50"
              >
                {saving === 'Quick Update' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Update Sheet
              </button>
            </div>
          </div>
        </div>

        {/* ================================================================
            Section 5: Bracket Preview
        ================================================================ */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Crosshair className="w-5 h-5 text-brand-green" />
            <h2 className="text-lg font-bold">Bracket Preview</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Round 1 */}
            <BracketRoundPreview
              title="Round 1 - First Round"
              subtitle="Mar 16 - 22"
              matches={bracketData?.bracket?.round1 || []}
              roundStatus={bracketData?.rounds?.[0]?.status || 'upcoming'}
            />

            {/* Semifinals */}
            <BracketRoundPreview
              title="Round 2 - Semifinals"
              subtitle="Mar 23 - 29"
              matches={bracketData?.bracket?.round2 || []}
              roundStatus={bracketData?.rounds?.[1]?.status || 'upcoming'}
            />

            {/* Championship */}
            <BracketRoundPreview
              title="Round 3 - Championship"
              subtitle="Mar 30 - Apr 5"
              matches={bracketData?.bracket?.round3 || []}
              roundStatus={bracketData?.rounds?.[2]?.status || 'upcoming'}
            />
          </div>
        </div>

        {/* ================================================================
            Section 6: Prize Editor
        ================================================================ */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Trophy className="w-5 h-5 text-brand-green" />
            <h2 className="text-lg font-bold">Prize Editor</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                <Crown className="w-3 h-3 inline mr-1" />
                Champion Prize
              </label>
              <input
                type="text"
                value={prizes.champion}
                onChange={(e) => setPrizes((p) => ({ ...p, champion: e.target.value }))}
                placeholder="Ruger 10/22 with Suppressor"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-green transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                <Target className="w-3 h-3 inline mr-1" />
                Top Non-Champion Prize
              </label>
              <input
                type="text"
                value={prizes.topNonChampion || ''}
                onChange={(e) => setPrizes((p) => ({ ...p, topNonChampion: e.target.value }))}
                placeholder=".22LR Wrangler Revolver"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-green transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                <DollarSign className="w-3 h-3 inline mr-1" />
                $100K March Bonus
              </label>
              <input
                type="text"
                value={prizes.hundredK || ''}
                onChange={(e) => setPrizes((p) => ({ ...p, hundredK: e.target.value }))}
                placeholder="Sell $100K = auto-win the Wrangler"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-green transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                <Target className="w-3 h-3 inline mr-1" />
                Runner-Up Prize
              </label>
              <input
                type="text"
                value={prizes.runnerUp}
                onChange={(e) => setPrizes((p) => ({ ...p, runnerUp: e.target.value }))}
                placeholder="$250 gift card"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-green transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                <Zap className="w-3 h-3 inline mr-1" />
                MVP Prize
              </label>
              <input
                type="text"
                value={prizes.mvp}
                onChange={(e) => setPrizes((p) => ({ ...p, mvp: e.target.value }))}
                placeholder="Custom recognition"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-green transition-colors"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-neutral-400 mb-1">Legal / Disclaimer Note</label>
              <input
                type="text"
                value={prizes.note}
                onChange={(e) => setPrizes((p) => ({ ...p, note: e.target.value }))}
                placeholder="FFL paperwork required. Must be eligible to own firearms."
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-green transition-colors"
              />
            </div>
          </div>

          <button
            onClick={handleSavePrizes}
            disabled={saving === 'Prizes'}
            className="mt-4 flex items-center gap-2 bg-brand-green text-black font-bold px-6 py-3 rounded-xl hover:bg-brand-green/90 transition-colors disabled:opacity-50"
          >
            {saving === 'Prizes' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Prizes
          </button>
        </div>

        {/* ================================================================
            Section 7: $100K Bonus Tracker
        ================================================================ */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-5 h-5 text-brand-green" />
            <h2 className="text-lg font-bold">$100K Bonus Tracker</h2>
            <span className="ml-auto text-xs text-neutral-500">
              Any rep hitting $100K in approved March sales also wins the grand prize
            </span>
          </div>

          <div className="space-y-3">
            {sortedParticipants.map((p) => {
              const total = getMarchTotal(p.name);
              const pct = Math.min((total / 100000) * 100, 100);
              const colorClass =
                total >= 100000
                  ? 'bg-brand-green'
                  : total >= 75000
                    ? 'bg-amber-500'
                    : total >= 50000
                      ? 'bg-amber-600'
                      : 'bg-red-500';

              return (
                <div key={p.name} className="flex items-center gap-3">
                  <div className="w-36 shrink-0">
                    <span className="text-sm font-medium text-white">{p.name}</span>
                  </div>
                  <div className="flex-1 h-6 bg-neutral-800 rounded-full overflow-hidden relative">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', colorClass)}
                      style={{ width: `${pct}%` }}
                    />
                    {/* 100K marker */}
                    <div className="absolute top-0 right-0 h-full w-px bg-brand-green/50" />
                  </div>
                  <div className="w-24 text-right shrink-0">
                    <span
                      className={cn(
                        'text-sm font-bold font-mono',
                        total >= 100000 ? 'text-brand-green' : 'text-neutral-300'
                      )}
                    >
                      {fmtFull(total)}
                    </span>
                  </div>
                  <div className="w-16 text-right shrink-0">
                    <span className="text-xs text-neutral-500">{pct.toFixed(0)}%</span>
                  </div>
                  {total >= 100000 && (
                    <Trophy className="w-4 h-4 text-brand-green shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ================================================================
            Section 8: Participants
        ================================================================ */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Users className="w-5 h-5 text-brand-green" />
            <h2 className="text-lg font-bold">Participants</h2>
            <span className="ml-auto text-xs text-neutral-500">
              Editing requires JSON file change (data/march-madness-2026.json)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {sortedParticipants.map((p) => (
              <div
                key={p.name}
                className="flex items-center gap-3 bg-neutral-800/50 rounded-lg p-3 border border-neutral-700/50"
              >
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-neutral-900 text-brand-green font-bold text-sm border border-brand-green/30">
                  #{p.seed}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                  <p className="text-xs text-neutral-500">&quot;{p.nickname}&quot;</p>
                </div>
                {p.seed === 1 && (
                  <span className="ml-auto text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded whitespace-nowrap">
                    BYE R1
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Bracket Round Preview Component
// =============================================================================

function BracketRoundPreview({
  title,
  subtitle,
  matches,
  roundStatus,
}: {
  title: string;
  subtitle: string;
  matches: Match[];
  roundStatus: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        roundStatus === 'active' || roundStatus === 'completed'
          ? 'border-brand-green/30 bg-brand-green/5'
          : 'border-neutral-700/50 bg-neutral-800/30'
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <p className="text-xs text-neutral-500">{subtitle}</p>
        </div>
        <span
          className={cn(
            'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full',
            roundStatus === 'completed' && 'bg-brand-green/20 text-brand-green',
            roundStatus === 'active' && 'bg-amber-500/20 text-amber-300',
            roundStatus === 'upcoming' && 'bg-neutral-700 text-neutral-400'
          )}
        >
          {roundStatus}
        </span>
      </div>

      {matches.length === 0 ? (
        <p className="text-xs text-neutral-500 italic">No matches yet (waiting for prior round)</p>
      ) : (
        <div className="space-y-2">
          {matches.map((m) => {
            const top = m.topSeed;
            const bot = m.bottomSeed;
            const isBye = !bot;
            const winner = top?.winner ? top : bot?.winner ? bot : null;

            return (
              <div
                key={m.matchId}
                className={cn(
                  'rounded-md bg-neutral-900/70 border p-2.5 text-xs',
                  winner
                    ? 'border-brand-green/20'
                    : 'border-neutral-700/30'
                )}
              >
                {isBye ? (
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-300">
                      <span className="text-brand-green font-bold">#{top?.seed}</span>{' '}
                      {top?.name}{' '}
                      <span className="text-neutral-500">({fmt(top?.effectiveTotal || 0)})</span>
                    </span>
                    <span className="text-blue-400 text-[10px] font-bold">BYE</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          top?.winner ? 'text-brand-green font-bold' : 'text-neutral-400'
                        )}
                      >
                        <span className="font-bold">#{top?.seed}</span> {top?.name}
                      </span>
                      <span className="font-mono text-neutral-300">
                        {fmt(top?.effectiveTotal || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-center text-neutral-600 text-[10px]">
                      vs
                    </div>
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          bot?.winner ? 'text-brand-green font-bold' : 'text-neutral-400'
                        )}
                      >
                        <span className="font-bold">#{bot?.seed}</span> {bot?.name}
                      </span>
                      <span className="font-mono text-neutral-300">
                        {fmt(bot?.effectiveTotal || 0)}
                      </span>
                    </div>
                    {winner && (
                      <div className="flex items-center gap-1 justify-end pt-1 border-t border-neutral-800">
                        <ChevronRight className="w-3 h-3 text-brand-green" />
                        <span className="text-brand-green font-bold text-[10px]">
                          {winner.name} advances
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
