import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  MapPin,
  CheckCircle2,
  Phone,
  ArrowRight,
  Home,
  ShieldCheck,
  Search,
  Award,
} from 'lucide-react';
import StructuredData from '@/components/StructuredData';
import {
  generateMetadata as genMeta,
  generateBreadcrumbSchema,
  generateFAQSchema,
  generateServiceSchema,
  siteConfig,
} from '@/lib/seo';
import countyData from '@/data/county-landing.json';

// ---------------------------------------------------------------------------
// County landing pages — `/roofing-contractor/[county]`
//
// One template, 5 statically-generated instances (madison, morgan, marshall,
// limestone, cullman). These are the top counties RCRS services by volume and
// population. Each ranks for `roofing contractor <county>` queries and feeds
// the Google Local Pack as a topic cluster — they link to each other in the
// footer of the page, and back to the canonical service pages.
//
// Per memory rules: IKO ROOFPRO Craftsman Premier always listed first. No
// fabricated stats, ratings, or testimonials — `aggregateRating` comes from
// the real review corpus in data/reviews-master.json via siteConfig.reviewStats.
// ---------------------------------------------------------------------------

type CountyKey = keyof typeof countyData;

type CountyRecord = {
  name: string;
  seat: string;
  cities: string[];
  geo: { latitude: number; longitude: number };
  intro: string;
  localContext: string;
  faqs: Array<{ q: string; a: string }>;
};

const COUNTY_SLUGS = ['madison', 'morgan', 'marshall', 'limestone', 'cullman'] as const;

export function generateStaticParams() {
  return COUNTY_SLUGS.map((county) => ({ county }));
}

function getCounty(slug: string): CountyRecord | null {
  if (!(slug in countyData)) return null;
  return (countyData as Record<string, CountyRecord>)[slug];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ county: string }>;
}): Promise<Metadata> {
  const { county } = await params;
  const data = getCounty(county);
  if (!data) return { title: 'County Not Found' };

  const path = `/roofing-contractor/${county}`;
  const title = `Roofing Contractor in ${data.name} County, Alabama | RCRS`;
  const description = `Licensed roofing contractor serving ${data.name} County, AL — ${data.cities.slice(0, 3).join(', ')} and ${data.cities[data.cities.length - 1]}. Roof replacement, storm damage repair, and free inspections. IKO ROOFPRO Craftsman Premier, BBB A+. Call (256) 274-8530.`;

  return genMeta({
    title,
    description,
    keywords: [
      `roofing contractor ${data.name} County AL`,
      `${data.name} County roofer`,
      `roof replacement ${data.name} County`,
      `storm damage ${data.name} County Alabama`,
      `free roof inspection ${data.name} County`,
      `${data.seat} AL roofing contractor`,
      ...data.cities.map((c) => `roofing contractor ${c} AL`),
    ],
    path,
  });
}

export default async function CountyLandingPage({
  params,
}: {
  params: Promise<{ county: string }>;
}) {
  const { county } = await params;
  const data = getCounty(county);
  if (!data) notFound();

  const path = `/roofing-contractor/${county}`;
  const url = `${siteConfig.url}${path}`;

  // --- Schemas ------------------------------------------------------------
  // Three schemas per page:
  //  1. Service — describes "Roofing Contractor in <county> County" as a
  //     service offering, with provider linked back to the canonical
  //     RoofingContractor @id from the layout.
  //  2. BreadcrumbList — Home → Roofing Contractor → <County> County.
  //  3. FAQPage — the 6 questions rendered below in the FAQ section.
  const serviceSchema = generateServiceSchema({
    name: `Roofing Contractor in ${data.name} County, Alabama`,
    description: `Licensed roofing contractor serving ${data.name} County, Alabama — including ${data.cities.join(', ')}. Roof replacement, storm and hail damage repair, insurance claim assistance, and free roof inspections.`,
    url,
    offer: {
      price: '0',
      priceCurrency: 'USD',
      description: `Free roof inspection in ${data.name} County, AL`,
    },
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Roofing Contractor', url: '/service-areas' },
    { name: `${data.name} County`, url: path },
  ]);

  const faqSchema = generateFAQSchema(
    data.faqs.map((f) => ({ question: f.q, answer: f.a }))
  );

  // Other counties for the topic-cluster internal-link section. We always
  // exclude the current county so the page links outward to its siblings.
  const otherCounties = COUNTY_SLUGS.filter((s) => s !== county).map((s) => ({
    slug: s,
    name: (countyData as Record<string, CountyRecord>)[s].name,
  }));

  // The three feature services we lead with on every county page. These map
  // to existing /services/<slug> pages so internal links are real, not placeholders.
  const featuredServices = [
    {
      title: 'Roof Replacement',
      slug: 'residential-roof-replacement',
      icon: Home,
      blurb: `Full tear-off, dry-in, and re-roof for ${data.name} County homes. IKO Dynasty and Owens Corning lifetime shingle systems, premium underlayment, and code-compliant ventilation.`,
    },
    {
      title: 'Storm Damage Restoration',
      slug: 'storm-hail-damage-repair',
      icon: ShieldCheck,
      blurb: `Hail, wind, and tornado damage repair across ${data.name} County. We document the damage, file the claim, and rebuild the roof — start to finish.`,
    },
    {
      title: 'Free Roof Inspection',
      slug: 'roof-inspections-maintenance',
      icon: Search,
      blurb: `No-obligation roof condition report with photos. Available for every home in ${data.name} County — call or book online.`,
    },
  ] as const;

  const contactHref = `/contact?source=county-${county}`;

  return (
    <div className="min-h-screen bg-black text-white">
      <StructuredData data={[serviceSchema, breadcrumbSchema, faqSchema]} />

      {/* ----- HERO ------------------------------------------------------- */}
      <section className="relative py-20 md:py-28 border-b border-white/10">
        <div className="container mx-auto px-4">
          <nav aria-label="Breadcrumb" className="text-sm text-gray-400 mb-6">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/" className="hover:text-brand-green transition-colors">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/service-areas" className="hover:text-brand-green transition-colors">
                  Service Areas
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-gray-200">{data.name} County</li>
            </ol>
          </nav>

          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 bg-brand-green/10 border border-brand-green/30 rounded-full px-4 py-2 mb-6">
              <MapPin className="text-brand-green" size={18} />
              <span className="text-brand-green font-semibold text-sm">
                Serving {data.name} County, Alabama
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Roofing Contractor in {data.name} County, Alabama
            </h1>

            <p className="text-lg md:text-xl text-gray-300 mb-4 leading-relaxed">
              {data.intro}
            </p>
            <p className="text-base md:text-lg text-gray-400 mb-8 leading-relaxed">
              {data.localContext}
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href={contactHref}
                className="inline-flex items-center justify-center gap-2 bg-brand-green text-black font-bold px-8 py-4 rounded-full hover:bg-lime-400 transition-colors"
              >
                Get a Free Roof Inspection in {data.name} County
                <ArrowRight size={20} />
              </Link>
              <a
                href="tel:256-274-8530"
                className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white font-bold px-8 py-4 rounded-full hover:bg-white/20 transition-colors"
              >
                <Phone size={20} /> (256) 274-8530
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ----- CITIES SERVED --------------------------------------------- */}
      <section className="py-12 md:py-16 bg-white/[0.02] border-b border-white/10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Cities We Serve in {data.name} County
            </h2>
            <p className="text-gray-400 mb-6">
              {data.seat} is the county seat — we work the whole county.
            </p>
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {data.cities.map((city) => (
                <li
                  key={city}
                  className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-4 py-3"
                >
                  <CheckCircle2 className="text-brand-green flex-shrink-0" size={18} />
                  <span className="text-gray-200 text-sm font-medium">{city}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ----- SERVICES --------------------------------------------------- */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 text-center">
              Roofing Services in {data.name} County
            </h2>
            <p className="text-gray-400 text-center mb-10 max-w-2xl mx-auto">
              Three things every {data.name} County homeowner needs from a roofer —
              and what we do day in, day out.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              {featuredServices.map((svc) => {
                const Icon = svc.icon;
                return (
                  <Link
                    key={svc.slug}
                    href={`/services/${svc.slug}`}
                    className="group block bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-brand-green/50 hover:bg-white/[0.07] transition-all"
                  >
                    <div className="w-12 h-12 bg-brand-green/15 rounded-full flex items-center justify-center mb-4">
                      <Icon className="text-brand-green" size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-brand-green transition-colors">
                      {svc.title}
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-4">
                      {svc.blurb}
                    </p>
                    <span className="inline-flex items-center gap-1 text-brand-green text-sm font-semibold">
                      Learn more <ArrowRight size={16} />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ----- TRUST SIGNALS --------------------------------------------- */}
      <section className="py-12 md:py-16 bg-white/[0.02] border-y border-white/10">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 text-center">
              Why Homeowners in {data.name} County Choose RCRS
            </h2>
            <p className="text-gray-400 text-center mb-10 max-w-2xl mx-auto">
              The manufacturer credentials and accreditations behind every
              roof we install.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* IKO always leads — primary manufacturer credential per memory. */}
              <div className="bg-white/5 border-2 border-brand-green/40 rounded-xl p-5 text-center">
                <Award className="text-brand-green mx-auto mb-3" size={32} />
                <h3 className="text-white font-bold mb-1">IKO ROOFPRO</h3>
                <p className="text-brand-green text-xs font-semibold mb-2">
                  Craftsman Premier
                </p>
                <p className="text-gray-400 text-xs">
                  Our primary manufacturer certification — highest tier of
                  IKO's installer program.
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
                <ShieldCheck className="text-white mx-auto mb-3" size={32} />
                <h3 className="text-white font-bold mb-1">BBB A+</h3>
                <p className="text-gray-400 text-xs font-semibold mb-2">
                  Accredited Business
                </p>
                <p className="text-gray-400 text-xs">
                  Better Business Bureau A+ rating — accredited and in good
                  standing.
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
                <Award className="text-white mx-auto mb-3" size={32} />
                <h3 className="text-white font-bold mb-1">Owens Corning</h3>
                <p className="text-gray-400 text-xs font-semibold mb-2">
                  Preferred Contractor
                </p>
                <p className="text-gray-400 text-xs">
                  Certified to install and warranty Owens Corning shingle
                  systems.
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
                <Award className="text-white mx-auto mb-3" size={32} />
                <h3 className="text-white font-bold mb-1">Boral</h3>
                <p className="text-gray-400 text-xs font-semibold mb-2">
                  Pro Installer / LeafX
                </p>
                <p className="text-gray-400 text-xs">
                  Authorized installer for Boral LeafX gutter protection.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----- FAQ -------------------------------------------------------- */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">
              {data.name} County Roofing FAQ
            </h2>
            <div className="space-y-3">
              {data.faqs.map((faq, idx) => (
                <details
                  key={idx}
                  className="group bg-white/5 border border-white/10 rounded-xl p-5 hover:border-brand-green/40 transition-colors"
                >
                  <summary className="font-bold text-white cursor-pointer list-none flex justify-between items-center gap-4">
                    <span>{faq.q}</span>
                    <CheckCircle2
                      className="text-brand-green flex-shrink-0 transition-transform group-open:rotate-90"
                      size={20}
                    />
                  </summary>
                  <p className="text-gray-300 mt-4 leading-relaxed">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ----- CTA -------------------------------------------------------- */}
      <section className="py-14 md:py-20 bg-brand-blue">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Get a Free Roof Inspection in {data.name} County
          </h2>
          <p className="text-lg md:text-xl text-blue-50 mb-8 max-w-2xl mx-auto">
            No obligation. We document everything with photos. Quote in your
            inbox the same week.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={contactHref}
              className="inline-flex items-center justify-center gap-2 bg-brand-green text-black font-bold px-8 py-4 rounded-full hover:bg-lime-400 transition-colors"
            >
              Request Inspection <ArrowRight size={20} />
            </Link>
            <a
              href="tel:256-274-8530"
              className="inline-flex items-center justify-center gap-2 bg-white text-brand-blue font-bold px-8 py-4 rounded-full hover:bg-gray-100 transition-colors"
            >
              <Phone size={20} /> (256) 274-8530
            </a>
          </div>
        </div>
      </section>

      {/* ----- TOPIC-CLUSTER INTERNAL LINKS ------------------------------ */}
      <section className="py-12 md:py-16 bg-black border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10">
            <div>
              <h3 className="text-lg font-semibold text-brand-green mb-4">
                Roofing Services
              </h3>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/services/residential-roof-replacement"
                    className="text-gray-300 hover:text-brand-green transition-colors text-sm"
                  >
                    Residential Roof Replacement
                  </Link>
                </li>
                <li>
                  <Link
                    href="/services/residential-roof-repair"
                    className="text-gray-300 hover:text-brand-green transition-colors text-sm"
                  >
                    Roof Repair
                  </Link>
                </li>
                <li>
                  <Link
                    href="/services/storm-hail-damage-repair"
                    className="text-gray-300 hover:text-brand-green transition-colors text-sm"
                  >
                    Storm & Hail Damage Repair
                  </Link>
                </li>
                <li>
                  <Link
                    href="/services/roof-inspections-maintenance"
                    className="text-gray-300 hover:text-brand-green transition-colors text-sm"
                  >
                    Free Roof Inspection
                  </Link>
                </li>
                <li>
                  <Link
                    href="/services/emergency-roof-services"
                    className="text-gray-300 hover:text-brand-green transition-colors text-sm"
                  >
                    Emergency Roof Services
                  </Link>
                </li>
                <li>
                  <Link
                    href="/services"
                    className="text-brand-green hover:text-lime-400 transition-colors text-sm font-semibold"
                  >
                    View all services →
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-brand-green mb-4">
                Other Counties We Serve
              </h3>
              <ul className="space-y-2">
                {otherCounties.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/roofing-contractor/${c.slug}`}
                      className="text-gray-300 hover:text-brand-green transition-colors text-sm"
                    >
                      Roofing Contractor in {c.name} County, AL
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/service-areas"
                    className="text-brand-green hover:text-lime-400 transition-colors text-sm font-semibold"
                  >
                    All service areas →
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="max-w-5xl mx-auto mt-8 pt-8 border-t border-white/10 text-center">
            <p className="text-gray-500 text-sm">
              Have a question about your roof in {data.name} County?{' '}
              <Link
                href={contactHref}
                className="text-brand-green hover:text-lime-400"
              >
                Contact us
              </Link>{' '}
              or call{' '}
              <a
                href="tel:256-274-8530"
                className="text-brand-green hover:text-lime-400"
              >
                (256) 274-8530
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
