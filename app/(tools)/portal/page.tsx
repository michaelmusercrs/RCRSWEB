'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Truck, Loader2, ChevronRight, Shield, ArrowRight,
  User, Mail, AlertCircle, Eye, EyeOff, Phone, Lock
} from 'lucide-react';
import { useAuth, ROLE_DEFAULT_ROUTES } from '@/lib/auth-context';
import { TEAM_MEMBERS, TeamRole } from '@/lib/team-roles';
import RoleTrainingPopup from '@/components/RoleTrainingPopup';
import FeatureUpdatesPopup from '@/components/FeatureUpdatesPopup';

type LoginMode = 'select' | 'driver' | 'staff';
type ForgotMode = 'none' | 'form' | 'sent';

// ──────────────────────────────────────────────
// Ambient Background — animates once, freezes
// ──────────────────────────────────────────────
function AmbientBackground() {
  const [skipAnimation, setSkipAnimation] = useState(false);

  useEffect(() => {
    // Skip animation on slow devices or if user prefers reduced motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isSlowDevice =
      (navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 2) ||
      ('connection' in navigator && (navigator as any).connection?.saveData);
    if (prefersReduced || isSlowDevice) setSkipAnimation(true);
  }, []);

  const finalState = skipAnimation ? ' bg-settled' : '';

  return (
    <div className={`fixed inset-0 overflow-hidden pointer-events-none${finalState}`}>
      {/* Base gradient — subtle warm-to-cool diagonal */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, rgba(10,10,12,1) 0%, rgba(8,10,14,1) 40%, rgba(6,8,12,1) 100%)',
        }}
      />

      {/* Fine grid lines — fade in once via CSS */}
      <div
        className={skipAnimation ? 'absolute inset-0 opacity-[0.04]' : 'absolute inset-0 animate-bg-grid-in'}
        style={{
          backgroundImage: `
            linear-gradient(rgba(57,255,20,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(57,255,20,0.07) 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
        }}
      />

      {/* Diagonal accent line — sweeps once then stays */}
      <div
        className={skipAnimation ? 'absolute inset-0 opacity-100' : 'absolute inset-0 animate-bg-sweep'}
      >
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, transparent 0%, transparent 42%, rgba(57,255,20,0.03) 48%, rgba(57,255,20,0.05) 50%, rgba(57,255,20,0.03) 52%, transparent 58%, transparent 100%)',
          }}
        />
      </div>

      {/* Corner glow — top left, fades in once */}
      <div
        className={skipAnimation ? 'absolute inset-0 opacity-100' : 'absolute inset-0 animate-bg-glow-in'}
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 15% 20%, rgba(57,255,20,0.025) 0%, transparent 70%)',
        }}
      />

      {/* Vignette — always present */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 0%, rgba(0,0,0,0.5) 100%)',
        }}
      />
    </div>
  );
}

// ──────────────────────────────────────────────
// Architectural Shingle Splash Screen
// ──────────────────────────────────────────────
const SHINGLE_COLS = 16;
const SHINGLE_ROWS = 10;

function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState(0);
  // phase 0: black screen
  // phase 1: shingles ripple in diagonally
  // phase 2: brand glows through center
  // phase 3: everything fades out

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 80),
      setTimeout(() => setPhase(2), 1350),
      setTimeout(() => setPhase(3), 2350),
      setTimeout(() => onComplete(), 2800),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  // Pre-generate random shade variations for realistic shingle texture
  const shingleShades = useRef(
    Array.from({ length: SHINGLE_ROWS * (SHINGLE_COLS + 1) }, () => ({
      base: Math.floor(Math.random() * 10),
      tab: Math.floor(Math.random() * 4),
      grain: Math.random() * 0.02,
    }))
  ).current;

  // Build shingle background gradient with architectural tab lines
  const getShingleStyle = (idx: number, delay: number): React.CSSProperties => {
    const s = shingleShades[idx];
    const b = 16 + s.base;
    return {
      width: '100%',
      height: '100%',
      borderRadius: '1px',
      animation: phase >= 1
        ? `shingle-flip-in 0.48s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s both`
        : 'none',
      background: `linear-gradient(178deg,
        rgba(255,255,255,${0.03 + s.grain}) 0%,
        rgb(${b + 10}, ${b + 10}, ${b + 12}) 2%,
        rgb(${b + 2}, ${b + 2}, ${b + 4}) 33%,
        rgb(${b + 5 + s.tab}, ${b + 5 + s.tab}, ${b + 7 + s.tab}) 34%,
        rgb(${b - 1}, ${b - 1}, ${b + 1}) 62%,
        rgb(${b + 3 + s.tab}, ${b + 3 + s.tab}, ${b + 5 + s.tab}) 63%,
        rgb(${b - 3}, ${b - 3}, ${b - 1}) 100%)`,
      boxShadow: `
        inset 0 1px 0 rgba(255,255,255,0.03),
        inset 0 -2px 0 rgba(0,0,0,0.35),
        0 2px 4px rgba(0,0,0,0.25)`,
    };
  };

  return (
    <div
      className={`fixed inset-0 z-50 bg-black overflow-hidden transition-opacity duration-400 ${
        phase >= 3 ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* ── Shingle Grid with 3D Perspective ── */}
      <div
        className="absolute inset-0"
        style={{ perspective: '1200px', perspectiveOrigin: '50% 30%' }}
      >
        {Array.from({ length: SHINGLE_ROWS }, (_, row) => {
          const isOffset = row % 2 === 1;
          return (
            <div
              key={row}
              className="flex"
              style={{
                height: `${100 / SHINGLE_ROWS}vh`,
                marginLeft: isOffset ? `${-50 / SHINGLE_COLS}vw` : '0',
              }}
            >
              {Array.from({ length: SHINGLE_COLS + 1 }, (_, col) => {
                const idx = row * (SHINGLE_COLS + 1) + col;
                const effectiveCol = col + (isOffset ? 0.5 : 0);
                const nx = effectiveCol / SHINGLE_COLS;
                const ny = row / SHINGLE_ROWS;
                // Diagonal ripple: flows top-left → bottom-right
                const delay = (nx * 0.35 + ny * 0.65) * 1.05;

                return (
                  <div
                    key={col}
                    style={{
                      width: `${100 / SHINGLE_COLS}vw`,
                      height: '100%',
                      padding: '0.5px',
                      transformStyle: 'preserve-3d' as React.CSSProperties['transformStyle'],
                    }}
                  >
                    <div style={getShingleStyle(idx, delay)} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Subtle ambient roof light ── */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-[1200ms] ${
          phase >= 1 ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 45%, rgba(57,255,20,0.03) 0%, transparent 70%)',
        }}
      />

      {/* ── Center Brand Reveal ── */}
      <div
        className="absolute inset-0 flex items-center justify-center z-10"
        style={{
          opacity: phase >= 2 ? 1 : 0,
          transform: phase >= 2 ? 'scale(1)' : 'scale(0.8)',
          transition: 'opacity 0.6s ease-out, transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Pulsing glow backdrop */}
        <div
          className="absolute w-[26rem] h-[26rem] sm:w-[32rem] sm:h-[32rem] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(57,255,20,0.1) 0%, rgba(57,255,20,0.03) 45%, transparent 65%)',
            filter: 'blur(50px)',
            animation: phase >= 2 ? 'brand-glow-pulse 2s ease-in-out infinite' : 'none',
          }}
        />

        <div className="relative flex flex-col items-center">
          {/* Logo container */}
          <div
            className="w-24 h-24 sm:w-28 sm:h-28 mb-5 rounded-2xl border border-brand-green/25 p-0.5 shadow-2xl shadow-brand-green/20"
            style={{ background: 'linear-gradient(135deg, rgba(57,255,20,0.15), rgba(16,185,129,0.08))' }}
          >
            <div className="w-full h-full rounded-[14px] bg-black/90 backdrop-blur-sm flex items-center justify-center">
              <Image
                src="/logo-nobg.png"
                alt="RCRS"
                width={72}
                height={72}
                className="object-contain drop-shadow-[0_0_20px_rgba(57,255,20,0.4)]"
                priority
              />
            </div>
          </div>

          {/* RoofStack */}
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">
            <span
              className="text-brand-green"
              style={{ textShadow: '0 0 30px rgba(57,255,20,0.5), 0 0 60px rgba(57,255,20,0.2)' }}
            >
              Roof
            </span>
            <span
              className="text-white"
              style={{ textShadow: '0 0 20px rgba(255,255,255,0.15)' }}
            >
              Stack
            </span>
          </h1>

          {/* Tagline */}
          <p className="text-neutral-500 text-sm sm:text-base tracking-[0.2em] uppercase">
            Everything Under One Roof
          </p>

          {/* Loading accent bar */}
          <div className="mt-8 w-40 h-[2px] bg-neutral-800/50 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ease-out ${
                phase >= 2 ? 'w-full duration-[900ms]' : 'w-0 duration-100'
              }`}
              style={{
                background: 'linear-gradient(90deg, #39FF14, #10b981)',
                boxShadow: '0 0 8px rgba(57,255,20,0.4)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
export default function PortalLogin() {
  const router = useRouter();
  const { user, isLoading: authLoading, login, loginWithPin } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [loginMode, setLoginMode] = useState<LoginMode>('staff');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState<ForgotMode>('none');
  const [showTraining, setShowTraining] = useState(false);
  const [showFeatureUpdates, setShowFeatureUpdates] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<{ name: string; role: TeamRole } | null>(null);
  const [contentVisible, setContentVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<{ role: string; label: string; route: string; icon: string }[]>([]);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
    // Let the DOM settle, then trigger the login pop-in animation
    setTimeout(() => setContentVisible(true), 150);
  }, []);

  // Load remembered email on mount
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('rcrs_remember_email');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch { /* ignore */ }
  }, []);

  // Check if splash has been seen this session
  useEffect(() => {
    try {
      const seen = sessionStorage.getItem('rcrs_splash_seen');
      if (seen === 'true') {
        setShowSplash(false);
        setContentVisible(true);
      }
    } catch { /* ignore */ }
  }, []);

  // Mark splash as seen
  useEffect(() => {
    if (!showSplash) {
      try {
        sessionStorage.setItem('rcrs_splash_seen', 'true');
      } catch { /* ignore */ }
    }
  }, [showSplash]);

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
    } catch { /* ignore */ }
  };

  const handleTrainingComplete = () => {
    if (loggedInUser) markTrainingCompleted(loggedInUser.role);
    setShowTraining(false);
    setShowFeatureUpdates(true);
  };

  const handleTrainingSkip = () => {
    if (loggedInUser) markTrainingCompleted(loggedInUser.role);
    setShowTraining(false);
    setShowFeatureUpdates(true);
  };

  const handleFeatureUpdatesClose = () => {
    setShowFeatureUpdates(false);
    if (pendingRedirect) router.push(pendingRedirect);
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
      const member = TEAM_MEMBERS.find(m => m.pin === pin);
      if (member) {
        router.push(ROLE_DEFAULT_ROUTES[member.role]);
      } else {
        router.push('/portal/driver');
      }
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

    const result = await login(email, password);

    if (result.success) {
      // Save or clear remember me
      try {
        if (rememberMe) {
          localStorage.setItem('rcrs_remember_email', email);
        } else {
          localStorage.removeItem('rcrs_remember_email');
        }
      } catch { /* ignore */ }

      // Log login event to Google Sheets audit log
      try {
        fetch('/api/portal/audit-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'LOGIN',
            userEmail: email,
            details: `Login from ${navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop'}`,
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => {});
      } catch { /* non-blocking */ }

      // MUST change password on first login - no exceptions
      if (result.mustChangePassword) {
        router.push('/portal/change-password');
        setIsLoading(false);
        return;
      }

      const member = TEAM_MEMBERS.find(m => m.email.toLowerCase() === email.toLowerCase());
      if (member) {
        const onboardingComplete = localStorage.getItem(`onboarding_complete_${member.id}`) === 'true';
        if (!onboardingComplete) {
          router.push('/portal/welcome');
          setIsLoading(false);
          return;
        }

        // Check if user has multiple role capabilities (e.g., Rick = sales + driver)
        // Check admin overrides for additional roles
        const dualRoleUsers: Record<string, { role: string; label: string; route: string; icon: string }[]> = {
          'rick@rcrsal.com': [
            { role: 'sales', label: 'Sales Portal', route: '/portal/sales', icon: '💰' },
            { role: 'driver', label: 'Delivery & Inventory', route: '/portal/driver', icon: '🚛' },
          ],
          'richard@rcrsal.com': [
            { role: 'driver', label: 'Delivery & Inventory', route: '/portal/driver', icon: '🚛' },
            { role: 'sales', label: 'Sales Portal', route: '/portal/sales', icon: '💰' },
          ],
        };

        const roles = dualRoleUsers[email.toLowerCase()];
        if (roles && roles.length > 1) {
          setAvailableRoles(roles);
          setShowRolePicker(true);
          setIsLoading(false);
          return;
        }

        router.push(ROLE_DEFAULT_ROUTES[member.role]);
      }
    } else {
      setError(result.error || 'Login failed');
    }

    setIsLoading(false);
  };

  const handlePinInput = (digit: string) => {
    if (pin.length < 4) setPin(prev => prev + digit);
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  // ── Role Picker (for dual-role users like Rick) ────────────────────────
  if (showRolePicker && availableRoles.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Image src="/logo-nobg.png" alt="RCRS" width={64} height={64} className="mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white">Where to?</h2>
            <p className="text-neutral-400 mt-1">Choose your workspace</p>
          </div>
          <div className="space-y-3">
            {availableRoles.map((r) => (
              <button
                key={r.role}
                onClick={() => router.push(r.route)}
                className="w-full flex items-center gap-4 p-5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-brand-green/40 rounded-2xl transition-all group"
              >
                <span className="text-3xl">{r.icon}</span>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-white group-hover:text-brand-green transition-colors">{r.label}</div>
                </div>
                <ChevronRight size={20} className="text-neutral-600 group-hover:text-brand-green transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Splash Screen ────────────────────────────
  if (showSplash && !authLoading && !user) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  // ── Feature Updates Popup ────────────────────
  if (showFeatureUpdates && loggedInUser) {
    return (
      <div className="min-h-screen bg-neutral-950">
        <FeatureUpdatesPopup
          role={loggedInUser.role}
          userName={loggedInUser.name}
          onClose={handleFeatureUpdatesClose}
          onViewTraining={() => {
            setShowFeatureUpdates(false);
            setShowTraining(true);
          }}
        />
      </div>
    );
  }

  // ── Training Popup ───────────────────────────
  if (showTraining && loggedInUser) {
    return (
      <div className="min-h-screen bg-neutral-950">
        <RoleTrainingPopup
          role={loggedInUser.role}
          userName={loggedInUser.name}
          onComplete={handleTrainingComplete}
          onSkip={handleTrainingSkip}
        />
      </div>
    );
  }

  // ── Auth Loading ─────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <AmbientBackground />
        <div className="relative z-10">
          <Loader2 className="animate-spin text-brand-green" size={48} />
        </div>
      </div>
    );
  }

  // ── Already Logged In (redirecting) ──────────
  if (user) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <AmbientBackground />
        <div className="relative z-10 text-center">
          <Loader2 className="animate-spin text-brand-green mx-auto mb-4" size={48} />
          <p className="text-neutral-400">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  // ── Forgot Password Modal Overlay ────────────
  const ForgotPasswordOverlay = () => {
    if (forgotMode === 'none') return null;

    return (
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
        <div className="w-full max-w-sm bg-neutral-900 border border-neutral-700/50 rounded-2xl p-8 shadow-2xl animate-scale-in">
          {forgotMode === 'form' ? (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-brand-green/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Lock className="text-brand-green" size={24} />
                </div>
                <h3 className="text-xl font-bold text-white mb-1">Reset Password</h3>
                <p className="text-sm text-neutral-400">
                  Contact your administrator to reset your password.
                </p>
              </div>

              <div className="bg-neutral-800/50 rounded-xl p-4 mb-6 flex items-center gap-3">
                <Phone className="text-brand-green flex-shrink-0" size={20} />
                <div>
                  <p className="text-xs text-neutral-400">Call or text</p>
                  <a href="tel:+12562748530" className="text-brand-green font-semibold text-lg hover:underline">
                    (256) 274-8530
                  </a>
                </div>
              </div>

              <div className="relative flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-neutral-700" />
                <span className="text-xs text-neutral-500 uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-neutral-700" />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-300 mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.name@rcrsal.com"
                  className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 focus:ring-2 focus:ring-brand-green/20 text-sm"
                />
              </div>

              <button
                onClick={() => setForgotMode('sent')}
                disabled={!email}
                className="w-full bg-gradient-to-r from-brand-green to-emerald-500 hover:from-brand-green/90 hover:to-emerald-500/90 disabled:from-neutral-700 disabled:to-neutral-700 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl transition-all duration-200 text-sm"
              >
                Send Reset Link
              </button>

              <button
                onClick={() => setForgotMode('none')}
                className="w-full mt-3 text-sm text-neutral-400 hover:text-white transition-colors py-2"
              >
                Back to Login
              </button>
            </>
          ) : (
            <>
              <div className="text-center">
                <div className="w-14 h-14 bg-brand-green/10 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-bounce-once">
                  <Mail className="text-brand-green" size={24} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Check Your Email</h3>
                <p className="text-sm text-neutral-400 mb-6">
                  If an account exists for <span className="text-white">{email}</span>, you will receive a reset link shortly.
                </p>
                <button
                  onClick={() => setForgotMode('none')}
                  className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                >
                  Back to Login
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // ── Role Selection Screen ────────────────────
  if (loginMode === 'select') {
    return (
      <div className="min-h-screen bg-neutral-950">
        <AmbientBackground />
        <ForgotPasswordOverlay />

        <div
          className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6"
          style={{
            animation: contentVisible ? 'login-pop-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both' : 'none',
            opacity: contentVisible ? undefined : 0,
          }}
        >
          <div className="w-full max-w-md">
            {/* Logo Header */}
            <div className="text-center mb-10">
              <div className="relative w-20 h-20 mx-auto mb-5">
                <div className="absolute inset-0 rounded-2xl bg-brand-green/20 blur-xl animate-glow-pulse" />
                <div className="relative w-full h-full rounded-2xl bg-gradient-to-br from-brand-green/20 to-emerald-600/10 border border-brand-green/30 p-0.5">
                  <div className="w-full h-full rounded-[14px] bg-neutral-950/90 flex items-center justify-center">
                    <Image
                      src="/logo-nobg.png"
                      alt="RCRS"
                      width={48}
                      height={48}
                      className="object-contain drop-shadow-[0_0_10px_rgba(57,255,20,0.3)]"
                    />
                  </div>
                </div>
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-1">
                <span className="text-brand-green" style={{ textShadow: '0 0 20px rgba(57,255,20,0.3)' }}>Roof</span>
                <span className="text-white">Stack</span>
              </h1>
              <p className="text-neutral-500 text-sm tracking-wider uppercase">Everything Under One Roof</p>
            </div>

            {/* Login Options */}
            <div className="space-y-4">
              <button
                onClick={() => { setLoginMode('staff'); setError(''); }}
                className="w-full group relative overflow-hidden rounded-2xl border border-brand-green/20 bg-neutral-900/50 backdrop-blur-sm p-6 text-left transition-all duration-300 hover:border-brand-green/40 hover:bg-neutral-900/80 hover:shadow-2xl hover:shadow-brand-green/10"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-brand-green/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-brand-green/10 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:bg-brand-green/20 transition-all duration-300">
                      <User className="text-brand-green" size={28} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white group-hover:text-brand-green transition-colors">
                        Staff Login
                      </h3>
                      <p className="text-sm text-neutral-400">Admin, Office, or Project Manager</p>
                    </div>
                  </div>
                  <ChevronRight className="text-neutral-600 group-hover:text-brand-green group-hover:translate-x-1 transition-all" size={24} />
                </div>
              </button>

              <button
                onClick={() => { setLoginMode('driver'); setError(''); }}
                className="w-full group relative overflow-hidden rounded-2xl border border-blue-500/20 bg-neutral-900/50 backdrop-blur-sm p-6 text-left transition-all duration-300 hover:border-blue-500/40 hover:bg-neutral-900/80 hover:shadow-2xl hover:shadow-blue-500/10"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-500/20 transition-all duration-300">
                      <Truck className="text-blue-400" size={28} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                        Logistics
                      </h3>
                      <p className="text-sm text-neutral-400">Enter your 4-digit PIN</p>
                    </div>
                  </div>
                  <ChevronRight className="text-neutral-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" size={24} />
                </div>
              </button>
            </div>

            <div className="mt-10 text-center">
              <div className="flex items-center justify-center gap-2 text-xs text-neutral-600">
                <Shield size={14} />
                <span>Secure Access &mdash; Internal Use Only</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Staff Login Screen ───────────────────────
  if (loginMode === 'staff') {
    return (
      <div className="min-h-screen bg-neutral-950">
        <AmbientBackground />
        <ForgotPasswordOverlay />

        <div
          className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6"
          style={{
            animation: contentVisible ? 'login-pop-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both' : 'none',
            opacity: contentVisible ? undefined : 0,
          }}
        >
          <div className="w-full max-w-md">
            {/* Logo + Brand */}
            <div className="text-center mb-8">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 rounded-xl bg-brand-green/20 blur-lg animate-glow-pulse" />
                <div className="relative w-full h-full rounded-xl bg-gradient-to-br from-brand-green/20 to-emerald-600/10 border border-brand-green/30 p-0.5">
                  <div className="w-full h-full rounded-[10px] bg-neutral-950/90 flex items-center justify-center">
                    <Image
                      src="/logo-nobg.png"
                      alt="RCRS"
                      width={40}
                      height={40}
                      className="object-contain drop-shadow-[0_0_10px_rgba(57,255,20,0.3)]"
                    />
                  </div>
                </div>
              </div>
              <h1 className="text-2xl font-bold tracking-tight mb-0.5">
                <span className="text-brand-green" style={{ textShadow: '0 0 15px rgba(57,255,20,0.3)' }}>Roof</span>
                <span className="text-white">Stack</span>
              </h1>
              <p className="text-neutral-500 text-xs tracking-wider uppercase">River City Roofing Solutions</p>
            </div>

            {/* Login Card */}
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 backdrop-blur-xl p-8 shadow-2xl">
              {/* Header with back button */}
              <div className="flex items-center gap-3 mb-7">
                <button
                  onClick={() => {
                    setLoginMode('select');
                    setEmail('');
                    setPassword('');
                    setError('');
                  }}
                  className="w-9 h-9 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center transition-colors group"
                >
                  <ArrowRight className="rotate-180 text-neutral-400 group-hover:text-white transition-colors" size={16} />
                </button>
                <div>
                  <h2 className="text-lg font-semibold text-white">Sign In</h2>
                  <p className="text-xs text-neutral-500">Enter your credentials to continue</p>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4 mb-5">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wider">Email</label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-brand-green transition-colors" size={18} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(''); }}
                      placeholder="your.name@rcrsal.com"
                      className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-neutral-600 focus:outline-none focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/20 transition-all text-sm"
                      autoComplete="email"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wider">Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-brand-green transition-colors" size={18} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleStaffLogin()}
                      placeholder="Enter your password"
                      className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-xl pl-11 pr-12 py-3.5 text-white placeholder-neutral-600 focus:outline-none focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/20 transition-all text-sm"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Remember me + Forgot password */}
              <div className="flex items-center justify-between mb-5">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-brand-green focus:ring-brand-green/50 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-xs text-neutral-500 group-hover:text-neutral-300 transition-colors">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => setForgotMode('form')}
                  className="text-xs text-neutral-500 hover:text-brand-green transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {/* Error message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm py-3 px-4 rounded-xl mb-5 flex items-center gap-2 animate-shake">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Sign In button */}
              <button
                onClick={handleStaffLogin}
                disabled={!email || !password || isLoading}
                className="w-full relative overflow-hidden bg-gradient-to-r from-brand-green to-emerald-500 hover:from-brand-green hover:to-emerald-400 disabled:from-neutral-700 disabled:to-neutral-700 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-brand-green/25 disabled:shadow-none group"
              >
                {/* Shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
                <span className="relative flex items-center gap-2">
                  {isLoading && <Loader2 className="animate-spin" size={18} />}
                  {isLoading ? 'Signing In...' : 'Sign In'}
                  {!isLoading && <ArrowRight size={18} />}
                </span>
              </button>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center space-y-2">
              <p className="text-xs text-neutral-600">
                River City Roofing Solutions
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-neutral-700">
                <Shield size={12} />
                <span>256-bit SSL Encrypted</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Driver Login Screen ──────────────────────
  return (
    <div className="min-h-screen bg-neutral-950">
      <AmbientBackground />

      <div
        className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6"
        style={{
          animation: contentVisible ? 'login-pop-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both' : 'none',
          opacity: contentVisible ? undefined : 0,
        }}
      >
        <div className="w-full max-w-md">
          {/* Logo + Brand */}
          <div className="text-center mb-6">
            <div className="relative w-14 h-14 mx-auto mb-3">
              <div className="relative w-full h-full rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/30 p-0.5">
                <div className="w-full h-full rounded-[10px] bg-neutral-950/90 flex items-center justify-center">
                  <Image
                    src="/logo-nobg.png"
                    alt="RCRS"
                    width={36}
                    height={36}
                    className="object-contain"
                  />
                </div>
              </div>
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-brand-green">Roof</span>
              <span className="text-white">Stack</span>
            </h1>
          </div>

          {/* PIN Card */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 backdrop-blur-xl p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-7">
              <button
                onClick={() => {
                  setLoginMode('select');
                  setPin('');
                  setError('');
                }}
                className="w-9 h-9 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center transition-colors group"
              >
                <ArrowRight className="rotate-180 text-neutral-400 group-hover:text-white transition-colors" size={16} />
              </button>
              <div>
                <h2 className="text-lg font-semibold text-white">Driver Login</h2>
                <p className="text-xs text-neutral-500">Enter your 4-digit PIN</p>
              </div>
            </div>

            {/* PIN Display */}
            <div className="flex justify-center gap-3 sm:gap-4 mb-7">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 flex items-center justify-center transition-all duration-200 ${
                    pin.length > i
                      ? 'bg-gradient-to-br from-blue-500 to-cyan-500 border-transparent shadow-lg shadow-blue-500/25 scale-105'
                      : pin.length === i
                      ? 'bg-neutral-800/50 border-blue-500/30 animate-pulse'
                      : 'bg-neutral-800/50 border-neutral-700/50'
                  }`}
                >
                  {pin.length > i ? (
                    <div className="w-3 h-3 rounded-full bg-white shadow-lg shadow-white/50" />
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
                  )}
                </div>
              ))}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center py-3 px-4 rounded-xl mb-5 flex items-center justify-center gap-2 animate-shake">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {/* Number Pad */}
            <div className="grid grid-cols-3 gap-2.5 mb-5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map((key, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (key === 'back') handleBackspace();
                    else if (key) handlePinInput(key);
                  }}
                  disabled={key === ''}
                  className={`h-14 rounded-xl font-semibold text-xl transition-all duration-150 ${
                    key === ''
                      ? 'bg-transparent cursor-default'
                      : key === 'back'
                      ? 'bg-neutral-800/50 text-neutral-400 hover:bg-neutral-700/50 hover:text-white active:scale-95'
                      : 'bg-neutral-800/80 text-white hover:bg-neutral-700 hover:scale-[1.03] active:scale-95'
                  }`}
                >
                  {key === 'back' ? '\u232b' : key}
                </button>
              ))}
            </div>

            <button
              onClick={handleDriverLogin}
              disabled={pin.length !== 4 || isLoading}
              className="w-full relative overflow-hidden bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 disabled:from-neutral-700 disabled:to-neutral-700 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 disabled:shadow-none group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
              <span className="relative flex items-center gap-2">
                {isLoading && <Loader2 className="animate-spin" size={18} />}
                {isLoading ? 'Signing In...' : 'Sign In'}
              </span>
            </button>
          </div>

          <div className="mt-8 text-center">
            <div className="flex items-center justify-center gap-2 text-xs text-neutral-700">
              <Shield size={12} />
              <span>Secure Access</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
