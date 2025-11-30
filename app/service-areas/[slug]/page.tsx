import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getServiceArea, getAllServiceAreaSlugs, getPrimaryServices } from '@/lib/servicesData';
import { MapPin, Clock, CheckCircle2, Phone, ArrowRight, ArrowLeft, Home, Wrench, Building2, CloudRain, Flame, Shield, Search, AlertTriangle } from 'lucide-react';
import type { Metadata } from 'next';

const iconMap: { [key: string]: any } = { Home, Wrench, Building2, CloudRain, Flame, Shield, Search, AlertTriangle };

export async function generateStaticParams() {
  return getAllServiceAreaSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const area = getServiceArea(slug);
  if (!area) return { title: 'Area Not Found' };
  return { 
    title: 'Roofing Services in ' + area.name + ', ' + area.state + ' | River City Roofing Solutions',
    description: area.description || 'Professional roofing services in ' + area.name + '. Residential and commercial roofing, storm damage repair, and free inspections.'
  };
}

export default async function ServiceAreaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const area = getServiceArea(slug);
  if (!area) notFound();
  const services = getPrimaryServices().slice(0, 4);

  return (
    <div className="min-h-screen">
      <section className="relative min-h-[60vh] flex items-center">
        {area.image && (
          <div className="absolute inset-0 z-0">
            <Image src={area.image} alt={area.name + ' roofing services'} fill className="object-cover" priority />
            <div className="absolute inset-0 bg-black/60" />
          </div>
        )}
        <div className="container mx-auto px-4 relative z-10">
          <Link href="/service-areas" className="inline-flex items-center gap-2 text-white/80 hover:text-brand-green mb-6 transition-colors">
            <ArrowLeft size={20} /> All Service Areas
          </Link>
          <div className="max-w-4xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-brand-green/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                <MapPin className="text-brand-green" size={32} />
              </div>
              <span className={"px-4 py-2 backdrop-blur-sm rounded-full font-semibold " + (area.status === 'Active' ? "bg-brand-green/20 text-brand-green" : "bg-yellow-500/20 text-yellow-400")}>
                {area.status === 'Active' ? 'Now Serving' : 'Coming Soon'}
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg">Roofing Services in {area.name}, {area.state}</h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl drop-shadow-md">{area.description || area.coverage}</p>
            {area.responseTime && (
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-6 py-3">
                <Clock className="text-brand-green" size={24} />
                <span className="text-white">Response Time: <strong className="text-brand-green">{area.responseTime}</strong></span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-black/80 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-bold text-white mb-8">Area Details</h2>
              <div className="space-y-4">
                {area.population && (
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={20} />
                    <span className="text-gray-300">Population: {area.population}</span>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={20} />
                  <span className="text-gray-300">Coverage: {area.coverage}</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={20} />
                  <span className="text-gray-300">Services: {area.services}</span>
                </div>
                {area.keyDetails && area.keyDetails.map((detail, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="text-brand-green flex-shrink-0 mt-1" size={20} />
                    <span className="text-gray-300">{detail}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white mb-8">Services Available</h2>
              <div className="space-y-4">
                {services.map((service) => {
                  const Icon = iconMap[service.icon];
                  return (
                    <Link key={service.id} href={'/services/' + service.slug} className="flex items-center gap-4 p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl hover:border-brand-green/50 transition-colors group">
                      {Icon && <div className="w-12 h-12 bg-brand-blue/20 rounded-full flex items-center justify-center"><Icon className="text-brand-blue" size={24} /></div>}
                      <div>
                        <h3 className="text-white font-semibold group-hover:text-brand-green transition-colors">{service.title}</h3>
                        <p className="text-gray-400 text-sm">{service.costRange || 'Contact for quote'}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Google Map Section */}
      <section className="py-16 md:py-24 bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-8 text-center">Find Us in {area.name}</h2>
            <div className="rounded-2xl overflow-hidden border border-white/20 shadow-2xl">
              <iframe
                src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${area.mapQuery || area.name + ',+' + area.state}&zoom=12`}
                width="100%"
                height="450"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Map of ${area.name}, ${area.state}`}
              />
            </div>
            <div className="mt-6 text-center">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${area.mapQuery || area.name + ',+' + area.state}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-brand-green hover:text-lime-400 transition-colors"
              >
                <MapPin size={20} />
                Open in Google Maps
                <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-brand-blue">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Get a Free Inspection in {area.name}</h2>
          <p className="text-xl text-blue-100 mb-8">Contact us today for a free roof inspection and quote.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={'/contact?area=' + area.slug} className="inline-flex items-center justify-center gap-2 bg-brand-green text-black font-bold px-8 py-4 rounded-full hover:bg-lime-400 transition-colors">
              Schedule Inspection <ArrowRight size={20} />
            </Link>
            <a href="tel:256-274-8530" className="inline-flex items-center justify-center gap-2 bg-white text-brand-blue font-bold px-8 py-4 rounded-full hover:bg-gray-100 transition-colors">
              <Phone size={20} /> (256) 274-8530
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

