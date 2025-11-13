'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, Wrench, ShieldCheck, Wind, MapPin, Phone, Clock } from 'lucide-react';
import type { Metadata } from 'next';
import StaticImage from '@/components/StaticImage';

export const metadata: Metadata = {
  title: 'Decatur Roofing Contractor | River City Roofing Solutions',
  description: 'Top-rated roofing services in Decatur, AL. We specialize in roof replacement, repair, and storm damage. Get a free inspection from your local Decatur roofer.',
  keywords: ['Decatur roofing', 'roofing contractor Decatur AL', 'roof repair Decatur', 'roof replacement Decatur', 'Decatur roofer'],
};

const services = [
  {
    icon: <Home className="h-10 w-10 text-brand-green" />,
    title: 'Roof Replacement',
    description: 'High-quality materials for a durable, long-lasting new roof.',
  },
  {
    icon: <Wrench className="h-10 w-10 text-brand-green" />,
    title: 'Roof Repair',
    description: 'Reliable repairs for leaks, storm damage, and wear.',
  },
  {
    icon: <ShieldCheck className="h-10 w-10 text-brand-green" />,
    title: 'Gutter Services',
    description: 'Seamless gutter replacement and LeafX protection systems.',
  },
  {
    icon: <Wind className="h-10 w-10 text-brand-green" />,
    title: 'Insurance Claims',
    description: 'Expert help navigating the insurance process for storm damage.',
  }
];

export default function DecaturPage() {
  return (
    <div className="bg-white">
      {/* HERO SECTION - Dark overlay with image */}
      <section className="relative w-full h-[60vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-black/50 z-10" />
        <StaticImage
          imageSlot="location-decatur"
          alt="Decatur, AL"
          fill
          className="absolute inset-0 z-0 w-full h-full object-cover"
          priority
        />
        <div className="z-20 container mx-auto px-4 text-center">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-4 font-headline">
            Decatur Roofing Experts
          </h1>
          <p className="text-xl md:text-2xl text-white font-body">
            Professional roofing solutions for your home
          </p>
        </div>
      </section>

      {/* INTRO SECTION - White background */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-brand-black mb-6 font-headline">
              Trusted Roofing in Your Community
            </h2>
            <p className="text-lg text-gray-600 font-body leading-relaxed">
              River City Roofing Solutions serves Decatur with professional roofing services. From roof replacement to repairs, we're committed to protecting your home with quality workmanship and a 5-year warranty.
            </p>
          </div>
        </div>
      </section>

      {/* SERVICES SECTION - Light grey background */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-brand-black text-center mb-4 font-headline">
            Our Services in Decatur
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto font-body">
            Complete roofing solutions for residential and commercial properties
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service) => (
              <Card key={service.title} className="border border-gray-200 hover:border-brand-blue hover:shadow-lg transition-all">
                <CardHeader>
                  <div className="w-14 h-14 bg-brand-green/10 rounded-full flex items-center justify-center mb-4">
                    {service.icon}
                  </div>
                  <CardTitle className="text-lg font-headline text-brand-black">
                    {service.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 font-body text-sm">
                    {service.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT INFO SECTION - White background */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {/* Phone */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-brand-green/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Phone className="h-6 w-6 text-brand-blue" />
              </div>
              <div>
                <h3 className="font-bold text-brand-black mb-2 font-headline">Call Us</h3>
                <a href="tel:256-274-8530" className="text-brand-blue hover:underline font-body">
                  (256) 274-8530
                </a>
              </div>
            </div>

            {/* Hours */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-brand-green/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Clock className="h-6 w-6 text-brand-blue" />
              </div>
              <div>
                <h3 className="font-bold text-brand-black mb-2 font-headline">24/7 Available</h3>
                <p className="text-gray-600 font-body">
                  Emergency services available anytime
                </p>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-brand-green/10 rounded-full flex items-center justify-center flex-shrink-0">
                <MapPin className="h-6 w-6 text-brand-blue" />
              </div>
              <div>
                <h3 className="font-bold text-brand-black mb-2 font-headline">Location</h3>
                <p className="text-gray-600 font-body">
                  3325 Central Pkwy SW<br />Decatur, AL 35603
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY CHOOSE US SECTION - Dark blue background */}
      <section className="py-16 md:py-24 bg-brand-blue">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12 font-headline">
            Why Choose River City?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex gap-4">
              <div className="w-6 h-6 rounded-full bg-brand-green flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-black font-bold text-sm">✓</span>
              </div>
              <div>
                <h3 className="font-bold text-white mb-2 font-headline">5-Year Warranty</h3>
                <p className="text-blue-100 font-body">
                  We stand behind our work with a comprehensive 5-year workmanship warranty
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-6 h-6 rounded-full bg-brand-green flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-black font-bold text-sm">✓</span>
              </div>
              <div>
                <h3 className="font-bold text-white mb-2 font-headline">Insurance Experts</h3>
                <p className="text-blue-100 font-body">
                  Experienced with all insurance companies and claims processes
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-6 h-6 rounded-full bg-brand-green flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-black font-bold text-sm">✓</span>
              </div>
              <div>
                <h3 className="font-bold text-white mb-2 font-headline">Licensed & Insured</h3>
                <p className="text-blue-100 font-body">
                  Fully licensed and insured for your peace of mind
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-6 h-6 rounded-full bg-brand-green flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-black font-bold text-sm">✓</span>
              </div>
              <div>
                <h3 className="font-bold text-white mb-2 font-headline">Local Experts</h3>
                <p className="text-blue-100 font-body">
                  Serving the Decatur community with pride and integrity
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA SECTION - White with green accent border */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center border-l-4 border-brand-green pl-8">
            <h2 className="text-3xl md:text-4xl font-bold text-brand-black mb-4 font-headline">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-gray-600 mb-8 font-body">
              Request your free inspection today. No obligation, no pressure — just honest advice about your roof.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button asChild size="lg" className="bg-brand-blue hover:bg-blue-700 text-white font-bold">
                <Link href="/contact">Get Free Inspection</Link>
              </Button>
              <Button 
                asChild 
                variant="outline" 
                size="lg" 
                className="border-2 border-brand-black text-brand-black hover:bg-black hover:text-white font-bold"
              >
                <a href="tel:256-274-8530">Call Us Now</a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
