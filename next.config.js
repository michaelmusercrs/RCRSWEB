/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const securityHeaders = [
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
      {
        key: 'X-XSS-Protection',
        value: '1; mode=block',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
      },
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://maps.googleapis.com https://connect.facebook.net",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "img-src 'self' data: blob: https: http:",
          "font-src 'self' https://fonts.gstatic.com",
          "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://maps.googleapis.com https://vitals.vercel-insights.com https://*.vercel-insights.com https://*.vercel-analytics.com https://script.google.com https://*.vercel-storage.com https://pagead2.googlesyndication.com",
          "frame-src 'self' https://www.google.com https://www.youtube.com https://www.facebook.com",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self' https://script.google.com",
          "frame-ancestors 'none'",
        ].join('; '),
      },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
      {
        key: 'Cross-Origin-Opener-Policy',
        value: 'same-origin',
      },
      {
        key: 'Cross-Origin-Resource-Policy',
        value: 'cross-origin',
      },
      {
        key: 'Cross-Origin-Embedder-Policy',
        value: 'unsafe-none',
      },
    ];

    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Static assets - long cache (1 year, immutable)
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif|woff|woff2|ttf|eot)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Uploaded files (images, documents)
        source: '/uploads/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Next.js static chunks and assets
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // API routes returning relatively static data - short cache (5 min)
        source: '/api/cms/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=600',
          },
        ],
      },
      {
        source: '/api/team',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=600',
          },
        ],
      },
      {
        source: '/api/storm-reports/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=600',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'rivercityroofingsolutions.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.rivercityroofingsolutions.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'rcrsal.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.rcrsal.com',
        pathname: '/**',
      },
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // SECURITY: Never expose source maps in production
  productionBrowserSourceMaps: false,
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  env: {
    // Auto-detect sandbox branch and expose to client
    NEXT_PUBLIC_SANDBOX_MODE: process.env.SANDBOX_MODE || (process.env.VERCEL_GIT_COMMIT_REF === 'sandbox' ? 'true' : ''),
    SANDBOX_MODE: process.env.SANDBOX_MODE || (process.env.VERCEL_GIT_COMMIT_REF === 'sandbox' ? 'true' : ''),
  },
}

module.exports = nextConfig
