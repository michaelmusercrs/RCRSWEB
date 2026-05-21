'use client';

/**
 * GroupMe user_id sync (admin tool)
 *
 * - "Sync Now" button calls POST /api/admin/groupme/sync-user-ids
 * - Lists all current mappings from the Team_GroupMe_Mapping sheet tab
 * - Each row exposes an inline edit for the user_id; saving writes a
 *   manualOverride=true row via PATCH, which the sync route will then
 *   skip on every future run.
 *
 * Auth: app/(tools)/admin/layout.tsx already gates the entire /admin
 * area behind the admin login form; the API route does its own
 * requireAdmin() as defense-in-depth.
 *
 * IMPORTANT: this page exercises GroupMe READ endpoints only. The sync
 * route never calls a send path, so the master GroupMe kill-switch
 * remains effective.
 */

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Save, AlertTriangle, CheckCircle2, Search, Loader2 } from 'lucide-react';

interface Mapping {
  slug: string;
  name: string;
  groupme_user_id: string;
  source_group_id: string;
  source_nickname: string;
  matchConfidence: string;
  manualOverride: boolean;
  mappedAt: string;
}

interface SyncMatch {
  slug: string;
  name: string;
  status: 'matched' | 'unmatched' | 'ambiguous' | 'skipped-manual-override';
  groupme_user_id?: string;
  source_group_id?: string;
  source_group_name?: string;
  source_nickname?: string;
  matchConfidence?: string;
  candidateUserIds?: string[];
  reason?: string;
}

interface SyncResponse {
  success: boolean;
  summary?: {
    groupsScanned: number;
    teamMembersConsidered: number;
    matched: number;
    unmatched: number;
    ambiguous: number;
    skippedManual: number;
  };
  matches?: SyncMatch[];
  error?: string;
  note?: string;
}

interface ListResponse {
  success: boolean;
  mappings: Mapping[];
  configured?: boolean;
  error?: string;
}

const STATUS_BADGE: Record<string, string> = {
  matched: 'bg-green-500/20 text-green-400 border-green-500/30',
  unmatched: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  ambiguous: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'skipped-manual-override': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
};

export default function GroupMeSyncPage() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const loadMappings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/groupme/sync-user-ids', { credentials: 'include' });
      const j = (await r.json()) as ListResponse;
      if (!r.ok || !j.success) {
        setError(j.error || `Load failed (HTTP ${r.status})`);
      } else {
        setMappings(j.mappings || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMappings();
  }, [loadMappings]);

  const runSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const r = await fetch('/api/admin/groupme/sync-user-ids', {
        method: 'POST',
        credentials: 'include',
      });
      const j = (await r.json()) as SyncResponse;
      setSyncResult(j);
      if (!r.ok || !j.success) {
        setError(j.error || `Sync failed (HTTP ${r.status})`);
      } else {
        await loadMappings();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const saveOverride = async (slug: string) => {
    const userId = edits[slug] ?? '';
    setSavingSlug(slug);
    setSavedMsg(null);
    setError(null);
    try {
      const r = await fetch('/api/admin/groupme/sync-user-ids', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, groupme_user_id: userId }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) {
        setError(j.error || `Save failed (HTTP ${r.status})`);
      } else {
        setSavedMsg(`Saved override for ${slug}`);
        await loadMappings();
        setEdits(prev => {
          const next = { ...prev };
          delete next[slug];
          return next;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingSlug(null);
    }
  };

  const filtered = filter
    ? mappings.filter(
        m =>
          m.slug.toLowerCase().includes(filter.toLowerCase()) ||
          m.name.toLowerCase().includes(filter.toLowerCase()) ||
          m.groupme_user_id.includes(filter),
      )
    : mappings;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">GroupMe user_id Sync</h1>
        <p className="max-w-3xl text-sm text-neutral-400">
          Walks every GroupMe group the bot is in and matches team members by nickname
          (full name, alias, then first name). Writes mappings to the{' '}
          <code className="rounded bg-white/10 px-1 py-0.5 text-xs">Team_GroupMe_Mapping</code> tab so
          rep-notify can resolve <code className="rounded bg-white/10 px-1 py-0.5 text-xs">slug → user_id</code>
          without re-walking groups on every send. This page only READS from GroupMe — no messages
          are ever sent. Rows with <strong>manual override</strong> are never overwritten by a sync.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={runSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
        <button
          type="button"
          onClick={() => void loadMappings()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-200 hover:bg-white/10 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Reload table
        </button>
        <div className="relative ml-auto">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter slug / name / user_id…"
            className="rounded-md border border-white/10 bg-white/5 py-2 pl-8 pr-3 text-sm text-neutral-200 placeholder-neutral-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>{error}</div>
        </div>
      )}
      {savedMsg && (
        <div className="flex items-start gap-2 rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>{savedMsg}</div>
        </div>
      )}

      {syncResult?.summary && (
        <section className="rounded-md border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-medium text-white">Last sync summary</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-neutral-300 sm:grid-cols-6">
            <div>
              Groups: <span className="text-white">{syncResult.summary.groupsScanned}</span>
            </div>
            <div>
              Considered: <span className="text-white">{syncResult.summary.teamMembersConsidered}</span>
            </div>
            <div>
              Matched: <span className="text-green-400">{syncResult.summary.matched}</span>
            </div>
            <div>
              Unmatched: <span className="text-amber-400">{syncResult.summary.unmatched}</span>
            </div>
            <div>
              Ambiguous: <span className="text-orange-400">{syncResult.summary.ambiguous}</span>
            </div>
            <div>
              Manual: <span className="text-blue-400">{syncResult.summary.skippedManual}</span>
            </div>
          </div>
          {syncResult.note && (
            <div className="mt-3 text-xs italic text-neutral-500">{syncResult.note}</div>
          )}

          {(syncResult.matches?.some(m => m.status === 'ambiguous' || m.status === 'unmatched') ?? false) && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-neutral-400 hover:text-neutral-200">
                Show unmatched / ambiguous reps
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-neutral-400">
                {syncResult.matches
                  ?.filter(m => m.status === 'unmatched' || m.status === 'ambiguous')
                  .map(m => (
                    <li key={m.slug}>
                      <span className="font-medium text-neutral-200">{m.name}</span>{' '}
                      <span className="text-neutral-500">({m.slug})</span> — {m.status}
                      {m.reason ? `: ${m.reason}` : ''}
                      {m.candidateUserIds?.length
                        ? ` [candidates: ${m.candidateUserIds.join(', ')}]`
                        : ''}
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </section>
      )}

      <section className="overflow-hidden rounded-md border border-white/10 bg-white/5">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase text-neutral-400">
            <tr>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">GroupMe user_id</th>
              <th className="px-3 py-2">Source nickname</th>
              <th className="px-3 py-2">Confidence</th>
              <th className="px-3 py-2">Override?</th>
              <th className="px-3 py-2">Mapped at</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-neutral-500">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-neutral-500">
                  No mappings yet. Click <em>Sync Now</em> to populate from GroupMe.
                </td>
              </tr>
            ) : (
              filtered.map(m => {
                const editValue = edits[m.slug];
                const isEdited = editValue !== undefined && editValue !== m.groupme_user_id;
                const isSaving = savingSlug === m.slug;
                return (
                  <tr key={m.slug} className="hover:bg-white/5">
                    <td className="px-3 py-2 font-mono text-xs text-neutral-300">{m.slug}</td>
                    <td className="px-3 py-2 text-neutral-200">{m.name}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={editValue ?? m.groupme_user_id}
                        onChange={e =>
                          setEdits(prev => ({ ...prev, [m.slug]: e.target.value }))
                        }
                        className="w-44 rounded border border-white/10 bg-black/30 px-2 py-1 font-mono text-xs text-neutral-200 focus:border-blue-500 focus:outline-none"
                        placeholder="(empty)"
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-400">
                      {m.source_nickname || <span className="text-neutral-600">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                          STATUS_BADGE[m.matchConfidence === 'manual' ? 'skipped-manual-override' : 'matched'] ||
                          'border-white/10 bg-white/5 text-neutral-400'
                        }`}
                      >
                        {m.matchConfidence || 'unknown'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {m.manualOverride ? (
                        <span className="text-blue-400">yes</span>
                      ) : (
                        <span className="text-neutral-500">no</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-500">
                      {m.mappedAt ? new Date(m.mappedAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => void saveOverride(m.slug)}
                        disabled={!isEdited || isSaving}
                        className="inline-flex items-center gap-1 rounded border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-300 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isSaving ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Save className="h-3 w-3" />
                        )}
                        Save override
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      <p className="text-xs text-neutral-500">
        Manual overrides set the <code className="rounded bg-white/10 px-1">manualOverride</code> flag to{' '}
        <code className="rounded bg-white/10 px-1">true</code>. The sync route will never overwrite a
        row with that flag. Clear an override by saving an empty value, then re-running Sync.
      </p>
    </div>
  );
}
