/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from 'next/og';
import { getService, getAllServiceSlugs } from '@/lib/servicesData';

// ---------------------------------------------------------------------------
// Dynamic per-service OG image — `app/(site)/services/[slug]/opengraph-image.tsx`
//
// Generated at build time for every service slug returned by
// `generateImageMetadata`. The headline = service title; brand chrome matches
// the site-wide template.
//
// System fonts only (no remote font fetches; Vercel build is font-less).
// Per memory rules: never write "& Solar"; IKO ROOFPRO listed first when
// certifications appear.
// ---------------------------------------------------------------------------

export const runtime = 'edge';
export const alt = 'River City Roofing Solutions — service detail';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const ACCENT = '#0066CC';
const BG = '#0b1220';
const FG = '#ffffff';
const MUTED = '#9ca3af';

// Pre-generate the static set of service slugs so each gets its own image.
export async function generateImageMetadata({
  params,
}: {
  params: { slug: string };
}) {
  return [{ id: params.slug, alt: `River City Roofing Solutions — ${params.slug}`, contentType, size }];
}

export default async function ServiceOpengraphImage({
  params,
}: {
  params: { slug: string };
}) {
  const service = getService(params.slug);
  const title = service?.title ?? 'Professional Roofing Services';

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
        }}
      >
        <div style={{ width: '100%', height: 16, background: ACCENT }} />

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '60px 80px',
          }}
        >
          {/* Section label */}
          <div
            style={{
              fontSize: 26,
              color: ACCENT,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginBottom: 20,
              display: 'flex',
            }}
          >
            Roofing Service
          </div>

          {/* Service headline */}
          <div
            style={{
              fontSize: 78,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              marginBottom: 32,
              display: 'flex',
              flexWrap: 'wrap',
            }}
          >
            {title}
          </div>

          {/* Brand line */}
          <div
            style={{
              fontSize: 32,
              color: '#e5e7eb',
              fontWeight: 600,
              marginBottom: 12,
              display: 'flex',
            }}
          >
            River City Roofing Solutions
          </div>

          {/* Sub line */}
          <div
            style={{
              fontSize: 28,
              color: MUTED,
              fontWeight: 500,
              display: 'flex',
            }}
          >
            IKO ROOFPRO Craftsman Premier · (256) 274-8530
          </div>
        </div>

        <div style={{ width: '100%', height: 8, background: ACCENT }} />
      </div>
    ),
    { ...size },
  );
}
