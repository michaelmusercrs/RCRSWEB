'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Mail, Lock, User, Building2 } from 'lucide-react';

export default function CustomerPortalLogin() {
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/customer/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: loginMethod,
          email: loginMethod === 'email' ? email : undefined,
          phone: loginMethod === 'phone' ? phone : undefined,
          accessCode: loginMethod === 'code' ? accessCode : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        sessionStorage.setItem('customerSession', JSON.stringify(data.customer));
        router.push('/customer/dashboard');
      } else {
        setError(data.error || 'Unable to find your account. Please contact us at 256-274-8530.');
      }
    } catch {
      setError('Connection error. Please try again or call us at 256-274-8530.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="bg-black border-b border-brand-green/20 py-4">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8 text-brand-green" />
            <div>
              <h1 className="text-xl font-bold text-white">River City Roofing</h1>
              <p className="text-xs text-gray-400">Customer Portal</p>
            </div>
          </div>
          <a
            href="tel:256-274-8530"
            className="flex items-center gap-2 text-brand-green hover:text-white transition-colors"
          >
            <Phone className="w-4 h-4" />
            <span className="hidden sm:inline">256-274-8530</span>
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-neutral-900 rounded-2xl border border-brand-green/30 p-8 shadow-2xl shadow-brand-green/10">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-brand-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-brand-green" />
              </div>
              <h2 className="text-2xl font-bold text-white">Welcome Back</h2>
              <p className="text-gray-400 mt-2">
                Access your project status, appointments, and more
              </p>
            </div>

            {/* Login Method Tabs */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setLoginMethod('email')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  loginMethod === 'email'
                    ? 'bg-brand-green text-black'
                    : 'bg-neutral-800 text-gray-400 hover:text-white'
                }`}
              >
                <Mail className="w-4 h-4 inline mr-1" />
                Email
              </button>
              <button
                onClick={() => setLoginMethod('phone')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  loginMethod === 'phone'
                    ? 'bg-brand-green text-black'
                    : 'bg-neutral-800 text-gray-400 hover:text-white'
                }`}
              >
                <Phone className="w-4 h-4 inline mr-1" />
                Phone
              </button>
              <button
                onClick={() => setLoginMethod('code')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  loginMethod === 'code'
                    ? 'bg-brand-green text-black'
                    : 'bg-neutral-800 text-gray-400 hover:text-white'
                }`}
              >
                <Lock className="w-4 h-4 inline mr-1" />
                Code
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {loginMethod === 'email' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-gray-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                    required
                  />
                </div>
              )}

              {loginMethod === 'phone' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="256-555-1234"
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-gray-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                    required
                  />
                </div>
              )}

              {loginMethod === 'code' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Access Code
                  </label>
                  <input
                    type="text"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    placeholder="Enter your access code"
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-gray-500 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all tracking-widest text-center font-mono"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Your access code was provided in your welcome email or text
                  </p>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-brand-green text-black font-bold rounded-lg hover:bg-brand-green/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Signing In...' : 'Access My Portal'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-neutral-800 text-center">
              <p className="text-gray-400 text-sm">
                Need help? Call us at{' '}
                <a href="tel:256-274-8530" className="text-brand-green hover:underline">
                  256-274-8530
                </a>
              </p>
            </div>
          </div>

          {/* Features Preview */}
          <div className="mt-8 grid grid-cols-2 gap-4 text-center">
            <div className="bg-neutral-900/50 rounded-lg p-4 border border-neutral-800">
              <div className="text-brand-green font-bold text-lg">Track Progress</div>
              <p className="text-gray-500 text-sm">Real-time job status</p>
            </div>
            <div className="bg-neutral-900/50 rounded-lg p-4 border border-neutral-800">
              <div className="text-brand-green font-bold text-lg">Appointments</div>
              <p className="text-gray-500 text-sm">View & manage schedule</p>
            </div>
            <div className="bg-neutral-900/50 rounded-lg p-4 border border-neutral-800">
              <div className="text-brand-green font-bold text-lg">Weather</div>
              <p className="text-gray-500 text-sm">Project weather updates</p>
            </div>
            <div className="bg-neutral-900/50 rounded-lg p-4 border border-neutral-800">
              <div className="text-brand-green font-bold text-lg">Messages</div>
              <p className="text-gray-500 text-sm">Direct communication</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-black border-t border-neutral-800 py-4 text-center text-gray-500 text-sm">
        <p>River City Roofing Solutions - Hartselle, AL</p>
        <p className="mt-1">Family-Owned Since 2018</p>
      </footer>
    </div>
  );
}
