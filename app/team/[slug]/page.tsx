import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Mail, Phone, Award, CheckCircle2, ArrowLeft, Users, Facebook, Instagram, Twitter, Linkedin } from 'lucide-react';
import { getTeamMember, getAllTeamSlugs } from '@/lib/teamData';

export async function generateStaticParams() {
  const slugs = getAllTeamSlugs();
  return slugs.map((slug) => ({
    slug: slug,
  }));
}

export default function TeamMemberPage({ params }: { params: { slug: string } }) {
  const member = getTeamMember(params.slug);

  if (!member) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative w-full h-[40vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 z-0" />
        <div className="absolute inset-0 bg-black/50 z-10" />

        <div className="relative z-20 container mx-auto px-4 text-center text-white">
          <Link
            href="/about"
            className="inline-flex items-center gap-2 text-white hover:text-brand-green mb-6 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Team
          </Link>
          <h1 className="text-5xl md:text-6xl font-bold mb-4">{member.name}</h1>
          <p className="text-2xl text-brand-green font-semibold">{member.role}</p>
        </div>
      </section>

      {/* Profile Section - White BG */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-12">
              {/* Left Column - Profile Card */}
              <div className="md:col-span-1">
                <div className="bg-gray-50 border border-gray-200 p-8 rounded-lg sticky top-8">
                  {/* Profile Image */}
                  <div className="w-48 h-48 bg-gray-300 rounded-full mx-auto mb-6 flex items-center justify-center overflow-hidden relative">
                    {member.profileImage ? (
                      <Image
                        src={member.profileImage}
                        alt={member.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <Users className="text-gray-500" size={96} />
                    )}
                  </div>

                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-brand-black mb-2">{member.name}</h2>
                    <p className="text-lg text-brand-blue font-semibold mb-4">{member.position}</p>
                    {member.tagline && (
                      <p className="text-sm text-gray-500 italic">{member.tagline}</p>
                    )}
                  </div>

                  {/* Contact Info - Only show if available */}
                  {(member.phone || member.email) && (
                    <div className="border-t border-gray-300 pt-6 space-y-4 mb-6">
                      {member.phone && (
                        <div className="flex items-start gap-3">
                          <Phone className="text-brand-blue mt-1 flex-shrink-0" size={20} />
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Phone</p>
                            <a
                              href={`tel:${member.phone.replace(/\D/g, '')}`}
                              className="text-gray-700 hover:text-brand-blue font-medium"
                            >
                              {member.phone}
                            </a>
                          </div>
                        </div>
                      )}
                      {member.email && (
                        <div className="flex items-start gap-3">
                          <Mail className="text-brand-blue mt-1 flex-shrink-0" size={20} />
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Email</p>
                            <a
                              href={`mailto:${member.email}`}
                              className="text-gray-700 hover:text-brand-blue font-medium break-all"
                            >
                              {member.email}
                            </a>
                          </div>
                        </div>
                      )}
                      {member.region && (
                        <div className="flex items-start gap-3">
                          <Award className="text-brand-blue mt-1 flex-shrink-0" size={20} />
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Region</p>
                            <p className="text-gray-700 font-medium">{member.region}</p>
                            {member.launchDate && (
                              <p className="text-xs text-gray-500 mt-1">Launch: {member.launchDate}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CTA Button - Only show if email exists */}
                  {member.email && (
                    <Button asChild className="w-full bg-brand-blue hover:bg-blue-700 text-white font-bold">
                      <a href={`mailto:${member.email}`}>Contact {member.name.split(' ')[0]}</a>
                    </Button>
                  )}

                  {/* Social Media Links */}
                  {(member.facebook || member.instagram || member.tiktok || member.x || member.linkedin) && (
                    <div className="border-t border-gray-300 pt-6 mt-6">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-3 text-center">Connect</p>
                      <div className="flex justify-center gap-3">
                        {member.facebook && (
                          <a
                            href={member.facebook}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-10 h-10 bg-gray-200 hover:bg-blue-600 hover:text-white rounded-full flex items-center justify-center transition-colors"
                          >
                            <Facebook size={20} />
                          </a>
                        )}
                        {member.instagram && (
                          <a
                            href={member.instagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-10 h-10 bg-gray-200 hover:bg-pink-600 hover:text-white rounded-full flex items-center justify-center transition-colors"
                          >
                            <Instagram size={20} />
                          </a>
                        )}
                        {member.tiktok && (
                          <a
                            href={member.tiktok}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-10 h-10 bg-gray-200 hover:bg-black hover:text-white rounded-full flex items-center justify-center transition-colors group relative"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                            </svg>
                          </a>
                        )}
                        {member.x && (
                          <a
                            href={member.x}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-10 h-10 bg-gray-200 hover:bg-black hover:text-white rounded-full flex items-center justify-center transition-colors"
                          >
                            <Twitter size={20} />
                          </a>
                        )}
                        {member.linkedin && (
                          <a
                            href={member.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-10 h-10 bg-gray-200 hover:bg-blue-700 hover:text-white rounded-full flex items-center justify-center transition-colors"
                          >
                            <Linkedin size={20} />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Content */}
              <div className="md:col-span-2">
                {/* Bio */}
                <div className="mb-12">
                  <h3 className="text-3xl font-bold text-brand-black mb-6">About {member.name.split(' ')[0]}</h3>
                  <div className="space-y-4 text-lg text-gray-600 leading-relaxed">
                    <p>{member.bio}</p>
                  </div>
                </div>

                {/* Category Badge */}
                <div className="mb-12">
                  <div className="inline-flex items-center gap-2 bg-brand-blue/10 border border-brand-blue/20 px-4 py-2 rounded-full">
                    <Award className="text-brand-blue" size={18} />
                    <span className="text-brand-black font-medium">{member.category}</span>
                  </div>
                </div>

                {/* Key Strengths - Only show if available */}
                {member.keyStrengths && member.keyStrengths.length > 0 && (
                  <div className="mb-12">
                    <h3 className="text-2xl font-bold text-brand-black mb-4 flex items-center gap-2">
                      <CheckCircle2 className="text-brand-green" size={24} />
                      Key Strengths
                    </h3>
                    <ul className="space-y-3">
                      {member.keyStrengths.map((strength, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <CheckCircle2 className="text-brand-green mt-1 flex-shrink-0" size={20} />
                          <span className="text-gray-700">{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Responsibilities - Only show if available */}
                {member.responsibilities && member.responsibilities.length > 0 && (
                  <div className="mb-12">
                    <h3 className="text-2xl font-bold text-brand-black mb-4 flex items-center gap-2">
                      <Award className="text-brand-blue" size={24} />
                      Key Responsibilities
                    </h3>
                    <ul className="space-y-3">
                      {member.responsibilities.map((responsibility, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-brand-blue rounded-full mt-2 flex-shrink-0" />
                          <span className="text-gray-700">{responsibility}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Blue BG - Only show if contact info exists */}
      {(member.email || member.phone) && (
        <section className="py-16 md:py-24 bg-brand-blue">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Work With {member.name.split(' ')[0]}
              </h2>
              <p className="text-xl text-blue-100 mb-8">
                Ready to discuss your roofing project? Get in touch with {member.name.split(' ')[0]} today
                for expert guidance and a free inspection.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {member.email && (
                  <Button asChild className="bg-brand-green hover:bg-brand-blue text-white font-bold px-8 py-6 text-lg">
                    <a href={`mailto:${member.email}`}>Send Email</a>
                  </Button>
                )}
                {member.phone && (
                  <Button asChild className="border-2 border-white text-white hover:bg-white hover:text-brand-blue font-bold px-8 py-6 text-lg">
                    <a href={`tel:${member.phone.replace(/\D/g, '')}`}>Call Now</a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Back to Team Link */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4 text-center">
          <Link
            href="/about"
            className="inline-flex items-center gap-2 text-brand-blue hover:text-blue-700 font-semibold text-lg transition-colors"
          >
            <ArrowLeft size={20} />
            View All Team Members
          </Link>
        </div>
      </section>
    </div>
  );
}
