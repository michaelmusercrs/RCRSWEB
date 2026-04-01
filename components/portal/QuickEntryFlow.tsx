'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ClipboardCheck, Search, AlertCircle, FileSignature,
  Wrench, Columns3, DollarSign, Target, Briefcase,
  Users, Loader2, CheckCircle, X, ArrowLeft,
  Plus, Minus, PartyPopper, RotateCcw, Pencil,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface WeeklyNumbers {
  week: string;
  repName: string;
  inspected: number;
  damage: number;
  signed: number;
  repair: number;
  gutter: number;
  revenue: number;
  approved: number;
  goal: number;
  referrals: number;
  agents: number;
  present: string;
  homeShow: number;
  submittedAt: string;
}

interface QuickEntryFlowProps {
  userEmail: string;
  userName: string;
  compact?: boolean;
}

type FlowStep =
  | 'idle'
  | 'inspect'
  | 'damage'
  | 'outcome'
  | 'revenue'
  | 'gutter'
  | 'checkin'
  | 'goal'
  | 'summary';

interface SessionDelta {
  inspected: number;
  damage: number;
  signed: number;
  repair: number;
  gutter: number;
  revenue: number;
  agents: number;
  referrals: number;
  goal: number;
}

// =============================================================================
// Helpers
// =============================================================================

function getISOWeekString(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getMondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon...6=Sat
  const diff = day === 0 ? -6 : 1 - day; // if Sunday, go back 6 days
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function getMondayOfPreviousWeek(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff - 7);
  return monday.toISOString().slice(0, 10);
}

function getPreviousISOWeek(weekStr: string): string {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekStr;
  let year = parseInt(match[1]);
  let weekNum = parseInt(match[2]);
  weekNum--;
  if (weekNum < 1) {
    year--;
    weekNum = 52;
  }
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

function getWeekDateRange(weekStr: string): string {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekStr;
  const year = parseInt(match[1]);
  const weekNum = parseInt(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);
  const monday = new Date(mondayWeek1);
  monday.setUTCDate(mondayWeek1.getUTCDate() + (weekNum - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${fmt(monday)} - ${fmt(sunday)}`;
}

function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `$${value.toLocaleString()}`;
  }
  return `$${value}`;
}

function formatCurrencyInput(value: string): string {
  const num = value.replace(/[^0-9]/g, '');
  if (!num) return '';
  return parseInt(num).toLocaleString();
}

function parseCurrencyInput(value: string): number {
  return parseInt(value.replace(/[^0-9]/g, '')) || 0;
}

const emptyDelta: SessionDelta = {
  inspected: 0,
  damage: 0,
  signed: 0,
  repair: 0,
  gutter: 0,
  revenue: 0,
  agents: 0,
  referrals: 0,
  goal: 0,
};

// =============================================================================
// Confetti effect
// =============================================================================

function ConfettiBurst() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const colors = ['#39FF14', '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
    const particles: {
      x: number; y: number; vx: number; vy: number;
      color: string; size: number; rotation: number; rotSpeed: number;
      life: number;
    }[] = [];

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.7) * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 3,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        life: 1,
      });
    }

    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        if (p.life <= 0) continue;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25;
        p.rotation += p.rotSpeed;
        p.life -= 0.012;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (alive) animId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10"
      style={{ width: '100%', height: '100%' }}
    />
  );
}

// =============================================================================
// Progress Bar
// =============================================================================

const STEP_ORDER: FlowStep[] = ['inspect', 'damage', 'outcome', 'revenue', 'gutter', 'checkin', 'goal', 'summary'];

function ProgressBar({ currentStep, skippedSteps }: { currentStep: FlowStep; skippedSteps: Set<FlowStep> }) {
  const visibleSteps = STEP_ORDER.filter(s => !skippedSteps.has(s));
  const currentIdx = visibleSteps.indexOf(currentStep);
  const total = visibleSteps.length;

  return (
    <div className="flex items-center gap-1.5 mb-4">
      {visibleSteps.map((step, i) => (
        <div
          key={step}
          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
            i <= currentIdx ? 'bg-brand-green' : 'bg-white/10'
          }`}
        />
      ))}
      <span className="text-xs text-neutral-500 ml-2 whitespace-nowrap">
        {currentIdx + 1}/{total}
      </span>
    </div>
  );
}

// =============================================================================
// Number Stepper
// =============================================================================

function NumberStepper({
  value,
  onChange,
  min = 0,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      {label && <span className="text-sm text-neutral-400">{label}</span>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition-all"
        >
          <Minus size={20} />
        </button>
        <span className="text-3xl font-bold text-white w-16 text-center tabular-nums">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition-all"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function QuickEntryFlow({ userEmail, userName, compact = false }: QuickEntryFlowProps) {
  // Current week data
  const [currentWeek, setCurrentWeek] = useState<string>('');
  const [weekData, setWeekData] = useState<WeeklyNumbers | null>(null);
  const [previousWeekGoal, setPreviousWeekGoal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Flow state
  const [step, setStep] = useState<FlowStep>('idle');
  const [sessionDelta, setSessionDelta] = useState<SessionDelta>({ ...emptyDelta });
  const [skippedSteps, setSkippedSteps] = useState<Set<FlowStep>>(new Set());
  const [showCelebration, setShowCelebration] = useState(false);

  // Step-specific state
  const [revenueInput, setRevenueInput] = useState('');
  const [gutterCount, setGutterCount] = useState(0);
  const [agentsCount, setAgentsCount] = useState(0);
  const [referralsCount, setReferralsCount] = useState(0);
  const [goalValue, setGoalValue] = useState(0);

  // Modal for full edit
  const [showFullEdit, setShowFullEdit] = useState(false);

  // ─── Data fetching ──────────────────────────────────────────────────────

  const fetchWeekData = useCallback(async (week?: string) => {
    try {
      const targetWeek = week || getISOWeekString();
      const res = await fetch(`/api/portal/weekly-numbers?repEmail=${encodeURIComponent(userEmail)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch weekly numbers');
      const data = await res.json();
      if (data.success) {
        setCurrentWeek(data.currentWeek);
        const match = (data.records || []).find((r: WeeklyNumbers) => r.week === (week || data.currentWeek));
        setWeekData(match || null);
        return { records: data.records || [], currentWeek: data.currentWeek };
      }
    } catch (err) {
      console.error('Error fetching weekly numbers:', err);
    }
    return null;
  }, [userEmail]);

  const fetchPreviousWeekGoal = useCallback(async () => {
    try {
      const prevWeek = getPreviousISOWeek(currentWeek || getISOWeekString());
      const res = await fetch(
        `/api/portal/weekly-numbers?repEmail=${encodeURIComponent(userEmail)}&weekStart=${prevWeek}&weekEnd=${prevWeek}`,
        { credentials: 'include' },
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.records?.length > 0) {
        const prevRecord = data.records[0];
        setPreviousWeekGoal(prevRecord.goal ?? null);
      }
    } catch {
      // Ignore - previous goal is optional
    }
  }, [currentWeek, userEmail]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await fetchWeekData();
      setIsLoading(false);
    };
    init();
  }, [fetchWeekData]);

  // Fetch previous week goal when we enter the goal step
  useEffect(() => {
    if (step === 'goal' && currentWeek) {
      fetchPreviousWeekGoal();
    }
  }, [step, currentWeek, fetchPreviousWeekGoal]);

  // ─── Save to API ────────────────────────────────────────────────────────

  const saveNumbers = useCallback(async (delta: SessionDelta) => {
    setIsSaving(true);
    setSaveError(null);

    try {
      // Compute new totals by adding delta to existing data
      const existing = weekData || {
        inspected: 0, damage: 0, signed: 0, repair: 0,
        gutter: 0, revenue: 0, approved: 0, goal: 0,
        referrals: 0, agents: 0, present: '1', homeShow: 0,
      };

      const payload = {
        week: currentWeek || getISOWeekString(),
        inspected: (existing.inspected || 0) + delta.inspected,
        damage: (existing.damage || 0) + delta.damage,
        signed: (existing.signed || 0) + delta.signed,
        repair: (existing.repair || 0) + delta.repair,
        gutter: (existing.gutter || 0) + delta.gutter,
        revenue: (existing.revenue || 0) + delta.revenue,
        approved: existing.approved || 0,
        goal: delta.goal > 0 ? delta.goal : (existing.goal || 0),
        referrals: (existing.referrals || 0) + delta.referrals,
        agents: (existing.agents || 0) + delta.agents,
        present: existing.present || '1',
        homeShow: existing.homeShow || 0,
      };

      // Try PATCH first (update existing), fall back to POST if no record exists
      const method = weekData ? 'PATCH' : 'POST';
      const res = await fetch('/api/portal/weekly-numbers', {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.success && res.status === 409) {
        // Record exists but we tried POST - switch to PATCH
        const patchRes = await fetch('/api/portal/weekly-numbers', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        const patchData = await patchRes.json();
        if (!patchData.success) {
          throw new Error(patchData.error || 'Failed to save');
        }
      } else if (!data.success) {
        throw new Error(data.error || 'Failed to save');
      }

      // Refresh data after save
      await fetchWeekData();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save numbers';
      setSaveError(msg);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [weekData, currentWeek, fetchWeekData]);

  // ─── Flow control ──────────────────────────────────────────────────────

  const startFlow = () => {
    setSessionDelta({ ...emptyDelta });
    setSkippedSteps(new Set());
    setShowCelebration(false);
    setRevenueInput('');
    setGutterCount(0);
    setAgentsCount(0);
    setReferralsCount(0);
    setGoalValue(weekData?.goal || 0);
    setSaveError(null);
    setStep('inspect');
  };

  const cancelFlow = () => {
    setStep('idle');
    setSessionDelta({ ...emptyDelta });
    setSkippedSteps(new Set());
    setShowCelebration(false);
    setSaveError(null);
  };

  const finishFlow = async () => {
    const success = await saveNumbers(sessionDelta);
    if (success) {
      if (sessionDelta.signed > 0) {
        setShowCelebration(true);
      }
      setStep('summary');
    }
  };

  // ─── Loading state ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="bg-neutral-950 border border-white/5 rounded-2xl p-6">
        <div className="flex items-center justify-center gap-3 py-8">
          <Loader2 size={24} className="text-brand-green animate-spin" />
          <span className="text-neutral-400">Loading your numbers...</span>
        </div>
      </div>
    );
  }

  // ─── Compact mode ───────────────────────────────────────────────────────

  if (compact && step === 'idle') {
    return (
      <div className="bg-neutral-950 border border-white/5 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center">
              <ClipboardCheck size={16} className="text-brand-green" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Quick Log</h4>
              <p className="text-[10px] text-neutral-500">{getWeekDateRange(currentWeek)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-500">{weekData?.inspected || 0} inspected</span>
            <span className="text-neutral-600">|</span>
            <span className="text-emerald-400 font-semibold">{formatCurrency(weekData?.revenue || 0)}</span>
          </div>
        </div>
        <button
          onClick={startFlow}
          className="w-full py-2.5 rounded-xl bg-brand-green/20 text-brand-green font-semibold text-sm hover:bg-brand-green/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <ClipboardCheck size={16} />
          Log Inspection
        </button>
      </div>
    );
  }

  // ─── IDLE STATE ─────────────────────────────────────────────────────────

  if (step === 'idle') {
    const data = weekData;
    return (
      <div className="bg-neutral-950 border border-white/5 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-green/20 rounded-xl flex items-center justify-center">
                <ClipboardCheck size={20} className="text-brand-green" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Running Tally</h3>
                <p className="text-xs text-neutral-500">{getWeekDateRange(currentWeek)}</p>
              </div>
            </div>
            <button
              onClick={() => setShowFullEdit(true)}
              className="text-xs text-neutral-500 hover:text-brand-green transition-colors flex items-center gap-1"
            >
              <Pencil size={12} />
              Edit All Numbers
            </button>
          </div>
        </div>

        {/* Tally Grid */}
        <div className="p-5">
          <div className="grid grid-cols-5 gap-3 mb-5">
            <TallyCell
              icon={Search}
              label="Inspected"
              value={String(data?.inspected || 0)}
              color="text-blue-400"
            />
            <TallyCell
              icon={AlertCircle}
              label="Damage"
              value={String(data?.damage || 0)}
              color="text-red-400"
            />
            <TallyCell
              icon={FileSignature}
              label="Signed"
              value={String(data?.signed || 0)}
              color="text-green-400"
            />
            <TallyCell
              icon={DollarSign}
              label="Revenue"
              value={formatCurrency(data?.revenue || 0)}
              color="text-emerald-400"
              large
            />
            <TallyCell
              icon={Target}
              label="Goal"
              value={String(data?.goal || 0)}
              color="text-amber-400"
            />
          </div>

          {/* Log Inspection Button */}
          <button
            onClick={startFlow}
            className="w-full py-4 rounded-xl bg-brand-green text-neutral-950 font-bold text-lg hover:bg-brand-green/90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-lg shadow-brand-green/20"
          >
            <ClipboardCheck size={24} />
            Log Inspection
          </button>
        </div>

        {/* Full edit modal */}
        {showFullEdit && (
          <FullEditModal
            weekData={weekData}
            currentWeek={currentWeek}
            userEmail={userEmail}
            onClose={() => setShowFullEdit(false)}
            onSaved={async () => {
              setShowFullEdit(false);
              await fetchWeekData();
            }}
          />
        )}
      </div>
    );
  }

  // ─── STEP-BY-STEP FLOW ────────────────────────────────────────────────

  return (
    <div className="bg-neutral-950 border border-white/5 rounded-2xl overflow-hidden">
      {/* Flow Header */}
      <div className="px-5 pt-4 pb-2">
        <ProgressBar currentStep={step} skippedSteps={skippedSteps} />
      </div>

      <div className="px-5 pb-5">
        {/* Step 1: Inspect */}
        {step === 'inspect' && (
          <StepCard
            title="Did you inspect a property?"
            icon={Search}
            iconColor="text-blue-400"
          >
            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={() => {
                  setSessionDelta(prev => ({ ...prev, inspected: prev.inspected + 1 }));
                  setStep('damage');
                }}
                className="w-full py-4 rounded-xl bg-brand-green text-neutral-950 font-bold text-lg hover:bg-brand-green/90 active:scale-[0.98] transition-all"
              >
                YES
              </button>
              <button
                onClick={cancelFlow}
                className="w-full py-3 rounded-xl bg-white/5 text-neutral-400 font-medium hover:bg-white/10 active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
            </div>
          </StepCard>
        )}

        {/* Step 2: Damage */}
        {step === 'damage' && (
          <StepCard
            title="Was there storm damage?"
            icon={AlertCircle}
            iconColor="text-red-400"
          >
            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={() => {
                  setSessionDelta(prev => ({ ...prev, damage: prev.damage + 1 }));
                  setStep('outcome');
                }}
                className="w-full py-4 rounded-xl bg-brand-green text-neutral-950 font-bold text-lg hover:bg-brand-green/90 active:scale-[0.98] transition-all"
              >
                YES
              </button>
              <button
                onClick={() => {
                  setSkippedSteps(prev => new Set([...prev, 'outcome', 'revenue']));
                  setStep('gutter');
                }}
                className="w-full py-4 rounded-xl bg-white/10 text-white font-bold text-lg hover:bg-white/15 active:scale-[0.98] transition-all"
              >
                NO
              </button>
            </div>
          </StepCard>
        )}

        {/* Step 3a: Outcome */}
        {step === 'outcome' && (
          <StepCard
            title="What happened?"
            icon={FileSignature}
            iconColor="text-green-400"
          >
            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={() => {
                  setSessionDelta(prev => ({ ...prev, signed: prev.signed + 1 }));
                  setRevenueInput('');
                  setStep('revenue');
                }}
                className="w-full py-4 rounded-xl bg-brand-green text-neutral-950 font-bold text-lg hover:bg-brand-green/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <PartyPopper size={22} />
                They Signed!
              </button>
              <button
                onClick={() => {
                  setSessionDelta(prev => ({ ...prev, repair: prev.repair + 1 }));
                  setStep('gutter');
                }}
                className="w-full py-4 rounded-xl bg-blue-600/80 text-white font-bold text-lg hover:bg-blue-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Wrench size={20} />
                Repair Job
              </button>
              <button
                onClick={() => {
                  setStep('gutter');
                }}
                className="w-full py-4 rounded-xl bg-white/10 text-neutral-300 font-bold text-lg hover:bg-white/15 active:scale-[0.98] transition-all"
              >
                Neither - just damage noted
              </button>
            </div>
          </StepCard>
        )}

        {/* Step 3b: Revenue */}
        {step === 'revenue' && (
          <StepCard
            title="How much is the job worth?"
            icon={DollarSign}
            iconColor="text-emerald-400"
          >
            <div className="mt-6">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-emerald-400">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={revenueInput}
                  onChange={(e) => setRevenueInput(formatCurrencyInput(e.target.value))}
                  placeholder="0"
                  autoFocus
                  className="w-full py-4 pl-10 pr-4 rounded-xl bg-white/5 border border-white/10 text-white text-3xl font-bold text-center placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green/50"
                />
              </div>
              <button
                onClick={() => {
                  const amount = parseCurrencyInput(revenueInput);
                  setSessionDelta(prev => ({ ...prev, revenue: prev.revenue + amount }));
                  setStep('gutter');
                }}
                className="w-full mt-4 py-4 rounded-xl bg-brand-green text-neutral-950 font-bold text-lg hover:bg-brand-green/90 active:scale-[0.98] transition-all"
              >
                Save
              </button>
            </div>
          </StepCard>
        )}

        {/* Step 4: Gutter */}
        {step === 'gutter' && (
          <StepCard
            title="Any gutter work?"
            icon={Columns3}
            iconColor="text-cyan-400"
          >
            <div className="mt-6 flex flex-col items-center gap-6">
              <NumberStepper value={gutterCount} onChange={setGutterCount} />
              <button
                onClick={() => {
                  setSessionDelta(prev => ({ ...prev, gutter: prev.gutter + gutterCount }));
                  setStep('checkin');
                }}
                className="w-full py-4 rounded-xl bg-brand-green text-neutral-950 font-bold text-lg hover:bg-brand-green/90 active:scale-[0.98] transition-all"
              >
                Next
              </button>
            </div>
          </StepCard>
        )}

        {/* Step 5: Quick check-in */}
        {step === 'checkin' && (
          <StepCard
            title="Quick check-in"
            icon={Users}
            iconColor="text-yellow-400"
          >
            <div className="mt-6 flex flex-col gap-6">
              <NumberStepper
                value={agentsCount}
                onChange={setAgentsCount}
                label="Agents visited today?"
              />
              <NumberStepper
                value={referralsCount}
                onChange={setReferralsCount}
                label="Referrals this week?"
              />
              <button
                onClick={() => {
                  setSessionDelta(prev => ({
                    ...prev,
                    agents: prev.agents + agentsCount,
                    referrals: prev.referrals + referralsCount,
                  }));
                  setStep('goal');
                }}
                className="w-full py-4 rounded-xl bg-brand-green text-neutral-950 font-bold text-lg hover:bg-brand-green/90 active:scale-[0.98] transition-all"
              >
                Next
              </button>
            </div>
          </StepCard>
        )}

        {/* Step 6: Goal */}
        {step === 'goal' && (
          <StepCard
            title="Your Goal"
            icon={Target}
            iconColor="text-amber-400"
          >
            <div className="mt-4">
              {previousWeekGoal !== null && previousWeekGoal > 0 && (
                <p className="text-sm text-neutral-400 mb-4 text-center">
                  Last week: <span className="text-white font-semibold">{previousWeekGoal}</span>
                </p>
              )}
              <NumberStepper
                value={goalValue}
                onChange={setGoalValue}
                label="This week's goal"
              />
              <button
                onClick={() => {
                  setSessionDelta(prev => ({ ...prev, goal: goalValue }));
                  finishFlow();
                }}
                disabled={isSaving}
                className="w-full mt-6 py-4 rounded-xl bg-brand-green text-neutral-950 font-bold text-lg hover:bg-brand-green/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Finish'
                )}
              </button>
              {saveError && (
                <p className="text-sm text-red-400 text-center mt-3">{saveError}</p>
              )}
            </div>
          </StepCard>
        )}

        {/* Step 7: Summary */}
        {step === 'summary' && (
          <div className="relative">
            {showCelebration && <ConfettiBurst />}
            <StepCard
              title={showCelebration ? 'Deal Signed!' : 'Numbers Logged'}
              icon={showCelebration ? PartyPopper : CheckCircle}
              iconColor={showCelebration ? 'text-yellow-400' : 'text-brand-green'}
            >
              {showCelebration && (
                <p className="text-center text-brand-green font-semibold text-sm mt-1">
                  Great work, {userName.split(' ')[0]}!
                </p>
              )}

              <div className="mt-5 bg-white/5 rounded-xl p-4 space-y-3">
                <SummaryRow label="Inspected" value={`+${sessionDelta.inspected}`} icon={Search} color="text-blue-400" />
                {sessionDelta.damage > 0 && (
                  <SummaryRow label="Damage" value={`+${sessionDelta.damage}`} icon={AlertCircle} color="text-red-400" />
                )}
                {sessionDelta.signed > 0 && (
                  <SummaryRow label="Signed" value={`+${sessionDelta.signed}`} icon={FileSignature} color="text-green-400" />
                )}
                {sessionDelta.repair > 0 && (
                  <SummaryRow label="Repair" value={`+${sessionDelta.repair}`} icon={Wrench} color="text-orange-400" />
                )}
                {sessionDelta.revenue > 0 && (
                  <SummaryRow label="Revenue" value={`+${formatCurrency(sessionDelta.revenue)}`} icon={DollarSign} color="text-emerald-400" />
                )}
                {sessionDelta.gutter > 0 && (
                  <SummaryRow label="Gutter" value={`+${sessionDelta.gutter}`} icon={Columns3} color="text-cyan-400" />
                )}
                {sessionDelta.agents > 0 && (
                  <SummaryRow label="Agents" value={`+${sessionDelta.agents}`} icon={Briefcase} color="text-indigo-400" />
                )}
                {sessionDelta.referrals > 0 && (
                  <SummaryRow label="Referrals" value={`+${sessionDelta.referrals}`} icon={Users} color="text-yellow-400" />
                )}
                {sessionDelta.goal > 0 && (
                  <SummaryRow label="Goal" value={String(sessionDelta.goal)} icon={Target} color="text-amber-400" />
                )}
              </div>

              {/* Updated totals */}
              {weekData && (
                <div className="mt-4 pt-3 border-t border-white/5">
                  <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Week Totals</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-white">{weekData.inspected}</p>
                      <p className="text-[10px] text-neutral-500">Inspected</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-green-400">{weekData.signed}</p>
                      <p className="text-[10px] text-neutral-500">Signed</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-emerald-400">{formatCurrency(weekData.revenue)}</p>
                      <p className="text-[10px] text-neutral-500">Revenue</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 mt-5">
                <button
                  onClick={() => {
                    setSessionDelta({ ...emptyDelta });
                    setSkippedSteps(new Set());
                    setShowCelebration(false);
                    setRevenueInput('');
                    setGutterCount(0);
                    setAgentsCount(0);
                    setReferralsCount(0);
                    setGoalValue(weekData?.goal || 0);
                    setSaveError(null);
                    setStep('inspect');
                  }}
                  className="w-full py-3.5 rounded-xl bg-brand-green/20 text-brand-green font-bold text-base hover:bg-brand-green/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw size={18} />
                  Log Another Inspection
                </button>
                <button
                  onClick={cancelFlow}
                  className="w-full py-3.5 rounded-xl bg-white/5 text-white font-medium text-base hover:bg-white/10 active:scale-[0.98] transition-all"
                >
                  Done
                </button>
              </div>
            </StepCard>
          </div>
        )}

        {/* Cancel button for mid-flow steps (not on inspect, which has its own cancel, and not on summary) */}
        {step !== 'inspect' && step !== 'summary' && (
          <button
            onClick={cancelFlow}
            className="w-full mt-3 py-2.5 rounded-xl text-neutral-500 text-sm hover:text-neutral-300 transition-colors flex items-center justify-center gap-1"
          >
            <ArrowLeft size={14} />
            Cancel
          </button>
        )}
      </div>

      {/* Full edit modal */}
      {showFullEdit && (
        <FullEditModal
          weekData={weekData}
          currentWeek={currentWeek}
          userEmail={userEmail}
          onClose={() => setShowFullEdit(false)}
          onSaved={async () => {
            setShowFullEdit(false);
            await fetchWeekData();
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function TallyCell({
  icon: Icon,
  label,
  value,
  color,
  large,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  large?: boolean;
}) {
  return (
    <div className="text-center">
      <div className={`mx-auto w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center mb-1.5 ${color}`}>
        <Icon size={16} />
      </div>
      <p className={`font-bold text-white ${large ? 'text-base' : 'text-lg'} leading-tight`}>{value}</p>
      <p className="text-[10px] text-neutral-500 mt-0.5">{label}</p>
    </div>
  );
}

function StepCard({
  title,
  icon: Icon,
  iconColor,
  children,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-2">
      <div className="flex items-center gap-3 mb-1">
        <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${iconColor}`}>
          <Icon size={22} />
        </div>
        <h3 className="text-lg font-bold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon size={14} className={color} />
        <span className="text-sm text-neutral-400">{label}</span>
      </div>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

// =============================================================================
// Full Edit Modal
// =============================================================================

function FullEditModal({
  weekData,
  currentWeek,
  userEmail,
  onClose,
  onSaved,
}: {
  weekData: WeeklyNumbers | null;
  currentWeek: string;
  userEmail: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [formData, setFormData] = useState({
    inspected: weekData?.inspected || 0,
    damage: weekData?.damage || 0,
    signed: weekData?.signed || 0,
    repair: weekData?.repair || 0,
    gutter: weekData?.gutter || 0,
    revenue: weekData?.revenue || 0,
    approved: weekData?.approved || 0,
    goal: weekData?.goal || 0,
    referrals: weekData?.referrals || 0,
    agents: weekData?.agents || 0,
    present: weekData?.present || '1',
    homeShow: weekData?.homeShow || 0,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields: { key: string; label: string; icon: React.ElementType; color: string; type: 'number' | 'currency' | 'select' }[] = [
    { key: 'inspected', label: 'Inspected', icon: Search, color: 'text-blue-400', type: 'number' },
    { key: 'damage', label: 'Damage', icon: AlertCircle, color: 'text-red-400', type: 'number' },
    { key: 'signed', label: 'Signed', icon: FileSignature, color: 'text-green-400', type: 'number' },
    { key: 'repair', label: 'Repair', icon: Wrench, color: 'text-orange-400', type: 'number' },
    { key: 'gutter', label: 'Gutter', icon: Columns3, color: 'text-cyan-400', type: 'number' },
    { key: 'revenue', label: '$$$$$', icon: DollarSign, color: 'text-emerald-400', type: 'currency' },
    { key: 'approved', label: 'Approved', icon: CheckCircle, color: 'text-purple-400', type: 'number' },
    { key: 'goal', label: 'Goal', icon: Target, color: 'text-amber-400', type: 'number' },
    { key: 'referrals', label: 'Referrals', icon: Users, color: 'text-yellow-400', type: 'number' },
    { key: 'agents', label: 'Agents', icon: Briefcase, color: 'text-indigo-400', type: 'number' },
  ];

  const handleChange = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [key]: key === 'present' ? value : (key === 'revenue' ? parseFloat(value) || 0 : parseInt(value) || 0),
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const method = weekData ? 'PATCH' : 'POST';
      const res = await fetch('/api/portal/weekly-numbers', {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ week: currentWeek, ...formData }),
      });
      const data = await res.json();

      if (!data.success && res.status === 409) {
        const patchRes = await fetch('/api/portal/weekly-numbers', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ week: currentWeek, ...formData }),
        });
        const patchData = await patchRes.json();
        if (!patchData.success) throw new Error(patchData.error || 'Failed to save');
      } else if (!data.success) {
        throw new Error(data.error || 'Failed to save');
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 sticky top-0 bg-neutral-900 z-10">
          <h3 className="text-base font-bold text-white">Edit All Numbers</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-3">
          {fields.map((field) => {
            const Icon = field.icon;
            return (
              <div key={field.key} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 ${field.color}`}>
                  <Icon size={14} />
                </div>
                <label className="text-sm text-neutral-400 w-20 shrink-0">{field.label}</label>
                <input
                  type="number"
                  value={(formData as Record<string, number | string>)[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  step={field.type === 'currency' ? '0.01' : '1'}
                  min="0"
                  className="flex-1 py-2 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-green/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            );
          })}

          {/* Present dropdown */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-teal-400">
              <CheckCircle size={14} />
            </div>
            <label className="text-sm text-neutral-400 w-20 shrink-0">Present</label>
            <select
              value={formData.present}
              onChange={(e) => handleChange('present', e.target.value)}
              className="flex-1 py-2 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-green/50"
            >
              <option value="1">Present</option>
              <option value="0">Absent</option>
              <option value="E">Excused</option>
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 sticky bottom-0 bg-neutral-900">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 rounded-xl bg-brand-green text-neutral-950 font-bold text-sm hover:bg-brand-green/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              'Save All Numbers'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
