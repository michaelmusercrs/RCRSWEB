import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Users, ArrowRight, Mail, Phone } from 'lucide-react';
import { teamMembers as staticTeamMembers } from '@/lib/teamData';
import { getAllTeamMembersWithOverrides } from '@/lib/profile-overrides';
import StructuredData from '@/components/StructuredData';
import { generateMetadata as genMeta, generateCollectionPageSchema, generateBreadcrumbSchema } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = genMeta({
  title: 'Our Roofing Team | Meet the Experts at River City Roofing Solutions',
  description: 'Meet the experienced roofing professionals at River City Roofing Solutions in Decatur, AL. Our team brings decades of roofing expertise to every project in Huntsville, Madison, Athens & all of North Alabama.',
  path: '/team',
  keywords: ['roofing team Decatur AL', 'roofers Huntsville AL', 'professional roofing contractors North Alabama', 'roofing experts Decatur Huntsville', 'River City Roofing team'],
});

export const revalidate = 60;

export default async function TeamPage() {
  const teamMembers = await getAllTeamMembersWithOverrides(staticTeamMembers);
  const collectionSchema = generateCollectionPageSchema({
    name: 'Our Team - Meet the River City Roofing Professionals',
    description: 'Meet the experienced roofing professionals at River City Roofing Solutions. Our team brings decades of expertise to every roofing project in North Alabama.',
    url: '/team',
    numberOfItems: teamMembers.length,
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Team', url: '/team' },
  ]);

  return (
    <div className="min-h-screen">
      <StructuredData data={[collectionSchema, breadcrumbSchema]} />
      {/* Hero Section */}
      <section className="min-h-[40vh] flex items-center justify-center">
        <div className="container mx-auto px-4 text-center text-white">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 drop-shadow-lg">
            Our Team
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto text-white/90 drop-shadow-md">
            The dedicated professionals protecting North Alabama homes
          </p>
        </div>
      </section>

      {/* Team Members Grid */}
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-block mb-4">
              <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Meet the Experts</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Roofing Professionals You Can Trust
            </h2>
            <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
              Our team combines years of experience with a commitment to quality and customer satisfaction
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {teamMembers.map((member, idx) => (
              <Link key={idx} href={`/team/${member.slug}`} className="block group">
                <div className="bg-neutral-900 border border-neutral-800 hover:border-brand-green hover:shadow-xl hover:shadow-brand-green/10 transition-all duration-300 rounded-xl overflow-hidden h-full">
                  {/* Profile Image */}
                  <div className="relative h-64 bg-neutral-800">
                    {member.profileImage ? (
                      <Image
                        src={member.profileImage}
                        alt={member.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Users className="text-neutral-600" size={80} />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <span className="inline-block px-3 py-1 bg-brand-green/90 text-black text-xs font-bold rounded-full">
                        {member.category || 'Team Member'}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-white mb-1 group-hover:text-brand-green transition-colors">
                      {member.name}
                    </h3>
                    <p className="text-brand-green font-semibold text-sm mb-3">{member.position}</p>

                    {member.tagline && (
                      <p className="text-neutral-400 text-sm italic mb-4">"{member.tagline}"</p>
                    )}

                    <p className="text-neutral-300 text-sm leading-relaxed line-clamp-3 mb-4">
                      {member.bio}
                    </p>

                    {/* Contact Info */}
                    <div className="flex flex-wrap gap-3 mb-4">
                      {member.phone && ['Regional Partner', 'Sales Inspector'].includes(member.position) && (
                        <span className="flex items-center gap-1 text-xs text-neutral-400">
                          <Phone size={12} />
                          {member.phone}
                        </span>
                      )}
                      {member.email && (
                        <span className="flex items-center gap-1 text-xs text-neutral-400">
                          <Mail size={12} />
                          Email
                        </span>
                      )}
                    </div>

                    {/* View Profile */}
                    <span className="flex items-center gap-2 text-brand-green font-semibold text-sm group-hover:gap-3 transition-all">
                      View Full Profile
                      <ArrowRight size={16} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Join Our Team CTA */}
      <section className="py-12 md:py-16 bg-black/70 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Interested in Joining Our Team?
            </h2>
            <p className="text-lg text-neutral-300 mb-8">
              We're always looking for talented, hardworking individuals to join the River City Roofing family.
            </p>
            <Button asChild className="bg-brand-green hover:bg-lime-400 text-black font-bold px-8 py-6 text-lg">
              <Link href="/careers">View Open Positions</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-16 bg-brand-green/90 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-black mb-4">
            Ready to Work With Our Expert Team?
          </h2>
          <p className="text-lg text-black/75 mb-8 max-w-2xl mx-auto">
            Schedule your free inspection today and experience the River City Roofing difference.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild className="bg-black hover:bg-neutral-900 text-brand-green font-bold px-8 py-6 text-lg">
              <Link href="/contact">Schedule Free Inspection</Link>
            </Button>
            <Button asChild className="border-2 border-black text-black hover:bg-black hover:text-brand-green font-bold px-8 py-6 text-lg">
              <Link href="tel:256-274-8530">Call (256) 274-8530</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
