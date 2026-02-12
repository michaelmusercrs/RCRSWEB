'use client';

import Link from 'next/link';
import { Search, Command, ArrowLeft, Home, LayoutDashboard } from 'lucide-react';

/**
 * 404 Not Found page for Command Center routes
 * Provides helpful navigation options
 */
export default function CommandCenterNotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center p-6">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-lg w-full text-center">
        {/* 404 Display */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-brand-green/20 to-emerald-500/20 border border-brand-green/30 mb-6">
            <Search className="w-12 h-12 text-brand-green" />
          </div>
          <h1 className="text-6xl font-bold text-white mb-2">404</h1>
          <h2 className="text-xl font-semibold text-neutral-300 mb-4">
            Page Not Found
          </h2>
          <p className="text-neutral-400 max-w-md mx-auto">
            The RoofStack page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* Navigation Options */}
        <div className="space-y-4">
          <Link
            href="/command-center"
            className="flex items-center justify-center gap-3 w-full px-6 py-4 rounded-xl bg-gradient-to-r from-brand-green to-emerald-500 hover:from-brand-green/90 hover:to-emerald-500/90 text-black font-semibold transition-all shadow-lg shadow-brand-green/25"
          >
            <LayoutDashboard className="w-5 h-5" />
            Go to RoofStack HQ
          </Link>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/portal"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Team Portal
            </Link>
            <Link
              href="/"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-colors"
            >
              <Home className="w-4 h-4" />
              Home
            </Link>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-8 pt-8 border-t border-white/5">
          <p className="text-sm text-neutral-500 mb-4">Quick Links</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/command-center/sales"
              className="px-4 py-2 rounded-lg bg-neutral-800/50 hover:bg-neutral-700/50 text-sm text-neutral-300 hover:text-white transition-colors"
            >
              Sales
            </Link>
            <Link
              href="/command-center/inventory"
              className="px-4 py-2 rounded-lg bg-neutral-800/50 hover:bg-neutral-700/50 text-sm text-neutral-300 hover:text-white transition-colors"
            >
              Materials
            </Link>
            <Link
              href="/command-center/marketing"
              className="px-4 py-2 rounded-lg bg-neutral-800/50 hover:bg-neutral-700/50 text-sm text-neutral-300 hover:text-white transition-colors"
            >
              Marketing
            </Link>
            <Link
              href="/command-center/phone"
              className="px-4 py-2 rounded-lg bg-neutral-800/50 hover:bg-neutral-700/50 text-sm text-neutral-300 hover:text-white transition-colors"
            >
              Phone
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
