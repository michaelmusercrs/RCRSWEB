'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Send, Loader2, CheckCircle2 } from 'lucide-react';
import HoneypotField from '@/components/forms/HoneypotField';
import TurnstileWidget from '@/components/forms/TurnstileWidget';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// US phone — accepts (256) 555-1234, 256-555-1234, 256.555.1234, 2565551234, +12565551234
const PHONE_RE = /^(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;

export default function QuickContactForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — bots fill, humans don't
  const [turnstileToken, setTurnstileToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Inline validation — fail fast before hitting the API
    if (name.trim().length < 2) {
      setError('Please enter your name.');
      return;
    }
    if (!PHONE_RE.test(phone.trim())) {
      setError('Please enter a valid US phone number.');
      return;
    }
    if (email && !EMAIL_RE.test(email.trim())) {
      setError('Please enter a valid email or leave it blank.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/forms/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          subject: 'Free Inspection Request',
          message: message.trim() || 'Requesting a free roof inspection.',
          sourcePage: 'Homepage Quick Form',
          leadSource: 'Website',
          leadSourceDetail: 'Homepage Quick Contact',
          website, // honeypot — server drops if non-empty
          turnstileToken, // Cloudflare Turnstile token (or 'disabled' when inert)
        }),
      });

      const result = await res.json();

      if (result.success) {
        // Show inline success state for 2.5s before navigating away.
        // This is more reassuring than a full-page redirect — the user
        // sees their submission was received before the page changes.
        setSubmitted(true);
        setTimeout(() => router.push('/thank-you'), 2500);
      } else {
        setError(result.message || 'Something went wrong. Please call us at (256) 274-8530.');
      }
    } catch {
      setError('Unable to send. Please call us at (256) 274-8530.');
    } finally {
      setLoading(false);
    }
  };

  // Inline success card — shown after successful submit, before redirect
  if (submitted) {
    return (
      <div className="space-y-4 text-center py-8">
        <CheckCircle2 className="mx-auto text-brand-green" size={56} />
        <h3 className="text-2xl font-black text-white uppercase tracking-wider">
          Got it, {name.split(' ')[0]}!
        </h3>
        <p className="text-neutral-300">
          We&apos;ll call you at <span className="font-mono text-white">{phone}</span> within
          the next hour during business hours.
        </p>
        <p className="text-xs text-neutral-500">Redirecting to next steps…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rcrs-autofill-dark">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your Name *"
            className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
          />
        </div>
        <div>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone Number *"
            className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
          />
        </div>
      </div>
      <div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional)"
          className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
        />
      </div>
      <div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How can we help? (optional)"
          rows={2}
          className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all resize-none"
        />
      </div>

      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}

      <HoneypotField value={website} onChange={setWebsite} />

      <TurnstileWidget onVerify={setTurnstileToken} theme="dark" />

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-4 bg-brand-green text-black font-black uppercase tracking-widest rounded-lg hover:bg-lime-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Sending...</>
          ) : (
            <><Send className="w-5 h-5" /> Get Free Inspection</>
          )}
        </button>
        <a
          href="tel:256-274-8530"
          className="flex-1 py-4 border-2 border-brand-green text-brand-green font-black uppercase tracking-widest rounded-lg hover:bg-brand-green hover:text-black transition-all flex items-center justify-center gap-2 text-lg"
        >
          <Phone className="w-5 h-5" /> Call Now
        </a>
      </div>
      <p className="text-center text-xs text-neutral-300">
        100% free inspection. No obligation. We&apos;ll respond within 24 hours.
      </p>
    </form>
  );
}
