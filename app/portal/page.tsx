'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Truck, Loader2, ChevronRight, Shield, ArrowRight,
  User, Mail, AlertCircle
} from 'lucide-react';
import { useAuth, ROLE_DEFAULT_ROUTES } from '@/lib/auth-context';
import { TEAM_MEMBERS, TeamRole } from '@/lib/team-roles';
import RoleTrainingPopup from '@/components/RoleTrainingPopup';

type LoginMode = 'select' | 'driver' | 'staff';

export default function PortalLogin() {
  const router = useRouter();
  const { user, isLoading: authLoading, login, loginWithPin } = useAuth();
  const [loginMode, setLoginMode] = useState<LoginMode>('select');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTraining, setShowTraining] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<{ name: string; role: TeamRole } | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push(ROLE_DEFAULT_ROUTES[user.role]);
    }
  }, [user, authLoading, router]);

  // Check if user has completed training for their role
  const hasCompletedTraining = (role: TeamRole): boolean => {
    try {
      const trainingCompleted = sessionStorage.getItem(`training_completed_${role}`);
      return trainingCompleted === 'true';
    } catch {
      return false;
    }
  };

  // Mark training as completed for a role
  const markTrainingCompleted = (role: TeamRole) => {
    try {
      sessionStorage.setItem(`training_completed_${role}`, 'true');
    } catch {
      // Ignore storage errors
    }
  };

  // Handle training completion
  const handleTrainingComplete = () => {
    if (loggedInUser) {
      markTrainingCompleted(loggedInUser.role);
    }
    setShowTraining(false);
    if (pendingRedirect) {
      router.push(pendingRedirect);
    }
  };

  // Handle training skip
  const handleTrainingSkip = () => {
    if (loggedInUser) {
      markTrainingCompleted(loggedInUser.role);
    }
    setShowTraining(false);
    if (pendingRedirect) {
      router.push(pendingRedirect);
    }
  };

  const handleDriverLogin = async () => {
    if (pin.length !== 4) {
      setError('Please enter your 4-digit PIN');
      return;
    }

    setIsLoading(true);
    setError('');

    const result = await loginWithPin(pin);

    if (result.success) {
      // Find the driver
      const driver = TEAM_MEMBERS.find(m => m.role === 'driver' && m.pin === pin);
      if (driver) {
        // Check if training needed
        if (!hasCompletedTraining('driver')) {
          setLoggedInUser({ name: driver.name, role: 'driver' });
          setPendingRedirect('/portal/driver');
          setShowTraining(true);
          setIsLoading(false);
          return;
        }
      }
      router.push('/portal/driver');
    } else {
      setError(result.error || 'Invalid PIN');
    }

    setIsLoading(false);
  };

  const handleStaffLogin = async () => {
    if (!email) {
      setError('Please enter your email');
      return;
    }

    setIsLoading(true);
    setError('');

    const result = await login(email);

    if (result.success) {
      // Get user role to determine redirect
      const member = TEAM_MEMBERS.find(m => m.email.toLowerCase() === email.toLowerCase());
      if (member) {
        const redirectUrl = ROLE_DEFAULT_ROUTES[member.role];
        // Check if training needed
        if (!hasCompletedTraining(member.role)) {
          setLoggedInUser({ name: member.name, role: member.role });
          setPendingRedirect(redirectUrl);
          setShowTraining(true);
          setIsLoading(false);
          return;
        }
        router.push(redirectUrl);
      }
    } else {
      setError(result.error || 'Login failed');
    }

    setIsLoading(false);
  };

  const handlePinInput = (digit: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  // Show training popup if needed
  if (showTraining && loggedInUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
        <RoleTrainingPopup
          role={loggedInUser.role}
          userName={loggedInUser.name}
          onComplete={handleTrainingComplete}
          onSkip={handleTrainingSkip}
        />
      </div>
    );
  }

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-green" size={48} />
      </div>
    );
  }

  // Already logged in - will redirect
  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-brand-green mx-auto mb-4" size={48} />
          <p className="text-neutral-400">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  // Role Selection Screen
  if (loginMode === 'select') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
        <div className="fixed inset-0 opacity-30">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
            backgroundSize: '50px 50px'
          }} />
        </div>

        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-md">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="relative w-20 h-20 mx-auto rounded-2xl overflow-hidden bg-gradient-to-br from-brand-green to-emerald-600 p-0.5 mb-4">
                <div className="w-full h-full rounded-[14px] bg-neutral-900 flex items-center justify-center">
                  <Image
                    src="/logo-nobg.png"
                    alt="RCRS"
                    width={48}
                    height={48}
                    className="object-contain"
                  />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">River City Roofing</h1>
              <p className="text-neutral-400">Internal Team Portal</p>
            </div>

            {/* Login Options */}
            <div className="space-y-4">
              <button
                onClick={() => setLoginMode('staff')}
                className="w-full group relative overflow-hidden rounded-2xl border border-brand-green/20 bg-gradient-to-br from-brand-green/5 to-emerald-500/5 p-6 text-left transition-all duration-300 hover:border-brand-green/40 hover:shadow-2xl hover:shadow-brand-green/10"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-brand-green/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <User className="text-brand-green" size={28} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white group-hover:text-brand-green transition-colors">
                        Staff Login
                      </h3>
                      <p className="text-sm text-neutral-400">
                        Admin, Office, or Project Manager
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="text-neutral-500 group-hover:text-brand-green group-hover:translate-x-1 transition-all" size={24} />
                </div>
              </button>

              <button
                onClick={() => setLoginMode('driver')}
                className="w-full group relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 p-6 text-left transition-all duration-300 hover:border-blue-500/40 hover:shadow-2xl hover:shadow-blue-500/10"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Truck className="text-blue-500" size={28} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                        Driver Portal
                      </h3>
                      <p className="text-sm text-neutral-400">
                        Enter your 4-digit PIN
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="text-neutral-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" size={24} />
                </div>
              </button>
            </div>

            <div className="mt-8 text-center">
              <div className="flex items-center justify-center gap-2 text-xs text-neutral-500">
                <Shield size={14} />
                <span>Secure Access - Internal Use Only</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Staff Login Screen
  if (loginMode === 'staff') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
        <div className="fixed inset-0 opacity-30">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
            backgroundSize: '50px 50px'
          }} />
        </div>

        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="rounded-2xl border border-brand-green/20 bg-gradient-to-br from-brand-green/5 to-emerald-500/5 backdrop-blur-sm p-8">
              <div className="flex items-center gap-3 mb-8">
                <button
                  onClick={() => {
                    setLoginMode('select');
                    setEmail('');
                    setError('');
                  }}
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowRight className="rotate-180 text-neutral-400" size={18} />
                </button>
                <div>
                  <h2 className="text-xl font-semibold text-white">Staff Login</h2>
                  <p className="text-sm text-neutral-400">Enter your email to continue</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleStaffLogin()}
                      placeholder="your.name@rivercityroofingsolutions.com"
                      className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 focus:ring-2 focus:ring-brand-green/20"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm py-3 px-4 rounded-xl mb-6 flex items-center gap-2">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <button
                onClick={handleStaffLogin}
                disabled={!email || isLoading}
                className="w-full bg-gradient-to-r from-brand-green to-emerald-500 hover:from-brand-green/90 hover:to-emerald-500/90 disabled:from-neutral-700 disabled:to-neutral-700 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-brand-green/25 disabled:shadow-none"
              >
                {isLoading && <Loader2 className="animate-spin" size={20} />}
                {isLoading ? 'Signing In...' : 'Continue'}
              </button>

              {/* Quick access for team */}
              <div className="mt-6 pt-6 border-t border-white/5">
                <p className="text-xs text-neutral-500 text-center mb-3">Quick Login</p>
                <div className="grid grid-cols-3 gap-2">
                  {TEAM_MEMBERS.filter(m => m.role !== 'driver' && m.isActive).slice(0, 6).map(member => (
                    <button
                      key={member.id}
                      onClick={() => setEmail(member.email)}
                      className="px-3 py-2 bg-neutral-800/50 rounded-lg text-sm text-neutral-400 hover:text-white hover:bg-neutral-700/50 transition-colors truncate"
                    >
                      {member.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Driver Login Screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <div className="fixed inset-0 opacity-30">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 backdrop-blur-sm p-8">
            <div className="flex items-center gap-3 mb-8">
              <button
                onClick={() => {
                  setLoginMode('select');
                  setPin('');
                  setError('');
                }}
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <ArrowRight className="rotate-180 text-neutral-400" size={18} />
              </button>
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
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center py-3 px-4 rounded-xl mb-6 flex items-center justify-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {/* Number Pad */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map((key, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (key === 'back') handleBackspace();
                    else if (key) handlePinInput(key);
                  }}
                  disabled={key === ''}
                  className={`h-16 rounded-xl font-semibold text-xl transition-all duration-150 ${
                    key === ''
                      ? 'bg-transparent cursor-default'
                      : key === 'back'
                      ? 'bg-neutral-800/50 text-neutral-300 hover:bg-neutral-700/50'
                      : 'bg-neutral-800/80 text-white hover:bg-neutral-700 hover:scale-105 active:scale-95'
                  }`}
                >
                  {key === 'back' ? '⌫' : key}
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
        </div>
      </div>
    </div>
  );
}
