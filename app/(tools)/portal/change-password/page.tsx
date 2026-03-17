'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, completePasswordChange } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLongEnough = newPassword.length >= 8;
  const isNotDefault = newPassword !== 'ChangeMe123!';
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const isValid = isLongEnough && isNotDefault && hasUppercase && hasNumber && passwordsMatch;

  const handleSubmit = async () => {
    if (!isValid || !user) return;

    setIsSubmitting(true);
    setError('');

    try {
      const success = completePasswordChange(newPassword);
      if (!success) {
        setError('Cannot use the default password. Please choose a different one.');
        setIsSubmitting(false);
        return;
      }

      // Short delay for UX
      await new Promise(resolve => setTimeout(resolve, 500));

      // Redirect to onboarding
      router.push('/portal/welcome');
    } catch {
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-green" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <div className="fixed inset-0 opacity-30">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-brand-green/20 bg-gradient-to-br from-brand-green/5 to-emerald-500/5 backdrop-blur-sm p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto bg-brand-green/20 rounded-2xl flex items-center justify-center mb-4">
                <Shield className="text-brand-green" size={32} />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Welcome to RoofStack!</h1>
              <p className="text-neutral-400">Please set your password to continue.</p>
            </div>

            {/* Form */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl pl-12 pr-12 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 focus:ring-2 focus:ring-brand-green/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                  >
                    {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && isValid && handleSubmit()}
                    placeholder="Confirm new password"
                    className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl pl-12 pr-12 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 focus:ring-2 focus:ring-brand-green/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Validation */}
            <div className="space-y-2 mb-6">
              <ValidationItem valid={isLongEnough} text="At least 8 characters" />
              <ValidationItem valid={hasUppercase || newPassword.length === 0} text="At least one uppercase letter" />
              <ValidationItem valid={hasNumber || newPassword.length === 0} text="At least one number" />
              <ValidationItem valid={isNotDefault || newPassword.length === 0} text="Cannot be ChangeMe123!" />
              <ValidationItem valid={passwordsMatch} text="Passwords match" />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm py-3 px-4 rounded-xl mb-6 flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting}
              className="w-full bg-gradient-to-r from-brand-green to-emerald-500 hover:from-brand-green/90 hover:to-emerald-500/90 disabled:from-neutral-700 disabled:to-neutral-700 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-brand-green/25 disabled:shadow-none"
            >
              {isSubmitting && <Loader2 className="animate-spin" size={20} />}
              {isSubmitting ? 'Setting Password...' : 'Set Password & Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ValidationItem({ valid, text }: { valid: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm ${valid ? 'text-brand-green' : 'text-neutral-500'}`}>
      <CheckCircle size={14} className={valid ? 'text-brand-green' : 'text-neutral-600'} />
      {text}
    </div>
  );
}
