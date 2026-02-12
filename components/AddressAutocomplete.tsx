'use client';

// AddressAutocomplete Component
// Uses free Nominatim OpenStreetMap API for address suggestions (no API key needed)
// Returns structured address data including lat/lng
// Debounced search (300ms), min 3 characters, US addresses only

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

export interface AddressResult {
  formattedAddress: string;
  lat: number;
  lng: number;
  placeId: string;
  streetNumber?: string;
  street?: string;
  city?: string;
  county?: string;
  state?: string;
  zip?: string;
  country?: string;
}

interface AddressAutocompleteProps {
  onAddressSelect: (result: AddressResult) => void;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
    suburb?: string;
    neighbourhood?: string;
  };
  boundingbox: string[];
}

// US state abbreviation mapping
const STATE_ABBREV: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
};

function getStateAbbrev(stateName: string): string {
  if (!stateName) return '';
  // If already an abbreviation (2 chars uppercase), return as-is
  if (stateName.length === 2 && stateName === stateName.toUpperCase()) return stateName;
  return STATE_ABBREV[stateName] || stateName;
}

function parseNominatimResult(item: NominatimResult): AddressResult {
  const addr = item.address;
  const stateAbbrev = getStateAbbrev(addr.state || '');
  const city = addr.city || addr.town || addr.village || addr.hamlet || '';
  const county = addr.county ? addr.county.replace(' County', '') : '';

  // Build a clean formatted address
  const parts: string[] = [];
  if (addr.house_number && addr.road) {
    parts.push(`${addr.house_number} ${addr.road}`);
  } else if (addr.road) {
    parts.push(addr.road);
  }
  if (city) parts.push(city);
  if (stateAbbrev) parts.push(stateAbbrev);
  if (addr.postcode) parts.push(addr.postcode);

  const formattedAddress = parts.length > 0 ? parts.join(', ') : item.display_name;

  return {
    formattedAddress,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    placeId: String(item.place_id),
    streetNumber: addr.house_number,
    street: addr.road,
    city,
    county,
    state: stateAbbrev,
    zip: addr.postcode,
    country: addr.country_code?.toUpperCase() || 'US',
  };
}

export default function AddressAutocomplete({
  onAddressSelect,
  defaultValue = '',
  placeholder = 'Start typing an address...',
  className = '',
  disabled = false,
  required = false,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [inputValue, setInputValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  // Fetch suggestions from Nominatim
  const fetchSuggestions = useCallback(async (query: string) => {
    // Abort any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    if (query.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&countrycodes=us&limit=5&addressdetails=1`;

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'RiverCityRoofingSolutions/1.0',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`);
      }

      const data: NominatimResult[] = await response.json();

      // Filter to results that have reasonable address data
      const filtered = data.filter(
        (item) => item.address && (item.address.road || item.address.city || item.address.town)
      );

      setSuggestions(filtered);
      setShowDropdown(filtered.length > 0);
      setHighlightedIndex(-1);
    } catch (err: any) {
      if (err.name === 'AbortError') return; // Ignore aborted requests
      console.error('Address search error:', err);
      setError('Address lookup temporarily unavailable. You can type the address manually.');
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced input handler
  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        fetchSuggestions(value);
      }, 300);
    },
    [fetchSuggestions]
  );

  // Handle suggestion selection
  const handleSelect = useCallback(
    (item: NominatimResult) => {
      const result = parseNominatimResult(item);
      setInputValue(result.formattedAddress);
      setSuggestions([]);
      setShowDropdown(false);
      setHighlightedIndex(-1);
      setError(null);
      onAddressSelect(result);
    },
    [onAddressSelect]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showDropdown || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
            handleSelect(suggestions[highlightedIndex]);
          }
          break;
        case 'Escape':
          setShowDropdown(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [showDropdown, suggestions, highlightedIndex, handleSelect]
  );

  // Close dropdown when clicking outside
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Build display text for each suggestion
  const getSuggestionDisplay = (item: NominatimResult) => {
    const addr = item.address;
    const city = addr.city || addr.town || addr.village || addr.hamlet || '';
    const stateAbbrev = getStateAbbrev(addr.state || '');

    const streetParts: string[] = [];
    if (addr.house_number) streetParts.push(addr.house_number);
    if (addr.road) streetParts.push(addr.road);
    const streetLine = streetParts.join(' ');

    const locationParts: string[] = [];
    if (city) locationParts.push(city);
    if (stateAbbrev) locationParts.push(stateAbbrev);
    if (addr.postcode) locationParts.push(addr.postcode);
    const locationLine = locationParts.join(', ');

    return { streetLine, locationLine };
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-brand-green/50 focus:border-brand-green/50 transition-all ${
            error ? 'border-red-500/50' : ''
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-haspopup="listbox"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 text-brand-green animate-spin" />
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          role="listbox"
          className="absolute z-50 w-full mt-1 bg-neutral-900 border border-white/10 rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto"
        >
          {suggestions.map((item, index) => {
            const { streetLine, locationLine } = getSuggestionDisplay(item);
            const isHighlighted = index === highlightedIndex;

            return (
              <button
                key={item.place_id}
                type="button"
                role="option"
                aria-selected={isHighlighted}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b border-white/5 last:border-b-0 ${
                  isHighlighted
                    ? 'bg-brand-green/10 text-white'
                    : 'text-neutral-300 hover:bg-white/5'
                }`}
              >
                <MapPin
                  className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    isHighlighted ? 'text-brand-green' : 'text-neutral-500'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium truncate ${isHighlighted ? 'text-white' : 'text-neutral-200'}`}>
                    {streetLine || locationLine}
                  </p>
                  {streetLine && locationLine && (
                    <p className="text-xs text-neutral-500 truncate mt-0.5">
                      {locationLine}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
          <div className="px-4 py-1.5 bg-neutral-950 text-[10px] text-neutral-600 text-right">
            Powered by OpenStreetMap Nominatim
          </div>
        </div>
      )}

      {error && (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
