import Link from 'next/link';
import { Heart, Users, GraduationCap, Trophy, Star, ArrowRight, Phone } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Community Involvement | River City Roofing Solutions',
  description:
    'River City Roofing Solutions has donated over $100,000 to local youth sports, schools, and community organizations across North Alabama including Decatur, Huntsville, and Madison.',
  keywords: [
    'community involvement',
    'local sponsorships',
    'North Alabama community',
    'Decatur youth sports',
    'school donations',
    'River City Roofing community',
    'roofing company giving back',
  ],
};

const sponsorships = [
  {
    name: 'River City Netreapers',
    type: 'Youth Sports',
    description:
      'Proud sponsor of the River City Netreapers, supporting local youth athletics and helping young athletes pursue their passion.',
    icon: Trophy,
  },
  {
    name: 'Decatur High School',
    type: 'Education',
    description:
      'Supporting Decatur High School programs and student activities, investing in the next generation of community leaders.',
    icon: GraduationCap,
  },
  {
    name: 'Austin High School',
    type: 'Education',
    description:
      'Partnering with Austin High School to support student athletics, academics, and extracurricular programs.',
    icon: GraduationCap,
  },
  {
    name: 'Decatur Heritage Christian Academy',
    type: 'Education',
    description:
      'Contributing to Decatur Heritage programs that build character and provide opportunities for students to excel.',
    icon: GraduationCap,
  },
];

export default function CommunityPage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative bg-[#1a1a1a] min-h-[500px] flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=2070&q=80')",
          }}
        />
        <div className="relative z-10 container mx-auto px-4 text-center py-20">
          <div className="inline-flex items-center gap-2 bg-brand-green/20 border border-brand-green/40 rounded-full px-5 py-2 mb-6">
            <Heart className="text-brand-green" size={20} />
            <span className="text-brand-green font-semibold">Giving Back Since Day One</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Rooted in <span className="text-brand-green">Community</span>
          </h1>
          <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto leading-relaxed">
            We don&apos;t just work in North Alabama — we live here, raise our families here,
            and invest in the communities that have supported us.
          </p>
        </div>
      </section>

      {/* Impact Stats */}
      <section className="bg-brand-green py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
            {[
              { value: '$100K+', label: 'Donated to Community' },
              { value: '25+', label: 'Years Serving North AL' },
              { value: '10+', label: 'Organizations Supported' },
              { value: '1000s', label: 'Students Impacted' },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-4xl md:text-5xl font-black mb-2">{s.value}</div>
                <p className="text-lg font-medium text-white/90">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-6">
                More Than a <span className="text-brand-green">Roofing Company</span>
              </h2>
            </div>
            <div className="prose prose-lg mx-auto text-gray-700 space-y-6">
              <p className="text-xl leading-relaxed">
                At River City Roofing Solutions, we believe that strong communities build strong
                businesses — and strong businesses have a responsibility to give back. Since our
                founding, we&apos;ve committed ourselves to supporting the youth, schools, and
                organizations that make North Alabama such a special place to call home.
              </p>
              <p className="text-xl leading-relaxed">
                With over <strong className="text-brand-green">$100,000 donated</strong> to local
                youth sports teams, schools, and community organizations, our commitment goes far
                beyond the rooftop. Every roof we install is an investment in this community — and
                we make sure the returns are shared with everyone.
              </p>
              <p className="text-xl leading-relaxed">
                Our owners grew up here, raised their families here, and have spent 25+ years
                building relationships in this community. When you choose RCRS, you&apos;re
                choosing a company that puts its money where its mouth is.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sponsorships */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Organizations We <span className="text-brand-green">Support</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We&apos;re proud to sponsor and support these local organizations — and many more.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {sponsorships.map((org) => {
              const Icon = org.icon;
              return (
                <div
                  key={org.name}
                  className="bg-white rounded-xl border-l-4 border-brand-green p-8 shadow-md hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex items-start gap-4">
                    <div className="bg-brand-green/10 rounded-lg p-3 flex-shrink-0">
                      <Icon className="text-brand-green" size={28} />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-brand-green uppercase tracking-wide">
                        {org.type}
                      </span>
                      <h3 className="text-xl font-bold mt-1 mb-2">{org.name}</h3>
                      <p className="text-gray-600">{org.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* And Many More */}
          <div className="mt-12 text-center">
            <div className="inline-block bg-[#1a1a1a] text-white rounded-xl px-10 py-8">
              <Users className="text-brand-green mx-auto mb-3" size={36} />
              <h3 className="text-2xl font-bold mb-2">And Many More</h3>
              <p className="text-gray-300 max-w-md">
                We support numerous other local teams, charities, churches, and community events
                throughout North Alabama. If your organization needs support,{' '}
                <Link href="/contact" className="text-brand-green hover:underline">
                  reach out to us
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Photo Gallery Placeholder */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">
              RCRS in the <span className="text-brand-green">Community</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Snapshots from our sponsorships, events, and community partnerships.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {[
              { alt: 'RCRS team at youth sports event', bg: 'from-brand-green/30 to-brand-green/10' },
              { alt: 'School sponsorship presentation', bg: 'from-blue-500/30 to-blue-500/10' },
              { alt: 'Community event support', bg: 'from-yellow-500/30 to-yellow-500/10' },
              { alt: 'Netreapers team sponsorship', bg: 'from-brand-green/30 to-brand-green/10' },
              { alt: 'Local charity fundraiser', bg: 'from-purple-500/30 to-purple-500/10' },
              { alt: 'RCRS giving back to schools', bg: 'from-red-500/30 to-red-500/10' },
            ].map((photo, i) => (
              <div
                key={i}
                className={`aspect-[4/3] bg-gradient-to-br ${photo.bg} rounded-xl flex items-center justify-center border border-gray-200`}
              >
                <div className="text-center p-4">
                  <Heart className="mx-auto mb-2 text-gray-400" size={32} />
                  <p className="text-sm text-gray-500 font-medium">{photo.alt}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-gray-400 text-sm mt-6 italic">
            Photos coming soon — follow us on social media to see our latest community involvement!
          </p>
        </div>
      </section>

      {/* Raise the Roof for Schools */}
      <section className="py-20 bg-[#1a1a1a] text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <GraduationCap className="text-brand-green mx-auto mb-6" size={56} />
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Raise the Roof <span className="text-brand-green">for Schools</span>
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              With every roof replacement, RCRS donates approximately <strong className="text-brand-green">$250</strong> to
              the school of the customer&apos;s choice. It&apos;s our way of making sure every new roof
              helps build a brighter future for local students.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href="/referral-rewards"
                className="inline-flex items-center gap-2 bg-brand-green text-white font-semibold px-8 py-4 rounded hover:brightness-110 transition text-lg"
              >
                Learn More <ArrowRight size={20} />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 border-2 border-brand-green text-brand-green font-semibold px-8 py-4 rounded hover:bg-brand-green hover:text-white transition text-lg"
              >
                Get a Free Inspection
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-brand-green">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Choose a Roofer That Gives Back
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            When you choose RCRS, you&apos;re investing in North Alabama. Let&apos;s protect your
            home and strengthen our community — together.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/contact"
              className="inline-block bg-white text-brand-green font-bold px-8 py-4 rounded text-lg hover:bg-gray-100 transition"
            >
              Schedule Free Inspection
            </Link>
            <a
              href="tel:256-274-8530"
              className="inline-flex items-center justify-center gap-2 border-2 border-white text-white font-bold px-8 py-4 rounded text-lg hover:bg-white hover:text-brand-green transition"
            >
              <Phone size={20} /> (256) 274-8530
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
