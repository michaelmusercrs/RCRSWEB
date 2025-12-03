import { generateMetadata as genMeta } from '@/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = genMeta({
  title: 'Terms of Service',
  description: 'Terms of Service for River City Roofing Solutions. Read our terms and conditions for using our services.',
  path: '/terms',
});

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-black/80 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold text-white mb-8">Terms of Service</h1>
        <p className="text-gray-400 mb-8">Last Updated: December 2, 2024</p>

        <div className="prose prose-invert prose-lg max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Agreement to Terms</h2>
            <p className="text-gray-300">
              By accessing or using the River City Roofing Solutions website and services, you agree to be
              bound by these Terms of Service and our Privacy Policy. If you do not agree with any part of
              these terms, please do not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Services</h2>
            <p className="text-gray-300">
              River City Roofing Solutions provides professional roofing services including but not limited to:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 mt-4">
              <li>Roof inspections and assessments</li>
              <li>Roof replacement and installation</li>
              <li>Roof repairs</li>
              <li>Storm damage assessment and restoration</li>
              <li>Insurance claim assistance</li>
              <li>Gutter installation and repair</li>
              <li>Commercial roofing services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Estimates and Pricing</h2>
            <p className="text-gray-300">
              All estimates provided are based on information available at the time of assessment. Final
              pricing may vary based on actual conditions discovered during the work. Any significant
              changes will be discussed with you before proceeding.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Warranties</h2>
            <p className="text-gray-300">
              River City Roofing Solutions provides a 5-Year Workmanship Warranty on all installations.
              Manufacturer warranties on materials vary by product and will be explained during the
              estimate process. Warranty terms are detailed in your service contract.
            </p>
          </section>

          <section id="sms-terms" className="bg-white/5 p-6 rounded-xl border border-white/10">
            <h2 className="text-2xl font-bold text-white mb-4">SMS/Text Message Terms</h2>
            <p className="text-gray-300 mb-4">
              If you consent to receive SMS text messages from River City Roofing Solutions, you agree
              to receive appointment reminders, service updates, project notifications, customer portal
              links, and promotional messages from us.
            </p>

            <div className="bg-brand-green/10 border border-brand-green/30 p-4 rounded-lg mb-4">
              <p className="text-white font-semibold mb-2">SMS Program Terms:</p>
              <ul className="text-gray-300 space-y-1">
                <li>• Reply <strong>STOP</strong> to opt-out of SMS messages at any time</li>
                <li>• Reply <strong>HELP</strong> for support information</li>
                <li>• Message and data rates may apply</li>
                <li>• Messaging frequency varies based on your service activity</li>
                <li>• View our <Link href="/privacy#sms-terms" className="text-brand-green hover:underline">Privacy Policy</Link> for full SMS terms</li>
              </ul>
            </div>

            <p className="text-gray-300 text-sm">
              Consent to receive SMS messages is not required to purchase goods or services. You may
              opt-out at any time by texting STOP to any message received.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Customer Responsibilities</h2>
            <p className="text-gray-300 mb-4">As a customer, you agree to:</p>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Provide accurate information about your property and roofing needs</li>
              <li>Ensure access to the property for scheduled appointments</li>
              <li>Notify us of any known hazards on your property</li>
              <li>Make timely payments according to your service agreement</li>
              <li>Communicate promptly regarding any concerns or changes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Payment Terms</h2>
            <p className="text-gray-300">
              Payment terms are outlined in your individual service contract. We accept various payment
              methods including cash, check, credit cards, and financing options. For insurance claims,
              we work directly with insurance companies when authorized.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Limitation of Liability</h2>
            <p className="text-gray-300">
              River City Roofing Solutions liability is limited to the scope of services provided and
              the terms of your service contract. We are not liable for pre-existing conditions,
              weather-related damages after project completion, or issues outside the scope of our work.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Intellectual Property</h2>
            <p className="text-gray-300">
              All content on our website, including text, images, logos, and designs, is the property
              of River City Roofing Solutions and is protected by copyright laws. You may not reproduce,
              distribute, or use any content without our written permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Dispute Resolution</h2>
            <p className="text-gray-300">
              Any disputes arising from our services will first be addressed through direct communication
              with our management team. If unresolved, disputes will be handled in accordance with
              Alabama state law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Changes to Terms</h2>
            <p className="text-gray-300">
              We reserve the right to modify these Terms of Service at any time. Changes will be
              effective immediately upon posting to our website. Continued use of our services
              constitutes acceptance of modified terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Contact Information</h2>
            <p className="text-gray-300 mb-4">
              For questions about these Terms of Service, please contact us:
            </p>
            <div className="text-gray-300 space-y-2">
              <p><strong>River City Roofing Solutions</strong></p>
              <p>3325 Central Pkwy SW, Decatur, AL 35603</p>
              <p>Phone: <a href="tel:256-274-8530" className="text-brand-green hover:underline">(256) 274-8530</a></p>
              <p>Email: <a href="mailto:rcrs@rivercityroofingsolutions.com" className="text-brand-green hover:underline">rcrs@rivercityroofingsolutions.com</a></p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex gap-4">
          <Link href="/" className="text-brand-green hover:text-lime-400 transition-colors">
            ← Back to Home
          </Link>
          <span className="text-gray-600">|</span>
          <Link href="/privacy" className="text-brand-green hover:text-lime-400 transition-colors">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
