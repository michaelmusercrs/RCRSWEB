'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Mail, MapPin, Loader2, CheckCircle2 } from 'lucide-react';

interface ContactFormProps {
  showContactInfo?: boolean;
  darkMode?: boolean;
  sourcePage?: string;
  preselectedTeamMember?: string;
}

export default function ContactForm({
  showContactInfo = true,
  darkMode = false,
  sourcePage = 'Contact Page',
  preselectedTeamMember,
}: ContactFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch('/api/forms/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          phone: formData.get('phone') || '',
          subject: formData.get('subject'),
          message: formData.get('message'),
          preferredInspector: preselectedTeamMember || 'First Available',
          sourcePage: sourcePage,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setIsSubmitted(true);
        form.reset();
      } else {
        setError(result.message || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      setError('Network error. Please try again or call us at (256) 274-8530.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Styling
  const bgClass = darkMode ? 'bg-white/10 backdrop-blur-sm border-white/20' : 'bg-white border-gray-200';
  const textClass = darkMode ? 'text-white' : 'text-gray-900';
  const labelClass = darkMode ? 'text-gray-200' : 'text-gray-700';
  const inputClass = darkMode
    ? 'bg-white/10 border-gray-600 text-white placeholder-gray-400 focus:border-brand-green focus:ring-brand-green/20'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-brand-blue focus:ring-brand-blue/20';
  const buttonClass = darkMode
    ? 'bg-brand-green hover:bg-lime-400 text-black'
    : 'bg-brand-blue hover:bg-blue-700 text-white';

  if (isSubmitted) {
    return (
      <div className={`${bgClass} rounded-2xl p-8 border text-center`}>
        <div className="w-16 h-16 bg-brand-green rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-black" />
        </div>
        <h3 className={`text-2xl font-bold mb-2 ${textClass}`}>Message Sent!</h3>
        <p className={`mb-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Thank you for reaching out. We'll get back to you within 24 hours.
        </p>
        <button
          onClick={() => setIsSubmitted(false)}
          className={`${buttonClass} font-bold py-3 px-6 rounded-full transition-colors`}
        >
          Send Another Message
        </button>
      </div>
    );
  }

  return (
    <div className={`grid ${showContactInfo ? 'md:grid-cols-2' : ''} gap-12 items-start max-w-6xl mx-auto`}>
      {showContactInfo && (
        <div className="space-y-6">
          <div>
            <h2 className={`text-3xl font-bold mb-4 ${textClass}`}>Get In Touch</h2>
            <p className={`text-lg ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Have questions? Ready to schedule your free inspection? We're here to help.
            </p>
          </div>

          <div className="space-y-4">
            <a
              href="tel:256-274-8530"
              className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                darkMode ? 'border-white/20 hover:border-brand-green/50 bg-white/5' : 'border-gray-200 hover:border-brand-blue/50 bg-gray-50'
              }`}
            >
              <div className={`p-3 rounded-lg ${darkMode ? 'bg-brand-green/20' : 'bg-brand-blue/10'}`}>
                <Phone className={`h-5 w-5 ${darkMode ? 'text-brand-green' : 'text-brand-blue'}`} />
              </div>
              <div>
                <div className={`font-semibold ${textClass}`}>(256) 274-8530</div>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>24/7 Emergency Line</div>
              </div>
            </a>

            <a
              href="mailto:rcrs@rivercityroofingsolutions.com"
              className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                darkMode ? 'border-white/20 hover:border-brand-green/50 bg-white/5' : 'border-gray-200 hover:border-brand-blue/50 bg-gray-50'
              }`}
            >
              <div className={`p-3 rounded-lg ${darkMode ? 'bg-brand-green/20' : 'bg-brand-blue/10'}`}>
                <Mail className={`h-5 w-5 ${darkMode ? 'text-brand-green' : 'text-brand-blue'}`} />
              </div>
              <div>
                <div className={`font-semibold ${textClass}`}>rcrs@rivercityroofingsolutions.com</div>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Email Us</div>
              </div>
            </a>

            <a
              href="https://maps.google.com/?q=3325+Central+Pkwy+SW,+Decatur,+AL+35603"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                darkMode ? 'border-white/20 hover:border-brand-green/50 bg-white/5' : 'border-gray-200 hover:border-brand-blue/50 bg-gray-50'
              }`}
            >
              <div className={`p-3 rounded-lg ${darkMode ? 'bg-brand-green/20' : 'bg-brand-blue/10'}`}>
                <MapPin className={`h-5 w-5 ${darkMode ? 'text-brand-green' : 'text-brand-blue'}`} />
              </div>
              <div>
                <div className={`font-semibold ${textClass}`}>3325 Central Pkwy SW</div>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Decatur, AL 35603</div>
              </div>
            </a>
          </div>
        </div>
      )}

      <div className={`${bgClass} rounded-2xl p-6 md:p-8 border shadow-lg`}>
        <h2 className={`text-2xl font-bold mb-2 ${textClass}`}>Request Free Inspection</h2>
        <p className={`mb-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Fill out the form and we'll get back to you within 24 hours.
        </p>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className={`block text-sm font-medium mb-1 ${labelClass}`}>
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                placeholder="John Doe"
                className={`w-full px-4 py-3 rounded-lg border outline-none transition-colors focus:ring-2 ${inputClass}`}
              />
            </div>
            <div>
              <label htmlFor="email" className={`block text-sm font-medium mb-1 ${labelClass}`}>
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                placeholder="john@example.com"
                className={`w-full px-4 py-3 rounded-lg border outline-none transition-colors focus:ring-2 ${inputClass}`}
              />
            </div>
          </div>

          <div>
            <label htmlFor="phone" className={`block text-sm font-medium mb-1 ${labelClass}`}>
              Phone
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              placeholder="(256) 555-1234"
              className={`w-full px-4 py-3 rounded-lg border outline-none transition-colors focus:ring-2 ${inputClass}`}
            />
          </div>

          <div>
            <label htmlFor="subject" className={`block text-sm font-medium mb-1 ${labelClass}`}>
              Subject <span className="text-red-500">*</span>
            </label>
            <select
              id="subject"
              name="subject"
              required
              className={`w-full px-4 py-3 rounded-lg border outline-none transition-colors focus:ring-2 ${inputClass} ${darkMode ? 'bg-gray-800' : 'bg-white'}`}
            >
              <option value="">Select a subject...</option>
              <option value="Free Roof Inspection">Free Roof Inspection</option>
              <option value="Roof Replacement Quote">Roof Replacement Quote</option>
              <option value="Roof Repair">Roof Repair</option>
              <option value="Storm Damage">Storm Damage</option>
              <option value="Insurance Claim Help">Insurance Claim Help</option>
              <option value="Commercial Roofing">Commercial Roofing</option>
              <option value="Gutter Services">Gutter Services</option>
              <option value="General Question">General Question</option>
            </select>
          </div>

          <div>
            <label htmlFor="message" className={`block text-sm font-medium mb-1 ${labelClass}`}>
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="message"
              name="message"
              required
              rows={4}
              placeholder="Tell us about your roofing needs..."
              className={`w-full px-4 py-3 rounded-lg border outline-none transition-colors focus:ring-2 resize-none ${inputClass}`}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full ${buttonClass} font-bold py-4 px-8 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
          >
            {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
            {isSubmitting ? 'Sending...' : 'Send Message'}
          </button>

          <p className={`text-xs text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            We respect your privacy. Your information will only be used to respond to your inquiry.
          </p>
        </form>
      </div>
    </div>
  );
}
