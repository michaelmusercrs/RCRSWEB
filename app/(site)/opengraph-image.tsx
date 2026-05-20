/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from 'next/og';

// ---------------------------------------------------------------------------
// Site-wide Open Graph image — `app/(site)/opengraph-image.tsx`
//
// Auto-discovered by Next.js. Rendered at build time to a 1200x630 PNG that
// every page under the `(site)` route group will use as its default OG image,
// unless the route segment provides its own `opengraph-image.tsx` override.
//
// Constraints:
//   - System fonts only. No remote font fetch (Vercel build has no font
//     installs, and `next/og` requires fonts to be either system fonts or
//     embedded via `fonts: []`). Skipping `fonts` makes ImageResponse fall
//     back to its built-in sans-serif which renders consistently.
//   - Brand color is #0066CC (matches `lib/email-templates/shared.ts` and the
//     site button accents).
//   - Per `feedback_never_invent_brand_data`: the company name is
//     "River City Roofing Solutions" — no "& Solar". Certifications list
//     IKO ROOFPRO Craftsman Premier first.
// ---------------------------------------------------------------------------

export const runtime = 'edge';
export const alt = 'River City Roofing Solutions — IKO ROOFPRO Craftsman Premier — North Alabama';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const ACCENT = '#0066CC';
const BG = '#0b1220';
const FG = '#ffffff';
const MUTED = '#9ca3af';

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: BG,
          color: FG,
          position: 'relative',
        }}
      >
        {/* Accent stripe — matches the 2px top stripe in email templates. */}
        <div
          style={{
            width: '100%',
            height: 16,
            background: ACCENT,
          }}
        />

        {/* Main content area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '60px 80px',
          }}
        >
          {/* Brand label */}
          <div
            style={{
              fontSize: 28,
              color: ACCENT,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginBottom: 24,
              display: 'flex',
            }}
          >
            RCRS · est. 2010
          </div>

          {/* Wordmark */}
          <div
            style={{
              fontSize: 88,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              marginBottom: 28,
              display: 'flex',
              flexWrap: 'wrap',
            }}
          >
            River City Roofing Solutions
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 34,
              color: '#e5e7eb',
              fontWeight: 500,
              marginBottom: 16,
              display: 'flex',
            }}
          >
            IKO ROOFPRO Craftsman Premier — North Alabama
          </div>

          {/* Phone */}
          <div
            style={{
              fontSize: 30,
              color: MUTED,
              fontWeight: 500,
              display: 'flex',
            }}
          >
            (256) 274-8530 · rivercityroofingsolutions.com
          </div>
        </div>

        {/* Bottom accent stripe */}
        <div
          style={{
            width: '100%',
            height: 8,
            background: ACCENT,
          }}
        />
      </div>
    ),
    {
      ...size,
    },
  );
}
