import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronDown, Phone } from 'lucide-react';
import { generateMetadata as genMeta, generateFAQSchema, generateBreadcrumbSchema } from '@/lib/seo';
import StructuredData from '@/components/StructuredData';
import type { Metadata } from 'next';

export const metadata: Metadata = genMeta({
  title: 'Roofing FAQ | Common Questions',
  description: 'Get answers to common roofing questions. Learn about costs, timelines, insurance claims, and more from North Alabama\'s trusted roofer.',
  path: '/faq',
  keywords: ['roofing FAQ', 'roofing questions', 'roof replacement cost', 'roofing insurance claims', 'how long does a roof last', 'roofing contractor FAQ'],
});

interface FAQItem {
  question: string;
  answer: string;
  category: string;
  relatedLink?: { text: string; href: string };
}

const faqs: FAQItem[] = [
  {
    question: 'How much does a new roof cost in North Alabama?',
    answer: 'The cost of a new roof varies based on the size of your home, materials selected, roof complexity, and any structural repairs needed. In North Alabama, most residential roof replacements range from $8,000 to $20,000+. We provide free, detailed estimates with no hidden fees. Many of our customers pay little to no out-of-pocket cost when their roof is covered by insurance.',
    category: 'Cost & Pricing',
    relatedLink: { text: 'Get a Free Estimate', href: '/contact' },
  },
  {
    question: 'Do you offer financing for roof replacement?',
    answer: 'Yes! We offer flexible financing options to make your new roof affordable. With low monthly payments, competitive interest rates, and quick approval, you can get the roof you need today and pay over time. No money down options are available for qualified applicants.',
    category: 'Cost & Pricing',
    relatedLink: { text: 'Learn About Financing', href: '/financing' },
  },
  {
    question: 'How do insurance claims work for roof damage?',
    answer: 'We handle the entire insurance claims process for you. First, we perform a free inspection to document all damage. Then we help you file the claim and meet with your adjuster on-site to ensure all damage is properly documented. We work directly with your insurance company so you don\'t have to deal with the back-and-forth. Most homeowners pay only their deductible.',
    category: 'Insurance Claims',
    relatedLink: { text: 'Storm Damage Services', href: '/services/storm-hail-damage-repair' },
  },
  {
    question: 'Will you meet with my insurance adjuster?',
    answer: 'Absolutely. We meet with your insurance adjuster on-site to walk the roof together and ensure every bit of damage is documented. This is one of the most important steps in the claims process, and our experience with adjusters helps ensure you receive the full amount you\'re entitled to.',
    category: 'Insurance Claims',
  },
  {
    question: 'How long does a roof replacement take?',
    answer: 'Most residential roof replacements are completed in 1 to 2 days, depending on the size and complexity of your roof. We aim to minimize disruption to your daily life. Our crews arrive early, work efficiently, and perform thorough cleanup before leaving. Larger or more complex projects may take 2-3 days.',
    category: 'Timeline',
  },
  {
    question: 'What roofing materials do you use?',
    answer: 'We primarily install IKO Dynasty and Cambridge architectural shingles, which offer superior wind resistance, impact resistance, and curb appeal. We also install GAF Timberline products and offer TPO and other flat roof systems for commercial projects. All materials come with manufacturer warranties in addition to our 5-year workmanship warranty.',
    category: 'Materials',
    relatedLink: { text: 'Residential Roofing', href: '/services/residential-roof-replacement' },
  },
  {
    question: 'What is the difference between 3-tab and architectural shingles?',
    answer: 'Architectural (dimensional) shingles are thicker, more durable, and have a more attractive multi-dimensional appearance compared to flat 3-tab shingles. They typically last 30-50 years vs. 15-25 years for 3-tab. Architectural shingles also offer better wind resistance (up to 130 mph) and improved impact resistance. We recommend architectural shingles for all new installations.',
    category: 'Materials',
  },
  {
    question: 'What does your warranty cover?',
    answer: 'We provide a comprehensive 5-year workmanship warranty covering all labor, installation defects, and material handling. This is in addition to the manufacturer warranty on the shingles themselves (typically 30-50 years depending on the product). Our warranty means if anything goes wrong with the installation, we fix it at no cost to you.',
    category: 'Warranties',
    relatedLink: { text: 'Warranty Details', href: '/warranty' },
  },
  {
    question: 'How do I know if my roof has storm damage?',
    answer: 'Common signs of storm damage include: missing, cracked, or curled shingles; dents or bruising on shingles (hail damage); granule loss (dark spots or bare patches); damaged flashing around chimneys and vents; dented gutters or downspouts; and water stains on interior ceilings. If you suspect damage, schedule a free inspection right away before the damage gets worse.',
    category: 'Storm Damage',
    relatedLink: { text: 'Check Your Address for Storm Reports', href: '/check-my-address' },
  },
  {
    question: 'Do you offer free roof inspections?',
    answer: 'Yes! We offer completely free, no-obligation roof inspections. One of our trained professionals will thoroughly inspect your roof, document any damage or issues, and provide you with a detailed report. There is absolutely no pressure to commit to any work. We believe in honest assessments.',
    category: 'Inspections',
    relatedLink: { text: 'Schedule Free Inspection', href: '/contact' },
  },
  {
    question: 'How often should I have my roof inspected?',
    answer: 'We recommend having your roof professionally inspected at least once a year, preferably in the spring or fall. You should also get an inspection after any major storm event (hail, high winds, tornadoes). Regular inspections catch small problems before they become expensive repairs and can extend the life of your roof significantly.',
    category: 'Inspections',
    relatedLink: { text: 'Roof Maintenance Services', href: '/services/roof-inspections-maintenance' },
  },
  {
    question: 'Do you do commercial roofing?',
    answer: 'Yes, we provide commercial roofing services including flat roof systems (TPO, EPDM, modified bitumen), metal roofing, and steep-slope commercial applications. We work with business owners, property managers, and HOAs to maintain and replace commercial roofing systems across North Alabama.',
    category: 'Commercial',
    relatedLink: { text: 'Commercial Roofing Services', href: '/services/commercial-roofing' },
  },
  {
    question: 'Do you offer emergency roof repair?',
    answer: 'Yes, we provide 24/7 emergency roof repair services. If a storm has caused immediate damage to your roof, we can respond quickly with temporary tarping to prevent further water intrusion, followed by permanent repairs once your insurance claim is processed. Call us anytime at (256) 274-8530.',
    category: 'Emergency',
    relatedLink: { text: 'Emergency Services', href: '/services/emergency-roof-services' },
  },
  {
    question: 'What is LeafX gutter protection?',
    answer: 'LeafX is a premium gutter protection system that prevents leaves, debris, and pests from clogging your gutters while allowing water to flow freely. It eliminates the need to clean your gutters and protects your home\'s foundation from water damage. We are certified LeafX installers and offer this system as a standalone service or add-on to any roof replacement.',
    category: 'Gutters',
    relatedLink: { text: 'LeafX Gutter Protection', href: '/services/leafx-gutter-protection' },
  },
  {
    question: 'Do you offer chimney repair services?',
    answer: 'Yes, we provide chimney flashing repair and replacement, chimney cap installation, and chimney-related roof leak repairs. Deteriorating chimney flashing is one of the most common causes of roof leaks, and our team has extensive experience solving these issues permanently.',
    category: 'Chimney',
    relatedLink: { text: 'Chimney Services', href: '/services/chimney-services' },
  },
  {
    question: 'What are the signs I need a new roof?',
    answer: 'Key signs include: your roof is 20+ years old; shingles are curling, cracking, or missing; you see granules in your gutters; there are dark streaks or algae growth; you notice sagging or drooping areas; daylight is visible through the attic; you have recurring leaks; or your energy bills have increased significantly. If you notice any of these, schedule a free inspection.',
    category: 'Maintenance',
    relatedLink: { text: 'Schedule Free Inspection', href: '/contact' },
  },
  {
    question: 'How do I choose the right roofing contractor?',
    answer: 'Look for a contractor who is licensed and insured in Alabama, has a physical local address, offers a written workmanship warranty, has strong Google reviews (we have 47+ five-star reviews), will meet with your insurance adjuster, provides detailed written estimates, and doesn\'t pressure you into signing immediately. We check every box and stand behind our work.',
    category: 'Choosing a Contractor',
    relatedLink: { text: 'About Our Team', href: '/about' },
  },
  {
    question: 'How can I maintain my roof to make it last longer?',
    answer: 'Regular maintenance extends roof life significantly: have annual professional inspections, keep gutters clean and flowing, trim overhanging tree branches, remove moss or algae promptly, ensure proper attic ventilation, fix small issues immediately before they spread, and check your attic for signs of moisture after storms. Our maintenance program can handle all of this for you.',
    category: 'Maintenance',
    relatedLink: { text: 'Roof Maintenance Program', href: '/services/roof-inspections-maintenance' },
  },
  {
    question: 'What areas do you serve?',
    answer: 'We serve all of North Alabama including Decatur, Huntsville, Madison, Athens, Hartselle, Cullman, Moulton, Florence, Owens Cross Roads, and surrounding communities. We\'re based in Decatur and our team covers a wide service area throughout the Tennessee Valley region.',
    category: 'Service Area',
    relatedLink: { text: 'View All Service Areas', href: '/service-areas' },
  },
];

// Group FAQs by category for display
const categories = Array.from(new Set(faqs.map(f => f.category)));

export default function FAQPage() {
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'FAQ', url: '/faq' },
  ]);

  const faqSchema = generateFAQSchema(
    faqs.map(f => ({ question: f.question, answer: f.answer }))
  );

  return (
    <div className="min-h-screen">
      <StructuredData data={[faqSchema, breadcrumbSchema]} />

      {/* Hero Section */}
      <section className="min-h-[50vh] flex items-center justify-center">
        <div className="container mx-auto px-4 text-center text-white">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 drop-shadow-lg">
            Frequently Asked Questions
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto text-white/90 drop-shadow-md">
            Answers to common roofing questions from North Alabama homeowners
          </p>
        </div>
      </section>

      {/* Category Quick Links */}
      <section className="py-6 bg-black/90 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-wrap justify-center gap-2">
              {categories.map((cat) => (
                <a
                  key={cat}
                  href={`#${cat.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  className="px-4 py-2 bg-neutral-800 hover:bg-brand-green/20 border border-neutral-700 hover:border-brand-green rounded-full text-sm text-neutral-300 hover:text-brand-green transition-all"
                >
                  {cat}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Sections by Category */}
      <section className="py-12 md:py-16 bg-black/80 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-12">
            {categories.map((category) => {
              const categoryFaqs = faqs.filter(f => f.category === category);
              return (
                <div key={category} id={category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}>
                  <h2 className="text-2xl md:text-3xl font-bold text-brand-green mb-6 flex items-center gap-3">
                    <span className="w-2 h-8 bg-brand-green rounded-full" />
                    {category}
                  </h2>
                  <div className="space-y-4">
                    {categoryFaqs.map((faq, idx) => (
                      <details
                        key={idx}
                        className="group bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden hover:border-brand-green/50 transition-all"
                      >
                        <summary className="flex items-center justify-between cursor-pointer p-5 text-white font-semibold text-lg list-none">
                          <span className="pr-4">{faq.question}</span>
                          <ChevronDown
                            size={20}
                            className="text-neutral-400 group-open:rotate-180 transition-transform flex-shrink-0"
                          />
                        </summary>
                        <div className="px-5 pb-5">
                          <p className="text-neutral-300 leading-relaxed">
                            {faq.answer}
                          </p>
                          {faq.relatedLink && (
                            <Link
                              href={faq.relatedLink.href}
                              className="inline-flex items-center gap-2 mt-3 text-brand-green hover:text-lime-400 font-medium text-sm transition-colors"
                            >
                              {faq.relatedLink.text}
                              <ChevronDown size={14} className="-rotate-90" />
                            </Link>
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Still Have Questions */}
      <section className="py-12 md:py-16 bg-black/70 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Still Have Questions?
            </h2>
            <p className="text-lg text-neutral-300 mb-8 max-w-2xl mx-auto">
              Our team is happy to answer any questions about your roof. Give us a call or schedule a free inspection and we will walk you through everything in person.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild className="bg-brand-green hover:bg-lime-400 text-black font-bold px-8 py-6 text-lg">
                <Link href="/contact">Schedule Free Inspection</Link>
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
