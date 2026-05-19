/**
 * PDF Invoice Generation (Phase 2)
 *
 * Uses @react-pdf/renderer — free, serverless-friendly, no headless Chrome
 * required. Two flavors:
 *
 *   1. renderCustomerInvoicePDF(invoice, order) — PRICE ONLY. Safe to email
 *      to the customer or attach to a JobNimbus job. Strips every cost field
 *      via lib/cost-visibility.ts before render. RCRS branding (neon green
 *      #39FF14 accents on a clean white invoice body).
 *
 *   2. renderInternalInvoicePDF(invoice, order) — admin/office/owner only.
 *      Shows purchase cost, final price, and margin. NEVER attach to JN,
 *      never email to the customer, never expose to a sales rep.
 *
 *   3. renderPaymentReceiptPDF(invoice, order, payment) — receipt sent to
 *      the customer after a payment is recorded. Price only.
 *
 * Returns a Node Buffer ready to attach or stream.
 *
 * IMPORTANT: All three functions use the canonical PipelineInvoice +
 * PipelineOrder shapes from lib/material-order-pipeline.ts so we don't
 * fork the data model.
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import type { PipelineInvoice, PipelineOrder } from './material-order-pipeline';

// ============================================================
// BRAND CONSTANTS
// ============================================================

const BRAND_GREEN = '#39FF14';
const BRAND_BLACK = '#0a0a0a';
const TEXT_DARK = '#1f2937';
const TEXT_MUTED = '#6b7280';
const BORDER_LIGHT = '#e5e7eb';
const BG_LIGHT = '#f9fafb';

const COMPANY = {
  name: 'River City Roofing Solutions',
  addressLine1: 'Huntsville, AL',
  phone: '(256) 274-8530',
  email: 'rcrs@rivercityroofingsolutions.com',
  web: 'www.rivercityroofingsolutions.com',
  bbb: 'BBB A+ | IKO ROOFPRO Craftsman Premier',
};

// ============================================================
// STYLES (react-pdf StyleSheet)
// ============================================================

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: TEXT_DARK,
    backgroundColor: '#ffffff',
  },

  // Header band
  headerBand: {
    backgroundColor: BRAND_BLACK,
    paddingVertical: 18,
    paddingHorizontal: 24,
    marginHorizontal: -40,
    marginTop: -40,
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerCompany: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_GREEN,
  },
  headerSubtitle: {
    fontSize: 9,
    color: '#d1d5db',
    marginTop: 2,
  },
  headerInvoice: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    letterSpacing: 2,
  },
  headerInvoiceNumber: {
    fontSize: 10,
    color: BRAND_GREEN,
    marginTop: 2,
    textAlign: 'right',
  },

  // Two-column meta
  metaRow: {
    flexDirection: 'row',
    marginBottom: 18,
    gap: 12,
  },
  metaBox: {
    flex: 1,
    padding: 12,
    backgroundColor: BG_LIGHT,
    borderRadius: 4,
  },
  metaLabel: {
    fontSize: 8,
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    marginBottom: 6,
  },
  metaValueStrong: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: TEXT_DARK,
    marginBottom: 3,
  },
  metaValue: {
    fontSize: 9,
    color: TEXT_DARK,
    lineHeight: 1.4,
  },

  // Line-items table
  table: {
    marginTop: 6,
    marginBottom: 14,
    borderTopWidth: 2,
    borderTopColor: BRAND_GREEN,
    borderBottomWidth: 2,
    borderBottomColor: BRAND_GREEN,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: BRAND_BLACK,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tableHeaderCell: {
    color: BRAND_GREEN,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  cellDesc: { width: '46%', fontSize: 9 },
  cellQty: { width: '14%', textAlign: 'center', fontSize: 9 },
  cellUnit: { width: '14%', textAlign: 'center', fontSize: 9, color: TEXT_MUTED },
  cellPrice: { width: '13%', textAlign: 'right', fontSize: 9 },
  cellTotal: {
    width: '13%',
    textAlign: 'right',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },

  // Totals
  totalsWrap: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 18,
  },
  totalsBox: { width: '45%' },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  totalsLabel: { fontSize: 10, color: TEXT_DARK },
  totalsValue: { fontSize: 10, color: TEXT_DARK },
  totalsGrand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingVertical: 8,
    borderTopWidth: 2,
    borderTopColor: BRAND_GREEN,
    backgroundColor: '#f0fff0',
    paddingHorizontal: 8,
  },
  totalsGrandLabel: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: TEXT_DARK,
  },
  totalsGrandValue: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_BLACK,
  },

  // Footer / terms
  terms: {
    marginTop: 10,
    padding: 12,
    backgroundColor: BG_LIGHT,
    borderRadius: 4,
  },
  termsTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: TEXT_DARK,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  termsBody: { fontSize: 9, color: TEXT_DARK, lineHeight: 1.5 },

  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: TEXT_MUTED,
    borderTopWidth: 1,
    borderTopColor: BORDER_LIGHT,
    paddingTop: 8,
  },

  // Margin badge (internal only)
  internalBadge: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#dc2626',
    color: '#dc2626',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    padding: 6,
    marginBottom: 12,
    textAlign: 'center',
  },
  marginRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  marginLabel: { fontSize: 10, color: '#dc2626' },
  marginValue: { fontSize: 10, color: '#dc2626', fontFamily: 'Helvetica-Bold' },
  profitLabel: { fontSize: 10, color: '#16a34a' },
  profitValue: { fontSize: 10, color: '#16a34a', fontFamily: 'Helvetica-Bold' },

  // Receipt
  paidStamp: {
    position: 'absolute',
    top: 90,
    right: 40,
    borderWidth: 3,
    borderColor: '#16a34a',
    color: '#16a34a',
    paddingVertical: 6,
    paddingHorizontal: 18,
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 3,
    transform: 'rotate(-12deg)',
  },
});

// ============================================================
// HELPERS
// ============================================================

const fmt = (n: number): string =>
  `$${(Math.round(n * 100) / 100).toFixed(2)}`;

const fmtDate = (iso?: string): string => {
  if (!iso) return new Date().toLocaleDateString('en-US');
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
};

const safeStr = (v: unknown): string => (v == null ? '' : String(v));

function computeDueDate(invoice: PipelineInvoice, terms = 'Net 30'): string {
  const base = invoice.sentAt || invoice.createdAt || new Date().toISOString();
  const d = new Date(base);
  let days = 30;
  const m = terms.match(/Net\s*(\d+)/i);
  if (m) days = parseInt(m[1], 10);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ============================================================
// CUSTOMER INVOICE COMPONENT (PRICE ONLY)
// ============================================================

interface CustomerInvoiceProps {
  invoice: PipelineInvoice;
  order: PipelineOrder;
  terms?: string;
  paid?: boolean;
  paidLabel?: string; // e.g., "PAID" or "RECEIPT"
}

const CustomerInvoiceDocument: React.FC<CustomerInvoiceProps> = ({
  invoice,
  order,
  terms = 'Net 30',
  paid = false,
  paidLabel = 'PAID',
}) => {
  // SAFETY: scrub any cost fields from items even if the caller forgot.
  // We rebuild the line array using only price-side fields.
  const items = (invoice.items || []).map((it) => ({
    productName: safeStr(it.productName),
    quantity: Number(it.quantity || 0),
    unit: safeStr(it.unit),
    unitPrice: Number(it.unitPrice || 0),
    totalPrice: Number(it.totalPrice || 0),
  }));

  const subtotal = Number(invoice.subtotal || 0);
  const tax = Number(invoice.tax || 0); // typically 0 per business rule
  const total = Number(invoice.total || 0);
  const dueDate = computeDueDate(invoice, terms);

  const jobAddress = [
    safeStr(order.deliveryAddress),
    safeStr(order.deliveryCity),
    safeStr(order.deliveryState),
    safeStr(order.deliveryZip),
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Document
      title={`Invoice ${invoice.invoiceId}`}
      author={COMPANY.name}
      subject={`Invoice for ${safeStr(invoice.customerName)}`}
    >
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.headerBand}>
          <View>
            <Text style={styles.headerCompany}>{COMPANY.name}</Text>
            <Text style={styles.headerSubtitle}>{COMPANY.bbb}</Text>
            <Text style={styles.headerSubtitle}>
              {COMPANY.phone} | {COMPANY.email}
            </Text>
          </View>
          <View>
            <Text style={styles.headerInvoice}>
              {paid ? 'RECEIPT' : 'INVOICE'}
            </Text>
            <Text style={styles.headerInvoiceNumber}>
              {invoice.invoiceId}
            </Text>
          </View>
        </View>

        {paid ? <Text style={styles.paidStamp}>{paidLabel}</Text> : null}

        {/* Meta: Bill To / Job Details / Invoice Info */}
        <View style={styles.metaRow}>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Bill To</Text>
            <Text style={styles.metaValueStrong}>
              {safeStr(invoice.customerName) || 'Customer'}
            </Text>
            {invoice.customerEmail ? (
              <Text style={styles.metaValue}>{invoice.customerEmail}</Text>
            ) : null}
            {order.customerPhone ? (
              <Text style={styles.metaValue}>{order.customerPhone}</Text>
            ) : null}
          </View>

          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Job</Text>
            <Text style={styles.metaValueStrong}>
              {safeStr(invoice.jobName) || safeStr(invoice.jobNumber)}
            </Text>
            {jobAddress ? (
              <Text style={styles.metaValue}>{jobAddress}</Text>
            ) : null}
            {invoice.jobNumber ? (
              <Text style={styles.metaValue}>Job # {invoice.jobNumber}</Text>
            ) : null}
          </View>

          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Invoice Info</Text>
            <Text style={styles.metaValue}>
              Issued: {fmtDate(invoice.sentAt || invoice.createdAt)}
            </Text>
            <Text style={styles.metaValue}>Due: {fmtDate(dueDate)}</Text>
            <Text style={styles.metaValue}>Terms: {terms}</Text>
          </View>
        </View>

        {/* Items table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.cellDesc]}>
              Description
            </Text>
            <Text style={[styles.tableHeaderCell, styles.cellQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.cellUnit]}>Unit</Text>
            <Text style={[styles.tableHeaderCell, styles.cellPrice]}>
              Unit Price
            </Text>
            <Text style={[styles.tableHeaderCell, styles.cellTotal]}>
              Amount
            </Text>
          </View>

          {items.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={[styles.cellDesc, { color: TEXT_MUTED }]}>
                (no line items)
              </Text>
            </View>
          ) : (
            items.map((it, i) => (
              <View
                key={`li-${i}`}
                style={[
                  styles.tableRow,
                  i % 2 === 1 ? styles.tableRowAlt : {},
                ]}
              >
                <Text style={styles.cellDesc}>{it.productName}</Text>
                <Text style={styles.cellQty}>{it.quantity}</Text>
                <Text style={styles.cellUnit}>{it.unit}</Text>
                <Text style={styles.cellPrice}>{fmt(it.unitPrice)}</Text>
                <Text style={styles.cellTotal}>{fmt(it.totalPrice)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Totals */}
        <View style={styles.totalsWrap}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{fmt(subtotal)}</Text>
            </View>
            {tax > 0 ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Tax</Text>
                <Text style={styles.totalsValue}>{fmt(tax)}</Text>
              </View>
            ) : null}
            {paid && invoice.paidAmount != null ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Amount Paid</Text>
                <Text style={styles.totalsValue}>
                  -{fmt(Number(invoice.paidAmount))}
                </Text>
              </View>
            ) : null}
            <View style={styles.totalsGrand}>
              <Text style={styles.totalsGrandLabel}>
                {paid ? 'Balance' : 'Total Due'}
              </Text>
              <Text style={styles.totalsGrandValue}>
                {fmt(
                  paid
                    ? Math.max(0, total - Number(invoice.paidAmount || 0))
                    : total
                )}
              </Text>
            </View>
          </View>
        </View>

        {/* Notes / payment terms */}
        <View style={styles.terms}>
          <Text style={styles.termsTitle}>Payment Terms</Text>
          <Text style={styles.termsBody}>
            {terms}. Please make checks payable to {COMPANY.name}. Online
            payments accepted by ACH or card; reference invoice number{' '}
            {invoice.invoiceId} on remittance. Questions? Email{' '}
            {COMPANY.email} or call {COMPANY.phone}.
          </Text>
          {invoice.notes ? (
            <>
              <Text style={[styles.termsTitle, { marginTop: 8 }]}>Notes</Text>
              <Text style={styles.termsBody}>{invoice.notes}</Text>
            </>
          ) : null}
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          {COMPANY.name} | {COMPANY.phone} | {COMPANY.email} |{' '}
          {COMPANY.web} | Thank you for your business.
        </Text>
      </Page>
    </Document>
  );
};

// ============================================================
// INTERNAL INVOICE COMPONENT (cost + price + margin)
// ============================================================

interface InternalInvoiceProps {
  invoice: PipelineInvoice;
  order: PipelineOrder;
}

const InternalInvoiceDocument: React.FC<InternalInvoiceProps> = ({
  invoice,
  order,
}) => {
  // Use cost from invoice.items if present, else fall back to order.items
  const items = (invoice.items || []).map((it, i) => {
    const orderItem = order.items?.find((oi) => oi.productName === it.productName) || order.items?.[i];
    const unitCost = Number(it.unitCost ?? orderItem?.unitCost ?? 0);
    const totalCost = Number(it.totalCost ?? orderItem?.totalCost ?? unitCost * Number(it.quantity || 0));
    return {
      productName: safeStr(it.productName),
      quantity: Number(it.quantity || 0),
      unit: safeStr(it.unit),
      unitCost,
      totalCost,
      unitPrice: Number(it.unitPrice || 0),
      totalPrice: Number(it.totalPrice || 0),
    };
  });

  const totalCost = Number(
    invoice.costTotal ??
      items.reduce((s, it) => s + it.totalCost, 0)
  );
  const totalPrice = Number(invoice.total || items.reduce((s, it) => s + it.totalPrice, 0));
  const margin = Number(invoice.margin ?? (totalPrice - totalCost));
  const marginPct =
    totalPrice > 0 ? (margin / totalPrice) * 100 : 0;

  return (
    <Document
      title={`Internal Invoice ${invoice.invoiceId}`}
      author={COMPANY.name}
      subject={`Internal cost report — ${safeStr(invoice.jobNumber)}`}
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerBand}>
          <View>
            <Text style={styles.headerCompany}>{COMPANY.name}</Text>
            <Text style={styles.headerSubtitle}>
              INTERNAL COST REPORT — DO NOT SHARE
            </Text>
          </View>
          <View>
            <Text style={styles.headerInvoice}>INTERNAL</Text>
            <Text style={styles.headerInvoiceNumber}>
              {invoice.invoiceId}
            </Text>
          </View>
        </View>

        <Text style={styles.internalBadge}>
          CONFIDENTIAL — ADMIN / OFFICE / OWNER ONLY
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Job</Text>
            <Text style={styles.metaValueStrong}>
              {safeStr(invoice.jobName)}
            </Text>
            <Text style={styles.metaValue}>
              Job # {safeStr(invoice.jobNumber)}
            </Text>
            <Text style={styles.metaValue}>
              Customer: {safeStr(invoice.customerName)}
            </Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Order Source</Text>
            <Text style={styles.metaValue}>
              Order: {safeStr(order.orderId)}
            </Text>
            <Text style={styles.metaValue}>
              Source:{' '}
              {order.orderSource === 'other_vendor'
                ? `Outside vendor (${safeStr(order.supplierName) || '—'})`
                : 'Warehouse stock'}
            </Text>
            <Text style={styles.metaValue}>
              Issued: {fmtDate(invoice.createdAt)}
            </Text>
          </View>
        </View>

        {/* Items table — adds Cost columns */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { width: '38%' }]}>
              Description
            </Text>
            <Text style={[styles.tableHeaderCell, { width: '10%', textAlign: 'center' }]}>
              Qty
            </Text>
            <Text style={[styles.tableHeaderCell, { width: '13%', textAlign: 'right' }]}>
              Unit Cost
            </Text>
            <Text style={[styles.tableHeaderCell, { width: '13%', textAlign: 'right' }]}>
              Total Cost
            </Text>
            <Text style={[styles.tableHeaderCell, { width: '13%', textAlign: 'right' }]}>
              Unit Price
            </Text>
            <Text style={[styles.tableHeaderCell, { width: '13%', textAlign: 'right' }]}>
              Total Price
            </Text>
          </View>

          {items.map((it, i) => (
            <View
              key={`int-li-${i}`}
              style={[
                styles.tableRow,
                i % 2 === 1 ? styles.tableRowAlt : {},
              ]}
            >
              <Text style={{ width: '38%', fontSize: 9 }}>
                {it.productName} {it.unit ? `(${it.unit})` : ''}
              </Text>
              <Text style={{ width: '10%', textAlign: 'center', fontSize: 9 }}>
                {it.quantity}
              </Text>
              <Text style={{ width: '13%', textAlign: 'right', fontSize: 9, color: '#dc2626' }}>
                {fmt(it.unitCost)}
              </Text>
              <Text style={{ width: '13%', textAlign: 'right', fontSize: 9, color: '#dc2626', fontFamily: 'Helvetica-Bold' }}>
                {fmt(it.totalCost)}
              </Text>
              <Text style={{ width: '13%', textAlign: 'right', fontSize: 9, color: '#16a34a' }}>
                {fmt(it.unitPrice)}
              </Text>
              <Text style={{ width: '13%', textAlign: 'right', fontSize: 9, color: '#16a34a', fontFamily: 'Helvetica-Bold' }}>
                {fmt(it.totalPrice)}
              </Text>
            </View>
          ))}
        </View>

        {/* Cost / Price / Margin summary */}
        <View style={styles.totalsWrap}>
          <View style={[styles.totalsBox, { width: '55%' }]}>
            <View style={styles.marginRow}>
              <Text style={styles.marginLabel}>Total Cost (our spend)</Text>
              <Text style={styles.marginValue}>{fmt(totalCost)}</Text>
            </View>
            <View style={styles.marginRow}>
              <Text style={styles.profitLabel}>Total Price (charged)</Text>
              <Text style={styles.profitValue}>{fmt(totalPrice)}</Text>
            </View>
            <View
              style={[
                styles.totalsGrand,
                { backgroundColor: '#eff6ff', borderTopColor: '#2563eb' },
              ]}
            >
              <Text style={[styles.totalsGrandLabel, { color: '#2563eb' }]}>
                Gross Margin
              </Text>
              <Text
                style={[styles.totalsGrandValue, { color: '#2563eb' }]}
              >
                {fmt(margin)} ({marginPct.toFixed(1)}%)
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.terms}>
          <Text style={styles.termsTitle}>Internal-only</Text>
          <Text style={styles.termsBody}>
            This document shows purchase cost and margin. Never attach to
            JobNimbus, never email outside the office, never share with sales
            reps. Visible only to owner, admin, manager, office, and
            project_manager roles.
          </Text>
        </View>

        <Text style={styles.footer}>
          {COMPANY.name} | Internal Cost Report | Generated{' '}
          {fmtDate(new Date().toISOString())}
        </Text>
      </Page>
    </Document>
  );
};

// ============================================================
// PUBLIC API — returns Buffer
// ============================================================

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/**
 * Render a customer-facing invoice PDF. PRICE ONLY — no cost data is ever
 * emitted to this PDF. Safe to email to customers and attach to JobNimbus.
 *
 * Returns a Node Buffer.
 */
export async function renderCustomerInvoicePDF(
  invoice: PipelineInvoice,
  order: PipelineOrder,
  options?: { terms?: string; paid?: boolean }
): Promise<Buffer> {
  const doc = (
    <CustomerInvoiceDocument
      invoice={invoice}
      order={order}
      terms={options?.terms || 'Net 30'}
      paid={options?.paid || false}
    />
  );
  const instance = pdf(doc);
  const stream = await instance.toBuffer();
  // @react-pdf/renderer's pdf(...).toBuffer() returns a NodeJS.ReadableStream.
  // Pipe it through our helper to produce a real Buffer.
  return streamToBuffer(stream as unknown as NodeJS.ReadableStream);
}

/**
 * Render the internal (cost + margin) version of the invoice. Admin /
 * office / owner only — never email to a customer or attach to JN.
 */
export async function renderInternalInvoicePDF(
  invoice: PipelineInvoice,
  order: PipelineOrder
): Promise<Buffer> {
  const doc = <InternalInvoiceDocument invoice={invoice} order={order} />;
  const instance = pdf(doc);
  const stream = await instance.toBuffer();
  return streamToBuffer(stream as unknown as NodeJS.ReadableStream);
}

/**
 * Render a payment-receipt PDF for the customer. Same layout as the customer
 * invoice but with a PAID stamp and the payment line. PRICE ONLY.
 */
export async function renderPaymentReceiptPDF(
  invoice: PipelineInvoice,
  order: PipelineOrder,
  payment: {
    amount: number;
    method: string;
    reference?: string;
    date?: string;
  }
): Promise<Buffer> {
  // Build a virtual invoice with the payment applied so the receipt shows
  // amount paid + remaining balance correctly.
  const receiptInvoice: PipelineInvoice = {
    ...invoice,
    paidAmount: payment.amount,
    paidAt: payment.date || new Date().toISOString(),
    status: 'paid',
    notes: [
      invoice.notes || '',
      `Payment received: ${payment.method.toUpperCase()}${
        payment.reference ? ` (ref ${payment.reference})` : ''
      } on ${fmtDate(payment.date || new Date().toISOString())}.`,
    ]
      .filter(Boolean)
      .join('\n'),
  };

  const doc = (
    <CustomerInvoiceDocument
      invoice={receiptInvoice}
      order={order}
      terms="Receipt"
      paid={true}
      paidLabel="PAID"
    />
  );
  const instance = pdf(doc);
  const stream = await instance.toBuffer();
  return streamToBuffer(stream as unknown as NodeJS.ReadableStream);
}
