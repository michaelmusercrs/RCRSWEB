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
  ChevronRight,
  Zap,
  Shield,
  Building2,
} from 'lucide-react';
import ReferralCodeGate from './ReferralCodeGate';
import FAQSection from './FAQSection';
import ApplicationForm from './ApplicationForm';

// ─── Main Page (Server Component) ──────────────────────────────────
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
          <h1 className="text-4xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Build Your Own <span className="text-brand-green">Business</span>
          </h1>
          <h2 className="text-xl md:text-3xl text-white/90 mb-10 max-w-3xl mx-auto leading-relaxed">
            Real roofing experience. Full benefits. Unlimited earning potential. OC Preferred &amp; IKO Craftsman Premier certified.
          </h2>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a
              href="#application"
              className="bg-brand-green text-white font-semibold text-lg px-8 py-4 rounded hover:brightness-110 transition"
            >
              Join Our Team
            </a>
            <a
              href="#calculator"
              className="border-2 border-brand-green text-brand-green font-semibold text-lg px-8 py-4 rounded hover:bg-brand-green hover:text-white transition"
            >
              Have a Referral Code?
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
                link: { href: '#application', label: 'Start Your Journey →' },
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
                text: 'Health, dental, and vision insurance. Roth IRA with company match. Household accident insurance covering your entire family. Plus bi-annual bonus programs, vacation trips, and monthly gas cards for top performers.*',
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

      {/* Benefits Breakdown */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold">
              Real <span className="text-brand-green">Benefits</span>, Real Security
            </h2>
            <p className="text-xl mt-6 max-w-3xl mx-auto text-gray-600">
              We invest in our people — not just with commissions, but with a comprehensive benefits package that protects you and your family.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { title: 'Health Insurance', desc: 'Comprehensive medical coverage to keep you and your family healthy.' },
              { title: 'Dental Insurance', desc: 'Full dental coverage for preventive care, procedures, and more.' },
              { title: 'Vision Insurance', desc: 'Eye exams, glasses, and contacts covered.' },
              { title: 'Household Accident Insurance', desc: 'Accident coverage for your entire household — not just you, your whole family is protected.' },
              { title: 'Roth IRA Match', desc: 'Free company match on your Roth IRA contributions. Invest in your future at no extra cost to you.' },
              { title: 'Sales Competitions & Bonuses', desc: 'Bi-annual bonus program, vacation trips for top performers, and monthly gas cards to fuel your hustle.' },
            ].map((b) => (
              <div key={b.title} className="bg-white rounded-lg p-6 shadow-md border border-gray-100">
                <CheckCircle size={24} className="text-brand-green mb-3" />
                <h3 className="text-lg font-bold mb-2">{b.title}</h3>
                <p className="text-gray-600 text-sm">{b.desc}</p>
              </div>
            ))}
          </div>

          <p className="text-center mt-8 text-gray-400 text-sm italic">
            *Some restrictions may apply. Benefits details provided during the onboarding process.
          </p>
        </div>
      </section>

      {/* Why We're Different */}
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
                  'Owners who have actually roofed, sold, and run crews themselves',
                  'Full benefits: health, dental, vision, Roth IRA match, household accident insurance',
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
                text: 'Learn from owners with real hands-on roofing experience — selling, project managing, and running crews. Not theory from a textbook.',
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

      {/* Day in the Life */}
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

      {/* Referral Code Gate — unlocks earnings calculator & detailed info */}
      <section id="calculator" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">
            Want to See the <span className="text-brand-green">Numbers?</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Our current team members can give you a referral code to access detailed earnings information, 
            commission calculator, and everything you need to make an informed decision.
          </p>
          <ReferralCodeGate />
        </div>
      </section>

      {/* FAQ (Client Component) */}
      <FAQSection />

      {/* Application Form (Client Component) */}
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
