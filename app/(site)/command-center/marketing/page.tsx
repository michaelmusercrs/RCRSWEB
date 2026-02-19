import Link from 'next/link';
import { Megaphone, ArrowLeft, Mail, Image, Calendar } from 'lucide-react';

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-10">
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 mb-6">
          <Megaphone className="w-8 h-8 text-orange-600 dark:text-orange-400" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Marketing Hub</h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 mb-4">
          Coming Soon
        </p>
        <p className="text-gray-500 dark:text-gray-400 mb-10 max-w-md mx-auto">
          Campaign management, email marketing, digital ads, and content calendar — all in one place.
          This section is under development.
        </p>

        <div className="grid gap-4 sm:grid-cols-3 mb-10 text-left">
          {[
            { icon: Mail, title: 'Email Campaigns', desc: 'Create and track email outreach' },
            { icon: Image, title: 'Digital Ads', desc: 'Manage ad creatives and targeting' },
            { icon: Calendar, title: 'Content Calendar', desc: 'Plan and schedule marketing content' },
          ].map((item) => (
            <div key={item.title} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <item.icon className="w-5 h-5 text-gray-400 mb-2" />
              <h3 className="font-medium text-gray-900 dark:text-white text-sm">{item.title}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>

        <Link
          href="/command-center"
          className="inline-flex items-center gap-2 text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Command Center
        </Link>
      </div>
    </div>
  );
}
