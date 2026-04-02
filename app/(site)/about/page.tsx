import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Award, Shield, Users, CheckCircle2, ArrowRight } from 'lucide-react';
import { teamMembers } from '@/lib/teamData';

import { generateMetadata as genMeta, generateAboutPageSchema, generateBreadcrumbSchema } from '@/lib/seo';
import StructuredData from '@/components/StructuredData';
import type { Metadata } from 'next';

export const metadata: Metadata = genMeta({
  title: 'About Us | Locally Owned Roofing Company in Decatur AL',
  description: 'River City Roofing Solutions is a locally owned, family-operated roofing company in Decatur, AL. Licensed, insured & BBB A+ rated. Serving Huntsville, Madison, Athens & all of North Alabama since 2010. Meet our experienced roofing team.',
  path: '/about',
  keywords: ['locally owned roofing company Decatur AL', 'family owned roofer Huntsville AL', 'roofing company near me', 'licensed roofing contractor North Alabama', 'about River City Roofing', 'BBB A+ roofer Decatur', 'IKO certified contractor Alabama', 'Owens Corning Preferred Contractor Alabama', 'Boral certified LeafX dealer'],
});

export default async function AboutPage() {
  const aboutSchema = generateAboutPageSchema();
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'About Us', url: '/about' },
  ]);

  return (
    <div className="min-h-screen">
      <StructuredData data={[aboutSchema, breadcrumbSchema]} />
      {/* Hero Section */}
      <section className="min-h-[50vh] flex items-center justify-center">
        <div className="container mx-auto px-4 text-center text-white">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 drop-shadow-lg">
            About Our Locally Owned Roofing Company
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto text-white/90 drop-shadow-md">
            Meet the experienced roofing professionals protecting Decatur, Huntsville &amp; North Alabama homes since 2010
          </p>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 text-center">
              Our Story
            </h2>
            <div className="space-y-6 text-lg text-neutral-300 leading-relaxed">
              <p>
                River City Roofing Solutions was founded with a simple mission: provide North Alabama
                homeowners with honest, reliable roofing services they can trust. What started as a small,
                family-owned business has grown into one of the region's most respected roofing companies.
              </p>
              <p>
                We've built our reputation one roof at a time, always putting quality workmanship and customer
                satisfaction first. Our team combines real-world experience with the latest industry techniques
                and materials to deliver superior results on every project.
              </p>
              <div className="border-l-4 border-brand-green pl-6 my-8">
                <p className="text-xl text-brand-green font-semibold mb-2">
                  Family-Owned • Locally Operated • Community Focused
                </p>
                <p className="text-neutral-400">
                  We're not just your roofers—we're your neighbors, committed to protecting the homes
                  and businesses in our community.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Team Members Section */}
      <section className="py-12 md:py-16 bg-black/70 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Our Team
            </h2>
            <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
              Meet the dedicated professionals who make River City Roofing Solutions the best choice
              for your roofing needs
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {teamMembers.map((member, idx) => (
              <Link key={idx} href={`/team/${member.slug}`} className="block">
                <div className="bg-neutral-800 border border-neutral-700 hover:border-brand-green hover:shadow-xl hover:shadow-brand-green/20 transition-all p-8 rounded-lg group cursor-pointer h-full">
                  {/* Profile Image */}
                  <div className="w-32 h-32 bg-gray-300 rounded-full mx-auto mb-6 flex items-center justify-center overflow-hidden relative">
                    {member.profileImage ? (
                      <Image
                        src={member.profileImage}
                        alt={member.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <Users className="text-gray-500" size={64} />
                    )}
                  </div>

                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-brand-green transition-colors">{member.name}</h3>
                    <p className="text-lg text-brand-green font-semibold mb-2">{member.position}</p>
                    {member.tagline && (
                      <p className="text-sm text-neutral-400 italic mb-4">{member.tagline}</p>
                    )}
                    <p className="text-neutral-300 leading-relaxed text-left line-clamp-4">{member.bio}</p>
                  </div>

                  {/* View Profile Link */}
                  <span className="flex items-center justify-center gap-2 text-brand-green font-semibold group-hover:gap-3 transition-all">
                    View Full Profile
                    <ArrowRight size={18} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications Section */}
      <section className="py-12 md:py-16 bg-black/70 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Industry Certifications
            </h2>
            <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
              Our certifications reflect our commitment to the highest standards in the roofing industry
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-6 text-center hover:border-brand-green/50 transition-all">
              <Award className="text-brand-green mx-auto mb-3" size={40} />
              <h3 className="text-lg font-bold text-white mb-1">IKO ROOFPRO&reg;</h3>
              <p className="text-brand-green text-sm font-semibold mb-2">Craftsman Premier</p>
              <p className="text-neutral-400 text-sm">The highest tier of IKO&apos;s contractor program, certifying expert installation of IKO roofing systems.</p>
            </div>
            <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-6 text-center hover:border-brand-green/50 transition-all">
              <Award className="text-brand-green mx-auto mb-3" size={40} />
              <h3 className="text-lg font-bold text-white mb-1">Owens Corning</h3>
              <p className="text-brand-green text-sm font-semibold mb-2">Preferred Contractor</p>
              <p className="text-neutral-400 text-sm">Recognized by Owens Corning for meeting rigorous standards in roofing excellence and customer satisfaction.</p>
            </div>
            <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-6 text-center hover:border-brand-green/50 transition-all">
              <Award className="text-brand-green mx-auto mb-3" size={40} />
              <h3 className="text-lg font-bold text-white mb-1">Boral Certified</h3>
              <p className="text-brand-green text-sm font-semibold mb-2">LeafX Dealer / Pro Installer</p>
              <p className="text-neutral-400 text-sm">Authorized dealer and certified professional installer of Boral LeafX gutter protection systems.</p>
            </div>
            <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-6 text-center hover:border-brand-green/50 transition-all">
              <Shield className="text-brand-green mx-auto mb-3" size={40} />
              <h3 className="text-lg font-bold text-white mb-1">BBB A+ Rated</h3>
              <p className="text-brand-green text-sm font-semibold mb-2">Accredited Business</p>
              <p className="text-neutral-400 text-sm">Better Business Bureau A+ rating with full accreditation, reflecting our commitment to trust and transparency.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Our Values Section */}
      <section className="py-12 md:py-16 bg-brand-blue/90 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Our Values
            </h2>
            <p className="text-xl text-blue-50 max-w-2xl mx-auto">
              The principles that guide everything we do
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {[
              {
                icon: Shield,
                title: 'Integrity',
                desc: 'Honest assessments, fair pricing, and transparent communication on every project',
              },
              {
                icon: Award,
                title: 'Quality',
                desc: 'Superior workmanship using premium materials and industry best practices',
              },
              {
                icon: Users,
                title: 'Community',
                desc: 'Supporting our local community and treating customers like neighbors',
              },
              {
                icon: CheckCircle2,
                title: 'Reliability',
                desc: 'On-time completion, clear communication, and standing behind our work',
              },
            ].map((value, idx) => {
              const Icon = value.icon;
              return (
                <div key={idx} className="flex flex-col items-center text-center">
                  <div className="bg-brand-green rounded-full p-4 mb-4">
                    <Icon className="text-white" size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{value.title}</h3>
                  <p className="text-blue-50">{value.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Learn More Links */}
      <section className="py-8 bg-black/70 backdrop-blur-sm relative z-10 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-4 text-center">Learn More About Us</h2>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                { name: 'Our Services', href: '/services' },
                { name: 'Service Areas', href: '/service-areas' },
                { name: 'Customer Reviews', href: '/reviews' },
                { name: 'Project Gallery', href: '/gallery' },
                { name: 'FAQ', href: '/faq' },
                { name: 'Financing Options', href: '/financing' },
                { name: 'Warranty Info', href: '/warranty' },
                { name: 'Community', href: '/community' },
                { name: 'Careers', href: '/careers' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-full text-sm text-neutral-300 hover:text-brand-green hover:border-brand-green/50 transition-all font-medium"
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto border-l-4 border-brand-green pl-8">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Ready to Work With Us?
            </h2>
            <p className="text-xl text-neutral-300 mb-8">
              Experience the River City Roofing difference. Contact us today for your free inspection
              and see why North Alabama homeowners trust us with their roofing needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild className="bg-brand-green hover:bg-lime-400 text-black font-bold px-8 py-6 text-lg">
                <Link href="/contact">Schedule Free Inspection</Link>
              </Button>
              <Button asChild className="border-2 border-white text-white hover:bg-white hover:text-black font-bold px-8 py-6 text-lg">
                <Link href="tel:256-274-8530">Call (256) 274-8530</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
