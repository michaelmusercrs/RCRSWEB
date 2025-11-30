'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Phone, Menu, X, MessageCircle } from 'lucide-react';
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
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  return (
    <>
      {/* Main Header - Sticky, transparent on homepage */}
      <header className={`sticky top-0 z-50 ${isHomePage ? 'bg-transparent' : 'bg-white shadow-md'}`}>
        <nav className="container mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo - Hidden on homepage since huge logo is in hero */}
          {!isHomePage && (
            <Link href="/" className="flex-shrink-0">
              <Image
                src="/uploads/logo.png"
                alt="River City Roofing Solutions"
                width={80}
                height={80}
                className="w-16 h-16 md:w-20 md:h-20 hover:scale-105 transition-transform duration-300"
                priority
              />
            </Link>
          )}
          {isHomePage && <div className="w-16 md:w-20" />}

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`font-semibold transition-colors duration-300 text-lg ${
                  isHomePage
                    ? 'text-white hover:text-brand-green drop-shadow-lg'
                    : 'text-gray-800 hover:text-[#0066CC]'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Desktop Phone & CTA */}
          <div className="hidden lg:flex items-center gap-4">
            <a
              href="tel:256-274-8530"
              className={`flex items-center gap-2 transition-colors duration-300 ${
                isHomePage
                  ? 'text-white hover:text-brand-green drop-shadow-lg'
                  : 'text-gray-800 hover:text-[#0066CC]'
              }`}
            >
              <Phone className="w-5 h-5" />
              <span className="font-semibold text-lg">(256) 274-8530</span>
            </a>
            <Button
              asChild
              className="bg-[#39FF14] hover:bg-[#2ecc11] text-black font-bold px-6 py-3 rounded-md transition-all duration-300 hover:scale-105 shadow-lg"
            >
              <Link href="/contact">Free Inspection</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className={`lg:hidden p-2 transition-colors ${
              isHomePage
                ? 'text-white hover:text-brand-green'
                : 'text-gray-800 hover:text-[#0066CC]'
            }`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="w-8 h-8" />
            ) : (
              <Menu className="w-8 h-8" />
            )}
          </button>
        </nav>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 top-[72px] bg-white z-40 overflow-y-auto">
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
          asChild
          className="bg-[#39FF14] hover:bg-[#2ecc11] text-black font-bold w-16 h-16 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 flex items-center justify-center"
        >
          <Link href="/contact" aria-label="Get a Quote">
            <MessageCircle className="w-8 h-8" />
          </Link>
        </Button>
      </div>
    </>
  );
}
