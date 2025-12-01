'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Phone, Menu, X, MessageCircle, Send, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';


const navigation = [
  { name: 'Services', href: '/services' },
  { name: 'Service Areas', href: '/service-areas' },
  { name: 'Team', href: '/team' },
  { name: 'Blog', href: '/blog' },
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
];

const locationPages = [
  { name: 'Huntsville', href: '/locations/huntsville' },
  { name: 'Madison', href: '/locations/madison' },
  { name: 'Decatur', href: '/locations/decatur' },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', message: '' });
  const [formSubmitted, setFormSubmitted] = useState(false);
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Here you would typically send the form data to your backend
    console.log('Form submitted:', formData);
    setFormSubmitted(true);
    setTimeout(() => {
      setContactFormOpen(false);
      setFormSubmitted(false);
      setFormData({ name: '', phone: '', email: '', message: '' });
    }, 2000);
  };

  return (
    <>
      {/* Main Header - Sticky Nav Only */}
      <header className="sticky top-0 z-50 bg-black/60 backdrop-blur-sm">
        <nav className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Home Button - Only on non-home pages */}
            {!isHomePage ? (
              <Link href="/" className="flex items-center gap-2 text-white hover:text-brand-green transition-colors">
                <Home className="w-6 h-6" />
                <span className="hidden sm:inline font-semibold">Home</span>
              </Link>
            ) : <div />}
            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-6">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="font-semibold transition-colors duration-300 text-lg text-white hover:text-brand-green drop-shadow-lg"
                >
                  {item.name}
                </Link>
              ))}
              <span className="text-gray-500">|</span>
              <a
                href="tel:256-274-8530"
                className="flex items-center gap-2 transition-colors duration-300 text-white hover:text-brand-green drop-shadow-lg"
              >
                <Phone className="w-5 h-5" />
                <span className="font-semibold text-lg">(256) 274-8530</span>
              </a>
              <Button
                asChild
                className="bg-brand-green text-black hover:bg-lime-400 font-bold px-6 py-2 rounded-md"
              >
                <Link href="/contact">Free Inspection</Link>
              </Button>
            </div>
            {/* Mobile Menu Button */}
            <button
              type="button"
              className="lg:hidden p-2 transition-colors text-white hover:text-brand-green"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-8 h-8" /> : <Menu className="w-8 h-8" />}
            </button>
          </div>
        </nav>

        {/* Hidden spacer */}
        <nav className="hidden">

        </nav>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="lg:hidden absolute left-0 right-0 top-full bg-white z-[100] overflow-y-auto max-h-[80vh] shadow-xl">
            <div className="px-4 py-6 space-y-6">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="block text-2xl font-semibold text-gray-800 hover:text-[#0066CC] transition-colors duration-300 py-3"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}

              {/* Location Pages Submenu */}
              <div className="pt-2 pb-4 border-t">
                <p className="text-sm uppercase tracking-widest font-bold text-gray-600 mb-3">Top Locations</p>
                {locationPages.map((loc) => (
                  <Link
                    key={loc.name}
                    href={loc.href}
                    className="block text-xl font-semibold text-gray-700 hover:text-[#0066CC] transition-colors duration-300 py-2 pl-4"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {loc.name}
                  </Link>
                ))}</div>
              
              <div className="pt-6 border-t space-y-4">
                <a
                  href="tel:256-274-8530"
                  className="flex items-center gap-3 text-xl font-semibold text-gray-800 hover:text-[#0066CC] transition-colors py-3"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Phone className="w-6 h-6" />
                  (256) 274-8530
                </a>
                <Button
                  asChild
                  className="w-full bg-[#39FF14] hover:bg-[#2ecc11] text-black font-bold py-4 text-lg rounded-md transition-all duration-300 hover:scale-105 shadow-lg"
                >
                  <Link href="/contact" onClick={() => setMobileMenuOpen(false)}>
                    Free Inspection
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Floating "Get Quote" Button - Bottom Right */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setContactFormOpen(true)}
          className="bg-[#39FF14] hover:bg-[#2ecc11] text-black font-bold w-16 h-16 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 flex items-center justify-center"
          aria-label="Get a Quote"
        >
          <MessageCircle className="w-8 h-8" />
        </Button>
      </div>

      {/* Contact Form Popup */}
      {contactFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setContactFormOpen(false)}
          />

          {/* Form Container */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="bg-black text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Get a Free Quote</h3>
                  <p className="text-sm text-gray-300">We'll respond within 24 hours</p>
                </div>
                <button
                  onClick={() => setContactFormOpen(false)}
                  className="text-white hover:text-brand-green transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="p-6">
              {formSubmitted ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-brand-green rounded-full flex items-center justify-center mx-auto mb-4">
                    <Send className="w-8 h-8 text-black" />
                  </div>
                  <h4 className="text-xl font-bold text-gray-900 mb-2">Message Sent!</h4>
                  <p className="text-gray-600">We'll get back to you soon.</p>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="popup-name" className="block text-sm font-semibold text-gray-700 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      id="popup-name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent outline-none transition-all"
                      placeholder="Your name"
                    />
                  </div>

                  <div>
                    <label htmlFor="popup-phone" className="block text-sm font-semibold text-gray-700 mb-1">
                      Phone *
                    </label>
                    <input
                      type="tel"
                      id="popup-phone"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent outline-none transition-all"
                      placeholder="(256) 555-1234"
                    />
                  </div>

                  <div>
                    <label htmlFor="popup-email" className="block text-sm font-semibold text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      id="popup-email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent outline-none transition-all"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="popup-message" className="block text-sm font-semibold text-gray-700 mb-1">
                      How can we help? *
                    </label>
                    <textarea
                      id="popup-message"
                      required
                      rows={3}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent outline-none transition-all resize-none"
                      placeholder="Tell us about your roofing needs..."
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-brand-green hover:bg-lime-400 text-black font-bold py-4 text-lg rounded-lg transition-all duration-300"
                  >
                    Send Message
                  </Button>

                  <p className="text-center text-sm text-gray-500">
                    Or call us directly:{' '}
                    <a href="tel:256-274-8530" className="text-brand-blue font-semibold hover:underline">
                      (256) 274-8530
                    </a>
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
