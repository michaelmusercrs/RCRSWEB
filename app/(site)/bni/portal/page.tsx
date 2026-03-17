'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

type View = 'dashboard' | 'messages' | 'documents' | 'weather' | 'hail' | 'payments';

const menuItems: { id: View; icon: string; label: string }[] = [
  { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
  { id: 'messages', icon: '💬', label: 'Messages' },
  { id: 'documents', icon: '📄', label: 'Documents' },
  { id: 'weather', icon: '🌤️', label: 'Weather Forecast' },
  { id: 'hail', icon: '🧊', label: 'Hail Report' },
  { id: 'payments', icon: '💳', label: 'Payments' },
];

const INSTALL_DATE = new Date('2026-03-24');

function getDaysUntilInstall(): number {
  return Math.ceil((INSTALL_DATE.getTime() - Date.now()) / 86400000);
}

/* ─── Timeline Data ─── */
const timelineEvents = [
  { date: 'Feb 24', label: 'Free Inspection Completed', status: 'done' as const },
  { date: 'Feb 24', label: 'Storm Damage Documented (12 photos)', status: 'done' as const },
  { date: 'Feb 24', label: 'Insurance Claim Filed (State Farm)', status: 'done' as const },
  { date: 'Mar 3', label: 'Adjuster Meeting Completed', status: 'done' as const },
  { date: 'Mar 10', label: 'Claim Approved by State Farm', status: 'done' as const },
  { date: 'Mar 10', label: 'Scope of Work Agreed', status: 'done' as const },
  { date: 'Mar 11', label: 'Contract Signed', status: 'done' as const },
  { date: 'Mar 14', label: 'Materials Ordered (IKO Dynasty - Granite Black)', status: 'done' as const },
  { date: 'Mar 21', label: 'Material Delivery (Scheduled)', status: 'pending' as const },
  { date: 'Mar 24', label: 'Installation Day (Scheduled)', status: 'upcoming' as const },
];

/* ─── Messages Data ─── */
const messages = [
  { sender: 'hunter', name: 'Hunter Rivers', time: 'Feb 24, 9:15 AM', text: 'Hi David! This is Hunter Rivers from River City Roofing Solutions. Just completed your roof inspection at 100 N Beaty St. I found significant hail damage on several sections. I\'ll have the full report uploaded to your portal by end of day.' },
  { sender: 'customer', name: 'David Richardson', time: 'Feb 24, 10:42 AM', text: 'Thanks Hunter. We noticed some granules washing out of the gutters after that last storm. Glad you could come out so quickly.' },
  { sender: 'hunter', name: 'Hunter Rivers', time: 'Feb 24, 5:30 PM', text: 'Your Storm Damage Assessment is now uploaded to your Documents section. Based on what I found — multiple areas of impact damage and compromised shingles — I\'d strongly recommend filing an insurance claim. Would you like me to help with that?' },
  { sender: 'customer', name: 'David Richardson', time: 'Feb 25, 8:15 AM', text: 'Yes please! We have State Farm. Is that something you can handle?' },
  { sender: 'hunter', name: 'Hunter Rivers', time: 'Feb 25, 9:00 AM', text: 'Absolutely! We work with State Farm regularly. I\'ll prepare all the documentation and schedule a time to meet with your adjuster. Filing the claim now on your behalf.' },
  { sender: 'hunter', name: 'Hunter Rivers', time: 'Mar 3, 2:15 PM', text: 'Met with your State Farm adjuster today. Everything went great — he documented the same damage I found. Should have an answer within 5-7 business days.' },
  { sender: 'hunter', name: 'Hunter Rivers', time: 'Mar 10, 11:30 AM', text: 'Great news David! State Farm approved your claim! Your new roof is fully covered — you\'re only responsible for your $1,000 deductible. I\'ve uploaded the approval letter and scope of work to your portal.' },
  { sender: 'customer', name: 'David Richardson', time: 'Mar 10, 12:45 PM', text: 'That\'s wonderful news! What happens next?' },
  { sender: 'hunter', name: 'Hunter Rivers', time: 'Mar 10, 1:00 PM', text: 'We\'ve selected IKO Dynasty shingles in Granite Black based on what we discussed. I\'m placing the material order today. Looking at March 24th for your installation. Our crew lead Richard will take great care of your property!' },
  { sender: 'hunter', name: 'Hunter Rivers', time: 'Mar 14, 10:00 AM', text: 'Materials ordered and confirmed! Delivery scheduled for March 21st. Installation crew will arrive March 24th at 7:00 AM. Just make sure vehicles are clear of the driveway by then — we handle everything else!' },
  { sender: 'customer', name: 'David Richardson', time: 'Mar 14, 10:30 AM', text: 'Perfect, we\'ll have everything ready. Really appreciate how smooth this process has been.' },
  { sender: 'hunter', name: 'Hunter Rivers', time: 'Mar 14, 10:35 AM', text: 'That\'s what we\'re here for! You can track everything right here in your portal. I\'ll send a reminder the day before installation. Don\'t hesitate to message me if you have any questions!' },
];

/* ─── Documents Data ─── */
const documents = [
  { icon: '📄', name: 'Inspection Report', date: 'Feb 24, 2026', type: 'PDF', status: 'Complete', done: true },
  { icon: '📸', name: 'Storm Damage Photos (12 images)', date: 'Feb 24, 2026', type: 'Images', status: 'Uploaded', done: true },
  { icon: '📄', name: 'Hail Damage Assessment', date: 'Feb 24, 2026', type: 'PDF', status: 'Official NWS Data', done: true },
  { icon: '📋', name: 'Insurance Claim Packet', date: 'Mar 3, 2026', type: 'PDF', status: 'Filed with State Farm', done: true },
  { icon: '📄', name: 'Adjuster Meeting Summary', date: 'Mar 3, 2026', type: 'PDF', status: 'Complete', done: true },
  { icon: '✉️', name: 'State Farm Approval Letter', date: 'Mar 10, 2026', type: 'PDF', status: 'Claim Approved', done: true },
  { icon: '📄', name: 'Scope of Work', date: 'Mar 10, 2026', type: 'PDF', status: 'Signed', done: true },
  { icon: '📦', name: 'Material Order Confirmation', date: 'Mar 14, 2026', type: 'PDF', status: 'IKO Dynasty Confirmed', done: true },
  { icon: '📋', name: 'Pre-Installation Checklist', date: 'Mar 24, 2026', type: 'PDF', status: 'Pending', done: false },
];

/* ─── Weather Data ─── */
const forecast = [
  { day: 'Mon 3/17', icon: '⛅', cond: 'Partly Cloudy', high: 68, low: 49 },
  { day: 'Tue 3/18', icon: '🌤️', cond: 'Mostly Sunny', high: 71, low: 52 },
  { day: 'Wed 3/19', icon: '🌧️', cond: 'Scattered Showers', high: 65, low: 48 },
  { day: 'Thu 3/20', icon: '⛅', cond: 'Partly Cloudy', high: 62, low: 45 },
  { day: 'Fri 3/21', icon: '☀️', cond: 'Sunny', high: 70, low: 50 },
  { day: 'Sat 3/22', icon: '🌤️', cond: 'Mostly Sunny', high: 73, low: 54 },
  { day: 'Sun 3/23', icon: '⛅', cond: 'Partly Cloudy', high: 69, low: 51 },
];

/* ─── Hail Data ─── */
const hailEvents = [
  { date: 'Mar 2, 2026', size: '1.75"', desc: 'Golf Ball', dist: '1.2 miles', severity: 'Severe' },
  { date: 'Jan 11, 2026', size: '1.00"', desc: 'Quarter', dist: '8.4 miles', severity: 'Moderate' },
  { date: 'Nov 3, 2025', size: '1.50"', desc: 'Ping Pong', dist: '12.1 miles', severity: 'Severe' },
  { date: 'Apr 14, 2025', size: '2.00"', desc: 'Hen Egg', dist: '18.3 miles', severity: 'Severe' },
  { date: 'Mar 27, 2025', size: '1.25"', desc: 'Half Dollar', dist: '0.8 miles', severity: 'Moderate' },
];

/* ─── Progress Steps ─── */
const progressSteps = [
  { label: 'Inspection', done: true },
  { label: 'Claim Filed', done: true },
  { label: 'Approved', done: true },
  { label: 'Contract', done: true },
  { label: 'Materials', done: true },
  { label: 'Install', done: false, upcoming: true },
];

/* ══════════════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════════════ */

export default function BNIPortalDemo() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [fadeKey, setFadeKey] = useState(0);
  const [daysLeft, setDaysLeft] = useState(getDaysUntilInstall());
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'Customer Portal - River City Roofing Solutions';
  }, []);

  // Recalculate countdown once a minute
  useEffect(() => {
    const id = setInterval(() => setDaysLeft(getDaysUntilInstall()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (currentView === 'messages') {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [currentView]);

  const switchView = useCallback((v: View) => {
    setCurrentView(v);
    setMenuOpen(false);
    setFadeKey((k) => k + 1);
  }, []);

  /* ── Sub-header for inner views ── */
  const ViewHeader = ({ title }: { title: string }) => (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur">
      <button
        onClick={() => switchView('dashboard')}
        className="text-neutral-400 hover:text-white transition-colors text-xl"
        aria-label="Back to dashboard"
      >
        ←
      </button>
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  );

  /* ═══════════════════════════════════════════════
     DASHBOARD
     ═══════════════════════════════════════════════ */
  const Dashboard = () => (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold">Welcome, David</h1>
        <p className="text-neutral-400 mt-1">Here&apos;s your project overview</p>
      </div>

      {/* Job Status Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Job Status</h3>
          <span className="text-xs bg-[#39FF14]/20 text-[#39FF14] px-3 py-1 rounded-full font-medium">Materials Ordered</span>
        </div>

        {/* Progress bar */}
        <div className="relative w-full h-2 bg-neutral-700 rounded-full overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-[#39FF14] rounded-full animate-progress-bar" style={{ width: '70%' }} />
        </div>

        {/* Steps */}
        <div className="flex justify-between text-xs text-neutral-400">
          {progressSteps.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1.5 flex-1">
              <span
                className={
                  s.done
                    ? 'w-6 h-6 rounded-full bg-[#39FF14]/20 text-[#39FF14] flex items-center justify-center text-sm'
                    : s.upcoming
                    ? 'w-6 h-6 rounded-full border-2 border-amber-400 flex items-center justify-center animate-pulse-dot'
                    : 'w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center'
                }
              >
                {s.done ? '✓' : s.upcoming ? '🔜' : ''}
              </span>
              <span className={s.done ? 'text-[#39FF14]' : s.upcoming ? 'text-amber-400' : ''}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Install date callout */}
        <div className="bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-lg px-4 py-3 text-center">
          <span className="text-[#39FF14] font-semibold">Installation Scheduled: March 24, 2026</span>
        </div>
      </div>

      {/* Quick Info Grid */}
      <div className="grid grid-cols-3 gap-3">
        {/* Days Until Install */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
          <p className="text-4xl font-bold text-[#39FF14]">{daysLeft}</p>
          <p className="text-neutral-400 text-sm mt-1">days until install</p>
        </div>
        {/* Rep */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
          <p className="text-sm font-semibold">Your Rep</p>
          <p className="text-[#39FF14] font-bold mt-1">Hunter Rivers</p>
          <p className="text-neutral-400 text-xs mt-1">📞 (256) 274-8530</p>
        </div>
        {/* Documents */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
          <p className="text-sm font-semibold">Documents</p>
          <p className="text-2xl font-bold mt-1">9</p>
          <span className="text-xs bg-[#39FF14]/20 text-[#39FF14] px-2 py-0.5 rounded-full">2 new</span>
        </div>
      </div>

      {/* Upcoming Activity */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3">
        <h3 className="font-semibold text-lg">Upcoming Activity</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span>📅</span>
            <span>
              <strong>Material Delivery</strong> — March 21, 2026
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span>📅</span>
            <span>
              <strong>Installation Day</strong> — March 24, 2026 at 7:00 AM
            </span>
          </div>
          <p className="text-neutral-400">Crew Lead: Richard Geahr</p>
        </div>
      </div>

      {/* Job Timeline */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-1">
        <h3 className="font-semibold text-lg mb-4">Job Timeline</h3>
        <div className="relative pl-6 space-y-0">
          {timelineEvents.map((ev, i) => {
            const isLast = i === timelineEvents.length - 1;
            const color =
              ev.status === 'done'
                ? 'bg-[#39FF14]'
                : ev.status === 'pending'
                ? 'bg-amber-400'
                : 'bg-neutral-500';
            const textColor =
              ev.status === 'done'
                ? 'text-white'
                : ev.status === 'pending'
                ? 'text-amber-300'
                : 'text-neutral-400';
            const icon = ev.status === 'done' ? '✅' : ev.status === 'pending' ? '⏳' : '🔜';

            return (
              <div key={i} className="relative pb-5">
                {/* Vertical line */}
                {!isLast && (
                  <div className="absolute left-[-13px] top-3 w-px h-full bg-neutral-700" />
                )}
                {/* Dot */}
                <div
                  className={`absolute left-[-17px] top-1.5 w-2.5 h-2.5 rounded-full ${color} ${
                    ev.status === 'upcoming' ? 'animate-pulse-dot' : ''
                  }`}
                />
                <div className={`flex items-start gap-3 ${textColor}`}>
                  <span className="text-xs text-neutral-500 w-14 flex-shrink-0 pt-0.5">{ev.date}</span>
                  <span className="text-sm">
                    {icon} {ev.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════
     MESSAGES
     ═══════════════════════════════════════════════ */
  const Messages = () => (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <ViewHeader title="Messages with Hunter Rivers" />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-2xl mx-auto w-full">
        {messages.map((m, i) => {
          const isRep = m.sender === 'hunter';
          return (
            <div key={i} className={`flex ${isRep ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[80%] px-4 py-3 ${
                  isRep
                    ? 'bg-blue-600/30 border border-blue-500/30 rounded-2xl rounded-bl-md'
                    : 'bg-neutral-700/50 border border-neutral-600/30 rounded-2xl rounded-br-md'
                }`}
              >
                <p className={`text-xs font-bold mb-1 ${isRep ? 'text-blue-300' : 'text-neutral-300'}`}>
                  {m.name}
                </p>
                <p className="text-sm leading-relaxed">{m.text}</p>
                <p className="text-[10px] text-neutral-500 mt-2 text-right">{m.time}</p>
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>
      {/* Input bar */}
      <div className="border-t border-neutral-800 px-4 py-3 bg-neutral-900/80 backdrop-blur">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            type="text"
            disabled
            placeholder="Type a message..."
            className="flex-1 bg-neutral-800 border border-neutral-700 rounded-full px-4 py-2.5 text-sm text-neutral-500 placeholder-neutral-600 cursor-not-allowed"
          />
          <button disabled className="bg-[#39FF14]/30 text-[#39FF14] px-4 py-2.5 rounded-full text-sm font-semibold opacity-50 cursor-not-allowed">
            Send
          </button>
        </div>
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════
     DOCUMENTS
     ═══════════════════════════════════════════════ */
  const Documents = () => (
    <div>
      <ViewHeader title="Your Documents" />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        {documents.map((doc, i) => (
          <div
            key={i}
            className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 flex items-center gap-4"
          >
            <span className="text-2xl flex-shrink-0">{doc.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{doc.name}</p>
              <p className="text-xs text-neutral-400 mt-0.5">
                {doc.date} &middot; {doc.type}
              </p>
            </div>
            <span
              className={`text-xs px-2.5 py-1 rounded-full flex-shrink-0 ${
                doc.done
                  ? 'bg-[#39FF14]/20 text-[#39FF14]'
                  : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {doc.done ? '✅' : '⏳'} {doc.status}
            </span>
            {doc.done && (
              <button className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0 border border-blue-500/30 rounded px-2.5 py-1">
                View
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════
     WEATHER
     ═══════════════════════════════════════════════ */
  const Weather = () => (
    <div>
      <ViewHeader title="Weather Forecast - Athens, AL" />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Current conditions */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
          <h3 className="font-semibold text-lg mb-3">Current Conditions</h3>
          <div className="flex items-center gap-4">
            <span className="text-5xl">⛅</span>
            <div>
              <p className="text-3xl font-bold">65°F</p>
              <p className="text-neutral-400">Partly Cloudy</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4 text-sm text-neutral-300">
            <div>💨 Wind: 8 mph SW</div>
            <div>💧 Humidity: 52%</div>
          </div>
          <div className="mt-4 bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-lg px-4 py-2 text-sm text-[#39FF14]">
            Good conditions for roofing work ✅
          </div>
        </div>

        {/* 7-day forecast */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
          <h3 className="font-semibold text-lg mb-4">7-Day Forecast</h3>
          <div className="space-y-2">
            {forecast.map((d) => (
              <div
                key={d.day}
                className="flex items-center justify-between text-sm bg-neutral-800/60 rounded-lg px-4 py-3"
              >
                <span className="w-24 text-neutral-300">{d.day}</span>
                <span className="text-xl">{d.icon}</span>
                <span className="flex-1 text-center text-neutral-400 text-xs hidden sm:block">{d.cond}</span>
                <span className="w-20 text-right">
                  <span className="font-semibold">{d.high}°</span>{' '}
                  <span className="text-neutral-500">{d.low}°</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Install day forecast */}
        <div className="bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-xl p-5">
          <p className="font-semibold text-[#39FF14]">📅 March 24 (Install Day)</p>
          <p className="text-sm text-neutral-300 mt-1">Forecast looks favorable for installation</p>
        </div>

        {/* Assessment */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
          <h3 className="font-semibold text-lg mb-3">Roofing Work Assessment</h3>
          <div className="space-y-2 text-sm text-neutral-300">
            <p>This Week: <span className="text-[#39FF14] font-semibold">5 of 7 days</span> suitable for roofing</p>
            <p>Your Installation Date: March 24 — Currently forecasted <span className="text-[#39FF14] font-semibold">CLEAR ✅</span></p>
          </div>
        </div>
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════
     HAIL REPORT
     ═══════════════════════════════════════════════ */
  const HailReport = () => (
    <div>
      <ViewHeader title="Hail Report - Your Property" />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Property info */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
          <p className="text-sm text-neutral-400">Property</p>
          <p className="font-semibold mt-1">100 N Beaty St, Athens, AL 35611</p>
          <div className="flex items-center gap-4 mt-4">
            <div>
              <p className="text-sm text-neutral-400">Risk Level</p>
              <span className="inline-block mt-1 bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm font-bold">
                HIGH
              </span>
            </div>
            <div className="flex-1">
              <p className="text-sm text-neutral-400 mb-1">Risk Score: <span className="text-white font-bold">78/100</span></p>
              <div className="w-full h-3 bg-neutral-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full" style={{ width: '78%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Recent hail events */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
          <h3 className="font-semibold text-lg mb-4">Recent Hail Events Near Your Property</h3>
          <div className="space-y-3">
            {hailEvents.map((ev, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm bg-neutral-800/60 rounded-lg px-4 py-3"
              >
                <div className="flex-1">
                  <p className="font-medium">{ev.date}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {ev.size} ({ev.desc}) &middot; {ev.dist} away
                  </p>
                </div>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full ${
                    ev.severity === 'Severe'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  {ev.severity}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* HailRecon Summary */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
          <h3 className="font-semibold text-lg mb-3">HailRecon Summary</h3>
          <div className="space-y-2 text-sm text-neutral-300">
            <p>🧊 <strong>47</strong> hail events within 10 miles since 2011</p>
            <p>📏 Largest recorded: <strong>2.75 inches</strong> (July 2014)</p>
            <p>📊 Average: <strong>3.4 events per year</strong></p>
          </div>
        </div>

        {/* Full report link */}
        <a
          href="/bni/report"
          className="block text-center text-[#39FF14] hover:text-white transition-colors text-sm font-semibold py-3"
        >
          View Complete Report →
        </a>
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════
     PAYMENTS
     ═══════════════════════════════════════════════ */
  const Payments = () => (
    <div>
      <ViewHeader title="Billing & Payments" />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Job Cost Summary */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
          <h3 className="font-semibold text-lg mb-4">Job Cost Summary</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-400">Total Estimate</span>
              <span className="font-semibold">$14,850.00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Insurance Coverage (State Farm)</span>
              <span className="text-[#39FF14] font-semibold">-$13,850.00</span>
            </div>
            <div className="border-t border-neutral-700 pt-3 flex justify-between">
              <span className="font-bold text-lg">Your Responsibility</span>
              <span className="font-bold text-lg">$1,000.00</span>
            </div>
            <p className="text-xs text-neutral-500">(Deductible)</p>
          </div>
        </div>

        {/* Payment Schedule */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
          <h3 className="font-semibold text-lg mb-4">Payment Schedule</h3>
          <div className="bg-neutral-800/60 rounded-lg px-4 py-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Deductible Due</p>
              <p className="text-xs text-neutral-400 mt-0.5">At contract signing</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">$1,000.00</p>
              <span className="text-xs bg-[#39FF14]/20 text-[#39FF14] px-2 py-0.5 rounded-full">
                ✅ Paid (Mar 11, 2026)
              </span>
            </div>
          </div>
          <p className="text-xs text-neutral-500 mt-3 italic">
            Your insurance handles the rest directly with us
          </p>
        </div>

        {/* Insurance Status */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
          <h3 className="font-semibold text-lg mb-4">Insurance Status</h3>
          <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
            <div>
              <p className="text-neutral-400">Carrier</p>
              <p className="font-medium">State Farm</p>
            </div>
            <div>
              <p className="text-neutral-400">Claim #</p>
              <p className="font-medium">SF-2026-48291</p>
            </div>
            <div>
              <p className="text-neutral-400">Status</p>
              <p className="text-[#39FF14] font-medium">✅ Approved</p>
            </div>
            <div>
              <p className="text-neutral-400">Coverage</p>
              <p className="font-medium">$13,850.00</p>
            </div>
            <div>
              <p className="text-neutral-400">Deductible</p>
              <p className="font-medium">$1,000.00</p>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4 text-center text-sm text-neutral-400">
          Questions about billing? Contact your rep{' '}
          <span className="text-white font-semibold">Hunter Rivers</span> at{' '}
          <span className="text-[#39FF14]">(256) 274-8530</span>
        </div>
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */
  return (
    <div className="fixed inset-0 z-[9999] bg-[#0a0a0f] text-white overflow-auto">
      {/* Custom animations */}
      <style>{`
        @keyframes progress-bar {
          from { width: 0%; }
          to { width: 70%; }
        }
        .animate-progress-bar {
          animation: progress-bar 1.2s ease-out forwards;
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .animate-pulse-dot {
          animation: pulse-dot 2s ease-in-out infinite;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>

      {/* Back to presentation link */}
      <div className="bg-black/40 px-4 py-1.5">
        <a
          href="/bni/present"
          className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
        >
          ← Back to Presentation
        </a>
      </div>

      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-neutral-900 border-b border-neutral-800">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold tracking-wide">
              RIVER CITY <span className="text-[#39FF14]">ROOFING</span>
            </h1>
            <p className="text-xs text-neutral-400 -mt-0.5">Customer Portal</p>
          </div>
          <button
            onClick={() => setMenuOpen(true)}
            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <div className="space-y-1.5">
              <div className="w-6 h-0.5 bg-white rounded" />
              <div className="w-6 h-0.5 bg-white rounded" />
              <div className="w-6 h-0.5 bg-white rounded" />
            </div>
          </button>
        </div>
      </header>

      {/* Slide-in Menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60]">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
          {/* Panel */}
          <div className="absolute right-0 top-0 h-full w-72 bg-neutral-900 border-l border-neutral-800 animate-slide-in-right flex flex-col">
            {/* Close */}
            <div className="flex justify-end px-4 py-3">
              <button
                onClick={() => setMenuOpen(false)}
                className="text-2xl text-neutral-400 hover:text-white transition-colors p-1"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>
            {/* Menu Items */}
            <nav className="flex-1">
              {menuItems.map((item) => {
                const active = item.id === currentView;
                return (
                  <button
                    key={item.id}
                    onClick={() => switchView(item.id)}
                    className={`w-full text-left px-6 py-4 text-lg hover:bg-neutral-800 cursor-pointer transition-colors flex items-center gap-3 ${
                      active
                        ? 'border-l-4 border-[#39FF14] text-[#39FF14] bg-neutral-800/50'
                        : 'border-l-4 border-transparent text-neutral-300'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            {/* Customer info at bottom */}
            <div className="border-t border-neutral-800 px-6 py-4">
              <p className="text-sm font-semibold">David &amp; Lisa Richardson</p>
              <p className="text-xs text-neutral-400 mt-0.5">100 N Beaty St, Athens, AL 35611</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main key={fadeKey} className="animate-fade-in pb-8">
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'messages' && <Messages />}
        {currentView === 'documents' && <Documents />}
        {currentView === 'weather' && <Weather />}
        {currentView === 'hail' && <HailReport />}
        {currentView === 'payments' && <Payments />}
      </main>
    </div>
  );
}
