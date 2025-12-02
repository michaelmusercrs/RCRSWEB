'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Truck, BarChart3, Package, Loader2, Settings, ChevronRight,
  Shield, Clock, Users, ArrowRight, Sparkles
} from 'lucide-react';

export default function PortalLogin() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDriverLogin, setShowDriverLogin] = useState(false);

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

  const portalOptions = [
    {
      id: 'manager',
      title: 'Manager Dashboard',
      description: 'Orders, deliveries, analytics & team overview',
      icon: BarChart3,
      color: 'from-emerald-500 to-teal-600',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'hover:border-emerald-500/50',
      href: '/portal/manager',
    },
    {
      id: 'inventory',
      title: 'Inventory Management',
      description: 'Stock levels, weekly counts & restock requests',
      icon: Package,
      color: 'from-orange-500 to-amber-600',
      bgColor: 'bg-orange-500/10',
      borderColor: 'hover:border-orange-500/50',
      href: '/portal/inventory',
    },
    {
      id: 'admin',
      title: 'Admin Portal',
      description: 'Website content, blog, team & images',
      icon: Settings,
      color: 'from-violet-500 to-purple-600',
      bgColor: 'bg-violet-500/10',
      borderColor: 'hover:border-violet-500/50',
      href: '/portal/admin',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Animated Background Pattern */}
      <div className="fixed inset-0 opacity-30">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-brand-green to-emerald-600 p-0.5">
                  <div className="w-full h-full rounded-[10px] bg-neutral-900 flex items-center justify-center">
                    <Image
                      src="/logo-nobg.png"
                      alt="RCRS"
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                  </div>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">River City Roofing</h1>
                  <p className="text-sm text-neutral-400">Internal Portal</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-xs text-neutral-500">
                <Shield size={14} />
                <span>Secure Access</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-6xl mx-auto px-6 py-12">
          {/* Welcome Section */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-green/10 border border-brand-green/20 text-brand-green text-sm font-medium mb-6">
              <Sparkles size={16} />
              Team Portal
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Welcome Back
            </h2>
            <p className="text-lg text-neutral-400 max-w-xl mx-auto">
              Access your dashboard, manage inventory, or update website content.
            </p>
          </div>

          {/* Portal Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {portalOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  onClick={() => router.push(option.href)}
                  className={`group relative overflow-hidden rounded-2xl border border-white/5 ${option.borderColor} bg-white/[0.02] backdrop-blur-sm p-6 text-left transition-all duration-300 hover:bg-white/[0.05] hover:scale-[1.02] hover:shadow-2xl hover:shadow-black/20`}
                >
                  {/* Gradient Glow */}
                  <div className={`absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br ${option.color} rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500`} />

                  <div className="relative z-10">
                    <div className={`w-14 h-14 ${option.bgColor} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className={`bg-gradient-to-br ${option.color} bg-clip-text`} size={28} style={{ color: option.color.includes('emerald') ? '#10b981' : option.color.includes('orange') ? '#f97316' : '#8b5cf6' }} />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-brand-green transition-colors">
                      {option.title}
                    </h3>
                    <p className="text-sm text-neutral-400 mb-4 leading-relaxed">
                      {option.description}
                    </p>
                    <div className="flex items-center text-sm font-medium text-neutral-500 group-hover:text-brand-green transition-colors">
                      <span>Open</span>
                      <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Driver Login Section */}
          <div className="max-w-md mx-auto">
            {!showDriverLogin ? (
              <button
                onClick={() => setShowDriverLogin(true)}
                className="w-full group relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 p-6 text-left transition-all duration-300 hover:border-blue-500/40 hover:shadow-2xl hover:shadow-blue-500/10"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Truck className="text-blue-500" size={28} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                        Driver Portal
                      </h3>
                      <p className="text-sm text-neutral-400">
                        Enter your PIN to access deliveries
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="text-neutral-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" size={24} />
                </div>
              </button>
            ) : (
              <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 backdrop-blur-sm p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                    <Truck className="text-blue-400" size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Driver Login</h2>
                    <p className="text-sm text-neutral-400">Enter your 4-digit PIN</p>
                  </div>
                </div>

                {/* PIN Display */}
                <div className="flex justify-center gap-4 mb-8">
                  {[0, 1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={`w-16 h-16 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all duration-200 ${
                        pin.length > i
                          ? 'bg-gradient-to-br from-blue-500 to-cyan-500 border-transparent text-white shadow-lg shadow-blue-500/25'
                          : 'bg-neutral-800/50 border-neutral-700 text-neutral-500'
                      }`}
                    >
                      {pin.length > i ? (
                        <div className="w-3 h-3 rounded-full bg-white" />
                      ) : (
                        <div className="w-3 h-3 rounded-full bg-neutral-600" />
                      )}
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center py-3 px-4 rounded-xl mb-6">
                    {error}
                  </div>
                )}

                {/* Number Pad */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'cancel', '0', 'back'].map((key, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (key === 'back') handleBackspace();
                        else if (key === 'cancel') {
                          setShowDriverLogin(false);
                          setPin('');
                          setError('');
                        }
                        else if (key) handlePinInput(key);
                      }}
                      className={`h-16 rounded-xl font-semibold text-xl transition-all duration-150 ${
                        key === 'cancel'
                          ? 'bg-neutral-800/50 text-neutral-400 hover:bg-neutral-700/50 text-sm'
                          : key === 'back'
                          ? 'bg-neutral-800/50 text-neutral-300 hover:bg-neutral-700/50'
                          : 'bg-neutral-800/80 text-white hover:bg-neutral-700 hover:scale-105 active:scale-95'
                      }`}
                    >
                      {key === 'back' ? '⌫' : key === 'cancel' ? 'Cancel' : key}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleDriverLogin}
                  disabled={pin.length !== 4 || isLoading}
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:from-neutral-700 disabled:to-neutral-700 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 disabled:shadow-none"
                >
                  {isLoading && <Loader2 className="animate-spin" size={20} />}
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </button>
              </div>
            )}
          </div>

          {/* Footer Stats */}
          <div className="mt-16 grid grid-cols-3 gap-6 max-w-2xl mx-auto">
            {[
              { icon: Users, label: 'Team Members', value: '16+' },
              { icon: Package, label: 'Products Tracked', value: '100+' },
              { icon: Clock, label: 'Uptime', value: '99.9%' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white/5 mb-2">
                  <stat.icon size={18} className="text-neutral-400" />
                </div>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-neutral-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/5 mt-12">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-neutral-500">
              <p>&copy; 2024 River City Roofing Solutions</p>
              <p>Internal use only</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
