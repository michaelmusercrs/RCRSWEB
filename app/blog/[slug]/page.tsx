import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBlogPost, getAllBlogSlugs, getRecentPosts } from '@/lib/blogData';
import { Calendar, User, ArrowLeft, ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';

export async function generateStaticParams() {
  const slugs = getAllBlogSlugs();
  return slugs.map((slug) => ({
    slug: slug,
  }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = getBlogPost(params.slug);

  if (!post) {
    return {
      title: 'Blog Post Not Found',
    };
  }

  return {
    title: `${post.title} | River City Roofing Blog`,
    description: post.excerpt,
    keywords: post.keywords,
  };
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getBlogPost(params.slug);

  if (!post) {
    notFound();
  }

  const recentPosts = getRecentPosts(3).filter(p => p.id !== post.id);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <section className="py-8 bg-gray-50 border-b border-gray-200">
        <div className="container mx-auto px-4">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-brand-blue hover:text-blue-700 font-semibold transition-colors mb-4"
          >
            <ArrowLeft size={20} />
            Back to Blog
          </Link>
        </div>
      </section>

      {/* Hero/Featured Image */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* Image Placeholder */}
            <div className="w-full h-96 bg-gradient-to-br from-gray-400 to-gray-600 rounded-3xl mb-8 flex items-center justify-center overflow-hidden shadow-xl">
              <span className="text-white text-2xl font-bold">{post.keywords.join(' • ')}</span>
            </div>

            {/* Meta */}
            <div className="flex items-center gap-6 mb-4 text-gray-600">
              <div className="flex items-center gap-2">
                <Calendar size={20} />
                <span>{post.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <User size={20} />
                <span>{post.author}</span>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-bold text-brand-black mb-6">
              {post.title}
            </h1>

            {/* Excerpt */}
            <p className="text-xl text-gray-600 leading-relaxed">
              {post.excerpt}
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="prose prose-lg max-w-none">
              <div className="text-lg text-gray-700 leading-relaxed whitespace-pre-wrap">
                {post.content}
              </div>
            </div>

            {/* Keywords/Tags */}
            <div className="mt-12 pt-8 border-t border-gray-200">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
                Topics
              </h3>
              <div className="flex flex-wrap gap-2">
                {post.keywords.map((keyword, idx) => (
                  <span
                    key={idx}
                    className="bg-brand-green/10 text-brand-green px-4 py-2 rounded-full text-sm font-medium"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Author Card */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white border border-gray-200 rounded-2xl p-8">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">
                Written By
              </h3>
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-brand-blue/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="text-brand-blue" size={32} />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-brand-black mb-2">{post.author}</h4>
                  <p className="text-gray-600">
                    Part of the River City Roofing Solutions team, committed to helping North Alabama homeowners
                    protect their biggest investment.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Posts */}
      {recentPosts.length > 0 && (
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-brand-black mb-8 text-center">
                More From Our Blog
              </h2>

              <div className="grid md:grid-cols-3 gap-8">
                {recentPosts.map((relatedPost) => (
                  <Link
                    key={relatedPost.id}
                    href={`/blog/${relatedPost.slug}`}
                    className="group bg-gray-50 card-modern border border-gray-200 hover:border-brand-blue overflow-hidden"
                  >
                    {/* Image Placeholder */}
                    <div className="w-full h-40 bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-gray-600 text-sm group-hover:scale-105 transition-transform duration-300">
                      {relatedPost.keywords.join(', ')}
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      <p className="text-sm text-gray-500 mb-2">{relatedPost.date}</p>
                      <h3 className="text-lg font-bold text-brand-black mb-2 group-hover:text-brand-blue transition-colors line-clamp-2">
                        {relatedPost.title}
                      </h3>
                      <div className="flex items-center gap-2 text-brand-blue font-semibold text-sm group-hover:gap-3 transition-all">
                        Read More
                        <ArrowRight size={16} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-16 bg-brand-blue">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Have Questions About Your Roof?
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Our team is ready to help. Schedule a free inspection or give us a call today.
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
