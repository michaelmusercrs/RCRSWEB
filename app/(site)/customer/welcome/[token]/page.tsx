/**
 * Customer Welcome Portal — page renderer.
 *
 * Renders tiles DYNAMICALLY based on the admin's enabledTiles + layoutOrder
 * config. Each tile only receives fields admin has whitelisted via
 * allowedRepDataFields (enforced by filterTileFields, defense in depth).
 *
 * ?preview=1 query param flags this view as admin-side preview — analytics
 * events fire with isPreview=true and are excluded from real engagement counts.
 */
import { notFound } from 'next/navigation';
import { leadPortalService } from '@/lib/lead-portal-service';
import { TEAM_MEMBERS } from '@/lib/team-roles';
import { getPublishedProfile } from '@/lib/profile-overrides-bridge';
import { getCustomerPortalConfig } from '@/lib/customer-portal-config';
import { getOrderedActiveTiles, filterTileFields, type TileKey } from '@/lib/customer-portal-tiles';
import { getHuntsvilleForecast } from '@/lib/huntsville-forecast';
import AnalyticsBeacon from '@/components/customer-portal/AnalyticsBeacon';
import {
  RepIntroTile,
  NextStepsTile,
  IkoVisualizerTile,
  ContactTile,
  PhotoGalleryTile,
  AboutRcrsTile,
  WeatherForecastTile,
} from '@/components/customer-portal/tiles';

export const dynamic = 'force-dynamic';

export default async function CustomerWelcomePage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { preview?: string };
}) {
  const lead = await leadPortalService.getLeadByToken(params.token).catch(() => null);
  if (!lead) return notFound();

  const isPreview = searchParams?.preview === '1';

  // Lookup the assigned rep + their PUBLISHED profile via bridge (never pendingDraft)
  const repSlug = lead.salesRepSlug || '';
  const member = TEAM_MEMBERS.find(m =>
    m.slug === repSlug ||
    repSlug.startsWith(m.slug + '-') ||
    repSlug === m.slug.split('-')[0]
  );
  const profile = member?.slug ? await getPublishedProfile(member.slug) : null;

  // Admin config (tile enablement + field allowlist + layout order)
  const config = getCustomerPortalConfig();
  const tileKeys = getOrderedActiveTiles();

  // Weather (only fetched if the tile is enabled)
  const forecast = tileKeys.includes('weather-forecast') ? await getHuntsvilleForecast() : null;

  // Build the full pool of rep data fields. filterTileFields() will narrow
  // down per tile to ONLY the admin-allowed subset.
  const fullRepData: Record<string, unknown> = {
    name: member?.name,
    phone: member?.phone,
    email: member?.email,
    bio: profile?.bio,
    headshotUrl: profile?.headshotUrl,
    truckPicUrl: profile?.truckPicUrl,
    certifications: profile?.certifications,
    yearsExperience: profile?.yearsExperience,
    favoriteQuote: profile?.favoriteQuote,
  };

  const customerFirstName = (lead.customerName || '').split(' ')[0] || '';

  // Tile dispatch — each registry key maps to a component.
  const renderTile = (key: TileKey) => {
    switch (key) {
      case 'rep-intro': {
        const fields = filterTileFields('rep-intro', fullRepData);
        return <RepIntroTile key={key} {...fields} />;
      }
      case 'next-steps':
        return <NextStepsTile key={key} customerFirstName={customerFirstName} />;
      case 'iko-visualizer':
        return <IkoVisualizerTile key={key} />;
      case 'contact': {
        const fields = filterTileFields('contact', fullRepData);
        return <ContactTile key={key} {...fields} />;
      }
      case 'photo-gallery':
        // TODO: pull approved photos for this lead's job. Empty state shipped today.
        return <PhotoGalleryTile key={key} photos={[]} />;
      case 'about-rcrs':
        return <AboutRcrsTile key={key} />;
      case 'weather-forecast':
        return <WeatherForecastTile key={key} forecast={forecast} disclaimer={config.weatherDisclaimer} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      {/* Hero */}
      <header className="bg-black text-white py-10 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            Welcome{customerFirstName ? `, ${customerFirstName}` : ''}.
          </h1>
          <p className="text-neutral-300 text-base sm:text-lg">
            Thanks for reaching out to River City Roofing Solutions. We're glad you got in touch.
          </p>
        </div>
      </header>

      {/* Preview banner */}
      {isPreview && (
        <div className="bg-amber-100 border-y border-amber-300 px-6 py-2 text-center text-sm text-amber-900">
          <strong>PREVIEW MODE</strong> — this view does NOT count toward real engagement analytics
        </div>
      )}

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {tileKeys.map(renderTile)}

        <footer className="text-center text-xs text-neutral-500 pt-6">
          <p>
            This page was generated for {lead.customerName || 'you'}. Bookmark it — it stays accessible for
            as long as your project is open.
          </p>
        </footer>
      </main>

      {/* Client-side analytics beacon — fires portal_view + time-on-page + clicks */}
      <AnalyticsBeacon portalToken={params.token} isPreview={isPreview} />
    </div>
  );
}
