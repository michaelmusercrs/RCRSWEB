/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from 'next/og';
import countyData from '@/data/county-landing.json';

// ---------------------------------------------------------------------------
// Dynamic per-county OG image — `app/(site)/roofing-contractor/[county]/opengraph-image.tsx`
//
// Generated at build time for each of the 5 county slugs (madison, morgan,
// marshall, limestone, cullman). Headline is "<County> County" with the
// subtitle "Roofing Contractor".
//
// System fonts only. Brand color `#0066CC` matches the rest of the site.
// Per memory rules: company name is exactly "River City Roofing Solutions".
// ---------------------------------------------------------------------------

export const runtime = 'edge';
export const alt = 'River City Roofing Solutions — county service area';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const ACCENT = '#0066CC';
const BG = '#0b1220';
const FG = '#ffffff';
const MUTED = '#9ca3af';

type CountyKey = keyof typeof countyData;
type CountyRecord = { name: string; seat: string };

export async function generateImageMetadata({
  params,
}: {
  params: { county: string };
}) {
  return [{ id: params.county, alt: `Roofing Contractor in ${params.county} County, AL`, contentType, size }];
}

function getCounty(slug: string): CountyRecord | null {
  if (!(slug in countyData)) return null;
  return (countyData as Record<string, CountyRecord>)[slug];
}

export default async function CountyOpengraphImage({
  params,
}: {
  params: { county: string };
}) {
  const data = getCounty(params.county);
  const countyName = data?.name ?? params.county;
  const seat = data?.seat ?? '';

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
            North Alabama Service Area
          </div>

          {/* County name */}
          <div
            style={{
              fontSize: 110,
              fontWeight: 900,
              lineHeight: 1.0,
              letterSpacing: -3,
              marginBottom: 16,
              display: 'flex',
            }}
          >
            {countyName} County
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 44,
              color: '#e5e7eb',
              fontWeight: 600,
              marginBottom: 28,
              display: 'flex',
            }}
          >
            Roofing Contractor
          </div>

          {/* Brand line */}
          <div
            style={{
              fontSize: 28,
              color: MUTED,
              fontWeight: 500,
              display: 'flex',
            }}
          >
            River City Roofing Solutions
            {seat ? ` · Serving ${seat} & surrounding cities` : ''}
          </div>

          {/* Phone */}
          <div
            style={{
              fontSize: 26,
              color: MUTED,
              fontWeight: 500,
              marginTop: 8,
              display: 'flex',
            }}
          >
            (256) 274-8530 · IKO ROOFPRO Craftsman Premier
          </div>
        </div>

        <div style={{ width: '100%', height: 8, background: ACCENT }} />
      </div>
    ),
    { ...size },
  );
}
