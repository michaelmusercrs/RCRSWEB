'use client';

/**
 * Admin Credential Management
 *
 * Allows authorized users to view team members' login methods and
 * reset credentials based on the role hierarchy:
 *   owner > admin > manager > office (each resets levels below)
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, Shield, AlertCircle, Check, RotateCcw,
  KeyRound, Grid3X3, Fingerprint, Lock, Mail,
  ArrowLeft, ChevronRight, Search,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  TEAM_MEMBERS, TeamMember, TeamRole,
  ROLE_DISPLAY_NAMES, ROLE_COLORS,
  CREDENTIAL_RESET_HIERARCHY, canResetCredentials,
} from '@/lib/team-roles';

type ResetType = 'password' | 'login-method' | 'both';

interface ResetDialogState {
  target: TeamMember | null;
  resetType: ResetType;
  sendEmail: boolean;
}

const LOGIN_METHOD_ICONS: Record<string, React.ReactNode> = {
  password: <Lock size={16} className="text-neutral-400" />,
  pin: <Grid3X3 size={16} className="text-brand-green" />,
  picture: <Fingerprint size={16} className="text-purple-400" />,
};

const LOGIN_METHOD_LABELS: Record<string, string> = {
  password: 'Password',
  pin: 'PIN',
  picture: 'Picture',
};

export default function AdminCredentialsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [search, setSearch] = useState('');
  const [resetDialog, setResetDialog] = useState<ResetDialogState | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch credential info for all users
  const [credentialInfo, setCredentialInfo] = useState<Record<string, { loginMethod: string; loginSetupComplete: boolean }>>({});
  const [loadingCreds, setLoadingCreds] = useState(true);

  useEffect(() => {
    const fetchCreds = async () => {
      setLoadingCreds(true);
      const info: Record<string, { loginMethod: string; loginSetupComplete: boolean }> = {};

      // Fetch login method for each active team member (in batches)
      const activeMembers = TEAM_MEMBERS.filter(m => m.isActive);
      await Promise.all(
        activeMembers.map(async (m) => {
          try {
            const res = await fetch('/api/portal/auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'get-login-method', email: m.email }),
            });
            const data = await res.json();
            if (data.success) {
              info[m.id] = {
                loginMethod: data.loginMethod || 'password',
                loginSetupComplete: data.loginSetupComplete ?? false,
              };
            }
          } catch {
            info[m.id] = { loginMethod: 'password', loginSetupComplete: false };
          }
        })
      );

      setCredentialInfo(info);
      setLoadingCreds(false);
    };

    if (user) fetchCreds();
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-green" size={48} />
      </div>
    );
  }

  if (!user) {
    router.push('/portal');
    return null;
  }

  // Only users with reset authority can access this page
  const userRole = user.role as TeamRole;
  const canReset = Object.keys(CREDENTIAL_RESET_HIERARCHY).includes(userRole) &&
    CREDENTIAL_RESET_HIERARCHY[userRole].length > 0;

  if (!canReset) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
        <div className="text-center">
          <Shield className="text-red-400 mx-auto mb-4" size={48} />
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-neutral-400 text-sm">You do not have permission to manage credentials.</p>
          <button onClick={() => router.back()} className="mt-6 text-brand-green hover:underline text-sm">Go Back</button>
        </div>
      </div>
    );
  }

  // Filter active members that the current user CAN reset
  const activeMembers = TEAM_MEMBERS.filter(m =>
    m.isActive && m.id !== user.userId
  );

  const filteredMembers = activeMembers.filter(m => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.email.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  // ── Reset Handler ──────────────────────────────────
  const handleReset = async () => {
    if (!resetDialog?.target) return;
    setIsResetting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/portal/admin/reset-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: resetDialog.target.id,
          resetType: resetDialog.resetType,
          sendEmail: resetDialog.sendEmail,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMsg(data.message || `Credentials reset for ${resetDialog.target.name}`);
        setResetDialog(null);
        // Refresh credential info
        const credsRes = await fetch('/api/portal/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get-login-method', email: resetDialog.target.email }),
        });
        const credsData = await credsRes.json();
        if (credsData.success) {
          setCredentialInfo(prev => ({
            ...prev,
            [resetDialog.target!.id]: {
              loginMethod: credsData.loginMethod || 'password',
              loginSetupComplete: credsData.loginSetupComplete ?? false,
            },
          }));
        }
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setErrorMsg(data.error || 'Reset failed');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
    }

    setIsResetting(false);
  };

  // ── Render ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-950 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.back()} className="text-neutral-500 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <KeyRound className="text-brand-green" size={24} />
              Credential Management
            </h1>
            <p className="text-sm text-neutral-500">Reset passwords and login methods for team members</p>
          </div>
        </div>

        {/* Success/Error banners */}
        {successMsg && (
          <div className="bg-brand-green/10 border border-brand-green/30 text-brand-green text-sm py-3 px-4 rounded-xl mb-5 flex items-center gap-2">
            <Check size={16} /> {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm py-3 px-4 rounded-xl mb-5 flex items-center gap-2">
            <AlertCircle size={16} /> {errorMsg}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full bg-neutral-800/50 border border-neutral-700/50 rounded-xl pl-11 pr-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/20 text-sm"
          />
        </div>

        {/* Team Member List */}
        {loadingCreds ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-brand-green" size={32} />
          </div>
        ) : (
          <div className="space-y-2">
            {filteredMembers.map((member) => {
              const canResetThis = canResetCredentials(userRole, member.role);
              const creds = credentialInfo[member.id];
              const methodIcon = LOGIN_METHOD_ICONS[creds?.loginMethod || 'password'];
              const methodLabel = LOGIN_METHOD_LABELS[creds?.loginMethod || 'password'];

              return (
                <div key={member.id}
                  className="flex items-center gap-4 p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl hover:border-neutral-700/60 transition-colors"
                >
                  {/* Avatar / Initials */}
                  <div className={`w-10 h-10 rounded-full ${ROLE_COLORS[member.role]} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                    {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm truncate">{member.name}</span>
                      <span className="text-xs text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded-full">{ROLE_DISPLAY_NAMES[member.role]}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-neutral-500 mt-0.5">
                      <span>{member.email}</span>
                      <span className="flex items-center gap-1">
                        {methodIcon} {methodLabel}
                        {creds?.loginSetupComplete && <Check size={12} className="text-brand-green" />}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  {canResetThis ? (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => setResetDialog({ target: member, resetType: 'password', sendEmail: true })}
                        className="px-3 py-1.5 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-neutral-300 hover:text-white transition-all"
                        title="Reset password to ChangeMe123!"
                      >
                        Reset Password
                      </button>
                      <button
                        onClick={() => setResetDialog({ target: member, resetType: 'login-method', sendEmail: false })}
                        className="px-3 py-1.5 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-neutral-300 hover:text-white transition-all"
                        title="Reset login method to password"
                      >
                        Reset Method
                      </button>
                      <button
                        onClick={() => setResetDialog({ target: member, resetType: 'both', sendEmail: true })}
                        className="px-3 py-1.5 text-xs font-medium bg-red-900/30 hover:bg-red-900/50 border border-red-800/40 rounded-lg text-red-400 hover:text-red-300 transition-all"
                        title="Reset everything"
                      >
                        Reset All
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-neutral-600 italic flex-shrink-0">No access</span>
                  )}
                </div>
              );
            })}

            {filteredMembers.length === 0 && (
              <div className="text-center py-12 text-neutral-500">
                No team members found.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Reset Confirmation Dialog ───────────────── */}
      {resetDialog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-700/50 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
                <RotateCcw className="text-red-400" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Confirm Reset</h3>
                <p className="text-sm text-neutral-400">{resetDialog.target?.name}</p>
              </div>
            </div>

            <div className="bg-neutral-800/50 rounded-xl p-4 mb-5 text-sm text-neutral-300 space-y-2">
              {(resetDialog.resetType === 'password' || resetDialog.resetType === 'both') && (
                <p>Password will be reset to <code className="text-brand-green bg-brand-green/10 px-1 rounded">ChangeMe123!</code></p>
              )}
              {(resetDialog.resetType === 'login-method' || resetDialog.resetType === 'both') && (
                <p>Login method will be reset to <strong>password</strong> (PIN/picture cleared)</p>
              )}
              <p className="text-neutral-500 text-xs">They will need to set up new credentials on next login.</p>
            </div>

            {/* Email notification toggle */}
            <label className="flex items-center gap-3 mb-6 cursor-pointer group">
              <input type="checkbox" checked={resetDialog.sendEmail}
                onChange={(e) => setResetDialog({ ...resetDialog, sendEmail: e.target.checked })}
                className="w-5 h-5 rounded border-white/20 bg-white/5 text-brand-green focus:ring-brand-green/50 focus:ring-offset-0 cursor-pointer"
              />
              <div>
                <span className="text-sm text-neutral-300 group-hover:text-white transition-colors">Send email notification</span>
                <p className="text-xs text-neutral-500">{resetDialog.target?.email}</p>
              </div>
            </label>

            {/* Buttons */}
            <div className="flex gap-3">
              <button onClick={() => setResetDialog(null)} disabled={isResetting}
                className="flex-1 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-sm font-medium transition-all"
              >Cancel</button>
              <button onClick={handleReset} disabled={isResetting}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isResetting ? <Loader2 className="animate-spin" size={16} /> : <RotateCcw size={16} />}
                {isResetting ? 'Resetting...' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
