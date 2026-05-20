// Driver-new-order email.
//
// Sent to Rick (driver) when a new material-order ticket is created in
// the portal. The email is dispatch-style: where to take it, what to
// load, any notes, and a big "Get Directions" CTA to launch Google Maps.
//
// NO cost, NO price, NO totals — driver view per lib/cost-visibility.ts.
// Rick decides what to pull from the K/V "Materials to Load" table.

import {
  esc,
  renderButton,
  renderFooter,
  renderHeader,
  renderKVTable,
  wrapDocument,
  COLORS,
} from './shared';

export interface DriverNewOrderEmailData {
  ticketId: string;
  jobNumber: string;
  customerName: string;
  address: string;
  salesRepName: string;
  materials: Array<{ name: string; qty: number; unit?: string }>;
  notes?: string;
}

/** Subject line: shows job + customer so Rick can scan inbox at a glance. */
export function driverNewOrderSubject(data: DriverNewOrderEmailData): string {
  return `New Pickup — ${data.jobNumber} ${data.customerName}`;
}

export function renderDriverNewOrderEmail(data: DriverNewOrderEmailData): string {
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(data.address)}`;

  const kv = renderKVTable({
    rows: [
      { label: 'Ticket', value: data.ticketId },
      { label: 'Job', value: `${data.jobNumber} — ${data.customerName}` },
      { label: 'Address', value: data.address },
      { label: 'Sales Rep', value: data.salesRepName || '—' },
    ],
  });

  const materialRows = data.materials
    .map((m, i, arr) => {
      const isLast = i === arr.length - 1;
      const border = isLast ? '' : `border-bottom:1px solid ${COLORS.BORDER};`;
      const qty = `${esc(m.qty)}${m.unit ? ' ' + esc(m.unit) : ''}`;
      return `
        <tr>
          <td style="padding:10px 12px;${border}font-size:14px;font-weight:600;color:${COLORS.TEXT};white-space:nowrap;vertical-align:top;width:80px;line-height:1.5;">${qty}</td>
          <td style="padding:10px 12px;${border}font-size:14px;color:${COLORS.TEXT};vertical-align:top;line-height:1.5;">${esc(m.name)}</td>
        </tr>`;
    })
    .join('');

  const notesBlock = data.notes
    ? `
      <tr>
        <td class="rcrs-pad" style="padding:16px 32px 0 32px;font-family:${COLORS.FONT_STACK};">
          <div style="font-size:13px;color:${COLORS.MUTED};text-transform:uppercase;letter-spacing:0.6px;font-weight:600;margin-bottom:8px;">
            Job Site Notes
          </div>
          <div style="font-size:14px;color:${COLORS.TEXT};line-height:1.6;padding:14px 16px;background-color:${COLORS.TINT};border-left:3px solid ${COLORS.ACCENT};">
            ${esc(data.notes).replace(/\r?\n/g, '<br>')}
          </div>
        </td>
      </tr>`
    : '';

  const content = `
    ${renderHeader({ title: 'New Material Pickup' })}

    <tr>
      <td class="rcrs-pad" style="padding:8px 32px 4px 32px;font-family:${COLORS.FONT_STACK};">
        <p style="margin:0;font-size:14px;color:${COLORS.TEXT};line-height:1.6;">
          A new material order is ready to load. Job details, address, and materials list below.
        </p>
      </td>
    </tr>

    <tr>
      <td class="rcrs-pad" style="padding:8px 32px 0 32px;">
        ${kv}
      </td>
    </tr>

    <tr>
      <td class="rcrs-pad" style="padding:12px 32px 0 32px;font-family:${COLORS.FONT_STACK};">
        ${renderButton({ text: 'Get Directions', href: directionsUrl, variant: 'primary' })}
      </td>
    </tr>

    <tr>
      <td class="rcrs-pad" style="padding:16px 32px 0 32px;font-family:${COLORS.FONT_STACK};">
        <div style="font-size:13px;color:${COLORS.MUTED};text-transform:uppercase;letter-spacing:0.6px;font-weight:600;margin-bottom:8px;">
          Materials to Load
        </div>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;border:1px solid ${COLORS.BORDER};">
          <thead>
            <tr style="background-color:${COLORS.TINT};">
              <th align="left" style="padding:10px 12px;font-family:${COLORS.FONT_STACK};font-size:12px;color:${COLORS.MUTED};font-weight:600;text-transform:uppercase;letter-spacing:0.6px;border-bottom:1px solid ${COLORS.BORDER};">Qty</th>
              <th align="left" style="padding:10px 12px;font-family:${COLORS.FONT_STACK};font-size:12px;color:${COLORS.MUTED};font-weight:600;text-transform:uppercase;letter-spacing:0.6px;border-bottom:1px solid ${COLORS.BORDER};">Item</th>
            </tr>
          </thead>
          <tbody>${materialRows}</tbody>
        </table>
      </td>
    </tr>

    ${notesBlock}

    <tr>
      <td class="rcrs-pad" style="padding:18px 32px 24px 32px;font-family:${COLORS.FONT_STACK};">
        <p style="margin:0;font-size:13px;color:${COLORS.MUTED};line-height:1.6;">
          Open the ticket in the portal to mark materials pulled and load verified. Stock deducts when the load is verified.
        </p>
      </td>
    </tr>

    ${renderFooter()}
  `;

  return wrapDocument({
    preheader: `New pickup — ${data.jobNumber} ${data.customerName} — ${data.address}`,
    content,
  });
}
