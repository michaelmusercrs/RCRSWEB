/**
 * Vendor Pricing Snapshot API
 *
 * Admin/office-only endpoint that ingests a vendor price sheet PDF and
 * surfaces the extracted rows + fuzzy inventory matches for confirmation.
 *
 *   POST   /api/portal/inventory/vendor-pricing
 *     multipart/form-data: file=<PDF>, vendor=<vendor name>
 *     → Uploads PDF to Vercel Blob, parses via Anthropic SDK (Claude Haiku),
 *       fuzzy-matches against inventory, returns the candidate list.
 *
 *   PATCH  /api/portal/inventory/vendor-pricing
 *     JSON: { confirmed: [{ productId, newUnitCost, sourceName, vendor }] }
 *     → Updates each inventory item's unitCost, writes one InventoryLogs
 *       row per change, returns a count.
 *
 *   GET    /api/portal/inventory/vendor-pricing
 *     → Last 20 vendor pricing uploads (from Sheets tab `VendorPricingUploads`)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { unifiedInventoryService } from '@/lib/unified-inventory-service';
import {
  parsePriceSheetFromUrl,
  bestMatchForExtractedName,
  type ExtractedPriceRow,
  type PriceMatchCandidate,
} from '@/lib/vendor-pricing-parser';
import { googleSheetsService } from '@/lib/google-sheets-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120; // PDF + Claude can take up to 60s in practice

const ALLOWED_ROLES = ['admin', 'owner', 'office'];

const UPLOAD_TAB = 'VendorPricingUploads';
const UPLOAD_HEADERS = [
  'uploadId',
  'vendorName',
  'pdfUrl',
  'extractedRowCount',
  'matchedCount',
  'updatedCount',
  'uploadedBy',
  'uploadedAt',
  'effectiveDate',
];

interface MatchedRow {
  extracted: ExtractedPriceRow;
  match: (PriceMatchCandidate & { currentUnitCost: number }) | null;
}

async function logUpload(entry: {
  uploadId: string;
  vendorName: string;
  pdfUrl: string;
  extractedRowCount: number;
  matchedCount: number;
  updatedCount: number;
  uploadedBy: string;
  effectiveDate: string;
}): Promise<void> {
  try {
    await googleSheetsService.appendGenericRow(UPLOAD_TAB, UPLOAD_HEADERS, {
      uploadId: entry.uploadId,
      vendorName: entry.vendorName,
      pdfUrl: entry.pdfUrl,
      extractedRowCount: entry.extractedRowCount,
      matchedCount: entry.matchedCount,
      updatedCount: entry.updatedCount,
      uploadedBy: entry.uploadedBy,
      uploadedAt: new Date().toISOString(),
      effectiveDate: entry.effectiveDate,
    });
  } catch (err) {
    console.warn('[vendor-pricing] upload log write failed:', err);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (!ALLOWED_ROLES.includes(auth.user.role)) {
    return NextResponse.json(
      { error: 'admin / owner / office role required' },
      { status: 403 },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'AI parsing unavailable — ANTHROPIC_API_KEY not configured' },
      { status: 503 },
    );
  }

  // Parse multipart
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 });
  }

  const file = form.get('file');
  const vendorName = String(form.get('vendor') || '').trim();
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'PDF only' }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: 'PDF too large (max 8MB)' }, { status: 413 });
  }

  // Upload to Vercel Blob
  let blobUrl: string;
  try {
    const { put } = await import('@vercel/blob');
    const uploadId = `vendor-pricing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const safeVendor = vendorName.replace(/[^a-z0-9-]/gi, '_').slice(0, 32) || 'unknown';
    const blob = await put(`vendor-pricing/${safeVendor}/${uploadId}.pdf`, file, {
      access: 'public',
      contentType: 'application/pdf',
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    blobUrl = blob.url;
  } catch (err) {
    console.error('[vendor-pricing] blob put failed:', err);
    return NextResponse.json(
      { error: `Upload failed: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 500 },
    );
  }

  // Parse via Claude
  let parsed: Awaited<ReturnType<typeof parsePriceSheetFromUrl>>;
  try {
    parsed = await parsePriceSheetFromUrl(blobUrl);
  } catch (err) {
    console.error('[vendor-pricing] parse failed:', err);
    return NextResponse.json(
      {
        error: `Parse failed: ${err instanceof Error ? err.message : 'unknown'}`,
        pdfUrl: blobUrl,
      },
      { status: 502 },
    );
  }

  // Fuzzy match against inventory
  const inventory = await unifiedInventoryService.getInventory();
  const indexable = inventory.map((i) => ({
    productId: i.productId,
    productName: i.productName,
    sku: i.sku,
  }));
  const currentCostByProductId = new Map(inventory.map((i) => [i.productId, i.unitCost]));

  const matched: MatchedRow[] = parsed.rows.map((row) => {
    const best = bestMatchForExtractedName(row.productName, indexable, row.sku);
    // Threshold 0.4 — empirically a decent floor for trigram overlap on
    // roofing material names.
    if (best && best.score >= 0.4) {
      return {
        extracted: row,
        match: {
          ...best,
          currentUnitCost: currentCostByProductId.get(best.productId) ?? 0,
        },
      };
    }
    return { extracted: row, match: null };
  });

  const uploadId = `VPU-${Date.now()}`;
  const matchedCount = matched.filter((m) => m.match).length;

  // Best-effort log of the upload (separate from cost-update PATCH which logs
  // each change individually)
  logUpload({
    uploadId,
    vendorName: parsed.vendorName || vendorName || 'unknown',
    pdfUrl: blobUrl,
    extractedRowCount: parsed.rows.length,
    matchedCount,
    updatedCount: 0, // gets bumped on PATCH
    uploadedBy: auth.user.email,
    effectiveDate: parsed.effectiveDate || '',
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    uploadId,
    vendorName: parsed.vendorName || vendorName,
    effectiveDate: parsed.effectiveDate || '',
    pdfUrl: blobUrl,
    extractedRowCount: parsed.rows.length,
    matchedCount,
    rows: matched,
    modelUsed: parsed.modelUsed,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (!ALLOWED_ROLES.includes(auth.user.role)) {
    return NextResponse.json(
      { error: 'admin / owner / office role required' },
      { status: 403 },
    );
  }

  let body: {
    uploadId?: string;
    vendor?: string;
    confirmed?: Array<{
      productId: string;
      newUnitCost: number;
      sourceName?: string;
    }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const confirmed = Array.isArray(body.confirmed) ? body.confirmed : [];
  if (confirmed.length === 0) {
    return NextResponse.json({ error: 'confirmed[] is required' }, { status: 400 });
  }

  let updated = 0;
  const failures: { productId: string; error: string }[] = [];

  // Pull current inventory once so we can preserve unitPrice (we're only
  // updating cost from the vendor sheet — retail price isn't touched).
  const inventory = await unifiedInventoryService.getInventory();
  const itemById = new Map(inventory.map((i) => [i.productId, i]));

  for (const row of confirmed) {
    const productId = String(row.productId || '').trim();
    const newCost = Number(row.newUnitCost);
    if (!productId || !Number.isFinite(newCost) || newCost <= 0) {
      failures.push({ productId, error: 'invalid productId or unitCost' });
      continue;
    }

    const existing = itemById.get(productId);
    if (!existing) {
      failures.push({ productId, error: 'product not found in inventory' });
      continue;
    }

    try {
      // updatePricing writes the cost-change + a PricingRecord audit row.
      // newPrice = existing.unitPrice — vendor sheet only changes COST.
      const result = await unifiedInventoryService.updatePricing(
        productId,
        newCost,
        existing.unitPrice,
        `${auth.user.name} <${auth.user.email}>`,
        `Vendor pricing snapshot (${body.vendor || 'unknown'}; source: ${row.sourceName || 'PDF row'})`,
      );
      if (result) {
        updated++;
      } else {
        failures.push({ productId, error: 'updatePricing returned null' });
      }
    } catch (err) {
      failures.push({
        productId,
        error: err instanceof Error ? err.message : 'updatePricing failed',
      });
    }
  }

  return NextResponse.json({
    success: failures.length === 0,
    updated,
    failures,
  });
}

export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (!ALLOWED_ROLES.includes(auth.user.role)) {
    return NextResponse.json(
      { error: 'admin / owner / office role required' },
      { status: 403 },
    );
  }

  try {
    const rows = await googleSheetsService.getGenericRows(UPLOAD_TAB, UPLOAD_HEADERS);
    // Reverse-chronological, cap to 20
    rows.sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
    return NextResponse.json({ success: true, uploads: rows.slice(0, 20) });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'List failed' },
      { status: 500 },
    );
  }
}
