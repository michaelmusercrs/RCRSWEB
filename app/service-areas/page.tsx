import Link from 'next/link';
import { getActiveServiceAreas, getExpansionServiceAreas } from '@/lib/servicesData';
import { MapPin, Clock, Phone, CheckCircle2, Calendar, User, TrendingUp } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Service Areas | River City Roofing Solutions',
  description: 'Serving North Alabama including Decatur, Huntsville, Madison, Athens, and more. Expanding to Birmingham and Nashville. Expert roofing services in your area.',
  keywords: ['service areas', 'North Alabama roofing', 'Decatur AL', 'Huntsville AL', 'Madison AL', 'Birmingham AL', 'Nashville TN'],
};

export default function ServiceAreasPage() {
  const activeAreas = getActiveServiceAreas();
  const expansionAreas = getExpansionServiceAreas();

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative w-full h-[40vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 z-0" />
        <div className="absolute inset-0 bg-black/50 z-10" />

        <div className="relative z-20 container mx-auto px-4 text-center text-white">
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            Service Areas
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto">
            Proudly serving North Alabama and expanding to new markets
          </p>
        </div>
      </section>

      {/* Active Service Areas */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-brand-green/10 text-brand-green px-4 py-2 rounded-full text-sm font-bold mb-4">
                <CheckCircle2 size={20} />
                CURRENTLY SERVING
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-brand-black mb-4">
                Active Service Areas
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Full roofing services available now in these North Alabama locations
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {activeAreas.map((area) => (
                <div
                  key={area.id}
                  className="bg-white card-modern border-2 border-brand-green/20 p-6"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-brand-black mb-1">
                        {area.name}
                      </h3>
                      <p className="text-brand-green font-semibold">{area.state}</p>
                    </div>
                    <div className="w-12 h-12 bg-brand-green/10 rounded-full flex items-center justify-center">
                      <MapPin className="text-brand-green" size={24} />
                    </div>
                  </div>

                  {area.population && (
                    <p className="text-sm text-gray-500 mb-4">
                      Population: {area.population}
                    </p>
                  )}

                  {/* Quick Info */}
                  <div className="space-y-3 mb-6">
                    <div className="flex items-start gap-2">
                      <MapPin className="text-brand-blue mt-0.5 flex-shrink-0" size={16} />
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Coverage</p>
                        <p className="text-sm text-gray-700">{area.coverage}</p>
                      </div>
                    </div>

                    {area.responseTime && (
                      <div className="flex items-start gap-2">
                        <Clock className="text-brand-blue mt-0.5 flex-shrink-0" size={16} />
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Response Time</p>
                          <p className="text-sm text-gray-700">{area.responseTime}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="text-brand-green mt-0.5 flex-shrink-0" size={16} />
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Services</p>
                        <p className="text-sm text-gray-700">{area.services}</p>
                      </div>
                    </div>
                  </div>

                  {/* Key Details */}
                  {area.keyDetails && area.keyDetails.length > 0 && (
                    <div className="pt-4 border-t border-gray-200">
                      <p className="text-xs text-gray-500 font-medium mb-2">Key Details</p>
                      <ul className="space-y-1">
                        {area.keyDetails.map((detail, idx) => (
                          <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                            <span className="text-brand-green mt-1">•</span>
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Expansion Areas */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-brand-blue/10 text-brand-blue px-4 py-2 rounded-full text-sm font-bold mb-4">
                <TrendingUp size={20} />
                COMING SOON
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-brand-black mb-4">
                Expansion Markets
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Growing to serve more communities with the same quality and care
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {expansionAreas.map((area) => (
                <div
                  key={area.id}
                  className="bg-white card-modern border-2 border-brand-blue/20 p-8"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-3xl font-bold text-brand-black mb-1">
                        {area.name}
                      </h3>
                      <p className="text-brand-blue font-semibold">{area.state}</p>
                    </div>
                    <div className="w-14 h-14 bg-brand-blue/10 rounded-full flex items-center justify-center">
                      <MapPin className="text-brand-blue" size={28} />
                    </div>
                  </div>

                  {area.population && (
                    <p className="text-sm text-gray-500 mb-4">
                      Population: {area.population}
                    </p>
                  )}

                  {/* Launch Info */}
                  <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-3 mb-2">
                      <Calendar className="text-brand-blue" size={20} />
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Launch Date</p>
                        <p className="text-lg font-bold text-brand-blue">{area.launchDate}</p>
                      </div>
                    </div>
                    {area.regionalPartner && (
                      <div className="flex items-center gap-3 mt-3">
                        <User className="text-brand-blue" size={20} />
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Regional Partner</p>
                          <p className="text-sm font-bold text-brand-black">{area.regionalPartner}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Info */}
                  <div className="space-y-3 mb-6">
                    <div className="flex items-start gap-2">
                      <MapPin className="text-brand-blue mt-0.5 flex-shrink-0" size={16} />
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Planned Coverage</p>
                        <p className="text-sm text-gray-700">{area.coverage}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="text-brand-blue mt-0.5 flex-shrink-0" size={16} />
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Services</p>
                        <p className="text-sm text-gray-700">{area.services}</p>
                      </div>
                    </div>
                  </div>

                  {/* Expansion Timeline */}
                  {area.expansionTimeline && area.expansionTimeline.length > 0 && (
                    <div className="pt-4 border-t border-gray-200 mb-6">
                      <p className="text-sm text-gray-500 font-medium mb-3">Expansion Timeline</p>
                      <ul className="space-y-2">
                        {area.expansionTimeline.map((step, idx) => (
                          <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                            <span className="text-brand-blue font-bold mt-0.5">•</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Key Details */}
                  {area.keyDetails && area.keyDetails.length > 0 && (
                    <div className="pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-500 font-medium mb-2">Market Opportunities</p>
                      <ul className="space-y-1">
                        {area.keyDetails.map((detail, idx) => (
                          <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                            <CheckCircle2 className="text-brand-green mt-0.5 flex-shrink-0" size={16} />
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Service Standards */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold text-brand-black mb-4">
                Service Standards Across All Areas
              </h2>
              <p className="text-xl text-gray-600">
                Consistent quality and reliability, no matter where you're located
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-brand-black mb-4">Response Times</h3>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="text-brand-green mt-0.5 flex-shrink-0" size={16} />
                    <span><strong>Emergency:</strong> Same-day response</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="text-brand-green mt-0.5 flex-shrink-0" size={16} />
                    <span><strong>Storm damage:</strong> Within 24 hours</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="text-brand-green mt-0.5 flex-shrink-0" size={16} />
                    <span><strong>Regular inspection:</strong> Within 48 hours</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="text-brand-green mt-0.5 flex-shrink-0" size={16} />
                    <span><strong>Routine repairs:</strong> Within 3-5 business days</span>
                  </li>
                </ul>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-brand-black mb-4">Quality Standards</h3>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="text-brand-green mt-0.5 flex-shrink-0" size={16} />
                    <span>Free inspections with no obligation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="text-brand-green mt-0.5 flex-shrink-0" size={16} />
                    <span>Detailed photo and written reports</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="text-brand-green mt-0.5 flex-shrink-0" size={16} />
                    <span>Full insurance claim assistance</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="text-brand-green mt-0.5 flex-shrink-0" size={16} />
                    <span>5-year workmanship guarantee</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="text-brand-green mt-0.5 flex-shrink-0" size={16} />
                    <span>Complete site restoration and cleanup</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-brand-blue">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Serving Your Community
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Contact us today to schedule your free inspection and see why your neighbors trust River City Roofing Solutions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact" className="btn-modern btn-accent">
                Get Free Inspection
              </Link>
              <Link href="tel:256-274-8530" className="btn-modern bg-white text-brand-blue hover:bg-gray-100 flex items-center justify-center gap-2">
                <Phone size={20} />
                Call (256) 274-8530
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
