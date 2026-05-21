/**
 * Customer Portal tile components — one component per registry entry.
 *
 * IMPORTANT: each component accepts ALREADY-FILTERED props. The page
 * layer calls `filterTileFields(tileKey, fullData)` before passing data
 * in, so a tile literally cannot render a field admin hasn't allowed.
 * Defense in depth — the tile component itself can't bypass the filter.
 *
 * NO internal data fields are ever passed through. NO score/quality data.
 * NO factor breakdowns. NO email tracking labels.
 */

import Link from 'next/link';

// Shared card frame
export function TileCard({
  children,
  className = '',
  'data-tile': dataTile,
}: {
  children: React.ReactNode;
  className?: string;
  'data-tile'?: string;
}) {
  return (
    <section
      data-tile={dataTile}
      className={`bg-white rounded-2xl shadow-md border border-neutral-200 p-6 sm:p-8 ${className}`}
    >
      {children}
    </section>
  );
}

// ─── REP INTRO ────────────────────────────────────────────────────────────────

export interface RepIntroTileProps {
  name?: string;
  phone?: string;
  bio?: string;
  headshotUrl?: string;
  truckPicUrl?: string;
  certifications?: string;
  yearsExperience?: string;
  favoriteQuote?: string;
}

export function RepIntroTile(props: RepIntroTileProps) {
  if (!props.name) return null;
  const certs = props.certifications
    ? props.certifications.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const initials = props.name.split(' ').map(p => p[0]).slice(0, 2).join('');
  const firstName = props.name.split(' ')[0];
  return (
    <TileCard data-tile="rep-intro">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1.5 h-7 rounded-full bg-emerald-500" />
        <h2 className="text-xl font-bold text-neutral-900">Meet your roofing specialist</h2>
      </div>
      <div className="flex flex-col sm:flex-row items-start gap-6">
        {props.headshotUrl ? (
          <img
            src={props.headshotUrl}
            alt={props.name}
            className="w-32 h-32 rounded-2xl object-cover border-2 border-neutral-100"
          />
        ) : (
          <div className="w-32 h-32 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 text-sm">
            {initials}
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-neutral-900">{props.name}</h3>
          {props.yearsExperience && (
            <p className="text-sm text-neutral-500 mt-0.5">{props.yearsExperience} in roofing</p>
          )}
          {props.bio && <p className="text-neutral-700 mt-3 leading-relaxed">{props.bio}</p>}
          {certs.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {certs.map((c, i) => (
                <span
                  key={i}
                  className="inline-block text-xs px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
          {props.favoriteQuote && (
            <blockquote className="mt-3 text-neutral-600 italic text-sm border-l-2 border-emerald-500 pl-3">
              "{props.favoriteQuote}"
            </blockquote>
          )}
          {props.phone && (
            <div className="mt-4">
              <a
                href={`tel:${props.phone}`}
                data-track="call_clicked"
                className="inline-block px-4 py-2 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors text-sm"
              >
                Call {firstName}: {props.phone}
              </a>
            </div>
          )}
        </div>
      </div>
      {props.truckPicUrl && (
        <div className="mt-6">
          <p className="text-sm text-neutral-500 mb-2">Look for this truck:</p>
          <img
            src={props.truckPicUrl}
            alt={`${props.name}'s truck`}
            className="rounded-xl border border-neutral-200 max-h-48 object-cover"
          />
        </div>
      )}
    </TileCard>
  );
}

// ─── NEXT STEPS ──────────────────────────────────────────────────────────────

export function NextStepsTile({ customerFirstName }: { customerFirstName?: string }) {
  return (
    <section data-tile="next-steps" className="bg-emerald-50 rounded-2xl border border-emerald-200 p-6 sm:p-8">
      <h2 className="text-xl font-bold text-neutral-900 mb-3">What happens next</h2>
      <p className="text-neutral-700 leading-relaxed">
        Your assigned roofing specialist will be in touch shortly to schedule a free inspection
        {customerFirstName ? `, ${customerFirstName}` : ''}. In the meantime, feel free to explore the IKO roof
        visualizer below to see what your home could look like with a new roof.
      </p>
    </section>
  );
}

// ─── IKO VISUALIZER ──────────────────────────────────────────────────────────

export function IkoVisualizerTile() {
  return (
    <TileCard data-tile="iko-visualizer">
      <h2 className="text-xl font-bold text-neutral-900 mb-3">See what your roof could look like</h2>
      <p className="text-neutral-700 mb-4">
        IKO offers a free roof visualizer where you can upload a photo of your home and try different
        shingle colors and styles. It's a great way to start thinking about your next roof.
      </p>
      <a
        href="https://www.iko.com/roof-visualizer"
        target="_blank"
        rel="noopener noreferrer"
        data-track="iko_clickthrough"
        className="inline-block px-6 py-3 rounded-xl bg-black text-white font-medium hover:bg-neutral-800 transition-colors"
      >
        Open IKO Roof Visualizer →
      </a>
    </TileCard>
  );
}

// ─── CONTACT ─────────────────────────────────────────────────────────────────

export function ContactTile({ name, phone }: { name?: string; phone?: string }) {
  if (!phone) return null;
  const cleanPhone = phone.replace(/\D/g, '');
  return (
    <TileCard data-tile="contact">
      <h2 className="text-xl font-bold text-neutral-900 mb-3">Get in touch with {name || 'your rep'}</h2>
      <p className="text-neutral-700 mb-4">Pick whichever works best for you:</p>
      <div className="flex flex-wrap gap-3">
        <a
          href={`tel:${phone}`}
          data-track="call_clicked"
          className="inline-block px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600"
        >
          📞 Call
        </a>
        <a
          href={`sms:${cleanPhone}`}
          data-track="sms_clicked"
          className="inline-block px-5 py-2.5 rounded-xl bg-white text-neutral-900 font-medium border border-neutral-200 hover:bg-neutral-50"
        >
          💬 Text
        </a>
        <a
          href={`mailto:${name?.toLowerCase().split(' ')[0] || 'office'}@rcrsal.com`}
          data-track="email_clicked"
          className="inline-block px-5 py-2.5 rounded-xl bg-white text-neutral-900 font-medium border border-neutral-200 hover:bg-neutral-50"
        >
          ✉️ Email
        </a>
      </div>
    </TileCard>
  );
}

// ─── PHOTO GALLERY ───────────────────────────────────────────────────────────

export interface PhotoGalleryTileProps {
  photos?: Array<{ url: string; caption?: string }>;
}

export function PhotoGalleryTile({ photos = [] }: PhotoGalleryTileProps) {
  return (
    <TileCard data-tile="photo-gallery">
      <h2 className="text-xl font-bold text-neutral-900 mb-3">Photos from your project</h2>
      {photos.length === 0 ? (
        <p className="text-neutral-500 italic">
          Once your project gets underway, photos from the work will appear here.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((p, i) => (
            <a
              key={i}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              data-track="photo_view"
              className="block"
            >
              <img
                src={p.url}
                alt={p.caption || `Project photo ${i + 1}`}
                className="rounded-lg w-full aspect-square object-cover border border-neutral-200 hover:opacity-90 transition-opacity"
              />
              {p.caption && <p className="text-xs text-neutral-600 mt-1">{p.caption}</p>}
            </a>
          ))}
        </div>
      )}
    </TileCard>
  );
}

// ─── ABOUT RCRS ──────────────────────────────────────────────────────────────

export function AboutRcrsTile() {
  return (
    <TileCard data-tile="about-rcrs">
      <h2 className="text-xl font-bold text-neutral-900 mb-3">About River City Roofing Solutions</h2>
      <p className="text-neutral-700 leading-relaxed mb-4">
        Family-owned roofing company serving the Tennessee Valley. Insurance restoration, retail replacement,
        and 24/7 emergency tarping.
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="inline-block text-xs px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-700 font-medium">
          IKO ROOFPRO Craftsman Premier
        </span>
        <span className="inline-block text-xs px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-700 font-medium">
          OC Preferred
        </span>
        <span className="inline-block text-xs px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-700 font-medium">
          BBB A+
        </span>
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <a href="tel:(256) 656-7856" data-track="call_clicked" className="text-emerald-600 hover:underline font-medium">
          (256) 656-7856
        </a>
        <span className="text-neutral-400">·</span>
        <a href="https://rivercityroofingsolutions.com" className="text-emerald-600 hover:underline font-medium">
          rivercityroofingsolutions.com
        </a>
        <span className="text-neutral-400">·</span>
        <Link href="/gallery" className="text-emerald-600 hover:underline font-medium">
          Our work
        </Link>
      </div>
    </TileCard>
  );
}

// ─── WEATHER FORECAST ────────────────────────────────────────────────────────

export interface WeatherForecastTileProps {
  forecast?: {
    location: string;
    generatedAt: string;
    periods: Array<{
      name: string;
      isDaytime: boolean;
      tempF: number;
      shortForecast: string;
      icon: string;
    }>;
  } | null;
  disclaimer?: string;
}

export function WeatherForecastTile({ forecast, disclaimer }: WeatherForecastTileProps) {
  if (!forecast || !forecast.periods || forecast.periods.length === 0) return null;
  // Pull just the next 5 daytime periods (one per day)
  const daytime = forecast.periods.filter(p => p.isDaytime).slice(0, 5);
  return (
    <TileCard data-tile="weather-forecast">
      <h2 className="text-xl font-bold text-neutral-900 mb-2">{forecast.location} 5-Day Forecast</h2>
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
        ⚠️ {disclaimer || 'This is general weather for the area, NOT a guarantee of when your project install will happen. Your sales rep will confirm your schedule directly.'}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {daytime.map((p, i) => (
          <div
            key={i}
            className="text-center p-3 rounded-xl bg-neutral-50 border border-neutral-200"
          >
            <div className="text-xs font-semibold text-neutral-600 mb-1">{p.name}</div>
            {p.icon && (
              <img src={p.icon} alt={p.shortForecast} className="w-12 h-12 mx-auto" />
            )}
            <div className="text-2xl font-bold text-neutral-900 mt-1">{p.tempF}°</div>
            <div className="text-xs text-neutral-600 mt-1 leading-tight">{p.shortForecast}</div>
          </div>
        ))}
      </div>
    </TileCard>
  );
}
