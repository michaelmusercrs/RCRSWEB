import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, MapPin, Clock, Shield, Award, Users, CheckCircle2, ArrowRight } from 'lucide-react';
import AnimatedHeroText from '@/components/AnimatedHeroText';
import VideoBackground from '@/components/VideoBackground';
import RotatingText from '@/components/RotatingText';
import { blogPosts } from '@/lib/blogData';
import { services, serviceAreas } from '@/lib/servicesData';

export default function HomePage() {
  // Get latest 3 blog posts
  const latestPosts = blogPosts.slice(0, 3);

  // Get primary services
  const primaryServices = services.filter(s => s.category === 'Primary').slice(0, 6);

  // Get active service areas
  const activeAreas = serviceAreas.filter(a => a.status === 'Active');

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section - Video Background */}
      <VideoBackground
        videoSrc="/uploads/hero-video.mp4"
        fallbackImage="/uploads/hero-background.jpg"
        className="min-h-[90vh] flex items-center justify-center px-6 py-16 md:py-24 lg:py-32"
      >
        <div className="max-w-4xl mx-auto text-center text-white">
          {/* Big Centered Logo */}
          <div className="mb-8">
            <Image
              src="/uploads/logo.png"
              alt="River City Roofing Solutions"
              width={300}
              height={300}
              className="mx-auto w-48 h-48 md:w-64 md:h-64 lg:w-80 lg:h-80 object-contain"
              priority
            />
          </div>

          {/* Rotating Tagline */}
          <RotatingText
            phrases={[
              "Local Professionals",
              "Family Owned",
              "Trusted Since 2010",
              "5-Star Rated",
              "Licensed & Insured",
              "Storm Damage Experts"
            ]}
            interval={3000}
            className="text-2xl md:text-4xl lg:text-5xl font-black uppercase tracking-wider text-brand-green mb-8 h-16"
          />

          {/* Subtitle */}
          <p className="text-lg md:text-xl max-w-2xl mx-auto text-white/80 leading-relaxed mb-10">
            North Alabama's Premier Roofing Company
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-brand-green text-black hover:bg-lime-400 font-bold uppercase tracking-widest px-8 py-6 text-lg">
              <Link href="/contact">Get Free Inspection</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-2 border-white text-white hover:bg-white hover:text-black font-bold uppercase tracking-widest px-8 py-6 text-lg">
              <Link href="tel:256-274-8530">Call (256) 274-8530</Link>
            </Button>
          </div>
        </div>
      </VideoBackground>

      {/* Intro Section - Dark BG */}
      <section className="py-16 md:py-24 px-6 bg-neutral-950 border-t border-neutral-800">
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
      <section className="py-16 md:py-24 px-6 bg-black border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
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
                    <h3 className="text-lg font-black uppercase tracking-wider mb-3 group-hover:text-black">
                      {service.title}
                    </h3>
                    <p className="text-neutral-400 group-hover:text-black/75 text-sm mb-4 leading-relaxed">
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
      <section className="py-16 md:py-24 px-6 bg-neutral-950 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
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

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {activeAreas.map((area) => (
              <Card
                key={area.id}
                className="border-neutral-800 bg-black hover:bg-brand-green hover:text-black transition-all duration-300 group text-center"
              >
                <CardContent className="p-6">
                  <MapPin className="h-8 w-8 mx-auto mb-3 text-brand-green group-hover:text-black" />
                  <h3 className="font-black uppercase tracking-wider text-lg mb-1 group-hover:text-black">
                    {area.name}
                  </h3>
                  <p className="text-xs text-neutral-400 group-hover:text-black/75 uppercase tracking-widest">
                    {area.state}
                  </p>
                </CardContent>
              </Card>
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
      <section className="py-16 md:py-24 px-6 bg-black border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
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
      <section className="py-16 md:py-24 px-6 bg-black border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block mb-4">
              <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Our Work</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-wider mb-4">
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
                <div className="relative h-64">
                  <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-md font-bold text-sm z-10">
                    BEFORE
                  </div>
                  <Image
                    src="/uploads/service-storm.jpg"
                    alt="Before: Storm damaged roof in Huntsville"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="relative h-64">
                  <div className="absolute top-4 left-4 bg-brand-green text-black px-3 py-1 rounded-md font-bold text-sm z-10">
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
              <CardContent className="p-6">
                <h3 className="text-xl font-black uppercase tracking-wider mb-2">Huntsville Storm Damage Repair</h3>
                <p className="text-neutral-400 text-sm">Complete roof replacement after hail damage. IKO Dynasty shingles with lifetime warranty.</p>
              </CardContent>
            </Card>

            {/* Project 2 */}
            <Card className="border-neutral-800 bg-neutral-950 overflow-hidden">
              <div className="grid grid-cols-2">
                <div className="relative h-64">
                  <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-md font-bold text-sm z-10">
                    BEFORE
                  </div>
                  <Image
                    src="/uploads/service-storm.jpg"
                    alt="Before: Worn roof in Madison"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="relative h-64">
                  <div className="absolute top-4 left-4 bg-brand-green text-black px-3 py-1 rounded-md font-bold text-sm z-10">
                    AFTER
                  </div>
                  <Image
                    src="/uploads/service-residential.png"
                    alt="After: Premium roof replacement in Madison"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
              <CardContent className="p-6">
                <h3 className="text-xl font-black uppercase tracking-wider mb-2">Madison Residential Upgrade</h3>
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
      <section className="py-16 md:py-24 px-6 bg-neutral-950 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
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

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-neutral-800 bg-black">
              <CardContent className="p-8">
                <div className="flex mb-6">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-brand-green text-2xl">★</span>
                  ))}
                </div>
                <p className="text-neutral-300 italic leading-relaxed mb-6">
                  "Excellent service and handled our insurance claim perfectly! Beautiful work on our Huntsville home. The team was professional and efficient."
                </p>
                <div className="border-t border-neutral-800 pt-4">
                  <p className="font-bold text-brand-green">JS</p>
                  <p className="text-neutral-500 text-sm">Madison, AL</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-neutral-800 bg-black">
              <CardContent className="p-8">
                <div className="flex mb-6">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-brand-green text-2xl">★</span>
                  ))}
                </div>
                <p className="text-neutral-300 italic leading-relaxed mb-6">
                  "Prompt, hardworking, and honest. They fixed our roof after the hail storm quickly and professionally. Highly recommend!"
                </p>
                <div className="border-t border-neutral-800 pt-4">
                  <p className="font-bold text-brand-green">Alison C.</p>
                  <p className="text-neutral-500 text-sm">Huntsville, AL</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-neutral-800 bg-black">
              <CardContent className="p-8">
                <div className="flex mb-6">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-brand-green text-2xl">★</span>
                  ))}
                </div>
                <p className="text-neutral-300 italic leading-relaxed mb-6">
                  "Rick got our roof replaced through insurance—highly recommend for anyone in the Decatur area! Fair pricing and quality work."
                </p>
                <div className="border-t border-neutral-800 pt-4">
                  <p className="font-bold text-brand-green">Stacie F.</p>
                  <p className="text-neutral-500 text-sm">Decatur, AL</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-12">
            <p className="text-neutral-400 text-lg mb-4">⭐⭐⭐⭐⭐ Rated 5.0 stars by 47+ customers</p>
            <Button asChild size="lg" variant="outline" className="border-2 border-brand-green text-brand-green hover:bg-brand-green hover:text-black font-bold uppercase tracking-widest">
              <Link href="/contact">Leave a Review</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Why Choose Section */}
      <section className="py-16 md:py-24 px-6 bg-black border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block mb-4">
              <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Why Us</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-wider mb-4">
              Why Choose River City Roofing?
            </h2>
            <p className="text-xl text-neutral-300 max-w-2xl mx-auto">
              Experience the difference of working with a trusted local roofing company
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Shield, title: 'Fully Licensed & Insured', desc: 'Complete coverage for your peace of mind' },
              { icon: Award, title: '10+ Years Experience', desc: 'Proven expertise in North Alabama roofing' },
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
                    <h3 className="text-lg font-black uppercase tracking-wider mb-3 group-hover:text-black">
                      {item.title}
                    </h3>
                    <p className="text-neutral-400 group-hover:text-black/75 leading-relaxed text-sm">
                      {item.desc}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section - Lime BG */}
      <section className="py-16 md:py-24 px-6 bg-brand-green text-black border-t border-neutral-800">
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
