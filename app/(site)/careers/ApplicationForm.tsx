'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import HoneypotField from '@/components/forms/HoneypotField';

export default function ApplicationForm() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    city: '',
    experience: '',
    whyJoin: '',
    agreed: false,
    website: '', // honeypot — bots fill, humans don't
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

          <HoneypotField
            value={form.website}
            onChange={(v) => set('website', v)}
          />

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
