// Shared email template building blocks.
//
// Designed to read like a real construction-office email — not a startup
// product launch and not the previous "black band + neon green wordmark"
// look that the owner flagged as obviously AI-generated.
//
// Style rules:
//   - No big colored header band. A thin 2px top accent stripe is the only
//     branded chrome; everything else is restrained dark gray text on
//     white.
//   - Single accent color: #0066CC (the existing "Get Directions" blue).
//     Never #39FF14.
//   - Email-safe inline CSS only. Tables for structure. No flex/grid, no
//     web fonts.
//   - Generous whitespace (24px+) and 1.5 line-height.
//   - Mobile-friendly via a single @media query at <600px.
//
// Used by:
//   - lib/email-templates/contact-form.ts
//   - lib/email-templates/load-verified-invoice.ts
//   - lib/email-templates/driver-new-order.ts

// --- Brand / layout constants ------------------------------------------------

export const BRAND = {
  name: 'River City Roofing Solutions',
  phone: '(256) 274-8530',
  phoneTel: '+12562748530',
  email: 'rcrs@rivercityroofingsolutions.com',
  website: 'www.rivercityroofingsolutions.com',
  address: 'North Alabama',
} as const;

// Single accent. Reused everywhere.
export const ACCENT = '#0066CC';
// Borders / hairlines.
const BORDER = '#e3e6ea';
// Body text (dark slate, not pure black — easier on the eyes).
const TEXT = '#1f2937';
// Muted text for secondary content (meta lines, footer).
const MUTED = '#6b7280';
// Subtle background tint for table header rows / callouts.
const TINT = '#f6f8fb';

// Email-safe font stack. No web fonts — they don't load reliably in
// Outlook desktop or Gmail clients.
const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

// --- Helpers ---------------------------------------------------------------

/**
 * Minimal HTML escape for user-supplied strings. Email clients ignore
 * `&apos;` in some contexts, so we use the numeric entity for single quotes.
 */
export function esc(input: unknown): string {
  if (input === null || input === undefined) return '';
  const s = String(input);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- Building blocks ------------------------------------------------------

export interface HeaderOptions {
  /** Optional title shown below the wordmark (e.g. "Invoice"). */
  title?: string;
  /** Override the accent stripe color. Defaults to ACCENT. */
  accent?: string;
}

/**
 * Restrained text-only header. A 2px accent stripe across the top, then
 * the company wordmark in dark gray, then an optional document title.
 * No background fills, no images, no neon.
 */
export function renderHeader(options: HeaderOptions = {}): string {
  const accent = options.accent || ACCENT;
  const title = options.title ? esc(options.title) : '';

  return `
    <tr>
      <td style="padding:0;line-height:0;font-size:0;background-color:${accent};height:2px;">&nbsp;</td>
    </tr>
    <tr>
      <td style="padding:28px 32px 8px 32px;font-family:${FONT_STACK};">
        <div style="font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:${MUTED};font-weight:600;">
          ${esc(BRAND.name)}
        </div>
        ${title ? `<div style="margin-top:6px;font-size:20px;color:${TEXT};font-weight:600;letter-spacing:-0.2px;">${title}</div>` : ''}
      </td>
    </tr>
  `;
}

export interface FooterOptions {
  phone?: string;
  address?: string;
  email?: string;
}

/**
 * Small business footer — phone, email, address. No social icons, no
 * unsubscribe link (these are transactional / internal templates).
 */
export function renderFooter(options: FooterOptions = {}): string {
  const phone = esc(options.phone || BRAND.phone);
  const email = esc(options.email || BRAND.email);
  const address = esc(options.address || BRAND.address);
  const telHref = (options.phone || BRAND.phone).replace(/[^+\d]/g, '');

  return `
    <tr>
      <td style="padding:24px 32px 28px 32px;border-top:1px solid ${BORDER};font-family:${FONT_STACK};">
        <div style="font-size:13px;color:${TEXT};line-height:1.6;">
          <strong style="color:${TEXT};">${esc(BRAND.name)}</strong><br>
          <span style="color:${MUTED};">${address}</span>
        </div>
        <div style="margin-top:10px;font-size:13px;color:${MUTED};line-height:1.6;">
          <a href="tel:${esc(telHref)}" style="color:${ACCENT};text-decoration:none;">${phone}</a>
          &nbsp;&middot;&nbsp;
          <a href="mailto:${email}" style="color:${ACCENT};text-decoration:none;">${email}</a>
        </div>
      </td>
    </tr>
  `;
}

export interface ButtonOptions {
  text: string;
  href: string;
  /** 'primary' = filled accent. 'secondary' = outlined. Defaults to primary. */
  variant?: 'primary' | 'secondary';
}

/**
 * Bulletproof email button (table-based so Outlook renders it correctly).
 */
export function renderButton(options: ButtonOptions): string {
  const text = esc(options.text);
  const href = esc(options.href);
  const variant = options.variant || 'primary';
  const isPrimary = variant === 'primary';

  const bg = isPrimary ? ACCENT : '#ffffff';
  const color = isPrimary ? '#ffffff' : ACCENT;
  const border = isPrimary ? ACCENT : ACCENT;

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0;">
      <tr>
        <td style="border-radius:4px;background-color:${bg};">
          <a href="${href}"
             style="display:inline-block;padding:12px 28px;font-family:${FONT_STACK};font-size:15px;font-weight:600;color:${color};text-decoration:none;border:1px solid ${border};border-radius:4px;line-height:1.2;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `;
}

export interface KVRow {
  label: string;
  value: string;
  /** When true, render the value as a clickable href (mailto/tel auto-detected). */
  link?: boolean;
}

export interface KVTableOptions {
  rows: KVRow[];
}

/**
 * Clean key/value reference table — for the "Job / Address / Sales Rep"
 * style block you see on every dispatch/invoice email. Generous padding,
 * thin row separator.
 */
export function renderKVTable(options: KVTableOptions): string {
  const rows = options.rows
    .filter((r) => r.value !== undefined && r.value !== null && String(r.value).length > 0)
    .map((r, i, arr) => {
      const isLast = i === arr.length - 1;
      const border = isLast ? '' : `border-bottom:1px solid ${BORDER};`;
      const label = esc(r.label);
      let valueHtml = esc(r.value);
      if (r.link) {
        const raw = String(r.value);
        if (raw.includes('@')) {
          valueHtml = `<a href="mailto:${esc(raw)}" style="color:${ACCENT};text-decoration:none;">${valueHtml}</a>`;
        } else if (/^[+\d\s().-]+$/.test(raw)) {
          const telHref = raw.replace(/[^+\d]/g, '');
          valueHtml = `<a href="tel:${esc(telHref)}" style="color:${ACCENT};text-decoration:none;">${valueHtml}</a>`;
        }
      }
      return `
        <tr>
          <td style="padding:10px 0;${border}width:38%;vertical-align:top;font-size:13px;color:${MUTED};font-family:${FONT_STACK};line-height:1.5;">${label}</td>
          <td style="padding:10px 0;${border}vertical-align:top;font-size:14px;color:${TEXT};font-family:${FONT_STACK};line-height:1.5;">${valueHtml}</td>
        </tr>`;
    })
    .join('');

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;margin:8px 0;">
      ${rows}
    </table>
  `;
}

export interface WrapDocumentOptions {
  /** Preview text shown by Gmail / Outlook in the inbox list. */
  preheader?: string;
  /** Inner content rows (table rows). */
  content: string;
}

/**
 * Full HTML document scaffold. Centered 600px max-width container on a
 * neutral page background, white inner content card, conservative inline
 * CSS. Mobile breakpoint stacks at <600px.
 */
export function wrapDocument(options: WrapDocumentOptions): string {
  const preheader = options.preheader ? esc(options.preheader) : '';
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>${esc(BRAND.name)}</title>
  <style>
    /* Reset */
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { border:0; height:auto; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    body { margin:0; padding:0; width:100% !important; height:100% !important; }
    a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; }
    /* Mobile */
    @media only screen and (max-width:600px) {
      .rcrs-container { width:100% !important; max-width:100% !important; }
      .rcrs-pad { padding-left:20px !important; padding-right:20px !important; }
      .rcrs-stack { display:block !important; width:100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:${FONT_STACK};color:${TEXT};">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f3f4f6;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ''}
  <center style="width:100%;background-color:#f3f4f6;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600"
           class="rcrs-container"
           style="margin:0 auto;max-width:600px;background-color:#ffffff;border:1px solid ${BORDER};">
      ${options.content}
    </table>
  </center>
</body>
</html>`;
}

// Re-export internal palette constants for templates that need to match
// the body text / muted color exactly.
export const COLORS = {
  ACCENT,
  TEXT,
  MUTED,
  BORDER,
  TINT,
  FONT_STACK,
} as const;
