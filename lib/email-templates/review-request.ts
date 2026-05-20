// Review-request email.
//
// Customer-facing follow-up after a delivery / job-completion event. The
// goal is simple: ask the customer (warmly, briefly) to leave a Google
// review — and route any complaints back to us privately so a one-bad-day
// experience doesn't become a 1-star review.
//
// Tone: warm and brief. Mention the project address + project type so the
// email feels personal, not templated. Single big call-to-action button
// to the Google review URL. No promo, no upsell, no surveys.
//
// Per docs/research-portal-seo-design.md Part 2 — RCRS sits at 47 reviews
// vs competitors at 800+. Automating the ask at job-complete is the biggest
// SEO lever we have. Build only — actual sending stays gated by the
// ENABLE_REVIEW_REQUESTS env (see lib/email-service.ts isTemplateAllowed).
//
// PRICE/COST: this email carries no pricing data of any kind. Customer-
// safe. See feedback_purchase_price_visibility.

import {
  esc,
  renderButton,
  renderFooter,
  renderHeader,
  wrapDocument,
  COLORS,
} from './shared';

export interface ReviewRequestEmailData {
  customerName: string;
  /** Street / job address — e.g. "123 Elm St". Used in the warm opener. */
  projectAddress: string;
  /** Free-form, e.g. "new roof", "roof repair", "gutter installation". */
  projectType: string;
  /**
   * Google review URL. Caller should pass the value of
   * NEXT_PUBLIC_GOOGLE_REVIEW_URL when set. If empty/undefined the
   * template falls back to a placeholder + a `[needs-owner]` note so the
   * gap is obvious in QA. The send wrapper also refuses to fire without
   * a real URL.
   */
  googleReviewUrl?: string;
  /** Optional age (in days) since the job completed, used for copy. */
  daysSinceCompletion?: number;
}

// Placeholder used when the env var isn't set yet. Keeps the template
// renderable for tests + previews while making the gap visible.
const REVIEW_URL_PLACEHOLDER =
  'https://search.google.com/local/writereview?placeid=PLACEHOLDER_NEEDS_OWNER';

/** Subject line: short, personal, no spam triggers. */
export function reviewRequestSubject(data: ReviewRequestEmailData): string {
  const first = (data.customerName || '').trim().split(/\s+/)[0] || 'there';
  return `${first}, how did we do on your ${data.projectType || 'project'}?`;
}

export function renderReviewRequestEmail(data: ReviewRequestEmailData): string {
  const firstName = (data.customerName || '').trim().split(/\s+/)[0] || 'there';
  const projectType = (data.projectType || 'project').trim();
  const projectAddress = (data.projectAddress || '').trim();

  // Phrasing for "your new roof at 123 Elm St" — fall back gracefully if
  // either piece is missing.
  let projectPhrase: string;
  if (projectAddress && projectType) {
    projectPhrase = `your ${projectType} at ${projectAddress}`;
  } else if (projectType) {
    projectPhrase = `your ${projectType}`;
  } else if (projectAddress) {
    projectPhrase = `your project at ${projectAddress}`;
  } else {
    projectPhrase = 'your recent project';
  }

  const hasRealUrl = !!data.googleReviewUrl && data.googleReviewUrl.trim().length > 0;
  const reviewUrl = hasRealUrl ? data.googleReviewUrl! : REVIEW_URL_PLACEHOLDER;

  // QA banner when the URL hasn't been provisioned yet. Never shown when
  // a real URL is passed in.
  const needsOwnerBanner = hasRealUrl
    ? ''
    : `
      <tr>
        <td class="rcrs-pad" style="padding:8px 32px 0 32px;font-family:${COLORS.FONT_STACK};">
          <div style="font-size:12px;color:#8a6d3b;background-color:#fffbe6;border-left:3px solid #f0ad4e;padding:10px 12px;line-height:1.5;">
            [needs-owner] NEXT_PUBLIC_GOOGLE_REVIEW_URL is not set — this email
            is pointing at a placeholder. The send wrapper will refuse to
            fire until a real URL is provisioned.
          </div>
        </td>
      </tr>
    `;

  const content = `
    ${renderHeader({ title: 'Thank You' })}

    ${needsOwnerBanner}

    <tr>
      <td class="rcrs-pad" style="padding:16px 32px 4px 32px;font-family:${COLORS.FONT_STACK};">
        <p style="margin:0 0 14px 0;font-size:15px;color:${COLORS.TEXT};line-height:1.6;">
          Hi ${esc(firstName)},
        </p>
        <p style="margin:0 0 14px 0;font-size:15px;color:${COLORS.TEXT};line-height:1.6;">
          Thank you for trusting us with ${esc(projectPhrase)}. It was a pleasure working with you, and we hope everything is exactly the way you wanted it.
        </p>
        <p style="margin:0;font-size:15px;color:${COLORS.TEXT};line-height:1.6;">
          If we earned it, would you take a minute to share a quick Google review? Honest words from neighbors are the single biggest reason new homeowners trust us when a storm rolls through.
        </p>
      </td>
    </tr>

    <tr>
      <td class="rcrs-pad" align="center" style="padding:20px 32px 4px 32px;font-family:${COLORS.FONT_STACK};">
        ${renderButton({
          text: 'Leave a Google Review',
          href: reviewUrl,
          variant: 'primary',
        })}
      </td>
    </tr>

    <tr>
      <td class="rcrs-pad" style="padding:14px 32px 4px 32px;font-family:${COLORS.FONT_STACK};">
        <div style="font-size:14px;color:${COLORS.TEXT};line-height:1.6;padding:14px 16px;background-color:${COLORS.TINT};border-left:3px solid ${COLORS.ACCENT};">
          If we missed the mark on anything, please reply to this email directly — we'd love to make it right before you write a review. Your feedback goes straight to the owner.
        </div>
      </td>
    </tr>

    <tr>
      <td class="rcrs-pad" style="padding:18px 32px 24px 32px;font-family:${COLORS.FONT_STACK};">
        <p style="margin:0;font-size:14px;color:${COLORS.TEXT};line-height:1.6;">
          Thanks again,<br>
          <strong>The River City Roofing Solutions Team</strong>
        </p>
      </td>
    </tr>

    ${renderFooter()}
  `;

  return wrapDocument({
    preheader: `Thank you for ${esc(projectPhrase)} — would you share a quick Google review?`,
    content,
  });
}
