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

export interface ParsedMaterialLine {
  itemName: string;
  description: string;
  unit: string;
  quantity: number;
  unitCost: number;
  /** "1 1/4 Coil Nails" matched to a catalog itemId via fuzzy match — set by caller */
  itemId?: string;
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
  // Find the header row (Item / Description / Unit / Qty / Cost) and parse
  // every line after it until we hit "Total Cost".
  const materials: ParsedMaterialLine[] = [];
  const headerIdx = lines.findIndex(l =>
    /\bItem\b/i.test(l) && /\bQty\b/i.test(l) && /\bCost\b/i.test(l)
  );
  if (headerIdx >= 0) {
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (TOTAL_RE.test(line)) break;
      if (/^Materials?$/i.test(line)) continue; // section sublabel
      // Match: <name> <description...> <unit> <qty> <cost>
      // Strategy: pull qty + cost from end (last two numeric tokens), unit before qty
      const parts = line.split(/\s{2,}|\t/).map(s => s.trim()).filter(Boolean);
      // Try a regex that captures the trailing "<unit> <qty> <cost>" pattern
      const tail = line.match(/^(.+?)\s+(\S+)\s+([\d,]+\.\d{1,2})\s+([\d,]+\.\d{1,2})\s*$/);
      if (tail) {
        const [, head, unit, qtyStr, costStr] = tail;
        // The "head" is "<item name> <description>" — we don't know where the
        // boundary is without a catalog lookup. Caller does the fuzzy match.
        const headParts = head.trim().split(/\s+/);
        // Simple heuristic: first 1-3 words are the item name, rest is description
        const itemName = headParts.slice(0, Math.min(3, headParts.length)).join(' ');
        const description = headParts.slice(Math.min(3, headParts.length)).join(' ');
        materials.push({
          itemName: itemName || head.trim(),
          description: description || '',
          unit,
          quantity: parseDollar(qtyStr),
          unitCost: parseDollar(costStr),
        });
      } else if (parts.length >= 4) {
        // Fallback: tab-separated layout
        const last = parts[parts.length - 1];
        const secondLast = parts[parts.length - 2];
        const thirdLast = parts[parts.length - 3];
        materials.push({
          itemName: parts[0] || '',
          description: parts.slice(1, parts.length - 3).join(' '),
          unit: thirdLast,
          quantity: parseDollar(secondLast),
          unitCost: parseDollar(last),
        });
      }
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

/**
 * Match a parsed item name to a catalog product. Uses substring + token
 * intersection scoring; returns the best match above a threshold or null.
 *
 * The catalog comes from inventoryData.ts (item-123 through item-133).
 */
export function matchCatalogItem(
  parsedName: string,
  catalog: Array<{ productId: string; productName: string }>,
): string | null {
  if (!parsedName) return null;
  const target = parsedName.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim();
  if (!target) return null;
  const targetTokens = new Set(target.split(/\s+/).filter(t => t.length > 1));

  let bestId: string | null = null;
  let bestScore = 0;
  for (const item of catalog) {
    const candidate = item.productName.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim();
    if (!candidate) continue;
    const candidateTokens = new Set(candidate.split(/\s+/).filter(t => t.length > 1));

    // Token intersection
    let overlap = 0;
    for (const t of targetTokens) if (candidateTokens.has(t)) overlap++;
    if (overlap === 0) continue;

    // Bonus for substring match in either direction
    const substringBonus =
      candidate.includes(target) || target.includes(candidate) ? 2 : 0;

    const score = overlap + substringBonus;
    if (score > bestScore) {
      bestScore = score;
      bestId = item.productId;
    }
  }

  // Threshold: at least one token match
  return bestScore >= 1 ? bestId : null;
}
