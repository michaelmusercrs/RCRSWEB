import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Phone, Clock, CheckCircle2, Award, Shield } from 'lucide-react';
import { generateMetadata as genMeta } from '@/lib/seo';

export const metadata: Metadata = genMeta({
  title: 'Roof Repair & Replacement Decatur AL',
  description: 'Expert roofing contractors in Decatur, AL. Roof repair, replacement, storm damage & insurance claims. Free estimates. BBB Accredited. Call (256) 274-8530',
  keywords: ['roof repair Decatur AL', 'roofing contractors Decatur', 'roof replacement Decatur', 'storm damage Decatur', 'hail damage roof Decatur'],
  path: '/locations/decatur',
});

export default function DecaturPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Schema Markup for Local SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "RoofingContractor",
            "name": "River City Roofing Solutions - Decatur",
            "image": "https://rivercityroofingsolutions.com/wp-content/uploads/2019/09/rcrs-square-logo.jpg",
            "@id": "https://rcrsweb.com/locations/decatur",
            "url": "https://rcrsweb.com/locations/decatur",
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
              "latitude": 34.6059,
              "longitude": -86.9833
            },
            "areaServed": {
              "@type": "City",
              "name": "Decatur",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Decatur",
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
      <section className="bg-gradient-to-b from-brand-green to-lime-300 text-black px-6 py-12 md:py-16">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-block mb-4">
            <span className="text-xs uppercase tracking-widest font-bold flex items-center gap-2 justify-center">
              <MapPin className="h-4 w-4" />
              Decatur, Alabama
            </span>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black uppercase tracking-tighter mb-6 leading-tight">
            Decatur Roofing Experts
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto text-black/75 leading-relaxed mb-8">
            Professional roof repair, replacement, and storm damage services in Decatur, AL. Free estimates and insurance claim assistance.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-black text-brand-green hover:bg-neutral-900 font-bold uppercase tracking-widest">
              <Link href="/contact">Get Free Estimate</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-2 border-black text-black hover:bg-black hover:text-brand-green font-bold uppercase tracking-widest">
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
              <Clock className="h-12 w-12 mx-auto mb-4 text-brand-green" />
              <h3 className="font-black uppercase text-lg mb-2">24/7 Emergency</h3>
              <p className="text-neutral-400 text-sm">Available for storm damage</p>
            </CardContent>
          </Card>
          <Card className="border-neutral-800 bg-black text-center">
            <CardContent className="p-6">
              <Shield className="h-12 w-12 mx-auto mb-4 text-brand-green" />
              <h3 className="font-black uppercase text-lg mb-2">BBB Accredited</h3>
              <p className="text-neutral-400 text-sm">Licensed & Insured</p>
            </CardContent>
          </Card>
          <Card className="border-neutral-800 bg-black text-center">
            <CardContent className="p-6">
              <Award className="h-12 w-12 mx-auto mb-4 text-brand-green" />
              <h3 className="font-black uppercase text-lg mb-2">Free Estimates</h3>
              <p className="text-neutral-400 text-sm">No obligation quotes</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Services in Decatur */}
      <section className="py-12 md:py-16 px-6 bg-black border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Our Services</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-wider mb-4">
              Roofing Services in Decatur
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Roof Repair', desc: 'Quick leak repairs and storm damage fixes for Decatur homes.' },
              { title: 'Roof Replacement', desc: 'Complete roof replacements with premium materials and warranties.' },
              { title: 'Storm & Hail Damage', desc: 'Expert assessment and repair of Alabama storm damage.' },
              { title: 'Insurance Claims', desc: 'We handle all paperwork and work with your insurance company.' },
              { title: 'Emergency Services', desc: '24/7 emergency tarping and repairs for urgent situations.' },
              { title: 'Inspections', desc: 'Free roof inspections to assess condition and identify issues.' },
            ].map((service, idx) => (
              <Card
                key={idx}
                className="border-neutral-800 bg-neutral-950 hover:bg-brand-green hover:text-black transition-all duration-300 group"
              >
                <CardContent className="p-6">
                  <div className="w-6 h-6 border-2 border-brand-green group-hover:border-black rounded mb-4"></div>
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

      {/* Google Map */}
      <section className="py-12 md:py-16 px-6 bg-neutral-950 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-black uppercase tracking-wider mb-4">
              Serving Decatur & Surrounding Areas
            </h2>
            <p className="text-neutral-300 text-lg">
              Proudly serving Decatur, Madison, and all of North Alabama
            </p>
          </div>
          <div className="rounded-lg overflow-hidden shadow-xl">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d105126.23!2d-86.9833!3d34.6059!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x88626ca7de6f9bd5%3A0x8e6c99c6f05e5e7!2sDecatur%2C%20AL!5e0!3m2!1sen!2sus!4v1234567890"
              width="100%"
              height="450"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Decatur AL Service Area Map"
            ></iframe>
          </div>
        </div>
      </section>

      {/* Local Testimonials */}
      <section className="py-12 md:py-16 px-6 bg-black border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Reviews</span>
            </div>
            <h2 className="text-4xl font-black uppercase tracking-wider mb-4">
              What Decatur Customers Say
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-neutral-800 bg-neutral-950">
              <CardContent className="p-6">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-brand-green text-xl">★</span>
                  ))}
                </div>
                <p className="text-neutral-300 italic mb-4">
                  "Excellent service and handled our insurance claim perfectly! Beautiful work on our Decatur home."
                </p>
                <p className="text-brand-green font-bold">- JS, Madison</p>
              </CardContent>
            </Card>

            <Card className="border-neutral-800 bg-neutral-950">
              <CardContent className="p-6">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-brand-green text-xl">★</span>
                  ))}
                </div>
                <p className="text-neutral-300 italic mb-4">
                  "Prompt, hardworking, and honest. They fixed our roof after the hail storm quickly and professionally."
                </p>
                <p className="text-brand-green font-bold">- Alison C., Decatur</p>
              </CardContent>
            </Card>

            <Card className="border-neutral-800 bg-neutral-950">
              <CardContent className="p-6">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-brand-green text-xl">★</span>
                  ))}
                </div>
                <p className="text-neutral-300 italic mb-4">
                  "Rick got our roof replaced through insurance—highly recommend for anyone in the Decatur area!"
                </p>
                <p className="text-brand-green font-bold">- Local Homeowner</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 md:py-16 px-6 bg-neutral-950 border-t border-neutral-800">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <span className="text-xs uppercase tracking-widest font-bold text-brand-green">FAQ</span>
            </div>
            <h2 className="text-4xl font-black uppercase tracking-wider mb-4">
              Decatur Roofing FAQs
            </h2>
          </div>

          <div className="space-y-4">
            <details className="bg-black border border-neutral-800 rounded-lg p-6 group hover:border-brand-green transition-colors">
              <summary className="font-black uppercase tracking-wider cursor-pointer list-none flex justify-between items-center">
                Do you offer free roof inspections in Decatur?
                <CheckCircle2 className="h-5 w-5 text-brand-green" />
              </summary>
              <p className="text-neutral-400 mt-4 leading-relaxed">
                Yes! We provide free, no-obligation roof inspections for all Decatur-area homes. Our certified inspectors will assess your roof's condition and provide a detailed report with photos.
              </p>
            </details>

            <details className="bg-black border border-neutral-800 rounded-lg p-6 group hover:border-brand-green transition-colors">
              <summary className="font-black uppercase tracking-wider cursor-pointer list-none flex justify-between items-center">
                How quickly can you respond to storm damage in Decatur?
                <CheckCircle2 className="h-5 w-5 text-brand-green" />
              </summary>
              <p className="text-neutral-400 mt-4 leading-relaxed">
                We offer 24/7 emergency services for storm damage. We can typically have a crew at your Decatur property within hours for emergency tarping and temporary repairs.
              </p>
            </details>

            <details className="bg-black border border-neutral-800 rounded-lg p-6 group hover:border-brand-green transition-colors">
              <summary className="font-black uppercase tracking-wider cursor-pointer list-none flex justify-between items-center">
                Do you help with insurance claims for Alabama storms?
                <CheckCircle2 className="h-5 w-5 text-brand-green" />
              </summary>
              <p className="text-neutral-400 mt-4 leading-relaxed">
                Absolutely! We have extensive experience working with insurance companies on storm and hail damage claims in Alabama. We'll handle all documentation, photos, and communication with your insurance adjuster.
              </p>
            </details>

            <details className="bg-black border border-neutral-800 rounded-lg p-6 group hover:border-brand-green transition-colors">
              <summary className="font-black uppercase tracking-wider cursor-pointer list-none flex justify-between items-center">
                What roofing materials do you install in Decatur?
                <CheckCircle2 className="h-5 w-5 text-brand-green" />
              </summary>
              <p className="text-neutral-400 mt-4 leading-relaxed">
                We install all major roofing types including asphalt shingles (IKO Dynasty, Owens Corning, GAF), metal roofing, TPO commercial systems, and specialty materials. We'll help you choose the best option for Alabama's climate.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-16 px-6 bg-brand-green text-black border-t border-neutral-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-wider mb-4 leading-tight">
            Ready for Your Free Decatur Roof Estimate?
          </h2>
          <p className="text-lg mb-8 text-black/75 leading-relaxed">
            Call us today or fill out our contact form. We'll schedule your free inspection and provide an honest, detailed estimate.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-black text-brand-green hover:bg-neutral-900 font-bold uppercase tracking-widest">
              <Link href="/contact">Request Free Estimate</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-2 border-black text-black hover:bg-black hover:text-brand-green font-bold uppercase tracking-widest">
              <a href="tel:256-274-8530">Call (256) 274-8530</a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
