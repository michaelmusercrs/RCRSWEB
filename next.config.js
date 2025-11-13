/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Remote image patterns for external sources
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'rivercityroofingsolutions.com',
        pathname: '/**',
      },
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Note: Local images from /public/uploads are automatically served by Next.js
  // and don't need to be added to remotePatterns
}

module.exports = nextConfig
