import { generateMetadata as genMeta } from '@/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = genMeta({
  title: 'Privacy Policy',
  description: 'Privacy Policy for River City Roofing Solutions. Learn how we collect, use, and protect your personal information and SMS communications.',
  path: '/privacy',
});

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-black/80 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold text-white mb-8">Privacy Policy</h1>
        <p className="text-gray-400 mb-8">Last Updated: December 2, 2024</p>

        <div className="prose prose-invert prose-lg max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Introduction</h2>
            <p className="text-gray-300">
              River City Roofing Solutions ("we," "us," or "our") is committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information
              when you visit our website at rivercityroofingsolutions.com, use our services, or communicate
              with us via phone, email, or SMS text messages.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Information We Collect</h2>
            <p className="text-gray-300 mb-4">We may collect the following types of personal information:</p>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li><strong>Contact Information:</strong> Name, email address, phone number, and mailing address</li>
              <li><strong>Property Information:</strong> Address and details about your roofing needs</li>
              <li><strong>Communication Records:</strong> Messages, emails, and SMS communications with our team</li>
              <li><strong>Service Information:</strong> Details about roofing services requested or provided</li>
              <li><strong>Website Usage Data:</strong> IP address, browser type, pages visited, and time spent on our site</li>
              <li><strong>Photos and Documents:</strong> Images of your property and related documents you provide</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">How We Use Your Information</h2>
            <p className="text-gray-300 mb-4">We use the information we collect to:</p>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Provide and improve our roofing services</li>
              <li>Respond to your inquiries and service requests</li>
              <li>Schedule inspections and appointments</li>
              <li>Send service updates, appointment reminders, and project status notifications</li>
              <li>Process insurance claims on your behalf</li>
              <li>Send promotional offers and company news (with your consent)</li>
              <li>Communicate with you via phone, email, or SMS text messages</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section id="sms-terms" className="bg-white/5 p-6 rounded-xl border border-white/10">
            <h2 className="text-2xl font-bold text-white mb-4">SMS/Text Message Terms of Service</h2>
            <p className="text-gray-300 mb-4">
              If you consent to receive SMS text messages from River City Roofing Solutions, you agree
              to receive the following types of messages:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 mb-4">
              <li><strong>Appointment Reminders:</strong> Notifications about scheduled inspections and service appointments</li>
              <li><strong>Service Updates:</strong> Project status updates, delivery notifications, and completion alerts</li>
              <li><strong>Customer Portal Access:</strong> Links to your personalized customer portal</li>
              <li><strong>Weather Alerts:</strong> Notifications about weather conditions affecting your project</li>
              <li><strong>Promotional Messages:</strong> Special offers, seasonal promotions, and referral rewards (optional)</li>
            </ul>

            <div className="bg-brand-green/10 border border-brand-green/30 p-4 rounded-lg mb-4">
              <p className="text-white font-semibold mb-2">Standard SMS Disclosures:</p>
              <ul className="text-gray-300 space-y-1 text-sm">
                <li>• Reply <strong>STOP</strong> at any time to opt-out of SMS messages</li>
                <li>• Reply <strong>HELP</strong> for support or contact us at (256) 274-8530</li>
                <li>• Message and data rates may apply</li>
                <li>• Messaging frequency varies based on your service needs</li>
              </ul>
            </div>

            <p className="text-gray-300 text-sm">
              By providing your phone number and checking the SMS consent box on our forms, you expressly
              consent to receive text messages from River City Roofing Solutions at the number provided.
              Consent is not a condition of purchase.
            </p>
          </section>

          <section className="bg-red-500/10 border border-red-500/30 p-6 rounded-xl">
            <h2 className="text-xl font-bold text-white mb-3">No Sharing of Opt-In Information</h2>
            <p className="text-gray-300">
              <strong>No mobile opt-in or text message consent will be shared with third parties or affiliates
              for marketing purposes.</strong> Your phone number and SMS consent are used solely for communications
              related to River City Roofing Solutions services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Information Sharing</h2>
            <p className="text-gray-300 mb-4">We may share your information with:</p>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li><strong>Service Providers:</strong> Companies that help us deliver services (scheduling, payment processing)</li>
              <li><strong>Insurance Companies:</strong> When processing claims on your behalf with your authorization</li>
              <li><strong>Material Suppliers:</strong> Only as necessary to complete your roofing project</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
            </ul>
            <p className="text-gray-300 mt-4">
              We do not sell your personal information to third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Data Security</h2>
            <p className="text-gray-300">
              We implement appropriate technical and organizational measures to protect your personal
              information against unauthorized access, alteration, disclosure, or destruction. However,
              no method of transmission over the Internet or electronic storage is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Your Rights</h2>
            <p className="text-gray-300 mb-4">You have the right to:</p>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your information (subject to legal requirements)</li>
              <li>Opt-out of marketing communications at any time</li>
              <li>Opt-out of SMS messages by replying STOP</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Cookies and Tracking</h2>
            <p className="text-gray-300">
              Our website uses cookies and similar tracking technologies to enhance your experience,
              analyze website traffic, and understand where our visitors come from. You can control
              cookie settings through your browser preferences.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Children's Privacy</h2>
            <p className="text-gray-300">
              Our services are not directed to individuals under 18 years of age. We do not knowingly
              collect personal information from children.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Changes to This Policy</h2>
            <p className="text-gray-300">
              We may update this Privacy Policy from time to time. We will notify you of any changes
              by posting the new Privacy Policy on this page and updating the "Last Updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Contact Us</h2>
            <p className="text-gray-300 mb-4">
              If you have questions about this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="text-gray-300 space-y-2">
              <p><strong>River City Roofing Solutions</strong></p>
              <p>3325 Central Pkwy SW, Decatur, AL 35603</p>
              <p>Phone: <a href="tel:256-274-8530" className="text-brand-green hover:underline">(256) 274-8530</a></p>
              <p>Email: <a href="mailto:rcrs@rivercityroofingsolutions.com" className="text-brand-green hover:underline">rcrs@rivercityroofingsolutions.com</a></p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10">
          <Link href="/" className="text-brand-green hover:text-lime-400 transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
