'use client';

/**
 * Chris View — TV-mode Leaderboard at /chrisview/board.
 *
 * Full-screen, no-chrome, auto-rotating leaderboard designed for a 1920x1080
 * office TV (Chromecast / Fire Stick drop-in). Public-read like the rest of
 * /chrisview (middleware.ts line 376 whitelists /chrisview/*).
 *
 * Four blocks rotate every 12s with fade transition:
 *   1. Commission Leaderboard (YTD, QB 1099 source)
 *   2. Sales Leaderboard (YTD Monday accrual $$$$$)
 *   3. Weekly Numbers (current meeting-week, self-report)
 *   4. Recent Activity ticker (latest ledger entries)
 *
 * Per [[project_rcrs_leaderboards]] the three leaderboards are NEVER combined
 * — each block is independently sourced. Endpoint: /api/chrisview/board.
 * Polls every 60s, cached 60s server-side.
 *
 * Pause-on-hover: any pointer movement over the main board area pauses
 * rotation; leaving resumes. Owner can hold a single block for inspection.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface LeaderEntry {
  rank: number;
  name: string;
  value: number;
  pctOfLeader: number;
  subtitle?: string;
}

interface ActivityEntry {
  date: string;
  label: string;
  party: string;
  rep: string;
  amount: number;
  positive: boolean;
}

interface BoardData {
  generatedAt: string;
  commission: { period: string; year: string; leaders: LeaderEntry[] };
  sales: { period: string; year: string; leaders: LeaderEntry[] };
  weekly: { period: string; weekOf: string | null; leaders: LeaderEntry[] };
  activity: { items: ActivityEntry[] };
}

type BlockKey = 'commission' | 'sales' | 'weekly';

const BLOCK_DURATION_MS = 12_000;
const POLL_INTERVAL_MS = 60_000;

const BLOCKS: Array<{ key: BlockKey; title: string; subtitle: string }> = [
  { key: 'commission', title: 'Commission Leaderboard', subtitle: 'YTD · QB 1099 source' },
  { key: 'sales',      title: 'Sales Leaderboard',      subtitle: 'YTD · Monday accrual' },
  { key: 'weekly',     title: 'Weekly Numbers',         subtitle: 'Current week · self-report' },
];

// Tailwind palettes / colors for podium positions.
const RANK_COLORS = [
  { ring: 'ring-[#fbbf24]',   text: 'text-[#fbbf24]',   bg: 'bg-[#fbbf24]/10', badge: 'bg-[#fbbf24] text-black' }, // gold
  { ring: 'ring-[#cbd5e1]',   text: 'text-[#cbd5e1]',   bg: 'bg-[#cbd5e1]/10', badge: 'bg-[#cbd5e1] text-black' }, // silver
  { ring: 'ring-[#d97706]',   text: 'text-[#d97706]',   bg: 'bg-[#d97706]/10', badge: 'bg-[#d97706] text-white' }, // bronze
  { ring: 'ring-zinc-600',    text: 'text-zinc-200',    bg: 'bg-zinc-800/40',  badge: 'bg-zinc-700 text-white' },
  { ring: 'ring-zinc-600',    text: 'text-zinc-200',    bg: 'bg-zinc-800/40',  badge: 'bg-zinc-700 text-white' },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() || '')
    .join('') || '?';
}

function fmtMoneyBig(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function formatLeaderValue(blockKey: BlockKey, entry: LeaderEntry): string {
  // Weekly board's headline metric is "signed" (integer count).
  if (blockKey === 'weekly') return fmtNum(entry.value);
  return fmtMoneyBig(entry.value);
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!now) return null;
  const time = now.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const date = now.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
  return (
    <div className="text-right leading-tight">
      <div className="text-2xl font-mono text-white tabular-nums">{time}</div>
      <div className="text-xs text-zinc-400 uppercase tracking-wider">{date}</div>
    </div>
  );
}

function PodiumCard({
  entry,
  blockKey,
  isNew,
}: {
  entry: LeaderEntry;
  blockKey: BlockKey;
  isNew: boolean;
}) {
  const palette = RANK_COLORS[Math.min(entry.rank - 1, RANK_COLORS.length - 1)];
  const isTop3 = entry.rank <= 3;
  const valueDisplay = formatLeaderValue(blockKey, entry);

  return (
    <div
      className={`relative flex items-center gap-6 px-6 py-5 rounded-2xl border border-zinc-800/60 ${palette.bg} ${isNew ? 'animate-board-burst' : ''}`}
    >
      {/* Rank badge */}
      <div
        className={`flex items-center justify-center w-16 h-16 rounded-full text-3xl font-black ring-4 ${palette.ring} ${palette.badge} flex-shrink-0`}
      >
        {entry.rank}
      </div>

      {/* Initials avatar */}
      <div
        className={`flex items-center justify-center w-16 h-16 rounded-full bg-zinc-900 border-2 border-zinc-700 text-xl font-bold ${palette.text} flex-shrink-0`}
      >
        {initials(entry.name)}
      </div>

      {/* Name + subtitle */}
      <div className="flex-1 min-w-0">
        <div className={`text-3xl font-bold truncate ${isTop3 ? palette.text : 'text-white'}`}>
          {entry.name}
        </div>
        {entry.subtitle && (
          <div className="text-sm text-zinc-400 mt-1">{entry.subtitle}</div>
        )}
        {/* Progress bar — pctOfLeader */}
        <div className="mt-2 h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${entry.rank === 1 ? 'bg-[#fbbf24]' : entry.rank === 2 ? 'bg-[#cbd5e1]' : entry.rank === 3 ? 'bg-[#d97706]' : 'bg-[#0066CC]'}`}
            style={{ width: `${Math.max(4, entry.pctOfLeader * 100)}%` }}
          />
        </div>
      </div>

      {/* Big number */}
      <div className="text-right flex-shrink-0">
        <div className={`text-5xl font-black tabular-nums ${isTop3 ? palette.text : 'text-white'}`}>
          {valueDisplay}
        </div>
        {entry.rank > 1 && (
          <div className="text-xs text-zinc-500 mt-1 uppercase tracking-wider">
            {Math.round(entry.pctOfLeader * 100)}% of #1
          </div>
        )}
      </div>
    </div>
  );
}

function LeaderboardBlock({
  blockKey,
  title,
  subtitle,
  leaders,
  prevTopName,
}: {
  blockKey: BlockKey;
  title: string;
  subtitle: string;
  leaders: LeaderEntry[];
  prevTopName: string | null;
}) {
  return (
    <div className="flex flex-col h-full px-12 py-8">
      <header className="mb-6">
        <h2 className="text-5xl font-black text-white tracking-tight">{title}</h2>
        <p className="text-lg text-[#0066CC] font-semibold uppercase tracking-widest mt-1">
          {subtitle}
        </p>
      </header>

      {leaders.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-2xl">
          No data yet for this period.
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-between gap-3">
          {leaders.map(l => (
            <PodiumCard
              key={`${blockKey}-${l.rank}-${l.name}`}
              entry={l}
              blockKey={blockKey}
              isNew={l.rank === 1 && prevTopName !== null && prevTopName !== l.name}
            />
          ))}
          {/* Pad to always show 5 slots even when fewer exist */}
          {Array.from({ length: Math.max(0, 5 - leaders.length) }).map((_, i) => (
            <div
              key={`pad-${i}`}
              className="flex items-center px-6 py-5 rounded-2xl border border-zinc-800/30 bg-zinc-900/20 text-zinc-700 text-lg"
            >
              —
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityTicker({ items }: { items: ActivityEntry[] }) {
  if (items.length === 0) {
    return (
      <div className="h-14 border-t border-zinc-800 bg-zinc-950/80 flex items-center px-6 text-zinc-500 text-sm">
        No recent activity
      </div>
    );
  }
  // Duplicate the items so the marquee loops seamlessly.
  const doubled = [...items, ...items];
  return (
    <div className="h-14 border-t border-zinc-800 bg-zinc-950/80 overflow-hidden relative">
      <div className="absolute left-0 top-0 bottom-0 w-32 z-10 bg-gradient-to-r from-zinc-950 to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-32 z-10 bg-gradient-to-l from-zinc-950 to-transparent pointer-events-none" />
      <div className="h-full flex items-center whitespace-nowrap animate-board-ticker">
        {doubled.map((it, i) => (
          <div key={i} className="flex items-center gap-3 px-6 text-base">
            <span className="text-[#0066CC] font-mono text-xs">{it.date}</span>
            <span className="text-zinc-300 font-semibold">{it.label}</span>
            {it.party && <span className="text-zinc-400">· {it.party}</span>}
            {it.rep && <span className="text-zinc-500 text-sm">({it.rep})</span>}
            <span
              className={`font-bold tabular-nums ${it.positive ? 'text-[#39FF14]' : 'text-red-400'}`}
            >
              {fmtMoneyBig(it.amount)}
            </span>
            <span className="text-zinc-700 px-3">•</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChrisViewBoardPage() {
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blockIdx, setBlockIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  // Track previous #1 per block to drive the "burst" animation when leader changes.
  const prevTopRef = useRef<Record<BlockKey, string | null>>({
    commission: null, sales: null, weekly: null,
  });

  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch('/api/chrisview/board', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const next = (await res.json()) as BoardData;
      // Stash previous top for burst-on-change
      if (data) {
        prevTopRef.current = {
          commission: data.commission.leaders[0]?.name || null,
          sales:      data.sales.leaders[0]?.name      || null,
          weekly:     data.weekly.leaders[0]?.name     || null,
        };
      }
      setData(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [data]);

  // Initial fetch + 60s poll
  useEffect(() => {
    fetchBoard();
    const id = setInterval(fetchBoard, POLL_INTERVAL_MS);
    return () => clearInterval(id);
    // fetchBoard intentionally not in deps — we want a stable interval, not
    // a new interval every time data updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 12s rotation
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setBlockIdx(i => (i + 1) % BLOCKS.length);
    }, BLOCK_DURATION_MS);
    return () => clearInterval(id);
  }, [paused]);

  const active = BLOCKS[blockIdx];

  return (
    <>
      {/* Inline keyframes — keeps bundle small, no new CSS dependency */}
      <style>{`
        @keyframes board-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes board-burst {
          0%   { transform: scale(1);    box-shadow: 0 0 0 0 rgba(251,191,36,0.6); }
          50%  { transform: scale(1.02); box-shadow: 0 0 0 18px rgba(251,191,36,0); }
          100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(251,191,36,0); }
        }
        @keyframes board-ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .animate-board-fade { animation: board-fade-in 700ms ease-out both; }
        .animate-board-burst { animation: board-burst 1500ms ease-out 1; }
        .animate-board-ticker { animation: board-ticker 90s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .animate-board-fade, .animate-board-burst, .animate-board-ticker {
            animation: none !important;
          }
        }
      `}</style>

      <div
        className="fixed inset-0 flex flex-col bg-[#0a0e1a] text-white overflow-hidden"
        style={{ fontFeatureSettings: '"tnum" 1' }}
      >
        {/* Top corner bar: RCRS wordmark + clock + dot indicators */}
        <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-800/60">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[#39FF14] animate-pulse" />
            <div className="leading-tight">
              <div className="text-xl font-black tracking-tight">RIVER CITY ROOFING</div>
              <div className="text-xs text-zinc-500 uppercase tracking-[0.3em]">Live Board</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {BLOCKS.map((b, i) => (
              <button
                key={b.key}
                onClick={() => { setBlockIdx(i); }}
                className={`w-3 h-3 rounded-full transition-all ${
                  i === blockIdx ? 'bg-[#0066CC] scale-125' : 'bg-zinc-700 hover:bg-zinc-500'
                }`}
                aria-label={`Show ${b.title}`}
                title={b.title}
              />
            ))}
          </div>

          <Clock />
        </header>

        {/* Main rotating board — pause-on-hover (or pause on touch for kiosks) */}
        <main
          className="flex-1 relative overflow-hidden"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setTimeout(() => setPaused(false), 4000)}
        >
          {!data && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-2xl">
              Loading the board…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-red-400 text-xl px-8 text-center">
              {error}
            </div>
          )}

          {data && (
            <div key={blockIdx} className="absolute inset-0 animate-board-fade">
              {active.key === 'commission' && (
                <LeaderboardBlock
                  blockKey="commission"
                  title={active.title}
                  subtitle={`${active.subtitle} · ${data.commission.year}`}
                  leaders={data.commission.leaders}
                  prevTopName={prevTopRef.current.commission}
                />
              )}
              {active.key === 'sales' && (
                <LeaderboardBlock
                  blockKey="sales"
                  title={active.title}
                  subtitle={`${active.subtitle} · ${data.sales.year}`}
                  leaders={data.sales.leaders}
                  prevTopName={prevTopRef.current.sales}
                />
              )}
              {active.key === 'weekly' && (
                <LeaderboardBlock
                  blockKey="weekly"
                  title={active.title}
                  subtitle={`${active.subtitle} · week of ${data.weekly.weekOf || '—'}`}
                  leaders={data.weekly.leaders}
                  prevTopName={prevTopRef.current.weekly}
                />
              )}
            </div>
          )}

          {paused && (
            <div className="absolute top-4 right-4 bg-zinc-900/80 border border-zinc-700 rounded-full px-3 py-1 text-xs text-zinc-400 uppercase tracking-widest">
              Paused
            </div>
          )}
        </main>

        {/* Bottom activity ticker (Block 4) — always-on horizontal scroll */}
        {data && <ActivityTicker items={data.activity.items} />}
      </div>
    </>
  );
}
