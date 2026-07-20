'use client';

import { useState } from 'react';
import { Lock, Unlock, ArrowRight } from 'lucide-react';
import EarningsCalculator from './EarningsCalculator';

// Valid referral codes — each links to the person who shared it
const VALID_CODES: Record<string, string> = {
  'RCRS2026': 'Website',
  'HUNTER': 'Hunter Rivers',
  'AARON': 'Aaron Lussi',
  'BRENDON': 'Brendon Muse',
  'MICHAEL': 'Michael Muse',
  'OFFICE': 'Office Staff',
  // Add more codes as needed — format: 'CODE': 'Referred By Name'
};

export default function ReferralCodeGate() {
  const [code, setCode] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [referredBy, setReferredBy] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = code.trim().toUpperCase();
    const match = VALID_CODES[normalized];
    if (match) {
      setUnlocked(true);
      setReferredBy(match);
      setError('');
    } else {
      setError('Invalid code. Ask a current team member for a referral code.');
    }
  };

  if (!unlocked) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-200">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-brand-green/10 rounded-full flex items-center justify-center">
              <Lock size={32} className="text-brand-green-dark" />
            </div>
          </div>
          <h3 className="text-xl font-bold mb-2">Enter Referral Code</h3>
          <p className="text-gray-500 text-sm mb-6">
            Got a code from one of our team? Enter it below to see detailed earnings info and our commission calculator.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(''); }}
              placeholder="Enter code..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-center text-lg font-mono uppercase tracking-widest focus:border-brand-green focus:outline-none transition"
              maxLength={20}
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full bg-brand-green text-black font-semibold py-3 rounded-lg hover:brightness-110 transition flex items-center justify-center gap-2"
            >
              <Unlock size={18} />
              Unlock Details
            </button>
          </form>
          <p className="text-gray-400 text-xs mt-4">
            Don&apos;t have a code? <a href="#application" className="text-brand-green-dark hover:underline">Apply directly</a> and we&apos;ll share everything during your interview.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-brand-green/10 border border-brand-green/30 rounded-lg p-4 mb-8 max-w-lg mx-auto">
        <div className="flex items-center justify-center gap-2 text-brand-green-dark font-semibold">
          <Unlock size={18} />
          <span>Unlocked{referredBy !== 'Website' ? ` · Referred by ${referredBy}` : ''}</span>
        </div>
      </div>
      <EarningsCalculator />
    </div>
  );
}
