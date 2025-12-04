'use client';

import Link from 'next/link';
import { ArrowLeft, Home } from 'lucide-react';
import { ReactNode } from 'react';
import SettingsMenu from '@/components/SettingsMenu';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
  backHref?: string;
  actions?: ReactNode;
}

export default function AdminLayout({
  children,
  title,
  subtitle,
  backHref = '/portal/admin',
  actions,
}: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href={backHref}
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={18} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
                  <p className="text-sm text-neutral-400">{subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {actions}
                <Link
                  href="/"
                  target="_blank"
                  className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 text-sm transition-colors"
                >
                  <Home size={16} />
                  View Site
                </Link>
                <SettingsMenu />
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
