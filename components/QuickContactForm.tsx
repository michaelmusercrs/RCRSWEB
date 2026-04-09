'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Send, Loader2, CheckCircle2 } from 'lucide-react';

export default function QuickContactForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/forms/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          email: email || undefined,
          subject: 'Free Inspection Request',
          message: message || 'Requesting a free roof inspection.',
          sourcePage: 'Homepage Quick Form',
          leadSource: 'Website',
          leadSourceDetail: 'Homepage Quick Contact',
        }),
      });

      const result = await res.json();

      if (result.success) {
        // Redirect to thank you / next steps page
        router.push('/thank-you');
      } else {
        setError(result.message || 'Something went wrong. Please call us at (256) 274-8530.');
      }
    } catch {
      setError('Unable to send. Please call us at (256) 274-8530.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
