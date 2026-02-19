'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Portal Error]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center p-6">
      <div className="relative z-10 max-w-lg w-full">
        <div className="rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-500/5 to-orange-500/5 backdrop-blur-sm p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-2">
            Something went wrong
          </h1>
          <p className="text-neutral-400 text-center mb-6">
            An error occurred in the portal. Please try again or contact support if the problem persists.
          </p>

          {process.env.NODE_ENV === 'development' && (
            <div className="mb-6 p-4 rounded-xl bg-neutral-900/50 border border-neutral-800">
              <p className="text-xs font-mono text-red-400 break-all">
                {error.message}
              </p>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={reset}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-brand-green to-emerald-500 hover:from-brand-green/90 hover:to-emerald-500/90 text-black font-semibold transition-all shadow-lg shadow-brand-green/25"
            >
              <RefreshCw className="w-5 h-5" />
              Try Again
            </button>
            <Link
              href="/portal"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Portal
            </Link>
          </div>

          <div className="mt-6 pt-6 border-t border-white/5">
            <p className="text-xs text-neutral-500 text-center">
              If this error persists, please contact{' '}
              <a href="mailto:support@rcrsal.com" className="text-brand-green hover:underline">
                support@rcrsal.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
