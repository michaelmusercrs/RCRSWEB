// Load-verified office invoice email.
//
// Fires at load_verified — i.e. Rick has verified the load on the dock
// and the materials are about to leave the warehouse. The office gets
// this as the materials-issued invoice of record.
//
// PRICE ONLY. No cost-side data ever lives on this email. See
// feedback_purchase_price_visibility — cost reaches owner / admin /
// office / manager / Richard via separate reports, never on the invoice.
// JN reps and customers must be safe to forward this to.

import {
  esc,
  renderFooter,
  renderHeader,
  renderKVTable,
  wrapDocument,
  COLORS,
} from './shared';

export interface LoadVerifiedInvoiceEmailData {
  ticketId: string;
  invoiceId: string;
  jobNumber: string;
  customerName: string;
  address: string;
  salesRepName: string;
  verifiedByName: string;
  /** ISO string or anything `new Date(...)` accepts. */
  verifiedAt: string;
  materials: Array<{
    name: string;
    qty: number;
    unit?: string;
    unitPrice: number;
    linePrice: number;
  }>;
  totalPrice: number;
  notes?: string;
}

/** Subject line: invoice ID first for easy scanning in the inbox. */
export function loadVerifiedInvoiceSubject(data: LoadVerifiedInvoiceEmailData): string {
  return `Invoice ${data.invoiceId} — ${data.jobNumber} ${data.customerName}`;
}

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

export function renderLoadVerifiedInvoiceEmail(data: LoadVerifiedInvoiceEmailData): string {
  const lineItemRows = data.materials
    .map((m, i, arr) => {
      const isLast = i === arr.length - 1;
      const border = isLast ? '' : `border-bottom:1px solid ${COLORS.BORDER};`;
      const qty = `${esc(m.qty)}${m.unit ? ' ' + esc(m.unit) : ''}`;
      return `
        <tr>
          <td style="padding:10px 12px;${border}font-size:13px;color:${COLORS.MUTED};white-space:nowrap;vertical-align:top;line-height:1.5;">${qty}</td>
          <td style="padding:10px 12px;${border}font-size:14px;color:${COLORS.TEXT};vertical-align:top;line-height:1.5;">${esc(m.name)}</td>
          <td style="padding:10px 12px;${border}font-size:13px;color:${COLORS.TEXT};text-align:right;white-space:nowrap;vertical-align:top;line-height:1.5;">${fmtMoney(m.unitPrice)}</td>
          <td style="padding:10px 12px;${border}font-size:14px;color:${COLORS.TEXT};text-align:right;white-space:nowrap;vertical-align:top;line-height:1.5;font-weight:600;">${fmtMoney(m.linePrice)}</td>
        </tr>`;
    })
    .join('');

  const kv = renderKVTable({
    rows: [
      { label: 'Invoice', value: data.invoiceId },
      { label: 'Ticket', value: data.ticketId },
      { label: 'Job', value: `${data.jobNumber} — ${data.customerName}` },
      { label: 'Address', value: data.address },
      { label: 'Sales Rep', value: data.salesRepName || '—' },
      { label: 'Verified by', value: `${data.verifiedByName} on ${fmtVerifiedAt(data.verifiedAt)}` },
    ],
  });

  const notesBlock = data.notes
    ? `
      <tr>
        <td class="rcrs-pad" style="padding:8px 32px 0 32px;font-family:${COLORS.FONT_STACK};">
          <div style="font-size:13px;color:${COLORS.MUTED};text-transform:uppercase;letter-spacing:0.6px;font-weight:600;margin-bottom:8px;">
            Notes
          </div>
          <div style="font-size:14px;color:${COLORS.TEXT};line-height:1.6;padding:14px 16px;background-color:${COLORS.TINT};border-left:3px solid ${COLORS.ACCENT};">
            ${esc(data.notes).replace(/\r?\n/g, '<br>')}
          </div>
        </td>
      </tr>`
    : '';

  const content = `
    ${renderHeader({ title: `Invoice ${esc(data.invoiceId)}` })}

    <tr>
      <td class="rcrs-pad" style="padding:8px 32px 4px 32px;font-family:${COLORS.FONT_STACK};">
        <p style="margin:0;font-size:14px;color:${COLORS.TEXT};line-height:1.6;">
          Materials have been loaded and verified at the warehouse for the job below. Stock has been deducted; this email is the record of materials issued.
        </p>
      </td>
    </tr>

    <tr>
      <td class="rcrs-pad" style="padding:8px 32px 0 32px;">
        ${kv}
      </td>
    </tr>

    <tr>
      <td class="rcrs-pad" style="padding:16px 32px 0 32px;font-family:${COLORS.FONT_STACK};">
        <div style="font-size:13px;color:${COLORS.MUTED};text-transform:uppercase;letter-spacing:0.6px;font-weight:600;margin-bottom:8px;">
          Line Items
        </div>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;border:1px solid ${COLORS.BORDER};">
          <thead>
            <tr style="background-color:${COLORS.TINT};">
              <th align="left" style="padding:10px 12px;font-family:${COLORS.FONT_STACK};font-size:12px;color:${COLORS.MUTED};font-weight:600;text-transform:uppercase;letter-spacing:0.6px;border-bottom:1px solid ${COLORS.BORDER};">Qty</th>
              <th align="left" style="padding:10px 12px;font-family:${COLORS.FONT_STACK};font-size:12px;color:${COLORS.MUTED};font-weight:600;text-transform:uppercase;letter-spacing:0.6px;border-bottom:1px solid ${COLORS.BORDER};">Item</th>
              <th align="right" style="padding:10px 12px;font-family:${COLORS.FONT_STACK};font-size:12px;color:${COLORS.MUTED};font-weight:600;text-transform:uppercase;letter-spacing:0.6px;border-bottom:1px solid ${COLORS.BORDER};">Unit Price</th>
              <th align="right" style="padding:10px 12px;font-family:${COLORS.FONT_STACK};font-size:12px;color:${COLORS.MUTED};font-weight:600;text-transform:uppercase;letter-spacing:0.6px;border-bottom:1px solid ${COLORS.BORDER};">Line Total</th>
            </tr>
          </thead>
          <tbody>${lineItemRows}</tbody>
          <tfoot>
            <tr style="background-color:${COLORS.TINT};">
              <td colspan="3" style="padding:12px;font-family:${COLORS.FONT_STACK};font-size:13px;color:${COLORS.MUTED};text-align:right;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;border-top:2px solid ${COLORS.BORDER};">Total</td>
              <td style="padding:12px;font-family:${COLORS.FONT_STACK};font-size:16px;color:${COLORS.TEXT};text-align:right;white-space:nowrap;font-weight:700;border-top:2px solid ${COLORS.BORDER};">${fmtMoney(data.totalPrice)}</td>
            </tr>
          </tfoot>
        </table>
      </td>
    </tr>

    ${notesBlock}

    <tr>
      <td class="rcrs-pad" style="padding:16px 32px 24px 32px;font-family:${COLORS.FONT_STACK};">
        <p style="margin:0;font-size:12px;color:${COLORS.MUTED};line-height:1.6;">
          Pricing only. Material cost-side reporting is recorded separately in the office, admin, and manager reports and is not shown here.
        </p>
      </td>
    </tr>

    ${renderFooter()}
  `;

  return wrapDocument({
    preheader: `Invoice ${data.invoiceId} — ${fmtMoney(data.totalPrice)} — ${data.jobNumber} ${data.customerName}`,
    content,
  });
}
