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
          className="ml-1 h-4 w-4 text-gray-500"
          aria-hidden="true"
        />
      );
    }

    return sortState.direction === 'asc' ? (
      <ChevronUp className="ml-1 h-4 w-4 text-brand-green" aria-hidden="true" />
    ) : (
      <ChevronDown className="ml-1 h-4 w-4 text-brand-green" aria-hidden="true" />
    );
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className={cn('overflow-x-auto rounded-lg border border-gray-700', className)}>
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-[#1a1a1a]">
            <tr>
              {columns.map((column, i) => (
                <th
                  key={i}
                  className={cn(
                    'px-4 py-3 text-left text-sm font-semibold text-gray-300',
                    column.width
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700 bg-[#242424]">
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((_, colIndex) => (
                  <td key={colIndex} className="px-4 py-3">
                    <div
                      className="h-4 animate-pulse rounded bg-gray-600"
                      style={{ width: `${60 + Math.random() * 40}%` }}
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
      <div className={cn('overflow-x-auto rounded-lg border border-gray-700', className)}>
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-[#1a1a1a]">
            <tr>
              {columns.map((column, i) => (
                <th
                  key={i}
                  className={cn(
                    'px-4 py-3 text-left text-sm font-semibold text-gray-300',
                    column.width
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-[#242424]">
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-gray-500"
              >
                <p className="text-lg">{emptyMessage}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div
      className={cn('overflow-x-auto rounded-lg border border-gray-700', className)}
      role="region"
      aria-label="Data table"
    >
      <table className="min-w-full divide-y divide-gray-700">
        <thead className="bg-[#1a1a1a]">
          <tr>
            {columns.map((column, i) => {
              const accessor = String(column.accessor);
              return (
                <th
                  key={i}
                  scope="col"
                  className={cn(
                    'px-4 py-3 text-sm font-semibold text-gray-300',
                    column.width,
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                    column.align !== 'center' && column.align !== 'right' && 'text-left',
                    column.sortable && 'cursor-pointer select-none hover:bg-gray-800'
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
        <tbody className="divide-y divide-gray-700 bg-[#242424]">
          {sortedData.map((row, rowIndex) => (
            <tr
              key={getRowKey(row, rowIndex)}
              className={cn(
                striped && rowIndex % 2 === 1 && 'bg-[#2a2a2a]',
                hoverable && 'hover:bg-gray-700/50 transition-colors',
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
                      'px-4 py-3 text-sm text-gray-200',
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
