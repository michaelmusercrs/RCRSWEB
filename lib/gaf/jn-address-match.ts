/**
 * Match a GAF QuickMeasure report (keyed by property address) to a JobNimbus
 * job. JN has no address lookup endpoint, so we pull a window of recent jobs
 * once per cron run and match in memory against a normalized address.
 *
 * Foolproof bias: a "high" (auto-attach) match REQUIRES the house number AND
 * the normalized street to match, plus a zip or city corroboration, AND that
 * exactly one job qualifies. Anything less → "review" (never auto-attaches to
 * the wrong house). The rep who ordered the report is used only as a
 * tie-breaker when two jobs are otherwise identical.
 */

import { jobNimbusService } from '../jobnimbus-service';

export interface JobLike {
  jnid: string;
  number?: string;
  name?: string;
  address_line1?: string;
  city?: string;
  state_text?: string;
  zip?: string;
  sales_rep_name?: string;
  primary?: { id?: string; jnid?: string };
}

const SUFFIX: Record<string, string> = {
  rd: 'road', dr: 'drive', st: 'street', ave: 'avenue', av: 'avenue', ln: 'lane',
  ct: 'court', cir: 'circle', cr: 'circle', blvd: 'boulevard', hwy: 'highway',
  pkwy: 'parkway', pl: 'place', ter: 'terrace', trl: 'trail', way: 'way',
  cv: 'cove', xing: 'crossing', loop: 'loop', run: 'run', pt: 'point',
  n: 'north', s: 'south', e: 'east', w: 'west', ne: 'northeast', nw: 'northwest',
  se: 'southeast', sw: 'southwest', co: 'county',
};

function normStreet(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(t => SUFFIX[t] || t)
    .join(' ')
    .trim();
}

function leadingNumber(s: string): string {
  const m = (s || '').trim().match(/^(\d+)/);
  return m ? m[1] : '';
}

export interface ParsedAddress {
  street: string;   // normalized street portion (first comma segment)
  houseNo: string;
  city: string;     // normalized
  zip: string;
  raw: string;
}

/** Parse "800 County Rd 859, Mentone, AL 35984" into parts. */
export function parseAddress(raw: string): ParsedAddress {
  const clean = (raw || '').replace(/,?\s*USA\s*$/i, '').trim();
  const parts = clean.split(',').map(s => s.trim()).filter(Boolean);
  const streetSeg = parts[0] || '';
  const citySeg = parts[1] || '';
  const zip = (clean.match(/\b(\d{5})(?:-\d{4})?\b/) || [])[1] || '';
  return {
    street: normStreet(streetSeg),
    houseNo: leadingNumber(streetSeg),
    city: normStreet(citySeg),
    zip,
    raw: clean,
  };
}

function jobAddress(job: JobLike): ParsedAddress {
  return {
    street: normStreet(job.address_line1 || ''),
    houseNo: leadingNumber(job.address_line1 || ''),
    city: normStreet(job.city || ''),
    zip: (job.zip || '').trim().slice(0, 5),
    raw: [job.address_line1, job.city, job.state_text, job.zip].filter(Boolean).join(', '),
  };
}

function jaccard(a: string, b: string): number {
  const sa = new Set(a.split(' ').filter(Boolean));
  const sb = new Set(b.split(' ').filter(Boolean));
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}

export type MatchTier = 'high' | 'review' | 'none';

export interface AddressMatch {
  tier: MatchTier;
  job: JobLike | null;
  jobNumber: string;
  score: number;
  /** All jobs that scored as plausible (for the review UI). */
  candidates: { jobNumber: string; jnid: string; address: string; score: number }[];
  reason: string;
}

/**
 * Pull recent JN jobs once, to match many reports against. Pages getJobs and
 * caps the window so a huge history can't blow the function budget.
 */
export async function getCandidateJobs(opts?: { sinceDays?: number; cap?: number }): Promise<JobLike[]> {
  const sinceDays = opts?.sinceDays ?? 180;
  const cap = opts?.cap ?? 2000;
  const since = Math.floor((Date.now() - sinceDays * 86_400_000) / 1000); // JN uses unix seconds
  const out: JobLike[] = [];
  const pageSize = 100;
  for (let offset = 0; offset < cap; offset += pageSize) {
    let page: { count: number; results: JobLike[] };
    try {
      page = await jobNimbusService.getJobs({ limit: pageSize, offset, since }, { canSeeCost: false });
    } catch {
      break;
    }
    const results = page?.results || [];
    out.push(...results);
    if (results.length < pageSize) break;
  }
  return out;
}

/** Same-zip jobs via the JN filter endpoint (preferred candidate set). */
export async function getJobsByZip(zip: string): Promise<JobLike[]> {
  try {
    return await jobNimbusService.getJobsByZip(zip, { canSeeCost: false });
  } catch {
    return [];
  }
}

/**
 * Best JN job for a report address. `repHint` is the ordering rep's name/local-part
 * (used only to break ties between otherwise-identical matches).
 */
export function matchJob(reportAddress: string, jobs: JobLike[], repHint?: string): AddressMatch {
  const target = parseAddress(reportAddress);
  const hint = (repHint || '').toLowerCase().trim();

  if (!target.street || !target.houseNo) {
    return { tier: 'none', job: null, jobNumber: '', score: 0, candidates: [], reason: 'unparseable report address' };
  }

  const scored = jobs.map(job => {
    const ja = jobAddress(job);
    let score = 0;
    const houseMatch = !!ja.houseNo && ja.houseNo === target.houseNo;
    const streetExact = !!ja.street && ja.street === target.street;
    const streetSim = jaccard(target.street, ja.street);
    const zipMatch = !!target.zip && !!ja.zip && target.zip === ja.zip;
    const cityMatch = !!target.city && !!ja.city && target.city === ja.city;

    if (streetExact) score += 0.7;
    else score += streetSim * 0.6;
    if (houseMatch) score += 0.15;
    if (zipMatch) score += 0.2;
    if (cityMatch) score += 0.05;
    if (hint && (job.sales_rep_name || '').toLowerCase().includes(hint)) score += 0.05;

    return { job, ja, score, houseMatch, streetExact, zipMatch, cityMatch };
  }).sort((a, b) => b.score - a.score);

  const candidates = scored.slice(0, 6)
    .filter(s => s.score >= 0.4)
    .map(s => ({ jobNumber: s.job.number || '', jnid: s.job.jnid, address: s.ja.raw, score: Number(s.score.toFixed(3)) }));

  // High-confidence set: correct house + street, corroborated by zip or city.
  const highSet = scored.filter(s => s.houseMatch && s.streetExact && (s.zipMatch || s.cityMatch));

  if (highSet.length === 1) {
    const w = highSet[0];
    return { tier: 'high', job: w.job, jobNumber: w.job.number || '', score: Number(w.score.toFixed(3)), candidates, reason: 'house + street + (zip|city) unique match' };
  }
  if (highSet.length > 1) {
    // Tie-break by rep hint; if still ambiguous, send to review.
    const byRep = hint ? highSet.filter(s => (s.job.sales_rep_name || '').toLowerCase().includes(hint)) : [];
    if (byRep.length === 1) {
      const w = byRep[0];
      return { tier: 'high', job: w.job, jobNumber: w.job.number || '', score: Number(w.score.toFixed(3)), candidates, reason: 'unique after rep tie-break' };
    }
    return { tier: 'review', job: highSet[0].job, jobNumber: highSet[0].job.number || '', score: Number(highSet[0].score.toFixed(3)), candidates, reason: `${highSet.length} equally-strong address matches — needs a human to pick` };
  }

  const best = scored[0];
  if (best && best.score >= 0.55) {
    return { tier: 'review', job: best.job, jobNumber: best.job.number || '', score: Number(best.score.toFixed(3)), candidates, reason: 'partial match — needs confirmation' };
  }
  return { tier: 'none', job: null, jobNumber: '', score: best ? Number(best.score.toFixed(3)) : 0, candidates, reason: 'no plausible job found' };
}
