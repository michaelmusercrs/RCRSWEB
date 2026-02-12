'use client';

import { useParams } from 'next/navigation';
import { getWalkthroughBySlug } from '@/lib/walkthrough-data';
import WalkthroughPage from '@/components/WalkthroughPage';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function WalkthroughSlugPage() {
  const params = useParams();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const data = getWalkthroughBySlug(slug);

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Walkthrough Not Found</h1>
          <p className="text-neutral-400 mb-6">
            No walkthrough exists for &ldquo;{slug}&rdquo;.
          </p>
          <Link
            href="/portal/training/walkthrough"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-sm transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Walkthroughs
          </Link>
        </div>
      </div>
    );
  }

  return <WalkthroughPage data={data} />;
}
