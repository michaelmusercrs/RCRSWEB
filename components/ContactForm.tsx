'use client';

import { Phone, Mail, MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { teamMembers } from '@/lib/teamData';
import { useRouter } from 'next/navigation';

const inspectors = teamMembers.filter(
  (m) => m.category === 'Production' && m.position === 'Sales Inspector'
);

interface ContactFormProps {
  showContactInfo?: boolean;
  preselectedInspector?: string;
}

export default function ContactForm({
  showContactInfo = true,
  preselectedInspector,
}: ContactFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedInspector, setSelectedInspector] = useState(
    preselectedInspector || 'first-available'
  );
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          phone: formData.get('phone'),
          subject: formData.get('subject'),
          message: formData.get('message'),
          preferredInspector: selectedInspector,
        }),
      });

      if (response.ok) {
        router.push('/contact/thank-you');
      } else {
        alert('There was a problem submitting your form. Please try again or call us directly.');
        setIsSubmitting(false);
      }
    } catch (error) {
      alert('There was a problem submitting your form. Please try again or call us directly.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-12 items-start max-w-7xl mx-auto">
      {showContactInfo && (
        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-brand-black mb-6">
              Get In Touch
            </h2>
            <p className="text-gray-600 text-lg mb-8">
              Have questions or ready to schedule your free inspection? Reach out
              to us using any of the methods below.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4 p-6 rounded-2xl border border-brand-blue/20 hover:border-brand-blue/50 transition-colors bg-white shadow-sm">
              <div className="bg-brand-blue/10 p-3 rounded-xl mt-1">
                <MapPin className="h-6 w-6 text-brand-blue" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Our Location</h3>
                <a
                  href="https://maps.google.com/?q=3325+Central+Pkwy+SW,+Decatur,+AL+35603"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-brand-blue transition-colors"
                >
                  3325 Central Pkwy SW
                  <br />
                  Decatur, AL 35603
                </a>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 rounded-2xl border border-brand-blue/20 hover:border-brand-blue/50 transition-colors bg-white shadow-sm">
              <div className="bg-brand-blue/10 p-3 rounded-xl mt-1">
                <Phone className="h-6 w-6 text-brand-blue" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Call Us</h3>
                <a
                  href="tel:256-274-8530"
                  className="text-gray-600 hover:text-brand-blue transition-colors text-lg font-semibold"
                >
                  (256) 274-8530
                </a>
                <p className="text-sm text-gray-500 mt-1">
                  Available 24/7 for emergencies
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 rounded-2xl border border-brand-blue/20 hover:border-brand-blue/50 transition-colors bg-white shadow-sm">
              <div className="bg-brand-blue/10 p-3 rounded-xl mt-1">
                <Mail className="h-6 w-6 text-brand-blue" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Email Us</h3>
                <a
                  href="mailto:office@rcrsal.com"
                  className="text-gray-600 hover:text-brand-blue transition-colors"
                >
                  office@rcrsal.com
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-md">
        <h2 className="text-3xl font-bold text-brand-black mb-2">
          Request a Free Inspection
        </h2>
        <p className="text-gray-600 mb-6">
          Fill out the form below and we'll get back to you shortly.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-semibold text-gray-700">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="John Doe"
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-colors"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="phone" className="block text-sm font-semibold text-gray-700">
              Phone Number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              placeholder="(555) 555-5555"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="preferredInspector" className="block text-sm font-semibold text-gray-700">
              Preferred Inspector (Optional)
            </label>
            <select
              id="preferredInspector"
              name="preferredInspector"
              value={selectedInspector}
              onChange={(e) => setSelectedInspector(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-colors bg-white"
            >
              <option value="first-available">First Available</option>
              {inspectors.map((inspector) => (
                <option key={inspector.slug} value={inspector.slug}>
                  {inspector.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="subject" className="block text-sm font-semibold text-gray-700">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              id="subject"
              name="subject"
              type="text"
              placeholder="e.g., Roof Inspection, Storm Damage"
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="message" className="block text-sm font-semibold text-gray-700">
              Your Message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="message"
              name="message"
              placeholder="Tell us about your roofing needs..."
              required
              rows={5}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-colors resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand-blue hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </button>

          <p className="text-xs text-gray-500 text-center">
            We respect your privacy. Your information will only be used to respond to your inquiry.
          </p>
        </form>
      </div>
    </div>
  );
}
