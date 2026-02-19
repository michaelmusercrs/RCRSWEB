import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Ruler, ArrowRight, Phone, Satellite, Clock, DollarSign } from 'lucide-react';
import StructuredData from '@/components/StructuredData';
import { generateMetadata as genMeta, generateBreadcrumbSchema } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = genMeta({
  title: 'Free Roof Measurement - Instant Satellite Estimate',
  description: 'Get a free, instant satellite roof measurement and cost estimate. No appointment needed — just enter your address and get accurate roof measurements in seconds.',
  path: '/free-roof-measurement',
  keywords: ['free roof measurement', 'roof estimate', 'satellite roof measurement', 'roof cost calculator', 'instant roof estimate'],
});

export default function FreeRoofMeasurementPage() {
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Free Roof Measurement', url: '/free-roof-measurement' },
  ]);

  return (
    <div className="min-h-screen">
      <StructuredData data={[breadcrumbSchema]} />

      {/* Hero Section */}
      <section className="min-h-[40vh] flex items-center justify-center">
        <div className="container mx-auto px-4 text-center text-white">
          <div className="inline-flex items-center gap-2 bg-brand-green/20 border border-brand-green/40 rounded-full px-4 py-2 mb-6">
            <Satellite className="w-4 h-4 text-brand-green" />
            <span className="text-sm text-brand-green font-medium">Free Instant Measurement</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 drop-shadow-lg">
            Free Roof Measurement
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto text-white/90 drop-shadow-md">
            Get an instant satellite measurement and cost estimate — no appointment needed
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-10">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto mb-12">
            {[
              { icon: Satellite, title: '1. Enter Your Address', desc: 'Type in your home address and our satellite technology instantly measures your roof.' },
              { icon: Ruler, title: '2. Get Your Measurement', desc: 'Receive accurate roof dimensions including pitch, area, and complexity — all in seconds.' },
              { icon: DollarSign, title: '3. See Cost Estimates', desc: 'Get ballpark pricing for different materials so you can plan and budget with confidence.' },
            ].map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-14 h-14 rounded-full bg-brand-green/20 flex items-center justify-center mx-auto mb-4">
                  <step.icon className="w-7 h-7 text-brand-green" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-neutral-400 text-sm">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-6 text-neutral-400 text-sm">
            <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Takes 30 seconds</span>
            <span className="flex items-center gap-2"><DollarSign className="w-4 h-4" /> 100% Free</span>
            <span className="flex items-center gap-2"><Satellite className="w-4 h-4" /> No appointment needed</span>
          </div>
        </div>
      </section>

      {/* Instant Roofer Embed */}
      <section className="py-8 bg-neutral-950 relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
              <iframe
                src="https://book.instantroofer.com"
                title="Instant Roofer - Free Roof Measurement"
                className="w-full border-0"
                style={{ height: '700px', minHeight: '500px' }}
                allow="geolocation"
                loading="lazy"
              />
            </div>
            <p className="text-center text-neutral-500 text-sm mt-4">
              Powered by Instant Roofer — satellite-based roof measurement technology.
            </p>
          </div>
        </div>
      </section>

      {/* Why RCRS CTA */}
      <section className="py-16 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Got Your Measurement?
            </h2>
            <p className="text-lg text-neutral-300 mb-4">
              Now let the local experts handle the rest. River City Roofing Solutions provides free on-site
              inspections, detailed quotes, and quality installation backed by manufacturer warranties.
            </p>
            <p className="text-neutral-400 mb-8">
              The online estimate gives you a starting point — our in-person inspection ensures accuracy
              and identifies any hidden issues before work begins.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button size="lg" className="bg-brand-green hover:bg-brand-green/90 text-white font-semibold px-8">
                  Schedule Free Inspection <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <a href="tel:+12562748530">
                <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 px-8">
                  <Phone className="mr-2 w-5 h-5" /> (256) 274-8530
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
