'use client';

import ContactForm from '@/components/ContactForm';
import { Clock, Award, Users, CheckCircle2 } from 'lucide-react';
import type { Metadata } from 'next';

const stats = [
  {
    icon: Clock,
    label: '24/7 Support',
    description: 'Available anytime for emergencies',
  },
  {
    icon: Award,
    label: 'Licensed & Insured',
    description: 'Full coverage and certifications',
  },
  {
    icon: Users,
    label: 'Expert Team',
    description: 'Over 40 years combined experience',
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 md:py-24 overflow-hidden">
        <div className="container mx-auto px-4 text-center relative z-10">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-white drop-shadow-lg">
            Let's Talk About Your Roof
          </h1>
          <p className="text-lg md:text-xl max-w-3xl mx-auto text-white/90 drop-shadow-md">
            Our team is ready to help with your roofing needs. Reach out today for a
            free inspection.
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-green/20 mb-4">
                    <Icon className="h-8 w-8 text-brand-green" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2 text-white">{stat.label}</h3>
                  <p className="text-gray-300">{stat.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Contact Section */}
      <section className="py-16 md:py-24 bg-black/70 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <ContactForm showContactInfo={true} darkMode={true} />
        </div>
      </section>

      {/* Google Map Section */}
      <section className="py-16 md:py-24 bg-black/60 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 text-white">
            Our Service Area
          </h2>
          <p className="text-center text-gray-300 mb-8 max-w-2xl mx-auto">
            Proudly serving Decatur, Huntsville, Madison, Athens, and all of North Alabama
          </p>
          <div className="max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-2xl">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d206117.72498731682!2d-87.0665!3d34.6059!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x88626b67596015a5%3A0x1a225ecff2c0cc95!2sDecatur%2C%20AL!5e0!3m2!1sen!2sus!4v1700000000000!5m2!1sen!2sus"
              width="100%"
              height="450"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="River City Roofing Solutions Service Area - Decatur, AL"
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 md:py-24 bg-black/80 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-white">
              Common Questions
            </h2>

            <div className="space-y-6">
              <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl border border-white/20">
                <h3 className="font-semibold text-lg mb-2 text-white flex items-start gap-2">
                  <CheckCircle2 className="text-brand-green mt-0.5 flex-shrink-0" size={20} />
                  How long does a free inspection take?
                </h3>
                <p className="text-gray-300 ml-7">
                  Most inspections take 30-45 minutes. We'll thoroughly examine your
                  roof and provide a detailed assessment with photos and
                  recommendations.
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl border border-white/20">
                <h3 className="font-semibold text-lg mb-2 text-white flex items-start gap-2">
                  <CheckCircle2 className="text-brand-green mt-0.5 flex-shrink-0" size={20} />
                  Do you handle insurance claims?
                </h3>
                <p className="text-gray-300 ml-7">
                  Yes! Our team specializes in insurance claims. We'll help document
                  damage, communicate with your insurance company, and ensure you get
                  fair coverage.
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl border border-white/20">
                <h3 className="font-semibold text-lg mb-2 text-white flex items-start gap-2">
                  <CheckCircle2 className="text-brand-green mt-0.5 flex-shrink-0" size={20} />
                  What's your warranty on work?
                </h3>
                <p className="text-gray-300 ml-7">
                  We stand behind our work with a comprehensive 5-year Workmanship
                  Warranty. Plus, we offer manufacturer warranties on all materials.
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl border border-white/20">
                <h3 className="font-semibold text-lg mb-2 text-white flex items-start gap-2">
                  <CheckCircle2 className="text-brand-green mt-0.5 flex-shrink-0" size={20} />
                  Do you offer emergency services?
                </h3>
                <p className="text-gray-300 ml-7">
                  Absolutely. Call us at (256) 274-8530 anytime, day or night. We
                  provide emergency repairs and temporary solutions for urgent
                  situations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-brand-blue/90 backdrop-blur-sm text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto">
            Don't wait for a small roof problem to become a big one. Schedule your
            free inspection today.
          </p>
          <a
            href="tel:256-274-8530"
            className="inline-flex items-center justify-center px-8 py-3 rounded-full font-semibold bg-brand-green hover:bg-brand-green text-brand-black transition-colors shadow-lg hover:shadow-xl"
          >
            Call Now: (256) 274-8530
          </a>
        </div>
      </section>
    </div>
  );
}
