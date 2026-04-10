'use client';

/**
 * Smart Arrival Demo
 *
 * Preview of the warehouse smart-arrival sequence animation.
 * Embeds the SmartArrivalAnimation component so you can see the
 * geofence triggers fire as the truck approaches.
 *
 * The actual hardware integration (HVAC, locks, gable fan, etc.)
 * is still pending — see task #6.
 */

import Link from 'next/link';
import { ArrowLeft, Zap, Wifi, Truck, Volume2, Tv } from 'lucide-react';
import SmartArrivalAnimation from '@/components/SmartArrivalAnimation';

export default function SmartArrivalDemoPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 md:px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/portal/dashboard" className="text-zinc-500 hover:text-brand-green">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-brand-green" />
              Smart Arrival Sequence
            </h1>
            <p className="text-xs text-zinc-500">
              Geofence-driven warehouse automation preview
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* The animation */}
        <SmartArrivalAnimation durationSec={12} />

        {/* What it shows */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h2 className="text-base font-bold text-white mb-4">How it works</h2>
          <div className="space-y-3 text-sm text-zinc-300">
            <Step
              icon={<Wifi className="w-4 h-4 text-cyan-400" />}
              label="Driver app pings GPS every 30s"
              detail="Server tracks distance to warehouse origin in real time."
            />
            <Step
              icon={<Truck className="w-4 h-4 text-cyan-400" />}
              label="5-mile geofence crossed"
              detail="HVAC turns on (heat or AC depending on temp), main lights wake, gable fan starts, side walkthrough door unlocks. About 5 min head start so the warehouse is comfortable when the driver pulls up."
            />
            <Step
              icon={<Truck className="w-4 h-4 text-brand-green" />}
              label="0.25-mile geofence crossed"
              detail="Roll-up garage door opens just in time. Driver doesn't have to stop and key in a code."
            />
            <Step
              icon={<Tv className="w-4 h-4 text-amber-400" />}
              label="Arrival"
              detail="Warehouse TV powers on and casts /portal/delivery/warehouse-display showing today's route + pull list. Google Home greets the driver by name and reads the load summary."
            />
            <Step
              icon={<Volume2 className="w-4 h-4 text-amber-400" />}
              label="Loading walkthrough"
              detail="Driver opens the loading-assist page, taps Start Loading. Each item is announced over the speaker — '4 ridge vents from Warehouse A' — driver confirms each pick. When all items are loaded, ready for departure."
            />
          </div>
        </div>

        {/* What still needs to be wired */}
        <div className="bg-zinc-900 border border-amber-500/20 rounded-2xl p-5">
          <h2 className="text-base font-bold text-amber-400 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Still to wire
          </h2>
          <ul className="space-y-2 text-sm text-zinc-300 list-disc list-inside">
            <li>HVAC entity in Home Assistant (e.g. <code className="text-zinc-400">climate.warehouse_hvac</code>)</li>
            <li>Side walkthrough door lock (<code className="text-zinc-400">lock.warehouse_side_door</code>)</li>
            <li>Large gable fan switch (<code className="text-zinc-400">switch.warehouse_gable_fan</code>)</li>
            <li>Driver GPS endpoint that fires the geofence transitions</li>
            <li>Google Home media_player wired to TTS announce</li>
          </ul>
          <p className="text-xs text-zinc-500 mt-3">
            Loading bay lights, garage doors, warehouse TV (Chromecast), and speaker
            are <span className="text-brand-green">already wired</span> in{' '}
            <code className="text-zinc-400">lib/warehouse-iot-service.ts</code>.
          </p>
        </div>
      </div>
    </div>
  );
}

function Step({
  icon,
  label,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <div className="font-medium text-white">{label}</div>
        <div className="text-xs text-zinc-500 mt-0.5">{detail}</div>
      </div>
    </div>
  );
}
