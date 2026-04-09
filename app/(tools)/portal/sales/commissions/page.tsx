'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function CommissionsRedirectPage() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    // Redirect to performance page which shows commission data
    router.replace('/portal/sales/performance');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-green mx-auto mb-4" />
        <p className="text-gray-400">Redirecting to performance...</p>
      </div>
    </div>
  );
}
