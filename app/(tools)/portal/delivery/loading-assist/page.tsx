'use client';

/**
 * Loading Assist (TTS Walkthrough)
 *
 * Walks the warehouse worker through today's loading sequence step by step.
 * At each item, it announces the pick over the warehouse Google Home / speaker
 * via /api/portal/delivery/iot action=announce, then waits for the worker
 * to confirm before advancing.
 *
 * The sequence is computed by /api/portal/delivery/loading-plan and follows
 * the spec rules: heaviest first, last-stop loaded first, grouped by bay.
 *
 * No mock data — everything pulls from the live pipeline.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  CheckCircle,
  Volume2,
  VolumeX,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Loader2,
  MapPin,
  Weight,
  AlertTriangle,
  Truck,
  Sparkles,
} from 'lucide-react';

interface LoadingPlanItem {
  itemId: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unit: string;
  weightLbs: number;
  unitWeightLbs: number;
  location: string;
  loadOrder: number;
  audioMessage: string;
  orderId: string;
  jobName: string;
  pulled: boolean;
}

interface DailyLoadingPlan {
  date: string;
  totalOrders: number;
  totalStops: number;
  loadingSequence: LoadingPlanItem[];
  generatedAt: string;
}

export default function LoadingAssistPage() {
  const [plan, setPlan] = useState<DailyLoadingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [iotConfigured, setIotConfigured] = useState<boolean | null>(null);
  const [lastAnnounce, setLastAnnounce] = useState<string | null>(null);

  // Browser TTS fallback if HA isn't reachable
  const browserSynth = useRef<SpeechSynthesis | null>(null);
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      browserSynth.current = window.speechSynthesis;
    }
  }, []);

  const fetchPlan = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/delivery/loading-plan');
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load plan');
      }
      const data = await res.json();
      setPlan(data);
      setError(null);
      // Initialize confirmed set from items already pulled
      const alreadyPulled = new Set<string>(
        (data.loadingSequence as LoadingPlanItem[])
          .filter((i) => i.pulled)
          .map((i) => i.itemId)
      );
      setConfirmed(alreadyPulled);
      // Jump to the first non-confirmed item
      const firstUnconfirmed = (data.loadingSequence as LoadingPlanItem[]).findIndex(
        (i) => !alreadyPulled.has(i.itemId)
      );
      setCurrentIdx(firstUnconfirmed === -1 ? data.loadingSequence.length : firstUnconfirmed);
    } catch (err) {
      console.error('[loading-assist] fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load plan');
    } finally {
      setLoading(false);
    }
  }, []);

  // Check IoT availability on mount
  useEffect(() => {
    fetch('/api/portal/delivery/iot')
      .then((r) => r.json())
      .then((d) => setIotConfigured(Boolean(d?.configured)))
      .catch(() => setIotConfigured(false));
  }, []);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  /**
   * Speak a phrase: try the warehouse Google Home first via HA TTS,
   * then fall back to the browser SpeechSynthesis API so it works
   * even when the IoT isn't configured (useful for testing).
   */
  const speak = useCallback(
    async (message: string) => {
      if (!audioEnabled) return;
      setLastAnnounce(message);

      // Try HA-based announcement first
      if (iotConfigured) {
        try {
          const res = await fetch('/api/portal/delivery/iot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'announce', message }),
          });
          if (res.ok) return;
        } catch (err) {
          console.warn('[loading-assist] HA announce failed, falling back:', err);
        }
      }

      // Browser fallback
      if (browserSynth.current) {
        browserSynth.current.cancel();
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 0.95;
        utterance.pitch = 1;
        utterance.volume = 1;
        browserSynth.current.speak(utterance);
      }
    },
    [audioEnabled, iotConfigured]
  );

  // When advancing to a new item while running, speak it
  useEffect(() => {
    if (!running || !plan) return;
    const item = plan.loadingSequence[currentIdx];
    if (item) speak(item.audioMessage);
    // We intentionally only fire on currentIdx change; eslint may complain
    // but this is the right behavior — speak ONCE per advancement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, running]);

  const start = () => {
    if (!plan || plan.loadingSequence.length === 0) return;
    setRunning(true);
    speak(`Starting loading. ${plan.loadingSequence.length} items today. First up:`);
    // Slight delay so the intro plays before the first item
    setTimeout(() => {
      const item = plan.loadingSequence[currentIdx];
      if (item) speak(item.audioMessage);
    }, 2500);
  };

  const pause = () => {
    setRunning(false);
    if (browserSynth.current) browserSynth.current.cancel();
  };

  const confirmCurrent = async () => {
    if (!plan) return;
    const item = plan.loadingSequence[currentIdx];
    if (!item) return;
    const newConfirmed = new Set(confirmed);
    newConfirmed.add(item.itemId);
    setConfirmed(newConfirmed);

    // Move to next unconfirmed
    let next = currentIdx + 1;
    while (
      next < plan.loadingSequence.length &&
      newConfirmed.has(plan.loadingSequence[next].itemId)
    ) {
      next++;
    }
    setCurrentIdx(next);

    if (next >= plan.loadingSequence.length) {
      setRunning(false);
      speak('All items loaded. Ready for departure.');
    }
  };

  const skip = () => {
    if (!plan) return;
    const next = Math.min(currentIdx + 1, plan.loadingSequence.length);
    setCurrentIdx(next);
    if (next < plan.loadingSequence.length && running) {
      speak(plan.loadingSequence[next].audioMessage);
    }
  };

  const reset = () => {
    setRunning(false);
    setConfirmed(new Set());
    setCurrentIdx(0);
    if (browserSynth.current) browserSynth.current.cancel();
  };

  if (loading && !plan) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-brand-green animate-spin mx-auto mb-3" />
          <p className="text-zinc-400">Loading plan...</p>
        </div>
      </div>
    );
  }

  if (error && !plan) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white mb-2">Plan Unavailable</h2>
          <p className="text-zinc-400">{error}</p>
          <Link
            href="/portal/delivery"
            className="mt-4 inline-block text-brand-green hover:underline"
          >
            Back to Delivery
          </Link>
        </div>
      </div>
    );
  }

  if (!plan) return null;

  const totalItems = plan.loadingSequence.length;
  const completedItems = confirmed.size;
  const currentItem = plan.loadingSequence[currentIdx];
  const isComplete = completedItems >= totalItems && totalItems > 0;
  const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 md:px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/portal/delivery" className="text-zinc-500 hover:text-brand-green">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-green" />
                Loading Assistant
              </h1>
              <p className="text-xs text-zinc-500">
                TTS-driven loading walkthrough · {plan.totalOrders} orders today
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {iotConfigured && (
              <button
                onClick={async () => {
                  try {
                    const url = `${window.location.origin}/portal/delivery/warehouse-display`;
                    const res = await fetch('/api/portal/delivery/iot', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'display', url }),
                    });
                    if (res.ok) {
                      speak('Loading plan now showing on warehouse TV.');
                    }
                  } catch (err) {
                    console.error('Cast failed:', err);
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/25 text-sm font-bold"
                title="Cast warehouse display to TV"
              >
                <Truck className="w-4 h-4" />
                Cast to TV
              </button>
            )}
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`p-2 rounded-lg transition-colors ${
                audioEnabled
                  ? 'bg-brand-green/15 text-brand-green border border-brand-green/30'
                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
              }`}
              title={audioEnabled ? 'Mute announcements' : 'Enable announcements'}
            >
              {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            {iotConfigured === false && (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                HA offline · using browser TTS
              </span>
            )}
            {iotConfigured === true && (
              <span className="text-xs text-brand-green">Google Home ready</span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>
              {completedItems} of {totalItems} loaded
            </span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-green transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
        {totalItems === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Nothing to Load</h2>
            <p className="text-zinc-500">No loadable orders in the pipeline right now.</p>
          </div>
        ) : isComplete ? (
          <div className="text-center py-16">
            <CheckCircle className="w-20 h-20 text-brand-green mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-2">Loading Complete</h2>
            <p className="text-zinc-400 text-lg mb-6">
              All {totalItems} items loaded · ready for departure
            </p>
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Start Over
            </button>
          </div>
        ) : (
          <>
            {/* Current item — the big focus card */}
            {currentItem && (
              <div className="bg-zinc-900 border-2 border-brand-green/40 rounded-3xl p-8 mb-6 shadow-[0_0_60px_rgba(57,255,20,0.15)]">
                <div className="flex items-center gap-2 text-brand-green text-sm font-bold uppercase tracking-wider mb-3">
                  <Package className="w-4 h-4" />
                  Now Loading · Item {currentIdx + 1} of {totalItems}
                </div>
                <div className="text-6xl md:text-7xl font-black text-white mb-3 leading-none">
                  <span className="text-brand-green">{currentItem.quantity}×</span>{' '}
                  {currentItem.productName}
                </div>
                <div className="grid md:grid-cols-3 gap-3 mt-6">
                  <InfoTile
                    icon={<MapPin className="w-5 h-5" />}
                    label="From"
                    value={currentItem.location}
                  />
                  <InfoTile
                    icon={<Weight className="w-5 h-5" />}
                    label="Weight"
                    value={`${currentItem.weightLbs} lbs`}
                  />
                  <InfoTile
                    icon={<Truck className="w-5 h-5" />}
                    label="For"
                    value={currentItem.jobName}
                  />
                </div>

                {/* Action buttons */}
                <div className="mt-8 flex items-center gap-3">
                  {!running ? (
                    <button
                      onClick={start}
                      className="flex items-center gap-2 px-6 py-4 bg-brand-green text-black rounded-2xl hover:brightness-90 font-bold text-lg transition-all"
                    >
                      <Play className="w-5 h-5" />
                      Start Loading
                    </button>
                  ) : (
                    <button
                      onClick={pause}
                      className="flex items-center gap-2 px-6 py-4 bg-zinc-800 text-zinc-300 rounded-2xl hover:bg-zinc-700 font-bold text-lg transition-all"
                    >
                      <Pause className="w-5 h-5" />
                      Pause
                    </button>
                  )}
                  <button
                    onClick={confirmCurrent}
                    className="flex items-center gap-2 px-6 py-4 bg-brand-green/15 text-brand-green border border-brand-green/40 rounded-2xl hover:bg-brand-green/25 font-bold text-lg transition-all flex-1 justify-center"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Loaded — Next Item
                  </button>
                  <button
                    onClick={skip}
                    className="p-4 bg-zinc-800 text-zinc-400 rounded-2xl hover:bg-zinc-700 transition-colors"
                    title="Skip this item"
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>
                </div>

                {lastAnnounce && (
                  <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-300 text-sm flex items-start gap-2">
                    <Volume2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="italic">&ldquo;{lastAnnounce}&rdquo;</span>
                  </div>
                )}
              </div>
            )}

            {/* Up next */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">
                Up Next
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {plan.loadingSequence.slice(currentIdx + 1, currentIdx + 8).map((item, idx) => (
                  <div
                    key={item.itemId}
                    className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/50"
                  >
                    <span className="text-xs font-bold text-zinc-600 w-6 text-right">
                      #{currentIdx + 2 + idx}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm truncate">
                        <span className="text-amber-400 font-bold">{item.quantity}×</span>{' '}
                        {item.productName}
                      </div>
                      <div className="text-xs text-zinc-500 truncate">
                        {item.location} · {item.jobName}
                      </div>
                    </div>
                  </div>
                ))}
                {plan.loadingSequence.length - currentIdx - 1 > 7 && (
                  <div className="text-xs text-zinc-600 text-center pt-2">
                    +{plan.loadingSequence.length - currentIdx - 1 - 7} more items
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-zinc-800/50 rounded-xl p-3 flex items-start gap-3">
      <div className="text-zinc-500 flex-shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-zinc-500 uppercase tracking-wider">{label}</div>
        <div className="text-white font-medium truncate">{value}</div>
      </div>
    </div>
  );
}
