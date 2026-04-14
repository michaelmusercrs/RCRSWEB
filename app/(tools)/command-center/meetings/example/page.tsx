'use client';

/**
 * RCRS Monday Meeting - Example Presentation (March 30, 2026)
 *
 * Real data from the 3/30/2026 Monday meeting, displayed in the new
 * presentation system format. Navigate with arrow keys or click arrows.
 *
 * Data source: data/meeting-numbers-2026.json (3.30.2026 tab)
 */

import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Trophy, TrendingUp, TrendingDown, DollarSign, Users, Target,
  Flame, Crown, Medal, Award, ChevronLeft, ChevronRight, Pause, Play,
  Maximize, Minimize, BookOpen, Cloud, Sun, CloudRain, Wind,
  Megaphone, Star, Zap, ArrowLeft, BarChart3, CheckCircle2, XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// =============================================================================
// REAL DATA - March 30, 2026 Monday Meeting
// =============================================================================

const MEETING_DATE = 'Monday, March 30, 2026';
const MEETING_WEEK = 14;

const BIBLE_VERSE = {
  reference: 'Romans 12:11',
  text: 'Never be lacking in zeal, but keep your spiritual fervor, serving the Lord.',
  theme: 'Enthusiasm',
};

// This week's numbers (3/30/2026)
const THIS_WEEK = [
  { name: 'Hunter', inspected: 8, damage: 5, signed: 4, repair: 0, gutter: 4, revenue: 80000, approved: 2, goal: 8, referrals: 7, agents: 2, present: true },
  { name: 'Greg', inspected: 6, damage: 5, signed: 5, repair: 0, gutter: 2, revenue: 50000, approved: 2, goal: 8, referrals: 5, agents: 1, present: true },
  { name: 'Rick', inspected: 1, damage: 1, signed: 1, repair: 0, gutter: 0, revenue: 25000, approved: 1, goal: 1, referrals: 0, agents: 2, present: true },
  { name: 'Alijah', inspected: 3, damage: 2, signed: 1, repair: 0, gutter: 0, revenue: 20000, approved: 1, goal: 10, referrals: 3, agents: 0, present: true },
  { name: 'Travis', inspected: 4, damage: 1, signed: 0, repair: 0, gutter: 0, revenue: 0, approved: 0, goal: 7, referrals: 2, agents: 0, present: true },
  { name: 'Aaron', inspected: 0, damage: 0, signed: 0, repair: 0, gutter: 0, revenue: 0, approved: 0, goal: 0, referrals: 0, agents: 0, present: false },
  { name: 'Brendon', inspected: 0, damage: 0, signed: 0, repair: 0, gutter: 0, revenue: 0, approved: 0, goal: 0, referrals: 0, agents: 0, present: false },
];

// Last week's numbers (3/23/2026)
const LAST_WEEK_TOTAL = { inspected: 39, signed: 15, revenue: 271650 };

// Team totals this week
const TEAM_THIS_WEEK = {
  inspected: THIS_WEEK.reduce((s, r) => s + r.inspected, 0),
  damage: THIS_WEEK.reduce((s, r) => s + r.damage, 0),
  signed: THIS_WEEK.reduce((s, r) => s + r.signed, 0),
  revenue: THIS_WEEK.reduce((s, r) => s + r.revenue, 0),
  approved: THIS_WEEK.reduce((s, r) => s + r.approved, 0),
  gutter: THIS_WEEK.reduce((s, r) => s + r.gutter, 0),
  referrals: THIS_WEEK.reduce((s, r) => s + r.referrals, 0),
  present: THIS_WEEK.filter(r => r.present).length,
  total: THIS_WEEK.length,
};

// YTD through 3/30/2026
const YTD = [
  { name: 'Greg', revenue: 518000, inspected: 52, signed: 37, weeks: 13 },
  { name: 'Hunter', revenue: 435650, inspected: 72, signed: 23, weeks: 13 },
  { name: 'Alijah', revenue: 265000, inspected: 29, signed: 14, weeks: 5 },
  { name: 'Brendon', revenue: 198400, inspected: 54, signed: 12, weeks: 13 },
  { name: 'Aaron', revenue: 134300, inspected: 65, signed: 5, weeks: 13 },
  { name: 'Travis', revenue: 47500, inspected: 38, signed: 3, weeks: 13 },
  { name: 'Rick', revenue: 25000, inspected: 1, signed: 1, weeks: 13 },
  { name: 'Joseph', revenue: 18000, inspected: 4, signed: 1, weeks: 8 },
];

const YTD_TEAM_REVENUE = YTD.reduce((s, r) => s + r.revenue, 0);

// March totals
const MARCH_TOTALS = [
  { name: 'Hunter', revenue: 340500 },
  { name: 'Greg', revenue: 320000 },
  { name: 'Alijah', revenue: 265000 },
  { name: 'Brendon', revenue: 175000 },
  { name: 'Travis', revenue: 35500 },
  { name: 'Rick', revenue: 25000 },
  { name: 'Aaron', revenue: 24200 },
];

// Weather for Decatur, AL around 3/30/2026 (late March typical)
const WEATHER = {
  current: { temp: 68, feelsLike: 66, condition: 'Partly Cloudy', humidity: 55, wind: 8 },
  forecast: [
    { day: 'Mon', high: 72, low: 52, desc: 'Partly Cloudy', rain: 10, work: true },
    { day: 'Tue', high: 75, low: 54, desc: 'Sunny', rain: 0, work: true },
    { day: 'Wed', high: 78, low: 56, desc: 'Sunny', rain: 5, work: true },
    { day: 'Thu', high: 74, low: 58, desc: 'Scattered Showers', rain: 45, work: false },
    { day: 'Fri', high: 70, low: 50, desc: 'Mostly Cloudy', rain: 20, work: true },
    { day: 'Sat', high: 73, low: 51, desc: 'Partly Cloudy', rain: 10, work: true },
    { day: 'Sun', high: 76, low: 54, desc: 'Sunny', rain: 0, work: true },
  ],
  workableDays: 6,
};

// =============================================================================
// Utility Functions
// =============================================================================

function fmt(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtFull(n: number): string {
  return `$${n.toLocaleString()}`;
}

const AVATAR_COLORS = [
  'from-yellow-400 to-amber-500',
  'from-gray-400 to-gray-500',
  'from-orange-600 to-amber-700',
  'from-blue-500 to-blue-600',
  'from-green-500 to-green-600',
  'from-purple-500 to-purple-600',
  'from-pink-500 to-pink-600',
  'from-red-500 to-red-600',
];

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// =============================================================================
// Slide Components
// =============================================================================

function SlideTitle() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="animate-slideUp">
        <h1 className="text-7xl font-bold text-white mb-4">Monday Meeting</h1>
        <p className="text-4xl text-lime-400 text-center">{MEETING_DATE}</p>
        <p className="text-2xl text-zinc-500 mt-6 text-center">River City Roofing Solutions</p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <div className="h-1 w-24 bg-lime-500 rounded-full" />
          <div className="h-1 w-8 bg-lime-500/50 rounded-full" />
          <div className="h-1 w-4 bg-lime-500/30 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function SlideBibleVerse() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8">
      <div className="animate-slideUp space-y-8 max-w-4xl">
        <BookOpen className="h-16 w-16 text-lime-400 mx-auto" />
        <blockquote className="text-4xl text-white italic text-center leading-relaxed">
          &ldquo;{BIBLE_VERSE.text}&rdquo;
        </blockquote>
        <p className="text-2xl text-lime-400 text-center">&mdash; {BIBLE_VERSE.reference}</p>
        <div className="flex justify-center">
          <span className="px-4 py-2 rounded-full bg-zinc-800 text-zinc-400 text-lg">{BIBLE_VERSE.theme}</span>
        </div>
      </div>
    </div>
  );
}

function SlideWeather() {
  return (
    <div className="flex flex-col h-full p-8 space-y-6">
      <h2 className="text-4xl font-bold text-center text-white flex items-center justify-center gap-3">
        <Cloud className="h-10 w-10 text-blue-400" />
        This Week&apos;s Weather
      </h2>
      <p className="text-xl text-center text-zinc-400">Decatur / North Alabama</p>

      {/* Current */}
      <div className="flex items-center justify-center gap-8 bg-zinc-800/80 rounded-2xl p-6 border border-zinc-700 max-w-2xl mx-auto">
        <Sun className="h-16 w-16 text-yellow-400" />
        <div>
          <div className="text-6xl font-bold text-white">{WEATHER.current.temp}°F</div>
          <p className="text-xl text-zinc-400 mt-1">Feels like {WEATHER.current.feelsLike}°F</p>
        </div>
        <div className="border-l border-zinc-700 pl-6 space-y-1">
          <p className="text-lg text-zinc-300">{WEATHER.current.condition}</p>
          <p className="text-zinc-500">Humidity: {WEATHER.current.humidity}%</p>
          <p className="text-zinc-500">Wind: {WEATHER.current.wind} mph</p>
        </div>
      </div>

      {/* 7-day */}
      <div className="grid grid-cols-7 gap-3 max-w-5xl mx-auto">
        {WEATHER.forecast.map((d) => (
          <div key={d.day} className={cn(
            'rounded-xl p-4 text-center border transition-all',
            d.work ? 'bg-lime-500/10 border-lime-500/30' : 'bg-red-500/10 border-red-500/30'
          )}>
            <p className="text-sm font-bold text-zinc-300">{d.day}</p>
            <p className="text-3xl font-bold text-white mt-2">{d.high}°</p>
            <p className="text-sm text-zinc-500">{d.low}°</p>
            <p className="text-xs text-zinc-400 mt-2">{d.desc}</p>
            {d.rain > 0 && <p className="text-xs text-blue-400 mt-1">{d.rain}% rain</p>}
            <div className={cn('text-xs font-bold mt-3 flex items-center justify-center gap-1',
              d.work ? 'text-lime-400' : 'text-red-400'
            )}>
              {d.work ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              {d.work ? 'Work' : 'No-Go'}
            </div>
          </div>
        ))}
      </div>

      <div className="text-center">
        <span className="text-2xl text-lime-400 font-bold">{WEATHER.workableDays} workable days</span>
        <span className="text-zinc-500 text-xl"> this week for installations</span>
      </div>
    </div>
  );
}

function SlideAttendance() {
  const present = THIS_WEEK.filter(r => r.present);
  const absent = THIS_WEEK.filter(r => !r.present);

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 p-8">
      <Users className="h-16 w-16 text-lime-400" />
      <h2 className="text-5xl font-bold text-white">Attendance</h2>
      <div className="text-3xl text-zinc-300">
        <span className="text-lime-400 font-bold">{present.length}</span> / {THIS_WEEK.length} present
      </div>
      <div className="grid grid-cols-2 gap-8 max-w-3xl w-full">
        <div className="bg-lime-500/10 border border-lime-500/30 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-lime-400 mb-4 flex items-center gap-2">
            <CheckCircle2 size={20} /> Present
          </h3>
          <div className="space-y-2">
            {present.map(r => (
              <div key={r.name} className="text-lg text-white flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-lime-500/30 flex items-center justify-center text-sm font-bold text-lime-300">
                  {initials(r.name)}
                </div>
                {r.name}
              </div>
            ))}
          </div>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
            <XCircle size={20} /> Absent
          </h3>
          <div className="space-y-2">
            {absent.length > 0 ? absent.map(r => (
              <div key={r.name} className="text-lg text-zinc-400 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-500/30 flex items-center justify-center text-sm font-bold text-red-300">
                  {initials(r.name)}
                </div>
                {r.name}
              </div>
            )) : <p className="text-zinc-500">Everyone&apos;s here!</p>}
          </div>
        </div>
      </div>
      {absent.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 max-w-3xl">
          <p className="text-red-400 text-center font-semibold">
            Absent reps are NOT on lead rotation this week
          </p>
        </div>
      )}
    </div>
  );
}

function SlideWeeklyNumbers() {
  const active = THIS_WEEK.filter(r => r.present).sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="flex flex-col h-full p-8 space-y-6">
      <h2 className="text-4xl font-bold text-center text-white flex items-center justify-center gap-3">
        <BarChart3 className="h-10 w-10 text-lime-400" />
        Weekly Rep Numbers
      </h2>
      <p className="text-lg text-center text-zinc-500">Week of {MEETING_DATE}</p>

      <div className="bg-zinc-800/80 rounded-2xl border border-zinc-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-900/50">
            <tr>
              <th className="px-6 py-4 text-left text-base font-semibold text-zinc-500">Rep</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-zinc-500">Inspected</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-zinc-500">Damage</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-zinc-500">Signed</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-zinc-500">Gutter</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-zinc-500">Approved</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-zinc-500">Goal</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-zinc-500">Referrals</th>
              <th className="px-6 py-4 text-right text-base font-semibold text-zinc-500">$$$$$</th>
            </tr>
          </thead>
          <tbody>
            {active.map((rep, i) => (
              <tr key={rep.name} className="border-t border-zinc-700/50 animate-slideUp" style={{ animationDelay: `${i * 0.06}s` }}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-sm font-bold text-white', AVATAR_COLORS[i])}>
                      {initials(rep.name)}
                    </div>
                    <span className="text-xl font-semibold text-white">{rep.name}</span>
                    {i === 0 && <Crown className="h-5 w-5 text-yellow-400" />}
                  </div>
                </td>
                <td className="px-4 py-4 text-center text-xl text-zinc-300">{rep.inspected || '-'}</td>
                <td className="px-4 py-4 text-center text-xl text-zinc-300">{rep.damage || '-'}</td>
                <td className="px-4 py-4 text-center">
                  <span className={cn('text-xl font-bold', rep.signed > 0 ? 'text-lime-400' : 'text-zinc-600')}>{rep.signed || '-'}</span>
                </td>
                <td className="px-4 py-4 text-center text-xl text-zinc-300">{rep.gutter || '-'}</td>
                <td className="px-4 py-4 text-center text-xl text-zinc-300">{rep.approved || '-'}</td>
                <td className="px-4 py-4 text-center">
                  <span className={cn('text-xl', rep.inspected >= rep.goal ? 'text-lime-400' : 'text-yellow-400')}>
                    {rep.goal || '-'}
                  </span>
                </td>
                <td className="px-4 py-4 text-center text-xl text-zinc-300">{rep.referrals || '-'}</td>
                <td className="px-6 py-4 text-right">
                  <span className="text-2xl font-bold text-lime-400">{rep.revenue > 0 ? fmt(rep.revenue) : '-'}</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-zinc-900/50 border-t-2 border-zinc-600">
            <tr>
              <td className="px-6 py-4 text-lg font-bold text-white">TEAM TOTAL</td>
              <td className="px-4 py-4 text-center text-lg font-bold text-white">{TEAM_THIS_WEEK.inspected}</td>
              <td className="px-4 py-4 text-center text-lg font-bold text-white">{TEAM_THIS_WEEK.damage}</td>
              <td className="px-4 py-4 text-center text-lg font-bold text-lime-400">{TEAM_THIS_WEEK.signed}</td>
              <td className="px-4 py-4 text-center text-lg font-bold text-white">{TEAM_THIS_WEEK.gutter}</td>
              <td className="px-4 py-4 text-center text-lg font-bold text-white">{TEAM_THIS_WEEK.approved}</td>
              <td className="px-4 py-4 text-center text-lg font-bold text-zinc-500">-</td>
              <td className="px-4 py-4 text-center text-lg font-bold text-white">{TEAM_THIS_WEEK.referrals}</td>
              <td className="px-6 py-4 text-right text-2xl font-bold text-lime-400">{fmt(TEAM_THIS_WEEK.revenue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function SlideWeekComparison() {
  const revenueChange = ((TEAM_THIS_WEEK.revenue - LAST_WEEK_TOTAL.revenue) / LAST_WEEK_TOTAL.revenue * 100);
  const inspectedChange = ((TEAM_THIS_WEEK.inspected - LAST_WEEK_TOTAL.inspected) / LAST_WEEK_TOTAL.inspected * 100);

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 p-8">
      <h2 className="text-4xl font-bold text-white flex items-center gap-3">
        <TrendingDown className="h-10 w-10 text-red-400" />
        Week Over Week
      </h2>

      <div className="grid grid-cols-3 gap-8 max-w-4xl w-full">
        <div className="bg-zinc-800/80 rounded-2xl p-8 border border-zinc-700 text-center">
          <p className="text-lg text-zinc-500">This Week Revenue</p>
          <p className="text-4xl font-bold text-white mt-2">{fmt(TEAM_THIS_WEEK.revenue)}</p>
        </div>
        <div className="bg-zinc-800/80 rounded-2xl p-8 border border-zinc-700 text-center">
          <p className="text-lg text-zinc-500">vs Last Week</p>
          <p className={cn('text-4xl font-bold mt-2', revenueChange >= 0 ? 'text-lime-400' : 'text-red-400')}>
            {revenueChange >= 0 ? '+' : ''}{revenueChange.toFixed(1)}%
          </p>
          <p className="text-sm text-zinc-500 mt-2">Last week: {fmt(LAST_WEEK_TOTAL.revenue)}</p>
        </div>
        <div className="bg-zinc-800/80 rounded-2xl p-8 border border-zinc-700 text-center">
          <p className="text-lg text-zinc-500">Inspections Change</p>
          <p className={cn('text-4xl font-bold mt-2', inspectedChange >= 0 ? 'text-lime-400' : 'text-red-400')}>
            {inspectedChange >= 0 ? '+' : ''}{inspectedChange.toFixed(1)}%
          </p>
          <p className="text-sm text-zinc-500 mt-2">{TEAM_THIS_WEEK.inspected} vs {LAST_WEEK_TOTAL.inspected}</p>
        </div>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6 max-w-3xl text-center">
        <p className="text-xl text-yellow-400 font-semibold">
          Revenue down {Math.abs(revenueChange).toFixed(0)}% — 2 reps absent this week (Aaron, Brendon)
        </p>
        <p className="text-zinc-500 mt-2">When fully staffed last week we hit {fmt(LAST_WEEK_TOTAL.revenue)}</p>
      </div>
    </div>
  );
}

function SlidePodium() {
  const sorted = [...THIS_WEEK].filter(r => r.revenue > 0).sort((a, b) => b.revenue - a.revenue);
  const top3 = sorted.slice(0, 3);
  if (top3.length < 3) return null;

  const podiumOrder = [top3[1], top3[0], top3[2]];
  const heights = ['h-48', 'h-64', 'h-40'];
  const colors = ['from-gray-400 to-gray-500', 'from-yellow-400 to-amber-500', 'from-orange-600 to-amber-700'];
  const positions = ['2nd', '1st', '3rd'];
  const icons = [
    <Medal key="s" className="h-12 w-12 text-zinc-400" />,
    <Crown key="g" className="h-16 w-16 text-yellow-300 animate-pulse" />,
    <Award key="b" className="h-10 w-10 text-orange-400" />,
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <h2 className="text-4xl font-bold text-white mb-8 flex items-center gap-3">
        <Trophy className="h-10 w-10 text-yellow-400" />
        This Week&apos;s Top Performers
      </h2>
      <div className="flex items-end justify-center gap-8 pt-8">
        {podiumOrder.map((rep, i) => (
          <div key={rep.name} className="flex flex-col items-center animate-slideUp" style={{ animationDelay: `${i * 0.2}s` }}>
            {icons[i]}
            <div className={cn('w-24 h-24 rounded-full bg-gradient-to-br flex items-center justify-center text-4xl font-bold text-white mt-4 shadow-2xl', colors[i])}>
              {initials(rep.name)}
            </div>
            <h3 className="text-2xl font-bold text-white mt-4">{rep.name}</h3>
            <p className="text-4xl font-bold text-lime-400 mt-2">{fmt(rep.revenue)}</p>
            <p className="text-lg text-zinc-500">{rep.signed} signed | {rep.inspected} inspected</p>
            <div className={cn('w-40 rounded-t-lg bg-gradient-to-b flex items-center justify-center text-3xl font-bold text-white shadow-xl mt-4', heights[i], colors[i])}>
              {positions[i]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideYTDLeaderboard() {
  return (
    <div className="flex flex-col h-full p-8 space-y-6">
      <h2 className="text-4xl font-bold text-center text-white flex items-center justify-center gap-3">
        <Trophy className="h-10 w-10 text-lime-400" />
        YTD Sales Leaderboard
      </h2>
      <p className="text-lg text-center text-zinc-500">Through March 30, 2026 &mdash; Team Total: {fmt(YTD_TEAM_REVENUE)}</p>

      <div className="bg-zinc-800/80 rounded-2xl border border-zinc-700 overflow-hidden max-w-4xl mx-auto w-full">
        <table className="w-full">
          <thead className="bg-zinc-900/50">
            <tr>
              <th className="px-6 py-4 text-left text-lg font-semibold text-zinc-500">Rank</th>
              <th className="px-6 py-4 text-left text-lg font-semibold text-zinc-500">Rep</th>
              <th className="px-6 py-4 text-right text-lg font-semibold text-zinc-500">YTD Revenue</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-zinc-500">Inspected</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-zinc-500">Signed</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-zinc-500">Conversion</th>
            </tr>
          </thead>
          <tbody>
            {YTD.map((rep, i) => (
              <tr key={rep.name} className="border-t border-zinc-700/50 animate-slideUp" style={{ animationDelay: `${i * 0.05}s` }}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {i === 0 && <Crown className="h-6 w-6 text-yellow-400" />}
                    {i === 1 && <Medal className="h-6 w-6 text-zinc-400" />}
                    {i === 2 && <Award className="h-6 w-6 text-orange-500" />}
                    <span className={cn('text-2xl font-bold',
                      i === 0 && 'text-yellow-400',
                      i === 1 && 'text-zinc-400',
                      i === 2 && 'text-orange-500',
                      i > 2 && 'text-zinc-500',
                    )}>
                      #{i + 1}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-sm font-bold text-white', AVATAR_COLORS[i])}>
                      {initials(rep.name)}
                    </div>
                    <span className="text-xl font-semibold text-white">{rep.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-2xl font-bold text-lime-400">{fmt(rep.revenue)}</span>
                </td>
                <td className="px-4 py-4 text-center text-xl text-zinc-300">{rep.inspected}</td>
                <td className="px-4 py-4 text-center text-xl text-lime-400 font-bold">{rep.signed}</td>
                <td className="px-4 py-4 text-center text-xl text-zinc-400">
                  {rep.inspected > 0 ? `${((rep.signed / rep.inspected) * 100).toFixed(0)}%` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SlideMarchStats() {
  const marchTotal = MARCH_TOTALS.reduce((s, r) => s + r.revenue, 0);

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 p-8">
      <h2 className="text-4xl font-bold text-white flex items-center gap-3">
        <DollarSign className="h-10 w-10 text-lime-400" />
        March 2026 Summary
      </h2>
      <div className="text-5xl font-bold text-lime-400">{fmt(marchTotal)}</div>
      <p className="text-xl text-zinc-500">Total team revenue for March</p>

      <div className="grid grid-cols-2 gap-4 max-w-3xl w-full">
        {MARCH_TOTALS.filter(r => r.revenue > 0).map((rep, i) => (
          <div key={rep.name} className="bg-zinc-800/80 rounded-xl p-5 border border-zinc-700 flex items-center justify-between animate-slideUp" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-sm font-bold text-white', AVATAR_COLORS[i])}>
                {initials(rep.name)}
              </div>
              <span className="text-lg font-semibold text-white">{rep.name}</span>
            </div>
            <span className="text-xl font-bold text-lime-400">{fmt(rep.revenue)}</span>
          </div>
        ))}
      </div>

      <div className="bg-lime-500/10 border border-lime-500/30 rounded-xl p-4 max-w-3xl text-center">
        <p className="text-lg text-lime-400 font-semibold">
          Hunter & Greg each over $300K for the month
        </p>
      </div>
    </div>
  );
}

function SlideGoalProgress() {
  // Q1 goal: $1M team
  const q1Revenue = YTD_TEAM_REVENUE;
  const q1Target = 1000000;
  const q1Pct = (q1Revenue / q1Target) * 100;
  // Annual goal: $4M
  const annualTarget = 4000000;
  const annualPct = (q1Revenue / annualTarget) * 100;

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-10 p-8">
      <h2 className="text-4xl font-bold text-white flex items-center gap-3">
        <Target className="h-10 w-10 text-lime-400" />
        Goal Progress
      </h2>

      {/* Q1 */}
      <div className="w-full max-w-3xl bg-zinc-800/80 rounded-2xl p-8 border border-zinc-700">
        <div className="flex justify-between items-center mb-4">
          <span className="text-2xl font-semibold text-white">Q1 Target</span>
          <span className="text-2xl font-bold text-zinc-500">{fmt(q1Target)}</span>
        </div>
        <div className="relative h-12 bg-zinc-700 rounded-full overflow-hidden">
          <div className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-1000',
            q1Pct >= 100 ? 'bg-lime-500' : q1Pct >= 75 ? 'bg-yellow-500' : 'bg-red-500'
          )} style={{ width: `${Math.min(q1Pct, 100)}%` }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-white drop-shadow-lg">{q1Pct.toFixed(1)}%</span>
          </div>
        </div>
        <p className="text-lg text-zinc-500 mt-3 text-center">{fmt(q1Revenue)} of {fmt(q1Target)}</p>
        {q1Pct >= 100 && (
          <div className="mt-4 text-center">
            <span className="inline-flex items-center gap-2 text-lime-400 text-xl">
              <Star className="h-6 w-6 animate-pulse" /> Q1 Goal Achieved! <Star className="h-6 w-6 animate-pulse" />
            </span>
          </div>
        )}
      </div>

      {/* Annual */}
      <div className="w-full max-w-3xl bg-zinc-800/80 rounded-2xl p-8 border border-zinc-700">
        <div className="flex justify-between items-center mb-4">
          <span className="text-2xl font-semibold text-white">Annual Target</span>
          <span className="text-2xl font-bold text-zinc-500">{fmt(annualTarget)}</span>
        </div>
        <div className="relative h-12 bg-zinc-700 rounded-full overflow-hidden">
          <div className="absolute inset-y-0 left-0 rounded-full bg-purple-500 transition-all duration-1000"
            style={{ width: `${Math.min(annualPct, 100)}%` }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-white drop-shadow-lg">{annualPct.toFixed(1)}%</span>
          </div>
        </div>
        <p className="text-lg text-zinc-500 mt-3 text-center">{fmt(q1Revenue)} of {fmt(annualTarget)} (Q1 = 25% of year)</p>
      </div>
    </div>
  );
}

function SlideOfficeBonus() {
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 p-8">
      <DollarSign className="h-16 w-16 text-emerald-400" />
      <h2 className="text-4xl font-bold text-white text-center">Office Bonus Structure</h2>
      <div className="bg-zinc-800/80 rounded-2xl p-8 border border-zinc-700 max-w-3xl">
        <p className="text-2xl text-lime-400 text-center font-semibold mb-6">
          IF INSPECTORS SELL OVER $1,000,000 IN A QUARTER:
        </p>
        <p className="text-xl text-zinc-300 text-center mb-6">
          Per every $100,000 over $1,000,000:
        </p>
        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
          <div className="text-right text-lg text-zinc-400">Sara &amp; Destin:</div>
          <div className="text-left text-lg text-lime-400 font-bold">$200 bonus each</div>
          <div className="text-right text-lg text-zinc-400">Tia:</div>
          <div className="text-left text-lg text-lime-400 font-bold">$100 bonus</div>
        </div>
      </div>
      <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700 max-w-3xl text-center">
        <p className="text-zinc-400">Q1 team revenue: <span className="text-white font-bold">{fmt(YTD_TEAM_REVENUE)}</span></p>
        <p className="text-zinc-500 mt-1">
          {YTD_TEAM_REVENUE >= 1000000
            ? `$${((YTD_TEAM_REVENUE - 1000000) / 1000).toFixed(0)}K over threshold!`
            : `${fmt(1000000 - YTD_TEAM_REVENUE)} to go`
          }
        </p>
      </div>
    </div>
  );
}

function SlideMotivational() {
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-6 p-8">
      <Flame className="h-20 w-20 text-orange-400 animate-pulse" />
      <blockquote className="text-4xl text-white italic text-center max-w-3xl leading-relaxed">
        &ldquo;The only way to do great work is to love what you do.&rdquo;
      </blockquote>
      <p className="text-2xl text-zinc-400">&mdash; Steve Jobs</p>
      <div className="h-1 w-32 bg-lime-500 rounded-full mt-4" />
      <p className="text-xl text-lime-400 font-semibold">Let&apos;s have a great week!</p>
    </div>
  );
}

function SlideClosing() {
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8">
      <div className="text-8xl font-bold text-white animate-slideUp">RCRS</div>
      <div className="flex items-center gap-2">
        <div className="h-1 w-16 bg-lime-500 rounded-full" />
        <div className="h-1 w-8 bg-lime-500/60 rounded-full" />
        <div className="h-1 w-4 bg-lime-500/30 rounded-full" />
      </div>
      <p className="text-3xl text-lime-400 animate-slideUp" style={{ animationDelay: '0.2s' }}>
        Go sell some roofs!
      </p>
      <p className="text-xl text-zinc-500 animate-slideUp" style={{ animationDelay: '0.4s' }}>
        River City Roofing Solutions &mdash; {MEETING_DATE}
      </p>
    </div>
  );
}

// =============================================================================
// Slide Configuration
// =============================================================================

const SLIDES = [
  { id: 'title', label: 'Title', component: SlideTitle },
  { id: 'verse', label: 'Verse', component: SlideBibleVerse },
  { id: 'weather', label: 'Weather', component: SlideWeather },
  { id: 'attendance', label: 'Attendance', component: SlideAttendance },
  { id: 'numbers', label: 'Rep Numbers', component: SlideWeeklyNumbers },
  { id: 'comparison', label: 'Week vs Week', component: SlideWeekComparison },
  { id: 'podium', label: 'Top 3', component: SlidePodium },
  { id: 'ytd', label: 'YTD Leaderboard', component: SlideYTDLeaderboard },
  { id: 'march', label: 'March Summary', component: SlideMarchStats },
  { id: 'goals', label: 'Goal Progress', component: SlideGoalProgress },
  { id: 'office-bonus', label: 'Office Bonus', component: SlideOfficeBonus },
  { id: 'motivational', label: 'Motivational', component: SlideMotivational },
  { id: 'closing', label: 'Closing', component: SlideClosing },
];

// =============================================================================
// Main Component
// =============================================================================

export default function ExamplePresentationPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const goNext = useCallback(() => {
    setCurrentSlide(prev => (prev + 1) % SLIDES.length);
  }, []);

  const goPrev = useCallback(() => {
    setCurrentSlide(prev => (prev - 1 + SLIDES.length) % SLIDES.length);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      if (e.key === 'Escape') { setIsFullscreen(false); document.exitFullscreen?.(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev]);

  // Auto-rotate
  useEffect(() => {
    if (!isAutoRotating) return;
    const timer = setInterval(goNext, 12000);
    return () => clearInterval(timer);
  }, [isAutoRotating, goNext]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const CurrentSlideComponent = SLIDES[currentSlide].component;

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 text-white flex flex-col">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-zinc-900/90 backdrop-blur-sm border-b border-zinc-800">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link href="/command-center/meetings" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft size={18} />
              <span className="text-sm">Back</span>
            </Link>
            <div className="h-4 w-px bg-zinc-700" />
            <h1 className="text-lg font-bold text-white">Example: March 30, 2026</h1>
            <span className="text-xs px-2 py-1 rounded bg-lime-500/20 text-lime-400 font-medium">REAL DATA</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Slide picker */}
            <div className="hidden lg:flex items-center gap-1">
              {SLIDES.map((slide, i) => (
                <button key={slide.id} onClick={() => setCurrentSlide(i)}
                  className={cn('px-2 py-1 text-xs rounded transition-colors',
                    i === currentSlide ? 'bg-lime-500 text-zinc-900 font-bold' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
                  )}>
                  {slide.label}
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-zinc-700" />

            <button onClick={() => setIsAutoRotating(!isAutoRotating)}
              className={cn('p-2 rounded-lg transition-colors', isAutoRotating ? 'bg-lime-500/20 text-lime-400' : 'text-zinc-500 hover:text-white')}>
              {isAutoRotating ? <Pause size={18} /> : <Play size={18} />}
            </button>

            <button onClick={toggleFullscreen} className="p-2 rounded-lg text-zinc-500 hover:text-white transition-colors">
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-zinc-800">
          <div className="h-full bg-lime-500 transition-all duration-300" style={{ width: `${((currentSlide + 1) / SLIDES.length) * 100}%` }} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 pt-16 pb-16 flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <div className="w-full max-w-7xl mx-auto">
          <CurrentSlideComponent />
        </div>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-900/90 backdrop-blur-sm border-t border-zinc-800">
        <div className="flex items-center justify-between px-6 py-3">
          <button onClick={goPrev} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors">
            <ChevronLeft size={20} />
            Previous
          </button>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">
              {currentSlide + 1} / {SLIDES.length}
            </span>
            <span className="text-zinc-600 mx-2">|</span>
            <span className="text-zinc-500 text-sm">{SLIDES[currentSlide].label}</span>
          </div>
          <button onClick={goNext} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-lime-500 text-zinc-900 font-semibold hover:bg-lime-400 transition-colors">
            Next
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* CSS animations */}
      <style jsx global>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideUp {
          animation: slideUp 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
