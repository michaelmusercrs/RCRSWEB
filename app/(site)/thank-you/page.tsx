import Link from 'next/link';
import { CheckCircle2, Phone, CloudLightning, Home, ArrowRight, FileText } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Thank You | River City Roofing Solutions',
  robots: { index: false, follow: false },
};

export default function ThankYouPage() {
  return (
    <div className="min-h-screen text-white">
      <div className="-mt-20 pt-32 pb-12 sm:pt-36 sm:pb-16 px-6 bg-black/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-20 h-20 bg-brand-green rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-black" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-wider mb-4">
            We Got Your <span className="text-brand-green">Message!</span>
          </h1>
          <p className="text-xl text-neutral-300 max-w-xl mx-auto leading-relaxed">
            A River City Roofing team member will reach out within 24 hours. In the meantime, here are some things you can do:
          </p>
        </div>
      </div>

      <section className="py-12 px-6 bg-black/85 backdrop-blur-sm border-t border-neutral-800">
        <div className="max-w-3xl mx-auto">
          {/* What Happens Next */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-8 mb-8">
            <h2 className="text-2xl font-black text-white uppercase tracking-wider mb-6">
              What Happens Next
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <span className="w-8 h-8 bg-brand-green text-black font-black rounded-full flex items-center justify-center flex-shrink-0">1</span>
                <div>
                  <p className="text-white font-bold">We&apos;ll review your request</p>
                  <p className="text-neutral-400 text-sm">Our team reviews every submission personally — no bots, no runaround.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="w-8 h-8 bg-brand-green text-black font-black rounded-full flex items-center justify-center flex-shrink-0">2</span>
                <div>
                  <p className="text-white font-bold">A team member will contact you</p>
                  <p className="text-neutral-400 text-sm">We&apos;ll call or text to schedule your free inspection at a time that works for you.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="w-8 h-8 bg-brand-green text-black font-black rounded-full flex items-center justify-center flex-shrink-0">3</span>
                <div>
                  <p className="text-white font-bold">Free on-site inspection</p>
                  <p className="text-neutral-400 text-sm">One of our certified inspectors will come out, check your roof, and give you an honest assessment — no pressure, no obligation.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <h3 className="text-xl font-black text-white uppercase tracking-wider mb-4 text-center">
            While You Wait
          </h3>
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <Link
              href="/check-my-address"
              className="bg-neutral-950 border border-neutral-800 rounded-xl p-6 hover:border-brand-green transition-all group"
            >
              <CloudLightning className="w-8 h-8 text-brand-green mb-3" />
              <h4 className="text-white font-bold mb-1 group-hover:text-brand-green transition-colors">Free Storm Report</h4>
              <p className="text-neutral-400 text-sm">Check if your address has been hit by recent storms</p>
            </Link>

            <Link
              href="/community"
              className="bg-neutral-950 border border-neutral-800 rounded-xl p-6 hover:border-brand-green transition-all group"
            >
              <Home className="w-8 h-8 text-brand-green mb-3" />
              <h4 className="text-white font-bold mb-1 group-hover:text-brand-green transition-colors">Community Involvement</h4>
              <p className="text-neutral-400 text-sm">See how we give back to North Alabama</p>
            </Link>

            <Link
              href="/services"
              className="bg-neutral-950 border border-neutral-800 rounded-xl p-6 hover:border-brand-green transition-all group"
            >
              <FileText className="w-8 h-8 text-brand-green mb-3" />
              <h4 className="text-white font-bold mb-1 group-hover:text-brand-green transition-colors">Our Services</h4>
              <p className="text-neutral-400 text-sm">Learn about what we offer</p>
            </Link>

            <a
              href="tel:256-274-8530"
              className="bg-neutral-950 border border-neutral-800 rounded-xl p-6 hover:border-brand-green transition-all group"
            >
              <Phone className="w-8 h-8 text-brand-green mb-3" />
              <h4 className="text-white font-bold mb-1 group-hover:text-brand-green transition-colors">Can&apos;t Wait?</h4>
              <p className="text-neutral-400 text-sm">Call us now at (256) 274-8530</p>
            </a>
          </div>

          <div className="text-center">
            <Link
              href="/"
              className="text-neutral-400 hover:text-brand-green transition-colors text-sm font-semibold uppercase tracking-wider inline-flex items-center gap-2"
            >
              <ArrowRight className="w-4 h-4 rotate-180" /> Back to Homepage
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
