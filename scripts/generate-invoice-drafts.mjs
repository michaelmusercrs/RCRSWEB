/**
 * Generate invoice HTML for each real recent delivery ticket.
 * Outputs JSON with { ticketId, subject, htmlBody } per ticket
 * for the Gmail-draft creation step.
 *
 * Per [[feedback_purchase_price_visibility]]: invoice shows PRICE only.
 * ourCost / totalCost are stripped — only totalPrice flows through.
 */
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scripts/sheet-dump.json', 'utf8'));
const tickets = data.tabs.Tickets.rows;
const invoices = data.tabs.Invoices.rows;

// Filter to REAL delivery tickets (not test data, not historical-reconciliation rows)
const invoiced = new Set(invoices.map(i => i.ticketId).filter(Boolean));

const realDeliveries = tickets.filter(t => {
  if (t.ticketType !== 'delivery') return false;
  if (/test|debug/i.test(t.jobName || t.customerName || '')) return false;
  if (/RESTOCK|RECON|HISTORICAL/i.test(t.ticketId || '')) return false;
  if (invoiced.has(t.ticketId)) return false;
  if (!t.materialsJson || t.materialsJson === '[]' || t.materialsJson === '') return false;
  if (!t.totalPrice || parseFloat(t.totalPrice) <= 0) return false;
  return true;
});

realDeliveries.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

console.error(`Real delivery tickets needing invoice: ${realDeliveries.length}`);

const BRAND = 'River City Roofing Solutions';
const ACCENT = '#0066CC';

function nextInvoiceNumber(i) {
  const seq = (i + 1).toString().padStart(4, '0');
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `INV-${date}-${seq}`;
}

function fmtMoney(n) {
  const v = parseFloat(n);
  if (Number.isNaN(v)) return '$0.00';
  return `$${v.toFixed(2)}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago' });
  } catch {
    return iso;
  }
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildInvoiceEmail(ticket, invoiceId) {
  let materials = [];
  try {
    materials = JSON.parse(ticket.materialsJson || '[]');
  } catch {
    materials = [];
  }

  // Strip cost fields from each material — invoice is PRICE only.
  const cleanMaterials = materials.map(m => ({
    name: m.productName || m.name || m.product || '—',
    quantity: m.quantity ?? m.qty ?? 0,
    unit: m.unit ?? '',
    unitPrice: m.unitPrice ?? m.price ?? 0,
    totalPrice: m.totalPrice ?? (m.quantity * (m.unitPrice ?? 0)) ?? 0,
  }));

  const total = parseFloat(ticket.totalPrice) || cleanMaterials.reduce((s, m) => s + (parseFloat(m.totalPrice) || 0), 0);

  const subject = `Invoice ${invoiceId} — ${ticket.jobName || ticket.customerName || ticket.ticketId}`;

  const rows = cleanMaterials.map(m => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e3e6ea;">${escapeHtml(m.quantity)} ${escapeHtml(m.unit)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e3e6ea;">${escapeHtml(m.name)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e3e6ea;text-align:right;">${fmtMoney(m.unitPrice)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e3e6ea;text-align:right;">${fmtMoney(m.totalPrice)}</td>
    </tr>`).join('');

  const htmlBody = `
<div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:720px;margin:0 auto;">
  <div style="border-top:3px solid ${ACCENT};padding:24px 0 16px;border-bottom:1px solid #e3e6ea;">
    <div style="text-transform:uppercase;letter-spacing:2px;color:#6b7280;font-size:11px;">River City Roofing Solutions</div>
    <h1 style="margin:8px 0 0;font-size:24px;color:${ACCENT};">Invoice ${escapeHtml(invoiceId)}</h1>
  </div>

  <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:13px;">
    <tr><td style="padding:4px 0;color:#6b7280;width:140px;">Ticket</td><td>${escapeHtml(ticket.ticketId)}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280;">Job</td><td>${escapeHtml(ticket.jobName || '—')}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280;">Customer</td><td>${escapeHtml(ticket.customerName || '—')}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280;">Address</td><td>${escapeHtml([ticket.jobAddress, ticket.city, ticket.state].filter(Boolean).join(', '))}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280;">Delivered</td><td>${fmtDate(ticket.completedAt || ticket.createdAt)}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280;">Status</td><td>${escapeHtml(ticket.status || '—')}</td></tr>
  </table>

  <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
    <thead>
      <tr style="background:#f6f8fb;text-align:left;">
        <th style="padding:8px 10px;border-bottom:1px solid #e3e6ea;">Qty</th>
        <th style="padding:8px 10px;border-bottom:1px solid #e3e6ea;">Item</th>
        <th style="padding:8px 10px;border-bottom:1px solid #e3e6ea;text-align:right;">Unit Price</th>
        <th style="padding:8px 10px;border-bottom:1px solid #e3e6ea;text-align:right;">Line Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr style="font-weight:bold;background:#f6f8fb;">
        <td colspan="3" style="padding:10px;text-align:right;">TOTAL</td>
        <td style="padding:10px;text-align:right;color:${ACCENT};">${fmtMoney(total)}</td>
      </tr>
    </tfoot>
  </table>

  <p style="font-size:12px;color:#6b7280;margin:20px 0 0;">
    Materials loaded and verified at the warehouse. Stock has been deducted.
    Cost-side material consumption is recorded separately and is not shown on this invoice.
  </p>

  <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e3e6ea;font-size:11px;color:#6b7280;">
    River City Roofing Solutions · (256) 274-8530 · rivercityroofingsolutions.com<br>
    IKO ROOFPRO Craftsman Premier
  </div>
</div>`;

  return { subject, htmlBody, total };
}

const drafts = realDeliveries.map((t, i) => {
  const invoiceId = nextInvoiceNumber(i);
  const { subject, htmlBody, total } = buildInvoiceEmail(t, invoiceId);
  return {
    ticketId: t.ticketId,
    invoiceId,
    customerName: t.customerName,
    jobName: t.jobName,
    completedAt: t.completedAt,
    total,
    subject,
    htmlBody,
  };
});

fs.writeFileSync('scripts/invoice-drafts.json', JSON.stringify(drafts, null, 2));
console.error(`\nGenerated ${drafts.length} invoice drafts in scripts/invoice-drafts.json`);
console.error(`\nSummary:`);
let grand = 0;
for (const d of drafts) {
  console.error(`  ${d.invoiceId}  ${d.ticketId.padEnd(15)}  $${d.total.toFixed(2).padStart(10)}  ${d.customerName.slice(0, 30)}`);
  grand += d.total;
}
console.error(`\nGrand total across ${drafts.length} invoices: $${grand.toFixed(2)}`);
