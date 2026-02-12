'use client';

import * as React from 'react';
import {
  Search,
  Filter,
  LayoutGrid,
  Table,
  RefreshCw,
  Shield,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLE_DISPLAY_NAMES, type TeamRole } from '@/lib/team-roles';
import { TeamMemberCard, type TeamMemberAccessData } from './TeamMemberCard';
import { AccessControlMatrix } from './AccessControlMatrix';
import { MemberEditModal } from './MemberEditModal';

type ViewMode = 'cards' | 'matrix';

export function TeamAccessManager() {
  const [members, setMembers] = React.useState<TeamMemberAccessData[]>([]);
  const [allModules, setAllModules] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sheetsUnavailable, setSheetsUnavailable] = React.useState(false);

  // UI state
  const [viewMode, setViewMode] = React.useState<ViewMode>('cards');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<string>('all');
  const [editingMember, setEditingMember] = React.useState<TeamMemberAccessData | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState<string | null>(null);

  // Fetch data
  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/command-center/team-access');
      if (!res.ok) throw new Error('Failed to fetch team access data');
      const data = await res.json();
      setMembers(data.members);
      setAllModules(data.allModules);
      setSheetsUnavailable(data.sheetsUnavailable || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save overrides
  const handleSaveOverrides = async (memberId: string, overrides: Record<string, boolean>) => {
    const res = await fetch('/api/command-center/team-access', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId,
        overrides,
        updatedBy: 'admin', // The API route doesn't validate this for now
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to save');
    }

    // Refresh data
    await fetchData();
    setEditingMember(null);

    // Show success message
    const member = members.find(m => m.id === memberId);
    setSaveSuccess(`Access updated for ${member?.name || memberId}`);
    setTimeout(() => setSaveSuccess(null), 3000);
  };

  // Filter members
  const filteredMembers = members.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          member.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Get unique roles
  const roles = ['all', ...new Set(members.map(m => m.role))];

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-500" />
          <p className="text-sm text-zinc-500">Loading access control...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
          <p className="mt-3 text-sm text-red-400">{error}</p>
          <button
            onClick={fetchData}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sheets Unavailable Warning */}
      {sheetsUnavailable && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-yellow-400" />
            <p className="text-sm text-yellow-400">
              Google Sheets unavailable. Showing role defaults only. Custom overrides cannot be saved.
            </p>
          </div>
        </div>
      )}

      {/* Success Message */}
      {saveSuccess && (
        <div className="rounded-lg border border-lime-500/30 bg-lime-500/10 px-4 py-3">
          <p className="text-sm font-medium text-lime-400">{saveSuccess}</p>
        </div>
      )}

      {/* Controls Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-9 pr-4 text-sm text-white placeholder-zinc-500 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
            />
          </div>

          {/* Role Filter */}
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-zinc-500" />
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none"
            >
              {roles.map(role => (
                <option key={role} value={role}>
                  {role === 'all' ? 'All Roles' : ROLE_DISPLAY_NAMES[role as TeamRole] || role}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 p-1">
          <button
            onClick={() => setViewMode('cards')}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              viewMode === 'cards'
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:text-zinc-300'
            )}
          >
            <LayoutGrid size={14} />
            Cards
          </button>
          <button
            onClick={() => setViewMode('matrix')}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              viewMode === 'matrix'
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:text-zinc-300'
            )}
          >
            <Table size={14} />
            Matrix
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="text-xs font-medium text-zinc-500">Total Members</p>
          <p className="mt-1 text-xl font-bold text-white">{members.length}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="text-xs font-medium text-zinc-500">With Custom Access</p>
          <p className="mt-1 text-xl font-bold text-blue-400">
            {members.filter(m => m.hasCustomAccess).length}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="text-xs font-medium text-zinc-500">Using Defaults</p>
          <p className="mt-1 text-xl font-bold text-zinc-300">
            {members.filter(m => !m.hasCustomAccess).length}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="text-xs font-medium text-zinc-500">Total Modules</p>
          <p className="mt-1 text-xl font-bold text-white">{allModules.length}</p>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'cards' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.map(member => (
            <TeamMemberCard
              key={member.id}
              member={member}
              onEditAccess={setEditingMember}
            />
          ))}
          {filteredMembers.length === 0 && (
            <div className="col-span-full flex min-h-[200px] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900">
              <div className="text-center">
                <Shield className="mx-auto h-10 w-10 text-zinc-600" />
                <p className="mt-2 text-zinc-400">No members found</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <AccessControlMatrix
          members={filteredMembers}
          allModules={allModules}
          onSaveOverrides={handleSaveOverrides}
        />
      )}

      {/* Edit Modal */}
      {editingMember && (
        <MemberEditModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSave={handleSaveOverrides}
        />
      )}
    </div>
  );
}
