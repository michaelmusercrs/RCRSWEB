// TODO npm install pdfmake @types/pdfmake
//
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
// Library: pdfmake. Chosen because it is pure JS (no native bindings,
// no Chromium), small (~1MB), and runs on Vercel serverless without
// the binary-bundling pain Puppeteer / playwright cause. @react-pdf
// would also work but ships a React renderer we don't need on the
// server side and has heavier deps. Roboto is bundled as a standard
// font so we don't need to ship font files.

// pdfmake's CommonJS export is the PdfPrinter constructor itself, but the
// @types package types it as a module namespace. Use a require-style import
// + cast to keep TypeScript and the actual runtime in agreement.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const PdfPrinter: new (fontDescriptors: Record<string, unknown>) => {
  createPdfKitDocument(docDefinition: unknown): NodeJS.ReadableStream & {
    end(): void;
    on(event: 'data', cb: (chunk: Buffer) => void): void;
    on(event: 'end', cb: () => void): void;
    on(event: 'error', cb: (err: Error) => void): void;
  };
} = require('pdfmake');
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';

import type { LoadVerifiedInvoiceEmailData } from './load-verified-invoice';

// Brand accent — matches the HTML template (shared.ts ACCENT).
const ACCENT = '#0066CC';
const TEXT = '#1f2937';
const MUTED = '#6b7280';
const BORDER = '#e3e6ea';
const TINT = '#f6f8fb';

// Roboto ships with pdfmake's default font registration. Declaring it
// explicitly keeps the printer happy in a Node / serverless context.
const FONTS = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
};

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

/**
 * Build the pdfmake document definition for a load-verified invoice.
 * Exported only so it can be unit-tested without spinning up a printer.
 */
export function buildLoadVerifiedInvoiceDocDef(
  data: LoadVerifiedInvoiceEmailData,
): TDocumentDefinitions {
  // Line-item table body — header row then one row per material.
  const lineItemBody: Content[][] = [
    [
      { text: 'Qty', style: 'th' },
      { text: 'Unit', style: 'th' },
      { text: 'Item', style: 'th' },
      { text: 'Unit Price', style: 'thRight' },
      { text: 'Line Total', style: 'thRight' },
    ],
    ...data.materials.map<Content[]>((m) => [
      { text: String(m.qty), style: 'td' },
      { text: m.unit || '', style: 'td' },
      { text: m.name, style: 'td' },
      { text: fmtMoney(m.unitPrice), style: 'tdRight' },
      { text: fmtMoney(m.linePrice), style: 'tdRightBold' },
    ]),
  ];

  // Header row: wordmark left, "INVOICE" + invoice id right.
  const header: Content = {
    columns: [
      {
        width: '*',
        stack: [
          {
            text: 'RIVER CITY ROOFING SOLUTIONS',
            style: 'wordmark',
          },
          {
            text: 'North Alabama  ·  (256) 274-8530',
            style: 'wordmarkSub',
          },
        ],
      },
      {
        width: 'auto',
        stack: [
          { text: 'INVOICE', style: 'invoiceLabel' },
          { text: data.invoiceId, style: 'invoiceId' },
        ],
        alignment: 'right',
      },
    ],
  };

  // 2px accent underline below the header.
  const headerRule: Content = {
    canvas: [
      {
        type: 'line',
        x1: 0,
        y1: 0,
        x2: 515, // letter width (612) - 2 * 40px margin - small gutter
        y2: 0,
        lineWidth: 2,
        lineColor: ACCENT,
      },
    ],
    margin: [0, 6, 0, 14],
  };

  // Two-column body block: bill-to (left) + invoice metadata (right).
  const billToBlock: Content = {
    columns: [
      {
        width: '*',
        stack: [
          { text: 'BILL TO', style: 'sectionLabel' },
          { text: data.customerName, style: 'billToName' },
          { text: data.address, style: 'billToAddr' },
        ],
      },
      {
        width: 'auto',
        table: {
          widths: ['auto', 'auto'],
          body: [
            [
              { text: 'Invoice', style: 'kvLabel' },
              { text: data.invoiceId, style: 'kvValue' },
            ],
            [
              { text: 'Ticket', style: 'kvLabel' },
              { text: data.ticketId, style: 'kvValue' },
            ],
            [
              { text: 'Job', style: 'kvLabel' },
              { text: data.jobNumber, style: 'kvValue' },
            ],
            [
              { text: 'Sales Rep', style: 'kvLabel' },
              { text: data.salesRepName || '—', style: 'kvValue' },
            ],
            [
              { text: 'Verified by', style: 'kvLabel' },
              { text: data.verifiedByName, style: 'kvValue' },
            ],
            [
              { text: 'Verified at', style: 'kvLabel' },
              { text: fmtVerifiedAt(data.verifiedAt), style: 'kvValue' },
            ],
          ],
        },
        layout: 'noBorders',
      },
    ],
    columnGap: 24,
    margin: [0, 0, 0, 18],
  };

  const lineItemsTable: Content = {
    table: {
      headerRows: 1,
      // Column widths chosen so item description has room to wrap.
      widths: [40, 40, '*', 80, 80],
      body: lineItemBody,
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0,
      hLineColor: () => BORDER,
      fillColor: (rowIndex: number) => (rowIndex === 0 ? TINT : null),
      paddingTop: () => 7,
      paddingBottom: () => 7,
      paddingLeft: () => 8,
      paddingRight: () => 8,
    },
    margin: [0, 4, 0, 0],
  };

  // Bold accented total row, right-aligned.
  const totalBlock: Content = {
    table: {
      widths: ['*', 'auto'],
      body: [
        [
          { text: 'TOTAL', style: 'totalLabel' },
          { text: fmtMoney(data.totalPrice), style: 'totalValue' },
        ],
      ],
    },
    layout: {
      hLineWidth: (i: number) => (i === 0 ? 1.5 : 0),
      vLineWidth: () => 0,
      hLineColor: () => ACCENT,
      paddingTop: () => 10,
      paddingBottom: () => 10,
      paddingLeft: () => 8,
      paddingRight: () => 8,
    },
    margin: [0, 6, 0, 0],
  };

  const notesBlock: Content | null = data.notes
    ? {
        stack: [
          { text: 'NOTES', style: 'sectionLabel' },
          {
            text: data.notes,
            style: 'notesBody',
          },
        ],
        margin: [0, 16, 0, 0],
      }
    : null;

  const footer: Content = {
    text:
      'Materials loaded and verified at the warehouse. Stock has been deducted. ' +
      'Cost-side material consumption recorded separately.',
    style: 'footerNote',
    margin: [0, 24, 0, 0],
  };

  const docContent: Content[] = [
    header,
    headerRule,
    billToBlock,
    { text: 'LINE ITEMS', style: 'sectionLabel' },
    lineItemsTable,
    totalBlock,
  ];
  if (notesBlock) docContent.push(notesBlock);
  docContent.push(footer);

  return {
    pageSize: 'LETTER',
    pageMargins: [40, 40, 40, 40],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      color: TEXT,
      lineHeight: 1.35,
    },
    content: docContent,
    styles: {
      wordmark: {
        fontSize: 13,
        bold: true,
        color: TEXT,
        characterSpacing: 1,
      },
      wordmarkSub: {
        fontSize: 9,
        color: MUTED,
        margin: [0, 2, 0, 0],
      },
      invoiceLabel: {
        fontSize: 11,
        bold: true,
        color: ACCENT,
        characterSpacing: 2,
      },
      invoiceId: {
        fontSize: 16,
        bold: true,
        color: TEXT,
        margin: [0, 2, 0, 0],
      },
      sectionLabel: {
        fontSize: 9,
        bold: true,
        color: MUTED,
        characterSpacing: 0.8,
        margin: [0, 0, 0, 4],
      },
      billToName: {
        fontSize: 12,
        bold: true,
        color: TEXT,
      },
      billToAddr: {
        fontSize: 10,
        color: TEXT,
        margin: [0, 2, 0, 0],
      },
      kvLabel: {
        fontSize: 9,
        color: MUTED,
        alignment: 'right',
      },
      kvValue: {
        fontSize: 10,
        color: TEXT,
        bold: true,
      },
      th: {
        fontSize: 9,
        bold: true,
        color: MUTED,
        characterSpacing: 0.6,
      },
      thRight: {
        fontSize: 9,
        bold: true,
        color: MUTED,
        characterSpacing: 0.6,
        alignment: 'right',
      },
      td: {
        fontSize: 10,
        color: TEXT,
      },
      tdRight: {
        fontSize: 10,
        color: TEXT,
        alignment: 'right',
      },
      tdRightBold: {
        fontSize: 10,
        color: TEXT,
        alignment: 'right',
        bold: true,
      },
      totalLabel: {
        fontSize: 11,
        bold: true,
        color: TEXT,
        alignment: 'right',
        characterSpacing: 1,
      },
      totalValue: {
        fontSize: 14,
        bold: true,
        color: ACCENT,
        alignment: 'right',
      },
      notesBody: {
        fontSize: 10,
        color: TEXT,
        margin: [0, 0, 0, 0],
      },
      footerNote: {
        fontSize: 8,
        color: MUTED,
        italics: true,
      },
    },
  };
}

/**
 * Render the load-verified invoice as a PDF buffer. Returns a single
 * Buffer ready to hand to Resend's `attachments` array.
 */
export async function renderLoadVerifiedInvoicePDF(
  data: LoadVerifiedInvoiceEmailData,
): Promise<Buffer> {
  const printer = new PdfPrinter(FONTS);
  const docDef = buildLoadVerifiedInvoiceDocDef(data);
  const pdfDoc = printer.createPdfKitDocument(docDef);

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', (err: Error) => reject(err));
    pdfDoc.end();
  });
}
