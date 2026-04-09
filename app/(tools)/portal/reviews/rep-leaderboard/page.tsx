/**
 * Rep Review Leaderboard + Accountability — Server Component
 *
 * Shows every active sales-touching team member with their review stats:
 *   - total reviews mentioning them
 *   - 5-star count and average rating
 *   - last review date
 *   - 30/90/365 day windows
 *   - "Needs review request" flag if no reviews in 90+ days
 *
 * Sourced from data/reviews-master.json (317 historical reviews) via lib/rep-reviews.ts.
 */

import Link from 'next/link';
import { Star, AlertTriangle, TrendingUp, Trophy, Calendar, ChevronLeft } from 'lucide-react';
import { getAllRepStats, getMasterStats, type RepReviewStats } from '@/lib/rep-reviews';
import { TEAM_MEMBERS } from '@/lib/team-roles';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Roles that interact with customers and should appear on the leaderboard
const REVIEW_ELIGIBLE_ROLES = new Set([
  'sales',
  'manager',
  'project_manager',
  'driver',
  'admin',
  'owner',
  'office',
]);

// Owners/admins/marketing are excluded from review accountability since they
// aren't on the front line. Slugs must match teamData.ts.
const ACCOUNTABILITY_EXCLUDED = new Set([
  'michael-muse',
  'chris-muse',
  'sara-hill',
  'boston',
]);

function gradeColor(stats: RepReviewStats): string {
  if (stats.total === 0) return 'border-red-500/40 bg-red-500/5';
  if (stats.daysSinceLastReview === null) return 'border-neutral-700 bg-neutral-900';
  if (stats.daysSinceLastReview <= 30) return 'border-green-500/40 bg-green-500/5';
  if (stats.daysSinceLastReview <= 90) return 'border-yellow-500/40 bg-yellow-500/5';
  return 'border-orange-500/40 bg-orange-500/5';
}

function statusBadge(stats: RepReviewStats) {
  if (stats.total === 0) {
    return { label: 'NO REVIEWS', cls: 'bg-red-500 text-white' };
  }
  if (stats.daysSinceLastReview === null) return { label: '—', cls: 'bg-neutral-700 text-white' };
  if (stats.daysSinceLastReview <= 30) return { label: `${stats.daysSinceLastReview}d ago`, cls: 'bg-green-500 text-black' };
  if (stats.daysSinceLastReview <= 90) return { label: `${stats.daysSinceLastReview}d ago`, cls: 'bg-yellow-500 text-black' };
  if (stats.daysSinceLastReview <= 365) return { label: `${stats.daysSinceLastReview}d ago`, cls: 'bg-orange-500 text-black' };
  return { label: `${Math.floor(stats.daysSinceLastReview / 365)}y+ ago`, cls: 'bg-red-500 text-white' };
}

export default function RepReviewLeaderboardPage() {
  const eligible = TEAM_MEMBERS
    .filter((m) => m.isActive && REVIEW_ELIGIBLE_ROLES.has(m.role))
    .map((m) => ({ slug: m.slug, name: m.name }));

  const allStats = getAllRepStats(eligible);
  const masterStats = getMasterStats();

  // Buckets for accountability
  const accountable = allStats.filter((s) => !ACCOUNTABILITY_EXCLUDED.has(s.slug));
  const needsReview = accountable.filter(
    (s) => s.daysSinceLastReview === null || s.daysSinceLastReview > 90,
  );
  const stale = accountable.filter(
    (s) => s.total > 0 && s.daysSinceLastReview !== null && s.daysSinceLastReview > 30 && s.daysSinceLastReview <= 90,
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Link
          href="/portal/reviews"
          className="inline-flex items-center gap-2 text-neutral-300 hover:text-brand-green transition mb-6"
        >
          <ChevronLeft size={20} /> Back to Reviews
        </Link>

        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="text-brand-green" size={32} />
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-wider">
              Rep Review Leaderboard
            </h1>
          </div>
          <p className="text-neutral-300">
            All-time review counts attributed to each rep. Sourced from {masterStats.total} historical reviews
            ({masterStats.fiveStar} five-star, {masterStats.averageRating.toFixed(2)} avg).
          </p>
        </header>

        {/* Top-line stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-brand-green/10 border border-brand-green/30 rounded-xl p-4">
            <div className="text-3xl font-black text-brand-green">{masterStats.total}</div>
            <div className="text-xs text-neutral-300 uppercase tracking-wider mt-1">Total Reviews</div>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
            <div className="text-3xl font-black text-yellow-400">{masterStats.averageRating.toFixed(2)} ★</div>
            <div className="text-xs text-neutral-300 uppercase tracking-wider mt-1">Avg Rating</div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <div className="text-3xl font-black text-blue-400">{masterStats.fiveStar}</div>
            <div className="text-xs text-neutral-300 uppercase tracking-wider mt-1">5-Star Reviews</div>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
            <div className="text-3xl font-black text-purple-400">
              {Math.round((masterStats.fiveStar / masterStats.total) * 100)}%
            </div>
            <div className="text-xs text-neutral-300 uppercase tracking-wider mt-1">5-Star Rate</div>
          </div>
        </div>

        {/* Accountability alert */}
        {needsReview.length > 0 && (
          <div className="bg-red-500/10 border-2 border-red-500/40 rounded-xl p-5 mb-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-red-400 flex-shrink-0 mt-1" size={24} />
              <div className="flex-1">
                <h2 className="font-black uppercase tracking-wider text-red-400 mb-2">
                  Needs Review Request ({needsReview.length})
                </h2>
                <p className="text-sm text-neutral-300 mb-3">
                  These reps have not received a customer review in the last 90 days.
                  They should be a priority for the next review-request push.
                </p>
                <div className="flex flex-wrap gap-2">
                  {needsReview.map((s) => (
                    <span
                      key={s.slug}
                      className="bg-red-500/20 border border-red-500/40 px-3 py-1.5 rounded-lg text-sm font-bold"
                    >
                      {s.name}
                      <span className="text-red-300 ml-2 font-normal">
                        {s.lastReviewDate
                          ? `(${s.daysSinceLastReview}d)`
                          : '(none ever)'}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {stale.length > 0 && (
          <div className="bg-yellow-500/10 border-2 border-yellow-500/40 rounded-xl p-5 mb-8">
            <div className="flex items-start gap-3">
              <Calendar className="text-yellow-400 flex-shrink-0 mt-1" size={24} />
              <div className="flex-1">
                <h2 className="font-black uppercase tracking-wider text-yellow-400 mb-2">
                  Going Stale (30-90 days, {stale.length})
                </h2>
                <p className="text-sm text-neutral-300 mb-3">
                  These reps got a review recently but are due for another one soon.
                </p>
                <div className="flex flex-wrap gap-2">
                  {stale.map((s) => (
                    <span
                      key={s.slug}
                      className="bg-yellow-500/20 border border-yellow-500/40 px-3 py-1.5 rounded-lg text-sm font-bold"
                    >
                      {s.name}
                      <span className="text-yellow-300 ml-2 font-normal">
                        ({s.daysSinceLastReview}d ago)
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Full leaderboard */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
            <h2 className="font-black uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="text-brand-green" size={20} /> Full Leaderboard
            </h2>
            <span className="text-xs text-neutral-300">{allStats.length} reps tracked</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-950 border-b border-neutral-800">
                <tr className="text-left text-xs uppercase tracking-wider text-neutral-300">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Rep</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">5★</th>
                  <th className="px-4 py-3 text-right">Avg</th>
                  <th className="px-4 py-3 text-right">365d</th>
                  <th className="px-4 py-3 text-right">90d</th>
                  <th className="px-4 py-3 text-right">30d</th>
                  <th className="px-4 py-3 text-right">Last Review</th>
                </tr>
              </thead>
              <tbody>
                {allStats.map((stats, idx) => {
                  const isExcluded = ACCOUNTABILITY_EXCLUDED.has(stats.slug);
                  const status = statusBadge(stats);
                  return (
                    <tr
                      key={stats.slug}
                      className={`border-b border-neutral-800/60 ${gradeColor(stats)} ${isExcluded ? 'opacity-60' : ''}`}
                    >
                      <td className="px-4 py-3 font-black text-neutral-400">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/team/${stats.slug}`}
                          className="font-bold text-white hover:text-brand-green transition"
                        >
                          {stats.name}
                        </Link>
                        {isExcluded && (
                          <span className="ml-2 text-[10px] uppercase text-neutral-300">(off-leaderboard)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-lg">{stats.total}</td>
                      <td className="px-4 py-3 text-right font-mono text-yellow-400">{stats.fiveStar}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {stats.averageRating > 0 ? stats.averageRating.toFixed(2) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-blue-400">{stats.last365Days}</td>
                      <td className="px-4 py-3 text-right font-mono text-purple-400">{stats.last90Days}</td>
                      <td className="px-4 py-3 text-right font-mono text-green-400">{stats.last30Days}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${status.cls}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-neutral-300 mt-6">
          Source: <code className="text-brand-green">data/reviews-master.json</code> ·
          Generated from <code className="text-brand-green">RCRS/data/all_reviews_reps_verified.csv</code> +
          <code className="text-brand-green">Reviews12-2025.csv</code>.
          Re-run <code className="text-brand-green">scripts/build-reviews-master.py</code> to refresh from CSV exports.
        </p>
      </div>
    </div>
  );
}
