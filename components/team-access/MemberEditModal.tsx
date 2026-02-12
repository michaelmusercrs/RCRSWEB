'use client';

import * as React from 'react';
import { X, Check, RotateCcw, Shield, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ROLE_DISPLAY_NAMES,
  COMMAND_CENTER_ACCESS,
  ALL_COMMAND_CENTER_MODULES,
  MODULE_DISPLAY_NAMES,
  type TeamRole,
} from '@/lib/team-roles';
import type { TeamMemberAccessData } from './TeamMemberCard';

interface MemberEditModalProps {
  member: TeamMemberAccessData;
  onClose: () => void;
  onSave: (memberId: string, overrides: Record<string, boolean>) => Promise<void>;
}

export function MemberEditModal({ member, onClose, onSave }: MemberEditModalProps) {
  const defaultAccess = COMMAND_CENTER_ACCESS[member.role] || [];

  // Build initial module states from current overrides
  const [moduleStates, setModuleStates] = React.useState<Record<string, boolean>>(() => {
    const states: Record<string, boolean> = {};
    for (const mod of ALL_COMMAND_CENTER_MODULES) {
      const isDefault = defaultAccess.includes(mod);
      const hasOverride = mod in member.overrides;
      states[mod] = hasOverride ? member.overrides[mod] : isDefault;
    }
    return states;
  });

  const [isSaving, setIsSaving] = React.useState(false);

  // Calculate what the overrides object should be (only non-default values)
  const calculateOverrides = (): Record<string, boolean> => {
    const overrides: Record<string, boolean> = {};
    for (const mod of ALL_COMMAND_CENTER_MODULES) {
      const isDefault = defaultAccess.includes(mod);
      const currentState = moduleStates[mod];
      // Only store overrides that differ from the role default
      if (currentState !== isDefault) {
        overrides[mod] = currentState;
      }
    }
    return overrides;
  };

  const handleToggle = (mod: string) => {
    setModuleStates(prev => ({ ...prev, [mod]: !prev[mod] }));
  };

  const handleResetToDefaults = () => {
    const states: Record<string, boolean> = {};
    for (const mod of ALL_COMMAND_CENTER_MODULES) {
      states[mod] = defaultAccess.includes(mod);
    }
    setModuleStates(states);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const overrides = calculateOverrides();
      await onSave(member.id, overrides);
    } finally {
      setIsSaving(false);
    }
  };

  const overrides = calculateOverrides();
  const hasChanges = JSON.stringify(overrides) !== JSON.stringify(member.overrides);
  const overrideCount = Object.keys(overrides).length;

  // Close on escape
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6 py-4 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-white">Edit Access: {member.name}</h2>
            <div className="mt-1 flex items-center gap-2">
              <Shield size={14} className="text-zinc-500" />
              <span className="text-sm text-zinc-400">
                {ROLE_DISPLAY_NAMES[member.role]} - {member.email}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Role Default Info */}
          <div className="rounded-lg bg-zinc-800/50 p-3">
            <p className="text-sm font-medium text-zinc-300">
              Default for {ROLE_DISPLAY_NAMES[member.role]}:
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {defaultAccess.map(m => MODULE_DISPLAY_NAMES[m] || m).join(', ') || 'None'}
            </p>
          </div>

          {/* Module Toggles */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-zinc-300 uppercase tracking-wider">
              Command Center Modules
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {ALL_COMMAND_CENTER_MODULES.map(mod => {
                const isEnabled = moduleStates[mod];
                const isDefault = defaultAccess.includes(mod);
                const isOverride = isEnabled !== isDefault;

                return (
                  <button
                    key={mod}
                    onClick={() => handleToggle(mod)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-all',
                      isEnabled
                        ? isOverride
                          ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
                          : 'border-zinc-700 bg-zinc-800 text-white'
                        : isOverride
                          ? 'border-red-500/30 bg-red-500/5 text-red-400'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-500'
                    )}
                  >
                    <div className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                      isEnabled
                        ? isOverride
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : 'border-lime-500 bg-lime-500 text-zinc-900'
                        : 'border-zinc-600 bg-zinc-800'
                    )}>
                      {isEnabled && <Check size={12} />}
                    </div>
                    <span className="flex-1 truncate font-medium">
                      {MODULE_DISPLAY_NAMES[mod] || mod}
                    </span>
                    {isOverride && (
                      <span className={cn(
                        'shrink-0 text-xs',
                        isEnabled ? 'text-blue-400' : 'text-red-400'
                      )}>
                        {isEnabled ? <Plus size={12} /> : <Minus size={12} />}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Override Legend */}
          {overrideCount > 0 && (
            <div className="rounded-lg border border-zinc-800 p-3 space-y-1">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Legend</p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-zinc-400">
                  <span className="h-2.5 w-2.5 rounded bg-lime-500" /> Default
                </span>
                <span className="flex items-center gap-1.5 text-blue-400">
                  <span className="h-2.5 w-2.5 rounded bg-blue-500" /> Added (custom)
                </span>
                <span className="flex items-center gap-1.5 text-red-400">
                  <span className="h-2.5 w-2.5 rounded border border-red-500/50" /> Removed
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {overrideCount} custom override{overrideCount !== 1 ? 's' : ''} from role defaults
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between border-t border-zinc-800 bg-zinc-900 px-6 py-4 rounded-b-xl">
          <button
            onClick={handleResetToDefaults}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <RotateCcw size={14} />
            Reset to Defaults
          </button>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-lime-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900/20 border-t-zinc-900" />
                  Saving...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
