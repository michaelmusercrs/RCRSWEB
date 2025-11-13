import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Phone, Cloud, CheckCircle2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'North Alabama Roofing Services | River City Roofing Solutions',
  description: 'Expert roofing services throughout North Alabama. Storm damage specialists. Hail damage repair. Free estimates. Call (256) 274-8530',
  keywords: ['North Alabama roofing', 'storm damage North Alabama', 'hail damage repair Alabama', 'roofing contractors North Alabama'],
};

export default function NorthAlabamaPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <section className="bg-gradient-to-b from-lime-400 to-lime-300 text-black px-6 py-16 md:py-24">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-block mb-4">
            <span className="text-xs uppercase tracking-widest font-bold flex items-center gap-2 justify-center">
              <MapPin className="h-4 w-4" />
              North Alabama Territory
            </span>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black uppercase tracking-tighter mb-6 leading-tight">
            North Alabama Roofing
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto text-black/75 leading-relaxed mb-8">
            Serving communities throughout Northern Alabama with expert roofing services. Storm damage specialists you can trust.
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

      <section className="py-16 md:py-24 px-6 bg-neutral-950 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block mb-4">
              <span className="text-xs uppercase tracking-widest font-bold text-lime-400">Regional Expertise</span>
            </div>
            <h2 className="text-4xl font-black uppercase tracking-wider mb-4">
              Storm Damage Specialists
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-neutral-800 bg-black">
              <CardContent className="p-8 text-center">
                <Cloud className="h-16 w-16 mx-auto mb-4 text-lime-400" />
                <h3 className="text-xl font-black uppercase tracking-wider mb-3">Storm Prone Region</h3>
                <p className="text-neutral-400">We understand North Alabama's weather patterns and storm seasons</p>
              </CardContent>
            </Card>
            <Card className="border-neutral-800 bg-black">
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-lime-400" />
                <h3 className="text-xl font-black uppercase tracking-wider mb-3">Insurance Experts</h3>
                <p className="text-neutral-400">Extensive experience with hail damage and insurance claims</p>
              </CardContent>
            </Card>
            <Card className="border-neutral-800 bg-black">
              <CardContent className="p-8 text-center">
                <Phone className="h-16 w-16 mx-auto mb-4 text-lime-400" />
                <h3 className="text-xl font-black uppercase tracking-wider mb-3">2-3 Day Response</h3>
                <p className="text-neutral-400">Quick service throughout the region</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 px-6 bg-lime-400 text-black border-t border-neutral-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-wider mb-4 leading-tight">
            Serving All of North Alabama
          </h2>
          <p className="text-lg mb-8 text-black/75 leading-relaxed">
            Contact us today for expert roofing services anywhere in Northern Alabama.
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
