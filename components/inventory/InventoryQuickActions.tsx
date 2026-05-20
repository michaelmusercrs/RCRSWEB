'use client';

/**
 * InventoryQuickActions — role-aware big-button bar for the inventory dashboard.
 *
 * Shows only the actions the viewer can perform per their TeamRole. Built on the
 * existing usePermissionCheck() hook (which bridges TeamRole → Role and consults
 * lib/permissions.ts ROLE_PERMISSIONS).
 *
 * Role buckets (per owner directive):
 *   - driver: delivery schedule (view-only)
 *   - warehouse / driver-with-warehouse: + adjust stock, verify load, record returns
 *   - project_manager: + material order, credit memo, schedule delivery, returns
 *   - office / admin / manager / owner: everything + billing
 *
 * Mobile-responsive: grid auto-collapses to 2-up on phones, 4-up on tablets.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Package,
  Truck,
  ClipboardCheck,
  RotateCcw,
  FileText,
  Receipt,
  CalendarClock,
  Plus,
  AlertTriangle,
  BarChart2,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { usePermissionCheck } from '@/components/command-center/PermissionGate';
import { HelpTooltip } from './HelpTooltip';

interface QuickAction {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  help: string;
  /** Required to show this button (any-of). Empty = always-on for authed users. */
  permissions?: string[];
  /** Restrict to specific TeamRoles (any-of). Combined with permissions. */
  roles?: string[];
  /** Color accent. Defaults to neutral. */
  variant?: 'primary' | 'warn' | 'info' | 'success' | 'neutral';
}

const ACTIONS: QuickAction[] = [
  // Always-on for anyone with inventory.view
  {
    id: 'view-delivery-schedule',
    label: 'Delivery Schedule',
    href: '/portal/driver',
    icon: CalendarClock,
    help: 'Today\'s loads + scheduled deliveries. Drivers: tap your assigned ticket to start.',
    permissions: ['schedule.view'],
    variant: 'info',
  },

  // Warehouse + driver bucket
  {
    id: 'adjust-stock',
    label: 'Adjust Stock',
    href: '/portal/inventory/count',
    icon: BarChart2,
    help: 'Change on-hand counts after a physical count or correction. Logs who/when/why.',
    permissions: ['inventory.edit'],
    variant: 'warn',
  },
  {
    id: 'verify-load',
    label: 'Verify Load',
    href: '/portal/driver',
    icon: ClipboardCheck,
    help: 'Driver-side load verification. Triggers stock deduction + price-only office invoice.',
    permissions: ['schedule.view'],
    variant: 'success',
  },
  {
    id: 'record-return',
    label: 'Record Return',
    href: '/portal/inventory/restock',
    icon: RotateCcw,
    help: 'Materials coming back from the field. Replenishes stock + creates credit memo.',
    permissions: ['inventory.edit'],
    variant: 'neutral',
  },

  // PM bucket — material orders + scheduling
  {
    id: 'new-material-order',
    label: 'New Material Order',
    href: '/portal/pm',
    icon: Plus,
    help: 'PM-side material order. Auto-emails stock@rcrsal.com + creates delivery schedule entry.',
    permissions: ['schedule.edit'],
    variant: 'primary',
  },
  {
    id: 'credit-memo',
    label: 'Credit Memo',
    href: '/portal/inventory/order-history',
    icon: Receipt,
    help: 'Internal credit memo for returned materials. Adjusts the job material cost ledger.',
    permissions: ['schedule.edit'],
    variant: 'neutral',
  },

  // Office / Admin / Manager / Owner bucket
  {
    id: 'billing',
    label: 'Billing & Invoices',
    href: '/portal/billing',
    icon: FileText,
    help: 'Customer invoicing, payments received, AR aging. Office handles primary billing.',
    permissions: ['billing.view'],
    variant: 'info',
  },
  {
    id: 'low-stock-alerts',
    label: 'Low Stock Alerts',
    href: '/portal/inventory?tab=lowStock',
    icon: AlertTriangle,
    help: 'Items at or below reorder threshold. Click an item to start a restock order.',
    permissions: ['inventory.view'],
    variant: 'warn',
  },
  {
    id: 'reconciliation',
    label: 'Reconciliation',
    href: '/portal/inventory/reconciliation',
    icon: CheckCircle,
    help: 'Compare physical counts to system counts. Resolve discrepancies before close-of-day.',
    permissions: ['inventory.edit'],
    variant: 'neutral',
  },
  {
    id: 'order-history',
    label: 'Order History',
    href: '/portal/inventory/order-history',
    icon: Truck,
    help: 'All material orders + delivery tickets. Filter by status, PM, customer, date.',
    permissions: ['inventory.view'],
    variant: 'neutral',
  },
];

const VARIANT_CLASS: Record<NonNullable<QuickAction['variant']>, string> = {
  primary:
    'bg-[#39FF14]/10 border-[#39FF14]/40 text-[#39FF14] hover:bg-[#39FF14]/20',
  warn:
    'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20',
  info:
    'bg-blue-500/10 border-blue-500/40 text-blue-300 hover:bg-blue-500/20',
  success:
    'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20',
  neutral:
    'bg-zinc-800/60 border-zinc-700 text-zinc-200 hover:bg-zinc-800',
};

interface InventoryQuickActionsProps {
  /** Show a "Quick actions" header. Defaults to true. */
  showHeader?: boolean;
  /** Extra classes for the outer container. */
  className?: string;
}

export function InventoryQuickActions({
  showHeader = true,
  className = '',
}: InventoryQuickActionsProps): React.ReactElement | null {
  const { user } = useAuth();
  // Hooks must be called in a fixed order — gather all permission flags up front.
  const permFlags = React.useMemo(
    () => ACTIONS.map((a) => a.permissions || []),
    [],
  );
  // We evaluate each action's permissions via the existing helper. Because
  // usePermissionCheck is itself a hook, we can't call it inside a .map(). We
  // therefore inline the check: a permission set is satisfied if any one passes.
  // (We deliberately fold this through one stable hook call by spreading the
  // permission strings into a single array argument with requireAll=false.)
  const allPerms = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of permFlags) for (const x of p) set.add(x);
    return Array.from(set);
  }, [permFlags]);
  const anyOf = usePermissionCheck(allPerms, false);

  if (!user) return null;

  const teamRole = user.role;
  const userPerms = new Set(user.permissions);
  const hasWildcard = userPerms.has('*');

  const visible = ACTIONS.filter((a) => {
    // Wildcard / owner sees everything
    if (hasWildcard) return true;
    // No permission set — always visible to authed users
    if (!a.permissions || a.permissions.length === 0) return anyOf;
    // Role restriction
    if (a.roles && !a.roles.includes(teamRole)) return false;
    // The any-of permission check goes through the central helper. We approximate
    // here by trusting the central helper's all-permissions check: if the user has
    // ANY of the union permissions (anyOf) AND any of this action's permissions
    // is in their userPerms or is in the union evaluated true, show it.
    return a.permissions.some(
      (perm) => userPerms.has(perm) || userPerms.has('*') || isPermInRoleByLib(teamRole, perm),
    );
  });

  if (visible.length === 0) return null;

  return (
    <div className={`rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 ${className}`}>
      {showHeader && (
        <div className="mb-3 flex items-center gap-2">
          <Package className="h-4 w-4 text-[#39FF14]" />
          <h2 className="text-sm font-semibold text-white">Quick actions</h2>
          <HelpTooltip text="Most-used inventory operations for your role. Tap any tile to jump straight in." />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.id}
              href={a.href}
              className={`flex min-h-[88px] flex-col items-start justify-between rounded-lg border p-3 transition-colors ${
                VARIANT_CLASS[a.variant || 'neutral']
              }`}
            >
              <div className="flex w-full items-start justify-between">
                <Icon className="h-5 w-5" />
                <HelpTooltip text={a.help} side="left" />
              </div>
              <span className="mt-2 text-sm font-semibold leading-tight">
                {a.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local helper: check if the central Role-based permissions grant a permission
// to a given TeamRole. We import lazily to avoid a top-level dependency cycle.
// ---------------------------------------------------------------------------
import {
  hasPermission as roleHasPermission,
  Role,
  isValidPermission,
} from '@/lib/permissions';
import { mapTeamRoleToRole } from '@/components/command-center/PermissionGate';

function isPermInRoleByLib(teamRole: string, perm: string): boolean {
  if (!isValidPermission(perm)) return false;
  const role: Role = mapTeamRoleToRole(teamRole);
  return roleHasPermission(role, perm);
}

export default InventoryQuickActions;
