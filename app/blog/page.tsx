import Link from 'next/link';
import Image from 'next/image';
import { blogPosts, blogMetadata } from '@/lib/blogData';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, User, ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Roofing Blog | River City Roofing Solutions',
  description: 'Expert roofing tips, guides, and industry insights for North Alabama homeowners. Learn about roof maintenance, materials, storm prep and more.',
  keywords: ['roofing blog', 'roof maintenance', 'North Alabama roofing', 'roof tips'],
};

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section - Lime Background */}
      <section className="bg-gradient-to-b from-lime-400 to-lime-300 text-black px-6 py-16 md:py-24">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-block mb-4">
            <span className="text-xs uppercase tracking-widest font-bold">Expert Insights</span>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black uppercase tracking-tighter mb-6 leading-tight">
            Roofing Blog & Resources
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto text-black/75 leading-relaxed">
            Expert tips and insights from North Alabama's trusted roofing professionals
          </p>
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section className="py-16 md:py-24 px-6 bg-neutral-950 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black uppercase tracking-wider mb-4">
              Latest Articles
            </h2>
            <p className="text-neutral-300 text-lg">
              {blogPosts.length} articles to help you maintain and protect your roof
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.map((post) => (
              <Card
                key={post.id}
                className="border-neutral-800 overflow-hidden hover:border-lime-400 transition-all duration-300 group bg-black"
              >
                {/* Featured Image */}
                <div className="w-full h-56 relative bg-neutral-900">
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* Content */}
                <CardContent className="p-6">
                  {/* Meta */}
                  <div className="flex items-center gap-4 mb-3 text-xs text-neutral-500 uppercase tracking-widest">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {post.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {post.author}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-black uppercase tracking-wider mb-2 group-hover:text-lime-400 transition-colors leading-tight">
                    {post.title}
                  </h3>

                  {/* Excerpt */}
                  <p className="text-sm text-neutral-400 mb-4 leading-relaxed line-clamp-3">
                    {post.excerpt}
                  </p>

                  {/* Keywords */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {post.keywords.slice(0, 3).map((keyword, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-1 bg-neutral-800 rounded-md text-neutral-400"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>

                  {/* Read More Link */}
                  <Link
                    href={`/blog/${post.slug}`}
                    className="text-lime-400 font-bold text-sm uppercase tracking-widest flex items-center gap-2 hover:gap-3 transition-all"
                  >
                    Read Article <ArrowRight className="h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - Lime Background */}
      <section className="py-16 md:py-24 px-6 bg-lime-400 text-black border-t border-neutral-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-wider mb-4 leading-tight">
            Need Roofing Help?
          </h2>
          <p className="text-lg mb-8 text-black/75 leading-relaxed">
            Our experts are ready to answer your questions and provide a free inspection for your North Alabama home.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-black text-lime-400 hover:bg-neutral-900 font-bold uppercase tracking-widest">
              <Link href="/contact">Schedule Inspection</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-2 border-black text-black hover:bg-black hover:text-lime-400 font-bold uppercase tracking-widest">
              <Link href="tel:256-274-8530">Call (256) 274-8530</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
