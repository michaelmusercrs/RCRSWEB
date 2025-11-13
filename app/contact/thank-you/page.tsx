import Link from 'next/link';
import { CheckCircle, ArrowLeft, Clock, Phone } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Thank You | River City Roofing Solutions',
  description: 'Thank you for contacting River City Roofing Solutions. We will get back to you shortly.',
};

export default function ThankYouPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero/Header */}
      <section className="py-12 bg-gray-50 border-b border-gray-200">
        <div className="container mx-auto px-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-brand-blue hover:text-blue-700 font-semibold transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Home
          </Link>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 min-h-[70vh] flex items-center justify-center">
        <div className="w-full max-w-2xl bg-white border-2 border-gray-200 rounded-3xl shadow-lg p-8 md:p-12">
          {/* Success Icon */}
          <div className="text-center space-y-6">
            <div className="mx-auto w-24 h-24 bg-green-500/20 text-green-600 p-6 rounded-full mb-4">
              <CheckCircle className="h-12 w-12" />
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-brand-black">
              Thank You!
            </h1>

            <p className="text-lg text-gray-600">
              Your request has been received and we're excited to help!
            </p>
            <p className="text-gray-600">
              Our team will review your information and get back to you shortly.
            </p>
          </div>

          {/* What Happens Next */}
          <div className="mt-12 space-y-4 bg-gray-50 p-6 rounded-2xl border border-gray-200">
            <h3 className="font-semibold text-lg text-brand-black">What Happens Next?</h3>
            <ol className="space-y-4">
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-blue text-white text-sm font-semibold flex-shrink-0">
                  1
                </span>
                <span className="text-gray-600 pt-1">
                  We'll review your request and confirm your appointment details
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-blue text-white text-sm font-semibold flex-shrink-0">
                  2
                </span>
                <span className="text-gray-600 pt-1">
                  You'll receive a call or email with available appointment times
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-blue text-white text-sm font-semibold flex-shrink-0">
                  3
                </span>
                <span className="text-gray-600 pt-1">
                  Our inspector will arrive at your scheduled time for a thorough
                  evaluation
                </span>
              </li>
            </ol>
          </div>

          {/* Quick Info Cards */}
          <div className="grid sm:grid-cols-2 gap-4 mt-8">
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-200">
              <Clock className="h-5 w-5 text-brand-blue mt-1 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm mb-1 text-brand-black">Response Time</p>
                <p className="text-sm text-gray-600">
                  Typically within 2 hours
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-200">
              <Phone className="h-5 w-5 text-brand-blue mt-1 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm mb-1 text-brand-black">Need Quick Help?</p>
                <a
                  href="tel:256-274-8530"
                  className="text-sm text-brand-blue font-semibold hover:underline"
                >
                  (256) 274-8530
                </a>
              </div>
            </div>
          </div>

          {/* Emergency Notice */}
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 mt-8">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Have an emergency?</span> If you need
              immediate assistance with roof damage or leaks, call us right away at{' '}
              <a
                href="tel:256-274-8530"
                className="text-brand-blue font-semibold hover:underline"
              >
                (256) 274-8530
              </a>
              . We're available 24/7 for urgent situations.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-8">
            <Link
              href="/"
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-full border-2 border-gray-300 text-gray-700 font-semibold hover:border-brand-blue hover:text-brand-blue transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
            <Link
              href="/services"
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-brand-blue text-white font-semibold hover:bg-blue-700 transition-colors"
            >
              View Our Services
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
