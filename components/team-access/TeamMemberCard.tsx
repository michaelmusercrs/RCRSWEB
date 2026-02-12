'use client';

import { Shield, Mail, Phone, Edit2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ROLE_DISPLAY_NAMES,
  MODULE_DISPLAY_NAMES,
  type TeamRole,
} from '@/lib/team-roles';

interface TeamMemberAccessData {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: TeamRole;
  pin: string;
  isActive: boolean;
  defaultAccess: string[];
  overrides: Record<string, boolean>;
  effectiveAccess: string[];
  hasCustomAccess: boolean;
  overrideCount: number;
}

const ROLE_BADGE_COLORS: Record<string, string> = {
  owner: 'bg-purple-500/20 text-purple-400',
  admin: 'bg-red-500/20 text-red-400',
  manager: 'bg-blue-500/20 text-blue-400',
  sales: 'bg-green-500/20 text-green-400',
  office: 'bg-cyan-500/20 text-cyan-400',
  project_manager: 'bg-indigo-500/20 text-indigo-400',
  driver: 'bg-orange-500/20 text-orange-400',
  viewer: 'bg-zinc-500/20 text-zinc-400',
};

interface TeamMemberCardProps {
  member: TeamMemberAccessData;
  onEditAccess: (member: TeamMemberAccessData) => void;
}

export function TeamMemberCard({ member, onEditAccess }: TeamMemberCardProps) {
  const initials = member.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={cn(
      'rounded-xl border bg-zinc-900 p-5 transition-all hover:border-zinc-700',
      member.hasCustomAccess ? 'border-blue-500/40' : 'border-zinc-800'
    )}>
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-white">
          {initials}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-white">{member.name}</h3>
          <span className={cn(
            'mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
            ROLE_BADGE_COLORS[member.role] || 'bg-zinc-500/20 text-zinc-400'
          )}>
            <Shield size={11} />
            {ROLE_DISPLAY_NAMES[member.role] || member.role}
          </span>
        </div>
      </div>

      {/* Contact */}
      <div className="mt-3 space-y-1">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Mail size={13} className="text-zinc-500" />
          <span className="truncate">{member.email}</span>
        </div>
        {member.phone && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Phone size={13} className="text-zinc-500" />
            <span>{member.phone}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Lock size={13} className="text-zinc-500" />
          <span>PIN: {member.pin}</span>
          <span className={cn(
            'ml-auto rounded-full px-2 py-0.5 text-xs font-medium',
            member.isActive ? 'bg-lime-500/20 text-lime-400' : 'bg-red-500/20 text-red-400'
          )}>
            {member.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Access Summary */}
      <div className="mt-4 border-t border-zinc-800 pt-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-400">
            Modules: <span className="font-medium text-white">{member.effectiveAccess.length}</span>
            {member.role === 'owner' || member.role === 'admin'
              ? ' (ALL)'
              : ` / ${Object.keys(MODULE_DISPLAY_NAMES).length}`}
          </span>
          {member.hasCustomAccess && (
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400">
              {member.overrideCount} override{member.overrideCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex justify-end">
        <button
          onClick={() => onEditAccess(member)}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
        >
          <Edit2 size={14} />
          Edit Access
        </button>
      </div>
    </div>
  );
}

export type { TeamMemberAccessData };
