import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Phone, Clock, CheckCircle2, Award, Shield, Home } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Roof Repair & Replacement Owens Crossroads AL | River City Roofing Solutions',
  description: 'Expert residential roofing contractors in Owens Crossroads, AL. Roof repair, replacement & storm damage. Free estimates. Call (256) 274-8530',
  keywords: ['roof repair Owens Crossroads AL', 'roofing contractors Owens Crossroads', 'roof replacement Owens Crossroads', 'storm damage Owens Crossroads'],
};

export default function OwensCrossroadsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-lime-400 to-lime-300 text-black px-6 py-16 md:py-24">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-block mb-4">
            <span className="text-xs uppercase tracking-widest font-bold flex items-center gap-2 justify-center">
              <MapPin className="h-4 w-4" />
              Owens Crossroads, Alabama
            </span>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black uppercase tracking-tighter mb-6 leading-tight">
            Owens Crossroads Roofing
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto text-black/75 leading-relaxed mb-8">
            Trusted residential roofing services for the picturesque Owens Crossroads community. Personal service, quality craftsmanship.
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

      {/* Quick Info */}
      <section className="py-12 px-6 bg-neutral-950 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-neutral-800 bg-black text-center">
            <CardContent className="p-6">
              <Home className="h-12 w-12 mx-auto mb-4 text-lime-400" />
              <h3 className="font-black uppercase text-lg mb-2">Residential Focus</h3>
              <p className="text-neutral-400 text-sm">Specialized in homeowner services</p>
            </CardContent>
          </Card>
          <Card className="border-neutral-800 bg-black text-center">
            <CardContent className="p-6">
              <Clock className="h-12 w-12 mx-auto mb-4 text-lime-400" />
              <h3 className="font-black uppercase text-lg mb-2">1-2 Day Response</h3>
              <p className="text-neutral-400 text-sm">Quick service for your community</p>
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

      {/* Services */}
      <section className="py-16 md:py-24 px-6 bg-black border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block mb-4">
              <span className="text-xs uppercase tracking-widest font-bold text-lime-400">Our Services</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-wider mb-4">
              Residential Roofing Services
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Roof Repair', desc: 'Quick fixes for leaks and damage' },
              { title: 'Roof Replacement', desc: 'Complete residential roof replacements' },
              { title: 'Storm Damage', desc: 'Storm and hail damage repairs' },
              { title: 'Insurance Claims', desc: 'Full insurance assistance' },
              { title: 'Free Inspections', desc: 'Thorough assessments at no cost' },
              { title: 'Maintenance', desc: 'Keep your roof in top condition' },
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

      {/* Community Focus */}
      <section className="py-16 md:py-24 px-6 bg-neutral-950 border-t border-neutral-800">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block mb-4">
            <span className="text-xs uppercase tracking-widest font-bold text-lime-400">Local Service</span>
          </div>
          <h2 className="text-4xl font-black uppercase tracking-wider mb-6">
            Serving Your Community
          </h2>
          <p className="text-xl text-neutral-300 leading-relaxed mb-8">
            Owens Crossroads is a special place, and we're proud to serve this close-knit community with personalized roofing solutions. We build lasting relationships with our neighbors.
          </p>
          <div className="grid md:grid-cols-2 gap-6 text-left">
            <div>
              <h3 className="text-lg font-black uppercase tracking-wider mb-3 text-lime-400">Personal Service</h3>
              <p className="text-neutral-400 leading-relaxed">
                We take the time to understand your unique needs and provide tailored solutions for your home.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-wider mb-3 text-lime-400">Strong Relationships</h3>
              <p className="text-neutral-400 leading-relaxed">
                Many of our Owens Crossroads customers have been with us for years and refer their neighbors to us.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 px-6 bg-lime-400 text-black border-t border-neutral-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-wider mb-4 leading-tight">
            Ready for Your Free Estimate?
          </h2>
          <p className="text-lg mb-8 text-black/75 leading-relaxed">
            Call us today to schedule your free inspection for your Owens Crossroads home.
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
