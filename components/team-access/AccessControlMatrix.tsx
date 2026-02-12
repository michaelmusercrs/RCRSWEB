'use client';

import * as React from 'react';
import { Check, X, RotateCcw, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  COMMAND_CENTER_ACCESS,
  MODULE_DISPLAY_NAMES,
  type TeamRole,
} from '@/lib/team-roles';
import type { TeamMemberAccessData } from './TeamMemberCard';

interface AccessControlMatrixProps {
  members: TeamMemberAccessData[];
  allModules: string[];
  onSaveOverrides: (memberId: string, overrides: Record<string, boolean>) => Promise<void>;
}

export function AccessControlMatrix({
  members,
  allModules,
  onSaveOverrides,
}: AccessControlMatrixProps) {
  // Track pending changes (memberId -> module -> enabled)
  const [pendingChanges, setPendingChanges] = React.useState<
    Record<string, Record<string, boolean>>
  >({});
  const [savingMember, setSavingMember] = React.useState<string | null>(null);
  const [isSavingAll, setIsSavingAll] = React.useState(false);

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  const getEffectiveState = (member: TeamMemberAccessData, mod: string): boolean => {
    const pending = pendingChanges[member.id];
    if (pending && mod in pending) return pending[mod];
    return member.effectiveAccess.includes(mod);
  };

  const isDefault = (member: TeamMemberAccessData, mod: string): boolean => {
    return (COMMAND_CENTER_ACCESS[member.role] || []).includes(mod);
  };

  const isOverridden = (member: TeamMemberAccessData, mod: string): boolean => {
    const pending = pendingChanges[member.id];
    if (pending && mod in pending) {
      return pending[mod] !== isDefault(member, mod);
    }
    return mod in member.overrides;
  };

  const handleToggle = (memberId: string, mod: string) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    const currentState = getEffectiveState(member, mod);
    const newState = !currentState;
    const defaultState = isDefault(member, mod);

    setPendingChanges(prev => {
      const memberChanges = { ...prev[memberId] };

      if (newState === defaultState && !(mod in member.overrides)) {
        // Back to original state, remove from pending
        delete memberChanges[mod];
      } else {
        memberChanges[mod] = newState;
      }

      if (Object.keys(memberChanges).length === 0) {
        const next = { ...prev };
        delete next[memberId];
        return next;
      }

      return { ...prev, [memberId]: memberChanges };
    });
  };

  const handleSaveAll = async () => {
    setIsSavingAll(true);
    try {
      for (const [memberId, changes] of Object.entries(pendingChanges)) {
        const member = members.find(m => m.id === memberId);
        if (!member) continue;

        // Merge with existing overrides
        const merged = { ...member.overrides, ...changes };

        // Clean up: remove overrides that match the role default
        const defaults = COMMAND_CENTER_ACCESS[member.role] || [];
        const cleaned: Record<string, boolean> = {};
        for (const [mod, enabled] of Object.entries(merged)) {
          if (enabled !== defaults.includes(mod)) {
            cleaned[mod] = enabled;
          }
        }

        await onSaveOverrides(memberId, cleaned);
      }
      setPendingChanges({});
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleResetAll = () => {
    setPendingChanges({});
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      {hasPendingChanges && (
        <div className="flex items-center justify-between rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <p className="text-sm font-medium text-yellow-400">
            {Object.keys(pendingChanges).length} member(s) with unsaved changes
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleResetAll}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
            >
              <RotateCcw size={14} />
              Discard
            </button>
            <button
              onClick={handleSaveAll}
              disabled={isSavingAll}
              className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-lime-400 disabled:opacity-50"
            >
              {isSavingAll ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900/20 border-t-zinc-900" />
              ) : (
                <Save size={14} />
              )}
              Save All Changes
            </button>
          </div>
        </div>
      )}

      {/* Matrix Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900">
              <th className="sticky left-0 z-10 bg-zinc-900 px-4 py-3 text-left text-sm font-semibold text-zinc-300">
                Module
              </th>
              {members.map(member => (
                <th
                  key={member.id}
                  className="px-2 py-3 text-center text-xs font-medium text-zinc-400"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-semibold text-zinc-300">
                      {member.name.split(' ')[0]}
                    </span>
                    <span className="text-[10px] text-zinc-500 capitalize">{member.role}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allModules.map((mod, idx) => (
              <tr
                key={mod}
                className={cn(
                  'border-b border-zinc-800/50',
                  idx % 2 === 0 ? 'bg-zinc-950' : 'bg-zinc-900/50'
                )}
              >
                <td className="sticky left-0 z-10 px-4 py-2 text-sm font-medium text-zinc-300"
                  style={{ backgroundColor: idx % 2 === 0 ? '#09090b' : 'rgba(24,24,27,0.5)' }}
                >
                  {MODULE_DISPLAY_NAMES[mod] || mod}
                </td>
                {members.map(member => {
                  const enabled = getEffectiveState(member, mod);
                  const override = isOverridden(member, mod);
                  const hasPending = pendingChanges[member.id] && mod in pendingChanges[member.id];

                  return (
                    <td key={member.id} className="px-2 py-2 text-center">
                      <button
                        onClick={() => handleToggle(member.id, mod)}
                        className={cn(
                          'mx-auto flex h-7 w-7 items-center justify-center rounded-md border transition-all',
                          enabled
                            ? override
                              ? 'border-blue-500 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                              : 'border-zinc-600 bg-zinc-700/50 text-zinc-300 hover:bg-zinc-700'
                            : override
                              ? 'border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                              : 'border-zinc-700 bg-zinc-800/30 text-zinc-600 hover:bg-zinc-800',
                          hasPending && 'ring-2 ring-yellow-500/40'
                        )}
                        title={`${member.name}: ${MODULE_DISPLAY_NAMES[mod]} - ${enabled ? 'Enabled' : 'Disabled'}${override ? ' (custom)' : ' (default)'}`}
                      >
                        {enabled ? <Check size={14} /> : <X size={12} />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded border border-zinc-600 bg-zinc-700/50 text-zinc-300">
            <Check size={10} />
          </span>
          Default (from role)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded border border-blue-500 bg-blue-500/20 text-blue-400">
            <Check size={10} />
          </span>
          Added (custom override)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded border border-red-500/50 bg-red-500/10 text-red-400">
            <X size={10} />
          </span>
          Removed (custom override)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded border border-zinc-700 bg-zinc-800/30 text-zinc-600">
            <X size={10} />
          </span>
          Not in role default
        </span>
      </div>
    </div>
  );
}
