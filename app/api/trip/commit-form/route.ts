// Apply the upload after the review form is submitted. Reads dataMap +
// per-cell choices from the form body, commits via existing helpers, and
// redirects to /trip on success.

import { NextRequest, NextResponse } from 'next/server';
import {
  buildTrackerJSON,
  dataMapHash,
  trackerToDataMap,
} from '@/lib/trip/tracker';
import { computeDiff } from '@/lib/trip/diff';
import { renderTripDashboard } from '@/lib/trip/render';
import {
  getChangeLog,
  getSnapshots,
  getTracker,
  putBackupHtml,
  putChangeLog,
  putSnapshots,
  putTracker,
} from '@/lib/trip/store';
import competitionConfig from '@/data/competition-config.json';
import { ChangeLogEntry, DataMap, Snapshot } from '@/lib/trip/types';
import { getActivePeriod } from '@/lib/trip/period';
import { checkWritablePeriod, describeIgnoredMonths, scopeDataMapToPeriod } from '@/lib/trip/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return errorResponse('Bad form data: ' + (e instanceof Error ? e.message : String(e)), 400);
  }

  const dataMapStr = form.get('dataMap');
  const fileName = String(form.get('fileName') || 'uploaded');
  const notes = String(form.get('notes') || '');
  if (typeof dataMapStr !== 'string') {
    return errorResponse('Missing dataMap in form.', 400);
  }
  let dataMap: DataMap;
  try {
    dataMap = JSON.parse(dataMapStr) as DataMap;
  } catch (e) {
    return errorResponse('dataMap is not valid JSON: ' + (e instanceof Error ? e.message : String(e)), 400);
  }

  // Apply per-cell choices from the form. For every retroactive cell the
  // review page added a choice-{rep}|{month} radio plus an optional
  // custom-{rep}|{month} number input.
  const currentTracker = await getTracker();
  const currentMap = currentTracker ? trackerToDataMap(currentTracker) : {};
  for (const [key, value] of form.entries()) {
    if (!key.startsWith('choice-')) continue;
    const cellKey = key.slice('choice-'.length);
    const sep = cellKey.indexOf('|');
    if (sep < 0) continue;
    const rep = cellKey.slice(0, sep);
    const month = cellKey.slice(sep + 1);
    const choice = String(value);
    const oldVal = currentMap[rep]?.[month] ?? 0;
    let resolved: number;
    if (choice === 'old') {
      resolved = oldVal;
    } else if (choice === 'custom') {
      const raw = form.get(`custom-${cellKey}`);
      const num = Number(raw);
      resolved = Number.isFinite(num) && num > 0 ? num : 0;
    } else {
      // 'new' or unrecognized — keep upload value
      continue;
    }
    dataMap[rep] = dataMap[rep] || {};
    if (resolved > 0) dataMap[rep][month] = resolved;
    else delete dataMap[rep][month];
  }

  const activePeriod = getActivePeriod();

  // Block the write outright if the live tracker belongs to a closed half.
  const periodGuard = checkWritablePeriod(currentTracker);
  if (periodGuard) {
    return errorResponse(periodGuard.error, periodGuard.status);
  }

  // Scope to the active period — this form posts a raw JSON dataMap, so it
  // never goes through the xlsx parser's month filter.
  const scoped = scopeDataMapToPeriod(dataMap, activePeriod);
  if (scoped.empty) {
    return errorResponse(
      `Upload contained no months in ${activePeriod.name} (${activePeriod.months[0]}–${activePeriod.months[5]}).`,
      400,
    );
  }
  dataMap = scoped.dataMap;
  const ignoredNote = describeIgnoredMonths(scoped.ignoredMonths, activePeriod);

  // Build proposed tracker
  const monthSet = new Set<string>();
  for (const rep of Object.keys(dataMap)) {
    for (const m of Object.keys(dataMap[rep])) monthSet.add(m);
  }
  const months = activePeriod.months.filter((m) => monthSet.has(m));

  const newTracker = buildTrackerJSON({
    dataMap,
    months,
    tiers: competitionConfig.monthlyBonusTiers,
    tripThreshold: competitionConfig.awardsTrip.threshold,
    period: activePeriod,
    source: fileName,
  });

  const diff = computeDiff(currentMap, dataMap);
  const allChanges = [
    ...diff.retroactive,
    ...diff.removed,
    ...diff.newCellAdditions,
    ...diff.newMonthAdditions,
  ];

  // Backup HTML before overwriting
  let backupUrl: string | null = null;
  if (currentTracker) {
    try {
      const prevHash = await dataMapHash(currentMap);
      const html = renderTripDashboard({
        tracker: currentTracker,
        snapshots: await getSnapshots(),
        changeLog: await getChangeLog(),
      });
      const backup = await putBackupHtml(html, prevHash);
      backupUrl = backup.url;
    } catch (e) {
      console.error('[commit-form] backup failed', e);
    }
  }

  // Write tracker
  const trackerUrl = await putTracker(newTracker);

  // Snapshot
  const hash = await dataMapHash(dataMap);
  const snapshots = await getSnapshots();
  const last = snapshots[snapshots.length - 1] ?? null;
  const retroCount = diff.retroactive.length + diff.removed.length;
  const addCount = diff.newCellAdditions.length + diff.newMonthAdditions.length;
  const newSnapshot: Snapshot = {
    capturedAt: new Date().toISOString(),
    capturedDate: new Date().toISOString().slice(0, 10),
    source: fileName,
    hash,
    teamTotal: newTracker.reps.reduce((s, r) => s + r.ytd, 0),
    qualifiedCount: newTracker.reps.filter((r) => r.qualifiedForTrip).length,
    totalAccrued: newTracker.totalAccrued,
    reps: newTracker.reps.map((r) => ({
      rep: r.rep,
      ytd: r.ytd,
      monthly: r.breakdown.map((b) => ({ month: b.month, revenue: b.revenue, bonus: b.bonus })),
      accrued: r.accruedTripBudget,
      qualified: r.qualifiedForTrip,
      pct: r.pctToTrip,
    })),
    isFirst: !last,
    previousHash: last?.hash ?? null,
    previousCapturedAt: last?.capturedAt ?? null,
    changes: allChanges,
    retroactiveCount: retroCount,
    additionCount: addCount,
  };
  let snapshotsUrl: string | null = null;
  if (!last || last.hash !== hash) {
    snapshotsUrl = await putSnapshots([...snapshots, newSnapshot]);
  }

  // Change log
  let changeLogUrl: string | null = null;
  if (allChanges.length > 0) {
    const log = await getChangeLog();
    const entry: ChangeLogEntry = {
      timestamp: new Date().toISOString(),
      snapshotHash: hash,
      previousHash: last?.hash ?? null,
      additions: addCount,
      modifications: retroCount,
      changes: allChanges,
    };
    changeLogUrl = await putChangeLog([...log, entry]);
  }

  // Fire deploy hook
  let deployInfo = 'No deploy hook configured (set VERCEL_DEPLOY_HOOK_URL).';
  const deployHook = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (deployHook && allChanges.length > 0) {
    try {
      const r = await fetch(deployHook, { method: 'POST' });
      deployInfo = r.ok ? `✓ Deploy triggered (HTTP ${r.status}).` : `Deploy hook failed (HTTP ${r.status}).`;
    } catch (e) {
      deployInfo = 'Deploy hook error: ' + (e instanceof Error ? e.message : String(e));
    }
  } else if (deployHook && allChanges.length === 0) {
    deployInfo = 'No changes to deploy.';
  }

  // Render success page
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Updated</title>
<style>
  body { margin:0; background:#0a0e14; color:#e6edf3; font-family:-apple-system,system-ui,"Segoe UI",Inter,sans-serif; padding:20px; }
  .root { max-width:900px; margin:0 auto; }
  .card { background:#131820; padding:20px; border-radius:12px; border:1px solid #2a3342; margin-bottom:16px; }
  h1 { color:#39FF14; margin:0 0 8px; font-size:28px; }
  a { color:#39FF14; }
  .stat { padding: 8px 0; border-bottom: 1px dotted #2a3342; }
  .stat:last-child { border-bottom: 0; }
  .lbl { color: #8b95a5; }
  .val { font-weight: 700; color: #39FF14; margin-left: 8px; }
  .btn { display:inline-block; padding:12px 24px; border-radius:8px; background:#39FF14; color:#000; text-decoration:none; font-weight:700; margin-right:8px; }
  .btn-sec { display:inline-block; padding:12px 24px; border-radius:8px; background:#1c2330; color:#e6edf3; text-decoration:none; font-weight:600; border:1px solid #2a3342; }
</style>
</head>
<body><div class="root">
  <h1>✓ Updated</h1>
  <p style="color:#8b95a5">Source: <strong>${esc(fileName)}</strong> · Period: <strong>${esc(activePeriod.name)}</strong>${notes ? ' · note: ' + esc(notes) : ''}</p>
  ${ignoredNote ? `<p style="color:#9ec5f0;font-size:13px">ℹ️ ${esc(ignoredNote)}</p>` : ''}

  <section class="card">
    <div class="stat"><span class="lbl">New team total:</span><span class="val">$${Math.round(newSnapshot.teamTotal).toLocaleString()}</span></div>
    <div class="stat"><span class="lbl">Qualified for trip:</span><span class="val">${newSnapshot.qualifiedCount} / ${newTracker.reps.length}</span></div>
    <div class="stat"><span class="lbl">Total accrued pot:</span><span class="val">$${newTracker.totalAccrued.toLocaleString()}</span></div>
    <div class="stat"><span class="lbl">Changes applied:</span><span class="val">${allChanges.length} (${retroCount} retroactive, ${addCount} additions)</span></div>
    <div class="stat"><span class="lbl">Months:</span><span class="val">${months.join(', ')}</span></div>
  </section>

  ${backupUrl ? `<section class="card"><strong>Backup saved:</strong> <a href="${esc(backupUrl)}" target="_blank">open prior /trip snapshot</a></section>` : ''}

  <section class="card">
    <strong>Deploy:</strong> ${esc(deployInfo)}
  </section>

  <section class="card" style="font-size:12px;color:#8b95a5">
    Tracker URL: ${trackerUrl ? `<a href="${esc(trackerUrl)}">${esc(trackerUrl)}</a>` : '(local)'}<br>
    Snapshots URL: ${snapshotsUrl ? `<a href="${esc(snapshotsUrl)}">${esc(snapshotsUrl)}</a>` : '(no new snapshot)'}<br>
    Change-log URL: ${changeLogUrl ? `<a href="${esc(changeLogUrl)}">${esc(changeLogUrl)}</a>` : '(no log entry)'}
  </section>

  <p>
    <a href="/trip" class="btn">View /trip</a>
    <a href="/trip/update" class="btn-sec">Upload another</a>
  </p>
</div></body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function errorResponse(msg: string, status: number): NextResponse {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Error</title></head>
<body style="background:#0a0e14;color:#e6edf3;font-family:-apple-system,system-ui,sans-serif;padding:40px">
<h1 style="color:#ff453a">Commit failed</h1>
<p>${esc(msg)}</p>
<p><a href="/trip/update" style="color:#39FF14">← Back to upload</a></p>
</body></html>`;
  return new NextResponse(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
