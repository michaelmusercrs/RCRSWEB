'use client';

import { useState } from 'react';
import { Calculator, DollarSign, Plus, Minus, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

const REWARD_TIERS = [100, 250, 500, 1000, 1000, 1000, 1000, 1000, 1000, 1000];

function calculateRewards(numReferrals: number): { total: number; breakdown: { referral: number; amount: number }[] } {
  const breakdown: { referral: number; amount: number }[] = [];
  let total = 0;

  for (let i = 0; i < Math.min(numReferrals, 10); i++) {
    const amount = REWARD_TIERS[i];
    breakdown.push({ referral: i + 1, amount });
    total += amount;
  }

  return { total, breakdown };
}

export default function ReferralCalculator() {
  const [referrals, setReferrals] = useState(1);
  const { total, breakdown } = calculateRewards(referrals);

  const increment = () => setReferrals(prev => Math.min(prev + 1, 10));
  const decrement = () => setReferrals(prev => Math.max(prev - 1, 1));

  return (
    <div className="bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700 rounded-2xl p-6 md:p-8">
      <div className="flex items-center justify-center gap-3 mb-6">
        <Calculator className="text-brand-green" size={28} />
        <h3 className="text-2xl md:text-3xl font-bold text-white">Rewards Calculator</h3>
      </div>

      <p className="text-neutral-400 text-center mb-8">
        See how much you could earn! Adjust the number of referrals below.
      </p>

      {/* Referral Counter */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <Button
          onClick={decrement}
          disabled={referrals <= 1}
          className="w-12 h-12 rounded-full bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Decrease referrals"
        >
          <Minus className="w-6 h-6" />
        </Button>

        <div className="text-center min-w-[120px]">
          <div className="text-5xl md:text-6xl font-black text-brand-green">{referrals}</div>
          <div className="text-neutral-400 text-sm mt-1">
            {referrals === 1 ? 'Referral' : 'Referrals'}
          </div>
        </div>

        <Button
          onClick={increment}
          disabled={referrals >= 10}
          className="w-12 h-12 rounded-full bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Increase referrals"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      {/* Slider */}
      <div className="mb-8 px-4">
        <input
          type="range"
          min="1"
          max="10"
          value={referrals}
          onChange={(e) => setReferrals(parseInt(e.target.value))}
          className="w-full h-3 bg-neutral-700 rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-6
            [&::-webkit-slider-thumb]:h-6
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-brand-green
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:shadow-lg
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-110
            [&::-moz-range-thumb]:w-6
            [&::-moz-range-thumb]:h-6
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-brand-green
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:cursor-pointer"
        />
        <div className="flex justify-between text-xs text-neutral-500 mt-2">
          <span>1</span>
          <span>5</span>
          <span>10</span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="bg-neutral-800/50 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="text-brand-green" size={18} />
          <span className="text-sm font-semibold text-neutral-300">Earnings Breakdown</span>
        </div>
        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
          {breakdown.map(({ referral, amount }) => (
            <div
              key={referral}
              className="flex justify-between items-center py-2 px-3 rounded-lg bg-neutral-700/30"
            >
              <span className="text-neutral-300 text-sm">
                {referral === 1 ? '1st' : referral === 2 ? '2nd' : referral === 3 ? '3rd' : `${referral}th`} Referral
              </span>
              <span className={`font-bold ${amount === 1000 ? 'text-brand-green' : 'text-white'}`}>
                ${amount.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Total */}
      <div className="bg-gradient-to-r from-brand-green/20 to-lime-500/20 border-2 border-brand-green rounded-xl p-6 text-center">
        <p className="text-neutral-300 text-sm mb-1">Your Total Earnings</p>
        <div className="flex items-center justify-center gap-2">
          <DollarSign className="text-brand-green" size={36} />
          <span className="text-5xl md:text-6xl font-black text-brand-green">
            {total.toLocaleString()}
          </span>
        </div>
        {referrals === 10 && (
          <p className="text-brand-green text-sm mt-3 font-semibold animate-pulse">
            Maximum earnings achieved!
          </p>
        )}
      </div>

      {/* CTA */}
      <div className="mt-6 text-center">
        <p className="text-neutral-400 text-sm">
          Ready to start earning? Contact us to submit your first referral!
        </p>
      </div>
    </div>
  );
}
