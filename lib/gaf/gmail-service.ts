/**
 * Minimal Gmail reader for the GAF ingest pipeline.
 *
 * Reads the rcrs@ mailbox using the SAME Google service account the rest of
 * the portal already uses for Sheets (GOOGLE_SERVICE_ACCOUNT_EMAIL /
 * GOOGLE_PRIVATE_KEY), via DOMAIN-WIDE DELEGATION — the JWT impersonates the
 * mailbox (`subject`) with the read-only Gmail scope. No new npm dependency:
 * we mint an access token with google-auth-library and call the Gmail REST API
 * with fetch.
 *
 * ONE-TIME SETUP (Workspace super-admin) — see docs/gaf-quickmeasure-setup.md:
 *   Admin console → Security → API controls → Domain-wide delegation → add the
 *   service account's client ID with scope
 *   https://www.googleapis.com/auth/gmail.readonly
 *
 * Env:
 *   GAF_INGEST_MAILBOX  - mailbox to read (default rcrs@rivercityroofingsolutions.com)
 */

import { JWT } from 'google-auth-library';

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

export function ingestMailbox(): string {
  return process.env.GAF_INGEST_MAILBOX || 'rcrs@rivercityroofingsolutions.com';
}

export function gmailConfigured(): boolean {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
}

async function accessToken(mailbox: string): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) throw new Error('Google service-account env not configured');
  const jwt = new JWT({
    email,
    key: key.replace(/\\n/g, '\n'),
    scopes: [GMAIL_SCOPE],
    subject: mailbox, // domain-wide delegation: act as the mailbox
  });
  const { access_token } = await jwt.authorize();
  if (!access_token) throw new Error('Failed to mint Gmail access token (check domain-wide delegation)');
  return access_token;
}

async function gapi<T>(mailbox: string, path: string): Promise<T> {
  const token = await accessToken(mailbox);
  const url = `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(mailbox)}/${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gmail API ${res.status} on ${path}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export interface GmailAttachmentMeta {
  filename: string;
  mimeType: string;
  attachmentId: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  date: string;
  /** Decoded text body (plain preferred, else html stripped-ish). */
  bodyText: string;
  attachments: GmailAttachmentMeta[];
}

interface RawPart {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: RawPart[];
}
interface RawMessage {
  id: string;
  threadId: string;
  payload?: RawPart;
}

/** base64url → utf8 string. */
function decodeBody(data?: string): string {
  if (!data) return '';
  try {
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch {
    return '';
  }
}

/** base64url → standard base64 (for forwarding attachment bytes to JN). */
export function toStandardBase64(b64url: string): string {
  return b64url.replace(/-/g, '+').replace(/_/g, '/');
}

function walk(part: RawPart | undefined, out: { text: string[]; html: string[]; atts: GmailAttachmentMeta[] }): void {
  if (!part) return;
  const mime = part.mimeType || '';
  if (part.filename && part.body?.attachmentId) {
    out.atts.push({ filename: part.filename, mimeType: mime, attachmentId: part.body.attachmentId });
  } else if (mime === 'text/plain') {
    out.text.push(decodeBody(part.body?.data));
  } else if (mime === 'text/html') {
    out.html.push(decodeBody(part.body?.data));
  }
  for (const p of part.parts || []) walk(p, out);
}

function headerVal(part: RawPart | undefined, name: string): string {
  const h = part?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

/** List message IDs matching a Gmail search query. */
export async function listMessageIds(query: string, maxResults = 40): Promise<string[]> {
  const mailbox = ingestMailbox();
  const data = await gapi<{ messages?: { id: string }[] }>(
    mailbox,
    `messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
  );
  return (data.messages || []).map(m => m.id);
}

/** Fetch + parse one message (headers, body text, attachment metadata). */
export async function getMessage(id: string): Promise<GmailMessage> {
  const mailbox = ingestMailbox();
  const raw = await gapi<RawMessage>(mailbox, `messages/${id}?format=full`);
  const acc = { text: [] as string[], html: [] as string[], atts: [] as GmailAttachmentMeta[] };
  walk(raw.payload, acc);
  const bodyText = acc.text.join('\n') || acc.html.join('\n').replace(/<[^>]+>/g, ' ');
  const toRaw = headerVal(raw.payload, 'To');
  const to = toRaw.split(',').map(s => {
    const m = s.match(/<([^>]+)>/);
    return (m ? m[1] : s).trim();
  }).filter(Boolean);
  return {
    id: raw.id,
    threadId: raw.threadId,
    subject: headerVal(raw.payload, 'Subject'),
    from: headerVal(raw.payload, 'From'),
    to,
    date: headerVal(raw.payload, 'Date'),
    bodyText,
    attachments: acc.atts,
  };
}

/** Download one attachment's bytes as standard base64. */
export async function getAttachmentBase64(messageId: string, attachmentId: string): Promise<string> {
  const mailbox = ingestMailbox();
  const data = await gapi<{ data?: string; size?: number }>(
    mailbox,
    `messages/${messageId}/attachments/${attachmentId}`,
  );
  return toStandardBase64(data.data || '');
}
