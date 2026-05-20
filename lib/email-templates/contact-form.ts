// Contact-form lead notification email.
//
// Used by:
//   - app/api/contact/route.ts          (Website Lead direct notification)
//   - lib/form-service.ts               (Contact + Referral form funnel)
//
// Tone: brief internal lead notification. Reads like a memo from the
// receptionist: "Here's a new lead, here's how to reach them." Not a
// celebration, not a sales pitch.

import {
  esc,
  renderFooter,
  renderHeader,
  renderKVTable,
  wrapDocument,
  COLORS,
} from './shared';

export interface ContactFormEmailData {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  /** Source page on the website (e.g. "Contact Page", "Service Area: Madison"). */
  sourcePage?: string;
  /** Optional portal link to forward the lead. */
  portalUrl?: string;
  /** Optional, surfaces in the K/V block when present. */
  preferredInspector?: string;
  serviceType?: string;
}

/** Subject line for contact-form emails. Kept short and scannable. */
export function contactFormSubject(data: ContactFormEmailData): string {
  const source = (data.sourcePage || 'Website').trim();
  return `Lead — ${data.name} via ${source}`;
}

/** Render the lead notification HTML. */
export function renderContactFormEmail(data: ContactFormEmailData): string {
  const submittedAt = (() => {
    try {
      return new Date().toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return new Date().toISOString();
    }
  })();

  const kv = renderKVTable({
    rows: [
      { label: 'Name', value: data.name },
      { label: 'Phone', value: data.phone || '', link: true },
      { label: 'Email', value: data.email, link: true },
      { label: 'Subject', value: data.subject },
      { label: 'Source', value: data.sourcePage || 'Website' },
      { label: 'Preferred Inspector', value: data.preferredInspector || '' },
      { label: 'Service Type', value: data.serviceType || '' },
      { label: 'Submitted', value: submittedAt },
    ],
  });

  // Message block — preserve line breaks the customer typed.
  const messageHtml = esc(data.message).replace(/\r?\n/g, '<br>');

  const portalRow = data.portalUrl
    ? `
      <tr>
        <td class="rcrs-pad" style="padding:0 32px 24px 32px;font-family:${COLORS.FONT_STACK};">
          <div style="font-size:13px;color:${COLORS.MUTED};line-height:1.6;">
            Customer portal:&nbsp;
            <a href="${esc(data.portalUrl)}" style="color:${COLORS.ACCENT};text-decoration:none;">${esc(data.portalUrl)}</a>
          </div>
        </td>
      </tr>`
    : '';

  const content = `
    ${renderHeader({ title: 'New Lead' })}

    <tr>
      <td class="rcrs-pad" style="padding:8px 32px 4px 32px;font-family:${COLORS.FONT_STACK};">
        <p style="margin:0;font-size:14px;color:${COLORS.TEXT};line-height:1.6;">
          A new lead came in through the website. Contact details below.
        </p>
      </td>
    </tr>

    <tr>
      <td class="rcrs-pad" style="padding:8px 32px 0 32px;">
        ${kv}
      </td>
    </tr>

    <tr>
      <td class="rcrs-pad" style="padding:16px 32px 8px 32px;font-family:${COLORS.FONT_STACK};">
        <div style="font-size:13px;color:${COLORS.MUTED};text-transform:uppercase;letter-spacing:0.6px;font-weight:600;margin-bottom:8px;">
          Message
        </div>
        <div style="font-size:14px;color:${COLORS.TEXT};line-height:1.6;padding:14px 16px;background-color:${COLORS.TINT};border-left:3px solid ${COLORS.ACCENT};">
          ${messageHtml || '<em style="color:' + COLORS.MUTED + ';">(no message)</em>'}
        </div>
      </td>
    </tr>

    ${portalRow}

    <tr>
      <td class="rcrs-pad" style="padding:8px 32px 24px 32px;font-family:${COLORS.FONT_STACK};">
        <p style="margin:0;font-size:12px;color:${COLORS.MUTED};line-height:1.6;">
          Reply to this email to respond directly to the lead.
        </p>
      </td>
    </tr>

    ${renderFooter()}
  `;

  return wrapDocument({
    preheader: `${data.name} — ${data.subject}`,
    content,
  });
}
