import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { blogPosts, blogMetadata } from '@/lib/blogData';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, User, ArrowLeft, ArrowRight } from 'lucide-react';
import { siteConfig } from '@/lib/seo';
import type { Metadata } from 'next';

interface BlogPostPageProps {
  params: {
    slug: string;
  };
}

// Generate static params for all blog posts
export async function generateStaticParams() {
  return blogPosts.map((post) => ({
    slug: post.slug,
  }));
}

// Generate metadata for SEO with proper canonical URL
export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const post = blogPosts.find((p) => p.slug === params.slug);

  if (!post) {
    return {
      title: 'Post Not Found | River City Roofing Solutions',
    };
  }

  const path = `/blog/${params.slug}`;
  const url = `${siteConfig.url}${path}`;
  const description = post.excerpt.length > 155 ? post.excerpt.substring(0, 155) + '...' : post.excerpt;

  return {
    title: `${post.title} | River City Roofing Blog`,
    description,
    keywords: post.keywords,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: post.title,
      description,
      url,
      siteName: siteConfig.name,
      type: 'article',
      images: [{ url: post.image.startsWith('http') ? post.image : `${siteConfig.url}${post.image}` }],
    },
  };
}

export default function BlogPostPage({ params }: BlogPostPageProps) {
  const post = blogPosts.find((p) => p.slug === params.slug);

  if (!post) {
    notFound();
  }

  // Get related posts (same author or similar keywords)
  const relatedPosts = blogPosts
    .filter((p) => p.id !== post.id && (
      p.author === post.author ||
      p.keywords.some((kw) => post.keywords.includes(kw))
    ))
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section - Blog Image Background */}
      <section className="relative min-h-[60vh] flex items-end -mt-20 pt-20">
        {/* Background Image */}
        <div className="absolute inset-0">
          <Image
            src={post.image}
            alt={post.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto px-6 pb-16">
          {/* Back to Blog Link */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-white/75 hover:text-brand-green font-bold uppercase tracking-widest text-sm mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Blog
          </Link>

          {/* Article Meta */}
          <div className="flex items-center gap-6 mb-6 text-sm uppercase tracking-widest text-white/80">
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {post.date}
            </span>
            <span className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {post.author}
            </span>
          </div>

          {/* Article Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter mb-6 leading-tight text-white drop-shadow-lg">
            {post.title}
          </h1>

          {/* Keywords */}
          <div className="flex flex-wrap gap-2">
            {post.keywords.map((keyword, idx) => (
              <span
                key={idx}
                className="text-xs px-3 py-1 bg-brand-green text-black rounded-md font-bold uppercase tracking-widest"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Article Content */}
      <section className="py-12 md:py-16 px-6 bg-neutral-950 border-t border-neutral-800">
        <div className="max-w-4xl mx-auto">
          {/* Excerpt */}
          <div className="mb-12 pb-8 border-b border-neutral-800">
            <p className="text-2xl md:text-3xl text-brand-green font-bold leading-relaxed">
              {post.excerpt}
            </p>
          </div>

          {/* Main Content */}
          <div className="prose prose-invert prose-lg max-w-none">
            <div className="text-neutral-300 leading-relaxed space-y-6 text-lg">
              {post.content.split('\n\n').map((paragraph, idx) => (
                <p key={idx} className="mb-6">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>

          {/* Call-to-Action Box */}
          <div className="mt-12 p-8 bg-brand-green text-black rounded-lg">
            <h3 className="text-2xl font-black uppercase tracking-wider mb-4">
              Need Help With Your Roof?
            </h3>
            <p className="text-lg mb-6 text-black/75">
              Our expert team is ready to provide a free inspection and answer any questions you have.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild size="lg" className="bg-black text-brand-green hover:bg-neutral-900 font-bold uppercase tracking-widest">
                <Link href="/contact">Schedule Inspection</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-2 border-black text-black hover:bg-black hover:text-brand-green font-bold uppercase tracking-widest">
                <a href="tel:256-274-8530">Call (256) 274-8530</a>
              </Button>
            </div>
          </div>

          {/* Author Info */}
          <div className="mt-12 p-6 bg-black border border-neutral-800 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center">
                <User className="h-8 w-8 text-brand-green" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-widest text-neutral-500 mb-1">Written by</p>
                <p className="text-xl font-black uppercase tracking-wider text-brand-green">{post.author}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Related Articles */}
      {relatedPosts.length > 0 && (
        <section className="py-12 md:py-16 px-6 bg-black border-t border-neutral-800">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-block mb-4">
                <span className="text-xs uppercase tracking-widest font-bold text-brand-green">Keep Reading</span>
              </div>
              <h2 className="text-4xl font-black uppercase tracking-wider mb-4">
                Related Articles
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {relatedPosts.map((relatedPost) => (
                <Card
                  key={relatedPost.id}
                  className="border-neutral-800 overflow-hidden hover:border-brand-green transition-all duration-300 group bg-neutral-950"
                >
                  {/* Featured Image */}
                  <div className="w-full h-48 relative bg-neutral-900">
                    <Image
                      src={relatedPost.image}
                      alt={relatedPost.title}
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
                        {relatedPost.date}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-black uppercase tracking-wider mb-3 group-hover:text-brand-green transition-colors leading-tight">
                      {relatedPost.title}
                    </h3>

                    {/* Excerpt */}
                    <p className="text-sm text-neutral-400 mb-4 leading-relaxed line-clamp-2">
                      {relatedPost.excerpt}
                    </p>

                    {/* Read More Link */}
                    <Link
                      href={`/blog/${relatedPost.slug}`}
                      className="text-brand-green font-bold text-sm uppercase tracking-widest flex items-center gap-2 hover:gap-3 transition-all"
                    >
                      Read Article <ArrowRight className="h-4 w-4" />
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Bottom CTA Section - Lime Background */}
      <section className="py-12 md:py-16 px-6 bg-brand-green text-black border-t border-neutral-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-wider mb-4 leading-tight">
            Explore More Roofing Tips
          </h2>
          <p className="text-lg mb-8 text-black/75 leading-relaxed">
            Check out our complete collection of roofing guides, tips, and industry insights.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-black text-brand-green hover:bg-neutral-900 font-bold uppercase tracking-widest">
              <Link href="/blog">View All Articles</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-2 border-black text-black hover:bg-black hover:text-brand-green font-bold uppercase tracking-widest">
              <Link href="/contact">Get Free Estimate</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
