'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Phone, Mail, MapPin, Facebook, Instagram, Clock, Shield, CheckCircle } from 'lucide-react';
import HoneypotField from '@/components/forms/HoneypotField';
import TurnstileWidget from '@/components/forms/TurnstileWidget';

function FooterEmailCapture() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — bots fill, humans don't
  const [turnstileToken, setTurnstileToken] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    setSubmitting(true);
    try {
      const params = new URLSearchParams(window.location.search);
      await fetch('/api/email-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          sourcePage: window.location.pathname,
          utmSource: params.get('utm_source') || '',
          utmMedium: params.get('utm_medium') || '',
          utmCampaign: params.get('utm_campaign') || '',
          website, // honeypot — server drops if non-empty
          turnstileToken, // Cloudflare Turnstile token (or 'disabled' when inert)
        }),
      });
      setSubmitted(true);
    } catch {
      // Silent fail for footer form
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[120px]">
    {submitted ? (
      <div className="flex items-center gap-2 text-brand-green min-h-[120px]">
        <CheckCircle size={18} />
        <span className="text-sm">Thanks! We&apos;ll be in touch.</span>
      </div>
    ) : (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label htmlFor="footer-name" className="sr-only">Your Name</label>
      <input
        type="text"
        id="footer-name"
        required
        placeholder="Your Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-brand-green transition"
      />
      <label htmlFor="footer-email" className="sr-only">Email Address</label>
      <input
        type="email"
        id="footer-email"
        required
        placeholder="Email Address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-brand-green transition"
      />
      <HoneypotField value={website} onChange={setWebsite} />
      <TurnstileWidget onVerify={setTurnstileToken} theme="dark" />
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2 bg-brand-green hover:bg-brand-green/90 text-black font-semibold rounded-lg text-sm transition disabled:opacity-50"
      >
        {submitting ? 'Sending...' : 'Get Free Roof Assessment'}
      </button>
    </form>
    )}
    </div>
  );
}

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-black/90 backdrop-blur-sm border-t border-white/10">
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <h3 className="text-xl font-bold text-white mb-4">River City Roofing</h3>
            <p className="text-gray-300 text-sm mb-4">
              Professional roofing services for North Alabama. Licensed, insured, and committed to excellence.
            </p>
            <div className="flex gap-4">
              <a
                href="https://www.facebook.com/RiverCityRoofingSolutionsLLC"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow us on Facebook"
                className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-brand-green/20 transition-colors"
              >
                <Facebook size={20} className="text-gray-300 hover:text-brand-green" />
              </a>
              <a
                href="https://www.instagram.com/rivercityroofingsolutions/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow us on Instagram"
                className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-brand-green/20 transition-colors"
              >
                <Instagram size={20} className="text-gray-300 hover:text-brand-green" />
              </a>
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Contact Us</h3>
            <div className="space-y-3">
              <a href="tel:256-274-8530" className="flex items-center gap-3 text-gray-300 hover:text-brand-green transition-colors">
                <Phone size={18} />
                <span>(256) 274-8530</span>
              </a>
              <a href="mailto:rcrs@rivercityroofingsolutions.com" className="flex items-center gap-3 text-gray-300 hover:text-brand-green transition-colors">
                <Mail size={18} className="flex-shrink-0" />
                <span className="text-sm break-all">rcrs@rivercityroofingsolutions.com</span>
              </a>
              <div className="flex items-start gap-3 text-gray-300">
                <MapPin size={18} className="mt-0.5" />
                <span>3325 Central Pkwy SW<br />Decatur, AL 35603</span>
              </div>
              <div className="flex items-center gap-3 text-gray-300">
                <Clock size={18} />
                <span>24/7 Emergency Service</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Services</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/services/residential-roof-replacement" className="text-gray-300 hover:text-brand-green transition-colors text-sm">
                  Residential Roofing
                </Link>
              </li>
              <li>
                <Link href="/services/commercial-roofing" className="text-gray-300 hover:text-brand-green transition-colors text-sm">
                  Commercial Roofing
                </Link>
              </li>
              <li>
                <Link href="/services/storm-hail-damage-repair" className="text-gray-300 hover:text-brand-green transition-colors text-sm">
                  Storm Damage
                </Link>
              </li>
              <li>
                <Link href="/services/leafx-gutter-protection" className="text-gray-300 hover:text-brand-green transition-colors text-sm">
                  Gutters & LeafX
                </Link>
              </li>
              <li>
                <Link href="/check-my-address" className="text-gray-300 hover:text-brand-green transition-colors text-sm">
                  Storm Check
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-300 hover:text-brand-green transition-colors text-sm">
                  Free Inspection
                </Link>
              </li>
            </ul>
          </div>

          {/* Free Assessment CTA */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Free Roof Assessment</h3>
            <p className="text-gray-300 text-sm mb-3">
              Storm damage? Let us inspect your roof for free — no obligation.
            </p>
            <FooterEmailCapture />
            <div className="flex items-center gap-1.5 mt-3 text-neutral-300 text-xs">
              <Shield size={12} />
              <span>No spam. Your info stays private.</span>
            </div>
          </div>
        </div>

        {/* Service Areas Row */}
        <div className="mt-8 pt-8 border-t border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Service Areas</h3>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Link href="/service-areas/decatur-al" className="text-gray-300 hover:text-brand-green transition-colors text-sm">
                Decatur, AL
              </Link>
              <Link href="/service-areas/huntsville-al" className="text-gray-300 hover:text-brand-green transition-colors text-sm">
                Huntsville, AL
              </Link>
              <Link href="/service-areas/madison-al" className="text-gray-300 hover:text-brand-green transition-colors text-sm">
                Madison, AL
              </Link>
              <Link href="/service-areas/athens-al" className="text-gray-300 hover:text-brand-green transition-colors text-sm">
                Athens, AL
              </Link>
              <Link href="/service-areas/hartselle-al" className="text-gray-300 hover:text-brand-green transition-colors text-sm">
                Hartselle, AL
              </Link>
              <Link href="/service-areas/cullman-al" className="text-gray-300 hover:text-brand-green transition-colors text-sm">
                Cullman, AL
              </Link>
              <Link href="/service-areas/albertville-al" className="text-gray-300 hover:text-brand-green transition-colors text-sm">
                Albertville, AL
              </Link>
              <Link href="/service-areas/guntersville-al" className="text-gray-300 hover:text-brand-green transition-colors text-sm">
                Guntersville, AL
              </Link>
              <Link href="/service-areas/scottsboro-al" className="text-gray-300 hover:text-brand-green transition-colors text-sm">
                Scottsboro, AL
              </Link>
              <Link href="/service-areas/meridianville-al" className="text-gray-300 hover:text-brand-green transition-colors text-sm">
                Meridianville, AL
              </Link>
              <Link href="/service-areas" className="text-gray-300 hover:text-brand-green transition-colors text-sm font-medium">
                All Service Areas →
              </Link>
          </div>
        </div>

        {/* Counties Served Row — high-intent county landing pages
            (/roofing-contractor/[county]) for SEO topic-cluster binding. */}
        <div className="mt-8 pt-8 border-t border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Counties Served</h3>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/roofing-contractor/madison" className="text-gray-300 hover:text-brand-green transition-colors text-sm">
              Madison County, AL
            </Link>
            <Link href="/roofing-contractor/morgan" className="text-gray-300 hover:text-brand-green transition-colors text-sm">
              Morgan County, AL
            </Link>
            <Link href="/roofing-contractor/marshall" className="text-gray-300 hover:text-brand-green transition-colors text-sm">
              Marshall County, AL
            </Link>
            <Link href="/roofing-contractor/limestone" className="text-gray-300 hover:text-brand-green transition-colors text-sm">
              Limestone County, AL
            </Link>
            <Link href="/roofing-contractor/cullman" className="text-gray-300 hover:text-brand-green transition-colors text-sm">
              Cullman County, AL
            </Link>
          </div>
        </div>

        {/* Additional Links Row */}
        <div className="mt-8 pt-8 border-t border-white/10">
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/about" className="text-gray-300 hover:text-brand-green transition-colors">About Us</Link>
            <span className="text-gray-700">•</span>
            <Link href="/team" className="text-gray-300 hover:text-brand-green transition-colors">Our Team</Link>
            <span className="text-gray-700">•</span>
            <Link href="/reviews" className="text-gray-300 hover:text-brand-green transition-colors">Reviews</Link>
            <span className="text-gray-700">•</span>
            <Link href="/gallery" className="text-gray-300 hover:text-brand-green transition-colors">Gallery</Link>
            <span className="text-gray-700">•</span>
            <Link href="/blog" className="text-gray-300 hover:text-brand-green transition-colors">Blog</Link>
            <span className="text-gray-700">•</span>
            <Link href="/faq" className="text-gray-300 hover:text-brand-green transition-colors">FAQ</Link>
            <span className="text-gray-700">•</span>
            <Link href="/financing" className="text-gray-300 hover:text-brand-green transition-colors">Financing</Link>
            <span className="text-gray-700">•</span>
            <Link href="/warranty" className="text-gray-300 hover:text-brand-green transition-colors">Warranty</Link>
            <span className="text-gray-700">•</span>
            <Link href="/community" className="text-gray-300 hover:text-brand-green transition-colors">Community</Link>
            <span className="text-gray-700">•</span>
            <Link href="/referral-rewards" className="text-gray-300 hover:text-brand-green transition-colors">Raise the Roof for Schools</Link>
            <span className="text-gray-700">•</span>
            <Link href="/bni" className="text-gray-300 hover:text-brand-green transition-colors">BNI Partners</Link>
            <span className="text-gray-700">•</span>
            <Link href="/careers" className="text-gray-300 hover:text-brand-green transition-colors">Careers</Link>
            <span className="text-gray-700">•</span>
            <Link href="/check-my-address" className="text-gray-300 hover:text-brand-green transition-colors">Storm Check</Link>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-neutral-300 text-sm text-center md:text-left">
              &copy; {currentYear} River City Roofing Solutions. All rights reserved.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Link href="/privacy" className="text-neutral-300 hover:text-brand-green transition-colors">
                Privacy Policy
              </Link>
              <span className="text-gray-700">|</span>
              <Link href="/terms" className="text-neutral-300 hover:text-brand-green transition-colors">
                Terms of Service
              </Link>
              <span className="text-gray-700">|</span>
              <Link href="/privacy#sms-terms" className="text-neutral-300 hover:text-brand-green transition-colors">
                SMS Terms
              </Link>
            </div>
          </div>
          {/* Agency Credit */}
          <div className="mt-4 pt-4 border-t border-white/5 text-center">
            <p className="text-neutral-300 text-xs tracking-wide">
              Engineered with precision by{' '}
              <span className="text-neutral-300 font-medium hover:text-brand-green transition-colors cursor-default">
                RoofPro Digital
              </span>
              {' '}— Where roofing meets innovation.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
