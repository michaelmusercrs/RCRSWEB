'use client';

/**
 * RCRS Command Center - Phone System Dashboard
 *
 * Main phone system page showing:
 * - Extension directory with status
 * - Ring group visualization
 * - Quick access to feature codes
 *
 * Permissions:
 * - phone.viewAll: See all extensions and manage
 * - phone.view: See own extension + directory (read-only)
 * - phone.manage: Show management controls
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  Users,
  Voicemail,
  Settings,
  Search,
  ArrowRight,
  Clock,
  Shield,
  Hash,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { StatCard } from '@/components/command-center/StatCard';
import { PermissionGate } from '@/components/command-center/PermissionGate';
import { ExtensionCard, ExtensionCardCompact } from '@/components/command-center/ExtensionCard';
import { DataTable, Column } from '@/components/command-center/DataTable';
import {
  EXTENSIONS,
  RING_GROUPS,
  MAIN_DID,
  formatPhoneNumber,
  getExtensionByEmail,
  getPrimaryRingGroupMembers,
  getSecondaryRingGroupMembers,
  getOnlineExtensionCount,
  type Extension,
} from '@/lib/phone-data';
import { cn } from '@/lib/utils';

// =============================================================================
// STATUS BADGE COMPONENT
// =============================================================================

function StatusBadge({ status }: { status: Extension['status'] }) {
  const config = {
    online: { bg: 'bg-lime-500/20', text: 'text-lime-400', label: 'Online' },
    busy: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Busy' },
    ringing: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Ringing' },
    dnd: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'DND' },
    offline: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', label: 'Offline' },
  };

  const { bg, text, label } = config[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        bg,
        text
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'online' && 'bg-lime-400',
          status === 'busy' && 'bg-yellow-400',
          status === 'ringing' && 'bg-blue-400',
          status === 'dnd' && 'bg-red-400',
          status === 'offline' && 'bg-zinc-400'
        )}
      />
      {label}
    </span>
  );
}

// =============================================================================
// ROLE BADGE COMPONENT
// =============================================================================

function PhoneRoleBadge({ role }: { role: Extension['role'] }) {
  const config = {
    Owner: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
    Admin: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
    Manager: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    User: { bg: 'bg-zinc-500/20', text: 'text-zinc-400' },
  };

  const { bg, text } = config[role];

  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-medium',
        bg,
        text
      )}
    >
      {role}
    </span>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function PhoneSystemPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const [searchQuery, setSearchQuery] = React.useState('');

  // Get the current user's extension
  const userExtension = user?.email ? getExtensionByEmail(user.email) : undefined;

  // Check permissions
  const canViewAll = hasPermission('phone.viewAll');
  const canManage = hasPermission('phone.manage');

  // Filter extensions based on search
  const filteredExtensions = React.useMemo(() => {
    if (!searchQuery) return EXTENSIONS;

    const query = searchQuery.toLowerCase();
    return EXTENSIONS.filter(
      (ext) =>
        ext.name.toLowerCase().includes(query) ||
        ext.extension.includes(query) ||
        ext.email.toLowerCase().includes(query) ||
        ext.role.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Stats
  const totalExtensions = EXTENSIONS.length;
  const onlineCount = getOnlineExtensionCount();
  const ringGroupCount = RING_GROUPS.length;

  // Get ring group 600 data
  const mainRingGroup = RING_GROUPS.find((rg) => rg.groupNumber === '600');
  const primaryMembers = getPrimaryRingGroupMembers('600');
  const secondaryMembers = getSecondaryRingGroupMembers('600');

  // Table columns
  const columns: Column<Extension>[] = [
    {
      accessor: 'extension',
      header: 'Ext',
      sortable: true,
      width: 'w-16',
      render: (value) => (
        <span className="font-mono font-semibold text-lime-400">
          {String(value)}
        </span>
      ),
    },
    {
      accessor: 'name',
      header: 'Name',
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">{row.name}</span>
          {userExtension?.extension === row.extension && (
            <span className="rounded bg-lime-500/20 px-1.5 py-0.5 text-xs text-lime-400">
              You
            </span>
          )}
        </div>
      ),
    },
    {
      accessor: 'role',
      header: 'Role',
      sortable: true,
      render: (value) => <PhoneRoleBadge role={value as Extension['role']} />,
    },
    {
      accessor: 'email',
      header: 'Email',
      sortable: true,
      render: (value) => (
        <span className="text-zinc-400">{String(value)}</span>
      ),
    },
    {
      accessor: 'status',
      header: 'Status',
      sortable: true,
      align: 'center',
      render: (value) => <StatusBadge status={value as Extension['status']} />,
    },
  ];

  // Handle row click - navigate to extension detail
  const handleRowClick = (extension: Extension) => {
    router.push(`/command-center/phone/${extension.extension}`);
  };

  // Handle call button
  const handleCall = (extension: Extension) => {
    // In a real app, this would initiate a click-to-call
    alert(`Calling ${extension.name} at ext. ${extension.extension}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Phone System</h1>
          <p className="mt-1 flex items-center gap-2 text-zinc-400">
            <Phone size={16} className="text-lime-400" />
            Main Line: <span className="font-mono text-white">{formatPhoneNumber(MAIN_DID)}</span>
          </p>
        </div>
        <PermissionGate permission="phone.manage">
          <Link
            href="/command-center/phone/manage"
            className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-lime-400"
          >
            <Settings size={16} />
            Manage System
          </Link>
        </PermissionGate>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Extensions"
          value={totalExtensions}
          icon={Phone}
          description="configured"
        />
        <StatCard
          title="Online Now"
          value={onlineCount}
          icon={PhoneCall}
          description={`of ${totalExtensions} extensions`}
          variant={onlineCount > totalExtensions / 2 ? 'success' : 'default'}
        />
        <StatCard
          title="Ring Groups"
          value={ringGroupCount}
          icon={Users}
          description="active"
        />
        <StatCard
          title="Your Extension"
          value={userExtension?.extension || 'N/A'}
          icon={PhoneIncoming}
          description={userExtension?.name || 'Not assigned'}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Extension Directory */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-white">
                Extension Directory
              </h2>
              {/* Search */}
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                />
                <input
                  type="text"
                  placeholder="Search extensions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-9 pr-4 text-sm text-white placeholder-zinc-500 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500 sm:w-64"
                />
              </div>
            </div>

            <DataTable
              columns={columns}
              data={filteredExtensions}
              onRowClick={handleRowClick}
              rowKey="extension"
              striped
              emptyMessage="No extensions found"
            />

            <p className="mt-4 text-xs text-zinc-500">
              Click a row to view extension details and settings
            </p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Ring Group Visualization */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Ring Group 600
              </h2>
              <span className="rounded-full bg-lime-500/20 px-2 py-0.5 text-xs font-medium text-lime-400">
                Main Line
              </span>
            </div>

            {mainRingGroup && (
              <div className="space-y-4">
                {/* Strategy */}
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Shield size={14} className="text-zinc-500" />
                  Strategy: <span className="text-white capitalize">{mainRingGroup.strategy}</span>
                </div>

                {/* Primary Ring (Immediate) */}
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-lime-500/20">
                      <span className="text-xs font-bold text-lime-400">1</span>
                    </div>
                    <span className="text-sm font-medium text-white">
                      Primary Ring
                    </span>
                    <span className="text-xs text-zinc-500">(Immediate)</span>
                  </div>
                  <div className="space-y-2 pl-7">
                    {primaryMembers.map((ext) => (
                      <ExtensionCardCompact
                        key={ext.extension}
                        extension={ext}
                        ringDelay={0}
                        onClick={() => router.push(`/command-center/phone/${ext.extension}`)}
                      />
                    ))}
                  </div>
                </div>

                {/* Secondary Ring (After delay) */}
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700">
                      <span className="text-xs font-bold text-zinc-400">2</span>
                    </div>
                    <span className="text-sm font-medium text-white">
                      Secondary Ring
                    </span>
                    <span className="text-xs text-zinc-500">(After 5 sec)</span>
                  </div>
                  <div className="space-y-2 pl-7">
                    {secondaryMembers.map((ext) => (
                      <ExtensionCardCompact
                        key={ext.extension}
                        extension={ext}
                        ringDelay={5}
                        onClick={() => router.push(`/command-center/phone/${ext.extension}`)}
                      />
                    ))}
                  </div>
                </div>

                {/* Timeout Info */}
                <div className="flex items-center gap-2 border-t border-zinc-800 pt-4 text-sm text-zinc-400">
                  <Clock size={14} className="text-zinc-500" />
                  Timeout: <span className="text-white">{mainRingGroup.ringTimeout}s</span>
                  <ArrowRight size={14} className="text-zinc-600" />
                  <Voicemail size={14} className="text-zinc-500" />
                  <span className="text-zinc-500">Voicemail</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">
              Quick Actions
            </h2>
            <div className="space-y-2">
              {userExtension && (
                <Link
                  href={`/command-center/phone/${userExtension.extension}`}
                  className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-800/30 p-3 transition-colors hover:border-zinc-700 hover:bg-zinc-800/50"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-lime-500/10">
                    <Phone size={18} className="text-lime-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      My Extension
                    </p>
                    <p className="text-xs text-zinc-500">
                      View your settings
                    </p>
                  </div>
                  <ArrowRight size={16} className="text-zinc-600" />
                </Link>
              )}

              <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-800/30 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10">
                  <Voicemail size={18} className="text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">
                    Check Voicemail
                  </p>
                  <p className="font-mono text-xs text-zinc-500">Dial *97</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-800/30 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                  <Hash size={18} className="text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">
                    Forward Calls
                  </p>
                  <p className="font-mono text-xs text-zinc-500">Dial *72</p>
                </div>
              </div>

              <PermissionGate permission="phone.manage">
                <Link
                  href="/command-center/phone/manage"
                  className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-800/30 p-3 transition-colors hover:border-zinc-700 hover:bg-zinc-800/50"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                    <Settings size={18} className="text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      Manage System
                    </p>
                    <p className="text-xs text-zinc-500">Admin settings</p>
                  </div>
                  <ArrowRight size={16} className="text-zinc-600" />
                </Link>
              </PermissionGate>
            </div>
          </div>

          {/* Your Extension Card (if assigned) */}
          {userExtension && (
            <div className="rounded-xl border border-lime-500/20 bg-lime-500/5 p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-lime-400">
                Your Extension
              </p>
              <ExtensionCard
                extension={userExtension}
                showEmail
                showActions
                onCall={handleCall}
                onClick={() => router.push(`/command-center/phone/${userExtension.extension}`)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
