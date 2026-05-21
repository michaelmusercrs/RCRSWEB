'use client';

/**
 * Chris View — Hub / Menu.
 *
 * Lists every analytics page so Chris can find what he needs.
 * Lives at /chrisview/menu as a sibling to the main dashboard, so it
 * doesn't conflict with edits to /chrisview/page.tsx.
 */

import Link from 'next/link';
import {
  ArrowLeft, Database, BarChart3, Crown, Brain, Clock, TrendingUp,
  Shield, Wrench, Wallet, HardHat, Megaphone, Heart, ChevronRight, Activity, Star, Trophy, History, Zap,
} from 'lucide-react';

interface Section {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  highlight?: string;
}

const SECTIONS: Section[] = [
  {
    title: 'Main Dashboard',
    description: 'Lifetime revenue, charts, transactions, customers, vendors, reps, commissions, inventory — all in one place',
    href: '/chrisview',
    icon: Database,
    color: 'from-[#39FF14] to-emerald-400',
    highlight: '$35.85M lifetime',
  },
  {
    title: 'Division Leader Checks',
    description: 'Recruiter / override commission payments — who got paid for whom, per memo line',
    href: '/chrisview/leaders',
    icon: Crown,
    color: 'from-amber-400 to-orange-400',
    highlight: '158 checks, $66K',
  },
  {
    title: 'Meeting Insights',
    description: 'Pattern detection in Monday meeting numbers — predictions, attendance, correlations, goal column study',
    href: '/chrisview/insights',
    icon: Brain,
    color: 'from-purple-500 to-pink-500',
    highlight: '252 weeks of data',
  },
  {
    title: 'Lead Response Times',
    description: 'How fast each rep contacts office-created leads — grades, percentiles, first-contact method breakdown',
    href: '/chrisview/response-times',
    icon: Clock,
    color: 'from-blue-500 to-cyan-400',
  },
  {
    title: 'Estimate Close Rates',
    description: 'Close rate by delivery channel (in-person vs online), insurance vs retail, contact method, and rep',
    href: '/chrisview/close-rates',
    icon: TrendingUp,
    color: 'from-emerald-500 to-teal-400',
  },
  {
    title: 'Insurance Deep Dive',
    description: 'Per-carrier RCV / ACV / deductible, days to approve, per-adjuster turnaround speed',
    href: '/chrisview/insurance',
    icon: Shield,
    color: 'from-indigo-500 to-violet-500',
  },
  {
    title: 'Job Lifecycle',
    description: 'Time-to-contract, time-to-install, time-to-paid, trips per job, rework, 90-day unpaid AR',
    href: '/chrisview/lifecycle',
    icon: Wrench,
    color: 'from-rose-500 to-red-400',
  },
  {
    title: 'Deep Funnel (NEW)',
    description: 'Lead → estimate → signed → paid with explicit certainty labels (in-person vs online), status-change follow-ups, per-lead detail',
    href: '/chrisview/funnel',
    icon: Activity,
    color: 'from-yellow-500 to-amber-400',
    highlight: 'NEW',
  },
  {
    title: 'Reviews by Rep (NEW)',
    description: '317 reviews 2018-2025, per-rep avg rating + 5★%, full text of every <=3 star review, yearly trend + source breakdown',
    href: '/chrisview/reviews',
    icon: Star,
    color: 'from-yellow-400 to-amber-500',
    highlight: 'NEW',
  },
  {
    title: 'Rep Scorecard (NEW)',
    description: 'Unified per-rep card: lifetime + last-12mo + YTD commissions, payment count, days since last pay, reviews count + avg rating + 5★%, rev/pay ratio',
    href: '/chrisview/scorecard',
    icon: Trophy,
    color: 'from-yellow-300 to-amber-600',
    highlight: 'NEW',
  },
  {
    title: 'History — All-Time (NEW)',
    description: '8 yrs revenue × expense × margin (2018→present), monthly + quarterly trends, cumulative lifetime, seasonality heatmap, rep tenure timeline',
    href: '/chrisview/history',
    icon: History,
    color: 'from-amber-400 to-yellow-600',
    highlight: 'NEW',
  },
  {
    title: 'Stats & Records (NEW)',
    description: 'Best months ever, best years, biggest commission payments, top lifetime earners, top customers, review momentum, all-time superlatives',
    href: '/chrisview/stats',
    icon: Zap,
    color: 'from-purple-500 to-pink-500',
    highlight: 'NEW',
  },
  {
    title: 'Cash Flow Forecast',
    description: '6-month forecast with seasonal multipliers, runway, A/R vs cash, automatic alerts',
    href: '/chrisview/cashflow',
    icon: Wallet,
    color: 'from-green-500 to-emerald-400',
    highlight: '$69K cash, $678K A/R',
  },
  {
    title: 'Subcontractor Performance',
    description: 'Lifetime spend per sub, check counts, last-90-day activity, inactive subs flagged',
    href: '/chrisview/subs',
    icon: HardHat,
    color: 'from-orange-500 to-amber-400',
    highlight: '$6.6M, 13 subs',
  },
  {
    title: 'Lead Source Effectiveness',
    description: 'Close rate per lead source, top reps per source, days-to-convert',
    href: '/chrisview/lead-sources',
    icon: Megaphone,
    color: 'from-fuchsia-500 to-pink-400',
  },
  {
    title: 'Customer Lifetime Value',
    description: 'LTV per customer, cohort analysis (repeat rate by year), top-100 + top-repeats tables',
    href: '/chrisview/ltv',
    icon: Heart,
    color: 'from-pink-500 to-rose-400',
    highlight: '32% repeat rate',
  },
];

export default function MenuPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/chrisview" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Main Dashboard
          </Link>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Database className="w-5 h-5 text-[#39FF14]" />
            Chris View — Full Menu
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Every Analytics Page</h2>
          <p className="text-zinc-400 text-sm">11 specialized views over the QB ledger, JN CRM, and Monday meeting data. All public read-only. Cached server-side.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SECTIONS.map(section => {
            const Icon = section.icon;
            return (
              <Link
                key={section.href}
                href={section.href}
                className="group relative bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-[#39FF14]/40 hover:bg-zinc-800/40 transition-all"
              >
                <div className={`absolute -top-px left-4 right-4 h-px bg-gradient-to-r ${section.color} opacity-50 group-hover:opacity-100 transition-opacity`} />
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${section.color} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-black" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-[#39FF14] transition-colors" />
                </div>
                <h3 className="text-base font-semibold mb-1">{section.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-2">{section.description}</p>
                {section.highlight && (
                  <span className="inline-block text-[10px] font-mono text-[#39FF14] bg-[#39FF14]/10 px-2 py-0.5 rounded">
                    {section.highlight}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <p className="text-center text-xs text-zinc-500 mt-8">
          Bookmark <code className="text-zinc-300">rcrsal.com/chrisview/menu</code> to come back to this list.
        </p>
      </main>
    </div>
  );
}
