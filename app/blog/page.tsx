import Link from 'next/link';
import Image from 'next/image';
import { blogPosts, blogMetadata } from '@/lib/blogData';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, User, ArrowRight } from 'lucide-react';
import VideoBackground from '@/components/VideoBackground';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Roofing Blog | River City Roofing Solutions',
  description: 'Expert roofing tips, guides, and industry insights for North Alabama homeowners. Learn about roof maintenance, materials, storm prep and more.',
  keywords: ['roofing blog', 'roof maintenance', 'North Alabama roofing', 'roof tips'],
};

export default function BlogPage() {
  return (
    <div className="min-h-screen text-white">
      {/* Hero Section */}
      <section className="min-h-[50vh] flex items-center justify-center px-6 py-12 md:py-16">
        <div className="max-w-6xl mx-auto text-center text-white">
          <div className="inline-block mb-4">
            <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Expert Insights</span>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black uppercase tracking-tighter mb-6 leading-tight drop-shadow-lg">
            Roofing Blog & Resources
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto text-white/90 leading-relaxed drop-shadow-md">
            Expert tips and insights from North Alabama's trusted roofing professionals
          </p>
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section className="py-12 md:py-16 px-6 bg-black/80 backdrop-blur-sm border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-black uppercase tracking-wider mb-4">
              Latest Articles
            </h2>
            <p className="text-neutral-300 text-lg">
              {blogPosts.length} articles to help you maintain and protect your roof
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`} className="block">
                <Card className="border-neutral-800 overflow-hidden hover:border-brand-green transition-all duration-300 group bg-black cursor-pointer h-full">
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
                    <h3 className="text-lg font-black uppercase tracking-wider mb-2 group-hover:text-brand-green transition-colors leading-tight">
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
                    <span className="text-brand-green font-bold text-sm uppercase tracking-widest flex items-center gap-2 group-hover:gap-3 transition-all">
                      Read Article <ArrowRight className="h-4 w-4" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-16 px-6 bg-brand-green/90 backdrop-blur-sm text-black">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-wider mb-4 leading-tight">
            Need Roofing Help?
          </h2>
          <p className="text-lg mb-8 text-black/75 leading-relaxed">
            Our experts are ready to answer your questions and provide a free inspection for your North Alabama home.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-black text-brand-green hover:bg-neutral-900 font-bold uppercase tracking-widest">
              <Link href="/contact">Schedule Inspection</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-2 border-black text-black hover:bg-black hover:text-brand-green font-bold uppercase tracking-widest">
              <Link href="tel:256-274-8530">Call (256) 274-8530</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
