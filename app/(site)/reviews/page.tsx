import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Star, ExternalLink, CheckCircle2, Shield, Clock, ThumbsUp, Award, ArrowRight } from 'lucide-react';
import { loadAllReviews } from '@/lib/reviews-loader';
import { getMasterStats } from '@/lib/rep-reviews';
import { generateMetadata as genMeta, generateBreadcrumbSchema, siteConfig } from '@/lib/seo';
import StructuredData from '@/components/StructuredData';
import type { Metadata } from 'next';

export const metadata: Metadata = genMeta({
  title: 'Customer Reviews',
  description: 'Read real reviews from North Alabama homeowners. 5-star rated roofing contractor serving Decatur, Huntsville, Madison & more.',
  path: '/reviews',
  keywords: ['roofing reviews', 'roofing testimonials', 'Decatur roofer reviews', 'Huntsville roofing reviews', 'North Alabama roofer ratings'],
});

// Revalidate the reviews page every 5 minutes so newly-added rows in the
// Google Sheet show up without requiring a redeploy.
export const revalidate = 300;

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={18}
          className={i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}
        />
      ))}
    </div>
  );
}

export default async function ReviewsPage() {
  const { reviews: allReviews } = await loadAllReviews();
  const masterStats = getMasterStats();
  // Real stats from data/reviews-master.json (317 reviews, 92% 5-star, 4.86 avg)
  const totalCount = Math.max(allReviews.length, masterStats.total);
  const fiveStarPct = masterStats.total > 0
    ? Math.round((masterStats.fiveStar / masterStats.total) * 100)
    : 100;
  const avgRatingDisplay = masterStats.averageRating > 0
    ? masterStats.averageRating.toFixed(2)
    : '5.0';

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Reviews', url: '/reviews' },
  ]);

  const reviewAggregateSchema = {
    '@context': 'https://schema.org',
    '@type': 'RoofingContractor',
    '@id': `${siteConfig.url}#organization`,
    name: siteConfig.name,
    url: siteConfig.url,
    telephone: siteConfig.phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: siteConfig.address.streetAddress,
      addressLocality: siteConfig.address.addressLocality,
      addressRegion: siteConfig.address.addressRegion,
      postalCode: siteConfig.address.postalCode,
      addressCountry: siteConfig.address.addressCountry,
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: siteConfig.reviewStats.ratingValue,
      reviewCount: String(Math.max(Number(siteConfig.reviewStats.reviewCount), allReviews.length)),
      bestRating: siteConfig.reviewStats.bestRating,
      worstRating: siteConfig.reviewStats.worstRating,
    },
    review: allReviews.slice(0, 10).map((r) => ({
      '@type': 'Review',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
      author: { '@type': 'Person', name: r.name },
      datePublished: r.date,
      reviewBody: r.text,
    })),
  };

  return (
    <div className="min-h-screen">
      <StructuredData data={[reviewAggregateSchema, breadcrumbSchema]} />

      {/* Hero Section */}
      <section className="min-h-[50vh] flex items-center justify-center">
        <div className="container mx-auto px-4 text-center text-white">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 drop-shadow-lg">
            Customer Reviews
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto text-white/90 drop-shadow-md">
            See why North Alabama homeowners trust River City Roofing Solutions
          </p>
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={28} className="text-yellow-400 fill-yellow-400" />
              ))}
            </div>
            <span className="text-2xl font-bold text-white ml-2">{avgRatingDisplay}</span>
            <span className="text-white/80 text-lg">({totalCount} Verified Reviews)</span>
          </div>
        </div>
      </section>

      {/* Rating Summary Bar */}
      <section className="py-8 bg-black/90 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-4xl font-bold text-brand-green">{avgRatingDisplay}</div>
              <div className="text-neutral-300 text-sm mt-1">Average Rating</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-brand-green">{totalCount}</div>
              <div className="text-neutral-300 text-sm mt-1">Total Reviews</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-brand-green">{fiveStarPct}%</div>
              <div className="text-neutral-300 text-sm mt-1">5-Star Reviews</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-brand-green">A+</div>
              <div className="text-neutral-300 text-sm mt-1">BBB Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* Google Reviews Section */}
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Google Reviews
            </h2>
            <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
              Real reviews from real homeowners across North Alabama
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {allReviews.map((review) => (
              <div
                key={review.id}
                className="bg-neutral-800 border border-neutral-700 rounded-lg p-6 hover:border-brand-green/50 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-white font-semibold text-lg">{review.name}</h3>
                    <p className="text-neutral-500 text-sm">
                      {new Date(review.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-neutral-400 bg-neutral-700 px-2 py-1 rounded">
                    <span className="font-medium">Google</span>
                  </div>
                </div>
                <StarRating rating={review.rating} />
                <p className="text-neutral-300 mt-3 leading-relaxed text-sm">
                  &ldquo;{review.text}&rdquo;
                </p>
                {review.salesRep && (
                  <p className="text-brand-green text-xs mt-3 font-medium">
                    Worked with: {review.salesRep}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Button asChild className="bg-brand-green hover:bg-lime-400 text-black font-bold px-8 py-6 text-lg">
              <a
                href="https://g.page/r/CfEkY1DPAq8TEBM/review"
                target="_blank"
                rel="noopener noreferrer"
              >
                Leave Us a Review <ExternalLink size={18} className="ml-2" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Why Customers Choose Us */}
      <section className="py-12 md:py-16 bg-black/70 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Why Customers Choose Us
            </h2>
            <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
              What sets River City Roofing Solutions apart from the competition
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {[
              {
                icon: Shield,
                title: 'Licensed & Insured',
                desc: 'Fully licensed and insured for your complete peace of mind on every project.',
              },
              {
                icon: Clock,
                title: 'Fast Response',
                desc: 'We respond to every inquiry within 24 hours and schedule inspections quickly.',
              },
              {
                icon: ThumbsUp,
                title: 'Insurance Experts',
                desc: 'We handle the entire insurance claims process so you don\'t have to.',
              },
              {
                icon: Award,
                title: 'Multi-Certified',
                desc: 'IKO ROOFPRO Craftsman Premier, Owens Corning Preferred Contractor, and Boral Certified LeafX Dealer.',
              },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="flex flex-col items-center text-center">
                  <div className="bg-brand-green rounded-full p-4 mb-4">
                    <Icon className="text-black" size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-neutral-400">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Our Work Highlights */}
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Our Work Across North Alabama
            </h2>
            <p className="text-lg text-neutral-300 mb-8 max-w-2xl mx-auto">
              From storm damage repairs to complete roof replacements, we deliver quality results on every project.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { city: 'Decatur, AL', type: 'Storm Damage Repair', desc: 'Complete tear-off and replacement after severe hail damage. IKO Dynasty shingles installed.' },
                { city: 'Huntsville, AL', type: 'Full Roof Replacement', desc: 'Aging 20-year roof replaced with architectural shingles. New ridge vents and flashing.' },
                { city: 'Madison, AL', type: 'Insurance Claim Project', desc: 'Wind damage claim handled start to finish. New drip edge, underlayment, and shingles.' },
              ].map((project, idx) => (
                <div key={idx} className="bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden hover:border-brand-green/50 transition-all">
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-brand-green text-xs font-semibold uppercase tracking-wide">{project.type}</span>
                    </div>
                    <h3 className="text-white font-bold text-lg mb-1 flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-brand-green flex-shrink-0" />
                      {project.city}
                    </h3>
                    <p className="text-neutral-400 text-sm leading-relaxed">{project.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <Button asChild className="border-2 border-white text-white hover:bg-white hover:text-black font-bold px-8 py-6 text-lg">
                <Link href="/gallery">
                  View Full Gallery <ArrowRight size={18} className="ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto border-l-4 border-brand-green pl-8">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Ready to Experience 5-Star Service?
            </h2>
            <p className="text-xl text-neutral-300 mb-8">
              Join hundreds of satisfied homeowners across North Alabama. Schedule your free roof inspection today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild className="bg-brand-green hover:bg-lime-400 text-black font-bold px-8 py-6 text-lg">
                <Link href="/contact">Get Your Free Inspection</Link>
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
