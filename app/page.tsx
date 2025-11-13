import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Phone, MapPin, Clock, Shield, Award, Users, CheckCircle2 } from 'lucide-react';
import AnimatedHeroText from '@/components/AnimatedHeroText';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative w-full h-[70vh] flex items-center justify-center overflow-hidden">
        {/* Background Image Placeholder - Replace with actual image */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 z-0">
          {/* Add your hero image here with next/image */}
        </div>
        <div className="absolute inset-0 bg-black/50 z-10" />

        <div className="relative z-20 container mx-auto px-4 text-center text-white">
          <div className="mb-4">
            <p className="text-xl md:text-2xl mb-2 text-gray-200">River City Roofing Solutions</p>
            <AnimatedHeroText />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 mt-6">
            North Alabama's Premier Roofing Company
          </h1>
          <p className="text-lg md:text-xl mb-8 max-w-3xl mx-auto text-gray-200">
            Professional roof replacement, repair, and storm damage services across Decatur, Huntsville, Madison, and beyond
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact" className="btn-modern btn-primary">
              Get Free Inspection
            </Link>
            <Link href="tel:2565551234" className="btn-modern btn-secondary">
              Call (256) 555-1234
            </Link>
          </div>
        </div>
      </section>

      {/* Intro Section - White BG */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-brand-black mb-6">
              Protecting North Alabama Homes Since 2010
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed mb-8">
              River City Roofing Solutions is your local, family-owned roofing company serving communities across North Alabama.
              We specialize in residential and commercial roofing with a commitment to quality workmanship, honest pricing, and exceptional customer service.
            </p>
            <div className="border-l-4 border-brand-green pl-6 text-left">
              <p className="text-xl text-brand-black font-semibold mb-2">
                Licensed • Insured • Locally Owned
              </p>
              <p className="text-gray-600">
                Your neighbors trust us, and you can too.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section - Grey BG */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-brand-black mb-4">
              Our Services
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Complete roofing solutions for residential and commercial properties
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              { title: 'Roof Replacement', desc: 'Complete roof replacement with premium materials and expert installation' },
              { title: 'Roof Repair', desc: 'Fast, reliable repairs to fix leaks and storm damage' },
              { title: 'Storm Damage', desc: 'Insurance claims assistance and emergency storm damage restoration' },
              { title: 'Commercial Roofing', desc: 'Professional roofing services for businesses and commercial properties' },
              { title: 'Inspections', desc: 'Comprehensive roof inspections with detailed reports' },
              { title: 'Maintenance', desc: 'Preventive maintenance programs to extend your roof lifespan' },
            ].map((service, idx) => (
              <div
                key={idx}
                className="bg-white border border-gray-200 hover:border-brand-blue card-modern p-8"
              >
                <div className="bg-brand-green/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-4">
                  <CheckCircle2 className="text-brand-green" size={32} />
                </div>
                <h3 className="text-xl font-bold text-brand-black mb-3">{service.title}</h3>
                <p className="text-gray-600 leading-relaxed">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Info Section - White BG */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center bg-white p-8 card-modern border border-gray-100">
              <div className="bg-brand-blue/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Phone className="text-brand-blue" size={36} />
              </div>
              <h3 className="text-xl font-bold text-brand-black mb-2">Call Us</h3>
              <p className="text-gray-600 mb-3">Available 24/7 for emergencies</p>
              <a href="tel:2565551234" className="text-brand-blue hover:text-blue-700 font-semibold text-lg transition-colors">
                (256) 555-1234
              </a>
            </div>

            <div className="text-center bg-white p-8 card-modern border border-gray-100">
              <div className="bg-brand-blue/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Clock className="text-brand-blue" size={36} />
              </div>
              <h3 className="text-xl font-bold text-brand-black mb-2">Business Hours</h3>
              <p className="text-gray-600">Monday - Friday: 7am - 6pm</p>
              <p className="text-gray-600">Saturday: 8am - 4pm</p>
            </div>

            <div className="text-center bg-white p-8 card-modern border border-gray-100">
              <div className="bg-brand-blue/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <MapPin className="text-brand-blue" size={36} />
              </div>
              <h3 className="text-xl font-bold text-brand-black mb-2">Serving</h3>
              <p className="text-gray-600">Decatur, Huntsville, Madison,</p>
              <p className="text-gray-600">Athens & All of North Alabama</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Section - Blue BG */}
      <section className="py-16 md:py-24 bg-brand-blue">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Why Choose River City Roofing?
            </h2>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
              Experience the difference of working with a trusted local roofing company
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {[
              { icon: Shield, title: 'Fully Licensed & Insured', desc: 'Complete coverage for your peace of mind' },
              { icon: Award, title: '10+ Years Experience', desc: 'Proven expertise in North Alabama roofing' },
              { icon: Users, title: 'Local Family Business', desc: 'Your neighbors, serving the community' },
              { icon: CheckCircle2, title: 'Quality Guaranteed', desc: 'Superior workmanship on every project' },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="flex flex-col items-center text-center">
                  <div className="bg-brand-green rounded-3xl p-5 mb-6 shadow-lg">
                    <Icon className="text-white" size={36} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-blue-100 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section - White BG */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto border-l-4 border-brand-green pl-8">
            <h2 className="text-4xl md:text-5xl font-bold text-brand-black mb-4">
              Ready to Protect Your Home?
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Get a free, no-obligation inspection and quote today. Our experts will assess your roof and provide honest recommendations.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/contact" className="btn-modern btn-primary">
                Schedule Free Inspection
              </Link>
              <Link href="tel:2565551234" className="btn-modern btn-secondary">
                Call (256) 555-1234
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
