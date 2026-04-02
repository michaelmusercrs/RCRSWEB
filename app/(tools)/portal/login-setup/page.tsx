'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Lock, Grid3X3, Fingerprint, ArrowRight, Check,
  Loader2, Delete, AlertCircle, ArrowLeft,
} from 'lucide-react';
import { useAuth, ROLE_DEFAULT_ROUTES } from '@/lib/auth-context';

type SetupMode = 'choose' | 'pin-setup' | 'pin-confirm' | 'picture-setup' | 'picture-confirm' | 'done';

export default function LoginSetupPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [mode, setMode] = useState<SetupMode>('choose');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // PIN state
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');

  // Picture state
  const [picturePoints, setPicturePoints] = useState<{ x: number; y: number }[]>([]);
  const [confirmPoints, setConfirmPoints] = useState<{ x: number; y: number }[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Stay signed in / remember me
  const [rememberMe, setRememberMe] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('rcrs_remember_email');
      if (saved) setRememberMe(true);
    } catch { /* ignore */ }
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-green" size={48} />
      </div>
    );
  }

  const firstName = user.name.split(' ')[0];

  // ── API helpers ──────────────────────────────────
  const callAuthApi = async (action: string, payload: Record<string, any>) => {
    const res = await fetch('/api/portal/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    return res.json();
  };

  const completeSetup = async () => {
    setIsLoading(true);

    // Save remember-me preference
    try {
      if (rememberMe) localStorage.setItem('rcrs_remember_email', user.email);
      else localStorage.removeItem('rcrs_remember_email');
    } catch { /* ignore */ }

    // Save stay-signed-in preference
    if (staySignedIn) {
      await callAuthApi('set-stay-signed-in', { value: true });
    }

    // Mark login setup as complete
    await callAuthApi('complete-login-setup', {});

    setIsLoading(false);
    setMode('done');

    // Redirect after brief celebration
    const redirect = localStorage.getItem('rcrs_post_setup_redirect');
    localStorage.removeItem('rcrs_post_setup_redirect');
    setTimeout(() => {
      router.push(redirect || ROLE_DEFAULT_ROUTES[user.role]);
    }, 1500);
  };

  // ── PIN Setup ────────────────────────────────────
  const handlePinSetup = () => {
    setPin('');
    setPinConfirm('');
    setError('');
    setMode('pin-setup');
  };

  const handlePinEntry = (digit: string) => {
    if (mode === 'pin-setup' && pin.length < 8) {
      setPin(prev => prev + digit);
    } else if (mode === 'pin-confirm' && pinConfirm.length < 8) {
      setPinConfirm(prev => prev + digit);
    }
  };

  const handlePinDelete = () => {
    if (mode === 'pin-setup') setPin(prev => prev.slice(0, -1));
    else if (mode === 'pin-confirm') setPinConfirm(prev => prev.slice(0, -1));
  };

  const handlePinClear = () => {
    if (mode === 'pin-setup') setPin('');
    else if (mode === 'pin-confirm') setPinConfirm('');
  };

  const handlePinNext = () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }
    setError('');
    setMode('pin-confirm');
  };

  const handlePinConfirmSubmit = async () => {
    if (pin !== pinConfirm) {
      setError('PINs do not match. Try again.');
      setPinConfirm('');
      return;
    }

    setIsLoading(true);
    setError('');
    const result = await callAuthApi('setup-pin', { pin });

    if (result.success) {
      setSuccess('PIN set up successfully!');
      await completeSetup();
    } else {
      setError(result.error || 'Failed to save PIN');
      setIsLoading(false);
    }
  };

  // ── Picture Password Setup ───────────────────────
  const handlePictureSetup = () => {
    setPicturePoints([]);
    setConfirmPoints([]);
    setError('');
    setMode('picture-setup');
  };

  const handleCanvasTap = (e: React.MouseEvent | React.TouchEvent) => {
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

    if (mode === 'picture-setup') {
      if (picturePoints.length < 3) {
        setPicturePoints(prev => [...prev, { x, y }]);
      }
    } else if (mode === 'picture-confirm') {
      if (confirmPoints.length < 3) {
        setConfirmPoints(prev => [...prev, { x, y }]);
      }
    }
  };

  const handlePictureNext = () => {
    if (picturePoints.length !== 3) {
      setError('Tap exactly 3 points');
      return;
    }
    setError('');
    setMode('picture-confirm');
  };

  const handlePictureConfirmSubmit = async () => {
    if (confirmPoints.length !== 3) {
      setError('Tap all 3 points to confirm');
      return;
    }

    // Check tolerance (15% — same as login)
    let match = true;
    for (let i = 0; i < 3; i++) {
      const dx = confirmPoints[i].x - picturePoints[i].x;
      const dy = confirmPoints[i].y - picturePoints[i].y;
      if (Math.sqrt(dx * dx + dy * dy) > 15) {
        match = false;
        break;
      }
    }

    if (!match) {
      setError('Points did not match. Try tapping the same 3 spots.');
      setConfirmPoints([]);
      return;
    }

    setIsLoading(true);
    setError('');
    const result = await callAuthApi('setup-picture', { points: picturePoints });

    if (result.success) {
      setSuccess('Picture password set up!');
      await completeSetup();
    } else {
      setError(result.error || 'Failed to save picture password');
      setIsLoading(false);
    }
  };

  // ── Keep Password ────────────────────────────────
  const handleKeepPassword = async () => {
    await callAuthApi('set-login-method', { method: 'password' });
    await completeSetup();
  };

  // ── Skip ─────────────────────────────────────────
  const handleSkip = async () => {
    await completeSetup();
  };

  // ── Render Helpers ───────────────────────────────
  const currentPin = mode === 'pin-setup' ? pin : pinConfirm;

  const PinPadUI = () => (
    <div>
      {/* PIN dots */}
      <div className="flex justify-center gap-2 mb-4">
        {Array.from({ length: Math.max(currentPin.length, 4) }, (_, i) => (
          <div key={i} className={`w-4 h-4 rounded-full transition-all duration-200 ${
            i < currentPin.length
              ? 'bg-brand-green shadow-[0_0_8px_rgba(57,255,20,0.5)] scale-110'
              : 'bg-neutral-700/50 border border-neutral-600'
          }`} />
        ))}
      </div>
      <p className="text-center text-xs text-neutral-500 mb-4">
        {mode === 'pin-setup' ? `Enter 4-8 digit PIN (${currentPin.length} digits)` : 'Confirm your PIN'}
      </p>

      {/* Pad */}
      <div className="grid grid-cols-3 gap-2 mb-4 max-w-xs mx-auto">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <button key={n} onClick={() => handlePinEntry(String(n))}
            className="h-16 rounded-xl bg-neutral-800/60 hover:bg-neutral-700/60 active:bg-brand-green/20 border border-neutral-700/40 text-white text-2xl font-semibold transition-all active:scale-95"
          >{n}</button>
        ))}
        <button onClick={handlePinClear} className="h-16 rounded-xl bg-neutral-800/40 hover:bg-neutral-700/40 border border-neutral-700/30 text-neutral-400 text-sm">Clear</button>
        <button onClick={() => handlePinEntry('0')} className="h-16 rounded-xl bg-neutral-800/60 hover:bg-neutral-700/60 active:bg-brand-green/20 border border-neutral-700/40 text-white text-2xl font-semibold transition-all active:scale-95">0</button>
        <button onClick={handlePinDelete} className="h-16 rounded-xl bg-neutral-800/40 hover:bg-neutral-700/40 border border-neutral-700/30 text-neutral-400 flex items-center justify-center"><Delete size={22} /></button>
      </div>
    </div>
  );

  const PictureCanvasUI = ({ points: pts }: { points: { x: number; y: number }[] }) => (
    <div
      ref={canvasRef}
      onClick={handleCanvasTap}
      onTouchStart={handleCanvasTap}
      className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-neutral-700/50 cursor-crosshair select-none mb-4"
      style={{
        background: `
          linear-gradient(135deg, rgba(10,10,12,1) 0%, rgba(15,15,20,1) 50%, rgba(8,10,14,1) 100%),
          repeating-linear-gradient(0deg, transparent 0px, transparent 63px, rgba(57,255,20,0.04) 63px, rgba(57,255,20,0.04) 64px),
          repeating-linear-gradient(90deg, transparent 0px, transparent 63px, rgba(57,255,20,0.04) 63px, rgba(57,255,20,0.04) 64px)
        `,
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.08] pointer-events-none">
        <Image src="/logo-nobg.png" alt="" width={120} height={120} className="object-contain" aria-hidden />
      </div>
      <div className="absolute bottom-3 left-0 right-0 text-center opacity-[0.08] pointer-events-none">
        <span className="text-brand-green text-lg font-bold">Roof</span>
        <span className="text-white text-lg font-bold">Stack</span>
      </div>

      {pts.map((p, i) => (
        <div key={i} className="absolute pointer-events-none" style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)' }}>
          <div className="absolute w-24 h-24 sm:w-28 sm:h-28 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 rounded-full border border-brand-green/20 bg-brand-green/5 animate-ping-once" />
          <div className="relative w-10 h-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-green/30 border-2 border-brand-green flex items-center justify-center shadow-[0_0_20px_rgba(57,255,20,0.4)]">
            <span className="text-brand-green font-bold text-sm">{i + 1}</span>
          </div>
        </div>
      ))}
    </div>
  );

  // ── DONE state ───────────────────────────────────
  if (mode === 'done') {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-20 h-20 bg-brand-green/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="text-brand-green" size={40} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">You're All Set!</h2>
          <p className="text-neutral-400 mb-2">{success || 'Login preferences saved.'}</p>
          <Loader2 className="animate-spin text-brand-green mx-auto mt-4" size={24} />
          <p className="text-xs text-neutral-500 mt-2">Redirecting...</p>
        </div>
      </div>
    );
  }

  // ── MAIN LAYOUT ──────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <Image src="/logo-nobg.png" alt="RCRS" width={48} height={48} className="mx-auto mb-3 drop-shadow-[0_0_10px_rgba(57,255,20,0.3)]" />
          <h1 className="text-2xl font-bold text-white mb-1">
            Hey {firstName}, how do you want to log in?
          </h1>
          <p className="text-sm text-neutral-400">Choose your preferred login method for next time</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm py-3 px-4 rounded-xl mb-5 flex items-center gap-2 animate-shake">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── CHOOSE MODE ───────────────────── */}
        {mode === 'choose' && (
          <>
            <div className="space-y-3 mb-6">
              {/* PIN Option */}
              <button onClick={handlePinSetup}
                className="w-full flex items-center gap-4 p-5 bg-white/[0.03] hover:bg-white/[0.08] border border-neutral-700/50 hover:border-brand-green/40 rounded-2xl transition-all group text-left"
              >
                <div className="w-12 h-12 bg-brand-green/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-brand-green/20 transition-colors">
                  <Grid3X3 className="text-brand-green" size={24} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white group-hover:text-brand-green transition-colors">Quick PIN</div>
                  <p className="text-xs text-neutral-500">4-8 digit code — fast on phone</p>
                </div>
                <ArrowRight size={18} className="text-neutral-600 group-hover:text-brand-green transition-colors" />
              </button>

              {/* Picture Password Option */}
              <button onClick={handlePictureSetup}
                className="w-full flex items-center gap-4 p-5 bg-white/[0.03] hover:bg-white/[0.08] border border-neutral-700/50 hover:border-brand-green/40 rounded-2xl transition-all group text-left"
              >
                <div className="w-12 h-12 bg-brand-green/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-brand-green/20 transition-colors">
                  <Fingerprint className="text-brand-green" size={24} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white group-hover:text-brand-green transition-colors">Picture Password</div>
                  <p className="text-xs text-neutral-500">Tap 3 spots on the screen — easy to remember</p>
                </div>
                <ArrowRight size={18} className="text-neutral-600 group-hover:text-brand-green transition-colors" />
              </button>

              {/* Keep Password Option */}
              <button onClick={handleKeepPassword} disabled={isLoading}
                className="w-full flex items-center gap-4 p-5 bg-white/[0.03] hover:bg-white/[0.08] border border-neutral-700/50 hover:border-neutral-500/40 rounded-2xl transition-all group text-left"
              >
                <div className="w-12 h-12 bg-neutral-800 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Lock className="text-neutral-400" size={24} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-neutral-300">Keep Using Password</div>
                  <p className="text-xs text-neutral-500">Email + password, same as now</p>
                </div>
                {isLoading ? <Loader2 className="animate-spin text-neutral-400" size={18} /> : <ArrowRight size={18} className="text-neutral-600" />}
              </button>
            </div>

            {/* Toggles */}
            <div className="space-y-3 mb-6 p-4 bg-neutral-800/30 rounded-xl border border-neutral-700/30">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm text-neutral-400 group-hover:text-neutral-300 transition-colors">Remember my email</span>
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-5 h-5 rounded border-white/20 bg-white/5 text-brand-green focus:ring-brand-green/50 focus:ring-offset-0 cursor-pointer" />
              </label>
              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <span className="text-sm text-neutral-400 group-hover:text-neutral-300 transition-colors">Stay signed in (30 days)</span>
                  <p className="text-xs text-neutral-600">Anyone with access to this device can use your account</p>
                </div>
                <input type="checkbox" checked={staySignedIn} onChange={(e) => setStaySignedIn(e.target.checked)}
                  className="w-5 h-5 rounded border-white/20 bg-white/5 text-brand-green focus:ring-brand-green/50 focus:ring-offset-0 cursor-pointer ml-4 flex-shrink-0" />
              </label>
            </div>

            {/* Skip */}
            <button onClick={handleSkip} disabled={isLoading}
              className="w-full text-sm text-neutral-500 hover:text-neutral-300 transition-colors py-2"
            >
              Skip for now
            </button>
          </>
        )}

        {/* ── PIN SETUP ─────────────────────── */}
        {mode === 'pin-setup' && (
          <div className="bg-neutral-900/60 backdrop-blur-xl rounded-2xl border border-neutral-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-1 text-center">Create Your PIN</h3>
            <p className="text-xs text-neutral-500 mb-6 text-center">Enter 4-8 digits you will remember</p>
            <PinPadUI />
            <button onClick={handlePinNext} disabled={pin.length < 4}
              className="w-full mt-4 bg-gradient-to-r from-brand-green to-emerald-500 disabled:from-neutral-700 disabled:to-neutral-700 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-green/25 disabled:shadow-none"
            >
              Next <ArrowRight size={18} />
            </button>
            <button onClick={() => { setMode('choose'); setError(''); }} className="w-full mt-3 text-sm text-neutral-500 hover:text-neutral-300 py-2 flex items-center justify-center gap-1">
              <ArrowLeft size={14} /> Back
            </button>
          </div>
        )}

        {/* ── PIN CONFIRM ───────────────────── */}
        {mode === 'pin-confirm' && (
          <div className="bg-neutral-900/60 backdrop-blur-xl rounded-2xl border border-neutral-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-1 text-center">Confirm Your PIN</h3>
            <p className="text-xs text-neutral-500 mb-6 text-center">Enter the same {pin.length}-digit PIN again</p>
            <PinPadUI />
            <button onClick={handlePinConfirmSubmit} disabled={pinConfirm.length < pin.length || isLoading}
              className="w-full mt-4 bg-gradient-to-r from-brand-green to-emerald-500 disabled:from-neutral-700 disabled:to-neutral-700 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-green/25 disabled:shadow-none"
            >
              {isLoading ? <><Loader2 className="animate-spin" size={18} /> Saving...</> : <>Confirm PIN <Check size={18} /></>}
            </button>
            <button onClick={() => { setMode('pin-setup'); setPin(''); setPinConfirm(''); setError(''); }} className="w-full mt-3 text-sm text-neutral-500 hover:text-neutral-300 py-2 flex items-center justify-center gap-1">
              <ArrowLeft size={14} /> Start Over
            </button>
          </div>
        )}

        {/* ── PICTURE SETUP ─────────────────── */}
        {mode === 'picture-setup' && (
          <div className="bg-neutral-900/60 backdrop-blur-xl rounded-2xl border border-neutral-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-1 text-center">Set Your Picture Password</h3>
            <p className="text-xs text-neutral-500 mb-4 text-center">Tap 3 points you will remember ({3 - picturePoints.length} remaining)</p>
            <PictureCanvasUI points={picturePoints} />
            <div className="flex gap-2">
              <button onClick={() => setPicturePoints([])} disabled={picturePoints.length === 0}
                className="flex-1 py-3 rounded-xl bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-700/40 text-neutral-300 text-sm disabled:opacity-40"
              >Reset</button>
              <button onClick={handlePictureNext} disabled={picturePoints.length !== 3}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-brand-green to-emerald-500 disabled:from-neutral-700 disabled:to-neutral-700 text-black font-bold text-sm disabled:text-neutral-400 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              >Next <ArrowRight size={16} /></button>
            </div>
            <button onClick={() => { setMode('choose'); setError(''); }} className="w-full mt-3 text-sm text-neutral-500 hover:text-neutral-300 py-2 flex items-center justify-center gap-1">
              <ArrowLeft size={14} /> Back
            </button>
          </div>
        )}

        {/* ── PICTURE CONFIRM ───────────────── */}
        {mode === 'picture-confirm' && (
          <div className="bg-neutral-900/60 backdrop-blur-xl rounded-2xl border border-neutral-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-1 text-center">Confirm Your Points</h3>
            <p className="text-xs text-neutral-500 mb-4 text-center">Tap the same 3 spots again ({3 - confirmPoints.length} remaining)</p>
            <PictureCanvasUI points={confirmPoints} />
            <div className="flex gap-2">
              <button onClick={() => setConfirmPoints([])} disabled={confirmPoints.length === 0}
                className="flex-1 py-3 rounded-xl bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-700/40 text-neutral-300 text-sm disabled:opacity-40"
              >Reset</button>
              <button onClick={handlePictureConfirmSubmit} disabled={confirmPoints.length !== 3 || isLoading}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-brand-green to-emerald-500 disabled:from-neutral-700 disabled:to-neutral-700 text-black font-bold text-sm disabled:text-neutral-400 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              >{isLoading ? <Loader2 className="animate-spin" size={16} /> : <><Check size={16} /> Confirm</>}</button>
            </div>
            <button onClick={() => { setMode('picture-setup'); setPicturePoints([]); setConfirmPoints([]); setError(''); }} className="w-full mt-3 text-sm text-neutral-500 hover:text-neutral-300 py-2 flex items-center justify-center gap-1">
              <ArrowLeft size={14} /> Start Over
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
