'use client';

/**
 * GAF QuickMeasure review page.
 *
 * Office view of the ingest queue. Auto-attached reports show as done; anything
 * unmatched/escalated can be manually matched to a JN job here (one-click accept
 * a suggested match, or type an R-number), skipped, or retried. Reached from the
 * office escalation email and the portal admin panel.
 */

import { useEffect, useState, useCallback } from 'react';

interface Suggestion { jobNumber: string; jnid: string; address: string; score: number; }
interface Report {
  orderNumber: string; address: string; repName: string; repEmail: string;
  status: string; jobNumber: string; attempts: number; firstSeenAt: string;
  attachedAt: string; verifiedAt: string; lastError: string; squares: string;
  manualJobNumber: string; suggestions?: Suggestion[];
}

const STATUS_STYLE: Record<string, { bg: string; label: string }> = {
  done: { bg: '#1a7f37', label: 'Attached ✓' },
  attached: { bg: '#2c974b', label: 'Attaching…' },
  matched: { bg: '#2c974b', label: 'Matched' },
  new: { bg: '#57606a', label: 'New' },
  unmatched: { bg: '#bf8700', label: 'No job yet' },
  escalated: { bg: '#cf222e', label: 'Escalated' },
  error: { bg: '#cf222e', label: 'Error' },
  skipped: { bg: '#57606a', label: 'Skipped' },
};

export default function GafReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>('');
  const [manual, setManual] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/portal/gaf/reports', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'load failed');
      setReports(data.reports || []);
      setErr('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (orderNumber: string, payload: Record<string, unknown>) => {
    setBusy(orderNumber);
    try {
      const res = await fetch('/api/portal/gaf/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'action failed');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'action failed');
    } finally {
      setBusy('');
    }
  };

  const open = reports.filter(r => ['unmatched', 'escalated', 'error', 'new'].includes(r.status) && r.status !== 'skipped' && !r.jobNumber);
  const closed = reports.filter(r => !open.includes(r));

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ marginBottom: 4 }}>GAF QuickMeasure — Reports</h1>
      <p style={{ color: '#666', marginTop: 0 }}>
        Reports auto-attach to the matching JobNimbus job. Anything without a match shows here to fix.
      </p>
      <button onClick={load} disabled={loading} style={btn('#0969da')}>{loading ? 'Loading…' : 'Refresh'}</button>
      {err && <div style={{ background: '#ffebe9', color: '#cf222e', padding: 10, borderRadius: 6, margin: '12px 0' }}>{err}</div>}

      <h2 style={{ marginTop: 28 }}>Needs attention ({open.length})</h2>
      {open.length === 0 && <p style={{ color: '#1a7f37' }}>All reports are matched. Nothing to do. ✓</p>}
      {open.map(r => (
        <div key={r.orderNumber} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <strong>{r.address || '(no address)'}</strong>
              <div style={{ color: '#666', fontSize: 13 }}>
                Order #{r.orderNumber} · rep {r.repName || r.repEmail || '—'} · {r.attempts} tries
              </div>
            </div>
            {statusPill(r.status)}
          </div>
          {r.lastError && <div style={{ color: '#cf222e', fontSize: 12, marginTop: 6 }}>Error: {r.lastError}</div>}

          {r.suggestions && r.suggestions.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Suggested jobs:</div>
              {r.suggestions.map(s => (
                <button key={s.jnid} disabled={busy === r.orderNumber}
                  onClick={() => act(r.orderNumber, { jobNumber: s.jobNumber })}
                  style={{ ...btn('#1a7f37'), marginRight: 8, marginBottom: 6 }}>
                  {s.jobNumber || '(no #)'} — {s.address} · {(s.score * 100).toFixed(0)}%
                </button>
              ))}
            </div>
          )}

          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              placeholder="JobNimbus job # (e.g. R-11305)"
              value={manual[r.orderNumber] || ''}
              onChange={e => setManual({ ...manual, [r.orderNumber]: e.target.value })}
              style={{ padding: '8px 10px', border: '1px solid #d0d7de', borderRadius: 6, minWidth: 220 }}
            />
            <button disabled={busy === r.orderNumber || !(manual[r.orderNumber] || '').trim()}
              onClick={() => act(r.orderNumber, { jobNumber: (manual[r.orderNumber] || '').trim() })}
              style={btn('#1a7f37')}>Attach to this job</button>
            <button disabled={busy === r.orderNumber} onClick={() => act(r.orderNumber, { action: 'retry' })} style={btn('#57606a')}>Retry now</button>
            <button disabled={busy === r.orderNumber} onClick={() => act(r.orderNumber, { action: 'skip' })} style={btn('#8250df')}>Skip</button>
          </div>
        </div>
      ))}

      <h2 style={{ marginTop: 32 }}>Recent ({closed.length})</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', background: '#f6f8fa' }}>
              <th style={th}>Status</th><th style={th}>Address</th><th style={th}>Order #</th>
              <th style={th}>Job</th><th style={th}>Rep</th><th style={th}>Squares</th><th style={th}>Seen</th>
            </tr>
          </thead>
          <tbody>
            {closed.map(r => (
              <tr key={r.orderNumber} style={{ borderBottom: '1px solid #eaeef2' }}>
                <td style={td}>{statusPill(r.status)}</td>
                <td style={td}>{r.address}</td>
                <td style={td}>{r.orderNumber}</td>
                <td style={td}>{r.jobNumber || '—'}</td>
                <td style={td}>{r.repName || '—'}</td>
                <td style={td}>{r.squares || '—'}</td>
                <td style={td}>{r.firstSeenAt ? r.firstSeenAt.slice(0, 16).replace('T', ' ') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const card: React.CSSProperties = { border: '1px solid #d0d7de', borderRadius: 8, padding: 14, margin: '12px 0', background: '#fff' };
const th: React.CSSProperties = { padding: '8px 10px', borderBottom: '2px solid #d0d7de' };
const td: React.CSSProperties = { padding: '8px 10px' };
function btn(bg: string): React.CSSProperties {
  return { background: bg, color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13 };
}
function statusPill(status: string) {
  const s = STATUS_STYLE[status] || { bg: '#57606a', label: status };
  return <span style={{ background: s.bg, color: '#fff', padding: '3px 10px', borderRadius: 999, fontSize: 12, whiteSpace: 'nowrap' }}>{s.label}</span>;
}
