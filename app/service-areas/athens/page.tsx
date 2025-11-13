import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Phone, Clock, CheckCircle2, Award, Shield } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Roof Repair & Replacement Athens AL | River City Roofing Solutions',
  description: 'Expert roofing contractors in Athens, AL. Roof repair, replacement, storm damage & insurance claims. Free estimates. BBB Accredited. Call (256) 274-8530',
  keywords: ['roof repair Athens AL', 'roofing contractors Athens', 'roof replacement Athens', 'storm damage Athens', 'hail damage roof Athens'],
};

export default function AthensPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Schema Markup for Local SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "RoofingContractor",
            "name": "River City Roofing Solutions - Athens",
            "image": "https://rivercityroofingsolutions.com/wp-content/uploads/2019/09/rcrs-square-logo.jpg",
            "@id": "https://rcrsweb.com/service-areas/athens",
            "url": "https://rcrsweb.com/service-areas/athens",
            "telephone": "+1-256-274-8530",
            "priceRange": "$$",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "3325 Central Pkwy SW #B",
              "addressLocality": "Decatur",
              "addressRegion": "AL",
              "postalCode": "35603",
              "addressCountry": "US"
            },
            "geo": {
              "@type": "GeoCoordinates",
              "latitude": 34.8021,
              "longitude": -86.9717
            },
            "areaServed": {
              "@type": "City",
              "name": "Athens",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Athens",
                "addressRegion": "AL"
              }
            },
            "openingHoursSpecification": [
              {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                "opens": "08:00",
                "closes": "17:00"
              }
            ],
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "5",
              "reviewCount": "47"
            }
          })
        }}
      />

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-lime-400 to-lime-300 text-black px-6 py-16 md:py-24">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-block mb-4">
            <span className="text-xs uppercase tracking-widest font-bold flex items-center gap-2 justify-center">
              <MapPin className="h-4 w-4" />
              Athens, Alabama
            </span>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black uppercase tracking-tighter mb-6 leading-tight">
            Athens Roofing Experts
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto text-black/75 leading-relaxed mb-8">
            Professional roof repair, replacement, and storm damage services in Athens, AL. Serving the college town community with quality and care.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-black text-lime-400 hover:bg-neutral-900 font-bold uppercase tracking-widest">
              <Link href="/contact">Get Free Estimate</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-2 border-black text-black hover:bg-black hover:text-lime-400 font-bold uppercase tracking-widest">
              <a href="tel:256-274-8530">Call (256) 274-8530</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Quick Info Cards */}
      <section className="py-12 px-6 bg-neutral-950 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-neutral-800 bg-black text-center">
            <CardContent className="p-6">
              <Clock className="h-12 w-12 mx-auto mb-4 text-lime-400" />
              <h3 className="font-black uppercase text-lg mb-2">1-2 Day Response</h3>
              <p className="text-neutral-400 text-sm">Quick service for Athens residents</p>
            </CardContent>
          </Card>
          <Card className="border-neutral-800 bg-black text-center">
            <CardContent className="p-6">
              <Shield className="h-12 w-12 mx-auto mb-4 text-lime-400" />
              <h3 className="font-black uppercase text-lg mb-2">BBB Accredited</h3>
              <p className="text-neutral-400 text-sm">Licensed & Insured</p>
            </CardContent>
          </Card>
          <Card className="border-neutral-800 bg-black text-center">
            <CardContent className="p-6">
              <Award className="h-12 w-12 mx-auto mb-4 text-lime-400" />
              <h3 className="font-black uppercase text-lg mb-2">Free Estimates</h3>
              <p className="text-neutral-400 text-sm">No obligation quotes</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Services in Athens */}
      <section className="py-16 md:py-24 px-6 bg-black border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block mb-4">
              <span className="text-xs uppercase tracking-widest font-bold text-lime-400">Our Services</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-wider mb-4">
              Roofing Services in Athens
            </h2>
            <p className="text-neutral-300 text-lg max-w-2xl mx-auto">
              Comprehensive roofing solutions for residential and commercial properties
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Roof Repair', desc: 'Expert repairs for Athens homes and businesses' },
              { title: 'Roof Replacement', desc: 'Complete replacements with premium materials' },
              { title: 'Storm & Hail Damage', desc: 'Assessment and repair of North Alabama storm damage' },
              { title: 'Insurance Claims', desc: 'Full assistance with your insurance company' },
              { title: 'Commercial Roofing', desc: 'Solutions for Athens businesses and buildings' },
              { title: 'Free Inspections', desc: 'Thorough assessments at no cost' },
            ].map((service, idx) => (
              <Card
                key={idx}
                className="border-neutral-800 bg-neutral-950 hover:bg-lime-400 hover:text-black transition-all duration-300 group"
              >
                <CardContent className="p-6">
                  <div className="w-6 h-6 border-2 border-lime-400 group-hover:border-black rounded mb-4"></div>
                  <h3 className="text-lg font-black uppercase tracking-wider mb-2 group-hover:text-black">
                    {service.title}
                  </h3>
                  <p className="text-neutral-400 group-hover:text-black/75 text-sm leading-relaxed">
                    {service.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us for Athens */}
      <section className="py-16 md:py-24 px-6 bg-neutral-950 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block mb-4">
              <span className="text-xs uppercase tracking-widest font-bold text-lime-400">Local Experts</span>
            </div>
            <h2 className="text-4xl font-black uppercase tracking-wider mb-4">
              Why Athens Homeowners Trust Us
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="border-neutral-800 bg-black">
              <CardContent className="p-8">
                <h3 className="text-xl font-black uppercase tracking-wider mb-4 text-lime-400">
                  College Town Expertise
                </h3>
                <p className="text-neutral-300 leading-relaxed mb-4">
                  We understand the unique needs of Athens' diverse housing stock, from historic homes to modern student housing.
                </p>
                <ul className="space-y-2">
                  {[
                    'Experience with varied property types',
                    'Quick turnaround for rental properties',
                    'Work with property managers',
                    'Respect for community standards'
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-neutral-300">
                      <CheckCircle2 className="h-5 w-5 text-lime-400 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-neutral-800 bg-black">
              <CardContent className="p-8">
                <h3 className="text-xl font-black uppercase tracking-wider mb-4 text-lime-400">
                  Growing Market Focus
                </h3>
                <p className="text-neutral-300 leading-relaxed mb-4">
                  As Athens continues to grow, we're here to serve new construction and established neighborhoods alike.
                </p>
                <ul className="space-y-2">
                  {[
                    'New construction roofing',
                    'Historic home preservation',
                    'Commercial building solutions',
                    'Community-focused service'
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-neutral-300">
                      <CheckCircle2 className="h-5 w-5 text-lime-400 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 md:py-24 px-6 bg-black border-t border-neutral-800">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block mb-4">
              <span className="text-xs uppercase tracking-widest font-bold text-lime-400">FAQ</span>
            </div>
            <h2 className="text-4xl font-black uppercase tracking-wider mb-4">
              Athens Roofing FAQs
            </h2>
          </div>

          <div className="space-y-4">
            <details className="bg-neutral-950 border border-neutral-800 rounded-lg p-6 group hover:border-lime-400 transition-colors">
              <summary className="font-black uppercase tracking-wider cursor-pointer list-none flex justify-between items-center">
                Do you offer free roof inspections in Athens?
                <CheckCircle2 className="h-5 w-5 text-lime-400" />
              </summary>
              <p className="text-neutral-400 mt-4 leading-relaxed">
                Yes! We provide free, no-obligation roof inspections for all Athens-area properties. Our certified inspectors will assess your roof's condition and provide a detailed report.
              </p>
            </details>

            <details className="bg-neutral-950 border border-neutral-800 rounded-lg p-6 group hover:border-lime-400 transition-colors">
              <summary className="font-black uppercase tracking-wider cursor-pointer list-none flex justify-between items-center">
                What's your response time for Athens?
                <CheckCircle2 className="h-5 w-5 text-lime-400" />
              </summary>
              <p className="text-neutral-400 mt-4 leading-relaxed">
                We typically respond to Athens service requests within 1-2 days. For emergencies, we offer same-day service when available.
              </p>
            </details>

            <details className="bg-neutral-950 border border-neutral-800 rounded-lg p-6 group hover:border-lime-400 transition-colors">
              <summary className="font-black uppercase tracking-wider cursor-pointer list-none flex justify-between items-center">
                Do you work with property managers and landlords?
                <CheckCircle2 className="h-5 w-5 text-lime-400" />
              </summary>
              <p className="text-neutral-400 mt-4 leading-relaxed">
                Absolutely! We have experience working with property managers and landlords throughout Athens. We understand the need for quick turnarounds and can work around tenant schedules.
              </p>
            </details>

            <details className="bg-neutral-950 border border-neutral-800 rounded-lg p-6 group hover:border-lime-400 transition-colors">
              <summary className="font-black uppercase tracking-wider cursor-pointer list-none flex justify-between items-center">
                What roofing materials do you install in Athens?
                <CheckCircle2 className="h-5 w-5 text-lime-400" />
              </summary>
              <p className="text-neutral-400 mt-4 leading-relaxed">
                We install all major roofing types including asphalt shingles (IKO Dynasty, Owens Corning, GAF), metal roofing, TPO commercial systems, and specialty materials for historic properties.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 px-6 bg-lime-400 text-black border-t border-neutral-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-wider mb-4 leading-tight">
            Ready for Your Free Athens Roof Estimate?
          </h2>
          <p className="text-lg mb-8 text-black/75 leading-relaxed">
            Call us today or fill out our contact form. We'll schedule your free inspection and provide an honest, detailed estimate.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-black text-lime-400 hover:bg-neutral-900 font-bold uppercase tracking-widest">
              <Link href="/contact">Request Free Estimate</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-2 border-black text-black hover:bg-black hover:text-lime-400 font-bold uppercase tracking-widest">
              <a href="tel:256-274-8530">Call (256) 274-8530</a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
