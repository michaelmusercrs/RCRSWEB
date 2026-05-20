'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type { Role } from '@/types/roles';
import type { TeamRole } from '@/lib/team-roles';

/**
 * Role badge styling variants.
 * Colors are consistent with company branding and role hierarchy.
 */
const roleBadgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      role: {
        // Types from @/types/roles
        Owner: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
        Admin: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
        Manager: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
        Sales: 'bg-green-500/20 text-green-400 border border-green-500/30',
        Driver: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
        Office: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
        // Types from @/lib/team-roles (lowercase)
        owner: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
        admin: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
        manager: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
        sales: 'bg-green-500/20 text-green-400 border border-green-500/30',
        office: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
        project_manager: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
        driver: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
        viewer: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

/** Combined role type supporting both role systems */
type CombinedRole = Role | TeamRole;

export interface RoleBadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'role'>,
    Omit<VariantProps<typeof roleBadgeVariants>, 'role'> {
  /** User role to display */
  role: CombinedRole;
  /** Optional custom label (overrides default role name) */
  label?: string;
  /** Whether to show a dot indicator */
  showDot?: boolean;
}

/**
 * Role display names for user-friendly labels.
 */
const ROLE_DISPLAY_NAMES: Record<CombinedRole, string> = {
  // From @/types/roles
  Owner: 'Owner',
  Admin: 'Admin',
  Manager: 'Manager',
  ProjectManager: 'Project Manager',
  Sales: 'Sales',
  Driver: 'Driver',
  Office: 'Office',
  Viewer: 'Viewer',
  // From @/lib/team-roles
  owner: 'Owner',
  admin: 'Admin',
  office: 'Office',
  project_manager: 'Project Manager',
  manager: 'Manager',
  driver: 'Driver',
  sales: 'Sales',
  viewer: 'Viewer',
};

/**
 * RoleBadge component for displaying user roles with appropriate styling.
 * Supports both Role type from types/roles.ts and TeamRole from lib/team-roles.ts.
 *
 * @example
 * <RoleBadge role="Owner" />
 * <RoleBadge role="project_manager" size="lg" />
 * <RoleBadge role="Sales" label="Sales Rep" showDot />
 */
const RoleBadge = React.forwardRef<HTMLSpanElement, RoleBadgeProps>(
  ({ className, role, label, size, showDot = false, ...props }, ref) => {
    const displayName = label || ROLE_DISPLAY_NAMES[role] || role;

    // Cast role to the variant type to handle combined role types
    const variantRole = role as VariantProps<typeof roleBadgeVariants>['role'];

    return (
      <span
        ref={ref}
        className={cn(roleBadgeVariants({ role: variantRole, size }), className)}
        {...props}
      >
        {showDot && (
          <span
            className={cn(
              'mr-1.5 h-1.5 w-1.5 rounded-full',
              role === 'Owner' || role === 'owner' ? 'bg-amber-400' : '',
              role === 'Admin' || role === 'admin' ? 'bg-purple-400' : '',
              role === 'Manager' || role === 'project_manager' ? 'bg-blue-400' : '',
              role === 'Sales' ? 'bg-green-400' : '',
              role === 'Driver' || role === 'driver' ? 'bg-orange-400' : '',
              role === 'Office' || role === 'office' ? 'bg-gray-400' : '',
              role === 'viewer' ? 'bg-slate-400' : ''
            )}
            aria-hidden="true"
          />
        )}
        {displayName}
      </span>
    );
  }
);

RoleBadge.displayName = 'RoleBadge';

export { RoleBadge, roleBadgeVariants };
