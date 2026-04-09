'use client';

/**
 * ImpersonationBanner - Fixed top banner shown when an admin is impersonating a user.
 *
 * Displays the impersonated user's name and role, plus a "Stop Impersonating" button
 * that calls DELETE /api/portal/admin/impersonate and reloads.
 */

import { useAuth } from '@/lib/auth-context';
import { Eye, XCircle } from 'lucide-react';
import { ROLE_DISPLAY_NAMES } from '@/lib/team-roles';

export default function ImpersonationBanner() {
  const { user, realUser, isImpersonating, stopImpersonating } = useAuth();

  if (!isImpersonating || !user || !realUser) return null;

  const roleName = ROLE_DISPLAY_NAMES[user.role] || user.role;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-black shadow-lg">
      <div className="max-w-[1600px] mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Eye size={18} className="shrink-0" />
          <span className="text-sm font-semibold truncate">
            Viewing as <span className="font-bold">{user.name}</span>{' '}
            <span className="opacity-80">({roleName})</span>
          </span>
          <span className="hidden sm:inline text-xs opacity-70">
            — Logged in as {realUser.name}
          </span>
        </div>
        <button
          onClick={stopImpersonating}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-black/20 hover:bg-black/30 text-sm font-semibold transition-colors shrink-0"
        >
          <XCircle size={16} />
          Stop Impersonating
        </button>
      </div>
    </div>
  );
}
