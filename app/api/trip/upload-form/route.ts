// Accept the plain-HTML form upload, parse the xlsx, diff against current
// tracker, render a review HTML page with explicit choices and a "Confirm" form.

import { NextRequest, NextResponse } from 'next/server';
import { buildTrackerJSON, parseXlsxBuffer, trackerToDataMap } from '@/lib/trip/tracker';
import { computeDiff } from '@/lib/trip/diff';
import { enrichTracker, RichRep } from '@/lib/trip/insights';
import { getAiSuggestionsForReps } from '@/lib/trip/ai-suggestions';
import { getExcludedReps, getSnapshots, getTracker } from '@/lib/trip/store';
import competitionConfig from '@/data/competition-config.json';
import { getActivePeriod } from '@/lib/trip/period';
import { checkWritablePeriod, describeIgnoredMonths } from '@/lib/trip/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fmtUSD = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (e) {
    return new NextResponse(
      errorPage('Could not parse form data: ' + (e instanceof Error ? e.message : String(e))),
      { status: 400, headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  }
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return new NextResponse(errorPage('No file uploaded.'), {
      status: 400,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
  if (file.size > 10 * 1024 * 1024) {
    return new NextResponse(errorPage('File too large (10MB max).'), {
      status: 413,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  const activePeriod = getActivePeriod();
  const excludedReps = await getExcludedReps();
  let parsed: Awaited<ReturnType<typeof parseXlsxBuffer>>;
  try {
    const buf = await file.arrayBuffer();
    parsed = await parseXlsxBuffer(buf, excludedReps, new Set(activePeriod.months));
  } catch (e) {
    return new NextResponse(
      errorPage('Failed to parse xlsx: ' + (e instanceof Error ? e.message : String(e))),
      { status: 400, headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  }

  if (parsed.months.length === 0) {
    return new NextResponse(
      errorPage(
        `This workbook has no sheets for the active period (${activePeriod.name}). ` +
          `Expected one or more of: ${activePeriod.months.join(', ')}.` +
          (parsed.ignoredMonths.length
            ? ` Ignored out-of-period sheets: ${parsed.ignoredMonths.map((i) => i.month).join(', ')}.`
            : ''),
      ),
      { status: 400, headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  }

  const currentTracker = await getTracker();

  // Refuse to preview a write when the live tracker belongs to a closed half.
  const guard = checkWritablePeriod(currentTracker);
  if (guard) {
    return new NextResponse(
      errorPage(
        `${guard.error} Until then, uploads are blocked so the closed period's numbers cannot be altered.`,
      ),
      { status: guard.status, headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  }
  const currentMap = currentTracker ? trackerToDataMap(currentTracker) : {};
  const diff = computeDiff(currentMap, parsed.dataMap);

  // Build a proposed tracker from the upload so we can preview wins/gaps/suggestions
  const monthSet = new Set<string>();
  for (const rep of Object.keys(parsed.dataMap)) {
    for (const m of Object.keys(parsed.dataMap[rep])) monthSet.add(m);
  }
  const monthOrder = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthList = monthOrder.filter((m) => monthSet.has(m));
  const proposedTracker = buildTrackerJSON({
    dataMap: parsed.dataMap,
    months: monthList,
    tiers: competitionConfig.monthlyBonusTiers,
    tripThreshold: competitionConfig.awardsTrip.threshold,
    period: activePeriod,
    source: file.name,
  });
  const snapshots = await getSnapshots();
  const periodEnd = new Date(`${activePeriod.end}T23:59:59Z`);
  const proposedEnriched = enrichTracker({ tracker: proposedTracker, snapshots, periodEnd });
  const currentEnriched = currentTracker
    ? enrichTracker({
        tracker: currentTracker,
        snapshots,
        periodEnd: new Date(`${currentTracker.period.end}T23:59:59Z`),
      })
    : null;

  // Optional: generate AI coaching suggestions per rep (parallel, prompt-cached)
  const aiRequested = formData.get('ai') === '1';
  let aiSuggestions = new Map<string, string[]>();
  if (aiRequested) {
    const currentByRep = new Map<string, RichRep>();
    if (currentEnriched) for (const r of currentEnriched.reps) currentByRep.set(r.rep, r);
    aiSuggestions = await getAiSuggestionsForReps(
      proposedEnriched.reps.map((rep) => {
        const before = currentByRep.get(rep.rep) ?? null;
        return {
          rep,
          proposedYtd: rep.ytd,
          proposedGap: rep.gapToTrip,
          proposedPot: rep.accruedTripBudget,
          proposedPctToTrip: rep.pctToTrip,
          proposedQualified: rep.qualifiedForTrip,
          monthsCompleted: proposedEnriched.monthsCompleted,
          proposedBreakdown: rep.breakdown,
          existingWins: rep.insights.wins,
          existingGaps: rep.insights.gaps,
          existingSuggestions: rep.insights.suggestions,
          previousYtd: before?.ytd,
          previousPot: before?.accruedTripBudget,
        };
      }),
    );
  }

  // Render the review page
  const html = reviewPage({
    fileName: file.name,
    ignoredNote: describeIgnoredMonths(parsed.ignoredMonths, activePeriod),
    activePeriodName: activePeriod.name,
    dataMap: parsed.dataMap,
    diff,
    excluded: parsed.excludedSummary,
    appliedExcludedList: parsed.excludedReps,
    proposedReps: proposedEnriched.reps,
    currentReps: currentEnriched?.reps ?? null,
    aiSuggestions,
    aiRequested,
  });
  return new NextResponse(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function errorPage(msg: string): string {
  return shell(`
    <h1 style="color:#ff453a">Upload failed</h1>
    <p>${esc(msg)}</p>
    <p><a href="/trip/update" style="color:#39FF14">← Try again</a></p>
  `);
}

interface ReviewArgs {
  fileName: string;
  /** Note about out-of-period sheets that were skipped, if any. */
  ignoredNote: string | null;
  activePeriodName: string;
  dataMap: Record<string, Record<string, number>>;
  diff: ReturnType<typeof computeDiff>;
  excluded: { rep: string; total: number }[];
  appliedExcludedList: string[];
  proposedReps: RichRep[];
  currentReps: RichRep[] | null;
  aiSuggestions: Map<string, string[]>;
  aiRequested: boolean;
}

function reviewPage(args: ReviewArgs): string {
  const { fileName, ignoredNote, activePeriodName, dataMap, diff, excluded, proposedReps, currentReps, aiSuggestions, aiRequested } = args;
  const retroCells = [...diff.retroactive, ...diff.removed];
  const totalDelta = diff.totalNew - diff.totalCurrent;

  // Encode the dataMap so the confirm form can post it back without re-parsing.
  const dataMapJson = JSON.stringify(dataMap);

  const currentByRep = new Map<string, RichRep>();
  if (currentReps) for (const r of currentReps) currentByRep.set(r.rep, r);
  const droppedReps = currentReps ? currentReps.filter((r) => !proposedReps.some((p) => p.rep === r.rep)) : [];

  return shell(`
    <h1 style="color:#39FF14;margin:0">Review upload</h1>
    <p style="color:#8b95a5;font-size:13px">
      Source: <strong>${esc(fileName)}</strong>
      · Period: <strong style="color:#39FF14">${esc(activePeriodName)}</strong>
      · <a href="/trip/update" style="color:#8b95a5">← Choose a different file</a>
    </p>
    ${
      ignoredNote
        ? `<div style="background:#14243a;border:1px solid #2c4a72;border-radius:8px;padding:12px 14px;margin:12px 0;color:#9ec5f0;font-size:13px">
             ℹ️ ${esc(ignoredNote)}
           </div>`
        : ''
    }

    <section class="card">
      <h2>Summary</h2>
      <div class="grid">
        <div class="stat"><span class="lbl">Current Team Total</span><span class="val">${fmtUSD(diff.totalCurrent)}</span></div>
        <div class="stat"><span class="lbl">New Team Total</span><span class="val" style="color:#39FF14">${fmtUSD(diff.totalNew)}</span></div>
        <div class="stat"><span class="lbl">Delta</span><span class="val" style="color:${totalDelta >= 0 ? '#39FF14' : '#ff453a'}">${totalDelta >= 0 ? '+' : ''}${fmtUSD(totalDelta)}</span></div>
        <div class="stat"><span class="lbl">Months in upload</span><span class="val">${diff.monthTotals.length}</span></div>
      </div>
      ${diff.newMonths.length > 0 ? `<p>New month(s): <strong style="color:#39FF14">${diff.newMonths.map(esc).join(', ')}</strong></p>` : ''}
      ${diff.removedMonths.length > 0 ? `<p style="color:#ff453a">Removed month(s): <strong>${diff.removedMonths.map(esc).join(', ')}</strong></p>` : ''}
      ${diff.newReps.length > 0 ? `<p>New rep(s): <strong style="color:#39FF14">${diff.newReps.map(esc).join(', ')}</strong></p>` : ''}
      ${diff.removedReps.length > 0 ? `<p style="color:#ff453a">Reps no longer in sheet: <strong>${diff.removedReps.map(esc).join(', ')}</strong></p>` : ''}
      ${excluded.length > 0 ? `<p>Filtered on upload: ${excluded.map((e) => `<strong>${esc(e.rep)}</strong> (${fmtUSD(e.total)})`).join(', ')}</p>` : ''}
    </section>

    <section class="card">
      <h2>Per-month totals</h2>
      <table>
        <thead><tr><th>Month</th><th class="r">Previous</th><th class="r">New</th><th class="r">Delta</th><th>Status</th></tr></thead>
        <tbody>
          ${diff.monthTotals
            .map((m) => {
              const status = !m.preExisting
                ? '<span style="color:#39FF14">NEW MONTH</span>'
                : m.hasRetroChange
                  ? '<span style="color:#ff9500">MODIFIED</span>'
                  : m.delta > 0.01
                    ? '<span style="color:#0099ff">+ NEW ENTRIES</span>'
                    : '<span style="color:#8b95a5">UNCHANGED ✓</span>';
              return `<tr>
                <td><strong>${esc(m.month)}</strong></td>
                <td class="r">${fmtUSD(m.prevTotal)}</td>
                <td class="r">${fmtUSD(m.newTotal)}</td>
                <td class="r" style="color:${m.delta > 0 ? '#39FF14' : m.delta < 0 ? '#ff453a' : '#8b95a5'}">${m.delta === 0 ? '—' : (m.delta > 0 ? '+' : '') + fmtUSD(m.delta)}</td>
                <td>${status}</td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </section>

    <form action="/api/trip/commit-form" method="POST">
      <input type="hidden" name="dataMap" value="${esc(dataMapJson)}" />
      <input type="hidden" name="fileName" value="${esc(fileName)}" />

      ${retroCells.length > 0 ? renderRetroactive(retroCells) : `<section class="card"><div class="good">✓ No retroactive changes — all prior cells are unchanged.</div></section>`}

      ${diff.newCellAdditions.length + diff.newMonthAdditions.length > 0 ? renderAdditions([...diff.newMonthAdditions, ...diff.newCellAdditions], diff.newMonths) : ''}

      ${renderRepAudit(proposedReps, currentByRep, droppedReps, aiSuggestions, aiRequested)}

      <section class="card">
        <h2>Confirm &amp; deploy</h2>
        <label style="display:block;color:#8b95a5;font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Notes (optional)</label>
        <textarea name="notes" rows="3" style="width:100%;background:#1c2330;color:#e6edf3;border:1px solid #2a3342;border-radius:6px;padding:8px;font-family:inherit;font-size:13px" placeholder="Any context for these changes?"></textarea>

        <div style="margin-top:14px;display:flex;gap:10px">
          <button type="submit" style="padding:14px 28px;border-radius:10px;border:0;background:#39FF14;color:#000;font-size:16px;font-weight:700;cursor:pointer">
            ⬆ Save &amp; update /trip
          </button>
          <a href="/trip/update" style="padding:14px 28px;border-radius:10px;border:1px solid #2a3342;background:#1c2330;color:#e6edf3;font-size:14px;font-weight:600;text-decoration:none;display:inline-block">Cancel</a>
        </div>
      </section>
    </form>
  `);
}

function renderRetroactive(cells: ReturnType<typeof computeDiff>['retroactive']): string {
  return `
    <section class="card">
      <h2 style="color:#ff9500">⚠ Retroactive changes — pick a value for each cell</h2>
      <p style="color:#8b95a5;font-size:13px;margin-top:0">
        These cells had revenue and changed. For each, choose OLD (keep prior), NEW (accept upload), or CUSTOM (enter a value).
        Picks are submitted with the form below.
      </p>
      <table>
        <thead><tr><th>Rep</th><th>Month</th><th class="r">OLD</th><th class="r">NEW</th><th>Pick</th></tr></thead>
        <tbody>
          ${cells
            .map((c) => {
              const k = `${c.rep}|${c.month}`;
              return `<tr>
                <td><strong>${esc(c.rep)}</strong></td>
                <td>${esc(c.month)}</td>
                <td class="r">${fmtUSD(c.oldValue)}</td>
                <td class="r">${fmtUSD(c.newValue)}</td>
                <td>
                  <label><input type="radio" name="choice-${esc(k)}" value="old" /> OLD</label>
                  <label style="margin-left:8px"><input type="radio" name="choice-${esc(k)}" value="new" checked /> NEW</label>
                  <label style="margin-left:8px"><input type="radio" name="choice-${esc(k)}" value="custom" /> CUSTOM</label>
                  <input type="number" step="0.01" min="0" name="custom-${esc(k)}" placeholder="$" style="margin-left:6px;width:110px;background:#1c2330;color:#e6edf3;border:1px solid #2a3342;border-radius:4px;padding:3px 6px;font-size:12px" />
                </td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderRepAudit(
  proposed: RichRep[],
  currentByRep: Map<string, RichRep>,
  droppedReps: RichRep[],
  aiSuggestions: Map<string, string[]>,
  aiRequested: boolean,
): string {
  if (proposed.length === 0) return '';

  const diffLists = (before: string[], after: string[]) => {
    const beforeSet = new Set(before);
    const afterSet = new Set(after);
    return {
      added: after.filter((x) => !beforeSet.has(x)),
      removed: before.filter((x) => !afterSet.has(x)),
    };
  };

  const cards = proposed
    .map((after) => {
      const before = currentByRep.get(after.rep) ?? null;
      const isNew = !before;
      const wins = diffLists(before?.insights.wins ?? [], after.insights.wins);
      const gaps = diffLists(before?.insights.gaps ?? [], after.insights.gaps);
      const sug = diffLists(before?.insights.suggestions ?? [], after.insights.suggestions);
      const motivChanged = (before?.insights.motivation ?? '') !== after.insights.motivation;
      const hasChanges =
        isNew ||
        wins.added.length + wins.removed.length +
        gaps.added.length + gaps.removed.length +
        sug.added.length + sug.removed.length > 0 ||
        motivChanged;

      const borderColor = isNew ? '#39FF14' : hasChanges ? '#ff9500' : '#2a3342';

      const renderList = (title: string, marker: string, color: string, after: string[], added: string[], removed: string[]) => {
        if (after.length === 0 && removed.length === 0) return '';
        const addedSet = new Set(added);
        return `
          <div style="margin-top:8px">
            <div style="font-size:10px;color:#8b95a5;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">${esc(title)}</div>
            <ul style="margin:0;padding:0;list-style:none;font-size:12px">
              ${after.map((l) => `<li style="padding:2px 0;color:${addedSet.has(l) ? '#39FF14' : '#e6edf3'}"><strong style="color:${color}">${esc(marker)}</strong> ${l}${addedSet.has(l) ? ' <span style="font-size:10px;color:#39FF14">NEW</span>' : ''}</li>`).join('')}
              ${removed.map((l) => `<li style="padding:2px 0;color:#ff453a;text-decoration:line-through"><strong>×</strong> ${l} <span style="font-size:10px;text-decoration:none">REMOVED</span></li>`).join('')}
            </ul>
          </div>`;
      };

      // Required-checkbox name encodes per-rep approval. Reps with changes
      // are required; unchanged reps are pre-checked.
      const checkboxName = `approve-${after.rep}`;
      const requiredAttr = hasChanges ? 'required' : '';
      const checkedAttr = hasChanges ? '' : 'checked';

      return `
        <div style="background:#131820;padding:14px;border-radius:10px;border:1px solid ${borderColor};margin-bottom:12px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px">
            <div>
              <strong style="font-size:15px">${esc(after.rep)}</strong>
              ${isNew ? '<span style="font-size:10px;color:#39FF14;margin-left:6px">NEW</span>' : ''}
              ${!hasChanges && !isNew ? '<span style="font-size:10px;color:#8b95a5;margin-left:6px">unchanged</span>' : ''}
            </div>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
              <input type="checkbox" name="${esc(checkboxName)}" ${requiredAttr} ${checkedAttr} />
              <span style="color:${hasChanges ? '#ff9500' : '#39FF14'}">Approve</span>
              ${hasChanges ? '<span style="font-size:10px;color:#ff9500">(required)</span>' : ''}
            </label>
          </div>
          <div style="font-size:12px;color:#8b95a5;margin-bottom:6px">
            $${Math.round(before?.ytd ?? 0).toLocaleString()} → <span style="color:#39FF14">$${Math.round(after.ytd).toLocaleString()}</span>
            · Pot: $${(before?.accruedTripBudget ?? 0).toLocaleString()} → <span style="color:#39FF14">$${after.accruedTripBudget.toLocaleString()}</span>
            · ${after.qualifiedForTrip ? '<span style="color:#39FF14">QUALIFIED ✓</span>' : `<span style="color:#ff9500">${after.pctToTrip.toFixed(1)}% to trip</span>`}
          </div>
          ${renderList('Wins', '✓', '#39FF14', after.insights.wins, wins.added, wins.removed)}
          ${renderList('Gaps', '!', '#ff9500', after.insights.gaps, gaps.added, gaps.removed)}
          ${renderList('Suggestions', '→', '#0099ff', after.insights.suggestions, sug.added, sug.removed)}
          ${renderAiSuggestions(aiSuggestions.get(after.rep.toLowerCase()) ?? [], aiRequested)}
          <div style="margin-top:8px;padding-top:8px;border-top:1px dotted #2a3342">
            <div style="font-size:10px;color:#8b95a5;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">Motivation</div>
            ${motivChanged && before ? `<div style="font-size:12px;color:#ff453a;text-decoration:line-through">${esc(before.insights.motivation)}</div>` : ''}
            <div style="font-size:13px;color:#39FF14;font-style:italic">${esc(after.insights.motivation)}</div>
          </div>
        </div>`;
    })
    .join('');

  return `
    <section class="card">
      <h2>Per-rep audit — approve each rep's new content</h2>
      <p style="color:#8b95a5;font-size:13px;margin-top:0">
        Every rep below shows the wins / gaps / suggestions / motivation that will appear on /trip after this upload.
        Reps whose content didn't change are pre-approved. Reps with changes need you to tick "Approve" before the form will submit.
      </p>
      ${droppedReps.length > 0 ? `<div style="background:rgba(255,149,0,.07);border-left:3px solid #ff9500;padding:12px;border-radius:4px;margin-bottom:12px;font-size:13px"><strong>${droppedReps.map((r) => esc(r.rep)).join(', ')}</strong> — present in current /trip but missing from this upload. They&apos;ll disappear after commit.</div>` : ''}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:12px">
        ${cards}
      </div>
    </section>
  `;
}

function renderAiSuggestions(suggestions: string[], aiRequested: boolean): string {
  if (!aiRequested) return '';
  if (suggestions.length === 0) {
    return `
      <div style="margin-top:8px;padding:8px;background:rgba(189,147,249,.07);border-left:3px solid #bd93f9;border-radius:4px">
        <div style="font-size:10px;color:#bd93f9;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">🤖 AI Coaching</div>
        <div style="font-size:12px;color:#8b95a5;font-style:italic">No AI suggestions generated for this rep (check ANTHROPIC_API_KEY or logs).</div>
      </div>
    `;
  }
  return `
    <div style="margin-top:8px;padding:8px;background:rgba(189,147,249,.07);border-left:3px solid #bd93f9;border-radius:4px">
      <div style="font-size:10px;color:#bd93f9;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">🤖 AI Coaching (Claude Sonnet 4.6)</div>
      <ul style="margin:0;padding:0;list-style:none">
        ${suggestions.map((s) => `<li style="padding:3px 0;font-size:13px;color:#e6edf3"><span style="color:#bd93f9;margin-right:6px">★</span>${esc(s)}</li>`).join('')}
      </ul>
    </div>
  `;
}

function renderAdditions(cells: ReturnType<typeof computeDiff>['newCellAdditions'], newMonths: string[]): string {
  return `
    <section class="card">
      <h2>+ New entries</h2>
      <p style="color:#8b95a5;font-size:13px;margin-top:0">Informational — no confirmation needed.</p>
      <table>
        <thead><tr><th>Rep</th><th>Month</th><th class="r">Amount</th><th>Source</th></tr></thead>
        <tbody>
          ${cells
            .map(
              (c) => `<tr>
              <td><strong>${esc(c.rep)}</strong></td>
              <td>${esc(c.month)}</td>
              <td class="r">${fmtUSD(c.newValue)}</td>
              <td>${newMonths.includes(c.month) ? '<span style="color:#39FF14">new month</span>' : '<span style="color:#0099ff">new entry</span>'}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </section>
  `;
}

function shell(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Trip Update — Review</title>
<style>
  body { margin: 0; background: #0a0e14; color: #e6edf3; font-family: -apple-system, system-ui, "Segoe UI", Inter, sans-serif; padding: 20px; }
  .root { max-width: 1100px; margin: 0 auto; }
  .card { background: #131820; padding: 20px; border-radius: 12px; border: 1px solid #2a3342; margin-bottom: 16px; }
  h1 { color: #39FF14; margin: 0 0 4px; font-size: 28px; }
  h2 { color: #39FF14; margin: 0 0 12px; font-size: 18px; border-bottom: 1px solid #2a3342; padding-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #2a3342; }
  th { color: #8b95a5; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
  .r { text-align: right; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
  .stat { background: #1c2330; padding: 12px; border-radius: 8px; border: 1px solid #2a3342; display: flex; flex-direction: column; }
  .lbl { color: #8b95a5; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
  .val { font-size: 20px; font-weight: 700; margin-top: 4px; }
  .good { background: rgba(57,255,20,.07); border-left: 3px solid #39FF14; padding: 14px 18px; border-radius: 4px; color: #39FF14; font-weight: 600; }
  label { font-size: 12px; color: #e6edf3; }
  a { color: #39FF14; }
</style>
</head>
<body>
<div class="root">
${body}
</div>
</body>
</html>`;
}
