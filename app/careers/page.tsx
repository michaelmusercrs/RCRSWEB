'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  Clock,
  TrendingUp,
  GraduationCap,
  Users,
  Trophy,
  ChevronDown,
  Star,
  Phone,
  Mail,
  MapPin,
  CheckCircle,
  Briefcase,
  Sun,
  Coffee,
  Hammer,
  Target,
  HelpCircle,
  ChevronRight,
  Zap,
  Shield,
  Building2,
} from 'lucide-react';

// ─── Earnings Calculator ────────────────────────────────────────────
function EarningsCalculator() {
  const [hours, setHours] = useState(40);
  const [experience, setExperience] = useState('some');

  const rateMap: Record<string, number> = {
    beginner: 30,
    some: 45,
    experienced: 55,
    roofing: 70,
  };

  const base = hours * (rateMap[experience] || 45) * 52;
  const low = Math.round((base * 0.8) / 1000) * 1000;
  const high = Math.round((base * 1.2) / 1000) * 1000;

  return (
    <section id="calculator" className="py-20 bg-[#1a1a1a] text-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold">
            Calculate Your <span className="text-brand-green">Potential Income</span>
          </h2>
          <p className="text-xl mt-6 max-w-3xl mx-auto text-gray-300">
            See what&apos;s possible when you&apos;re in control of your own success.
          </p>
        </div>

        <div className="max-w-2xl mx-auto bg-gray-900 border-2 border-brand-green rounded-lg p-8">
          {/* Hours slider */}
          <div className="mb-10">
            <label className="block text-2xl font-bold mb-6">
              How many hours can you work per week?
            </label>
            <input
              type="range"
              min={10}
              max={60}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="w-full h-2.5 rounded-full bg-gray-700 appearance-none cursor-pointer accent-brand-green"
            />
            <div className="flex justify-between text-sm text-gray-400 mt-2">
              {[10, 20, 30, 40, 50, 60].map((v) => (
                <span key={v}>{v} hrs</span>
              ))}
            </div>
            <p className="mt-4 text-center text-xl">
              You selected: <span className="font-bold text-brand-green">{hours}</span> hours per week
            </p>
          </div>

          {/* Experience select */}
          <div className="mb-10">
            <label className="block text-2xl font-bold mb-6">
              What&apos;s your experience level?
            </label>
            <select
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              className="w-full p-4 bg-gray-800 border border-gray-700 rounded text-white"
            >
              <option value="beginner">Beginner (No Sales Experience)</option>
              <option value="some">Some Sales Experience</option>
              <option value="experienced">Experienced in Sales</option>
              <option value="roofing">Experienced in Roofing Sales</option>
            </select>
          </div>

          {/* Result */}
          <div className="mb-10">
            <h3 className="text-2xl font-bold mb-6">Your Estimated Annual Business Revenue</h3>
            <div className="bg-gray-800 p-8 rounded-lg text-center border-2 border-brand-green">
              <p className="text-lg mb-2">Based on your selections, you could earn approximately:</p>
              <p className="text-5xl font-bold my-6 text-brand-green">
                ${low.toLocaleString()} – ${high.toLocaleString()}
              </p>
              <p className="text-sm italic text-gray-400">
                Individual results vary based on performance, market conditions, and other factors.
              </p>
            </div>
          </div>

          <a
            href="#application"
            className="block w-full py-4 text-xl text-center font-semibold bg-brand-green text-white rounded hover:brightness-110 transition"
          >
            Apply Now &amp; Start Building Your Business
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── Application Form ───────────────────────────────────────────────
function ApplicationForm() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    city: '',
    experience: '',
    whyJoin: '',
    agreed: false,
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.agreed) return;
      setStatus('submitting');
      try {
        const res = await fetch('/api/forms/careers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (data.success) {
          setStatus('success');
        } else {
          setErrorMsg(data.message || 'Something went wrong.');
          setStatus('error');
        }
      } catch {
        setErrorMsg('Network error. Please call us at (256) 274-8530.');
        setStatus('error');
      }
    },
    [form],
  );

  if (status === 'success') {
    return (
      <section id="application" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 text-center">
          <CheckCircle className="mx-auto mb-6 text-brand-green" size={72} />
          <h2 className="text-4xl font-bold mb-6">Application Submitted!</h2>
          <p className="text-xl mb-10 max-w-3xl mx-auto">
            Thank you for your interest in building your business with River City Roofing Solutions. Our team will contact you within 24 hours.
          </p>
          <Link href="/" className="inline-block bg-brand-green text-white font-semibold px-8 py-4 rounded hover:brightness-110 transition">
            Return Home
          </Link>
        </div>
      </section>
    );
  }

  const set = (key: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <section id="application" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold">
            Ready to <span className="text-brand-green">Get Started?</span>
          </h2>
          <p className="text-xl mt-6 max-w-3xl mx-auto text-gray-600">
            Fill out the form below to begin your journey. We&apos;ll contact you within 24 hours.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block font-semibold mb-2">First Name</label>
              <input
                required
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold mb-2">Last Name</label>
              <input
                required
                value={form.lastName}
                onChange={(e) => set('lastName', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 outline-none"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block font-semibold mb-2">Email Address</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 outline-none"
            />
          </div>

          <div className="mt-4">
            <label className="block font-semibold mb-2">Phone Number</label>
            <input
              type="tel"
              required
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 outline-none"
            />
          </div>

          <div className="mt-4">
            <label className="block font-semibold mb-2">City &amp; State</label>
            <input
              required
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 outline-none"
            />
          </div>

          <div className="mt-4">
            <label className="block font-semibold mb-2">Sales Experience</label>
            <select
              required
              value={form.experience}
              onChange={(e) => set('experience', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 outline-none"
            >
              <option value="">Select your experience level</option>
              <option value="none">No Sales Experience</option>
              <option value="some">Some Sales Experience</option>
              <option value="extensive">Extensive Sales Experience</option>
              <option value="roofing">Roofing Sales Experience</option>
            </select>
          </div>

          <div className="mt-4">
            <label className="block font-semibold mb-2">
              Why do you want to join River City Roofing Solutions?
            </label>
            <textarea
              required
              rows={4}
              value={form.whyJoin}
              onChange={(e) => set('whyJoin', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 outline-none"
            />
          </div>

          <label className="flex items-start gap-3 mt-6 cursor-pointer">
            <input
              type="checkbox"
              checked={form.agreed}
              onChange={(e) => set('agreed', e.target.checked)}
              className="mt-1 accent-brand-green"
              required
            />
            <span className="text-sm text-gray-600">
              I understand this is an opportunity to build my own business as an independent contractor with River City Roofing Solutions. I am ready to take control of my future and income potential.
            </span>
          </label>

          {status === 'error' && (
            <p className="mt-4 text-red-600 text-sm">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="mt-6 w-full py-4 text-xl font-semibold bg-brand-green text-white rounded hover:brightness-110 transition disabled:opacity-50"
          >
            {status === 'submitting' ? 'Submitting…' : 'Submit Application'}
          </button>
        </form>
      </div>
    </section>
  );
}

// ─── FAQ Accordion ──────────────────────────────────────────────────
const faqData = [
  {
    q: 'Do I need roofing or sales experience?',
    a: 'Not at all! We provide comprehensive, FREE training that covers everything from roofing fundamentals to proven sales techniques. Many of our top earners started with zero experience.',
  },
  {
    q: 'How does the compensation and benefits work?',
    a: 'You earn commission on every job you close with no cap on earnings. Plus we offer health, dental, and vision insurance, 401(k) with company match, and an accident policy that covers your entire household — not just you, your whole family. Our top performers earn over $100K annually.',
  },
  {
    q: 'What about leads? Do I have to find my own customers?',
    a: 'We help with lead generation through our marketing efforts, storm tracking technology, and referral programs. You\'ll also learn door-to-door and networking techniques to build your own pipeline.',
  },
  {
    q: 'Is this a 1099 or W-2 position?',
    a: 'This is an independent contractor (1099) opportunity. That means YOU are the boss — you set your hours, choose your territory, and build equity in your own book of business.',
  },
  {
    q: 'What tools or equipment do I need?',
    a: 'Just a reliable vehicle, a phone, and a good attitude. We provide all the sales materials, training resources, technology platforms, and back-office support.',
  },
  {
    q: 'How soon can I start earning?',
    a: 'Many new partners close their first deal within the first two weeks of training. Storm season can accelerate this even further.',
  },
  {
    q: 'What makes RCRS different from other roofing companies hiring reps?',
    a: 'Our owners have 25+ years actually roofing — selling, project managing, and running crews. We\'re OC Preferred and IKO Top Tier Craftsman Premier certified. We offer real benefits (health, dental, vision, 401k, family accident coverage). And we\'ve donated over $100K to our local community. This isn\'t a side hustle for us — roofing is all we\'ve ever done.',
  },
];

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold">
            Frequently Asked <span className="text-brand-green">Questions</span>
          </h2>
          <p className="text-xl mt-6 max-w-3xl mx-auto text-gray-600">
            Got questions? We&apos;ve got answers.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {faqData.map((item, i) => (
            <div
              key={i}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left font-semibold text-lg hover:bg-gray-50 transition"
              >
                <span className="flex items-center gap-3">
                  <HelpCircle size={20} className="text-brand-green flex-shrink-0" />
                  {item.q}
                </span>
                <ChevronDown
                  size={20}
                  className={`text-gray-400 transition-transform ${open === i ? 'rotate-180' : ''}`}
                />
              </button>
              {open === i && (
                <div className="px-5 pb-5 text-gray-600 leading-relaxed">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function CareersPage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative bg-[#1a1a1a] min-h-[600px] flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=2070&q=80')",
          }}
        />
        <div className="relative z-10 container mx-auto px-4 text-center py-20">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Build Your Own <span className="text-brand-green">Business</span>
          </h1>
          <h2 className="text-2xl md:text-3xl text-white/90 mb-10 max-w-3xl mx-auto leading-relaxed">
            25+ years of real roofing experience. Full benefits. Unlimited earning potential. OC Preferred &amp; IKO Craftsman Premier certified.
          </h2>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a
              href="#calculator"
              className="bg-brand-green text-white font-semibold text-lg px-8 py-4 rounded hover:brightness-110 transition"
            >
              Calculate Your Potential
            </a>
            <a
              href="#application"
              className="border-2 border-brand-green text-brand-green font-semibold text-lg px-8 py-4 rounded hover:bg-brand-green hover:text-white transition"
            >
              Join Our Team
            </a>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown size={36} className="text-white/75" />
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-[#1a1a1a] border-t border-white/10 py-10 text-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '25+', label: 'Years in Roofing' },
              { value: '5+', label: 'Cities & Growing' },
              { value: '$100K+', label: 'Potential Earnings' },
              { value: '$100K+', label: 'Donated to Community' },
            ].map((s) => (
              <div key={s.label} className="p-4">
                <div className="text-4xl font-bold text-brand-green mb-2">{s.value}</div>
                <p className="text-lg">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="benefits" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold">
              Why Partner With <span className="text-brand-green">River City Roofing?</span>
            </h2>
            <p className="text-xl mt-6 max-w-3xl mx-auto text-gray-600">
              Experience the freedom of entrepreneurship with the support and resources of an established company.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <DollarSign size={40} />,
                title: 'Be Your Own Boss',
                text: 'Take control of your income and future. Build your own client base, set your own goals, and enjoy the freedom of running your own business with our support.',
                link: { href: '#calculator', label: 'Calculate Your Potential →' },
              },
              {
                icon: <Clock size={40} />,
                title: 'Complete Schedule Freedom',
                text: 'Work when and where you want. You decide your hours and territory, creating the perfect work-life balance.',
                link: { href: '#application', label: 'Apply Now →' },
              },
              {
                icon: <TrendingUp size={40} />,
                title: 'High-Demand Market',
                text: 'Recent storms have created unprecedented demand for roofing services. Take advantage of this booming market with virtually unlimited opportunities.',
                link: { href: '#contact', label: 'Learn More →' },
              },
              {
                icon: <GraduationCap size={40} />,
                title: 'FREE Training Program',
                text: 'No experience necessary. Our detailed training program gives you everything you need to succeed, from sales techniques to technical knowledge.',
                link: null,
              },
              {
                icon: <Users size={40} />,
                title: 'Family-Oriented Environment',
                text: "Join a supportive, rock-solid team where everyone helps each other grow and succeed. We're not just partners — we're family.",
                link: { href: '#testimonials', label: 'Read Testimonials →' },
              },
              {
                icon: <Shield size={40} />,
                title: 'Full Benefits Package',
                text: 'Health, dental, and vision insurance. 401(k) with company match. Plus an accident policy covering your entire household — not just you, your whole family.',
                link: null,
              },
            ].map((b) => (
              <div
                key={b.title}
                className="bg-white rounded-xl border-t-4 border-brand-green p-8 shadow-md hover:-translate-y-2 hover:shadow-xl transition-all duration-300"
              >
                <div className="text-brand-green mb-6 flex justify-center">{b.icon}</div>
                <h3 className="text-xl font-bold mb-4 text-center">{b.title}</h3>
                <p className="text-gray-600 mb-4">{b.text}</p>
                {b.link && (
                  <div className="text-center mt-6">
                    <a href={b.link.href} className="text-brand-green font-semibold hover:underline">
                      {b.link.label}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why We're Different — BEATS Yellowhammer */}
      <section className="py-20 bg-[#1a1a1a] text-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold">
              Why We&apos;re <span className="text-brand-green">Different</span>
            </h2>
            <p className="text-xl mt-6 max-w-3xl mx-auto text-gray-300">
              Not all roofing opportunities are created equal. Here&apos;s how the RCRS entrepreneurial model compares to a traditional roofing job.
            </p>
          </div>

          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
            {/* Traditional */}
            <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
              <div className="flex items-center gap-3 mb-6">
                <Building2 size={28} className="text-gray-400" />
                <h3 className="text-2xl font-bold text-gray-300">Traditional Roofing Job</h3>
              </div>
              <ul className="space-y-4 text-gray-400">
                {[
                  'Fixed hourly wage or capped salary',
                  'Someone else sets your schedule',
                  'You build THEIR business, not yours',
                  'Limited growth — wait for promotions',
                  'Owners who pivoted from other industries',
                  'No real benefits or family protection',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="text-red-400 mt-1">✕</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* RCRS */}
            <div className="bg-gray-900 rounded-xl p-8 border-2 border-brand-green relative">
              <div className="absolute -top-4 right-4 bg-brand-green text-black text-sm font-bold px-4 py-1 rounded-full">
                THE RCRS WAY
              </div>
              <div className="flex items-center gap-3 mb-6">
                <Zap size={28} className="text-brand-green" />
                <h3 className="text-2xl font-bold">RCRS Entrepreneurial Model</h3>
              </div>
              <ul className="space-y-4">
                {[
                  'Uncapped commissions — earn what you deserve',
                  'YOU set your own hours and territory',
                  'Build YOUR business with our brand behind you',
                  'Owners with 25+ years actually roofing, selling, and running crews',
                  'Full benefits: health, dental, vision, 401(k) match, family accident policy',
                  'OC Preferred & IKO Top Tier Craftsman Premier certified',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle size={18} className="text-brand-green mt-1 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold">
              How It <span className="text-brand-green">Works</span>
            </h2>
            <p className="text-xl mt-6 max-w-3xl mx-auto text-gray-600">
              Our simple process gets you from application to earning in no time.
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-8">
            {[
              {
                step: 1,
                title: 'Apply to Join Our Team',
                text: 'Fill out our simple application form. No experience required — just bring your motivation and readiness to learn.',
              },
              {
                step: 2,
                title: 'Complete Our Free Training',
                text: 'Learn from owners with 25+ years of hands-on roofing experience — selling, project managing, and running crews. Not theory from a textbook.',
              },
              {
                step: 3,
                title: 'Start Building Your Business',
                text: 'Begin working with customers, setting your own schedule, and developing your client base with our ongoing support.',
              },
              {
                step: 4,
                title: 'Grow Your Income',
                text: 'As you build experience and expertise, watch your business and income grow. The more you put in, the more you get out.',
              },
            ].map((s) => (
              <div key={s.step} className="flex gap-6 bg-white p-6 rounded-lg shadow-md">
                <div className="w-10 h-10 bg-brand-green rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                  {s.step}
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">{s.title}</h3>
                  <p className="text-lg text-gray-600">{s.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-16">
            <a
              href="#application"
              className="inline-block bg-brand-green text-white font-semibold text-lg px-8 py-4 rounded hover:brightness-110 transition"
            >
              Start Your Journey Today
            </a>
          </div>
        </div>
      </section>

      {/* Day in the Life — Yellowhammer doesn't have this */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold">
              A Day in the <span className="text-brand-green">Life</span>
            </h2>
            <p className="text-xl mt-6 max-w-3xl mx-auto text-gray-600">
              What does a typical day look like as an RCRS partner? You decide — but here&apos;s what many of our top performers do.
            </p>
          </div>

          <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-6">
            {[
              {
                icon: <Coffee size={28} />,
                time: '8:00 AM',
                title: 'Morning Huddle',
                text: 'Quick team check-in, review leads, plan your route for the day.',
              },
              {
                icon: <Target size={28} />,
                time: '9:00 AM',
                title: 'Hit the Field',
                text: 'Visit homeowners, inspect roofs, present solutions. You choose your territory.',
              },
              {
                icon: <Hammer size={28} />,
                time: '12:00 PM',
                title: 'Midday Follow-ups',
                text: 'Lunch break, follow up on estimates, schedule inspections. Work from anywhere.',
              },
              {
                icon: <Sun size={28} />,
                time: '3:00 PM',
                title: 'Close & Wrap Up',
                text: 'Close deals, submit paperwork, or knock on a few more doors. Done when YOU say you\'re done.',
              },
            ].map((item) => (
              <div key={item.time} className="flex gap-4 p-6 bg-gray-50 rounded-xl">
                <div className="text-brand-green flex-shrink-0">{item.icon}</div>
                <div>
                  <p className="text-sm text-brand-green font-semibold">{item.time}</p>
                  <h3 className="text-lg font-bold">{item.title}</h3>
                  <p className="text-gray-600 text-sm mt-1">{item.text}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center mt-10 text-gray-500 italic max-w-2xl mx-auto">
            The beauty of this opportunity? Every day is different, and YOU are in control. Some partners work 30 hours a week, some work 50 — it&apos;s your business to build.
          </p>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold">
              Success <span className="text-brand-green">Stories</span>
            </h2>
            <p className="text-xl mt-6 max-w-3xl mx-auto text-gray-600">
              Hear from our partners who have transformed their careers:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: 'Hunter Rivers',
                since: 'Partner since 2022',
                quote:
                  'Joining River City Roofing was the best career move I\'ve made. The flexible schedule allows me to be there for my family, and I\'ve doubled my previous income. The family-oriented atmosphere makes work feel less like a job and more like a passion.',
              },
              {
                name: 'Aaron Lussi',
                since: 'Partner since 2023',
                quote:
                  'I had no previous roofing experience, but their FREE training program set me up for success from day one. I was earning while learning, and now I\'m consistently one of the top performers. The best part is I\'m building something that\'s truly mine.',
              },
              {
                name: 'Brendon Muse',
                since: 'Partner since 2021',
                quote:
                  'What I love most is how family-oriented this company is. We work hard but also have each other\'s backs. The commission structure is fantastic, and with all the storm damage in the area, I\'ve been able to help homeowners while providing well for my own family.',
              },
            ].map((t) => (
              <div
                key={t.name}
                className="bg-white rounded-xl border-l-4 border-brand-green p-8 shadow-md hover:-translate-y-2 hover:shadow-xl transition-all duration-300 relative"
              >
                <span className="absolute top-4 left-6 text-7xl text-brand-green/10 font-serif leading-none select-none">
                  &ldquo;
                </span>
                <div className="mb-6">
                  <h4 className="font-bold text-xl">{t.name}</h4>
                  <p className="text-gray-500 mb-3">{t.since}</p>
                  <div className="flex gap-1 text-yellow-400">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={18} fill="currentColor" />
                    ))}
                  </div>
                </div>
                <p className="italic text-gray-700 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Community Involvement */}
      <section className="py-20 bg-[#1a1a1a] text-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold">
              Rooted in <span className="text-brand-green">Community</span>
            </h2>
            <p className="text-xl mt-6 max-w-3xl mx-auto text-gray-300">
              We don&apos;t just work here — we live here. RCRS has donated over $100,000 to local organizations because strong communities build strong businesses.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {[
              'Youth Sports Teams',
              'Netreapers',
              'Decatur High School',
              'Austin High School',
              'Decatur Heritage',
              'Local Charities',
              'Community Events',
              'And Many More',
            ].map((org) => (
              <div key={org} className="bg-gray-800 rounded-lg p-4 text-center border border-gray-700 hover:border-brand-green transition">
                <p className="font-semibold">{org}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-gray-300 text-lg mb-6">Follow us and see what we&apos;re up to</p>
            <div className="flex justify-center gap-6">
              {[
                { label: 'Facebook', href: 'https://facebook.com/rivercityroofingsolutions' },
                { label: 'YouTube', href: 'https://youtube.com/@rivercityroofingsolutions' },
                { label: 'Instagram', href: 'https://instagram.com/rivercityroofingsolutions' },
                { label: 'TikTok', href: 'https://tiktok.com/@rivercityroofingsolutions' },
              ].map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="text-brand-green hover:underline font-semibold">
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Earnings Calculator */}
      <EarningsCalculator />

      {/* FAQ */}
      <FAQSection />

      {/* Application Form */}
      <ApplicationForm />

      {/* Contact Section */}
      <section id="contact" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold">
              Questions? <span className="text-brand-green">Get in Touch</span>
            </h2>
            <p className="text-xl mt-6 max-w-3xl mx-auto text-gray-600">
              Want to learn more? We&apos;re here to help!
            </p>
          </div>

          <div className="max-w-2xl mx-auto bg-white rounded-xl p-8 shadow-md">
            <div className="space-y-6">
              <a href="tel:256-274-8530" className="flex items-center gap-4 text-lg hover:text-brand-green transition">
                <Phone size={24} className="text-brand-green" />
                <span>(256) 274-8530</span>
              </a>
              <a href="mailto:rcrs@rivercityroofingsolutions.com" className="flex items-center gap-4 text-lg hover:text-brand-green transition">
                <Mail size={24} className="text-brand-green" />
                <span>rcrs@rivercityroofingsolutions.com</span>
              </a>
              <div className="flex items-start gap-4 text-lg">
                <MapPin size={24} className="text-brand-green mt-1" />
                <span>3325 Central Parkway SW, Decatur, AL 35603</span>
              </div>
              <div className="flex items-start gap-4 text-lg">
                <Clock size={24} className="text-brand-green mt-1" />
                <div>
                  <p>Monday – Friday: 8am – 6pm</p>
                  <p>Saturday: By appointment</p>
                  <p>Sunday: Closed</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
