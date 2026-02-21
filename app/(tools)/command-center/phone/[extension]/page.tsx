import Link from 'next/link';
import { Phone, ArrowLeft } from 'lucide-react';

export default function ExtensionPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-10">
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-6">
          <Phone className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Extension Details</h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 mb-4">Coming Soon</p>
        <p className="text-gray-500 dark:text-gray-400 mb-10 max-w-md mx-auto">
          View extension details, call history, and voicemail for individual team members.
        </p>
        <Link
          href="/command-center/phone"
          className="inline-flex items-center gap-2 text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Phone System
        </Link>
      </div>
    </div>
  );
}
