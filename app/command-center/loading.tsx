'use client';

import { Command, Loader2 } from 'lucide-react';

/**
 * Loading state for Command Center
 * Displays a centered spinner while content loads
 */
export default function CommandCenterLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
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

      {/* Loading Content */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Animated Logo */}
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-green/20 to-emerald-500/20 border border-brand-green/30 flex items-center justify-center">
            <Command className="w-10 h-10 text-brand-green" />
          </div>
          {/* Pulse Ring */}
          <div className="absolute inset-0 rounded-2xl border-2 border-brand-green/50 animate-ping" />
        </div>

        {/* Loading Text */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-brand-green animate-spin" />
            <span className="text-lg font-medium text-white">Loading Command Center</span>
          </div>
          <p className="text-sm text-neutral-400">Initializing your dashboard...</p>
        </div>

        {/* Loading Bar */}
        <div className="w-64 h-1 bg-neutral-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-brand-green to-emerald-500 rounded-full animate-loading-bar" />
        </div>
      </div>

      {/* Custom Animation Styles */}
      <style jsx>{`
        @keyframes loading-bar {
          0% {
            width: 0%;
            margin-left: 0%;
          }
          50% {
            width: 60%;
            margin-left: 20%;
          }
          100% {
            width: 0%;
            margin-left: 100%;
          }
        }
        .animate-loading-bar {
          animation: loading-bar 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
