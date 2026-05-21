/**
 * Social Media Publish Service (stub)
 *
 * Added 2026-05-20 during the social-blog revival audit. The repo previously
 * had NO real social-posting integration — `lib/socialAds.ts` was static ad
 * copy data, not an API client. This module is the single seam through which
 * future social posts (Facebook Page, Instagram, LinkedIn, X) will flow.
 *
 * Today every method short-circuits and returns `skipped: true` with a clear
 * reason so callers can light up the pipeline without false-success behavior.
 * To enable a platform, set the relevant env vars (documented per-method) and
 * replace the body of the `publishX` function with a real fetch() to the
 * platform's Graph / API endpoint.
 *
 * IMPORTANT: per project rule [[feedback_never_invent_brand_data]], no method
 * here is allowed to auto-generate post copy. Callers MUST pass real text
 * (e.g. the blog excerpt, an approved campaign string). Never have a model
 * fabricate claims on behalf of RCRS.
 */

export interface SocialPostInput {
  /** The text body of the post. Caller is responsible for content. */
  text: string;
  /** Optional image URL to attach. */
  imageUrl?: string;
  /** Optional link to attach (e.g. canonical blog URL). */
  link?: string;
  /** Optional tag for audit logs ("blog:roof-myths", "campaign:storm-prep"). */
  source?: string;
}

export interface SocialPostResult {
  platform: 'facebook' | 'instagram' | 'linkedin' | 'x';
  ok: boolean;
  /** True when the post was intentionally skipped (e.g. creds missing). */
  skipped?: boolean;
  /** Platform-side post ID when ok=true. */
  postId?: string;
  /** Reason for skip or failure. */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Facebook Page
// ---------------------------------------------------------------------------
// To enable:
//   1. Create a Meta Business App, add the Facebook Login product.
//   2. Get a long-lived Page Access Token for the RCRS Facebook Page.
//      Docs: https://developers.facebook.com/docs/pages/access-tokens
//   3. Set env vars on Vercel:
//        FB_PAGE_ID            = the numeric ID of the RCRS page
//        FB_PAGE_ACCESS_TOKEN  = the long-lived page token
//   4. Replace the body of publishFacebook below with a POST to
//      https://graph.facebook.com/v19.0/{FB_PAGE_ID}/feed (text post) or
//      /{FB_PAGE_ID}/photos (image post).
//
// Token expiry: long-lived page tokens last ~60 days. Refresh via the Graph
// API debug_token endpoint and rotate the env var.
export async function publishFacebook(input: SocialPostInput): Promise<SocialPostResult> {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) {
    return {
      platform: 'facebook',
      ok: false,
      skipped: true,
      reason: 'FB_PAGE_ID and/or FB_PAGE_ACCESS_TOKEN not set. See lib/social-publish.ts.',
    };
  }
  // Intentionally not implemented — see header comment.
  void input;
  return {
    platform: 'facebook',
    ok: false,
    skipped: true,
    reason: 'Facebook publish stub: implementation pending owner sign-off.',
  };
}

// ---------------------------------------------------------------------------
// Instagram (Business / Creator account, via Graph API)
// ---------------------------------------------------------------------------
// To enable:
//   1. Convert the RCRS Instagram to a Business account and link it to the
//      RCRS Facebook Page.
//   2. Get the IG Business Account ID and a long-lived page token (same token
//      as FB Page in most cases, with `instagram_basic`+`instagram_content_publish`).
//   3. Set:
//        IG_BUSINESS_ACCOUNT_ID = the IG account's id (NOT the @handle)
//        IG_ACCESS_TOKEN        = long-lived token (often the FB page token)
//   4. Instagram requires image-URL-first; you POST /{ig-id}/media to create
//      a container, then POST /{ig-id}/media_publish to publish it.
//      Docs: https://developers.facebook.com/docs/instagram-api/guides/content-publishing
export async function publishInstagram(input: SocialPostInput): Promise<SocialPostResult> {
  const igId = process.env.IG_BUSINESS_ACCOUNT_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  if (!igId || !token) {
    return {
      platform: 'instagram',
      ok: false,
      skipped: true,
      reason: 'IG_BUSINESS_ACCOUNT_ID and/or IG_ACCESS_TOKEN not set.',
    };
  }
  if (!input.imageUrl) {
    return {
      platform: 'instagram',
      ok: false,
      skipped: true,
      reason: 'Instagram posts require imageUrl (Graph API does not accept text-only).',
    };
  }
  return {
    platform: 'instagram',
    ok: false,
    skipped: true,
    reason: 'Instagram publish stub: implementation pending owner sign-off.',
  };
}

// ---------------------------------------------------------------------------
// LinkedIn Company Page
// ---------------------------------------------------------------------------
// To enable:
//   1. Create a LinkedIn Developer App with the Share on LinkedIn / Marketing
//      Developer Platform products and have it associated with the RCRS
//      LinkedIn Company Page.
//   2. Complete the OAuth flow once to obtain a token with `w_organization_social`.
//   3. Set:
//        LINKEDIN_ORG_URN  = "urn:li:organization:<numeric_org_id>"
//        LINKEDIN_TOKEN    = the OAuth access token
//   4. POST to https://api.linkedin.com/v2/ugcPosts with
//      `author: LINKEDIN_ORG_URN`. Docs: https://learn.microsoft.com/linkedin/marketing/integrations/community-management/shares/ugc-post-api
//
// Token expiry: LinkedIn tokens are typically 60 days, refresh via OAuth.
export async function publishLinkedIn(input: SocialPostInput): Promise<SocialPostResult> {
  const orgUrn = process.env.LINKEDIN_ORG_URN;
  const token = process.env.LINKEDIN_TOKEN;
  if (!orgUrn || !token) {
    return {
      platform: 'linkedin',
      ok: false,
      skipped: true,
      reason: 'LINKEDIN_ORG_URN and/or LINKEDIN_TOKEN not set.',
    };
  }
  void input;
  return {
    platform: 'linkedin',
    ok: false,
    skipped: true,
    reason: 'LinkedIn publish stub: implementation pending owner sign-off.',
  };
}

// ---------------------------------------------------------------------------
// X (Twitter) — note: as of 2026 the free tier no longer allows posting.
// ---------------------------------------------------------------------------
// To enable:
//   1. Apply for a paid X API tier (Basic min for posting).
//   2. Create app credentials with OAuth 2.0 + write scope.
//   3. Set:
//        X_BEARER_TOKEN  = OAuth2 user context bearer
//   4. POST to https://api.twitter.com/2/tweets with {"text": "..."}.
//      Docs: https://docs.x.com/x-api/posts/post-a-post
//
// Recommendation (per [[feedback_default_free_open_source]]): skip X entirely
// unless owner wants to pay for it. FB+IG cover more local reach in Hartselle.
export async function publishX(input: SocialPostInput): Promise<SocialPostResult> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    return {
      platform: 'x',
      ok: false,
      skipped: true,
      reason: 'X_BEARER_TOKEN not set. X (Twitter) API now requires a paid tier.',
    };
  }
  void input;
  return {
    platform: 'x',
    ok: false,
    skipped: true,
    reason: 'X publish stub: implementation pending owner sign-off + paid API tier.',
  };
}

// ---------------------------------------------------------------------------
// Fan-out helper
// ---------------------------------------------------------------------------
/**
 * Publish to every wired-up platform. Each platform call is independently
 * caught so one provider's failure does not block others.
 *
 * Usage (e.g. inside the publish-blog cron):
 *   const results = await publishToAllSocial({
 *     text: `New on the RCRS blog: ${post.title}\n${siteUrl}/blog/${post.slug}`,
 *     imageUrl: `${siteUrl}${post.image}`,
 *     link: `${siteUrl}/blog/${post.slug}`,
 *     source: `blog:${post.slug}`,
 *   });
 */
export async function publishToAllSocial(input: SocialPostInput): Promise<SocialPostResult[]> {
  const safeCall = async (fn: () => Promise<SocialPostResult>): Promise<SocialPostResult> => {
    try {
      return await fn();
    } catch (err) {
      // Caller has no way to know which platform threw without a label,
      // so each wrapper below tags the platform itself in the catch.
      throw err;
    }
  };

  const platforms: Array<{ name: SocialPostResult['platform']; fn: () => Promise<SocialPostResult> }> = [
    { name: 'facebook', fn: () => publishFacebook(input) },
    { name: 'instagram', fn: () => publishInstagram(input) },
    { name: 'linkedin', fn: () => publishLinkedIn(input) },
    { name: 'x', fn: () => publishX(input) },
  ];

  const results: SocialPostResult[] = [];
  for (const p of platforms) {
    try {
      results.push(await safeCall(p.fn));
    } catch (err) {
      results.push({
        platform: p.name,
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}

/**
 * Returns a per-platform readiness map — useful for surfacing in an admin
 * dashboard so the owner can see at a glance which platforms still need
 * credentials.
 */
export function getSocialPlatformStatus(): Record<SocialPostResult['platform'], { configured: boolean; missingEnv: string[] }> {
  return {
    facebook: {
      configured: Boolean(process.env.FB_PAGE_ID && process.env.FB_PAGE_ACCESS_TOKEN),
      missingEnv: [
        !process.env.FB_PAGE_ID && 'FB_PAGE_ID',
        !process.env.FB_PAGE_ACCESS_TOKEN && 'FB_PAGE_ACCESS_TOKEN',
      ].filter(Boolean) as string[],
    },
    instagram: {
      configured: Boolean(process.env.IG_BUSINESS_ACCOUNT_ID && process.env.IG_ACCESS_TOKEN),
      missingEnv: [
        !process.env.IG_BUSINESS_ACCOUNT_ID && 'IG_BUSINESS_ACCOUNT_ID',
        !process.env.IG_ACCESS_TOKEN && 'IG_ACCESS_TOKEN',
      ].filter(Boolean) as string[],
    },
    linkedin: {
      configured: Boolean(process.env.LINKEDIN_ORG_URN && process.env.LINKEDIN_TOKEN),
      missingEnv: [
        !process.env.LINKEDIN_ORG_URN && 'LINKEDIN_ORG_URN',
        !process.env.LINKEDIN_TOKEN && 'LINKEDIN_TOKEN',
      ].filter(Boolean) as string[],
    },
    x: {
      configured: Boolean(process.env.X_BEARER_TOKEN),
      missingEnv: [!process.env.X_BEARER_TOKEN && 'X_BEARER_TOKEN'].filter(Boolean) as string[],
    },
  };
}
