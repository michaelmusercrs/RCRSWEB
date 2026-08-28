'use client';

import { useEffect, useMemo, useState } from 'react';

interface Row {
  owner: string;
  mailAdd1: string;
  mailCity: string;
  mailState: string;
  mailZip: string;
  parcels: number | null;
  situs: string;
  riskLevel: string;
  riskScore: number | null;
  maxHailIn: number | null;
  maxHailDate: string;
  damagingEvents: number | null;
  mostRecentDamaging: string;
  nearestMi: number | null;
  lat: number | null;
  lon: number | null;
}

interface Payload {
  source: string;
  count: number;
  byLevel: Record<string, number>;
  rows: Row[];
}

const RISK_COLORS: Record<string, string> = {
  High: 'bg-red-100 text-red-800 border-red-300',
  Moderate: 'bg-amber-100 text-amber-800 border-amber-300',
  Low: 'bg-slate-100 text-slate-700 border-slate-300',
};

function mapsUrl(r: Row): string {
  if (r.lat != null && r.lon != null) return `https://www.google.com/maps?q=${r.lat},${r.lon}`;
  const q = encodeURIComponent(r.situs || `${r.mailAdd1} ${r.mailCity} ${r.mailState}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export default function SmithLakePage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [level, setLevel] = useState('All');
  const [sort, setSort] = useState<'risk' | 'hail' | 'recent' | 'events'>('risk');
  const [limit, setLimit] = useState(200);

  useEffect(() => {
    fetch('/api/smithlake', { credentials: 'same-origin' })
      .then(async (r) => {
        if (r.status === 401) throw new Error('Please log in to view this page.');
        if (!r.ok) throw new Error(`Failed to load (${r.status})`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    let rows = data.rows.filter((r) => {
      if (level !== 'All' && r.riskLevel !== level) return false;
      if (!needle) return true;
      return (
        r.owner.toLowerCase().includes(needle) ||
        r.situs.toLowerCase().includes(needle) ||
        r.mailCity.toLowerCase().includes(needle) ||
        r.mailZip.includes(needle)
      );
    });
    const by: Record<string, (r: Row) => number> = {
      risk: (r) => r.riskScore ?? -1,
      hail: (r) => r.maxHailIn ?? -1,
      recent: (r) => (r.mostRecentDamaging ? Date.parse(r.mostRecentDamaging) : -1),
      events: (r) => r.damagingEvents ?? -1,
    };
    const key = by[sort];
    return [...rows].sort((a, b) => key(b) - key(a));
  }, [data, q, level, sort]);

  function exportCsv() {
    const cols = ['owner', 'situs', 'mailAdd1', 'mailCity', 'mailState', 'mailZip', 'riskLevel', 'riskScore', 'maxHailIn', 'maxHailDate', 'damagingEvents', 'mostRecentDamaging', 'nearestMi', 'lat', 'lon'];
    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(','), ...filtered.map((r) => cols.map((c) => esc((r as unknown as Record<string, unknown>)[c])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smith-lake-${level.toLowerCase()}-${filtered.length}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-slate-800">Smith Lake Database</h1>
        <p className="mt-4 rounded-lg bg-red-50 p-4 text-red-700">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-slate-800">Smith Lake Database</h1>
        <p className="mt-4 text-slate-500">Loading {`${(1153172 / 1024 / 1024).toFixed(1)}MB`} of homeowner records…</p>
      </div>
    );
  }

  const tiles = [
    { label: 'Total Owners', value: data.count, hint: 'Unique property owners around Smith Lake (Winston + Cullman + neighbors), from county parcel records.' },
    { label: 'High Risk', value: data.byLevel.High ?? 0, hint: 'Owners whose parcels sit in the highest hail-impact tier (largest/most-frequent nearby damaging hail).' },
    { label: 'Moderate', value: data.byLevel.Moderate ?? 0, hint: 'Owners with meaningful nearby hail history but below the High tier.' },
    { label: 'Low', value: data.byLevel.Low ?? 0, hint: 'Owners with limited nearby damaging hail on record.' },
  ];

  return (
    <div className="p-4 md:p-6">
      <a href="/smithlake" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700">
        ← Smith Lake overview
      </a>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">Smith Lake Database</h1>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">Internal · noindex · homeowner PII</span>
      </div>
      <p className="mb-5 text-sm text-slate-500">{data.source} — ranked by hail-impact risk. Public county parcel/owner data joined with hail history.</p>

      {/* Stat tiles */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="group relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-2xl font-bold text-slate-800">{t.value.toLocaleString()}</div>
            <div className="text-xs font-medium text-slate-500">{t.label}</div>
            <div className="pointer-events-none absolute left-0 top-full z-10 mt-1 hidden w-64 rounded-lg bg-slate-800 p-2 text-xs text-white shadow-lg group-hover:block">
              {t.hint}
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search owner, address, city, zip…"
          className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <select value={level} onChange={(e) => setLevel(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          {['All', 'High', 'Moderate', 'Low'].map((l) => <option key={l}>{l}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="risk">Sort: Risk score</option>
          <option value="hail">Sort: Max hail size</option>
          <option value="recent">Sort: Most recent hail</option>
          <option value="events">Sort: # damaging events</option>
        </select>
        <button onClick={exportCsv} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Export CSV ({filtered.length.toLocaleString()})
        </button>
        <span className="text-sm text-slate-500">Showing {Math.min(limit, filtered.length).toLocaleString()} of {filtered.length.toLocaleString()}</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Property (Situs)</th>
              <th className="px-3 py-2">Mailing</th>
              <th className="px-3 py-2">Risk</th>
              <th className="px-3 py-2" title="Largest nearby hail (inches) on record">Max Hail</th>
              <th className="px-3 py-2" title="Count of 1&quot;+ damaging hail events near this parcel">Events</th>
              <th className="px-3 py-2" title="Distance (mi) to nearest damaging hail">Nearest</th>
              <th className="px-3 py-2">Most Recent</th>
              <th className="px-3 py-2">Map</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.slice(0, limit).map((r, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800">{r.owner}</td>
                <td className="px-3 py-2 text-slate-600">{r.situs}</td>
                <td className="px-3 py-2 text-slate-500">{r.mailAdd1}, {r.mailCity} {r.mailState} {r.mailZip}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${RISK_COLORS[r.riskLevel] || RISK_COLORS.Low}`} title={`Risk score ${r.riskScore ?? '—'} — composite of hail size, frequency, and proximity`}>
                    {r.riskLevel} {r.riskScore != null ? `· ${r.riskScore}` : ''}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600">{r.maxHailIn != null ? `${r.maxHailIn}"` : '—'}</td>
                <td className="px-3 py-2 text-slate-600">{r.damagingEvents ?? '—'}</td>
                <td className="px-3 py-2 text-slate-600">{r.nearestMi != null ? `${r.nearestMi} mi` : '—'}</td>
                <td className="px-3 py-2 text-slate-500">{r.mostRecentDamaging || '—'}</td>
                <td className="px-3 py-2">
                  <a href={mapsUrl(r)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {limit < filtered.length && (
        <div className="mt-4 text-center">
          <button onClick={() => setLimit((l) => l + 200)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Load 200 more
          </button>
        </div>
      )}
    </div>
  );
}
