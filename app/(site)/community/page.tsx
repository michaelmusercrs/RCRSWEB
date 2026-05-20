import Link from 'next/link';
import { Heart, Users, GraduationCap, Trophy, ArrowRight, Phone, Shield, Flame, Baby, Handshake, Church, Medal } from 'lucide-react';
import type { Metadata } from 'next';
import { generateMetadata as genMeta } from '@/lib/seo';

export const metadata: Metadata = genMeta({
  title: 'Community Involvement | $100K+ Donated to North Alabama Schools & Youth Sports',
  description:
    'River City Roofing Solutions has donated over $100,000 to local youth sports, schools, first responders, and community organizations across Decatur, Huntsville, Madison & North Alabama.',
  path: '/community',
  keywords: [
    'community involvement',
    'local sponsorships',
    'North Alabama community',
    'Decatur youth sports',
    'school donations',
    'River City Roofing community',
    'roofing company giving back',
  ],
});

const sponsorships = [
  {
    name: 'River City Net Reapers',
    type: 'Youth Sports',
    description:
      'Proud long-time supporters of the River City Net Reapers, helping young athletes pursue their passion in local youth athletics.',
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
    name: 'West Morgan High School',
    type: 'Youth Sports',
    description:
      'Sponsoring volleyball, basketball, and athletic programs at West Morgan High School.',
    icon: Medal,
  },
  {
    name: 'Austin High School',
    type: 'Education',
    description:
      'Partnering with Austin High School to support student athletics, academics, and extracurricular programs.',
    icon: GraduationCap,
  },
  {
    name: 'Decatur Police FOP',
    type: 'First Responders',
    description:
      'Supporting our local Fraternal Order of Police — backing the men and women who protect our community every day.',
    icon: Shield,
  },
  {
    name: 'Decatur Fire & Rescue',
    type: 'First Responders',
    description:
      'Proud supporters of Decatur Fire & Rescue and the brave firefighters who keep our families safe.',
    icon: Flame,
  },
  {
    name: 'The Mac Kent Memorial Fund',
    type: 'Community',
    description:
      'Honored to contribute to the Mac Kent Memorial Fund, keeping a legacy alive in our community.',
    icon: Heart,
  },
  {
    name: 'National Fire Safety Council',
    type: 'Safety',
    description:
      'Supporting fire safety education and awareness programs that protect families nationwide.',
    icon: Flame,
  },
  {
    name: 'Girl Scout Troop 20517',
    type: 'Youth',
    description:
      'Sponsoring local Girl Scouts and helping young leaders build confidence, skills, and community spirit.',
    icon: Users,
  },
  {
    name: 'Decatur National Baseball / DYB',
    type: 'Youth Sports',
    description:
      'Supporting Decatur Youth Baseball and the Dixie Youth Baseball program — building character through the game.',
    icon: Trophy,
  },
  {
    name: 'Alabama United',
    type: 'Youth Sports',
    description:
      'Proud sponsor of Alabama United, investing in competitive youth athletics across the region.',
    icon: Trophy,
  },
  {
    name: 'One Life Student Ministries',
    type: 'Community',
    description:
      'Supporting One Life Student Ministries and their mission to make a positive impact on young lives.',
    icon: Church,
  },
  {
    name: 'SD Freeman Memorial',
    type: 'Community',
    description:
      'Contributing to the SD Freeman Memorial and honoring those who have shaped our community.',
    icon: Heart,
  },
  {
    name: 'GMCBA Charity Tournament',
    type: 'Community',
    description:
      'Participating in and sponsoring the GMCBA Charity Tournament to raise funds for local causes.',
    icon: Handshake,
  },
  {
    name: 'Calhoun Community College',
    type: 'Education',
    description:
      'Supporting higher education at Calhoun Community College — investing in workforce development for North Alabama.',
    icon: GraduationCap,
  },
  {
    name: 'Hurricane Relief Efforts',
    type: 'Disaster Relief',
    description:
      'When storms hit, we show up. RCRS has supported hurricane relief efforts to help affected families rebuild.',
    icon: Heart,
  },
  {
    name: 'Local School Fundraisers',
    type: 'Education',
    description:
      'Chocolate sales, sports gear, team meals — we support school fundraisers across the Tennessee Valley whenever we can.',
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
              { value: '17+', label: 'Organizations Supported' },
              { value: 'Youth', label: 'Sports & Schools' },
              { value: 'First', label: 'Responder Support' },
              { value: 'Local', label: 'Since Day One' },
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
                From sponsoring local sports teams and schools to supporting first responders
                and community events, our commitment goes far beyond the rooftop. Every roof 
                we install is an investment in this community — and we make sure the returns 
                are shared with everyone.
              </p>
              <p className="text-xl leading-relaxed">
                Our owners grew up here and raised their families here. When you choose RCRS, 
                you&apos;re choosing a company that puts its money where its mouth is.
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

      {/* Community Posts from Facebook */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">
              RCRS in the <span className="text-brand-green">Community</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              See what we&apos;ve been up to around North Alabama.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto justify-items-center">
            <iframe
              src="https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2FRiverCityRoofingSolutions%2Fposts%2Fpfbid0oiZxYK1DXZKdHChAFrn13jPjperfACnB6YypbcZLZ5qWzxy2fy8wxqno8g1u5EDwl&show_text=true&width=500"
              width="500"
              height="718"
              style={{ border: 'none', overflow: 'hidden' }}
              scrolling="no"
              frameBorder="0"
              allowFullScreen
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              className="max-w-full"
            />
            <iframe
              src="https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2FRiverCityRoofingSolutions%2Fposts%2Fpfbid0euMddd6BpxKnDzUjzvb1rqm7X9VjWLZnu9KURETpKaLQXgAKvqq3bzfYTDJqBzJ9l&show_text=true&width=500"
              width="500"
              height="718"
              style={{ border: 'none', overflow: 'hidden' }}
              scrolling="no"
              frameBorder="0"
              allowFullScreen
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              className="max-w-full"
            />
            <iframe
              src="https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2FRiverCityRoofingSolutions%2Fposts%2Fpfbid02ZAhfaJucRPrJLLNoCJABDcmvCRx2XYoey6rEcXTYwLMAsEVhvVjsViVKdAW83DQEl&show_text=true&width=500"
              width="500"
              height="718"
              style={{ border: 'none', overflow: 'hidden' }}
              scrolling="no"
              frameBorder="0"
              allowFullScreen
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              className="max-w-full"
            />
          </div>
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
