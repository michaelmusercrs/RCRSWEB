'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Truck, BarChart3, Package, Loader2 } from 'lucide-react';

export default function PortalLogin() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDriverLogin = async () => {
    if (pin.length !== 4) {
      setError('Please enter your 4-digit PIN');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/portal/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = await response.json();

      if (data.success) {
        // Store driver info in sessionStorage
        sessionStorage.setItem('driver', JSON.stringify(data.driver));
        router.push('/portal/driver');
      } else {
        setError('Invalid PIN. Please try again.');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinInput = (digit: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      {/* Header */}
      <div className="bg-brand-green p-4 text-center">
        <h1 className="text-xl font-bold text-black">River City Roofing</h1>
        <p className="text-sm text-black/70">Delivery & Warehouse Portal</p>
      </div>

      <div className="flex-1 p-4 flex flex-col justify-center max-w-md mx-auto w-full">
        {/* Portal Selection */}
        <div className="grid gap-4 mb-8">
          <button
            onClick={() => router.push('/portal/manager')}
            className="flex items-center gap-4 bg-neutral-800 border border-neutral-700 rounded-xl p-4 hover:border-brand-green transition-colors"
          >
            <div className="w-12 h-12 bg-brand-green/20 rounded-lg flex items-center justify-center">
              <BarChart3 className="text-brand-green" size={24} />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-white">Manager Dashboard</h3>
              <p className="text-sm text-neutral-400">Orders, analytics, inventory</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/portal/inventory')}
            className="flex items-center gap-4 bg-neutral-800 border border-neutral-700 rounded-xl p-4 hover:border-brand-green transition-colors"
          >
            <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <Package className="text-orange-500" size={24} />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-white">Inventory Count</h3>
              <p className="text-sm text-neutral-400">Weekly count & restock</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/portal/admin')}
            className="flex items-center gap-4 bg-neutral-800 border border-neutral-700 rounded-xl p-4 hover:border-purple-500 transition-colors"
          >
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <svg className="text-purple-500 w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-white">Admin Portal</h3>
              <p className="text-sm text-neutral-400">Blog, team, images, settings</p>
            </div>
          </button>
        </div>

        {/* Driver Login */}
        <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Truck className="text-blue-500" size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-white">Driver Login</h2>
              <p className="text-sm text-neutral-400">Enter your 4-digit PIN</p>
            </div>
          </div>

          {/* PIN Display */}
          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-14 h-14 rounded-lg border-2 flex items-center justify-center text-2xl font-bold ${
                  pin.length > i
                    ? 'bg-brand-green border-brand-green text-black'
                    : 'bg-neutral-700 border-neutral-600 text-white'
                }`}
              >
                {pin.length > i ? '*' : ''}
              </div>
            ))}
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center mb-4">{error}</div>
          )}

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map((key, i) => (
              <button
                key={i}
                onClick={() => {
                  if (key === 'back') handleBackspace();
                  else if (key) handlePinInput(key);
                }}
                disabled={!key}
                className={`h-14 rounded-lg font-bold text-xl ${
                  key === ''
                    ? 'invisible'
                    : key === 'back'
                    ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                    : 'bg-neutral-700 text-white hover:bg-neutral-600'
                }`}
              >
                {key === 'back' ? '←' : key}
              </button>
            ))}
          </div>

          <button
            onClick={handleDriverLogin}
            disabled={pin.length !== 4 || isLoading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="animate-spin" size={20} />}
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </div>
      </div>
    </div>
  );
}
