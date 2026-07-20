'use client';

import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

const faqData = [
  {
    q: 'Do I need roofing or sales experience?',
    a: 'Not at all! We provide comprehensive, FREE training that covers everything from roofing fundamentals to proven sales techniques. Many of our top earners started with zero experience.',
  },
  {
    q: 'How does the compensation and benefits work?',
    a: 'You earn commission on every job you close with no cap on earnings. We offer health, dental, vision, and household accident insurance, plus a Roth IRA with free company match. Top performers also earn through our bi-annual bonus program, vacation trips, and monthly gas cards. Some restrictions may apply. Our top performers earn well over $100K annually.',
  },
  {
    q: 'What about leads? Do I have to find my own customers?',
    a: 'We help with lead generation through our marketing efforts, storm tracking technology, and referral programs. You\'ll also learn door-to-door and networking techniques to build your own pipeline.',
  },
  {
    q: 'Is this a 1099 or W-2 position?',
    a: 'This is an independent contractor (1099) opportunity. That means YOU are the boss — you set your hours, choose your territory, and build equity in your own book of business.',
  },
  {
    q: 'What tools or equipment do I need?',
    a: 'Just a reliable vehicle, a phone, and a good attitude. We provide all the sales materials, training resources, technology platforms, and back-office support.',
  },
  {
    q: 'How soon can I start earning?',
    a: 'Many new partners close their first deal within the first two weeks of training. Storm season can accelerate this even further.',
  },
  {
    q: 'What makes RCRS different from other roofing companies hiring reps?',
    a: 'Our owners have 25+ years actually roofing — selling, project managing, and running crews. We\'re OC Preferred and IKO Top Tier Craftsman Premier certified. We offer real benefits: health, dental, vision, and household accident insurance, Roth IRA with free match, bi-annual bonuses, vacation trips, and monthly gas cards. And we\'ve donated over $100K to our local community. This isn\'t a side hustle for us — roofing is all we\'ve ever done.',
  },
];

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold">
            Frequently Asked <span className="text-brand-green-dark">Questions</span>
          </h2>
          <p className="text-xl mt-6 max-w-3xl mx-auto text-gray-600">
            Got questions? We&apos;ve got answers.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {faqData.map((item, i) => (
            <div
              key={i}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left font-semibold text-lg hover:bg-gray-50 transition"
              >
                <span className="flex items-center gap-3">
                  <HelpCircle size={20} className="text-brand-green-dark flex-shrink-0" />
                  {item.q}
                </span>
                <ChevronDown
                  size={20}
                  className={`text-gray-400 transition-transform ${open === i ? 'rotate-180' : ''}`}
                />
              </button>
              {open === i && (
                <div className="px-5 pb-5 text-gray-600 leading-relaxed">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
