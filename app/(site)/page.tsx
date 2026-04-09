import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Shield, Award, Users, CheckCircle2, ArrowRight, CloudLightning, Eye, Smartphone, DollarSign, FileText, MessageSquare, BarChart3 } from 'lucide-react';

import RotatingText from '@/components/RotatingText';
import RotatingBanner from '@/components/RotatingBanner';
import QuickContactForm from '@/components/QuickContactForm';
import { blogPosts } from '@/lib/blogData';
import { services, serviceAreas } from '@/lib/servicesData';
import { loadFeaturedReviews } from '@/lib/reviews-loader';
import { getSiteConfig } from '@/lib/site-config';

export default async function HomePage() {
  // Get latest 3 blog posts (array is sorted oldest-first, so take from end)
  const latestPosts = [...blogPosts].reverse().slice(0, 3);

  // Get primary services
  const primaryServices = services.filter(s => s.category === 'Primary').slice(0, 6);

  // Get active service areas
  const activeAreas = serviceAreas.filter(a => a.status === 'Active');

  // Get featured reviews — pulls from the Google Sheet, falls back to hardcoded set
  const featuredReviews = await loadFeaturedReviews(6);

  // Site config for feature toggles
  const siteConfig = await getSiteConfig();

  // Homepage FAQ data
  const homepageFAQs = [
    {
      question: 'How much does a new roof cost in North Alabama?',
      answer: 'The cost of a new roof depends on the size of your roof, materials chosen, and complexity of the job. We offer free inspections and detailed quotes so you know exactly what to expect — no obligation.',
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

  // FAQ schema is rendered in (site) layout head so it's a real <script> in static HTML.
  // The visible FAQ section below uses homepageFAQs directly.

  return (
    <div className="min-h-screen text-white overflow-x-hidden">

      {/* Rotating Announcement Banner */}
      <RotatingBanner />

      {/* Hero Section - Compact, punchy */}
      <div className="-mt-20 min-h-[75vh] flex items-center justify-center px-6 pt-20">
        <div className="max-w-5xl mx-auto text-center">
          <Link href="/" className="block mb-4" aria-label="River City Roofing Solutions Home">
            <Image
              src="/logo-nobg.png"
              alt="River City Roofing Solutions"
              width={864}
              height={312}
              sizes="(max-width: 768px) 288px, (max-width: 1024px) 380px, 500px"
              className="mx-auto w-72 h-auto md:w-[380px] lg:w-[500px] object-contain drop-shadow-2xl"
              priority
              fetchPriority="high"
            />
          </Link>

          <RotatingText
            phrases={[
              "Local Professionals",
              "Family Owned",
              "\u2605\u2605\u2605\u2605\u2605 On Google",
              "Licensed & Insured",
              "Storm Damage Experts"
            ]}
            interval={5000}
            className="text-xl md:text-2xl lg:text-3xl font-black uppercase tracking-wider text-[#3B9DFF] mb-3 min-h-[2.5rem] drop-shadow-lg"
          />

          <h1 className="text-2xl md:text-3xl max-w-2xl mx-auto text-white leading-snug mb-6 drop-shadow-lg font-black uppercase tracking-wider">
            Roofing Contractor Serving Decatur, Huntsville &amp; North Alabama
          </h1>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-brand-green text-black hover:bg-lime-400 font-bold uppercase tracking-widest px-8 py-6 text-lg shadow-xl">
              <Link href="/contact">Get Free Inspection</Link>
            </Button>
            <Button asChild size="lg" className="bg-brand-green text-black hover:bg-lime-400 font-bold uppercase tracking-widest px-8 py-6 text-lg shadow-xl">
              <Link href="tel:256-274-8530">Call (256) 274-8530</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Featured Tools - Storm Check & IKO Visualizer */}
      <section className="py-10 md:py-14 px-6 bg-black/90 backdrop-blur-sm border-t border-brand-green/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Free Tools</span>
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-wider mt-3 mb-2">
              Get Started in Seconds
            </h2>
            <p className="text-neutral-400">No signup needed. 100% free.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Storm Check Card */}
            <Link href="/check-my-address" className="block group">
              <div className="bg-neutral-950 border-2 border-brand-green/50 hover:border-brand-green rounded-2xl p-6 md:p-8 h-full transition-all hover:shadow-[0_0_30px_rgba(57,255,20,0.15)]">
                <div className="flex items-start gap-4 mb-4">
                  <div className="bg-brand-green/15 rounded-xl p-3 flex-shrink-0">
                    <CloudLightning className="w-8 h-8 text-brand-green" />
                  </div>
                  <div>
                    <span className="text-brand-green text-xs font-bold uppercase tracking-widest">Free Storm Report</span>
                    <h3 className="text-xl md:text-2xl font-black uppercase tracking-wider mt-1">
                      Check My Address
                    </h3>
                  </div>
                </div>
                <p className="text-neutral-300 leading-relaxed mb-5">
                  Instant report of recent hail and storm activity near your property. Real NWS data — no obligation.
                </p>
                <span className="inline-flex items-center gap-2 bg-brand-green text-black font-bold uppercase tracking-widest px-6 py-3 rounded-lg text-sm group-hover:bg-lime-400 transition-all">
                  Check Now <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </Link>

            {/* IKO Roof Visualizer Card */}
            <a href="https://www.iko.com/na/roofviewer/" target="_blank" rel="noopener noreferrer" className="block group">
              <div className="bg-neutral-950 border-2 border-brand-blue/50 hover:border-brand-blue rounded-2xl p-6 md:p-8 h-full transition-all hover:shadow-[0_0_30px_rgba(0,102,204,0.15)]">
                <div className="flex items-start gap-4 mb-4">
                  <div className="bg-brand-blue/15 rounded-xl p-3 flex-shrink-0">
                    <Eye className="w-8 h-8 text-brand-blue" />
                  </div>
                  <div>
                    <span className="text-[#3B9DFF] text-xs font-bold uppercase tracking-widest">Design Tool</span>
                    <h3 className="text-xl md:text-2xl font-black uppercase tracking-wider mt-1">
                      IKO ROOFViewer&reg;
                    </h3>
                  </div>
                </div>
                <p className="text-neutral-300 leading-relaxed mb-5">
                  See what different shingle colors and styles look like on your home. Try Dynasty, Cambridge, Nordic and more.
                </p>
                <span className="inline-flex items-center gap-2 bg-brand-blue text-white font-bold uppercase tracking-widest px-6 py-3 rounded-lg text-sm group-hover:bg-blue-600 transition-all">
                  Try Visualizer <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* Quick Contact Form */}
      <section id="contact" className="py-10 md:py-14 px-6 bg-black/90 backdrop-blur-sm border-t-2 border-brand-green/40">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-wider mb-3 text-white">
              Get Your <span className="text-brand-green">Free Inspection</span>
            </h2>
            <p className="text-neutral-200">
              Fill out the form below and we&apos;ll be in touch within 24 hours. Or call us right now.
            </p>
          </div>
          <QuickContactForm />
        </div>
      </section>

      {/* Intro / About Section */}
      <section className="py-10 md:py-14 px-6 bg-black/85 backdrop-blur-sm border-t border-neutral-800">
        <div className="max-w-6xl mx-auto text-center">
          <span className="text-xs uppercase tracking-widest font-bold text-brand-green">About Us</span>
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-wider mt-3 mb-5">
            Protecting North Alabama Homes
          </h2>
          <p className="text-lg text-neutral-300 leading-relaxed mb-6 max-w-3xl mx-auto">
            River City Roofing Solutions is your local, family-owned roofing company serving communities across North Alabama.
            We specialize in residential and commercial roofing with a commitment to quality workmanship, honest pricing, and exceptional customer service.
          </p>
          <div className="border-l-4 border-brand-green pl-6 text-left inline-block">
            <p className="text-xl font-bold mb-1 text-brand-green uppercase tracking-wider">
              Licensed &bull; Insured &bull; Locally Owned
            </p>
            <p className="text-neutral-400">
              Your neighbors trust us, and you can too.
            </p>
          </div>
        </div>
      </section>

      {/* Quick Links Bar */}
      <section className="py-6 px-6 bg-black/75 backdrop-blur-sm border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap justify-center gap-3 md:gap-4">
            {[
              { name: 'Free Inspection', href: '/contact' },
              { name: 'Storm Check', href: '/check-my-address' },
              { name: 'Our Services', href: '/services' },
              { name: 'Financing', href: '/financing' },
              { name: 'Warranty', href: '/warranty' },
              { name: 'Gallery', href: '/gallery' },
              { name: 'Reviews', href: '/reviews' },
              { name: 'FAQ', href: '/faq' },
              { name: 'Careers', href: '/careers' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-full text-sm text-neutral-300 hover:text-brand-green hover:border-brand-green/50 transition-all font-medium"
              >
                {link.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-10 md:py-14 px-6 bg-black/80 backdrop-blur-sm border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <span className="text-xs uppercase tracking-widest font-bold text-brand-green">What We Do</span>
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-wider mt-3 mb-3">
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

          <div className="text-center mt-10">
            <Button asChild size="lg" className="bg-brand-green text-black hover:bg-white font-bold uppercase tracking-widest">
              <Link href="/services">View All Services</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-10 md:py-14 px-6 bg-black/85 backdrop-blur-sm border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Reviews</span>
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-wider mt-3 mb-3">
              What Our Customers Say
            </h2>
            <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
              Real feedback from real customers across North Alabama
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredReviews.map((review) => (
              <Card key={review.id} className="border-neutral-800 bg-black overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex mb-3">
                    {[...Array(review.rating)].map((_, i) => (
                      <span key={i} className="text-brand-green text-lg">{'\u2605'}</span>
                    ))}
                  </div>
                  <p className="text-gray-200 italic leading-relaxed mb-5 line-clamp-5 text-sm">
                    &ldquo;{review.text}&rdquo;
                  </p>
                  <div className="border-t border-neutral-700 pt-3">
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

          <div className="text-center mt-10">
            <div className="flex items-center justify-center gap-1 mb-2">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="text-brand-green text-2xl">{'\u2605'}</span>
              ))}
            </div>
            <p className="text-neutral-300 text-lg mb-5">
              Rated {'\u2605\u2605\u2605\u2605\u2605'} on{' '}
              <a href="https://www.google.com/maps/place/River+City+Roofing+Solutions" target="_blank" rel="noopener noreferrer" className="text-brand-green hover:underline font-bold">Google</a>
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-brand-green text-black hover:bg-lime-400 font-bold uppercase tracking-widest">
                <Link href="/contact">Get Your Free Inspection</Link>
              </Button>
              <Button asChild size="lg" className="bg-white text-black hover:bg-neutral-200 font-bold uppercase tracking-widest">
                <Link href="/reviews">Read All Reviews</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Section */}
      <section className="py-10 md:py-14 px-6 bg-black/80 backdrop-blur-sm border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Why Us</span>
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-wider mt-3 mb-3">
              Why Choose River City Roofing?
            </h2>
            <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
              Experience the difference of working with a trusted local roofing company
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Shield, title: 'Fully Licensed & Insured', desc: 'Complete coverage for your peace of mind' },
              { icon: Award, title: 'Real Roofers', desc: 'Owners who have done every part of the job themselves' },
              { icon: Users, title: 'Local Family Business', desc: 'Your neighbors, serving the community' },
              { icon: CheckCircle2, title: 'Quality Guaranteed', desc: 'Superior workmanship on every project' },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <Card
                  key={idx}
                  className="border-neutral-800 bg-black hover:bg-brand-green transition-all duration-300 group text-center"
                >
                  <CardContent className="p-6">
                    <div className="bg-brand-green group-hover:bg-black rounded-2xl p-4 mb-5 shadow-lg inline-flex">
                      <Icon className="text-black group-hover:text-brand-green" size={32} />
                    </div>
                    <h3 className="text-base font-black uppercase tracking-wider mb-2 text-white group-hover:text-black">
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

      {/* Customer Portal Promotion */}
      <section className="py-10 md:py-14 px-6 bg-gradient-to-b from-black/90 to-neutral-950 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Customer Portal</span>
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-wider mt-3 mb-4">
                Track Your Project 24/7
              </h2>
              <p className="text-neutral-300 mb-6 leading-relaxed">
                Our customers get their own secure online portal — something most roofing companies
                don&apos;t offer. Log in anytime to see exactly where your project stands.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-6">
                {[
                  { icon: BarChart3, text: 'Live job progress' },
                  { icon: FileText, text: 'Documents & invoices' },
                  { icon: MessageSquare, text: 'Message your rep' },
                  { icon: CloudLightning, text: 'Weather & hail reports' },
                ].map((feature, i) => {
                  const Icon = feature.icon;
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <Icon size={16} className="text-brand-green flex-shrink-0" />
                      <span className="text-sm text-neutral-300">{feature.text}</span>
                    </div>
                  );
                })}
              </div>
              <Button asChild size="lg" className="bg-brand-green text-black hover:bg-white font-bold uppercase tracking-widest">
                <Link href="/contact">Get Started</Link>
              </Button>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center">
              <Smartphone className="mx-auto text-brand-green mb-4" size={48} />
              <p className="text-white font-bold text-lg mb-2">No App Download Needed</p>
              <p className="text-neutral-400 text-sm">
                Works on any phone, tablet, or computer. Just log in and see your project status,
                upcoming appointments, weather forecasts, and more.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Financing Callout */}
      <section className="py-8 px-6 bg-brand-green border-t border-brand-green/50">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <DollarSign size={32} className="text-black flex-shrink-0" />
              <div>
                <h3 className="text-xl font-black uppercase tracking-wider text-black">
                  Affordable Financing Available
                </h3>
                <p className="text-black/70 text-sm">
                  $0 down &bull; Low monthly payments &bull; Quick approval &bull; Terms from 12 to 144 months
                </p>
              </div>
            </div>
            <Button asChild size="lg" className="bg-black text-brand-green hover:bg-neutral-900 font-bold uppercase tracking-widest whitespace-nowrap">
              <Link href="/financing">See Payment Options</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Service Areas Section */}
      <section className="py-10 md:py-14 px-6 bg-black/85 backdrop-blur-sm border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Where We Work</span>
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-wider mt-3 mb-3">
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
                          {area.name} Roofing
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

          <div className="text-center mt-10">
            <Button asChild size="lg" className="bg-brand-green text-black hover:bg-white font-bold uppercase tracking-widest">
              <Link href="/service-areas">View All Areas</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Trust Badges / Credentials */}
      <section className="py-10 md:py-14 px-6 bg-black/80 backdrop-blur-sm border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Credentials</span>
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-wider mt-3 mb-3">
              Trusted &amp; Certified
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            <a
              href="https://www.iko.com/na/roofpro/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-3 p-6 bg-neutral-950 border border-neutral-800 rounded-2xl hover:border-brand-green transition-all group"
            >
              <Image src="/uploads/cert-iko-roofpro.jpg" alt="IKO ROOFPRO Craftsman Premier" width={80} height={80} className="object-contain" />
              <div className="text-center">
                <p className="font-black text-white uppercase tracking-wider text-sm group-hover:text-brand-green transition-colors">IKO ROOFPRO&reg;</p>
                <p className="text-neutral-300 text-xs mt-1">Craftsman Premier</p>
              </div>
            </a>

            <a
              href="https://www.owenscorning.com/en-us/roofing/contractors"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-3 p-6 bg-neutral-950 border border-neutral-800 rounded-2xl hover:border-brand-green transition-all group"
            >
              <Award className="w-16 h-16 text-[#E75B8D]" />
              <div className="text-center">
                <p className="font-black text-white uppercase tracking-wider text-sm group-hover:text-brand-green transition-colors">Owens Corning</p>
                <p className="text-neutral-300 text-xs mt-1">Preferred Contractor</p>
              </div>
            </a>

            <a
              href="https://www.boralroof.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-3 p-6 bg-neutral-950 border border-neutral-800 rounded-2xl hover:border-brand-green transition-all group"
            >
              <Shield className="w-16 h-16 text-brand-green" />
              <div className="text-center">
                <p className="font-black text-white uppercase tracking-wider text-sm group-hover:text-brand-green transition-colors">Boral Certified</p>
                <p className="text-neutral-300 text-xs mt-1">LeafX Dealer / Pro Installer</p>
              </div>
            </a>

            <a
              href="https://www.bbb.org/us/al/decatur/profile/roofing-contractors/river-city-roofing-solutions-inc-0513-900240387"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-3 p-6 bg-neutral-950 border border-neutral-800 rounded-2xl hover:border-brand-green transition-all group"
            >
              <Image src="/uploads/cert-bbb.jpg" alt="BBB A+ Accredited Business" width={80} height={80} className="object-contain" />
              <div className="text-center">
                <p className="font-black text-white uppercase tracking-wider text-sm group-hover:text-brand-green transition-colors">BBB A+ Rated</p>
                <p className="text-neutral-300 text-xs mt-1">Accredited Business</p>
              </div>
            </a>

            <a
              href="https://www.google.com/maps/place/River+City+Roofing+Solutions"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-3 p-6 bg-neutral-950 border border-neutral-800 rounded-2xl hover:border-brand-green transition-all group"
            >
              <Image src="/uploads/cert-google.png" alt="Google Reviews" width={80} height={80} className="object-contain" />
              <div className="text-center">
                <p className="font-black text-white uppercase tracking-wider text-sm group-hover:text-brand-green transition-colors">Google Reviews</p>
                <p className="text-neutral-300 text-xs mt-1">{'\u2605\u2605\u2605\u2605\u2605'} Rated</p>
              </div>
            </a>

            <a
              href="https://www.bni.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-3 p-6 bg-neutral-950 border border-neutral-800 rounded-2xl hover:border-brand-green transition-all group"
            >
              <Image src="/uploads/cert-bni.png" alt="BNI Member" width={80} height={80} className="object-contain" />
              <div className="text-center">
                <p className="font-black text-white uppercase tracking-wider text-sm group-hover:text-brand-green transition-colors">BNI Member</p>
                <p className="text-neutral-300 text-xs mt-1">Business Network</p>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* Blog Posts Section */}
      <section className="py-10 md:py-14 px-6 bg-black/85 backdrop-blur-sm border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Latest Insights</span>
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-wider mt-3 mb-3">
              Roofing Blog
            </h2>
            <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
              Expert advice and tips for North Alabama homeowners
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {latestPosts.map((post) => (
              <Card
                key={post.id}
                className="border-neutral-800 overflow-hidden hover:border-brand-green transition-all duration-300 group"
              >
                <div className="w-full h-48 relative bg-neutral-900">
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <CardContent className="p-5">
                  <p className="text-xs text-neutral-300 uppercase tracking-widest mb-2">{post.date}</p>
                  <h3 className="text-base font-black uppercase tracking-wider mb-2 group-hover:text-brand-green transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-sm text-neutral-300 mb-3 leading-relaxed line-clamp-3">{post.excerpt}</p>
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

          <div className="text-center mt-10">
            <Button asChild size="lg" className="bg-brand-green text-black hover:bg-white font-bold uppercase tracking-widest">
              <Link href="/blog">View All Articles</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Before & After Gallery — Admin toggle, default OFF */}
      {siteConfig.showBeforeAfterGallery && (
        <section className="py-10 md:py-14 px-6 bg-black/80 backdrop-blur-sm border-t border-neutral-800">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Our Work</span>
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-wider mt-3 mb-3">
                Before &amp; After Transformations
              </h2>
              <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
                See the difference professional roofing makes for North Alabama homes
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-10">
              <Card className="border-neutral-800 bg-neutral-950 overflow-hidden">
                <div className="grid grid-cols-2">
                  <div className="relative h-40 sm:h-56">
                    <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-red-600 text-white px-2 py-0.5 rounded-md font-bold text-xs z-10">BEFORE</div>
                    <Image src="/uploads/service-storm.jpg" alt="Before: Storm damaged roof in Huntsville" fill className="object-cover" />
                  </div>
                  <div className="relative h-40 sm:h-56">
                    <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-brand-green text-black px-2 py-0.5 rounded-md font-bold text-xs z-10">AFTER</div>
                    <Image src="/uploads/service-repair.jpg" alt="After: Completed roof repair in Huntsville" fill className="object-cover" />
                  </div>
                </div>
                <CardContent className="p-5">
                  <h3 className="text-lg font-black uppercase tracking-wider mb-1">Huntsville Storm Damage Repair</h3>
                  <p className="text-neutral-400 text-sm">Complete roof replacement after hail damage. IKO Dynasty shingles with lifetime warranty.</p>
                </CardContent>
              </Card>

              <Card className="border-neutral-800 bg-neutral-950 overflow-hidden">
                <div className="grid grid-cols-2">
                  <div className="relative h-40 sm:h-56">
                    <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-red-600 text-white px-2 py-0.5 rounded-md font-bold text-xs z-10">BEFORE</div>
                    <Image src="/uploads/service-residential.png" alt="Before: Aging residential roof in Madison" fill className="object-cover" />
                  </div>
                  <div className="relative h-40 sm:h-56">
                    <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-brand-green text-black px-2 py-0.5 rounded-md font-bold text-xs z-10">AFTER</div>
                    <Image src="/uploads/service-commercial.png" alt="After: Premium roof installation in Madison" fill className="object-cover" />
                  </div>
                </div>
                <CardContent className="p-5">
                  <h3 className="text-lg font-black uppercase tracking-wider mb-1">Madison Residential Upgrade</h3>
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
      )}

      {/* FAQ Section */}
      <section className="py-10 md:py-14 px-6 bg-black/80 backdrop-blur-sm border-t border-neutral-800">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <span className="text-xs uppercase tracking-widest font-bold text-brand-green">FAQ</span>
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-wider mt-3 mb-3">
              Common Roofing Questions
            </h2>
            <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
              Answers to the most frequently asked questions from North Alabama homeowners
            </p>
          </div>

          <div className="space-y-3">
            {homepageFAQs.map((faq, idx) => (
              <details key={idx} className="bg-black border border-neutral-800 rounded-lg p-5 group hover:border-brand-green transition-colors">
                <summary className="font-black uppercase tracking-wider cursor-pointer list-none flex justify-between items-center text-sm md:text-base">
                  {faq.question}
                  <CheckCircle2 className="h-5 w-5 text-brand-green flex-shrink-0 ml-4" />
                </summary>
                <p className="text-neutral-400 mt-3 leading-relaxed text-sm">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>

          <div className="text-center mt-8">
            <Button asChild size="lg" className="bg-brand-green text-black hover:bg-white font-bold uppercase tracking-widest">
              <Link href="/faq">View All FAQs</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-10 md:py-14 px-6 bg-brand-green/95 backdrop-blur-sm text-black border-t border-neutral-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-wider mb-4 leading-tight">
            Ready to Protect Your Home?
          </h2>
          <p className="text-lg mb-6 text-black/75 leading-relaxed">
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
