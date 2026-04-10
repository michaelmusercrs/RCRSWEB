'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Loader2, ChevronRight, Shield, ArrowRight,
  Mail, AlertCircle, Eye, EyeOff, Phone, Lock,
  Grid3X3, Fingerprint, ArrowLeft, Delete,
} from 'lucide-react';
import { useAuth, ROLE_DEFAULT_ROUTES } from '@/lib/auth-context';
import { TEAM_MEMBERS } from '@/lib/team-roles';
import SandboxBanner from '@/components/SandboxBanner';

type ForgotMode = 'none' | 'form' | 'sent';
type LoginStep = 'email' | 'password' | 'pin' | 'picture';

// ──────────────────────────────────────────────
// Architectural Shingle Splash Screen
// ──────────────────────────────────────────────
const SHINGLE_COLS = 16;
const SHINGLE_ROWS = 10;

function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 80),
      setTimeout(() => setPhase(2), 1350),
      setTimeout(() => setPhase(3), 2350),
      setTimeout(() => onComplete(), 2800),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  const shingleShades = useRef(
    Array.from({ length: SHINGLE_ROWS * (SHINGLE_COLS + 1) }, () => ({
      base: Math.floor(Math.random() * 10),
      tab: Math.floor(Math.random() * 4),
      grain: Math.random() * 0.02,
    }))
  ).current;

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
      <div className="absolute inset-0" style={{ perspective: '1200px', perspectiveOrigin: '50% 30%' }}>
        {Array.from({ length: SHINGLE_ROWS }, (_, row) => {
          const isOffset = row % 2 === 1;
          return (
            <div key={row} className="flex" style={{ height: `${100 / SHINGLE_ROWS}vh`, marginLeft: isOffset ? `${-50 / SHINGLE_COLS}vw` : '0' }}>
              {Array.from({ length: SHINGLE_COLS + 1 }, (_, col) => {
                const idx = row * (SHINGLE_COLS + 1) + col;
                const effectiveCol = col + (isOffset ? 0.5 : 0);
                const nx = effectiveCol / SHINGLE_COLS;
                const ny = row / SHINGLE_ROWS;
                const delay = (nx * 0.35 + ny * 0.65) * 1.05;
                return (
                  <div key={col} style={{ width: `${100 / SHINGLE_COLS}vw`, height: '100%', padding: '0.5px', transformStyle: 'preserve-3d' as any }}>
                    <div style={getShingleStyle(idx, delay)} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-1200 ${phase >= 1 ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 45%, rgba(57,255,20,0.03) 0%, transparent 70%)' }}
      />

      <div className="absolute inset-0 flex items-center justify-center z-10"
        style={{ opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? 'scale(1)' : 'scale(0.8)', transition: 'opacity 0.6s ease-out, transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
        <div className="absolute w-[26rem] h-[26rem] sm:w-[32rem] sm:h-[32rem] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(57,255,20,0.1) 0%, rgba(57,255,20,0.03) 45%, transparent 65%)', filter: 'blur(50px)', animation: phase >= 2 ? 'brand-glow-pulse 2s ease-in-out infinite' : 'none' }}
        />
        <div className="relative flex flex-col items-center">
          <div className="w-24 h-24 sm:w-28 sm:h-28 mb-5 rounded-2xl border border-brand-green/25 p-0.5 shadow-2xl shadow-brand-green/20"
            style={{ background: 'linear-gradient(135deg, rgba(57,255,20,0.15), rgba(16,185,129,0.08))' }}
          >
            <div className="w-full h-full rounded-[14px] bg-black/90 backdrop-blur-sm flex items-center justify-center">
              <Image src="/logo-nobg.png" alt="RCRS" width={72} height={72} className="object-contain drop-shadow-[0_0_20px_rgba(57,255,20,0.4)]" priority />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">
            <span className="text-brand-green" style={{ textShadow: '0 0 30px rgba(57,255,20,0.5), 0 0 60px rgba(57,255,20,0.2)' }}>Roof</span>
            <span className="text-white" style={{ textShadow: '0 0 20px rgba(255,255,255,0.15)' }}>Stack</span>
          </h1>
          <p className="text-neutral-500 text-sm sm:text-base tracking-[0.2em] uppercase">Everything Under One Roof</p>
          <div className="mt-8 w-40 h-[2px] bg-neutral-800/50 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ease-out ${phase >= 2 ? 'w-full duration-900' : 'w-0 duration-100'}`}
              style={{ background: 'linear-gradient(90deg, #39FF14, #10b981)', boxShadow: '0 0 8px rgba(57,255,20,0.4)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Frozen Splash Background (logo + shingle texture)
// ──────────────────────────────────────────────
function FrozenSplashBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Dark base */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(10,10,12,1) 0%, rgba(8,10,14,1) 40%, rgba(6,8,12,1) 100%)' }} />

      {/* Subtle shingle grid texture */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(57,255,20,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(57,255,20,0.07) 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
        }}
      />

      {/* Diagonal accent line */}
      <div className="absolute inset-0"
        style={{ background: 'linear-gradient(135deg, transparent 0%, transparent 42%, rgba(57,255,20,0.03) 48%, rgba(57,255,20,0.05) 50%, rgba(57,255,20,0.03) 52%, transparent 58%, transparent 100%)' }}
      />

      {/* Centered logo glow */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative opacity-[0.06]">
          <div className="w-[400px] h-[400px] sm:w-[500px] sm:h-[500px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(57,255,20,0.3) 0%, transparent 70%)', filter: 'blur(80px)' }}
          />
        </div>
      </div>

      {/* Faint centered logo watermark */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.04]">
        <Image src="/logo-nobg.png" alt="" width={200} height={200} className="object-contain" aria-hidden />
      </div>

      {/* Vignette */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 0%, rgba(0,0,0,0.5) 100%)' }} />
    </div>
  );
}

// ──────────────────────────────────────────────
// PIN Pad Component
// ──────────────────────────────────────────────
function PinPad({
  onSubmit,
  isLoading,
  error,
  onBack,
}: {
  onSubmit: (pin: string) => void;
  isLoading: boolean;
  error: string;
  onBack: () => void;
}) {
  const [pin, setPin] = useState('');
  const maxLen = 8;

  const addDigit = (d: string) => {
    if (pin.length < maxLen) {
      const next = pin + d;
      setPin(next);
      // Auto-submit at 4+ digits on a slight delay to give visual feedback
      if (next.length >= 4) {
        // Don't auto-submit — let user press Enter or tap Submit
      }
    }
  };

  const removeDigit = () => setPin(prev => prev.slice(0, -1));
  const clear = () => setPin('');

  const handleSubmit = () => {
    if (pin.length >= 4) onSubmit(pin);
  };

  return (
    <div className="w-full">
      {/* PIN dots display */}
      <div className="flex justify-center gap-2 mb-6">
        {Array.from({ length: Math.max(pin.length, 4) }, (_, i) => (
          <div key={i} className={`w-4 h-4 rounded-full transition-all duration-200 ${
            i < pin.length
              ? 'bg-brand-green shadow-[0_0_8px_rgba(57,255,20,0.5)] scale-110'
              : 'bg-neutral-700/50 border border-neutral-600'
          }`} />
        ))}
      </div>

      {/* Length hint */}
      <p className="text-center text-xs text-neutral-500 mb-4">
        {pin.length < 4 ? `${4 - pin.length} more digits needed` : `${pin.length} digits — tap Sign In`}
      </p>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm py-2 px-3 rounded-xl mb-4 flex items-center gap-2 animate-shake">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Number grid — big buttons for fat fingers */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <button key={n} onClick={() => addDigit(String(n))} disabled={isLoading}
            className="h-16 sm:h-18 rounded-xl bg-neutral-800/60 hover:bg-neutral-700/60 active:bg-brand-green/20 border border-neutral-700/40 text-white text-2xl font-semibold transition-all active:scale-95 disabled:opacity-50"
          >
            {n}
          </button>
        ))}
        <button onClick={clear} disabled={isLoading}
          className="h-16 sm:h-18 rounded-xl bg-neutral-800/40 hover:bg-neutral-700/40 border border-neutral-700/30 text-neutral-400 text-sm font-medium transition-all"
        >
          Clear
        </button>
        <button onClick={() => addDigit('0')} disabled={isLoading}
          className="h-16 sm:h-18 rounded-xl bg-neutral-800/60 hover:bg-neutral-700/60 active:bg-brand-green/20 border border-neutral-700/40 text-white text-2xl font-semibold transition-all active:scale-95 disabled:opacity-50"
        >
          0
        </button>
        <button onClick={removeDigit} disabled={isLoading}
          className="h-16 sm:h-18 rounded-xl bg-neutral-800/40 hover:bg-neutral-700/40 border border-neutral-700/30 text-neutral-400 transition-all flex items-center justify-center"
        >
          <Delete size={22} />
        </button>
      </div>

      {/* Submit */}
      <button onClick={handleSubmit} disabled={pin.length < 4 || isLoading}
        className="w-full relative overflow-hidden bg-gradient-to-r from-brand-green to-emerald-500 hover:from-brand-green hover:to-emerald-400 disabled:from-neutral-700 disabled:to-neutral-700 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-brand-green/25 disabled:shadow-none"
      >
        {isLoading ? <><Loader2 className="animate-spin" size={18} /> Verifying...</> : <>Sign In <ArrowRight size={18} /></>}
      </button>

      {/* Back link */}
      <button onClick={onBack} className="w-full mt-3 text-sm text-neutral-500 hover:text-brand-green transition-colors py-2 flex items-center justify-center gap-1">
        <ArrowLeft size={14} /> Use password instead
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────
// Picture Password Canvas
// ──────────────────────────────────────────────
function PicturePasswordCanvas({
  onSubmit,
  isLoading,
  error,
  onBack,
}: {
  onSubmit: (points: { x: number; y: number }[]) => void;
  isLoading: boolean;
  error: string;
  onBack: () => void;
}) {
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
    if (points.length >= 3 || isLoading) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    const newPoints = [...points, { x, y }];
    setPoints(newPoints);

    if (newPoints.length === 3) {
      // Auto-submit after brief visual feedback
      setTimeout(() => onSubmit(newPoints), 400);
    }
  };

  const reset = () => setPoints([]);

  return (
    <div className="w-full">
      <p className="text-center text-sm text-neutral-400 mb-3">
        Tap your 3 secret points ({3 - points.length} remaining)
      </p>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm py-2 px-3 rounded-xl mb-3 flex items-center gap-2 animate-shake">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tap canvas */}
      <div
        ref={canvasRef}
        onClick={handleTap}
        onTouchStart={handleTap}
        className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-neutral-700/50 cursor-crosshair select-none mb-4"
        style={{
          background: `
            linear-gradient(135deg, rgba(10,10,12,1) 0%, rgba(15,15,20,1) 50%, rgba(8,10,14,1) 100%),
            repeating-linear-gradient(0deg, transparent 0px, transparent 63px, rgba(57,255,20,0.04) 63px, rgba(57,255,20,0.04) 64px),
            repeating-linear-gradient(90deg, transparent 0px, transparent 63px, rgba(57,255,20,0.04) 63px, rgba(57,255,20,0.04) 64px)
          `,
        }}
      >
        {/* Faint centered logo */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.08] pointer-events-none">
          <Image src="/logo-nobg.png" alt="" width={120} height={120} className="object-contain" aria-hidden />
        </div>

        {/* Subtle brand text */}
        <div className="absolute bottom-3 left-0 right-0 text-center opacity-[0.08] pointer-events-none">
          <span className="text-brand-green text-lg font-bold">Roof</span>
          <span className="text-white text-lg font-bold">Stack</span>
        </div>

        {/* Tap points — big green circles */}
        {points.map((p, i) => (
          <div key={i}
            className="absolute pointer-events-none"
            style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)' }}
          >
            {/* Tolerance ring (visual guide — ~15% radius) */}
            <div className="absolute w-24 h-24 sm:w-28 sm:h-28 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 rounded-full border border-brand-green/20 bg-brand-green/5 animate-ping-once" />
            {/* Point marker */}
            <div className="relative w-10 h-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-green/30 border-2 border-brand-green flex items-center justify-center shadow-[0_0_20px_rgba(57,255,20,0.4)]">
              <span className="text-brand-green font-bold text-sm">{i + 1}</span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 className="animate-spin text-brand-green" size={32} />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <button onClick={reset} disabled={isLoading || points.length === 0}
          className="flex-1 py-3 rounded-xl bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-700/40 text-neutral-300 text-sm font-medium transition-all disabled:opacity-40"
        >
          Reset Points
        </button>
        <button onClick={onBack}
          className="flex-1 py-3 rounded-xl bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-700/40 text-neutral-400 text-sm transition-all flex items-center justify-center gap-1"
        >
          <ArrowLeft size={14} /> Password
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
export default function PortalLogin() {
  const router = useRouter();
  const { user, isLoading: authLoading, login, loginWithPin, loginWithPicture, getLoginMethod } = useAuth();

  // UI state
  const [showSplash, setShowSplash] = useState(true);
  const [contentVisible, setContentVisible] = useState(false);
  const [forgotMode, setForgotMode] = useState<ForgotMode>('none');

  // Login state machine
  const [loginStep, setLoginStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(false);
  const [userLoginMethod, setUserLoginMethod] = useState<'password' | 'pin' | 'picture'>('password');

  // Role picker
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<{ role: string; label: string; route: string; icon: string }[]>([]);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
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
      try { sessionStorage.setItem('rcrs_splash_seen', 'true'); } catch { /* ignore */ }
    }
  }, [showSplash]);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push(ROLE_DEFAULT_ROUTES[user.role]);
    }
  }, [user, authLoading, router]);

  // ── Email Continue → fetch login method ──────────
  const handleEmailContinue = async () => {
    if (!email) {
      setError('Please enter your email');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const methodInfo = await getLoginMethod(email);
      if (!methodInfo) {
        // User not found or API down — fall back to password
        setUserLoginMethod('password');
        setLoginStep('password');
      } else {
        setUserLoginMethod(methodInfo.loginMethod);
        setLoginStep(methodInfo.loginMethod);
      }
    } catch {
      setUserLoginMethod('password');
      setLoginStep('password');
    }

    setIsLoading(false);
  };

  // ── Password Login ───────────────────────────────
  const handlePasswordLogin = async () => {
    if (!email || !password) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);
    setError('');

    const result = await login(email, password, staySignedIn);

    if (result.success) {
      // Save or clear remember me
      try {
        if (rememberMe) localStorage.setItem('rcrs_remember_email', email);
        else localStorage.removeItem('rcrs_remember_email');
      } catch { /* ignore */ }

      // Audit log (non-blocking)
      try {
        fetch('/api/portal/audit-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'LOGIN',
            userEmail: email,
            details: `Password login from ${navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop'}`,
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => {});
      } catch { /* non-blocking */ }

      if (result.mustChangePassword) {
        router.push('/portal/change-password');
        setIsLoading(false);
        return;
      }

      handlePostLogin(email);
    } else {
      setError(result.error || 'Login failed');
    }

    setIsLoading(false);
  };

  // ── PIN Login ────────────────────────────────────
  const handlePinLogin = async (pin: string) => {
    setIsLoading(true);
    setError('');

    const result = await loginWithPin(email, pin, staySignedIn);

    if (result.success) {
      try {
        if (rememberMe) localStorage.setItem('rcrs_remember_email', email);
      } catch { /* ignore */ }
      handlePostLogin(email);
    } else {
      setError(result.error || 'Invalid PIN');
    }
    setIsLoading(false);
  };

  // ── Picture Password Login ───────────────────────
  const handlePictureLogin = async (points: { x: number; y: number }[]) => {
    setIsLoading(true);
    setError('');

    const result = await loginWithPicture(email, points, staySignedIn);

    if (result.success) {
      try {
        if (rememberMe) localStorage.setItem('rcrs_remember_email', email);
      } catch { /* ignore */ }
      handlePostLogin(email);
    } else {
      setError(result.error || 'Incorrect tap points');
    }
    setIsLoading(false);
  };

  // ── Post-login routing ───────────────────────────
  const handlePostLogin = (loginEmail: string) => {
    const member = TEAM_MEMBERS.find(m => m.email.toLowerCase() === loginEmail.toLowerCase());
    if (!member) return;

    const onboardingComplete = localStorage.getItem(`onboarding_complete_${member.id}`) === 'true';
    if (!onboardingComplete) {
      router.push('/portal/welcome');
      return;
    }

    // Check for dual-role users (Rick)
    const dualRoleUsers: Record<string, { role: string; label: string; route: string; icon: string }[]> = {
      'richard@rcrsal.com': [
        { role: 'sales', label: 'Sales', route: '/portal/dashboard', icon: '💰' },
        { role: 'driver', label: 'Delivery', route: '/portal/driver', icon: '🚛' },
      ],
    };

    const roles = dualRoleUsers[loginEmail.toLowerCase()];
    if (roles && roles.length > 1) {
      setAvailableRoles(roles);
      setShowRolePicker(true);
      return;
    }

    router.push(ROLE_DEFAULT_ROUTES[member.role]);
  };

  // ── Back to email step ───────────────────────────
  const handleBackToEmail = () => {
    setLoginStep('email');
    setPassword('');
    setError('');
  };

  // ── Switch to password from other methods ────────
  const handleSwitchToPassword = () => {
    setLoginStep('password');
    setError('');
  };

  // ── Role Picker ──────────────────────────────────
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
              <button key={r.role} onClick={() => router.push(r.route)}
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

  // ── Splash Screen ────────────────────────────────
  if (showSplash && !authLoading && !user) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  // ── Auth Loading ─────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <FrozenSplashBackground />
        <div className="relative z-10">
          <Loader2 className="animate-spin text-brand-green" size={48} />
        </div>
      </div>
    );
  }

  // ── Already Logged In ────────────────────────────
  if (user) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <FrozenSplashBackground />
        <div className="relative z-10 text-center">
          <Loader2 className="animate-spin text-brand-green mx-auto mb-4" size={48} />
          <p className="text-neutral-400">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  // ── Forgot Password Overlay ──────────────────────
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
                <p className="text-sm text-neutral-400">Contact your administrator to reset your password.</p>
              </div>
              <div className="bg-neutral-800/50 rounded-xl p-4 mb-6 flex items-center gap-3">
                <Phone className="text-brand-green flex-shrink-0" size={20} />
                <div>
                  <p className="text-xs text-neutral-400">Call or text</p>
                  <a href="tel:+12562748530" className="text-brand-green font-semibold text-lg hover:underline">(256) 274-8530</a>
                </div>
              </div>
              <button onClick={() => setForgotMode('none')} className="w-full mt-3 text-sm text-neutral-400 hover:text-white transition-colors py-2">Back to Login</button>
            </>
          ) : (
            <div className="text-center">
              <div className="w-14 h-14 bg-brand-green/10 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-bounce-once">
                <Mail className="text-brand-green" size={24} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Check Your Email</h3>
              <p className="text-sm text-neutral-400 mb-6">If an account exists for <span className="text-white">{email}</span>, you will receive a reset link shortly.</p>
              <button onClick={() => setForgotMode('none')} className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm">Back to Login</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Login Screen ─────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-950">
      <SandboxBanner />
      <FrozenSplashBackground />
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
                  <Image src="/logo-nobg.png" alt="RCRS" width={40} height={40} className="object-contain drop-shadow-[0_0_10px_rgba(57,255,20,0.3)]" />
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
            {/* Header */}
            <div className="mb-7">
              <h2 className="text-lg font-semibold text-white">
                {loginStep === 'email' && 'Sign In'}
                {loginStep === 'password' && 'Enter Password'}
                {loginStep === 'pin' && 'Enter PIN'}
                {loginStep === 'picture' && 'Picture Password'}
              </h2>
              <p className="text-xs text-neutral-500">
                {loginStep === 'email' && 'Enter your email to continue'}
                {loginStep === 'password' && email}
                {loginStep === 'pin' && email}
                {loginStep === 'picture' && email}
              </p>
            </div>

            {/* ── EMAIL STEP ─────────────────────── */}
            {loginStep === 'email' && (
              <>
                <div className="space-y-4 mb-5">
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wider">Email</label>
                    <div className="relative group">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-brand-green transition-colors" size={18} />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && handleEmailContinue()}
                        placeholder="your.name@rcrsal.com"
                        className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-neutral-600 focus:outline-none focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/20 transition-all text-sm"
                        autoComplete="email"
                        autoFocus
                      />
                    </div>
                  </div>
                </div>

                {/* Remember me + Stay signed in */}
                <div className="space-y-2 mb-5">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-white/20 bg-white/5 text-brand-green focus:ring-brand-green/50 focus:ring-offset-0 cursor-pointer" />
                    <span className="text-xs text-neutral-500 group-hover:text-neutral-300 transition-colors">Remember my email</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={staySignedIn} onChange={(e) => setStaySignedIn(e.target.checked)}
                      className="w-4 h-4 rounded border-white/20 bg-white/5 text-brand-green focus:ring-brand-green/50 focus:ring-offset-0 cursor-pointer" />
                    <span className="text-xs text-neutral-500 group-hover:text-neutral-300 transition-colors">Stay signed in on this device</span>
                  </label>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm py-3 px-4 rounded-xl mb-5 flex items-center gap-2 animate-shake">
                    <AlertCircle size={16} className="flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button onClick={handleEmailContinue} disabled={!email || isLoading}
                  className="w-full relative overflow-hidden bg-gradient-to-r from-brand-green to-emerald-500 hover:from-brand-green hover:to-emerald-400 disabled:from-neutral-700 disabled:to-neutral-700 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-brand-green/25 disabled:shadow-none group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
                  <span className="relative flex items-center gap-2">
                    {isLoading ? <><Loader2 className="animate-spin" size={18} /> Loading...</> : <>Continue <ArrowRight size={18} /></>}
                  </span>
                </button>
              </>
            )}

            {/* ── PASSWORD STEP ──────────────────── */}
            {loginStep === 'password' && (
              <>
                <div className="space-y-4 mb-5">
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wider">Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-brand-green transition-colors" size={18} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && handlePasswordLogin()}
                        placeholder="Enter your password"
                        className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-xl pl-11 pr-12 py-3.5 text-white placeholder-neutral-600 focus:outline-none focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/20 transition-all text-sm"
                        autoComplete="current-password"
                        autoFocus
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-300 transition-colors" tabIndex={-1}>
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-5">
                  <button onClick={handleBackToEmail} className="text-xs text-neutral-500 hover:text-brand-green transition-colors flex items-center gap-1">
                    <ArrowLeft size={12} /> Change email
                  </button>
                  <button type="button" onClick={() => setForgotMode('form')} className="text-xs text-neutral-500 hover:text-brand-green transition-colors">
                    Forgot password?
                  </button>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm py-3 px-4 rounded-xl mb-5 flex items-center gap-2 animate-shake">
                    <AlertCircle size={16} className="flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button onClick={handlePasswordLogin} disabled={!password || isLoading}
                  className="w-full relative overflow-hidden bg-gradient-to-r from-brand-green to-emerald-500 hover:from-brand-green hover:to-emerald-400 disabled:from-neutral-700 disabled:to-neutral-700 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-brand-green/25 disabled:shadow-none group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
                  <span className="relative flex items-center gap-2">
                    {isLoading ? <><Loader2 className="animate-spin" size={18} /> Signing In...</> : <>Sign In <ArrowRight size={18} /></>}
                  </span>
                </button>
              </>
            )}

            {/* ── PIN STEP ───────────────────────── */}
            {loginStep === 'pin' && (
              <PinPad
                onSubmit={handlePinLogin}
                isLoading={isLoading}
                error={error}
                onBack={handleSwitchToPassword}
              />
            )}

            {/* ── PICTURE PASSWORD STEP ──────────── */}
            {loginStep === 'picture' && (
              <PicturePasswordCanvas
                onSubmit={handlePictureLogin}
                isLoading={isLoading}
                error={error}
                onBack={handleSwitchToPassword}
              />
            )}
          </div>

          {/* Footer */}
          <div className="mt-8 text-center space-y-2">
            <p className="text-xs text-neutral-600">River City Roofing Solutions</p>
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
