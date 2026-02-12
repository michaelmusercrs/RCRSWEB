import Link from 'next/link';
import { Search, Home, Phone, Wrench, MapPin } from 'lucide-react';

/**
 * Custom 404 Not Found page
 * Provides branded experience with helpful navigation
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="bg-black border-b border-brand-green/20 py-4">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-green/20 rounded-lg flex items-center justify-center">
              <Wrench className="w-5 h-5 text-brand-green" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">River City Roofing</h2>
              <p className="text-xs text-gray-400">Solutions</p>
            </div>
          </Link>
          <a
            href="tel:256-274-8530"
            className="flex items-center gap-2 text-brand-green hover:text-white transition-colors"
          >
            <Phone className="w-4 h-4" />
            <span className="hidden sm:inline">(256) 274-8530</span>
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-lg w-full text-center">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-brand-green/10 border border-brand-green/30 mb-6">
              <Search className="w-12 h-12 text-brand-green" />
            </div>
            <h1 className="text-6xl font-bold text-white mb-2">404</h1>
            <h2 className="text-xl font-semibold text-neutral-300 mb-4">
              Page Not Found
            </h2>
            <p className="text-neutral-400 max-w-md mx-auto">
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
              Let us help you find what you need.
            </p>
          </div>

          <div className="space-y-4">
            <Link
              href="/"
              className="flex items-center justify-center gap-3 w-full px-6 py-4 rounded-xl bg-brand-green hover:bg-brand-green/90 text-black font-semibold transition-all"
            >
              <Home className="w-5 h-5" />
              Go to Homepage
            </Link>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/services"
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-white transition-colors"
              >
                <Wrench className="w-4 h-4" />
                Our Services
              </Link>
              <Link
                href="/contact"
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-white transition-colors"
              >
                <Phone className="w-4 h-4" />
                Contact Us
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/service-areas"
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-white transition-colors"
              >
                <MapPin className="w-4 h-4" />
                Service Areas
              </Link>
              <Link
                href="/blog"
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-white transition-colors"
              >
                <Search className="w-4 h-4" />
                Blog
              </Link>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-neutral-800">
            <p className="text-neutral-500 text-sm">
              Need immediate help?{' '}
              <a href="tel:256-274-8530" className="text-brand-green hover:underline">
                Call (256) 274-8530
              </a>
            </p>
          </div>
        </div>
      </main>

      <footer className="bg-black border-t border-neutral-800 py-4 text-center text-gray-500 text-sm">
        <p>River City Roofing Solutions - Hartselle, AL</p>
      </footer>
    </div>
  );
}
