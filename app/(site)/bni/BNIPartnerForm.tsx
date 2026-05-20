'use client';

import { useState, FormEvent } from 'react';
import HoneypotField from '@/components/forms/HoneypotField';
import TurnstileWidget from '@/components/forms/TurnstileWidget';

interface Partner {
  name: string;
  business: string;
  category: string;
}

interface BNIPartnerFormProps {
  partners: Partner[];
}

export default function BNIPartnerForm({ partners }: BNIPartnerFormProps) {
  const [selectedPartner, setSelectedPartner] = useState('');
  const [yourName, setYourName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — bots fill, humans don't
  const [turnstileToken, setTurnstileToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!selectedPartner || !yourName.trim() || !phone.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/forms/bni-partner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner: selectedPartner,
          name: yourName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          message: message.trim(),
          website, // honeypot — server drops if non-empty
          turnstileToken, // Cloudflare Turnstile token (or 'disabled' when inert)
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to submit form. Please try again.');
      }

      setSuccess(true);
      setSelectedPartner('');
      setYourName('');
      setPhone('');
      setEmail('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Partner Selection */}
        <div>
          <label htmlFor="partner" className="text-neutral-300 text-sm font-medium block mb-2">
            Select a Partner <span className="text-red-400">*</span>
          </label>
          <select
            id="partner"
            value={selectedPartner}
            onChange={(e) => setSelectedPartner(e.target.value)}
            required
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none appearance-none"
          >
            <option value="">Select a partner...</option>
            {partners.map((p, idx) => (
              <option key={idx} value={`${p.business} - ${p.name}`}>
                {p.business} — {p.category}
              </option>
            ))}
          </select>
        </div>

        {/* Your Name */}
        <div>
          <label htmlFor="yourName" className="text-neutral-300 text-sm font-medium block mb-2">
            Your Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            id="yourName"
            value={yourName}
            onChange={(e) => setYourName(e.target.value)}
            required
            placeholder="John Smith"
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none placeholder:text-neutral-500"
          />
        </div>

        {/* Your Phone */}
        <div>
          <label htmlFor="phone" className="text-neutral-300 text-sm font-medium block mb-2">
            Your Phone <span className="text-red-400">*</span>
          </label>
          <input
            type="tel"
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            placeholder="(256) 555-1234"
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none placeholder:text-neutral-500"
          />
        </div>

        {/* Your Email */}
        <div>
          <label htmlFor="email" className="text-neutral-300 text-sm font-medium block mb-2">
            Your Email <span className="text-neutral-500">(optional)</span>
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@example.com"
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none placeholder:text-neutral-500"
          />
        </div>

        {/* Message */}
        <div>
          <label htmlFor="message" className="text-neutral-300 text-sm font-medium block mb-2">
            Message <span className="text-neutral-500">(optional)</span>
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Tell us how we can help or any specific needs"
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none placeholder:text-neutral-500 resize-vertical"
          />
        </div>

        {/* Success Message */}
        {success && (
          <div className="bg-green-900/50 border border-green-500/50 text-green-300 rounded-lg p-4">
            Thank you! We&apos;ll make the introduction within 24 hours.
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/50 border border-red-500/50 text-red-300 rounded-lg p-4">
            {error}
          </div>
        )}

        <HoneypotField value={website} onChange={setWebsite} />

        <TurnstileWidget onVerify={setTurnstileToken} theme="dark" />

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-green hover:bg-lime-400 text-black font-bold px-8 py-4 rounded-lg text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Submitting...' : 'Request Introduction'}
        </button>
      </form>
    </div>
  );
}
