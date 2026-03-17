import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DollarSign, Clock, CheckCircle2, Shield, Calculator, CreditCard, Phone, ArrowRight } from 'lucide-react';
import { generateMetadata as genMeta, generateBreadcrumbSchema, siteConfig } from '@/lib/seo';
import StructuredData from '@/components/StructuredData';
import type { Metadata } from 'next';

export const metadata: Metadata = genMeta({
  title: 'Roof Financing Options',
  description: 'Affordable roofing financing in North Alabama. Low monthly payments, competitive rates. Get your roof replaced today, pay over time.',
  path: '/financing',
  keywords: ['roof financing', 'roofing payment plans', 'affordable roofing', 'roof replacement financing', 'no money down roofing', 'North Alabama roof financing'],
});

const benefits = [
  {
    icon: DollarSign,
    title: 'No Money Down',
    desc: 'Get your new roof installed with $0 out of pocket. Start your project today without upfront costs.',
  },
  {
    icon: Clock,
    title: 'Quick Approval',
    desc: 'Apply in minutes and get a decision fast. Most applicants receive approval within 24 hours.',
  },
  {
    icon: CreditCard,
    title: 'Low Monthly Payments',
    desc: 'Flexible terms with low monthly payments that fit your budget. Plans from 12 to 144 months.',
  },
  {
    icon: Shield,
    title: 'Competitive Rates',
    desc: 'We work with multiple lenders to find you the best rate available. Rates as low as 6.99% APR for qualified applicants.',
  },
];

const paymentExamples = [
  { amount: '$8,000', term: '60 months', rate: '7.99%', monthly: '$162' },
  { amount: '$12,000', term: '84 months', rate: '8.99%', monthly: '$193' },
  { amount: '$15,000', term: '120 months', rate: '9.99%', monthly: '$198' },
  { amount: '$20,000', term: '144 months', rate: '9.99%', monthly: '$233' },
];

const steps = [
  {
    step: 1,
    title: 'Free Inspection',
    desc: 'We inspect your roof and provide a detailed estimate at no cost.',
  },
  {
    step: 2,
    title: 'Choose Your Plan',
    desc: 'Review financing options and select the plan that works best for your budget.',
  },
  {
    step: 3,
    title: 'Quick Approval',
    desc: 'Complete a simple application. Most applicants are approved within 24 hours.',
  },
  {
    step: 4,
    title: 'Roof Installed',
    desc: 'We install your new roof and you start making affordable monthly payments.',
  },
];

export default function FinancingPage() {
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Financing', url: '/financing' },
  ]);

  const financialProductSchema = {
    '@context': 'https://schema.org',
    '@type': 'FinancialProduct',
    name: 'Roof Replacement Financing',
    description: 'Affordable financing options for residential and commercial roof replacement in North Alabama. Low monthly payments with competitive rates.',
    provider: {
      '@type': 'RoofingContractor',
      '@id': `${siteConfig.url}#organization`,
      name: siteConfig.name,
      telephone: siteConfig.phone,
    },
    url: `${siteConfig.url}/financing`,
    feesAndCommissionsSpecification: 'No hidden fees. Competitive APR rates starting at 6.99% for qualified applicants.',
    interestRate: {
      '@type': 'QuantitativeValue',
      minValue: 6.99,
      maxValue: 12.99,
      unitCode: 'P1',
    },
    annualPercentageRate: {
      '@type': 'QuantitativeValue',
      minValue: 6.99,
      maxValue: 12.99,
      unitCode: 'P1',
    },
  };

  return (
    <div className="min-h-screen">
      <StructuredData data={[financialProductSchema, breadcrumbSchema]} />

      {/* Hero Section */}
      <section className="min-h-[50vh] flex items-center justify-center">
        <div className="container mx-auto px-4 text-center text-white">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 drop-shadow-lg">
            Roof Financing
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto text-white/90 drop-shadow-md">
            Get the roof you need today. Pay over time with affordable monthly payments.
          </p>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Why Finance Your Roof?
            </h2>
            <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
              Don&apos;t let cost stop you from protecting your home. Our financing makes a new roof affordable for every budget.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {benefits.map((benefit, idx) => {
              const Icon = benefit.icon;
              return (
                <div key={idx} className="flex flex-col items-center text-center">
                  <div className="bg-brand-green rounded-full p-4 mb-4">
                    <Icon className="text-black" size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{benefit.title}</h3>
                  <p className="text-neutral-400">{benefit.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Payment Examples */}
      <section className="py-12 md:py-16 bg-black/70 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 bg-brand-green/10 border border-brand-green/30 rounded-full px-4 py-2 mb-4">
                <Calculator size={18} className="text-brand-green" />
                <span className="text-brand-green text-sm font-semibold">Payment Estimator</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Estimated Monthly Payments
              </h2>
              <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
                See how affordable a new roof can be. These are example payments for qualified applicants.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {paymentExamples.map((example, idx) => (
                <div
                  key={idx}
                  className="bg-neutral-800 border border-neutral-700 rounded-lg p-6 text-center hover:border-brand-green/50 transition-all"
                >
                  <div className="text-neutral-400 text-sm mb-1">Roof Cost</div>
                  <div className="text-2xl font-bold text-white mb-4">{example.amount}</div>
                  <div className="border-t border-neutral-700 pt-4 mb-4">
                    <div className="text-4xl font-bold text-brand-green">{example.monthly}</div>
                    <div className="text-neutral-400 text-sm">per month</div>
                  </div>
                  <div className="space-y-1 text-sm text-neutral-500">
                    <div>{example.term} term</div>
                    <div>{example.rate} APR</div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-neutral-500 text-xs text-center mt-6">
              * Payment examples are estimates only. Actual rates and terms depend on creditworthiness and lender approval.
              Rates shown are for illustrative purposes and may vary. Contact us for a personalized quote.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                How It Works
              </h2>
              <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
                Getting financing for your new roof is simple. Here is how the process works.
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-8">
              {steps.map((s) => (
                <div key={s.step} className="text-center">
                  <div className="w-16 h-16 bg-brand-green rounded-full flex items-center justify-center mx-auto mb-4 text-black text-2xl font-bold">
                    {s.step}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{s.title}</h3>
                  <p className="text-neutral-400 text-sm">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Insurance + Financing */}
      <section className="py-12 md:py-16 bg-brand-green/10 backdrop-blur-sm relative z-10 border-y border-brand-green/20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Insurance + Financing = Zero Stress
                </h2>
                <p className="text-neutral-300 leading-relaxed mb-6">
                  If your roof has storm damage, your insurance may cover most or all of the replacement cost.
                  For the remainder — like your deductible or any upgrades — our financing options have you covered.
                  Many of our customers end up paying little to nothing out of pocket.
                </p>
                <div className="space-y-3">
                  {[
                    'Insurance pays for storm damage repairs',
                    'Finance your deductible if needed',
                    'Upgrade materials with affordable payments',
                    'We handle all insurance paperwork',
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <CheckCircle2 className="text-brand-green flex-shrink-0" size={20} />
                      <span className="text-neutral-300">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-8 text-center">
                <div className="text-6xl font-bold text-brand-green mb-2">$0</div>
                <div className="text-xl text-white font-semibold mb-2">Down Payment Required</div>
                <div className="text-neutral-400 text-sm mb-6">
                  Start your roof replacement today with nothing out of pocket
                </div>
                <Button asChild className="w-full bg-brand-green hover:bg-lime-400 text-black font-bold py-4 text-lg">
                  <Link href="/contact">Apply Now</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Mini Section */}
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-8 text-center">Financing FAQ</h2>
            <div className="space-y-4">
              {[
                { q: 'Will applying affect my credit score?', a: 'Initial pre-qualification uses a soft credit check, which does not affect your score. A hard inquiry only occurs when you formally accept the loan terms.' },
                { q: 'Can I pay off my loan early?', a: 'Yes! There are no prepayment penalties. You can pay off your balance early at any time without additional fees.' },
                { q: 'What credit score do I need?', a: 'We work with multiple lenders to accommodate a range of credit profiles. While higher scores get better rates, we have options for most credit situations.' },
                { q: 'How long is the application process?', a: 'The application takes about 5 minutes. Most applicants receive a decision within 24 hours, and many get instant approval.' },
              ].map((faq, idx) => (
                <details
                  key={idx}
                  className="group bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden hover:border-brand-green/50 transition-all"
                >
                  <summary className="flex items-center justify-between cursor-pointer p-5 text-white font-semibold list-none">
                    <span className="pr-4">{faq.q}</span>
                    <ArrowRight size={18} className="text-neutral-400 group-open:rotate-90 transition-transform flex-shrink-0" />
                  </summary>
                  <div className="px-5 pb-5">
                    <p className="text-neutral-300 leading-relaxed">{faq.a}</p>
                  </div>
                </details>
              ))}
            </div>
            <div className="text-center mt-6">
              <Link href="/faq" className="text-brand-green hover:text-lime-400 font-medium transition-colors">
                View All Frequently Asked Questions &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto border-l-4 border-brand-green pl-8">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-neutral-300 mb-8">
              Contact us today for a free estimate and learn about your financing options. Protecting your home has never been more affordable.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild className="bg-brand-green hover:bg-lime-400 text-black font-bold px-8 py-6 text-lg">
                <Link href="/contact">Get Free Estimate</Link>
              </Button>
              <Button asChild className="border-2 border-white text-white hover:bg-white hover:text-black font-bold px-8 py-6 text-lg">
                <Link href="tel:256-274-8530">
                  <Phone size={18} className="mr-2" />
                  Call (256) 274-8530
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
