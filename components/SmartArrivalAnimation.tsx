'use client';

/**
 * SmartArrivalAnimation
 *
 * A tiny self-contained CSS/SVG animation showing the warehouse
 * smart-arrival sequence as the driver approaches:
 *
 *   1. Driver crosses the 5-mile geofence:
 *        HVAC on → lights wake → gable fan spins → side door unlocks
 *   2. Driver crosses the 0.25-mile geofence:
 *        Garage door rolls open
 *   3. Driver arrives:
 *        TV powers on, displays "Today's Loading"
 *   4. Driver departs (loop reset)
 *
 * Pure CSS @keyframes — no JS state machine, no external deps.
 * Loops every 12 seconds. Embeddable anywhere.
 */

import { useState } from 'react';

interface Props {
  /** Override the loop duration in seconds. Default: 12s. */
  durationSec?: number;
  /** Show the legend at the bottom. Default: true. */
  showLegend?: boolean;
}

export default function SmartArrivalAnimation({
  durationSec = 12,
  showLegend = true,
}: Props) {
  const [paused, setPaused] = useState(false);

  return (
    <div className="relative bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden">
      <style jsx>{`
        :root {
          --duration: ${durationSec}s;
        }

        .scene {
          animation-duration: ${durationSec}s;
          animation-iteration-count: infinite;
          animation-timing-function: linear;
          animation-play-state: ${paused ? 'paused' : 'running'};
        }

        /* === Truck moves from right edge inward === */
        @keyframes truck-approach {
          0%   { transform: translateX(280px); }
          25%  { transform: translateX(140px); } /* crossed 5-mile ring */
          55%  { transform: translateX(40px);  } /* crossed 0.25-mile ring */
          70%  { transform: translateX(-30px); } /* arrived at warehouse */
          85%  { transform: translateX(-30px); } /* parked, loading */
          100% { transform: translateX(280px); } /* departed */
        }

        /* === 5-mile ring pulses when crossed === */
        @keyframes ring-5mi {
          0%, 24%   { stroke-opacity: 0.15; stroke-width: 1; }
          25%, 30%  { stroke-opacity: 0.9;  stroke-width: 3; }
          31%, 100% { stroke-opacity: 0.4;  stroke-width: 1.5; }
        }

        /* === 0.25-mile ring pulses when crossed === */
        @keyframes ring-quarter {
          0%, 54%   { stroke-opacity: 0.15; stroke-width: 1; }
          55%, 60%  { stroke-opacity: 0.9;  stroke-width: 3; }
          61%, 100% { stroke-opacity: 0.4;  stroke-width: 1.5; }
        }

        /* === HVAC fires at 5-mile crossing (25%) === */
        @keyframes hvac-on {
          0%, 24%   { color: #52525b; transform: scale(1); }
          25%, 100% { color: #06b6d4; transform: scale(1.05); }
        }

        /* === Lights turn on at 5-mile crossing === */
        @keyframes lights-on {
          0%, 24%   { color: #52525b; filter: drop-shadow(0 0 0 transparent); }
          25%, 100% { color: #fbbf24; filter: drop-shadow(0 0 8px #fbbf24aa); }
        }

        /* === Gable fan spins after 5-mile crossing === */
        @keyframes fan-idle {
          0%, 24% { transform: rotate(0deg); }
        }
        @keyframes fan-spin {
          25%  { transform: rotate(0deg); }
          100% { transform: rotate(2160deg); } /* 6 full revolutions */
        }
        @keyframes fan-color {
          0%, 24%   { color: #52525b; }
          25%, 100% { color: #39FF14; }
        }

        /* === Side door unlocks at 5-mile crossing === */
        @keyframes lock-unlock {
          0%, 24%   { color: #ef4444; transform: rotate(0deg); }
          25%, 100% { color: #39FF14; transform: rotate(-15deg); }
        }

        /* === Garage door opens at 0.25-mile crossing === */
        @keyframes door-open {
          0%, 54%   { transform: scaleY(1);   }
          55%, 65%  { transform: scaleY(0.05); }
          90%, 100% { transform: scaleY(1);   }
        }

        /* === TV powers on at arrival, loops content === */
        @keyframes tv-on {
          0%, 64%   { opacity: 0; }
          70%, 95%  { opacity: 1; }
          100%      { opacity: 0; }
        }

        /* === Trigger labels fade in at the right time === */
        @keyframes label-5mi {
          0%, 22%   { opacity: 0; transform: translateY(4px); }
          25%, 50%  { opacity: 1; transform: translateY(0);   }
          53%, 100% { opacity: 0; transform: translateY(-4px); }
        }
        @keyframes label-quarter {
          0%, 52%   { opacity: 0; transform: translateY(4px); }
          55%, 78%  { opacity: 1; transform: translateY(0);   }
          81%, 100% { opacity: 0; transform: translateY(-4px); }
        }
        @keyframes label-arrive {
          0%, 67%   { opacity: 0; transform: translateY(4px); }
          70%, 90%  { opacity: 1; transform: translateY(0);   }
          93%, 100% { opacity: 0; transform: translateY(-4px); }
        }

        .truck         { animation-name: truck-approach; }
        .ring-5mi      { animation-name: ring-5mi; }
        .ring-quarter  { animation-name: ring-quarter; }
        .hvac          { animation-name: hvac-on; }
        .lights        { animation-name: lights-on; }
        .fan-blade     { animation-name: fan-spin; transform-origin: center; }
        .fan-icon      { animation-name: fan-color; }
        .lock          { animation-name: lock-unlock; transform-origin: center; }
        .garage-door   { animation-name: door-open; transform-origin: top; }
        .tv-screen     { animation-name: tv-on; }
        .label-5mi     { animation-name: label-5mi; }
        .label-quarter { animation-name: label-quarter; }
        .label-arrive  { animation-name: label-arrive; }
      `}</style>

      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Smart Arrival Sequence</h3>
          <p className="text-[11px] text-zinc-500">
            Geofence-driven warehouse automation
          </p>
        </div>
        <button
          onClick={() => setPaused(!paused)}
          className="text-xs px-2 py-1 rounded border border-zinc-700 text-zinc-400 hover:text-brand-green hover:border-brand-green transition-colors"
        >
          {paused ? 'Play' : 'Pause'}
        </button>
      </div>

      {/* The animated scene */}
      <div className="relative h-80 bg-gradient-to-b from-zinc-950 to-zinc-900 overflow-hidden">
        <svg
          viewBox="0 0 400 320"
          className="w-full h-full"
          aria-label="Smart arrival animation"
        >
          {/* Background grid */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#27272a" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="400" height="320" fill="url(#grid)" />

          {/* Geofence rings centered on warehouse (90, 160) */}
          <circle
            cx="90"
            cy="160"
            r="190"
            fill="none"
            stroke="#06b6d4"
            strokeDasharray="4 4"
            className="scene ring-5mi"
          />
          <circle
            cx="90"
            cy="160"
            r="60"
            fill="none"
            stroke="#39FF14"
            strokeDasharray="3 3"
            className="scene ring-quarter"
          />

          {/* Geofence labels */}
          <text x="270" y="155" fill="#06b6d4" fontSize="9" fontWeight="600">
            5 mi
          </text>
          <text x="142" y="155" fill="#39FF14" fontSize="8" fontWeight="600">
            0.25 mi
          </text>

          {/* Warehouse building */}
          <g transform="translate(50, 110)">
            {/* Body */}
            <rect width="80" height="100" fill="#18181b" stroke="#3f3f46" strokeWidth="1.5" rx="2" />
            {/* Roof */}
            <polygon points="0,0 40,-15 80,0" fill="#27272a" stroke="#3f3f46" strokeWidth="1.5" />

            {/* Side walkthrough door (with lock) */}
            <rect x="6" y="60" width="14" height="38" fill="#27272a" stroke="#3f3f46" strokeWidth="1" />
            <g className="scene lock" style={{ transformOrigin: '13px 79px' }}>
              <circle cx="13" cy="79" r="3" fill="currentColor" />
            </g>

            {/* Garage roll-up door (animated) */}
            <g className="scene garage-door" style={{ transformOrigin: '50px 60px' }}>
              <rect x="28" y="60" width="44" height="40" fill="#0a0a0a" stroke="#3f3f46" strokeWidth="1" />
              {/* Door panels */}
              <line x1="28" y1="68" x2="72" y2="68" stroke="#27272a" strokeWidth="0.5" />
              <line x1="28" y1="76" x2="72" y2="76" stroke="#27272a" strokeWidth="0.5" />
              <line x1="28" y1="84" x2="72" y2="84" stroke="#27272a" strokeWidth="0.5" />
              <line x1="28" y1="92" x2="72" y2="92" stroke="#27272a" strokeWidth="0.5" />
            </g>

            {/* Lightbulb (over garage) */}
            <g className="scene lights">
              <circle cx="50" cy="55" r="3" fill="currentColor" />
              <line x1="50" y1="50" x2="50" y2="48" stroke="currentColor" strokeWidth="1" />
            </g>

            {/* HVAC unit (right side) */}
            <g className="scene hvac" style={{ transformOrigin: '78px 35px' }}>
              <rect x="74" y="30" width="10" height="14" fill="currentColor" rx="1" />
              <line x1="76" y1="33" x2="82" y2="33" stroke="#0a0a0a" strokeWidth="0.5" />
              <line x1="76" y1="36" x2="82" y2="36" stroke="#0a0a0a" strokeWidth="0.5" />
              <line x1="76" y1="39" x2="82" y2="39" stroke="#0a0a0a" strokeWidth="0.5" />
            </g>

            {/* Gable fan (left side, spinning) */}
            <g transform="translate(-8, 35)">
              <circle cx="0" cy="0" r="9" fill="#0a0a0a" stroke="#3f3f46" strokeWidth="1" className="scene fan-icon" />
              <g className="scene fan-blade fan-icon">
                <path d="M 0,-7 L 1.5,-1 L -1.5,-1 Z" fill="currentColor" />
                <path d="M 6.5,3.5 L 0.7,1.7 L 1.3,-1.3 Z" fill="currentColor" />
                <path d="M -6.5,3.5 L -1.3,-1.3 L -0.7,1.7 Z" fill="currentColor" />
              </g>
              <circle cx="0" cy="0" r="1" fill="#71717a" />
            </g>

            {/* TV inside warehouse (visible when on) */}
            <g className="scene tv-screen">
              <rect x="32" y="20" width="36" height="22" fill="#39FF14" rx="1" opacity="0.9" />
              <text x="50" y="29" textAnchor="middle" fontSize="4" fill="#000" fontWeight="700">
                TODAY&apos;S LOADING
              </text>
              <text x="50" y="36" textAnchor="middle" fontSize="3" fill="#000">
                3 stops · 8.4k lbs
              </text>
              <line x1="48" y1="42" x2="52" y2="42" stroke="#39FF14" strokeWidth="1" />
            </g>
          </g>

          {/* Truck (animated, approaches from the right) */}
          <g className="scene truck" transform="translate(140, 200)">
            {/* Cab */}
            <rect x="0" y="-8" width="14" height="14" fill="#39FF14" rx="1.5" />
            <rect x="2" y="-6" width="6" height="4" fill="#0a0a0a" />
            {/* Trailer */}
            <rect x="14" y="-12" width="22" height="18" fill="#fafafa" stroke="#27272a" strokeWidth="0.5" rx="1" />
            <text x="25" y="0" textAnchor="middle" fontSize="5" fill="#39FF14" fontWeight="800">
              RCRS
            </text>
            {/* Wheels */}
            <circle cx="4"  cy="8" r="2.5" fill="#27272a" stroke="#52525b" strokeWidth="0.5" />
            <circle cx="18" cy="8" r="2.5" fill="#27272a" stroke="#52525b" strokeWidth="0.5" />
            <circle cx="32" cy="8" r="2.5" fill="#27272a" stroke="#52525b" strokeWidth="0.5" />
          </g>

          {/* Trigger labels (fade in at the right moment) */}
          <g className="scene label-5mi" transform="translate(220, 60)">
            <rect x="-2" y="-12" width="160" height="56" fill="#0a0a0a" stroke="#06b6d4" strokeWidth="1" rx="3" opacity="0.9" />
            <text x="78" y="-1" textAnchor="middle" fill="#06b6d4" fontSize="8" fontWeight="700">
              5 MILES OUT — TRIGGERS:
            </text>
            <text x="78" y="11" textAnchor="middle" fill="#fafafa" fontSize="7">
              HVAC on · Lights on
            </text>
            <text x="78" y="22" textAnchor="middle" fill="#fafafa" fontSize="7">
              Gable fan on · Side door unlock
            </text>
            <text x="78" y="33" textAnchor="middle" fill="#71717a" fontSize="6">
              ~5 min head start
            </text>
          </g>

          <g className="scene label-quarter" transform="translate(220, 60)">
            <rect x="-2" y="-12" width="160" height="44" fill="#0a0a0a" stroke="#39FF14" strokeWidth="1" rx="3" opacity="0.9" />
            <text x="78" y="-1" textAnchor="middle" fill="#39FF14" fontSize="8" fontWeight="700">
              0.25 MI — TRIGGERS:
            </text>
            <text x="78" y="11" textAnchor="middle" fill="#fafafa" fontSize="7">
              Garage door rolls open
            </text>
            <text x="78" y="22" textAnchor="middle" fill="#71717a" fontSize="6">
              Just in time for arrival
            </text>
          </g>

          <g className="scene label-arrive" transform="translate(220, 60)">
            <rect x="-2" y="-12" width="160" height="44" fill="#0a0a0a" stroke="#fbbf24" strokeWidth="1" rx="3" opacity="0.9" />
            <text x="78" y="-1" textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="700">
              ARRIVED — TRIGGERS:
            </text>
            <text x="78" y="11" textAnchor="middle" fill="#fafafa" fontSize="7">
              TV displays today&apos;s loading
            </text>
            <text x="78" y="22" textAnchor="middle" fill="#fafafa" fontSize="7">
              Google Home greets driver
            </text>
          </g>
        </svg>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="px-4 py-3 border-t border-zinc-800 grid grid-cols-3 gap-2 text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-cyan-500" />
            <span className="text-zinc-400">5-mile geofence</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-brand-green" />
            <span className="text-zinc-400">0.25-mile geofence</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-zinc-400">Arrival</span>
          </div>
        </div>
      )}
    </div>
  );
}
