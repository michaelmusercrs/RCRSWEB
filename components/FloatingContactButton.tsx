'use client';

import { useState } from 'react';
import { Phone, X, MessageCircle } from 'lucide-react';
import Link from 'next/link';

export default function FloatingContactButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        {isOpen && (
          <>
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
              <Link
                href="/contact"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-brand-blue text-white font-semibold shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all"
              >
                <MessageCircle className="h-5 w-5" />
                Send Message
              </Link>
            </div>
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
              <a
                href="tel:256-274-8530"
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-brand-blue font-semibold shadow-lg hover:shadow-xl hover:bg-gray-50 transition-all border-2 border-brand-blue"
              >
                <Phone className="h-5 w-5" />
                Call Now
              </a>
            </div>
          </>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 bg-brand-blue text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/50`}
          aria-label="Toggle contact menu"
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <MessageCircle className="h-6 w-6" />
          )}
        </button>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
