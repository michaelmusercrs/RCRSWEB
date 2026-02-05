'use client';

import * as React from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> {
  /** Current search value */
  value: string;
  /** Callback when value changes (after debounce if set) */
  onChange: (value: string) => void;
  /** Debounce delay in milliseconds (0 for no debounce) */
  debounceMs?: number;
  /** Whether search is currently loading */
  loading?: boolean;
  /** Whether to show clear button */
  showClear?: boolean;
  /** Custom search icon */
  searchIcon?: React.ReactNode;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Callback when Enter key is pressed */
  onSearch?: (value: string) => void;
}

/**
 * SearchInput component with debounce support and clear button.
 * Optimized for search functionality with loading states.
 *
 * @example
 * const [search, setSearch] = useState('');
 * <SearchInput
 *   value={search}
 *   onChange={setSearch}
 *   placeholder="Search customers..."
 *   debounceMs={300}
 * />
 *
 * @example
 * // With loading indicator
 * <SearchInput
 *   value={query}
 *   onChange={handleSearch}
 *   loading={isSearching}
 *   onSearch={handleSubmit}
 * />
 */
const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      className,
      value,
      onChange,
      debounceMs = 0,
      loading = false,
      showClear = true,
      searchIcon,
      size = 'md',
      placeholder = 'Search...',
      onSearch,
      disabled,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(value);
    const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    // Combine refs
    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref]
    );

    // Sync internal value with external value
    React.useEffect(() => {
      setInternalValue(value);
    }, [value]);

    // Handle input change with debounce
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInternalValue(newValue);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (debounceMs > 0) {
        debounceTimerRef.current = setTimeout(() => {
          onChange(newValue);
        }, debounceMs);
      } else {
        onChange(newValue);
      }
    };

    // Handle clear button click
    const handleClear = () => {
      setInternalValue('');
      onChange('');
      inputRef.current?.focus();
    };

    // Handle Enter key
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && onSearch) {
        e.preventDefault();
        // Flush any pending debounced value
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        onChange(internalValue);
        onSearch(internalValue);
      }
      props.onKeyDown?.(e);
    };

    // Cleanup debounce timer on unmount
    React.useEffect(() => {
      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    }, []);

    // Size classes
    const sizeClasses = {
      sm: 'h-8 text-sm pl-8 pr-8',
      md: 'h-10 text-sm pl-10 pr-10',
      lg: 'h-12 text-base pl-12 pr-12',
    };

    const iconSizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
    };

    const iconPositionClasses = {
      sm: 'left-2.5',
      md: 'left-3',
      lg: 'left-3.5',
    };

    const clearPositionClasses = {
      sm: 'right-2',
      md: 'right-3',
      lg: 'right-3.5',
    };

    const hasValue = internalValue && internalValue.length > 0;

    return (
      <div className={cn('relative', className)}>
        {/* Search icon */}
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none',
            iconPositionClasses[size]
          )}
          aria-hidden="true"
        >
          {loading ? (
            <Loader2
              className={cn('animate-spin text-brand-green', iconSizeClasses[size])}
            />
          ) : (
            searchIcon || <Search className={iconSizeClasses[size]} />
          )}
        </div>

        {/* Input */}
        <input
          ref={setRefs}
          type="search"
          value={internalValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'w-full rounded-lg border border-gray-700 bg-[#242424] text-white placeholder:text-gray-500',
            'transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-brand-green',
            'disabled:cursor-not-allowed disabled:opacity-50',
            // Hide native search cancel button
            '[&::-webkit-search-cancel-button]:appearance-none',
            '[&::-webkit-search-decoration]:appearance-none',
            sizeClasses[size]
          )}
          aria-label={placeholder}
          {...props}
        />

        {/* Clear button */}
        {showClear && hasValue && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className={cn(
              'absolute top-1/2 -translate-y-1/2 text-gray-500 rounded-full p-0.5',
              'hover:text-gray-300 hover:bg-gray-700/50',
              'focus:outline-none focus:ring-2 focus:ring-brand-green',
              'transition-colors duration-150',
              clearPositionClasses[size]
            )}
            aria-label="Clear search"
          >
            <X className={iconSizeClasses[size]} aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

export { SearchInput };
