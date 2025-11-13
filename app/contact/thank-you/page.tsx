import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, ArrowLeft, Clock, Phone, Shield } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Thank You | River City Roofing Solutions',
  description: 'Thank you for contacting River City Roofing Solutions. We will get back to you shortly.',
};

export default function ThankYouPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section - Lime Background */}
      <section className="bg-gradient-to-b from-brand-green to-lime-300 text-black px-6 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center">
          {/* Success Icon */}
          <div className="inline-flex items-center justify-center w-24 h-24 bg-black rounded-full mb-8">
            <CheckCircle className="h-12 w-12 text-brand-green" />
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black uppercase tracking-tighter mb-6 leading-tight">
            Thank You!
          </h1>

          <p className="text-xl md:text-2xl max-w-2xl mx-auto text-black/75 leading-relaxed">
            Your request has been received and we're excited to help protect your home!
          </p>
        </div>
      </section>

      {/* What Happens Next */}
      <section className="py-16 md:py-24 px-6 bg-neutral-950 border-t border-neutral-800">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block mb-4">
              <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Next Steps</span>
            </div>
            <h2 className="text-4xl font-black uppercase tracking-wider mb-4">
              What Happens Next?
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-neutral-800 bg-black text-center">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-full bg-brand-green text-black flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-black">1</span>
                </div>
                <h3 className="text-lg font-black uppercase tracking-wider mb-3">
                  Review Request
                </h3>
                <p className="text-neutral-400 text-sm leading-relaxed">
                  We'll review your request and confirm your appointment details
                </p>
              </CardContent>
            </Card>

            <Card className="border-neutral-800 bg-black text-center">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-full bg-brand-green text-black flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-black">2</span>
                </div>
                <h3 className="text-lg font-black uppercase tracking-wider mb-3">
                  Schedule Call
                </h3>
                <p className="text-neutral-400 text-sm leading-relaxed">
                  You'll receive a call or email with available appointment times
                </p>
              </CardContent>
            </Card>

            <Card className="border-neutral-800 bg-black text-center">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-full bg-brand-green text-black flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-black">3</span>
                </div>
                <h3 className="text-lg font-black uppercase tracking-wider mb-3">
                  Inspection
                </h3>
                <p className="text-neutral-400 text-sm leading-relaxed">
                  Our inspector will arrive for a thorough roof evaluation
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Quick Info Cards */}
      <section className="py-16 px-6 bg-black border-t border-neutral-800">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-neutral-800 bg-neutral-950">
              <CardContent className="p-8">
                <Clock className="h-12 w-12 text-brand-green mb-4" />
                <h3 className="text-xl font-black uppercase tracking-wider mb-2">
                  Response Time
                </h3>
                <p className="text-neutral-400 leading-relaxed">
                  Typically within 2 hours during business hours
                </p>
              </CardContent>
            </Card>

            <Card className="border-neutral-800 bg-neutral-950">
              <CardContent className="p-8">
                <Phone className="h-12 w-12 text-brand-green mb-4" />
                <h3 className="text-xl font-black uppercase tracking-wider mb-2">
                  Need Quick Help?
                </h3>
                <a
                  href="tel:256-274-8530"
                  className="text-brand-green font-bold text-lg hover:underline"
                >
                  (256) 274-8530
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Emergency Notice */}
      <section className="py-12 px-6 bg-neutral-950 border-t border-neutral-800">
        <div className="max-w-4xl mx-auto">
          <Card className="border-yellow-500 bg-black">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <Shield className="h-8 w-8 text-yellow-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-black uppercase tracking-wider mb-3 text-yellow-500">
                    Have an Emergency?
                  </h3>
                  <p className="text-neutral-300 leading-relaxed">
                    If you need immediate assistance with roof damage or leaks, call us right away at{' '}
                    <a
                      href="tel:256-274-8530"
                      className="text-brand-green font-bold hover:underline"
                    >
                      (256) 274-8530
                    </a>
                    . We're available 24/7 for urgent situations.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section - Lime Background */}
      <section className="py-16 md:py-24 px-6 bg-brand-green text-black border-t border-neutral-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-wider mb-4 leading-tight">
            Explore What We Do
          </h2>
          <p className="text-lg mb-8 text-black/75 leading-relaxed">
            While you wait, check out our full range of services or head back home.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-black text-brand-green hover:bg-neutral-900 font-bold uppercase tracking-widest">
              <Link href="/services">View Our Services</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-2 border-black text-black hover:bg-black hover:text-brand-green font-bold uppercase tracking-widest">
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
