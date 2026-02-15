'use client';

import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RepMetrics {
  repSlug: string;
  repName: string;
  totalLeads: number;
  totalLeads30d: number;
  respondedLeads: number;
  missedLeads: number;
  closeRate: number;
  avgResponseMinutes: number;
  isReceivingLeads: boolean;
  adminPaused: boolean;
  autoResumeAt: string | null;
}

interface RepPerformanceTableProps {
  metrics: RepMetrics[];
  className?: string;
}

type SortField = 'repName' | 'closeRate' | 'avgResponseMinutes' | 'totalLeads30d' | 'totalLeads' | 'missedLeads' | 'status';
type SortDirection = 'asc' | 'desc';

export default function RepPerformanceTable({ metrics, className }: RepPerformanceTableProps) {
  const [sortField, setSortField] = useState<SortField>('totalLeads30d');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sorted = useMemo(() => {
    const copy = [...metrics];
    copy.sort((a, b) => {
      let valA: number | string;
      let valB: number | string;

      switch (sortField) {
        case 'repName':
          valA = a.repName.toLowerCase();
          valB = b.repName.toLowerCase();
          break;
        case 'closeRate':
          valA = a.closeRate;
          valB = b.closeRate;
          break;
        case 'avgResponseMinutes':
          valA = a.avgResponseMinutes;
          valB = b.avgResponseMinutes;
          break;
        case 'totalLeads30d':
          valA = a.totalLeads30d;
          valB = b.totalLeads30d;
          break;
        case 'totalLeads':
          valA = a.totalLeads;
          valB = b.totalLeads;
          break;
        case 'missedLeads':
          valA = a.missedLeads;
          valB = b.missedLeads;
          break;
        case 'status':
          valA = a.isReceivingLeads ? 1 : 0;
          valB = b.isReceivingLeads ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      return sortDirection === 'asc'
        ? (valA as number) - (valB as number)
        : (valB as number) - (valA as number);
    });
    return copy;
  }, [metrics, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} className="text-gray-300" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={12} className="text-blue-600" />
    ) : (
      <ArrowDown size={12} className="text-blue-600" />
    );
  };

  const getCloseRateColor = (rate: number): string => {
    if (rate >= 50) return 'text-green-600';
    if (rate >= 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getResponseTimeColor = (minutes: number): string => {
    if (minutes <= 10) return 'text-green-600';
    if (minutes <= 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {[
                { field: 'repName' as SortField, label: 'Rep' },
                { field: 'closeRate' as SortField, label: 'Close %' },
                { field: 'avgResponseMinutes' as SortField, label: 'Avg Response' },
                { field: 'totalLeads30d' as SortField, label: 'Leads (30d)' },
                { field: 'totalLeads' as SortField, label: 'Total Leads' },
                { field: 'missedLeads' as SortField, label: 'Missed' },
                { field: 'status' as SortField, label: 'Status' },
              ].map(({ field, label }) => (
                <th
                  key={field}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort(field)}
                >
                  <div className="flex items-center gap-1">
                    {label}
                    <SortIcon field={field} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((rep) => (
              <tr key={rep.repSlug} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{rep.repName}</div>
                  <div className="text-xs text-gray-400">{rep.repSlug}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('font-semibold', getCloseRateColor(rep.closeRate))}>
                    {rep.closeRate.toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('font-medium', getResponseTimeColor(rep.avgResponseMinutes))}>
                    {rep.avgResponseMinutes > 0 ? `${rep.avgResponseMinutes.toFixed(0)}m` : '--'}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{rep.totalLeads30d}</td>
                <td className="px-4 py-3 text-gray-600">{rep.totalLeads}</td>
                <td className="px-4 py-3">
                  <span className={cn(rep.missedLeads > 0 ? 'text-red-600 font-medium' : 'text-gray-400')}>
                    {rep.missedLeads}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {rep.isReceivingLeads ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                      ON
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                      OFF
                      {rep.adminPaused && <Lock size={10} />}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {metrics.length === 0 && (
        <div className="p-8 text-center text-gray-400 text-sm">
          No rep performance data available.
        </div>
      )}
    </div>
  );
}
