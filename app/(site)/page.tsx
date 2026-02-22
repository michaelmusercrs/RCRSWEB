import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Shield, Award, Users, CheckCircle2, ArrowRight, CloudLightning } from 'lucide-react';

import RotatingText from '@/components/RotatingText';
import StructuredData from '@/components/StructuredData';
import { generateFAQSchema, generateHomepageStructuredData } from '@/lib/seo';
import { blogPosts } from '@/lib/blogData';
import { services, serviceAreas } from '@/lib/servicesData';
import { getFeaturedReviews } from '@/lib/reviewsData';

export default function HomePage() {
  // Get latest 3 blog posts (array is sorted oldest-first, so take from end)
  const latestPosts = [...blogPosts].reverse().slice(0, 3);

  // Get primary services
  const primaryServices = services.filter(s => s.category === 'Primary').slice(0, 6);

  // Get active service areas
  const activeAreas = serviceAreas.filter(a => a.status === 'Active');

  // Get featured reviews
  const featuredReviews = getFeaturedReviews(6);

  // Homepage FAQ data
  const homepageFAQs = [
    {
      question: 'How much does a new roof cost in North Alabama?',
      answer: 'A typical residential roof replacement in North Alabama ranges from $5,000 to $25,000+ depending on the size of your roof, materials chosen, and complexity of the job. We offer free inspections and detailed quotes so you know exactly what to expect.',
    },
    {
      question: 'Do you offer free roof inspections?',
      answer: 'Yes! We provide completely free, no-obligation roof inspections for homeowners across North Alabama. Our certified inspectors will assess your roof\'s condition, document any issues with photos, and provide honest recommendations.',
    },
    {
      question: 'How long does a roof replacement take?',
      answer: 'Most residential roof replacements are completed in 1-3 days, depending on the size and complexity of the project. We work efficiently to minimize disruption to your daily life while ensuring top-quality workmanship.',
    },
    {
      question: 'Do you help with insurance claims for storm damage?',
      answer: 'Absolutely! We have extensive experience working with insurance companies on storm and hail damage claims. We handle all documentation, photos, and communication with your insurance adjuster to maximize your claim.',
    },
    {
      question: 'What areas do you serve?',
      answer: 'We serve all of North Alabama including Decatur, Huntsville, Madison, Athens, Owens Cross Roads, and surrounding communities. We\'re expanding to Birmingham and Nashville. Contact us to confirm service in your area.',
    },
  ];

  const faqSchema = generateFAQSchema(homepageFAQs);
  const homepageSchemas = generateHomepageStructuredData();

  return (
    <div className="min-h-screen text-white overflow-x-hidden">
      <StructuredData data={[...homepageSchemas, faqSchema]} />
      {/* Hero Section - Uses global video background */}
      <div className="-mt-20 min-h-screen flex items-center justify-center px-6 pt-20">
        <div className="max-w-5xl mx-auto text-center">
          {/* HUGE Centered Logo - Acts as Home Button */}
          <Link href="/" className="block mb-4">
            <Image
              src="/logo-nobg.png"
              alt="River City Roofing Solutions"
              width={600}
              height={400}
              className="mx-auto w-96 h-auto md:w-[460px] lg:w-[600px] object-contain drop-shadow-2xl"
              priority
            />
          </Link>

          {/* Rotating Tagline - Royal Blue */}
          <RotatingText
            phrases={[
              "Local Professionals",
              "Family Owned",
              "★★★★★ Rated",
              "Licensed & Insured",
              "Storm Damage Experts"
            ]}
            interval={5000}
            className="text-xl md:text-3xl lg:text-4xl font-black uppercase tracking-wider text-brand-blue mb-4 min-h-[3rem] drop-shadow-lg"
          />

          {/* Subtitle - White with shadow for visibility */}
          <h1 className="text-2xl md:text-3xl lg:text-4xl max-w-2xl mx-auto text-white leading-relaxed mb-6 drop-shadow-lg font-black uppercase tracking-wider">
            North Alabama&apos;s Premier Roofing Company
          </h1>

          {/* CTA Buttons - Green with Blue Text */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-brand-green text-brand-blue hover:bg-lime-400 font-bold uppercase tracking-widest px-10 py-7 text-lg shadow-xl">
              <Link href="/contact">Get Free Inspection</Link>
            </Button>
            <Button asChild size="lg" className="bg-brand-green text-brand-blue hover:bg-lime-400 font-bold uppercase tracking-widest px-10 py-7 text-lg shadow-xl">
              <Link href="tel:256-274-8530">Call (256) 274-8530</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Intro Section - Semi-transparent */}
      <section className="py-12 md:py-16 px-6 bg-black/85 backdrop-blur-sm border-t border-neutral-800">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-block mb-4">
            <span className="text-xs uppercase tracking-widest font-bold text-brand-green">About Us</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-wider mb-6">
            Protecting North Alabama Homes Since 2010
          </h2>
          <p className="text-lg text-neutral-300 leading-relaxed mb-8 max-w-3xl mx-auto">
            River City Roofing Solutions is your local, family-owned roofing company serving communities across North Alabama.
            We specialize in residential and commercial roofing with a commitment to quality workmanship, honest pricing, and exceptional customer service.
          </p>
          <div className="border-l-4 border-brand-green pl-6 text-left inline-block">
            <p className="text-xl font-bold mb-2 text-brand-green uppercase tracking-wider">
              Licensed • Insured • Locally Owned
            </p>
            <p className="text-neutral-400">
              Your neighbors trust us, and you can too.
            </p>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-12 md:py-16 px-6 bg-black/80 backdrop-blur-sm border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <span className="text-xs uppercase tracking-widest font-bold text-brand-green">What We Do</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-wider mb-4">
              Our Services
            </h2>
            <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
              Complete roofing solutions for residential and commercial properties
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {primaryServices.map((service, idx) => (
              <Link key={service.id} href={`/services/${service.slug}`} className="block">
                <Card
                  className={`border-neutral-800 hover:bg-brand-green hover:text-black transition-all duration-300 group cursor-pointer h-full ${
                    idx === 1 ? 'bg-black' : 'bg-neutral-950'
                  }`}
                >
                  <CardContent className="p-6 lg:p-8">
                    <div className="w-6 h-6 border-2 border-brand-green group-hover:border-black rounded mb-6"></div>
                    <h3 className="text-lg font-black uppercase tracking-wider mb-3 text-white group-hover:text-black">
                      {service.title}
                    </h3>
                    <p className="text-neutral-300 group-hover:text-black/75 text-sm mb-4 leading-relaxed">
                      {service.description}
                    </p>
                    <span className="text-brand-green group-hover:text-black font-bold text-sm uppercase tracking-widest flex items-center gap-2">
                      Learn More <ArrowRight className="h-4 w-4" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button asChild size="lg" className="bg-brand-green text-black hover:bg-white font-bold uppercase tracking-widest">
              <Link href="/services">View All Services</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Service Areas Section */}
      <section className="py-12 md:py-16 px-6 bg-black/85 backdrop-blur-sm border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Where We Work</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-wider mb-4">
              Service Areas
            </h2>
            <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
              Proudly serving North Alabama and expanding to Tennessee
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
            {activeAreas.map((area) => (
              <Link key={area.id} href={`/service-areas/${area.slug}`} className="block">
                <Card
                  className="border-neutral-800 bg-black hover:border-brand-green transition-all duration-300 group text-center overflow-hidden"
                >
                  {area.image && (
                    <div className="h-32 relative">
                      <Image src={area.image} alt={`${area.name} ${area.state} roofing`} fill className="object-cover" />
                      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-all" />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                        <h3 className="font-black uppercase tracking-wider text-lg text-white drop-shadow-lg">
                          {area.name}
                        </h3>
                      </div>
                    </div>
                  )}
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-brand-green flex-shrink-0" />
                      <p className="text-xs text-neutral-300 uppercase tracking-widest">
                        {area.state}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button asChild size="lg" className="bg-brand-green text-black hover:bg-white font-bold uppercase tracking-widest">
              <Link href="/service-areas">View All Areas</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Blog Posts Section */}
      <section className="py-12 md:py-16 px-6 bg-black/80 backdrop-blur-sm border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Latest Insights</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-wider mb-4">
              Roofing Blog
            </h2>
            <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
              Expert advice and tips for North Alabama homeowners
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {latestPosts.map((post) => (
              <Card
                key={post.id}
                className="border-neutral-800 overflow-hidden hover:border-brand-green transition-all duration-300 group"
              >
                <div className="w-full h-56 relative bg-neutral-900">
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <CardContent className="p-6">
                  <p className="text-xs text-neutral-400 uppercase tracking-widest mb-2">{post.date}</p>
                  <h3 className="text-lg font-black uppercase tracking-wider mb-2 group-hover:text-brand-green transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-sm text-neutral-400 mb-4 leading-relaxed">{post.excerpt}</p>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="text-brand-green font-bold text-sm uppercase tracking-widest flex items-center gap-2 hover:gap-3 transition-all"
                  >
                    Read Article <ArrowRight className="h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button asChild size="lg" className="bg-brand-green text-black hover:bg-white font-bold uppercase tracking-widest">
              <Link href="/blog">View All Articles</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Before & After Gallery */}
      <section className="py-12 md:py-16 px-6 bg-black/80 backdrop-blur-sm border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Our Work</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-wider mb-4">
              Before & After Transformations
            </h2>
            <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
              See the difference professional roofing makes for North Alabama homes
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Project 1 */}
            <Card className="border-neutral-800 bg-neutral-950 overflow-hidden">
              <div className="grid grid-cols-2">
                <div className="relative h-40 sm:h-64">
                  <div className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-red-600 text-white px-2 py-0.5 sm:px-3 sm:py-1 rounded-md font-bold text-xs sm:text-sm z-10">
                    BEFORE
                  </div>
                  <Image
                    src="/uploads/service-storm.jpg"
                    alt="Before: Storm damaged roof in Huntsville"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="relative h-40 sm:h-64">
                  <div className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-brand-green text-black px-2 py-0.5 sm:px-3 sm:py-1 rounded-md font-bold text-xs sm:text-sm z-10">
                    AFTER
                  </div>
                  <Image
                    src="/uploads/service-residential.png"
                    alt="After: New roof installation in Huntsville"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
              <CardContent className="p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-black uppercase tracking-wider mb-2">Huntsville Storm Damage Repair</h3>
                <p className="text-neutral-400 text-sm">Complete roof replacement after hail damage. IKO Dynasty shingles with lifetime warranty.</p>
              </CardContent>
            </Card>

            {/* Project 2 */}
            <Card className="border-neutral-800 bg-neutral-950 overflow-hidden">
              <div className="grid grid-cols-2">
                <div className="relative h-40 sm:h-64">
                  <div className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-red-600 text-white px-2 py-0.5 sm:px-3 sm:py-1 rounded-md font-bold text-xs sm:text-sm z-10">
                    BEFORE
                  </div>
                  <Image
                    src="/uploads/service-residential.png"
                    alt="Before: Aging commercial roof in Madison"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="relative h-40 sm:h-64">
                  <div className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-brand-green text-black px-2 py-0.5 sm:px-3 sm:py-1 rounded-md font-bold text-xs sm:text-sm z-10">
                    AFTER
                  </div>
                  <Image
                    src="/uploads/service-commercial.png"
                    alt="After: Premium commercial roof replacement in Madison"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
              <CardContent className="p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-black uppercase tracking-wider mb-2">Madison Residential Upgrade</h3>
                <p className="text-neutral-400 text-sm">Full tear-off and replacement. Enhanced curb appeal and energy efficiency.</p>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <Button asChild size="lg" className="bg-brand-green text-black hover:bg-white font-bold uppercase tracking-widest">
              <Link href="/contact">Start Your Project</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Enhanced Testimonials */}
      <section className="py-12 md:py-16 px-6 bg-black/85 backdrop-blur-sm border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Reviews</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-wider mb-4">
              What Our Customers Say
            </h2>
            <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
              Real feedback from real customers across North Alabama
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredReviews.map((review) => (
              <Card key={review.id} className="border-neutral-800 bg-black">
                <CardContent className="p-8">
                  <div className="flex mb-4">
                    {[...Array(review.rating)].map((_, i) => (
                      <span key={i} className="text-brand-green text-xl">★</span>
                    ))}
                  </div>
                  <p className="text-gray-200 italic leading-relaxed mb-6 line-clamp-5">
                    &ldquo;{review.text}&rdquo;
                  </p>
                  <div className="border-t border-neutral-700 pt-4">
                    <p className="font-bold text-white">{review.name}</p>
                    {review.salesRep && (
                      <p className="text-neutral-300 text-sm">Worked with {review.salesRep}</p>
                    )}
                    {review.source && (
                      <p className="text-neutral-400 text-xs mt-1">via {review.source}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12">
            <div className="flex items-center justify-center gap-1 mb-2">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="text-brand-green text-2xl">★</span>
              ))}
            </div>
            <p className="text-neutral-300 text-lg mb-6">
              <span className="font-bold text-white">5.0</span> stars from <span className="font-bold text-white">200+</span> Google Reviews
            </p>
            <Button asChild size="lg" className="bg-brand-green text-black hover:bg-lime-400 font-bold uppercase tracking-widest">
              <Link href="/contact">Get Your Free Inspection</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Why Choose Section */}
      <section className="py-12 md:py-16 px-6 bg-black/80 backdrop-blur-sm border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Why Us</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-wider mb-4">
              Why Choose River City Roofing?
            </h2>
            <p className="text-xl text-neutral-300 max-w-2xl mx-auto">
              Experience the difference of working with a trusted local roofing company
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Shield, title: 'Fully Licensed & Insured', desc: 'Complete coverage for your peace of mind' },
              { icon: Award, title: '20+ Years in Roofing', desc: 'Decades of hands-on industry expertise' },
              { icon: Users, title: 'Local Family Business', desc: 'Your neighbors, serving the community' },
              { icon: CheckCircle2, title: 'Quality Guaranteed', desc: 'Superior workmanship on every project' },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <Card
                  key={idx}
                  className="border-neutral-800 bg-black hover:bg-brand-green transition-all duration-300 group text-center"
                >
                  <CardContent className="p-8">
                    <div className="bg-brand-green group-hover:bg-black rounded-2xl p-5 mb-6 shadow-lg inline-flex">
                      <Icon className="text-black group-hover:text-brand-green" size={36} />
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-wider mb-3 text-white group-hover:text-black">
                      {item.title}
                    </h3>
                    <p className="text-neutral-300 group-hover:text-black/75 leading-relaxed text-sm">
                      {item.desc}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Storm Report CTA Banner */}
      <section className="py-12 md:py-16 px-6 bg-black/85 backdrop-blur-sm border-t border-neutral-800">
        <div className="max-w-4xl mx-auto">
          <div className="bg-neutral-950 border-2 border-brand-green/40 rounded-2xl p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 bg-brand-green/15 px-3 py-1 rounded-full mb-4">
                <CloudLightning className="w-4 h-4 text-brand-green" />
                <span className="text-brand-green text-xs font-bold uppercase tracking-widest">Free Tool</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-wider mb-3">
                Check Your Address for Storm Damage
              </h2>
              <p className="text-neutral-300 leading-relaxed">
                Get a free, instant report showing recent hail and storm activity near your property.
                Real data from the National Weather Service &mdash; no obligation.
              </p>
            </div>
            <div className="flex-shrink-0">
              <Button asChild size="lg" className="bg-brand-green text-black hover:bg-lime-400 font-bold uppercase tracking-widest px-8 py-7 text-lg shadow-xl whitespace-nowrap">
                <Link href="/check-my-address">Check My Address</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 md:py-16 px-6 bg-black/80 backdrop-blur-sm border-t border-neutral-800">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <span className="text-xs uppercase tracking-widest font-bold text-brand-green">FAQ</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-wider mb-4">
              Common Roofing Questions
            </h2>
            <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
              Answers to the most frequently asked questions from North Alabama homeowners
            </p>
          </div>

          <div className="space-y-4">
            {homepageFAQs.map((faq, idx) => (
              <details key={idx} className="bg-black border border-neutral-800 rounded-lg p-6 group hover:border-brand-green transition-colors">
                <summary className="font-black uppercase tracking-wider cursor-pointer list-none flex justify-between items-center">
                  {faq.question}
                  <CheckCircle2 className="h-5 w-5 text-brand-green flex-shrink-0 ml-4" />
                </summary>
                <p className="text-neutral-400 mt-4 leading-relaxed">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - Lime BG with slight transparency */}
      <section className="py-12 md:py-16 px-6 bg-brand-green/95 backdrop-blur-sm text-black border-t border-neutral-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-wider mb-4 leading-tight">
            Ready to Protect Your Home?
          </h2>
          <p className="text-lg mb-8 text-black/75 leading-relaxed">
            Get a free, no-obligation inspection and quote today. Our experts will assess your roof and provide honest recommendations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-black text-brand-green hover:bg-neutral-900 font-bold uppercase tracking-widest">
              <Link href="/contact">Schedule Free Inspection</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-2 border-black text-black hover:bg-black hover:text-brand-green font-bold uppercase tracking-widest">
              <Link href="tel:256-274-8530">Call (256) 274-8530</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
