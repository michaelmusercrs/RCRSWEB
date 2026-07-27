/**
 * Material Order Email Parser
 *
 * Parses the body of a Material Order email (the format used in the
 * Dusty Dutton M-4236 PDF) into a structured ticket payload that
 * /api/portal/tickets POST 'create' can consume directly.
 *
 * The email body looks like this (text-extracted from the PDF):
 *
 *   River City Roofing Solutions, Inc.
 *   3325 Central Pkwy
 *   Decatur, AL 35603
 *   (256) 274-8530
 *   Sales Representative
 *   Alijah Coleman
 *   (256) 894-9988
 *   alijah@rivercityroofingsolutions.com
 *   Job #R-11011 - Dusty Dutton
 *   228 Montgomery Dr
 *   Moulton, AL 35650
 *   M A T E R I A L  O R D E R
 *   S P E C I A L  I N S T R U C T I O N S
 *   Alijah is salesman
 *   Jesus is roofer
 *   Deliver by Monday 4/6, Tuesday install
 *   Material Order # M-4236
 *   Date 4/2/2026
 *   Item                       Description     Unit  Qty   Cost
 *   1 1/4 Coil Nails           4 boxes         Box   4.00  64.90
 *   ...
 *   Total Cost                                       1,466.29
 *
 * Robust to whitespace / line ordering variations because we anchor on
 * known field labels rather than positional parsing.
 */

import { normalizeLineItemQty } from './normalize-line-item-qty';

export interface ParsedMaterialLine {
  itemName: string;
  description: string;
  unit: string;
  quantity: number;
  unitCost: number;
  /** "1 1/4 Coil Nails" matched to a catalog itemId via fuzzy match — set by caller */
  itemId?: string;
  /**
   * UoM-normalization annotations (set by the parser when a qty conversion
   * fires — e.g., Ridge Vent linear-feet → sticks). The webhook handler
   * surfaces this in the ticket notes and the LineItemAnomalies log when
   * `originalQuantity` differs from `quantity`.
   */
  originalQuantity?: number;
  /** Reason code from `normalizeLineItemQty` — e.g., 'explicit_lf_text'. */
  uomNormalizationReason?: string;
  /** Human-readable warning if conversion was heuristic or still suspect. */
  uomNormalizationWarning?: string;
}

export interface ParsedMaterialOrder {
  jobNumber: string;        // R-XXXXX (always normalized)
  customerName: string;
  jobAddress: string;
  city: string;
  state: string;
  zip: string;
  salesRepName: string;
  salesRepPhone: string;
  salesRepEmail: string;
  materialOrderNumber: string;  // M-XXXX
  orderDate: string;
  specialInstructions: string;
  materials: ParsedMaterialLine[];
  totalCost: number;
}

const STATE_RE = /\b(AL|GA|TN|MS)\b/;
const JOB_LINE_RE = /Job\s*#?\s*(R-?\d+)\s*[-–—]\s*(.+)/i;
const MATERIAL_ORDER_RE = /Material\s*Order\s*#?\s*(M-?\d+)/i;
const DATE_RE = /Date\s+([\d/.-]+)/i;
const PHONE_RE = /\(?\d{3}\)?\s*[\s.-]\s*\d{3}\s*[\s.-]\s*\d{4}/;
const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const TOTAL_RE = /Total\s*Cost\s*\$?([\d,]+\.\d{2})/i;
const CITY_STATE_ZIP_RE = /^([A-Za-z .'-]+),?\s+(AL|GA|TN|MS)\s+(\d{5})(?:-\d{4})?$/;

function parseDollar(s: string): number {
  const cleaned = s.replace(/[$,]/g, '').trim();
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function normalizeJobNumber(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/^[A-Za-z]-?/, '').replace(/\D/g, '');
  return digits ? `R-${digits}` : raw;
}

/**
 * Parse the body of a material order email into a structured payload.
 * Pass the email body as plain text (PDF text extracts work too — the parser
 * is line-oriented and tolerates extra whitespace).
 */
export function parseMaterialOrderEmail(body: string): ParsedMaterialOrder {
  const lines = body
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // ── Job line: "Job #R-11011 - Dusty Dutton" ──────────────────────────
  let jobNumber = '';
  let customerName = '';
  for (const line of lines) {
    const m = line.match(JOB_LINE_RE);
    if (m) {
      jobNumber = normalizeJobNumber(m[1]);
      customerName = m[2].trim();
      break;
    }
  }

  // ── Address — lines following the job line until the materials table ─
  // Pattern: <street line>, then "<city>, <state> <zip>"
  let jobAddress = '';
  let city = '';
  let state = '';
  let zip = '';
  const jobIdx = lines.findIndex(l => JOB_LINE_RE.test(l));
  if (jobIdx >= 0) {
    for (let i = jobIdx + 1; i < Math.min(jobIdx + 5, lines.length); i++) {
      const cityMatch = lines[i].match(CITY_STATE_ZIP_RE);
      if (cityMatch) {
        city = cityMatch[1].trim();
        state = cityMatch[2];
        zip = cityMatch[3];
        // The previous non-empty line is the street address
        for (let j = i - 1; j >= jobIdx + 1; j--) {
          if (lines[j] && !STATE_RE.test(lines[j])) {
            jobAddress = lines[j];
            break;
          }
        }
        break;
      }
    }
  }

  // ── Sales rep block ───────────────────────────────────────────────────
  // Header "Sales Representative" then name, phone, email on subsequent lines
  let salesRepName = '';
  let salesRepPhone = '';
  let salesRepEmail = '';
  const repIdx = lines.findIndex(l => /Sales\s+Representative/i.test(l));
  if (repIdx >= 0) {
    for (let i = repIdx + 1; i < Math.min(repIdx + 5, lines.length); i++) {
      const line = lines[i];
      if (!salesRepName && !PHONE_RE.test(line) && !EMAIL_RE.test(line) && line.length < 60 && /^[A-Za-z]/.test(line)) {
        salesRepName = line;
      } else if (!salesRepPhone && PHONE_RE.test(line)) {
        salesRepPhone = (line.match(PHONE_RE) || [''])[0];
      } else if (!salesRepEmail && EMAIL_RE.test(line)) {
        salesRepEmail = (line.match(EMAIL_RE) || [''])[0];
      }
    }
  }

  // ── Material order #, date ────────────────────────────────────────────
  let materialOrderNumber = '';
  let orderDate = '';
  for (const line of lines) {
    if (!materialOrderNumber) {
      const m = line.match(MATERIAL_ORDER_RE);
      if (m) materialOrderNumber = m[1].toUpperCase();
    }
    if (!orderDate) {
      const m = line.match(DATE_RE);
      if (m) orderDate = m[1];
    }
  }

  // ── Special instructions block ────────────────────────────────────────
  // Find "SPECIAL INSTRUCTIONS" header (with or without spaces between letters)
  let specialInstructions = '';
  const siIdx = lines.findIndex(l => /S\s*P\s*E\s*C\s*I\s*A\s*L/i.test(l) && /I\s*N\s*S\s*T\s*R/i.test(l));
  if (siIdx >= 0) {
    const siLines: string[] = [];
    for (let i = siIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      // Stop on the next section header or footer
      if (/Total\s*Cost/i.test(line)) break;
      if (/^[A-Z][A-Z\s]+$/.test(line) && line.length > 5) break; // ALL CAPS header
      siLines.push(line);
    }
    specialInstructions = siLines.join('\n').trim();
  }

  // ── Materials table ───────────────────────────────────────────────────
  // Drive's PDF -> Doc conversion flattens the table into a single chunk
  // where MULTIPLE items can be concatenated onto one line, e.g.:
  //   "1 1/4 Coil Nails 2 boxes Box 2.00 64.90 Button Caps 1 bucket Bucke 1.00 29.15"
  // So we can't parse line-by-line. Instead: find the materials section
  // (between an "Item" or "Materials" header and "Total Cost"), join it to
  // one big string, then run a global regex that matches the trailing
  // "<unit-token> <qty> <unit-cost>" of each line item. The text between
  // matches becomes the item name + description.
  const materials: ParsedMaterialLine[] = [];

  // Find section bounds. Anchor end on "Total Cost", start on the
  // "Materials" sublabel OR a line containing "Item ... Description"
  // OR the "Qty Cost" header line. Fallback: start after the
  // "Material Order #" line.
  let startIdx = lines.findIndex(l => /^Materials?$/i.test(l.trim()));
  if (startIdx < 0) {
    startIdx = lines.findIndex(l =>
      /\bItem\b/i.test(l) && /\bDescription\b/i.test(l)
    );
  }
  if (startIdx < 0) {
    startIdx = lines.findIndex(l => /^Qty\s+Cost\s*$/i.test(l.trim()));
  }
  if (startIdx < 0) {
    startIdx = lines.findIndex(l => MATERIAL_ORDER_RE.test(l));
  }
  let endIdx = lines.findIndex((l, i) => i > startIdx && TOTAL_RE.test(l));
  if (endIdx < 0) endIdx = lines.length;

  if (startIdx >= 0 && endIdx > startIdx + 1) {
    // Flatten the section, skip header-ish lines, then strip the inline
    // "Item Description Unit of Measure" column header (it lives ON the
    // same line as the first item after Drive's PDF -> Doc conversion).
    const sectionText = lines
      .slice(startIdx + 1, endIdx)
      .filter(l => !/^(Item|Description|Unit of Measure|Materials?|Qty\s+Cost)\s*$/i.test(l.trim()))
      .join(' ')
      .replace(/\s+/g, ' ')
      .replace(/^\s*Item\s+Description\s+Unit\s+of\s+Measure\s+/i, '')
      .trim();

    // Greedy scan with one strong anchor + one strong constraint:
    //   - cost (3rd group) requires a decimal point — prevents matching
    //     integer-looking "X Y Z" triples inside descriptions
    //   - lookahead requires either the start of the next item (space + capital
    //     letter, since each item name starts with one) or end of string —
    //     this stops us from locking onto sub-patterns mid-line
    // The unit token can be any short word-ish thing (digits allowed because
    // JN sometimes emits a bare "1" as the unit slot).
    const itemEndRe = /([\w.]{1,16})\s+([\d,]+(?:\.\d{1,2})?)\s+([\d,]+\.\d{1,2})(?=\s+[A-Z]|\s*$)/g;
    let cursor = 0;
    let match: RegExpExecArray | null;
    while ((match = itemEndRe.exec(sectionText)) !== null) {
      const [whole, unit, qtyStr, costStr] = match;
      const matchStart = match.index;
      const head = sectionText.slice(cursor, matchStart).trim();
      cursor = matchStart + whole.length;
      if (!head) continue;
      const parsedQty = parseDollar(qtyStr);
      // UoM normalization: for SKUs sold in different units than the PM's
      // input (e.g., Ridge Vent 4LF — stocked by stick, sometimes entered
      // in linear feet), apply the conversion BEFORE persisting.
      // adjacentText is the concatenation of the item-name head + unit
      // token so phrases like "Ridge Vent 88 LF" or "88 linear feet" are
      // detected. Catalog match hasn't happened yet at this point, so we
      // rely on the name-substring fallback inside the helper.
      // UoM sanity check. We do NOT convert — PMs order in the stock unit
      // (e.g. Ridge Vent in sticks), so the parsed qty is trusted as-is. The
      // helper only FLAGS an implausibly large qty for human review.
      const normalized = normalizeLineItemQty({
        productName: head,
        qty: parsedQty,
      });
      const line: ParsedMaterialLine = {
        itemName: head,
        description: '',
        unit,
        quantity: normalized.qty,
        unitCost: parseDollar(costStr),
      };
      if (normalized.reason === 'flag_review') {
        // Qty left AS-ENTERED but flagged so office can confirm the unit.
        line.originalQuantity = normalized.originalQty;
        line.uomNormalizationReason = normalized.reason;
        line.uomNormalizationWarning = normalized.warning;
        console.warn(
          `[material-order-parser] UoM REVIEW FLAG: "${head}" qty=${normalized.qty} (unchanged) — ${normalized.warning}`,
        );
      }
      // Caller does fuzzy catalog match on itemName — give it the whole
      // pre-unit chunk; don't truncate at an arbitrary word boundary.
      materials.push(line);
    }
  }

  // ── Total cost ────────────────────────────────────────────────────────
  let totalCost = 0;
  for (const line of lines) {
    const m = line.match(TOTAL_RE);
    if (m) {
      totalCost = parseDollar(m[1]);
      break;
    }
  }

  return {
    jobNumber,
    customerName,
    jobAddress,
    city,
    state,
    zip,
    salesRepName,
    salesRepPhone,
    salesRepEmail,
    materialOrderNumber,
    orderDate,
    specialInstructions,
    materials,
    totalCost,
  };
}

// matchCatalogItem lives in its own dependency-free module so it can be
// unit-tested in isolation. Re-exported here to preserve the existing
// import path (`@/lib/material-order-email-parser`).
export { matchCatalogItem } from './match-catalog-item';
