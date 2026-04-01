'use client';

import { useState } from 'react';
import {
  FilePlus, ClipboardCheck, UserCheck, Bell, Package, ShieldCheck,
  LogOut, Navigation, MapPin, PackageOpen, PackageCheck, Camera,
  BellRing, Receipt, Send, BadgeDollarSign, CheckCircle2,
  ChevronRight, ImagePlus, MapPinned, Info,
  type LucideIcon,
} from 'lucide-react';
import {
  DeliveryStage, PIPELINE_STAGES, STAGE_GROUPS, StageConfig,
  getStageIndex, getStageConfig, getNextStage, isStageComplete, isStageCurrent,
} from '@/lib/delivery-pipeline';

// Icon map for dynamic rendering
const ICON_MAP: Record<string, LucideIcon> = {
  FilePlus, ClipboardCheck, UserCheck, Bell, PackageOpen: Package, ShieldCheck,
  LogOut, Navigation, MapPin, PackageCheck, Camera, BellRing, Receipt, Send,
  BadgeDollarSign, CheckCircle2,
};

function getIcon(iconName: string) {
  return ICON_MAP[iconName] || Package;
}

interface DeliveryPipelineProps {
  currentStage: DeliveryStage;
  onAdvance?: (nextStage: DeliveryStage) => void;
  compact?: boolean;
  showDetails?: boolean;
  timestamps?: Partial<Record<DeliveryStage, string>>;
  photos?: Partial<Record<DeliveryStage, number>>;
}

export default function DeliveryPipeline({
  currentStage,
  onAdvance,
  compact = false,
  showDetails = false,
  timestamps = {},
  photos = {},
}: DeliveryPipelineProps) {
  const [hoveredStage, setHoveredStage] = useState<DeliveryStage | null>(null);
  const currentIdx = getStageIndex(currentStage);
  const nextStage = getNextStage(currentStage);

  if (compact) {
    return (
      <div className="w-full">
        {/* Compact horizontal pipeline */}
        <div className="flex items-center gap-0.5 overflow-x-auto pb-2">
          {PIPELINE_STAGES.map((stage, idx) => {
            const completed = idx < currentIdx;
            const current = idx === currentIdx;
            const Icon = getIcon(stage.icon);

            return (
              <div key={stage.key} className="flex items-center">
                <div
                  className={`relative group flex-shrink-0 ${
                    compact ? 'w-8 h-8' : 'w-10 h-10'
                  } rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    completed
                      ? 'bg-green-500/20 border-2 border-green-500/50'
                      : current
                      ? `${stage.bgColor} border-2 ${stage.borderColor} ring-2 ring-offset-1 ring-offset-black ring-current`
                      : 'bg-zinc-800/50 border border-zinc-700/50'
                  }`}
                  onMouseEnter={() => setHoveredStage(stage.key)}
                  onMouseLeave={() => setHoveredStage(null)}
                  title={stage.label}
                >
                  <Icon
                    size={compact ? 14 : 16}
                    className={
                      completed ? 'text-green-400' : current ? stage.color : 'text-zinc-600'
                    }
                  />
                  {/* Tooltip */}
                  {hoveredStage === stage.key && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 min-w-max">
                      <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl">
                        <p className={`text-xs font-bold ${stage.color}`}>{stage.label}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{stage.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {stage.requiresPhoto && (
                            <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                              <Camera size={10} /> Photo
                            </span>
                          )}
                          {stage.requiresGPS && (
                            <span className="text-[10px] text-blue-400 flex items-center gap-0.5">
                              <MapPinned size={10} /> GPS
                            </span>
                          )}
                        </div>
                        {timestamps[stage.key] && (
                          <p className="text-[10px] text-zinc-500 mt-1">
                            {new Date(timestamps[stage.key]!).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {idx < PIPELINE_STAGES.length - 1 && (
                  <div
                    className={`w-2 h-0.5 flex-shrink-0 ${
                      idx < currentIdx ? 'bg-green-500/50' : 'bg-zinc-800'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Current stage label */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${getStageConfig(currentStage).color}`}>
              {getStageConfig(currentStage).label}
            </span>
            <span className="text-[10px] text-zinc-600">
              Step {currentIdx + 1} of {PIPELINE_STAGES.length}
            </span>
          </div>
          {nextStage && onAdvance && (
            <button
              onClick={() => onAdvance(nextStage)}
              className="flex items-center gap-1 px-2 py-1 bg-brand-green/15 text-brand-green rounded text-[11px] font-bold hover:bg-brand-green/25 transition-colors"
            >
              {getStageConfig(nextStage).actionLabel}
              <ChevronRight size={12} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Full visual pipeline grouped by phase
  return (
    <div className="w-full space-y-4">
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-1">
        <div className="flex-1 bg-zinc-800 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-brand-green to-green-400 h-full rounded-full transition-all duration-500"
            style={{ width: `${((currentIdx + 1) / PIPELINE_STAGES.length) * 100}%` }}
          />
        </div>
        <span className="text-xs font-bold text-white">
          {currentIdx + 1}/{PIPELINE_STAGES.length}
        </span>
      </div>

      {/* Grouped stages */}
      {STAGE_GROUPS.map(group => {
        const groupStages = PIPELINE_STAGES.filter(s => s.group === group.key);
        const allComplete = groupStages.every(s => isStageComplete(currentStage, s.key));
        const hasActive = groupStages.some(s => isStageCurrent(currentStage, s.key));

        return (
          <div key={group.key} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${
                allComplete ? 'text-green-500' : hasActive ? group.color : 'text-zinc-600'
              }`}>
                {group.label}
              </span>
              {allComplete && <CheckCircle2 size={12} className="text-green-500" />}
            </div>

            <div className="space-y-1">
              {groupStages.map(stage => {
                const idx = getStageIndex(stage.key);
                const completed = idx < currentIdx;
                const current = idx === currentIdx;
                const Icon = getIcon(stage.icon);

                return (
                  <div
                    key={stage.key}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                      completed
                        ? 'bg-green-500/5 border border-green-500/20'
                        : current
                        ? `${stage.bgColor} border-2 ${stage.borderColor} shadow-lg shadow-current/5`
                        : 'bg-zinc-900/30 border border-zinc-800/50 opacity-50'
                    }`}
                  >
                    {/* Status indicator */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      completed
                        ? 'bg-green-500/20'
                        : current
                        ? stage.bgColor
                        : 'bg-zinc-800/50'
                    }`}>
                      {completed ? (
                        <CheckCircle2 size={16} className="text-green-400" />
                      ) : (
                        <Icon size={16} className={current ? stage.color : 'text-zinc-600'} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${
                          completed ? 'text-green-400' : current ? 'text-white' : 'text-zinc-600'
                        }`}>
                          {stage.label}
                        </span>
                        {stage.requiresPhoto && (
                          <span className={`text-[10px] flex items-center gap-0.5 ${
                            completed ? 'text-green-500/60' : current ? 'text-amber-400' : 'text-zinc-700'
                          }`}>
                            <Camera size={10} />
                            {(photos[stage.key] ?? 0) > 0 && `${photos[stage.key]}`}
                          </span>
                        )}
                        {stage.requiresGPS && (
                          <span className={`text-[10px] flex items-center gap-0.5 ${
                            completed ? 'text-green-500/60' : current ? 'text-blue-400' : 'text-zinc-700'
                          }`}>
                            <MapPinned size={10} /> GPS
                          </span>
                        )}
                      </div>
                      {showDetails && (
                        <p className={`text-[11px] mt-0.5 ${
                          completed ? 'text-green-500/50' : current ? 'text-zinc-400' : 'text-zinc-700'
                        }`}>
                          {stage.description}
                        </p>
                      )}
                      {timestamps[stage.key] && (
                        <p className="text-[10px] text-zinc-600 mt-0.5">
                          {new Date(timestamps[stage.key]!).toLocaleString()}
                        </p>
                      )}
                    </div>

                    {/* Action button for current stage */}
                    {current && nextStage && onAdvance && (
                      <button
                        onClick={() => onAdvance(nextStage)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-brand-green text-black rounded-lg text-xs font-bold hover:brightness-90 transition-all flex-shrink-0"
                      >
                        {getStageConfig(nextStage).actionLabel}
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Mini badge showing current stage
export function StageBadge({ stage }: { stage: DeliveryStage }) {
  const config = getStageConfig(stage);
  const Icon = getIcon(config.icon);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${config.bgColor} ${config.color} border ${config.borderColor}`}>
      <Icon size={12} />
      {config.shortLabel}
    </span>
  );
}
