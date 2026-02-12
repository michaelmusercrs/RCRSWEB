'use client';

import { useState, useCallback } from 'react';
import { Search, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import AddressAutocomplete, { AddressResult } from '@/components/AddressAutocomplete';
import DistributionScoreCard from './DistributionScoreCard';

interface RepScoreResult {
  repSlug: string;
  repName: string;
  totalScore: number;
  factors: Record<string, { score: number; weight: number; raw: number; explanation: string }>;
  isAvailable: boolean;
  isEligible: boolean;
  disqualifyReason?: string;
}

interface DistributionCalculatorProps {
  className?: string;
}

export default function DistributionCalculator({ className }: DistributionCalculatorProps) {
  const [selectedAddress, setSelectedAddress] = useState<AddressResult | null>(null);
  const [scores, setScores] = useState<RepScoreResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleAddressSelect = useCallback((result: AddressResult) => {
    setSelectedAddress(result);
    setError(null);
  }, []);

  const handlePreview = async () => {
    if (!selectedAddress) {
      setError('Please select an address first.');
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await fetch('/api/leads/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: selectedAddress.formattedAddress }),
      });

      if (!response.ok) {
        throw new Error(`Failed to preview distribution: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Preview failed');
      }

      setScores(data.data?.scores || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setScores([]);
    } finally {
      setLoading(false);
    }
  };

  const eligibleScores = scores.filter(s => s.isEligible);
  const ineligibleScores = scores.filter(s => !s.isEligible);
  const noEligible = hasSearched && !loading && eligibleScores.length === 0;

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 p-4 shadow-sm', className)}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribution Calculator</h3>

      {/* Address input */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Lead Address</label>
          <AddressAutocomplete
            onAddressSelect={handleAddressSelect}
            placeholder="Enter lead address..."
            className="!bg-white !text-gray-900 !border-gray-300 !placeholder-gray-400"
          />
        </div>

        {selectedAddress && (
          <div className="text-xs text-gray-500">
            Selected: {selectedAddress.formattedAddress}
            {selectedAddress.county && ` (${selectedAddress.county} County)`}
          </div>
        )}

        <button
          onClick={handlePreview}
          disabled={loading || !selectedAddress}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors',
            loading || !selectedAddress
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          )}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Calculating...
            </>
          ) : (
            <>
              <Search size={16} />
              Preview Distribution
            </>
          )}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-600">{error}</span>
        </div>
      )}

      {/* No eligible reps warning */}
      {noEligible && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-md">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-amber-500" />
            <span className="text-sm font-medium text-amber-700">No Eligible Reps</span>
          </div>
          <p className="text-xs text-amber-600">
            No sales representatives are currently eligible to receive this lead. Check availability settings and county preferences.
          </p>
        </div>
      )}

      {/* Results */}
      {hasSearched && !loading && scores.length > 0 && (
        <div className="mt-4 space-y-3">
          <h4 className="text-sm font-medium text-gray-600">
            Results ({eligibleScores.length} eligible, {ineligibleScores.length} ineligible)
          </h4>

          {/* Eligible reps */}
          {eligibleScores.map((score, index) => (
            <DistributionScoreCard
              key={score.repSlug}
              score={score}
              rank={index + 1}
              isAssigned={index === 0}
            />
          ))}

          {/* Ineligible reps (collapsed) */}
          {ineligibleScores.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                {ineligibleScores.length} ineligible rep{ineligibleScores.length !== 1 ? 's' : ''}
              </summary>
              <div className="mt-2 space-y-2">
                {ineligibleScores.map((score, index) => (
                  <DistributionScoreCard
                    key={score.repSlug}
                    score={score}
                    rank={eligibleScores.length + index + 1}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-gray-50 rounded-lg p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-24" />
                  <div className="h-3 bg-gray-200 rounded w-16" />
                </div>
                <div className="w-12 h-6 bg-gray-200 rounded" />
              </div>
              <div className="mt-3 h-4 bg-gray-200 rounded-full" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
