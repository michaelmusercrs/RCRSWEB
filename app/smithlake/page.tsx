/* Smith Lake Campaign — landing / hub. Overview + a prominent link into the
   ranked homeowner database at /smithlake/database. Static content (real
   numbers from the campaign build); the database page carries the PII + auth
   posture. Kept noindex via the /smithlake layout. */

const GREEN = '#80FF00';

const CAMPAIGN_STATS: { n: string; label: string }[] = [
  { n: '15,824', label: 'Lake parcels' },
  { n: '9,096', label: 'Homes' },
  { n: '8,572', label: 'Owners' },
  { n: '561', label: 'Storm-hit' },
  { n: '479', label: 'Hit since 2023' },
  { n: '34 · $758k', label: '90-day base case' },
];

const TARGET_LISTS: { name: string; homes: number; play: string; hot?: boolean }[] = [
  { name: 'Fresh + valuable', homes: 344, play: 'START HERE — recent hail + $300k+ + claim-viable', hot: true },
  { name: 'Storm-hit core', homes: 561, play: 'The full High / Severe universe' },
  { name: 'Waterfront storm-hit', homes: 322, play: 'Highest-value roofs (dock)' },
  { name: 'Local storm-hit', homes: 177, play: 'Donnie door-knocks these' },
  { name: 'Second-home storm-hit', homes: 384, play: 'Mail-only (owners are remote)' },
  { name: 'Crane Hill hot zone', homes: 883, play: 'Saturation-canvass area' },
  { name: 'Premium ($700k+)', homes: 225, play: 'White-glove, bigger tickets' },
];

const FUNNEL: { w: number; label: string }[] = [
  { w: 100, label: '561 storm-hit prime homes' },
  { w: 78, label: '~420 reached (knock + mail + phone)' },
  { w: 52, label: '~190 inspections' },
  { w: 30, label: '~65 claims filed' },
  { w: 20, label: '~42 approved' },
  { w: 15, label: '~34 roofs built · ~$758k' },
];

export default function SmithLakeHub() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header band */}
      <header
        className="border-b-[6px] px-5 py-8 text-white sm:px-10"
        style={{ background: '#141414', borderColor: GREEN }}
      >
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">
            Smith Lake <span style={{ color: GREEN }}>Campaign</span>
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Donnie Dotson territory · Winston + Cullman · the roof-sales push in one place
          </p>

          {/* stat strip */}
          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg sm:grid-cols-3 lg:grid-cols-6" style={{ background: '#333' }}>
            {CAMPAIGN_STATS.map((s) => (
              <div key={s.label} className="px-3 py-3" style={{ background: '#141414' }}>
                <div className="text-xl font-extrabold" style={{ color: GREEN }}>{s.n}</div>
                <div className="text-[10.5px] uppercase tracking-wide text-neutral-400">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-10">
        {/* Primary CTA: the database */}
        <a
          href="/smithlake/database"
          className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
          style={{ borderLeft: `6px solid ${GREEN}` }}
        >
          <div>
            <div className="text-lg font-bold text-slate-900">Open the Ranked Database →</div>
            <p className="mt-1 text-sm text-slate-600">
              3,265 owners scored by hail-impact risk
              <span className="ml-2 inline-flex gap-2 align-middle">
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">High 208</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Moderate 2,252</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Low 805</span>
              </span>
            </p>
            <p className="mt-1 text-sm text-slate-500">Search, filter by risk or area, sort, export to CSV, and map each house.</p>
          </div>
          <span
            className="shrink-0 rounded-lg px-5 py-3 text-center text-sm font-bold text-black transition group-hover:brightness-95"
            style={{ background: GREEN }}
          >
            Open Database
          </span>
        </a>

        {/* Target lists */}
        <Section title="Ready-to-work target lists">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TARGET_LISTS.map((t) => (
              <div
                key={t.name}
                className="rounded-xl border bg-white p-4"
                style={t.hot ? { borderColor: GREEN, boxShadow: `inset 0 0 0 1px ${GREEN}` } : { borderColor: '#e6e6e6' }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-semibold text-slate-900">{t.name}</div>
                  <div className="text-sm font-bold tabular-nums text-slate-500">{t.homes.toLocaleString()}</div>
                </div>
                <p className="mt-1 text-xs text-slate-600">{t.play}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 90-day funnel */}
        <Section title="The 90-day funnel (base case)">
          <div className="space-y-1.5">
            {FUNNEL.map((f, i) => (
              <div key={i} className="flex justify-center">
                <div
                  className="rounded-md px-3 py-1.5 text-center text-sm font-bold text-black"
                  style={{ width: `${f.w}%`, background: `linear-gradient(90deg, ${GREEN}, #5bbb00)` }}
                >
                  {f.label}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Conservative ~16 roofs / $286k · Base ~34 / $758k · Stretch ~62 / $1.75M.
          </p>
        </Section>

        {/* Storm highlights */}
        <Section title="Storms that actually hit the lake">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">2012-03-31 — 2.5&quot; hail</div>
              <p className="mt-1 text-xs text-slate-600">~4,357 homes in the swath. The biggest single event on the lake.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">2018-03-20 — 5.0&quot; hail</div>
              <p className="mt-1 text-xs text-slate-600">Largest hail size on record. Cite the exact storm in a pitch.</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">25 storms total, 2012–present (free NWS + Iowa State Mesonet).</p>
        </Section>

        <p className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-400">
          Internal use only · not indexed. Figures from public county parcel records + public storm reports;
          value estimates are directional (county assessed × 10 local / × 5 remote). Pipeline uses a placeholder
          average job value — swap in the real number in the projections file.
        </p>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2
        className="mb-3 border-b-[3px] pb-1.5 text-sm font-bold uppercase tracking-wide text-slate-800"
        style={{ borderColor: GREEN }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
