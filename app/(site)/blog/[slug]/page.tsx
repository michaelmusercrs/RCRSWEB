import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { blogPostIndex as staticBlogPosts } from '@/lib/blogPostIndex';
import { getAllBlogPosts, getBlogPostBySlug } from '@/lib/blog-loader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, User, ArrowLeft, ArrowRight } from 'lucide-react';
import StructuredData from '@/components/StructuredData';
import { siteConfig, generateArticleSchema, generateBreadcrumbSchema } from '@/lib/seo';
import { getImageWithFallback, getOgImage } from '@/lib/site-images';
import type { Metadata } from 'next';

// Helper: registry key for a blog slug
const blogKey = (slug: string) => `blog-${slug.replace(/[^a-z0-9-]/g, '')}-cover`;

export const revalidate = 300; // Revalidate every 5 minutes

interface BlogPostPageProps {
  params: {
    slug: string;
  };
}

// Generate static params for all blog posts (static ones for build, CMS ones via ISR)
export async function generateStaticParams() {
  return staticBlogPosts.map((post) => ({
    slug: post.slug,
  }));
}

// Generate metadata for SEO with proper canonical URL
export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const post = await getBlogPostBySlug(params.slug);

  if (!post) {
    return {
      title: 'Post Not Found | River City Roofing Solutions',
    };
  }

  const path = `/blog/${params.slug}`;
  // Build a more SEO-rich description that includes location context
  const baseExcerpt = post.excerpt.replace(/\.$/, '');
  const seoDescription = baseExcerpt.length > 130
    ? baseExcerpt.substring(0, 130) + '... Expert advice from River City Roofing Solutions, Decatur AL.'
    : `${baseExcerpt}. Expert advice from River City Roofing Solutions serving Decatur, Huntsville & North Alabama.`;
  const description = seoDescription.length > 160 ? seoDescription.substring(0, 157) + '...' : seoDescription;
  const rawKeywords = Array.isArray(post.keywords) ? post.keywords : (post.keywords || '').split(',').map((k: string) => k.trim());
  // Add geo-targeted keywords to every blog post
  const keywords = [...rawKeywords, 'North Alabama', 'Decatur AL', 'Huntsville AL'].filter((k, i, arr) => arr.indexOf(k) === i);

  // OG image: registry first (blog-{slug}-cover → og-blog-default → og-site-default),
  // fall back to the post's static image when no registry row exists.
  const ogResolved = await getOgImage(path, blogKey(params.slug));
  const ogImageUrl = ogResolved?.url
    ? (ogResolved.url.startsWith('http') ? ogResolved.url : `${siteConfig.url}${ogResolved.url}`)
    : (post.image.startsWith('http') ? post.image : `${siteConfig.url}${post.image}`);
  const postImageUrl = ogImageUrl;

  return {
    title: `${post.title} | River City Roofing Blog`,
    description,
    keywords,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: post.title,
      description,
      url: `${siteConfig.url}${path}`,
      siteName: siteConfig.name,
      type: 'article',
      locale: 'en_US',
      images: [{ url: postImageUrl, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: [postImageUrl],
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const post = await getBlogPostBySlug(params.slug);

  if (!post) {
    notFound();
  }

  // Resolve hero/cover via registry. When admin swaps the sheet row's
  // URL, this page auto-updates on next request. Today: registry has
  // no row for most slugs → falls through to post.image.
  const heroResolved = await getImageWithFallback(blogKey(params.slug), 'blog-default-cover');
  const heroSrc = heroResolved?.url || post.image;
  const heroAlt = heroResolved?.alt || post.title;

  const allPosts = await getAllBlogPosts();
  const postKeywords = Array.isArray(post.keywords) ? post.keywords : (post.keywords || '').split(',').map((k: string) => k.trim());

  // Get related posts (same author or similar keywords)
  const relatedPosts = allPosts
    .filter((p) => p.slug !== post.slug && (
      p.author === post.author ||
      (() => {
        const pKeywords = Array.isArray(p.keywords) ? p.keywords : (p.keywords || '').split(',').map((k: string) => k.trim());
        return pKeywords.some((kw: string) => postKeywords.includes(kw));
      })()
    ))
    .slice(0, 3);

  // Generate structured data for article
  const articleSchema = generateArticleSchema({
    title: post.title,
    description: post.excerpt,
    image: post.image,
    datePublished: post.date,
    author: post.author,
    url: `${siteConfig.url}/blog/${params.slug}`,
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Blog', url: '/blog' },
    { name: post.title, url: `/blog/${params.slug}` },
  ]);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Article and Breadcrumb Schema */}
      <StructuredData data={[articleSchema, breadcrumbSchema]} />
      {/* Hero Section - Blog Image Background */}
      <section className="relative min-h-[60vh] flex items-end -mt-20 pt-20">
        {/* Background Image */}
        <div className="absolute inset-0">
          <Image
            src={heroSrc}
            alt={heroAlt}
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
            {postKeywords.map((keyword: string, idx: number) => (
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
              {post.content.split('\n\n').map((paragraph, idx) => {
                const trimmed = paragraph.trim();
                // Detect heading-like paragraphs: short, no ending punctuation, no lowercase start
                const isHeading = trimmed.length > 0 && trimmed.length < 100 &&
                  !trimmed.endsWith('.') && !trimmed.endsWith('?') && !trimmed.endsWith('!') &&
                  !trimmed.endsWith('"') && !trimmed.endsWith(')') &&
                  trimmed[0] === trimmed[0].toUpperCase() &&
                  !trimmed.startsWith('At River City') && !trimmed.startsWith('Contact') &&
                  !trimmed.startsWith('Call ');

                if (isHeading) {
                  return (
                    <h2 key={idx} className="text-2xl font-black uppercase tracking-wider text-white mb-4 mt-10 border-l-4 border-brand-green pl-4">
                      {trimmed}
                    </h2>
                  );
                }

                return (
                  <p key={idx} className="mb-6">
                    {trimmed}
                  </p>
                );
              })}
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

          {/* Internal Links for SEO */}
          <div className="mt-12 p-6 bg-neutral-900 border border-neutral-800 rounded-lg">
            <h3 className="text-lg font-bold text-white mb-4">Explore Our Roofing Services &amp; Areas</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Link href="/services/residential-roof-replacement" className="text-gray-300 hover:text-brand-green transition-colors text-sm">Roof Replacement in North Alabama</Link>
              <Link href="/services/storm-hail-damage-repair" className="text-gray-300 hover:text-brand-green transition-colors text-sm">Storm &amp; Hail Damage Repair</Link>
              <Link href="/services/residential-roof-repair" className="text-gray-300 hover:text-brand-green transition-colors text-sm">Roof Repair Services</Link>
              <Link href="/services/commercial-roofing" className="text-gray-300 hover:text-brand-green transition-colors text-sm">Commercial Roofing</Link>
              <Link href="/services/leafx-gutter-protection" className="text-gray-300 hover:text-brand-green transition-colors text-sm">LeafX Gutter Protection</Link>
              <Link href="/services/emergency-roof-services" className="text-gray-300 hover:text-brand-green transition-colors text-sm">Emergency Roof Services</Link>
              <Link href="/service-areas/decatur-al" className="text-gray-300 hover:text-brand-green transition-colors text-sm">Roofing Contractor in Decatur, AL</Link>
              <Link href="/service-areas/huntsville-al" className="text-gray-300 hover:text-brand-green transition-colors text-sm">Roofing Contractor in Huntsville, AL</Link>
              <Link href="/service-areas/madison-al" className="text-gray-300 hover:text-brand-green transition-colors text-sm">Roofing Contractor in Madison, AL</Link>
              <Link href="/service-areas/athens-al" className="text-gray-300 hover:text-brand-green transition-colors text-sm">Roofing Contractor in Athens, AL</Link>
              <Link href="/check-my-address" className="text-gray-300 hover:text-brand-green transition-colors text-sm">Check Your Address for Hail &amp; Storm Damage</Link>
              <Link href="/contact" className="text-brand-green font-semibold hover:text-lime-400 transition-colors text-sm">Schedule a Free Roof Inspection</Link>
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
