import Link from 'next/link';
import { blogPosts, blogMetadata } from '@/lib/blogData';
import { Calendar, User, ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Roofing Blog | River City Roofing Solutions',
  description: 'Expert roofing tips, guides, and industry insights for North Alabama homeowners. Learn about roof maintenance, materials, storm prep and more.',
  keywords: ['roofing blog', 'roof maintenance', 'North Alabama roofing', 'roof tips'],
};

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative w-full h-[40vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 z-0" />
        <div className="absolute inset-0 bg-black/50 z-10" />

        <div className="relative z-20 container mx-auto px-4 text-center text-white">
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            Roofing Blog & Resources
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto">
            Expert tips and insights from North Alabama's trusted roofing professionals
          </p>
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {blogPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group bg-white card-modern border border-gray-200 hover:border-brand-blue overflow-hidden"
                >
                  {/* Image Placeholder */}
                  <div className="w-full h-48 bg-gray-300 overflow-hidden">
                    <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-gray-600 group-hover:scale-105 transition-transform duration-300">
                      <span className="text-sm font-medium">{post.keywords.join(', ')}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    {/* Meta */}
                    <div className="flex items-center gap-4 mb-3 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar size={16} />
                        <span>{post.date}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User size={16} />
                        <span>{post.author}</span>
                      </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-xl font-bold text-brand-black mb-3 group-hover:text-brand-blue transition-colors line-clamp-2">
                      {post.title}
                    </h2>

                    {/* Excerpt */}
                    <p className="text-gray-600 mb-4 line-clamp-3">
                      {post.excerpt}
                    </p>

                    {/* Read More Link */}
                    <div className="flex items-center gap-2 text-brand-blue font-semibold group-hover:gap-3 transition-all">
                      Read More
                      <ArrowRight size={18} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-brand-blue">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Need Roofing Help?
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Whether you have questions about your roof or need a free inspection, our team is here to help.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact" className="btn-modern btn-accent">
                Get Free Inspection
              </Link>
              <Link href="tel:256-274-8530" className="btn-modern bg-white text-brand-blue hover:bg-gray-100">
                Call (256) 274-8530
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
