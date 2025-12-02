import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Mail, Phone, Award, Shield, Users, CheckCircle2, ArrowRight } from 'lucide-react';
import { teamMembers } from '@/lib/teamData';
import VideoBackground from '@/components/VideoBackground';

export default async function AboutPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="min-h-[50vh] flex items-center justify-center">
        <div className="container mx-auto px-4 text-center text-white">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 drop-shadow-lg">
            Meet Our Team
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto text-white/90 drop-shadow-md">
            The experienced professionals protecting North Alabama homes
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
                River City Roofing Solutions was founded in 2010 with a simple mission: provide North Alabama
                homeowners with honest, reliable roofing services they can trust. What started as a small,
                family-owned business has grown into one of the region's most respected roofing companies.
              </p>
              <p>
                We've built our reputation one roof at a time, always putting quality workmanship and customer
                satisfaction first. Our team combines decades of experience with the latest industry techniques
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

      {/* Our Values Section */}
      <section className="py-12 md:py-16 bg-brand-blue/90 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Our Values
            </h2>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
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
                  <p className="text-blue-100">{value.desc}</p>
                </div>
              );
            })}
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
