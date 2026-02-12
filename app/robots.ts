/**
 * Robots.txt Configuration
 * Controls search engine crawler access
 * Optimized for SEO best practices
 */

import { MetadataRoute } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rivercityroofingsolutions.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/portal/',
          '/command-center/',
          '/customer/',
          '/dashboard/',
          '/my/',
          '/_next/',
          '/private/',
          '/*.json$',
          '/*/upload',
        ],
      },
      // Google crawler - primary search engine
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/', '/admin/', '/portal/', '/command-center/', '/customer/', '/dashboard/', '/my/'],
      },
      // Google Image crawler - allow all images
      {
        userAgent: 'Googlebot-Image',
        allow: '/',
      },
      // Bing crawler
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: ['/api/', '/admin/', '/portal/', '/command-center/', '/customer/', '/dashboard/', '/my/'],
      },
      // Block aggressive crawlers that may overload the server
      {
        userAgent: 'AhrefsBot',
        crawlDelay: 10,
        allow: '/',
      },
      {
        userAgent: 'SemrushBot',
        crawlDelay: 10,
        allow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
