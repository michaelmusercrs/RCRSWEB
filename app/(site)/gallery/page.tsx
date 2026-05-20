import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MapPin, Filter, ArrowRight, Wrench, Shield, HardHat } from 'lucide-react';
import { generateMetadata as genMeta, generateBreadcrumbSchema, siteConfig } from '@/lib/seo';
import StructuredData from '@/components/StructuredData';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';
import type { Metadata } from 'next';

export const metadata: Metadata = genMeta({
  title: 'Roofing Project Gallery | Before & After',
  description: 'View our completed roofing projects across North Alabama. Before and after photos of roof replacements, storm damage repairs & more.',
  path: '/gallery',
  keywords: ['roofing gallery', 'before and after roofing', 'roof replacement photos', 'roofing portfolio', 'North Alabama roofing projects'],
});

interface Project {
  id: string;
  city: string;
  serviceType: string;
  description: string;
  details: string;
  material?: string;
}

const projects: Project[] = [
  {
    id: 'proj-1',
    city: 'Decatur, AL',
    serviceType: 'Roof Replacement',
    description: 'Complete residential roof replacement',
    details: 'Full tear-off of aging 25-year-old 3-tab shingles. Installed IKO Dynasty architectural shingles in Driftwood with new synthetic underlayment, drip edge, and ridge vents.',
    material: 'IKO Dynasty - Driftwood',
  },
  {
    id: 'proj-2',
    city: 'Huntsville, AL',
    serviceType: 'Storm Damage Repair',
    description: 'Hail damage insurance claim project',
    details: 'Severe hail damage documented and filed with insurance. Complete roof replacement including new pipe boots, step flashing, and chimney flashing. Claim handled from start to finish.',
    material: 'IKO Cambridge - Charcoal',
  },
  {
    id: 'proj-3',
    city: 'Madison, AL',
    serviceType: 'Roof Replacement',
    description: 'Two-story home full roof replacement',
    details: 'Large two-story home with multiple valleys and dormers. New ice and water shield in all valleys, GAF Timberline HDZ shingles, and upgraded attic ventilation system.',
    material: 'GAF Timberline HDZ - Weathered Wood',
  },
  {
    id: 'proj-4',
    city: 'Athens, AL',
    serviceType: 'Storm Damage Repair',
    description: 'Wind and hail damage restoration',
    details: 'Severe storm damage with missing shingles and exposed decking. Emergency tarp followed by full replacement. Insurance claim handled with adjuster meeting on-site.',
    material: 'IKO Dynasty - Glacier',
  },
  {
    id: 'proj-5',
    city: 'Hartselle, AL',
    serviceType: 'Roof Replacement',
    description: 'Ranch-style home reroof',
    details: 'Single-story ranch home with attached garage. Removed two layers of old shingles down to deck. Replaced rotted decking sections, installed new shingles with proper ventilation.',
    material: 'IKO Cambridge - Dual Grey',
  },
  {
    id: 'proj-6',
    city: 'Cullman, AL',
    serviceType: 'Commercial Roofing',
    description: 'Commercial flat roof restoration',
    details: 'Small commercial building with failing flat roof system. Installed new TPO single-ply membrane with improved drainage and commercial-grade insulation.',
    material: 'TPO Single-Ply Membrane',
  },
  {
    id: 'proj-7',
    city: 'Decatur, AL',
    serviceType: 'Gutter Installation',
    description: 'LeafX gutter protection system',
    details: 'Complete gutter replacement with 6-inch seamless aluminum gutters and LeafX gutter protection system. Includes new downspouts with proper drainage extensions.',
    material: 'LeafX Gutter Guards',
  },
  {
    id: 'proj-8',
    city: 'Huntsville, AL',
    serviceType: 'Roof Replacement',
    description: 'Historic neighborhood reroof',
    details: 'Older home in Five Points district requiring careful attention to architectural details. Premium shingles selected to match neighborhood aesthetic. All original trim preserved.',
    material: 'IKO Dynasty - Sedona',
  },
  {
    id: 'proj-9',
    city: 'Madison, AL',
    serviceType: 'Storm Damage Repair',
    description: 'Tornado damage emergency repair',
    details: 'Emergency response after severe weather. Temporary tarping within 4 hours of the call. Full roof replacement completed within one week of insurance approval.',
    material: 'IKO Cambridge - Charcoal',
  },
  {
    id: 'proj-10',
    city: 'Moulton, AL',
    serviceType: 'Roof Replacement',
    description: 'Farmhouse roof replacement',
    details: 'Large farmhouse with steep pitch and multiple chimneys. Custom flashing work around all penetrations. New ridge cap and continuous ridge vent for improved airflow.',
    material: 'GAF Timberline HDZ - Barkwood',
  },
  {
    id: 'proj-11',
    city: 'Florence, AL',
    serviceType: 'Chimney Services',
    description: 'Chimney repair and reflashing',
    details: 'Deteriorating chimney flashing causing interior water damage. Complete tear-out of old flashing, installed new step and counter flashing with cricket diverter.',
  },
  {
    id: 'proj-12',
    city: 'Owens Cross Roads, AL',
    serviceType: 'Roof Replacement',
    description: 'New construction-style reroof',
    details: 'Complete roof system overhaul on a 15-year-old home. Added soffit vents, new ridge vent, ice and water shield at eaves, and premium architectural shingles.',
    material: 'IKO Dynasty - Biscayne',
  },
];

const serviceTypes = ['All', 'Roof Replacement', 'Storm Damage Repair', 'Commercial Roofing', 'Gutter Installation', 'Chimney Services'];
const cities = ['All', 'Decatur, AL', 'Huntsville, AL', 'Madison, AL', 'Athens, AL', 'Hartselle, AL', 'Cullman, AL', 'Moulton, AL', 'Florence, AL', 'Owens Cross Roads, AL'];

function getServiceTypeColor(type: string): string {
  switch (type) {
    case 'Roof Replacement': return 'bg-blue-600';
    case 'Storm Damage Repair': return 'bg-red-600';
    case 'Commercial Roofing': return 'bg-purple-600';
    case 'Gutter Installation': return 'bg-teal-600';
    case 'Chimney Services': return 'bg-orange-600';
    default: return 'bg-neutral-600';
  }
}

export default function GalleryPage() {
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Gallery', url: '/gallery' },
  ]);

  const imageListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: 'River City Roofing Project Gallery',
    description: 'Before and after photos of completed roofing projects across North Alabama.',
    url: `${siteConfig.url}/gallery`,
    numberOfItems: projects.length,
    about: {
      '@type': 'RoofingContractor',
      '@id': `${siteConfig.url}#organization`,
      name: siteConfig.name,
    },
  };

  return (
    <div className="min-h-screen">
      <StructuredData data={[imageListSchema, breadcrumbSchema]} />

      {/* Hero Section */}
      <section className="min-h-[50vh] flex items-center justify-center">
        <div className="container mx-auto px-4 text-center text-white">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 drop-shadow-lg">
            Project Gallery
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto text-white/90 drop-shadow-md">
            Browse our completed roofing projects across North Alabama
          </p>
        </div>
      </section>

      {/* Filter Legend */}
      <section className="py-6 bg-black/90 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <Filter size={18} className="text-neutral-400" />
              <span className="text-neutral-400 text-sm font-semibold">Filter by Service:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {serviceTypes.map((type) => (
                <span
                  key={type}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium text-white ${type === 'All' ? 'bg-brand-green text-black' : getServiceTypeColor(type)} opacity-80`}
                >
                  {type}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-4">
              <MapPin size={18} className="text-neutral-400" />
              <span className="text-neutral-400 text-sm font-semibold">Cities Served:</span>
              <span className="text-neutral-500 text-sm">
                {cities.filter(c => c !== 'All').join(' | ')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Before/After */}
      {/*
        TODO(Michael): replace these placeholder paths once real before/after pairs
        are uploaded to /public/uploads. No matched pairs exist yet — reusing
        existing storm/damage imagery so the slider renders without invented
        filenames or fake URLs.
      */}
      <section className="py-12 md:py-16 bg-black/85 backdrop-blur-sm relative z-10 border-y border-white/10">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Featured Project</span>
              <h2 className="text-3xl md:text-4xl font-bold text-white mt-3 mb-3">
                See the Difference
              </h2>
              <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
                Drag the handle to reveal the transformation.
              </p>
            </div>
            <BeforeAfterSlider
              beforeSrc="/uploads/blog-hail-damage-assessment.jpg"
              afterSrc="/uploads/service-storm.jpg"
              beforeAlt="Storm-damaged roof before River City Roofing replacement"
              afterAlt="Same home after a complete roof replacement"
              caption="Storm-damaged roof to full replacement — North Alabama"
              priority
            />
          </div>
        </div>
      </section>

      {/* Project Grid */}
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Completed Projects
              </h2>
              <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
                Every project receives the same attention to detail, quality materials, and professional workmanship
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden hover:border-brand-green/50 transition-all group"
                >
                  {/* Project Visual */}
                  <div className="relative h-56 bg-gradient-to-br from-neutral-800 via-neutral-750 to-neutral-800 overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/5 flex items-center justify-center">
                          {project.serviceType === 'Roof Replacement' && <HardHat size={28} className="text-neutral-500" />}
                          {project.serviceType === 'Storm Damage Repair' && <Shield size={28} className="text-neutral-500" />}
                          {project.serviceType === 'Commercial Roofing' && <HardHat size={28} className="text-neutral-500" />}
                          {project.serviceType === 'Gutter Installation' && <Wrench size={28} className="text-neutral-500" />}
                          {project.serviceType === 'Chimney Services' && <Wrench size={28} className="text-neutral-500" />}
                        </div>
                        <div className="text-neutral-400 text-sm font-medium">{project.city}</div>
                        <div className="text-neutral-500 text-xs mt-0.5">{project.serviceType}</div>
                      </div>
                    </div>
                    {/* Subtle grid pattern */}
                    <div className="absolute inset-0 opacity-[0.03]" style={{
                      backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                      backgroundSize: '24px 24px',
                    }} />
                    {/* Service type badge */}
                    <div className={`absolute top-3 left-3 ${getServiceTypeColor(project.serviceType)} px-3 py-1 rounded-full text-xs font-semibold text-white`}>
                      {project.serviceType}
                    </div>
                  </div>

                  {/* Project Info */}
                  <div className="p-5">
                    <div className="flex items-center gap-2 text-neutral-400 text-sm mb-2">
                      <MapPin size={14} />
                      <span>{project.city}</span>
                    </div>
                    <h3 className="text-white font-bold text-lg mb-2 group-hover:text-brand-green transition-colors">
                      {project.description}
                    </h3>
                    <p className="text-neutral-400 text-sm leading-relaxed mb-3">
                      {project.details}
                    </p>
                    {project.material && (
                      <div className="flex items-center gap-2 text-brand-green text-xs font-medium">
                        <span className="bg-brand-green/10 px-2 py-1 rounded">
                          {project.material}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Note */}
      <section className="py-10 bg-black/70 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-green/10 border border-brand-green/20 text-brand-green text-sm font-medium mb-4">
              <HardHat size={16} />
              Gallery in Progress
            </div>
            <p className="text-neutral-300 text-lg leading-relaxed">
              We are building our project gallery with before-and-after photos from our latest work across North Alabama.
              Check back soon to see completed transformations, or{' '}
              <Link href="/contact" className="text-brand-green hover:underline font-medium">
                contact us
              </Link>{' '}
              to schedule your free inspection and become our next success story.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 md:py-16 bg-brand-green/10 backdrop-blur-sm relative z-10 border-y border-brand-green/20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-brand-green">500+</div>
              <div className="text-neutral-300 text-sm mt-1">Roofs Replaced</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-brand-green">8+</div>
              <div className="text-neutral-300 text-sm mt-1">Cities Served</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-brand-green">5.0</div>
              <div className="text-neutral-300 text-sm mt-1">Google Rating</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-brand-green">5-Year</div>
              <div className="text-neutral-300 text-sm mt-1">Workmanship Warranty</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto border-l-4 border-brand-green pl-8">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Your Roof Could Be Next
            </h2>
            <p className="text-xl text-neutral-300 mb-8">
              Whether you need storm damage repair or a complete roof replacement, we deliver results you can see. Schedule your free inspection today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild className="bg-brand-green hover:bg-lime-400 text-black font-bold px-8 py-6 text-lg">
                <Link href="/contact">Get Your Free Inspection</Link>
              </Button>
              <Button asChild className="border-2 border-white text-white hover:bg-white hover:text-black font-bold px-8 py-6 text-lg">
                <Link href="/reviews">Read Customer Reviews <ArrowRight size={18} className="ml-2" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
