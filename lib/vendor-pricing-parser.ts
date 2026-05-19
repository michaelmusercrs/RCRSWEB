/**
 * Vendor Pricing PDF Parser
 *
 * Takes a vendor price sheet (PDF blob URL) and extracts a structured
 * list of { productName, unit, price } using the Anthropic SDK's PDF
 * support. Uses Claude Haiku for cost — pricing extraction is rote
 * structured data work where Haiku is enough and Sonnet/Opus are overkill.
 *
 * Match strategy: returns the extracted rows + a confidence score per row;
 * the caller (route handler) does the inventory fuzzy match so this stays
 * pure transform.
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export interface ExtractedPriceRow {
  productName: string;
  unit: string;
  price: number;
  /** Optional sku / part # / size string Claude found alongside the row. */
  sku?: string;
  /** Free-text notes (e.g. "case of 12", "per bundle", "+ tax"). */
  notes?: string;
}

export interface ParsePriceSheetResult {
  vendorName?: string;
  effectiveDate?: string;
  rows: ExtractedPriceRow[];
  rawResponse: string;
  modelUsed: string;
}

/** Pricing extraction prompt — terse, structured. */
const SYSTEM_PROMPT = `You are an expert at extracting structured pricing data from supplier/distributor price sheets (PDFs) for a roofing company.

Given a PDF, extract every line item that has a price.

Return ONLY a JSON object with this exact shape (no prose, no markdown, no code fences):

{
  "vendorName": "<vendor name if obvious, else empty string>",
  "effectiveDate": "<YYYY-MM-DD if a date is on the doc, else empty string>",
  "rows": [
    {
      "productName": "<canonical product name, no SKU>",
      "unit": "<each|box|bundle|roll|square|sheet|bag|tube|gallon|case|pallet|lf|sqft>",
      "price": <number, dollars, no $ symbol, no commas>,
      "sku": "<sku/part number if shown, else empty>",
      "notes": "<size, packaging, tax notes if any, else empty>"
    }
  ]
}

Rules:
- Skip header rows, totals, and shipping/handling lines.
- For each line item with a clear price, output one row.
- If a line has multiple price columns (e.g. case price vs each price), prefer the smallest selling unit and put the larger qty in notes.
- Normalize unit to one of the listed values; if unsure use "each".
- Never invent items. If you can't see a row clearly, leave it out.

Respond with ONLY the JSON object. Nothing before or after.`;

const MAX_PDF_BYTES = 6 * 1024 * 1024; // 6 MB safety limit for inline base64
const MODEL_NAME = 'claude-haiku-4-5';

/**
 * Parse a vendor price sheet by URL.
 * Fetches the PDF, base64-encodes it, sends it to Claude Haiku, and parses
 * the JSON response. Throws on transport/parse failure.
 */
export async function parsePriceSheetFromUrl(pdfUrl: string): Promise<ParsePriceSheetResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  // 1. Fetch PDF bytes
  const res = await fetch(pdfUrl);
  if (!res.ok) throw new Error(`Failed to fetch PDF: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_PDF_BYTES) {
    throw new Error(`PDF too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB > ${MAX_PDF_BYTES / 1024 / 1024}MB)`);
  }
  const base64 = buffer.toString('base64');

  // 2. Call Claude with a PDF document block
  const response = await anthropic.messages.create({
    model: MODEL_NAME,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          },
          {
            type: 'text',
            text: 'Extract the price list from this PDF. Respond with ONLY the JSON object.',
          },
        ],
      },
    ],
  });

  // 3. Pull text content
  const textBlock = response.content.find((c) => c.type === 'text');
  const raw = textBlock && textBlock.type === 'text' ? textBlock.text : '';

  // 4. Parse JSON — Claude sometimes wraps in ```json fences despite the
  //    prompt; strip those defensively.
  const cleaned = raw
    .replace(/^\s*```json\s*/i, '')
    .replace(/^\s*```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let parsed: {
    vendorName?: string;
    effectiveDate?: string;
    rows?: Array<{
      productName?: string;
      unit?: string;
      price?: number | string;
      sku?: string;
      notes?: string;
    }>;
  };
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `Claude returned non-JSON output: ${raw.slice(0, 200)}...`,
    );
  }

  // 5. Coerce + filter rows
  const rows: ExtractedPriceRow[] = [];
  for (const r of parsed.rows || []) {
    const productName = String(r.productName || '').trim();
    const priceNum = typeof r.price === 'number' ? r.price : Number(String(r.price || '').replace(/[$,]/g, ''));
    if (!productName) continue;
    if (!Number.isFinite(priceNum) || priceNum <= 0) continue;
    rows.push({
      productName,
      unit: String(r.unit || 'each').trim().toLowerCase(),
      price: Math.round(priceNum * 100) / 100,
      sku: r.sku ? String(r.sku).trim() : undefined,
      notes: r.notes ? String(r.notes).trim() : undefined,
    });
  }

  return {
    vendorName: parsed.vendorName?.trim() || undefined,
    effectiveDate: parsed.effectiveDate?.trim() || undefined,
    rows,
    rawResponse: raw,
    modelUsed: MODEL_NAME,
  };
}

// ---------------------------------------------------------------------------
// Fuzzy match (no external deps)
// ---------------------------------------------------------------------------

/** Normalize for fuzzy comparison: lowercase, strip punctuation, collapse spaces. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Trigram overlap score between two strings in [0, 1].
 * Simple, dependency-free, good enough for product name matching.
 */
export function fuzzyScore(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const trig = (s: string): Set<string> => {
    const padded = `  ${s}  `;
    const set = new Set<string>();
    for (let i = 0; i < padded.length - 2; i++) {
      set.add(padded.slice(i, i + 3));
    }
    return set;
  };
  const ta = trig(na);
  const tb = trig(nb);
  let intersect = 0;
  for (const t of ta) if (tb.has(t)) intersect++;
  const denom = ta.size + tb.size - intersect;
  return denom === 0 ? 0 : intersect / denom;
}

export interface PriceMatchCandidate {
  /** Best matching inventory item (or null if no candidate cleared the threshold). */
  productId: string;
  productName: string;
  /** Score in [0, 1] — caller uses >=0.4 by default. */
  score: number;
}

/**
 * Find the best inventory match for an extracted name.
 * Returns the top candidate (caller decides whether to surface alternates).
 */
export function bestMatchForExtractedName(
  extractedName: string,
  inventory: { productId: string; productName: string; sku: string }[],
  extractedSku?: string,
): PriceMatchCandidate | null {
  if (inventory.length === 0) return null;

  // SKU match wins outright if present.
  if (extractedSku) {
    const skuNorm = normalize(extractedSku);
    const skuHit = inventory.find((i) => normalize(i.sku) === skuNorm);
    if (skuHit) {
      return {
        productId: skuHit.productId,
        productName: skuHit.productName,
        score: 1,
      };
    }
  }

  let best: PriceMatchCandidate | null = null;
  for (const item of inventory) {
    const score = Math.max(
      fuzzyScore(extractedName, item.productName),
      fuzzyScore(extractedName, item.sku),
    );
    if (!best || score > best.score) {
      best = {
        productId: item.productId,
        productName: item.productName,
        score,
      };
    }
  }
  return best;
}
