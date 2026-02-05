/**
 * RCRS Command Center - Shared UI Components
 *
 * This barrel file exports all reusable components for the Command Center.
 * Import components like:
 *   import { StatCard, DataTable, PermissionGate } from '@/components/command-center';
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

// StatCard - Metric display cards with trend indicators
export { StatCard, statCardVariants } from './StatCard';
export type { StatCardProps } from './StatCard';

// DataTable - Generic sortable data table with loading states
export { DataTable } from './DataTable';
export type { DataTableProps, Column } from './DataTable';

// PermissionGate - Conditional rendering based on user permissions
export { PermissionGate, usePermissionCheck, mapTeamRoleToRole } from './PermissionGate';
export type { PermissionGateProps } from './PermissionGate';

// RoleBadge - Role display badges with appropriate colors
export { RoleBadge, roleBadgeVariants } from './RoleBadge';
export type { RoleBadgeProps } from './RoleBadge';

// LoadingSpinner - Animated loading indicators
export { LoadingSpinner, LoadingOverlay, spinnerVariants } from './LoadingSpinner';
export type { LoadingSpinnerProps, LoadingOverlayProps } from './LoadingSpinner';

// AlertBanner - Full-width alert notifications
export { AlertBanner, alertBannerVariants } from './AlertBanner';
export type { AlertBannerProps } from './AlertBanner';

// QuickAction - Dashboard quick action buttons
export { QuickAction, QuickActionGroup, quickActionVariants } from './QuickAction';
export type { QuickActionProps, QuickActionGroupProps } from './QuickAction';

// SearchInput - Debounced search input with clear button
export { SearchInput } from './SearchInput';
export type { SearchInputProps } from './SearchInput';

// CommandCenterLayout - Main layout component with sidebar navigation
export { CommandCenterLayout } from './CommandCenterLayout';

// InventoryCard - Card component for displaying inventory items in grid view
export { InventoryCard } from './InventoryCard';
export type { InventoryCardProps, InventoryItem } from './InventoryCard';

// StockAdjustModal - Modal for adjusting inventory stock levels
export { StockAdjustModal } from './StockAdjustModal';
export type { StockAdjustModalProps, InventoryItemBasic } from './StockAdjustModal';

// ExtensionCard - Card component for phone system extensions
export { ExtensionCard, ExtensionCardCompact } from './ExtensionCard';
export type { ExtensionCardProps } from './ExtensionCard';
