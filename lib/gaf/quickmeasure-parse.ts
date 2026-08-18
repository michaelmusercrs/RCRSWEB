/**
 * Parsing helpers for GAF QuickMeasure report emails + their XML data file.
 *
 * Verified against real rcrs@ inbox samples 2026-08-18:
 *   - Sender:  services@gaf.com
 *   - Subject: "GAF QuickMeasure | 800 County Rd 859, Mentone, AL 35984, USA"
 *   - Body:    "... Order #5487530 ..."
 *   - Attachments: "Full Report - <addr>.pdf", "Property Owner Report - <addr>.pdf",
 *                  "Xml_<uuid>.xml", "DXF_<uuid>.dxf"
 *   - Recipients: rcrs@, sara@, destin@ (office constants) + ONE rep.
 *
 * NOT real reports (skip): subjects with "Reopened", "Error", "Takeoff",
 * "Account Link", or "Report Unavailable".
 */

import type { Measurements } from './coverage-config';

/**
 * Local-parts (before the @) that are always CC'd on every report and are NOT
 * the ordering rep. Override via GAF_OFFICE_LOCALPARTS (csv). Matched
 * case-insensitively across BOTH domains (rcrsal.com + rivercityroofingsolutions.com).
 */
export function officeLocalParts(): Set<string> {
  const raw = process.env.GAF_OFFICE_LOCALPARTS || 'rcrs,sara,destin';
  return new Set(raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
}

export function localPart(email: string): string {
  return (email.split('@')[0] || '').trim().toLowerCase();
}

/** True only for a real, attachment-bearing QuickMeasure report email. */
export function isRealQuickMeasureReport(subject: string): boolean {
  const s = (subject || '').trim();
  // Real reports use the pipe form: "GAF QuickMeasure | <address>".
  if (!/^GAF QuickMeasure\s*\|/i.test(s)) return false;
  if (/reopen|error|unavailable|takeoff|account link/i.test(s)) return false;
  return true;
}

/** "GAF QuickMeasure | 800 County Rd 859, Mentone, AL 35984, USA" → the address. */
export function addressFromSubject(subject: string): string {
  const m = (subject || '').match(/GAF QuickMeasure\s*\|\s*(.+)$/i);
  if (!m) return '';
  return m[1].replace(/,?\s*USA\s*$/i, '').trim();
}

/** Pull the GAF order number from the email body (dedupe key). */
export function orderNumberFromBody(body: string): string {
  const m = (body || '').match(/Order\s*#\s*(\d{4,})/i);
  return m ? m[1] : '';
}

export interface RepRecipient { email: string; localPart: string; }

/** Recipients that aren't office constants — these are the ordering rep(s). */
export function repsFromRecipients(toRecipients: string[]): RepRecipient[] {
  const office = officeLocalParts();
  const seen = new Set<string>();
  const reps: RepRecipient[] = [];
  for (const raw of toRecipients || []) {
    const email = raw.trim();
    if (!email || !email.includes('@')) continue;
    const lp = localPart(email);
    if (office.has(lp) || seen.has(lp)) continue;
    seen.add(lp);
    reps.push({ email, localPart: lp });
  }
  return reps;
}

// ── XML measurement extraction ───────────────────────────────────────────────
// We can't hard-code the exact QuickMeasure schema, so parse defensively: build
// a flat map of every tag/attribute name → its numeric value, then look up by a
// synonym table. On the first real report we log the raw key list so the synonym
// table can be tightened if GAF uses names we didn't anticipate.

/** Flatten `<Tag>value</Tag>` and `name="value"` attributes into name→raw. */
export function flattenXml(xml: string): Record<string, string> {
  const map: Record<string, string> = {};
  if (!xml) return map;
  // Element text: <TotalArea>1234.5</TotalArea>
  const elRe = /<([A-Za-z_][\w.:-]*)[^>]*>\s*([^<>]+?)\s*<\/\1>/g;
  let mm: RegExpExecArray | null;
  while ((mm = elRe.exec(xml)) !== null) {
    const key = mm[1].split(':').pop()!.toLowerCase();
    if (!(key in map)) map[key] = mm[2].trim();
  }
  // Attributes: <Measurement Ridge="120" Hip="40" .../>
  const attrRe = /([A-Za-z_][\w.-]*)\s*=\s*"([^"]*)"/g;
  while ((mm = attrRe.exec(xml)) !== null) {
    const key = mm[1].split(':').pop()!.toLowerCase();
    if (!(key in map)) map[key] = mm[2].trim();
  }
  return map;
}

const num = (v: string | undefined): number | undefined => {
  if (v == null) return undefined;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

/** First present key from a synonym list. */
function pick(map: Record<string, string>, keys: string[]): number | undefined {
  for (const k of keys) {
    const hit = num(map[k.toLowerCase()]);
    if (hit != null) return hit;
  }
  return undefined;
}

/**
 * Extract structured measurements from a QuickMeasure XML string. Tolerant of
 * unknown schema — returns whatever it can find; missing fields stay undefined
 * and the material summary degrades gracefully.
 */
export function measurementsFromXml(xml: string): { measurements: Measurements; rawKeys: string[] } {
  const map = flattenXml(xml);
  const rawKeys = Object.keys(map).sort();

  const roofAreaSqFt = pick(map, ['totalroofarea', 'totalarea', 'roofarea', 'totalsquarefeet', 'area', 'totalroofareasqft']);
  let squares = pick(map, ['squares', 'totalsquares', 'roofsquares', 'squarecount']);
  if (squares == null && roofAreaSqFt != null) squares = roofAreaSqFt / 100;

  const measurements: Measurements = {
    squares,
    roofAreaSqFt,
    ridgeLengthFt: pick(map, ['ridgelength', 'ridge', 'ridges', 'totalridge', 'ridgelengthft', 'ridgelf']),
    hipLengthFt: pick(map, ['hiplength', 'hip', 'hips', 'totalhip', 'hiplengthft', 'hiplf']),
    valleyLengthFt: pick(map, ['valleylength', 'valley', 'valleys', 'totalvalley', 'valleylengthft', 'valleylf']),
    eaveLengthFt: pick(map, ['eavelength', 'eave', 'eaves', 'totaleave', 'eavelengthft', 'eavelf', 'gutter', 'gutterlength']),
    rakeLengthFt: pick(map, ['rakelength', 'rake', 'rakes', 'totalrake', 'rakelengthft', 'rakelf']),
    perimeterFt: pick(map, ['perimeter', 'totalperimeter', 'perimeterlength']),
    facets: pick(map, ['facets', 'facetcount', 'numberoffacets', 'planes']),
    predominantPitch: map['predominantpitch'] || map['pitch'] || map['primarypitch'] || undefined,
  };

  return { measurements, rawKeys };
}
