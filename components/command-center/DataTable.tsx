'use client';

import * as React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  /** Unique key to access data in row object */
  accessor: keyof T | string;
  /** Display header text */
  header: string;
  /** Whether column is sortable */
  sortable?: boolean;
  /** Custom render function for cell content */
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
  /** Column width class (e.g., 'w-32', 'min-w-[200px]') */
  width?: string;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
}

export interface DataTableProps<T> {
  /** Column definitions */
  columns: Column<T>[];
  /** Data array to display */
  data: T[];
  /** Whether data is loading */
  loading?: boolean;
  /** Message to show when data is empty */
  emptyMessage?: string;
  /** Optional row key accessor (defaults to index) */
  rowKey?: keyof T | ((row: T, index: number) => string | number);
  /** Optional click handler for rows */
  onRowClick?: (row: T, index: number) => void;
  /** Optional CSS class for table container */
  className?: string;
  /** Enable striped rows */
  striped?: boolean;
  /** Enable hover effect on rows */
  hoverable?: boolean;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  column: string | null;
  direction: SortDirection;
}

/**
 * Generic DataTable component with sorting, loading states, and responsive design.
 * Supports custom cell rendering and full TypeScript generics.
 */
function DataTable<T extends object>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data available',
  rowKey,
  onRowClick,
  className,
  striped = false,
  hoverable = true,
}: DataTableProps<T>) {
  const [sortState, setSortState] = React.useState<SortState>({
    column: null,
    direction: null,
  });

  // Get value from row using accessor (supports nested paths like 'user.name')
  const getValue = (row: T, accessor: keyof T | string): unknown => {
    if (typeof accessor === 'string' && accessor.includes('.')) {
      return accessor.split('.').reduce((obj, key) => {
        return obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : undefined;
      }, row as unknown);
    }
    return row[accessor as keyof T];
  };

  // Get row key for React list rendering
  const getRowKey = (row: T, index: number): string | number => {
    if (!rowKey) return index;
    if (typeof rowKey === 'function') return rowKey(row, index);
    return row[rowKey] as string | number;
  };

  // Handle column header click for sorting
  const handleSort = (column: Column<T>) => {
    if (!column.sortable) return;

    const accessor = String(column.accessor);
    let newDirection: SortDirection = 'asc';

    if (sortState.column === accessor) {
      if (sortState.direction === 'asc') newDirection = 'desc';
      else if (sortState.direction === 'desc') newDirection = null;
    }

    setSortState({
      column: newDirection ? accessor : null,
      direction: newDirection,
    });
  };

  // Sort data based on current sort state
  const sortedData = React.useMemo(() => {
    if (!sortState.column || !sortState.direction) return data;

    return [...data].sort((a, b) => {
      const aVal = getValue(a, sortState.column!);
      const bVal = getValue(b, sortState.column!);

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortState.direction === 'asc' ? 1 : -1;
      if (bVal == null) return sortState.direction === 'asc' ? -1 : 1;

      // Compare values
      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortState.direction === 'asc' ? comparison : -comparison;
    });
  }, [data, sortState]);

  // Render sort indicator
  const renderSortIcon = (column: Column<T>) => {
    if (!column.sortable) return null;

    const accessor = String(column.accessor);
    const isActive = sortState.column === accessor;

    if (!isActive) {
      return (
        <ChevronsUpDown
          className="ml-1.5 h-3.5 w-3.5 text-zinc-600"
          aria-hidden="true"
        />
      );
    }

    return sortState.direction === 'asc' ? (
      <ChevronUp className="ml-1.5 h-3.5 w-3.5 text-lime-400" aria-hidden="true" />
    ) : (
      <ChevronDown className="ml-1.5 h-3.5 w-3.5 text-lime-400" aria-hidden="true" />
    );
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className={cn('overflow-x-auto rounded-xl border border-zinc-800', className)} style={{ WebkitOverflowScrolling: 'touch' }}>
        <table className="min-w-full divide-y divide-zinc-800 table-auto">
          <thead className="bg-zinc-900">
            <tr>
              {columns.map((column, i) => (
                <th
                  key={i}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400',
                    column.width
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 bg-zinc-900">
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <tr key={rowIndex} className="animate-pulse">
                {columns.map((_, colIndex) => (
                  <td key={colIndex} className="px-4 py-3.5">
                    <div
                      className="h-4 rounded bg-zinc-800"
                      style={{ width: colIndex === 0 ? '70%' : colIndex === columns.length - 1 ? '40%' : '60%' }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className={cn('overflow-x-auto rounded-xl border border-zinc-800', className)} style={{ WebkitOverflowScrolling: 'touch' }}>
        <table className="min-w-full divide-y divide-zinc-800 table-auto">
          <thead className="bg-zinc-900">
            <tr>
              {columns.map((column, i) => (
                <th
                  key={i}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400',
                    column.width
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-zinc-900">
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-16 text-center"
              >
                <div className="flex flex-col items-center justify-center">
                  <div className="h-12 w-12 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-3">
                    <svg className="h-6 w-6 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-zinc-400">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div
      className={cn('overflow-x-auto rounded-xl border border-zinc-800', className)}
      role="region"
      aria-label="Data table"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <table className="min-w-full divide-y divide-zinc-800 table-auto">
        <thead className="bg-zinc-900">
          <tr>
            {columns.map((column, i) => {
              const accessor = String(column.accessor);
              return (
                <th
                  key={i}
                  scope="col"
                  className={cn(
                    'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400',
                    column.width,
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                    column.align !== 'center' && column.align !== 'right' && 'text-left',
                    column.sortable && 'cursor-pointer select-none hover:bg-zinc-800 transition-colors'
                  )}
                  onClick={() => handleSort(column)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSort(column);
                    }
                  }}
                  tabIndex={column.sortable ? 0 : undefined}
                  role={column.sortable ? 'button' : undefined}
                  aria-sort={
                    sortState.column === accessor
                      ? sortState.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  <span className="inline-flex items-center">
                    {column.header}
                    {renderSortIcon(column)}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800 bg-zinc-900">
          {sortedData.map((row, rowIndex) => (
            <tr
              key={getRowKey(row, rowIndex)}
              className={cn(
                striped && rowIndex % 2 === 1 && 'bg-zinc-900/50',
                hoverable && 'hover:bg-zinc-800/50 transition-colors',
                onRowClick && 'cursor-pointer'
              )}
              onClick={() => onRowClick?.(row, rowIndex)}
              onKeyDown={(e) => {
                if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onRowClick(row, rowIndex);
                }
              }}
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? 'button' : undefined}
            >
              {columns.map((column, colIndex) => {
                const value = getValue(row, column.accessor);
                return (
                  <td
                    key={colIndex}
                    className={cn(
                      'px-4 py-3 text-sm text-zinc-200',
                      column.width,
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right',
                      column.align !== 'center' && column.align !== 'right' && 'text-left'
                    )}
                  >
                    {column.render
                      ? column.render(value, row, rowIndex)
                      : value != null
                      ? String(value)
                      : '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

DataTable.displayName = 'DataTable';

export { DataTable };
