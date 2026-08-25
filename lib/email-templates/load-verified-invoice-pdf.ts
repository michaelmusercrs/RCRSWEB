// Load-verified office invoice PDF generator.
//
// Generates the PDF attachment that rides out with the
// `load-verified-invoice` email. The email body is a short cover note;
// the PDF carries the full line-item detail. The owner specifically
// asked for "a PDF invoice with some details in the body" — not an
// all-HTML invoice.
//
// PRICE ONLY. No cost-side data ever lives on this PDF. See
// feedback_purchase_price_visibility — cost reaches owner / admin /
// office / manager / Richard via separate reports, never on the invoice.
// JN reps and customers must be safe to forward this PDF to.
//
// Library: pdfkit (2026-08-25). Replaced pdfmake, whose `require('pdfmake')`
// returned the browser bundle in the Vercel serverless build ("PdfPrinter is
// not a constructor"), so the invoice PDF silently failed to attach and the
// office got a text-only email. pdfkit is pure JS, already present (pdfmake's
// own dependency), and uses the 14 built-in PDF standard fonts (Helvetica) —
// so there are NO external .ttf files to resolve in the bundle, which is
// exactly what broke pdfmake here.

import PDFDocument from 'pdfkit';
import type { LoadVerifiedInvoiceEmailData } from './load-verified-invoice';

// Brand accent — matches the HTML template (shared.ts ACCENT).
const ACCENT = '#0066CC';
const TEXT = '#1f2937';
const MUTED = '#6b7280';
const BORDER = '#e3e6ea';
const TINT = '#f6f8fb';

// Letter page = 612×792 pt. 40pt margins → content spans x:40→572 (width 532).
const L = 40;
const R = 572;
const W = R - L;

function fmtMoney(n: number): string {
  if (typeof n !== 'number' || !isFinite(n)) return '$0.00';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function fmtVerifiedAt(raw: string): string {
  try {
    return new Date(raw).toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return raw;
  }
}

interface Col {
  x: number;
  w: number;
  align: 'left' | 'right';
  head: string;
}

// Line-item columns. Sum of widths = 532 = content width.
const COLS: Col[] = [
  { x: L, w: 38, align: 'left', head: 'Qty' },
  { x: L + 38, w: 46, align: 'left', head: 'Unit' },
  { x: L + 84, w: 250, align: 'left', head: 'Item' },
  { x: L + 334, w: 88, align: 'right', head: 'Unit Price' },
  { x: L + 422, w: 110, align: 'right', head: 'Line Total' },
];
const PAD = 8;

/**
 * Render the load-verified invoice as a PDF buffer. Returns a single
 * Buffer ready to hand to Resend's `attachments` array.
 */
export async function renderLoadVerifiedInvoicePDF(
  data: LoadVerifiedInvoiceEmailData,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // ── Header: wordmark left, INVOICE + id right ──────────────────────────
  doc.font('Helvetica-Bold').fontSize(13).fillColor(TEXT)
    .text('RIVER CITY ROOFING SOLUTIONS', L, 42, { characterSpacing: 1 });
  doc.font('Helvetica').fontSize(9).fillColor(MUTED)
    .text('North Alabama  ·  (256) 274-8530', L, doc.y + 1);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(ACCENT)
    .text('INVOICE', R - 200, 42, { width: 200, align: 'right', characterSpacing: 2 });
  doc.font('Helvetica-Bold').fontSize(16).fillColor(TEXT)
    .text(data.invoiceId, R - 200, doc.y + 1, { width: 200, align: 'right' });

  // 2pt accent rule under the header.
  const ruleY = 86;
  doc.moveTo(L, ruleY).lineTo(R, ruleY).lineWidth(2).strokeColor(ACCENT).stroke();

  // ── Bill-to (left) + metadata (right), independent columns ─────────────
  const blockTop = ruleY + 16;
  const leftW = 250;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED)
    .text('BILL TO', L, blockTop, { characterSpacing: 0.8 });
  doc.font('Helvetica-Bold').fontSize(12).fillColor(TEXT)
    .text(data.customerName || '—', L, doc.y + 2, { width: leftW });
  doc.font('Helvetica').fontSize(10).fillColor(TEXT)
    .text(data.address || '', L, doc.y + 2, { width: leftW });
  const leftEndY = doc.y;

  const meta: Array<[string, string]> = [
    ['Invoice', data.invoiceId],
    ['Ticket', data.ticketId],
    ['Job', data.jobNumber],
    ['Sales Rep', data.salesRepName || '—'],
    ['Verified by', data.verifiedByName],
    ['Verified at', fmtVerifiedAt(data.verifiedAt)],
  ];
  const mLabelX = 312, mLabelW = 108, mValX = 424, mValW = 148;
  let my = blockTop;
  for (const [label, value] of meta) {
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
      .text(label, mLabelX, my, { width: mLabelW, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(TEXT)
      .text(String(value ?? '—'), mValX, my, { width: mValW, align: 'right' });
    my += 15;
  }

  let y = Math.max(leftEndY, my) + 18;

  // ── Line items ─────────────────────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED)
    .text('LINE ITEMS', L, y, { characterSpacing: 0.8 });
  y = doc.y + 4;

  const headH = 20;
  doc.rect(L, y, W, headH).fill(TINT);
  doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9);
  for (const c of COLS) {
    doc.text(c.head, c.align === 'right' ? c.x : c.x + PAD, y + 6, {
      width: c.w - PAD, align: c.align,
    });
  }
  y += headH;
  doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(BORDER).stroke();

  for (const m of data.materials || []) {
    if (y > 720) { doc.addPage(); y = 42; }
    const cells = [
      String(m.qty),
      m.unit || '',
      m.name,
      fmtMoney(m.unitPrice),
      fmtMoney(m.linePrice),
    ];
    doc.font('Helvetica').fontSize(10);
    const itemH = doc.heightOfString(m.name || '', { width: COLS[2].w - PAD });
    const rowH = Math.max(itemH, 12) + 14;
    for (let i = 0; i < COLS.length; i++) {
      const c = COLS[i];
      doc.font(i === 4 ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(TEXT)
        .text(cells[i], c.align === 'right' ? c.x : c.x + PAD, y + 7, {
          width: c.w - PAD, align: c.align,
        });
    }
    y += rowH;
    doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(BORDER).stroke();
  }

  // ── Total ──────────────────────────────────────────────────────────────
  y += 2;
  doc.moveTo(L, y).lineTo(R, y).lineWidth(1.5).strokeColor(ACCENT).stroke();
  y += 9;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(TEXT)
    .text('TOTAL', L, y + 2, { width: W - 130, align: 'right', characterSpacing: 1 });
  doc.font('Helvetica-Bold').fontSize(14).fillColor(ACCENT)
    .text(fmtMoney(data.totalPrice), R - 130, y, { width: 130, align: 'right' });
  y += 28;

  // ── Notes (optional) ───────────────────────────────────────────────────
  if (data.notes) {
    if (y > 700) { doc.addPage(); y = 42; }
    doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED)
      .text('NOTES', L, y, { characterSpacing: 0.8 });
    doc.font('Helvetica').fontSize(10).fillColor(TEXT)
      .text(data.notes, L, doc.y + 2, { width: W });
    y = doc.y;
  }

  // ── Footer ─────────────────────────────────────────────────────────────
  doc.font('Helvetica-Oblique').fontSize(8).fillColor(MUTED)
    .text(
      'Materials loaded and verified at the warehouse. Stock has been deducted. ' +
      'Cost-side material consumption recorded separately.',
      L, y + 22, { width: W },
    );

  doc.end();
  return done;
}
