'use client';

import Link from 'next/link';
import { Phone, Mail, MapPin, Facebook, Instagram, Clock } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-black/90 backdrop-blur-sm border-t border-white/10">
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <h3 className="text-xl font-bold text-white mb-4">River City Roofing</h3>
            <p className="text-gray-400 text-sm mb-4">
              Professional roofing services for North Alabama. Licensed, insured, and committed to excellence.
            </p>
            <div className="flex gap-4">
              <a
                href="https://www.facebook.com/RiverCityRoofingSolutionsLLC"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-brand-green/20 transition-colors"
              >
                <Facebook size={20} className="text-gray-400 hover:text-brand-green" />
              </a>
              <a
                href="https://www.instagram.com/rivercityroofingsolutions/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-brand-green/20 transition-colors"
              >
                <Instagram size={20} className="text-gray-400 hover:text-brand-green" />
              </a>
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Contact Us</h3>
            <div className="space-y-3">
              <a href="tel:256-274-8530" className="flex items-center gap-3 text-gray-400 hover:text-brand-green transition-colors">
                <Phone size={18} />
                <span>(256) 274-8530</span>
              </a>
              <a href="mailto:rcrs@rivercityroofingsolutions.com" className="flex items-center gap-3 text-gray-400 hover:text-brand-green transition-colors">
                <Mail size={18} />
                <span className="text-sm">rcrs@rivercityroofingsolutions.com</span>
              </a>
              <div className="flex items-start gap-3 text-gray-400">
                <MapPin size={18} className="mt-0.5" />
                <span>3325 Central Pkwy SW<br />Decatur, AL 35603</span>
              </div>
              <div className="flex items-center gap-3 text-gray-400">
                <Clock size={18} />
                <span>24/7 Emergency Service</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Services</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/services/residential-roof-replacement" className="text-gray-400 hover:text-brand-green transition-colors text-sm">
                  Residential Roofing
                </Link>
              </li>
              <li>
                <Link href="/services/commercial-roofing" className="text-gray-400 hover:text-brand-green transition-colors text-sm">
                  Commercial Roofing
                </Link>
              </li>
              <li>
                <Link href="/services/storm-hail-damage-repair" className="text-gray-400 hover:text-brand-green transition-colors text-sm">
                  Storm Damage
                </Link>
              </li>
              <li>
                <Link href="/services/leafx-gutter-protection" className="text-gray-400 hover:text-brand-green transition-colors text-sm">
                  Gutters & LeafX
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-400 hover:text-brand-green transition-colors text-sm">
                  Free Inspection
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Information</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-gray-400 hover:text-brand-green transition-colors text-sm">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/about#team" className="text-gray-400 hover:text-brand-green transition-colors text-sm">
                  Our Team
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-gray-400 hover:text-brand-green transition-colors text-sm">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/service-areas" className="text-gray-400 hover:text-brand-green transition-colors text-sm">
                  Service Areas
                </Link>
              </li>
              <li>
                <Link href="/referral-rewards" className="text-gray-400 hover:text-brand-green transition-colors text-sm">
                  Referral Rewards
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm text-center md:text-left">
              &copy; {currentYear} River City Roofing Solutions. All rights reserved.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Link href="/privacy" className="text-gray-500 hover:text-brand-green transition-colors">
                Privacy Policy
              </Link>
              <span className="text-gray-700">|</span>
              <Link href="/terms" className="text-gray-500 hover:text-brand-green transition-colors">
                Terms of Service
              </Link>
              <span className="text-gray-700">|</span>
              <Link href="/privacy#sms-terms" className="text-gray-500 hover:text-brand-green transition-colors">
                SMS Terms
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
