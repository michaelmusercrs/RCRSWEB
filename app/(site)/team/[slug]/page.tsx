import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, Phone, Award, CheckCircle2, ArrowLeft, Users, Facebook, Instagram, Twitter, Linkedin, Star, Truck, Play } from 'lucide-react';
import { getTeamMember, getAllTeamSlugs } from '@/lib/teamData';
import { getTeamMemberWithOverrides } from '@/lib/profile-overrides';
import ContactForm from '@/components/ContactForm';
import { getReviewsForMember } from '@/lib/reviewsData';
import { getReviewsForRep, getRepReviewStats } from '@/lib/rep-reviews';
import { getApprovedPortalReviews } from '@/lib/portal-reviews';
import { getApprovedImages } from '@/lib/portal-images';
import StructuredData from '@/components/StructuredData';
import { siteConfig, generatePersonSchema, generateBreadcrumbSchema } from '@/lib/seo';
// Rep stats removed — only add back with verified data
import ShareQRCode from '@/components/ShareQRCode';
import type { Metadata } from 'next';

// Revalidate every 60 seconds so approved changes show up quickly
export const revalidate = 60;

export async function generateStaticParams() {
  const slugs = getAllTeamSlugs();
  return slugs.map((slug) => ({
    slug: slug,
  }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const baseMember = getTeamMember(params.slug);
  if (!baseMember) return { title: 'Team Member Not Found' };
  const member = await getTeamMemberWithOverrides(baseMember);

  const path = `/team/${params.slug}`;
  const url = `${siteConfig.url}${path}`;
  const title = `${member.name} - ${member.position} | River City Roofing Team`;
  const description = member.tagline || `Meet ${member.name}, ${member.position} at River City Roofing Solutions. ${member.bio?.substring(0, 100)}...`;

  const trimmedDesc = description.length > 155 ? description.substring(0, 155) + '...' : description;
  // Prefer the team member's headshot if present; fall back to the site OG image.
  const memberImage = member.profileImage;
  const ogImageUrl = memberImage
    ? (memberImage.startsWith('http') ? memberImage : `${siteConfig.url}${memberImage}`)
    : `${siteConfig.url}/og-image.png`;

  return {
    title,
    description: trimmedDesc,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description: trimmedDesc,
      url: `${siteConfig.url}${path}`,
      siteName: siteConfig.name,
      type: 'profile',
      locale: 'en_US',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${member.name} — ${member.position}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: trimmedDesc,
      images: [ogImageUrl],
    },
  };
}

export default async function TeamMemberPage({ params }: { params: { slug: string } }) {
  const baseMember = getTeamMember(params.slug);

  if (!baseMember) {
    notFound();
  }

  // Apply approved profile overrides
  const member = await getTeamMemberWithOverrides(baseMember);

  // Get reviews from three sources, in priority order:
  //   1. Portal-submitted reviews (verified, by-job from customers via the portal)
  //   2. Master review JSON (data/reviews-master.json — 317 imported from CSVs)
  //   3. Static reviewsData.ts fallback (small hand-curated set, last resort)
  const portalReviews = await getApprovedPortalReviews(params.slug);
  const masterReviews = getReviewsForRep(params.slug);
  const masterStats = getRepReviewStats(params.slug);
  const staticReviews = getReviewsForMember(params.slug, 3);

  let memberReviews;
  if (portalReviews.length > 0) {
    memberReviews = portalReviews.slice(0, 6);
  } else if (masterReviews.length > 0) {
    memberReviews = masterReviews.slice(0, 6);
  } else {
    memberReviews = staticReviews;
  }

  // Get approved images from portal
  const approvedImages = await getApprovedImages(params.slug);
  const jobBeforeImages = approvedImages.filter(img => img.type === 'job-before');
  const jobAfterImages = approvedImages.filter(img => img.type === 'job-after');
  const videoImages = approvedImages.filter(img => img.type === 'video');

  // Use approved portal profile/truck images if available
  const profileImageFromPortal = approvedImages.find(img => img.type === 'profile');
  const truckImageFromPortal = approvedImages.find(img => img.type === 'truck');
  const effectiveProfileImage = profileImageFromPortal?.url || member.profileImage;
  const effectiveTruckImage = truckImageFromPortal?.url || member.truckImage;

  // Generate structured data for team member
  const personSchema = generatePersonSchema({
    name: member.name,
    jobTitle: member.position,
    description: member.bio,
    image: effectiveProfileImage,
    email: member.email,
    telephone: ['Regional Partner', 'Sales Inspector'].includes(member.position) ? member.phone : undefined,
    url: `${siteConfig.url}/team/${params.slug}`,
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Team', url: '/team' },
    { name: member.name, url: `/team/${params.slug}` },
  ]);

  return (
    <div className="min-h-screen">
      {/* Person and Breadcrumb Schema */}
      <StructuredData data={[personSchema, breadcrumbSchema]} />
      {/* Hero Section */}
      <section className="relative w-full min-h-[40vh] flex items-center justify-center overflow-hidden py-12">
        <div className="relative z-20 container mx-auto px-4 text-center text-white">
          <Link
            href="/about"
            className="inline-flex items-center gap-2 text-white hover:text-brand-green mb-6 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Team
          </Link>
          <h1 className="text-5xl md:text-6xl font-bold mb-4 drop-shadow-lg">{member.name}</h1>
          <p className="text-2xl text-brand-green font-semibold">{member.position}</p>
        </div>
      </section>

      {/* Profile Section */}
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-12">
              {/* Left Column - Profile Card */}
              <div className="md:col-span-1">
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-8 rounded-lg sticky top-24">
                  {/* Profile Image */}
                  <div className="w-48 h-48 bg-gray-300 rounded-full mx-auto mb-6 flex items-center justify-center overflow-hidden relative">
                    {effectiveProfileImage ? (
                      <Image
                        src={effectiveProfileImage}
                        alt={member.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <Users className="text-gray-500" size={96} />
                    )}
                  </div>

                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">{member.name}</h2>
                    <p className="text-lg text-brand-green font-semibold mb-4">{member.position}</p>
                    {member.tagline && (
                      <p className="text-sm text-gray-400 italic">{member.tagline}</p>
                    )}
                  </div>

                  {/* Contact Info - Only show if available */}
                  {(member.phone || member.email) && (
                    <div className="border-t border-white/20 pt-6 space-y-4 mb-6">
                      {member.phone && ['Regional Partner', 'Sales Inspector'].includes(member.position) && (
                        <div className="flex items-start gap-3">
                          <Phone className="text-brand-green mt-1 flex-shrink-0" size={20} />
                          <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Phone</p>
                            <a
                              href={`tel:${member.phone.replace(/\D/g, '')}`}
                              className="text-gray-200 hover:text-brand-green font-medium"
                            >
                              {member.phone}
                            </a>
                          </div>
                        </div>
                      )}
                      {member.email && (
                        <div className="flex items-start gap-3">
                          <Mail className="text-brand-green mt-1 flex-shrink-0" size={20} />
                          <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Email</p>
                            <a
                              href={`mailto:${member.email}`}
                              className="text-gray-200 hover:text-brand-green font-medium break-all"
                            >
                              {member.email}
                            </a>
                          </div>
                        </div>
                      )}
                      {member.region && (
                        <div className="flex items-start gap-3">
                          <Award className="text-brand-green mt-1 flex-shrink-0" size={20} />
                          <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Region</p>
                            <p className="text-gray-200 font-medium">{member.region}</p>
                            {member.launchDate && (
                              <p className="text-xs text-gray-400 mt-1">Launch: {member.launchDate}</p>
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

                  {/* QR Code Share Button */}
                  <div className="mt-3 flex justify-center">
                    <ShareQRCode slug={params.slug} name={member.name} />
                  </div>

                  {/* Social Media Links */}
                  {(member.facebook || member.instagram || member.tiktok || member.x || member.linkedin) && (
                    <div className="border-t border-white/20 pt-6 mt-6">
                      <p className="text-xs text-gray-400 uppercase tracking-wide mb-3 text-center">Connect</p>
                      <div className="flex justify-center gap-3">
                        {member.facebook && (
                          <a
                            href={member.facebook}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-10 h-10 bg-white/10 hover:bg-blue-600 text-white rounded-full flex items-center justify-center transition-colors"
                          >
                            <Facebook size={20} />
                          </a>
                        )}
                        {member.instagram && (
                          <a
                            href={member.instagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-10 h-10 bg-white/10 hover:bg-pink-600 text-white rounded-full flex items-center justify-center transition-colors"
                          >
                            <Instagram size={20} />
                          </a>
                        )}
                        {member.tiktok && (
                          <a
                            href={member.tiktok}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-10 h-10 bg-white/10 hover:bg-brand-green text-white rounded-full flex items-center justify-center transition-colors"
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
                            className="w-10 h-10 bg-white/10 hover:bg-gray-600 text-white rounded-full flex items-center justify-center transition-colors"
                          >
                            <Twitter size={20} />
                          </a>
                        )}
                        {member.linkedin && (
                          <a
                            href={member.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-10 h-10 bg-white/10 hover:bg-blue-700 text-white rounded-full flex items-center justify-center transition-colors"
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
                  <h3 className="text-3xl font-bold text-white mb-6">About {member.name.split(' ')[0]}</h3>
                  <div className="space-y-4 text-lg text-gray-300 leading-relaxed">
                    <p>{member.bio}</p>
                  </div>
                </div>

                {/* Category Badge */}
                <div className="mb-12">
                  <div className="inline-flex items-center gap-2 bg-brand-green/20 border border-brand-green/30 px-4 py-2 rounded-full">
                    <Award className="text-brand-green" size={18} />
                    <span className="text-white font-medium">{member.category}</span>
                  </div>
                </div>

                {/* Key Strengths */}
                {member.keyStrengths && member.keyStrengths.length > 0 && (
                  <div className="mb-12">
                    <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                      <CheckCircle2 className="text-brand-green" size={24} />
                      Key Strengths
                    </h3>
                    <ul className="space-y-3">
                      {member.keyStrengths.map((strength, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <CheckCircle2 className="text-brand-green mt-1 flex-shrink-0" size={20} />
                          <span className="text-gray-300">{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Responsibilities */}
                {member.responsibilities && member.responsibilities.length > 0 && (
                  <div className="mb-12">
                    <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                      <Award className="text-brand-blue" size={24} />
                      Key Responsibilities
                    </h3>
                    <ul className="space-y-3">
                      {member.responsibilities.map((responsibility, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-brand-blue rounded-full mt-2 flex-shrink-0" />
                          <span className="text-gray-300">{responsibility}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Truck Image - Shows what vehicle to expect */}
                {effectiveTruckImage && (
                  <div className="mb-12">
                    <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                      <Truck className="text-blue-400" size={24} />
                      Look For My Truck
                    </h3>
                    <p className="text-gray-400 mb-4 text-sm">
                      When I visit your property, you will see this vehicle:
                    </p>
                    <div className="relative aspect-video max-w-xl rounded-xl overflow-hidden border border-white/10">
                      <Image
                        src={effectiveTruckImage}
                        alt={`${member.name}'s work truck`}
                        fill
                        className="object-cover"
                      />
                    </div>
                  </div>
                )}

                {/* Job Photos Gallery */}
                {(jobBeforeImages.length > 0 || jobAfterImages.length > 0) && (
                  <div className="mb-12">
                    <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                      <CheckCircle2 className="text-brand-green" size={24} />
                      Our Work
                    </h3>

                    {jobBeforeImages.length > 0 && jobAfterImages.length > 0 ? (
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-lg font-semibold text-white mb-3">Before</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {jobBeforeImages.map(img => (
                              <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden border border-white/10">
                                <Image src={img.url} alt="Before" fill className="object-cover" />
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-white mb-3">After</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {jobAfterImages.map(img => (
                              <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden border border-white/10">
                                <Image src={img.url} alt="After" fill className="object-cover" />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-3">
                        {[...jobBeforeImages, ...jobAfterImages].map(img => (
                          <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden border border-white/10">
                            <Image src={img.url} alt="Job photo" fill className="object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Video Gallery */}
                {videoImages.length > 0 && (
                  <div className="mb-12">
                    <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                      <Play className="text-red-400" size={24} />
                      Videos
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {videoImages.map(vid => (
                        <div key={vid.id} className="rounded-xl overflow-hidden border border-white/10">
                          <video
                            src={vid.url}
                            controls
                            className="w-full aspect-video"
                            preload="metadata"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Customer Reviews Section */}
      {memberReviews.length > 0 && (
        <section className="py-12 md:py-16 bg-black/70 backdrop-blur-sm">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 bg-brand-green/20 border border-brand-green/30 px-4 py-2 rounded-full mb-4">
                  <Star className="text-brand-green" size={18} />
                  <span className="text-white font-medium">Customer Reviews</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  What Customers Say
                </h2>
                {masterStats.total > 0 && (
                  <div className="flex flex-wrap items-center justify-center gap-4 mt-4 text-sm">
                    <div className="bg-brand-green/10 border border-brand-green/30 rounded-lg px-4 py-2">
                      <div className="text-2xl font-black text-brand-green">{masterStats.total}</div>
                      <div className="text-xs text-neutral-300 uppercase tracking-wider">Total Reviews</div>
                    </div>
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-2">
                      <div className="text-2xl font-black text-yellow-400">{masterStats.averageRating.toFixed(1)} ★</div>
                      <div className="text-xs text-neutral-300 uppercase tracking-wider">Avg Rating</div>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-2">
                      <div className="text-2xl font-black text-blue-400">{masterStats.last365Days}</div>
                      <div className="text-xs text-neutral-300 uppercase tracking-wider">Last 12 Months</div>
                    </div>
                    {masterStats.lastReviewDate && (
                      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg px-4 py-2">
                        <div className="text-2xl font-black text-purple-400">
                          {masterStats.daysSinceLastReview !== null && masterStats.daysSinceLastReview <= 30
                            ? `${masterStats.daysSinceLastReview}d`
                            : new Date(masterStats.lastReviewDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </div>
                        <div className="text-xs text-neutral-300 uppercase tracking-wider">Last Review</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {memberReviews.slice(0, 6).map((review, idx) => (
                  <Card key={'id' in review ? review.id : idx} className="border-neutral-800 bg-black/50">
                    <CardContent className="p-6">
                      <div className="flex mb-4">
                        {[...Array(review.rating)].map((_, i) => (
                          <span key={i} className="text-brand-green text-lg">★</span>
                        ))}
                      </div>
                      <p className="text-gray-300 italic leading-relaxed mb-4 text-sm line-clamp-4">
                        &quot;{review.text}&quot;
                      </p>
                      <div className="border-t border-neutral-700 pt-4">
                        <p className="font-bold text-brand-green text-sm">
                          {'customerName' in review ? review.customerName : review.name}
                        </p>
                        {'salesRep' in review && review.salesRep && (
                          <p className="text-gray-500 text-xs">Worked with {review.salesRep}</p>
                        )}
                        {'source' in review && review.source && (
                          <p className="text-gray-600 text-xs mt-1">via {review.source}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Contact Form Section */}
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Work With {member.name.split(' ')[0]}
            </h2>
            <p className="text-xl text-gray-300">
              Ready to discuss your roofing project? Fill out the form below and {member.name.split(' ')[0]} will get back to you.
            </p>
          </div>
          <ContactForm
            showContactInfo={false}
            darkMode={true}
            preselectedTeamMember={member.slug}
            sourcePage={`Team Page - ${member.name}`}
          />
        </div>
      </section>

      {/* Back to Team Link */}
      <section className="py-12 bg-black/60 backdrop-blur-sm">
        <div className="container mx-auto px-4 text-center">
          <Link
            href="/about"
            className="inline-flex items-center gap-2 text-white hover:text-brand-green font-semibold text-lg transition-colors"
          >
            <ArrowLeft size={20} />
            View All Team Members
          </Link>
        </div>
      </section>
    </div>
  );
}
