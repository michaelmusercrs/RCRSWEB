import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Paintbrush, ArrowRight, Phone, Eye, Palette, Home, ExternalLink, Shield, Award, CheckCircle2 } from 'lucide-react';
import StructuredData from '@/components/StructuredData';
import { generateMetadata as genMeta, generateBreadcrumbSchema } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = genMeta({
  title: 'Roof Visualizer - See IKO Shingles on Your Home',
  description: 'Explore IKO shingle styles and colors for your home. River City Roofing Solutions is an IKO certified contractor in North Alabama. Use the IKO ROOFViewer® to visualize your new roof.',
  path: '/roof-visualizer',
  keywords: ['roof visualizer', 'IKO shingles', 'roof design tool', 'shingle colors', 'roofing visualization', 'IKO certified contractor'],
});

const shingleLines = [
  {
    name: 'Dynasty',
    tagline: 'Premium Designer Shingles',
    description: 'Thick, ultra-dimensional look inspired by natural wood shake. Class 4 impact resistance and 130 MPH wind warranty.',
    highlights: ['Class 4 Impact Resistant', '130 MPH Wind Warranty', 'ArmourZone® Nailing Area', 'Limited Lifetime Warranty'],
    colors: [
      { name: 'Cornerstone', hex: '#6B6359' },
      { name: 'Frostone Grey', hex: '#8A8D8F' },
      { name: 'Glacier', hex: '#9EA3A8' },
      { name: 'Monaco Red', hex: '#7B3B3A' },
      { name: 'Sedona', hex: '#8B6F55' },
      { name: 'Shadow Brown', hex: '#5C4A3D' },
      { name: 'Biscayne', hex: '#5E6B6B' },
      { name: 'Castle Grey', hex: '#6E7275' },
    ],
  },
  {
    name: 'Cambridge',
    tagline: 'Architectural Laminate Shingles',
    description: 'North America\'s best-selling architectural shingle. Beautiful dimensional look with proven performance and excellent value.',
    highlights: ['Dual Layer Construction', '130 MPH Wind Warranty', 'ArmourZone® Nailing Area', 'Limited Lifetime Warranty'],
    colors: [
      { name: 'Driftwood', hex: '#9B8B76' },
      { name: 'Dual Grey', hex: '#7A7D80' },
      { name: 'Dual Brown', hex: '#6F5D4D' },
      { name: 'Charcoal Grey', hex: '#4A4E52' },
      { name: 'Weatherwood', hex: '#8C8578' },
      { name: 'Harvard Slate', hex: '#5B5E63' },
      { name: 'Aged Redwood', hex: '#7D5B4A' },
      { name: 'Earthtone Cedar', hex: '#7A6652' },
    ],
  },
  {
    name: 'Nordic',
    tagline: 'Performance Shingles',
    description: 'High-performance shingles engineered to endure. Bold, dramatic shadow lines with superior protection against the elements.',
    highlights: ['Class 4 Impact Resistant', '130 MPH Wind Warranty', 'Performance Bred™', 'Limited Lifetime Warranty'],
    colors: [
      { name: 'Granite Black', hex: '#3A3A3C' },
      { name: 'Ice Grey', hex: '#A3A6A9' },
      { name: 'Sedimentary Rock', hex: '#7D756A' },
      { name: 'Ironstone', hex: '#5C5550' },
      { name: 'Cypress', hex: '#6B6E5E' },
      { name: 'Brownstone', hex: '#6E5B4A' },
    ],
  },
  {
    name: 'Marathon',
    tagline: 'Traditional 3-Tab Shingles',
    description: 'A reliable, clean, uniform look at an affordable price. Proven durability backed by IKO\'s manufacturing quality.',
    highlights: ['Clean Uniform Look', 'Affordable Value', 'Wind Resistant', 'Limited Warranty'],
    colors: [
      { name: 'Charcoal Grey', hex: '#4D5053' },
      { name: 'Dual Grey', hex: '#787B7E' },
      { name: 'Weatherwood', hex: '#8A837A' },
      { name: 'Dual Brown', hex: '#70604E' },
      { name: 'Estate Grey', hex: '#6B6E71' },
      { name: 'Desert Tan', hex: '#A69882' },
    ],
  },
];

export default function RoofVisualizerPage() {
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Roof Visualizer', url: '/roof-visualizer' },
  ]);

  return (
    <div className="min-h-screen">
      <StructuredData data={[breadcrumbSchema]} />

      {/* Hero Section */}
      <section className="min-h-[40vh] flex items-center justify-center">
        <div className="container mx-auto px-4 text-center text-white">
          <div className="inline-flex items-center gap-2 bg-brand-green/20 border border-brand-green/40 rounded-full px-4 py-2 mb-6">
            <Paintbrush className="w-4 h-4 text-brand-green" />
            <span className="text-sm text-brand-green font-medium">IKO Certified Contractor</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 drop-shadow-lg">
            Roof Visualizer
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto text-white/90 drop-shadow-md">
            Explore IKO&apos;s premium shingle lines and find the perfect style and color for your home
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { icon: Eye, title: 'Visualize Your Roof', desc: 'Upload a photo of your home and see different shingles applied in real-time with IKO\'s ROOFViewer®.' },
              { icon: Palette, title: 'Explore Colors & Styles', desc: 'Browse IKO\'s full range of shingle colors and styles below to find your perfect match.' },
              { icon: Home, title: 'Expert Installation', desc: 'As an IKO certified contractor, we ensure every shingle is installed to manufacturer specifications.' },
            ].map((feature, i) => (
              <div key={i} className="text-center">
                <div className="w-14 h-14 rounded-full bg-brand-green/20 flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-7 h-7 text-brand-green" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-neutral-400 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* IKO ROOFViewer CTA */}
      <section className="py-16 bg-neutral-950 relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 border border-neutral-700 rounded-2xl p-8 md:p-12 shadow-2xl">
              <div className="inline-flex items-center gap-2 bg-brand-green/10 border border-brand-green/30 rounded-full px-4 py-1.5 mb-6">
                <Shield className="w-4 h-4 text-brand-green" />
                <span className="text-xs text-brand-green font-medium uppercase tracking-wider">IKO ROOFViewer®</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                See Shingles on <span className="text-brand-green">Your</span> Home
              </h2>
              <p className="text-neutral-300 text-lg mb-8 max-w-2xl mx-auto">
                Upload a photo of your home and try different IKO shingle styles and colors in real-time.
                It&apos;s the best way to make a confident roofing decision.
              </p>
              <a
                href="https://www.iko.com/na/roofviewer/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" className="bg-brand-green hover:bg-brand-green/90 text-white font-semibold px-10 py-6 text-lg">
                  Launch Roof Visualizer <ExternalLink className="ml-2 w-5 h-5" />
                </Button>
              </a>
              <p className="text-neutral-500 text-sm mt-4">
                Opens IKO&apos;s ROOFViewer® tool in a new tab — free to use, no account required.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Shingle Lines */}
      <section className="py-16 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              IKO Shingle Lines We Install
            </h2>
            <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
              As an IKO certified contractor, River City Roofing Solutions installs the full range
              of IKO residential roofing products. Explore styles and colors below.
            </p>
          </div>

          <div className="space-y-12 max-w-5xl mx-auto">
            {shingleLines.map((line) => (
              <div
                key={line.name}
                className="bg-gradient-to-br from-neutral-900 to-neutral-800/50 border border-neutral-700/50 rounded-2xl p-6 md:p-8 shadow-xl"
              >
                <div className="md:flex md:items-start md:justify-between md:gap-8">
                  <div className="mb-6 md:mb-0 md:flex-1">
                    <h3 className="text-2xl md:text-3xl font-bold text-white mb-1">
                      IKO {line.name}
                    </h3>
                    <p className="text-brand-green font-medium text-sm mb-3">{line.tagline}</p>
                    <p className="text-neutral-400 mb-4">{line.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {line.highlights.map((h) => (
                        <span
                          key={h}
                          className="inline-flex items-center gap-1.5 text-xs bg-neutral-800 border border-neutral-700 text-neutral-300 rounded-full px-3 py-1"
                        >
                          <CheckCircle2 className="w-3 h-3 text-brand-green" />
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="md:flex-1">
                    <p className="text-sm text-neutral-500 mb-3 font-medium">Available Colors</p>
                    <div className="grid grid-cols-4 sm:grid-cols-4 gap-3">
                      {line.colors.map((color) => (
                        <div key={color.name} className="text-center group">
                          <div
                            className="w-full aspect-square rounded-lg border-2 border-neutral-700 group-hover:border-brand-green/60 transition-colors shadow-md mb-1.5"
                            style={{ backgroundColor: color.hex }}
                            title={color.name}
                          />
                          <span className="text-xs text-neutral-400 group-hover:text-neutral-200 transition-colors leading-tight block">
                            {color.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* IKO Certified Badge Section */}
      <section className="py-12 bg-neutral-950 relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-green/10 border-2 border-brand-green/30 mb-6">
              <Award className="w-10 h-10 text-brand-green" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              IKO Certified Contractor
            </h2>
            <p className="text-neutral-400 text-lg mb-6">
              River City Roofing Solutions is proud to be an IKO certified roofing contractor
              serving North Alabama. This means we meet IKO&apos;s strict standards for installation
              quality, and your warranty is backed by both our workmanship and IKO&apos;s manufacturer guarantee.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-neutral-300">
              {[
                'Factory-Trained Installers',
                'Extended Warranty Options',
                'Full IKO Product Line',
                'Local & Trusted',
              ].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5 bg-neutral-800/50 border border-neutral-700 rounded-full px-4 py-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-green" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Choose Your New Roof?
          </h2>
          <p className="text-lg text-neutral-300 mb-8 max-w-2xl mx-auto">
            Whether you&apos;ve found the perfect shingle or need help deciding, our team is here.
            Get a free estimate and expert guidance on the best IKO products for your home.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact">
              <Button size="lg" className="bg-brand-green hover:bg-brand-green/90 text-white font-semibold px-8">
                Get a Free Estimate <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <a href="tel:+12562748530">
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 px-8">
                <Phone className="mr-2 w-5 h-5" /> (256) 274-8530
              </Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
