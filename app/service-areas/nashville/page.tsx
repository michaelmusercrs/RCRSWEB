import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Calendar, TrendingUp, Music } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Nashville TN Roofing - Coming 2026 | River City Roofing Solutions',
  description: 'River City Roofing Solutions expanding to Nashville, TN in 2026. Commercial and residential roofing services coming to Music City.',
  keywords: ['Nashville roofing', 'Nashville TN roofing contractors', 'roofing expansion Nashville'],
};

export default function NashvillePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <section className="bg-gradient-to-b from-brand-green to-lime-300 text-black px-6 py-16 md:py-24">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-block mb-4">
            <span className="text-xs uppercase tracking-widest font-bold flex items-center gap-2 justify-center">
              <Music className="h-4 w-4" />
              Music City Expansion
            </span>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black uppercase tracking-tighter mb-6 leading-tight">
            Coming to Nashville
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto text-black/75 leading-relaxed mb-8">
            River City Roofing Solutions is expanding to Nashville, TN in 2026. Bringing our trusted service to Music City.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-black text-brand-green hover:bg-neutral-900 font-bold uppercase tracking-widest">
              <Link href="/contact">Get Early Access Info</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 px-6 bg-neutral-950 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block mb-4">
              <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Major Expansion</span>
            </div>
            <h2 className="text-4xl font-black uppercase tracking-wider mb-4">
              2026 Launch
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-brand-green bg-black">
              <CardContent className="p-8 text-center">
                <Calendar className="h-16 w-16 mx-auto mb-4 text-brand-green" />
                <h3 className="text-xl font-black uppercase tracking-wider mb-3 text-brand-green">2026</h3>
                <p className="text-neutral-400">Official Nashville launch date</p>
              </CardContent>
            </Card>
            <Card className="border-neutral-800 bg-black">
              <CardContent className="p-8 text-center">
                <Music className="h-16 w-16 mx-auto mb-4 text-brand-green" />
                <h3 className="text-xl font-black uppercase tracking-wider mb-3">Regional Hub</h3>
                <p className="text-neutral-400">Nashville metro & surrounding areas</p>
              </CardContent>
            </Card>
            <Card className="border-neutral-800 bg-black">
              <CardContent className="p-8 text-center">
                <TrendingUp className="h-16 w-16 mx-auto mb-4 text-brand-green" />
                <h3 className="text-xl font-black uppercase tracking-wider mb-3">Growth Market</h3>
                <p className="text-neutral-400">Major commercial opportunities</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 px-6 bg-brand-green text-black border-t border-neutral-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-wider mb-4 leading-tight">
            Stay Informed
          </h2>
          <p className="text-lg mb-8 text-black/75 leading-relaxed">
            Contact us to learn more about our Nashville expansion and get early access to our services in Music City.
          </p>
          <Button asChild size="lg" className="bg-black text-brand-green hover:bg-neutral-900 font-bold uppercase tracking-widest">
            <Link href="/contact">Contact Us</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
