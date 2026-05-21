'use client';

/**
 * JobSearchAutocomplete
 *
 * Single search input that finds JN jobs as the user types. Match against
 * R-number, customer name, address, or city — whichever the user remembers.
 * Selecting a row calls onSelect with a normalized JobSearchHit; the
 * consuming form then fills its own fields.
 *
 * Backed by GET /api/portal/jobnimbus/search (prefix queries on JN /jobs).
 *
 * Behavior modeled on AddressAutocomplete: 250ms debounce, abort in-flight
 * on new keystroke, keyboard nav (↑/↓/Enter/Esc), click-outside closes.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Search, Loader2, Briefcase } from 'lucide-react';

export interface JobSearchHit {
  jnid: string;
  rNumber: string;
  jobName: string;
  customerName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  salesRep: string;
  status: string;
}

interface JobSearchAutocompleteProps {
  onSelect: (hit: JobSearchHit) => void;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  // Set to true to keep the input showing the selected R-number (default).
  // Set false to clear after select (e.g. for "add another" flows).
  keepValueAfterSelect?: boolean;
}

export default function JobSearchAutocomplete({
  onSelect,
  defaultValue = '',
  placeholder = 'R-number, customer name, or address…',
  className = '',
  disabled = false,
  autoFocus = false,
  keepValueAfterSelect = true,
}: JobSearchAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [inputValue, setInputValue] = useState(defaultValue);
  const [hits, setHits] = useState<JobSearchHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const fetchHits = useCallback(async (query: string) => {
    if (abortRef.current) abortRef.current.abort();
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(
        `/api/portal/jobnimbus/search?q=${encodeURIComponent(q)}&limit=10`,
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      const found: JobSearchHit[] = data.hits || [];
      setHits(found);
      setShowDropdown(found.length > 0);
      setHighlightedIndex(found.length > 0 ? 0 : -1);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError('Search failed — try again or fill in manually.');
      setHits([]);
      setShowDropdown(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchHits(value), 250);
    },
    [fetchHits],
  );

  const handleSelect = useCallback(
    (hit: JobSearchHit) => {
      if (keepValueAfterSelect) {
        setInputValue(hit.rNumber || hit.customerName || hit.jobName);
      } else {
        setInputValue('');
      }
      setHits([]);
      setShowDropdown(false);
      setHighlightedIndex(-1);
      setError(null);
      onSelect(hit);
    },
    [onSelect, keepValueAfterSelect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showDropdown || hits.length === 0) return;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => (prev < hits.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => (prev > 0 ? prev - 1 : hits.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < hits.length) {
            handleSelect(hits[highlightedIndex]);
          }
          break;
        case 'Escape':
          setShowDropdown(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [showDropdown, hits, highlightedIndex, handleSelect],
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={() => {
            if (hits.length > 0) setShowDropdown(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-zinc-900 text-white placeholder-zinc-500 border border-zinc-700 rounded-lg pl-9 pr-9 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-zinc-800 disabled:text-zinc-500"
        />
        {isSearching && (
          <Loader2 className="w-4 h-4 animate-spin text-green-500 absolute right-3 top-1/2 -translate-y-1/2" />
        )}
      </div>

      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}

      {showDropdown && hits.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-h-80 overflow-y-auto"
        >
          {hits.map((hit, idx) => {
            const highlighted = idx === highlightedIndex;
            const secondary = [hit.address, hit.city, hit.state]
              .filter(Boolean)
              .join(', ');
            return (
              <button
                key={hit.jnid}
                type="button"
                onClick={() => handleSelect(hit)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`w-full text-left px-3 py-2 border-b border-zinc-800 last:border-b-0 flex items-start gap-3 ${
                  highlighted ? 'bg-[#39FF14]/10' : 'bg-zinc-900 hover:bg-zinc-800/60'
                }`}
              >
                <Briefcase className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-medium text-[#39FF14] text-sm font-mono">
                      {hit.rNumber || '—'}
                    </span>
                    <span className="text-sm text-zinc-200 truncate">
                      {hit.customerName || hit.jobName}
                    </span>
                    {hit.status && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 flex-shrink-0">
                        {hit.status}
                      </span>
                    )}
                  </div>
                  {secondary && (
                    <div className="text-xs text-zinc-500 truncate">
                      {secondary}
                    </div>
                  )}
                  {hit.salesRep && (
                    <div className="text-[11px] text-zinc-500">
                      Rep: {hit.salesRep}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
