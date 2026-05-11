'use client';

import { useState, useRef, useCallback } from 'react';

type CellChange = {
  rep: string;
  month: string;
  oldValue: number;
  newValue: number;
  delta: number;
  type: 'added' | 'removed' | 'modified';
};

type DiffResult = {
  retroactive: CellChange[];
  removed: CellChange[];
  newMonthAdditions: CellChange[];
  newCellAdditions: CellChange[];
  newMonths: string[];
  removedMonths: string[];
  newReps: string[];
  removedReps: string[];
  totalCurrent: number;
  totalNew: number;
};

type DiffResponse = {
  fileName: string;
  incomingTracker: {
    reps: Array<{ rep: string; ytd: number; accruedTripBudget: number; qualifiedForTrip: boolean }>;
    totalAccrued: number;
  };
  incomingDataMap: Record<string, Record<string, number>>;
  incomingMonths: string[];
  diff: DiffResult;
};

const fmtUSD = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export default function TripUpdatePage() {
  const [stage, setStage] = useState<'idle' | 'uploading' | 'review' | 'committing' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const [confirmedCells, setConfirmedCells] = useState<Set<string>>(new Set());
  const [acceptAll, setAcceptAll] = useState(false);
  const [notes, setNotes] = useState('');
  const [commitResult, setCommitResult] = useState<{
    summary: { teamTotal: number; qualifiedCount: number; totalAccrued: number; months: string[] };
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<File | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    setStage('uploading');
    setErrorMsg('');
    fileRef.current = file;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/trip/diff', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Upload failed');
      }
      const json = (await res.json()) as DiffResponse;
      setDiff(json);
      setConfirmedCells(new Set());
      setAcceptAll(false);
      setStage('review');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStage('error');
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.currentTarget.classList.remove('dragover');
      const file = e.dataTransfer.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload],
  );

  const handleCommit = useCallback(async () => {
    if (!diff) return;
    setStage('committing');
    setErrorMsg('');
    try {
      let xlsxBase64: string | undefined;
      if (fileRef.current) {
        const buf = await fileRef.current.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buf);
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        xlsxBase64 = btoa(binary);
      }
      const res = await fetch('/api/trip/commit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          dataMap: diff.incomingDataMap,
          xlsxBase64,
          fileName: diff.fileName,
          notes,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Commit failed' }));
        throw new Error(err.error || 'Commit failed');
      }
      const json = await res.json();
      setCommitResult(json);
      setStage('done');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStage('error');
    }
  }, [diff, notes]);

  const reset = () => {
    setStage('idle');
    setDiff(null);
    setErrorMsg('');
    setNotes('');
    setConfirmedCells(new Set());
    setCommitResult(null);
    fileRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Verification logic: every retroactive/removed change must be confirmed
  const verificationsRequired = diff
    ? [...diff.diff.retroactive, ...diff.diff.removed].length
    : 0;
  const verificationsDone = confirmedCells.size;
  const allVerified =
    verificationsRequired === 0 || acceptAll || verificationsDone === verificationsRequired;

  return (
    <div style={styles.body}>
      <header style={styles.header}>
        <h1 style={styles.h1}>Update Trip Dashboard</h1>
        <a href="/trip" style={styles.backLink}>← Back to /trip</a>
      </header>

      {stage === 'idle' || stage === 'uploading' || stage === 'error' ? (
        <section style={styles.card}>
          <h2 style={styles.h2}>1. Upload new sheet</h2>
          <p style={styles.sub}>
            Drop a new <code>.xlsx</code> with the same format: one tab per month (January, February, …),
            column A = rep name, column B = revenue. A &quot;Totals&quot; tab is fine — it will be ignored.
          </p>
          <label
            style={styles.uploadZone}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add('dragover');
            }}
            onDragLeave={(e) => e.currentTarget.classList.remove('dragover')}
            onDrop={onDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            />
            <div style={{ fontSize: 32 }}>📁</div>
            <div>
              <strong>{stage === 'uploading' ? 'Parsing…' : 'Click or drop XLSX here'}</strong>
            </div>
            <div style={styles.uploadMsg}>
              Tabs = months · Column A = rep · Column B = revenue
            </div>
          </label>
          {stage === 'error' && (
            <div style={styles.dangerBox}>
              <strong>Error:</strong> {errorMsg}
              <div style={{ marginTop: 8 }}>
                <button style={styles.btnSecondary} onClick={reset}>Try again</button>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {stage === 'review' && diff && (
        <ReviewSection
          diff={diff}
          confirmedCells={confirmedCells}
          setConfirmedCells={setConfirmedCells}
          acceptAll={acceptAll}
          setAcceptAll={setAcceptAll}
          notes={notes}
          setNotes={setNotes}
          allVerified={allVerified}
          verificationsRequired={verificationsRequired}
          verificationsDone={verificationsDone}
          onCommit={handleCommit}
          onCancel={reset}
        />
      )}

      {stage === 'committing' && (
        <section style={styles.card}>
          <h2 style={styles.h2}>Saving…</h2>
          <p style={styles.sub}>Writing tracker, xlsx, snapshot, and change log to Vercel Blob.</p>
        </section>
      )}

      {stage === 'done' && commitResult && (
        <section style={styles.card}>
          <h2 style={styles.h2}>✓ Updated</h2>
          <div style={styles.winnerBox}>
            New team total: <strong>{fmtUSD(commitResult.summary.teamTotal)}</strong> · Qualified:{' '}
            <strong>{commitResult.summary.qualifiedCount}</strong> · Pot:{' '}
            <strong>{fmtUSD(commitResult.summary.totalAccrued)}</strong>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            <a href="/trip" style={styles.btnPrimary}>View /trip</a>
            <button style={styles.btnSecondary} onClick={reset}>Upload another</button>
          </div>
        </section>
      )}

      <style jsx global>{`
        body { background: #0a0e14; margin: 0; }
        .dragover { border-color: #39FF14 !important; background: rgba(57,255,20,.04) !important; }
      `}</style>
    </div>
  );
}

function ReviewSection(props: {
  diff: DiffResponse;
  confirmedCells: Set<string>;
  setConfirmedCells: (s: Set<string>) => void;
  acceptAll: boolean;
  setAcceptAll: (b: boolean) => void;
  notes: string;
  setNotes: (s: string) => void;
  allVerified: boolean;
  verificationsRequired: number;
  verificationsDone: number;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const { diff, confirmedCells, setConfirmedCells, acceptAll, setAcceptAll, notes, setNotes, allVerified, verificationsRequired, verificationsDone, onCommit, onCancel } = props;
  const d = diff.diff;
  const totalDelta = d.totalNew - d.totalCurrent;

  const toggleConfirm = (key: string) => {
    const next = new Set(confirmedCells);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setConfirmedCells(next);
  };

  const cellKey = (c: CellChange) => `${c.rep}|${c.month}`;

  return (
    <>
      <section style={styles.card}>
        <h2 style={styles.h2}>2. Review changes — {diff.fileName}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 12 }}>
          <Stat label="Current Team Total" value={fmtUSD(d.totalCurrent)} />
          <Stat label="New Team Total" value={fmtUSD(d.totalNew)} highlight />
          <Stat
            label="Delta"
            value={(totalDelta >= 0 ? '+' : '') + fmtUSD(totalDelta)}
            color={totalDelta >= 0 ? '#39FF14' : '#ff453a'}
          />
          <Stat label="Months in upload" value={String(diff.incomingMonths.length)} />
        </div>
        {d.newMonths.length > 0 && (
          <p style={{ ...styles.sub, marginTop: 12 }}>
            New month tab(s) detected: <strong>{d.newMonths.join(', ')}</strong>. Cell additions in these months are informational only and won&apos;t require verification.
          </p>
        )}
        {d.removedMonths.length > 0 && (
          <div style={styles.dangerBox}>
            <strong>Months removed:</strong> {d.removedMonths.join(', ')}. This will wipe data for those months. Verify intentional.
          </div>
        )}
        {d.removedReps.length > 0 && (
          <div style={styles.warnBox}>
            <strong>Reps no longer in sheet:</strong> {d.removedReps.join(', ')}.
          </div>
        )}
        {d.newReps.length > 0 && (
          <p style={styles.sub}>New rep(s) added: <strong>{d.newReps.join(', ')}</strong></p>
        )}
      </section>

      {/* RETROACTIVE — VERIFY EACH */}
      {(d.retroactive.length > 0 || d.removed.length > 0) && (
        <section style={styles.card}>
          <h2 style={styles.h2}>⚠ Retroactive changes — verification required</h2>
          <p style={styles.sub}>
            These cells had revenue and changed. Each must be confirmed (or use &quot;Accept all&quot;) before saving.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={acceptAll} onChange={(e) => setAcceptAll(e.target.checked)} />
              <span style={{ color: '#e6edf3', fontSize: 13 }}>
                Accept all retroactive changes ({verificationsRequired})
              </span>
            </label>
            {!acceptAll && (
              <span style={{ color: '#8b95a5', fontSize: 12 }}>
                {verificationsDone} / {verificationsRequired} confirmed
              </span>
            )}
          </div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Rep</th>
                <th style={styles.th}>Month</th>
                <th style={styles.thRight}>Was</th>
                <th style={styles.thRight}>Now</th>
                <th style={styles.thRight}>Delta</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Confirm</th>
              </tr>
            </thead>
            <tbody>
              {[...d.retroactive, ...d.removed].map((c) => {
                const k = cellKey(c);
                const checked = acceptAll || confirmedCells.has(k);
                return (
                  <tr key={k} style={{ background: c.type === 'removed' ? 'rgba(255,69,58,.07)' : 'rgba(255,149,0,.07)' }}>
                    <td style={styles.td}><strong>{c.rep}</strong></td>
                    <td style={styles.td}>{c.month}</td>
                    <td style={styles.tdRight}>{fmtUSD(c.oldValue)}</td>
                    <td style={styles.tdRight}>{fmtUSD(c.newValue)}</td>
                    <td style={{ ...styles.tdRight, color: c.delta >= 0 ? '#39FF14' : '#ff453a' }}>
                      {c.delta >= 0 ? '+' : ''}{fmtUSD(c.delta)}
                    </td>
                    <td style={styles.td}>
                      {c.type === 'removed' ? (
                        <span style={{ color: '#ff453a' }}>REMOVED</span>
                      ) : (
                        <span style={{ color: '#ff9500' }}>MODIFIED</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={acceptAll}
                        onChange={() => toggleConfirm(k)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* ADDITIONS — INFORMATIONAL */}
      {(d.newCellAdditions.length > 0 || d.newMonthAdditions.length > 0) && (
        <section style={styles.card}>
          <h2 style={styles.h2}>+ New entries (informational)</h2>
          <p style={styles.sub}>
            {d.newMonthAdditions.length} new in fresh months · {d.newCellAdditions.length} new in existing months. No confirmation required.
          </p>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Rep</th>
                <th style={styles.th}>Month</th>
                <th style={styles.thRight}>Amount</th>
                <th style={styles.th}>Source</th>
              </tr>
            </thead>
            <tbody>
              {[...d.newMonthAdditions, ...d.newCellAdditions].map((c) => (
                <tr key={`${c.rep}|${c.month}`} style={{ background: 'rgba(57,255,20,.05)' }}>
                  <td style={styles.td}><strong>{c.rep}</strong></td>
                  <td style={styles.td}>{c.month}</td>
                  <td style={styles.tdRight}>{fmtUSD(c.newValue)}</td>
                  <td style={styles.td}>
                    {d.newMonths.includes(c.month) ? (
                      <span style={{ color: '#39FF14' }}>new month</span>
                    ) : (
                      <span style={{ color: '#0099ff' }}>new entry</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {d.retroactive.length === 0 && d.removed.length === 0 && d.newCellAdditions.length === 0 && d.newMonthAdditions.length === 0 && (
        <section style={styles.card}>
          <div style={styles.winnerBox}>✓ No changes detected — uploaded file matches current data exactly.</div>
        </section>
      )}

      <section style={styles.card}>
        <h2 style={styles.h2}>3. Notes (optional)</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any concerns or context for these changes? Saved with the snapshot."
          style={styles.textarea}
        />
      </section>

      <section style={styles.card}>
        <h2 style={styles.h2}>4. Apply</h2>
        {!allVerified && (
          <div style={styles.warnBox}>
            ⚠ {verificationsRequired - verificationsDone} retroactive change(s) still need confirmation. Check each one above or toggle &quot;Accept all&quot;.
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button
            style={allVerified ? styles.btnPrimary : { ...styles.btnPrimary, opacity: 0.4, cursor: 'not-allowed' }}
            disabled={!allVerified}
            onClick={onCommit}
          >
            Save &amp; update /trip
          </button>
          <button style={styles.btnSecondary} onClick={onCancel}>Cancel</button>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value, highlight, color }: { label: string; value: string; highlight?: boolean; color?: string }) {
  return (
    <div style={{ background: '#1c2330', padding: 14, borderRadius: 8, border: '1px solid #2a3342' }}>
      <div style={{ fontSize: 11, color: '#8b95a5', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || (highlight ? '#39FF14' : '#e6edf3'), marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    minHeight: '100vh',
    background: '#0a0e14',
    color: '#e6edf3',
    fontFamily: '-apple-system, system-ui, "Segoe UI", Inter, sans-serif',
    padding: 20,
    maxWidth: 1100,
    margin: '0 auto',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 },
  h1: { color: '#39FF14', margin: 0, fontSize: 28 },
  h2: { color: '#39FF14', margin: '0 0 12px', fontSize: 18, borderBottom: '1px solid #2a3342', paddingBottom: 8 },
  sub: { color: '#8b95a5', fontSize: 13, marginBottom: 12, marginTop: 0 },
  backLink: { color: '#8b95a5', textDecoration: 'none', fontSize: 13 },
  card: {
    background: '#131820',
    padding: 20,
    borderRadius: 12,
    border: '1px solid #2a3342',
    marginBottom: 16,
  },
  uploadZone: {
    display: 'block',
    border: '2px dashed #2a3342',
    borderRadius: 12,
    padding: 40,
    textAlign: 'center',
    cursor: 'pointer',
    background: '#1c2330',
    transition: 'all .2s',
  },
  uploadMsg: { color: '#8b95a5', fontSize: 13, marginTop: 8 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #2a3342', color: '#8b95a5', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  thRight: { padding: '8px 10px', textAlign: 'right', borderBottom: '1px solid #2a3342', color: '#8b95a5', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  td: { padding: '8px 10px', borderBottom: '1px solid #2a3342' },
  tdRight: { padding: '8px 10px', borderBottom: '1px solid #2a3342', textAlign: 'right' },
  textarea: {
    width: '100%',
    minHeight: 80,
    background: '#1c2330',
    color: '#e6edf3',
    border: '1px solid #2a3342',
    borderRadius: 6,
    padding: 10,
    fontSize: 13,
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  btnPrimary: {
    display: 'inline-block',
    padding: '10px 18px',
    borderRadius: 8,
    border: 'none',
    background: '#39FF14',
    color: '#000',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
  },
  btnSecondary: {
    display: 'inline-block',
    padding: '10px 18px',
    borderRadius: 8,
    border: '1px solid #2a3342',
    background: '#1c2330',
    color: '#e6edf3',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  dangerBox: { background: 'rgba(255,69,58,.06)', borderLeft: '3px solid #ff453a', padding: '14px 18px', borderRadius: 4, margin: '10px 0', fontSize: 13 },
  warnBox: { background: 'rgba(255,149,0,.06)', borderLeft: '3px solid #ff9500', padding: '14px 18px', borderRadius: 4, margin: '10px 0', fontSize: 13 },
  winnerBox: { background: 'rgba(57,255,20,.06)', borderLeft: '3px solid #39FF14', padding: '14px 18px', borderRadius: 4, margin: '10px 0', fontSize: 13, fontStyle: 'italic', color: '#39FF14', fontWeight: 600 },
};
