'use client';

/**
 * RCRS Command Center - Inventory Management Page
 *
 * Main inventory listing page with:
 * - Summary statistics (total items, low stock alerts, total value)
 * - Search and category filtering
 * - Low stock toggle filter
 * - Grid/Table view toggle
 * - Role-based visibility (hide cost/price for Sales/Driver)
 * - Add item button (permission gated)
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Package,
  AlertTriangle,
  DollarSign,
  Plus,
  LayoutGrid,
  List,
  Filter,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { StatCard } from '@/components/command-center/StatCard';
import { SearchInput } from '@/components/command-center/SearchInput';
import { DataTable, Column } from '@/components/command-center/DataTable';
import { PermissionGate, usePermissionCheck } from '@/components/command-center/PermissionGate';
import { InventoryCard } from '@/components/command-center/InventoryCard';
import { StockAdjustModal } from '@/components/command-center/StockAdjustModal';
import { HelpTooltip } from '@/components/inventory/HelpTooltip';
import { InventoryQuickActions } from '@/components/inventory/InventoryQuickActions';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface InventoryItem {
  sku: string;
  name: string;
  description?: string;
  category: string;
  quantity: number;
  minStock: number;
  maxStock?: number;
  unit?: string;
  location?: string;
  imageUrl?: string;
  cost?: number;
  price?: number;
  supplier?: string;
  lastUpdated?: string;
  updatedBy?: string;
}

interface InventorySummary {
  totalItems: number;
  lowStockCount: number;
  totalValue?: number;
  totalCost?: number;
}

interface InventoryApiResponse {
  success: boolean;
  data?: {
    items?: InventoryItem[];
    summary?: InventorySummary;
  };
  error?: string;
}

// =============================================================================
// CATEGORIES
// =============================================================================

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'Fasteners', label: 'Fasteners' },
  { value: 'Underlayment', label: 'Underlayment' },
  { value: 'Flashing', label: 'Flashing' },
  { value: 'Ventilation', label: 'Ventilation' },
  { value: 'Sealants', label: 'Sealants' },
  { value: 'Accessories', label: 'Accessories' },
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function InventoryPage() {
  const { user, hasPermission } = useAuth();

  // State
  const [items, setItems] = React.useState<InventoryItem[]>([]);
  const [summary, setSummary] = React.useState<InventorySummary>({
    totalItems: 0,
    lowStockCount: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Filters
  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [showLowStockOnly, setShowLowStockOnly] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'grid' | 'table'>('grid');

  // Stock adjustment modal
  const [adjustItem, setAdjustItem] = React.useState<InventoryItem | null>(null);
  const [isAdjusting, setIsAdjusting] = React.useState(false);

  // Permission checks - using correct permission names from types/roles.ts
  const canViewCosts = usePermissionCheck('inventory.viewCosts');
  const canEdit = usePermissionCheck('inventory.edit');

  // Determine if user can see cost/price based on role
  // Sales and Driver roles should NOT see cost/price information
  // Owner, Admin, Manager can see costs (per ROLE_PERMISSIONS in lib/permissions.ts)
  const userRole = user?.role;
  // Only Owner and Admin can delete inventory items
  const canDelete = userRole === 'owner' || userRole === 'admin';
  // Purchase-cost rule (AGENDA 3.8): owner/admin/office/manager only — NOT project_manager.
  // Selling PRICE is not gated by that rule, so PMs keep price visibility.
  const showCost = canViewCosts || userRole === 'owner' || userRole === 'admin' || userRole === 'office' || userRole === 'manager';
  const showPrice = showCost || userRole === 'project_manager';

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  const fetchInventory = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (category) params.append('category', category);
      if (showLowStockOnly) params.append('lowStock', 'true');
      if (user?.role) params.append('role', mapRoleForApi(user.role));

      const response = await fetch(`/api/command-center/inventory?${params.toString()}`);
      const data: InventoryApiResponse = await response.json();

      if (data.success && data.data) {
        setItems(data.data.items || []);
        setSummary(data.data.summary || { totalItems: 0, lowStockCount: 0 });
      } else {
        setError(data.error || 'Failed to fetch inventory');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [search, category, showLowStockOnly, user?.role]);

  React.useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // =============================================================================
  // STOCK ADJUSTMENT
  // =============================================================================

  const handleStockAdjust = async (
    sku: string,
    adjustment: number,
    reason: string
  ) => {
    setIsAdjusting(true);

    try {
      const response = await fetch('/api/command-center/inventory', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.userId || '',
          'x-user-name': user?.name || '',
          'x-user-role': user?.role ? mapRoleForApi(user.role) : 'Driver',
        },
        body: JSON.stringify({ sku, adjustment, reason }),
      });

      const data = await response.json();

      if (data.success) {
        // Refresh inventory
        await fetchInventory();
        setAdjustItem(null);
      } else {
        alert(data.error || 'Failed to adjust stock');
      }
    } catch {
      alert('Failed to adjust stock');
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleQuickAdjust = (item: InventoryItem, delta: number) => {
    // For quick +1/-1, use a simple reason
    const reason = delta > 0 ? 'Quick add' : 'Quick remove';
    handleStockAdjust(item.sku, delta, reason);
  };

  // =============================================================================
  // DELETE ITEM
  // =============================================================================

  const handleDeleteItem = async (item: InventoryItem) => {
    if (!confirm(`Are you sure you want to delete "${item.name}" (${item.sku})? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch('/api/command-center/inventory', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.userId || '',
          'x-user-name': user?.name || '',
          'x-user-role': user?.role ? mapRoleForApi(user.role) : 'Driver',
        },
        body: JSON.stringify({ sku: item.sku }),
      });

      const data = await response.json();

      if (data.success) {
        await fetchInventory();
      } else {
        alert(data.error || 'Failed to delete item');
      }
    } catch {
      alert('Failed to delete item');
    }
  };

  // =============================================================================
  // TABLE COLUMNS
  // =============================================================================

  const columns: Column<InventoryItem>[] = React.useMemo(() => {
    const cols: Column<InventoryItem>[] = [
      {
        accessor: 'sku',
        header: (
          <span className="inline-flex items-center">
            SKU <HelpTooltip text="Canonical product ID (INV-XXXX) or legacy SKU code." />
          </span>
        ),
        sortable: true,
        width: 'w-28',
        render: (value, row) => (
          <Link
            href={`/command-center/inventory/${row.sku}`}
            className="font-mono text-sm text-[#39FF14] hover:underline"
          >
            {String(value)}
          </Link>
        ),
      },
      {
        accessor: 'name',
        header: (
          <span className="inline-flex items-center">Name <HelpTooltip text="Product name + short description. Click the row to drill into history." /></span>
        ),
        sortable: true,
        render: (value, row) => (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-800">
              {row.imageUrl ? (
                <img
                  src={row.imageUrl}
                  alt={row.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-5 w-5 text-zinc-600" />
                </div>
              )}
            </div>
            <div>
              <p className="font-medium text-white">{String(value)}</p>
              {row.description && (
                <p className="text-xs text-zinc-500 line-clamp-1">
                  {row.description}
                </p>
              )}
            </div>
          </div>
        ),
      },
      {
        accessor: 'category',
        header: (
          <span className="inline-flex items-center">Category <HelpTooltip text="Catalog grouping (shingles, fasteners, etc.). Drives the category filter." /></span>
        ),
        sortable: true,
        width: 'w-32',
        render: (value) => (
          <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300">
            {String(value)}
          </span>
        ),
      },
      {
        accessor: 'quantity',
        header: (
          <span className="inline-flex items-center">Qty <HelpTooltip text="On-hand count. Yellow when ≤ 1.5× min. Red when at/below min." /></span>
        ),
        sortable: true,
        align: 'center',
        width: 'w-20',
        render: (value, row) => {
          const qty = Number(value);
          const isLow = qty <= row.minStock;
          const isWarning = qty <= row.minStock * 1.5 && qty > row.minStock;

          return (
            <div className="flex items-center justify-center gap-1.5">
              <span
                className={cn(
                  'text-lg font-bold',
                  isLow && 'text-red-400',
                  isWarning && 'text-yellow-400',
                  !isLow && !isWarning && 'text-[#39FF14]'
                )}
              >
                {qty}
              </span>
              {isLow && (
                <AlertTriangle className="h-4 w-4 text-red-400" />
              )}
            </div>
          );
        },
      },
      {
        accessor: 'minStock',
        header: (
          <span className="inline-flex items-center">Min <HelpTooltip text="Reorder threshold. Stock at/below this triggers a low-stock alert." /></span>
        ),
        sortable: true,
        align: 'center',
        width: 'w-16',
        render: (value) => (
          <span className="text-sm text-zinc-500">{String(value)}</span>
        ),
      },
    ];

    // Conditionally add cost column
    if (showCost) {
      cols.push({
        accessor: 'cost',
        header: 'Cost',
        sortable: true,
        align: 'right',
        width: 'w-24',
        render: (value) => (
          <span className="text-sm text-zinc-400">
            {value != null ? `$${Number(value).toFixed(2)}` : '-'}
          </span>
        ),
      });
    }

    // Conditionally add price column
    if (showPrice) {
      cols.push({
        accessor: 'price',
        header: 'Price',
        sortable: true,
        align: 'right',
        width: 'w-24',
        render: (value) => (
          <span className="text-sm font-medium text-[#39FF14]">
            {value != null ? `$${Number(value).toFixed(2)}` : '-'}
          </span>
        ),
      });
    }

    // Actions column
    cols.push({
      accessor: 'sku',
      header: '',
      width: 'w-28',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAdjustItem(row);
            }}
            className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"
            title="Adjust stock"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {canDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteItem(row);
              }}
              className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
              title="Delete item"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    });

    return cols;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCost, showPrice, canDelete]);

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="space-y-6">
      {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Materials Management</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Track and manage roofing materials and supplies
            </p>
          </div>

          <PermissionGate permission="inventory.edit">
            <Link
              href="/command-center/inventory/new"
              className="inline-flex items-center gap-2 rounded-lg bg-[#39FF14] px-4 py-2.5 font-semibold text-zinc-900 transition-colors hover:bg-[#39FF14]/90"
            >
              <Plus className="h-5 w-5" />
              Add Item
              <HelpTooltip text="Add a brand-new SKU to the catalog. Requires inventory.edit permission." />
            </Link>
          </PermissionGate>
        </div>

        {/* Role-aware Quick Actions */}
        <InventoryQuickActions />

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Items"
            value={summary.totalItems}
            icon={Package}
            description="Unique products in inventory"
          />

          <StatCard
            title="Low Stock Alerts"
            value={summary.lowStockCount}
            icon={AlertTriangle}
            variant={summary.lowStockCount > 0 ? 'warning' : 'default'}
            description="Items below minimum stock"
          />

          {showPrice && summary.totalValue !== undefined && (
            <StatCard
              title="Total Value"
              value={`$${summary.totalValue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              icon={DollarSign}
              variant="success"
              description="At retail prices"
            />
          )}

          {showCost && summary.totalCost !== undefined && (
            <StatCard
              title="Total Cost"
              value={`$${summary.totalCost.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              icon={DollarSign}
              description="Inventory cost basis"
            />
          )}
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4 lg:flex-row lg:items-center overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Search */}
          <div className="flex-1">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by name, SKU, or description..."
              debounceMs={300}
              size="md"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-3">
            <Filter className="h-5 w-5 text-zinc-500" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-[#39FF14] focus:outline-none focus:ring-1 focus:ring-[#39FF14]"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Low Stock Toggle */}
          <button
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              showLowStockOnly
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            )}
          >
            <AlertTriangle className="h-4 w-4" />
            Low Stock Only
          </button>

          {/* View Toggle */}
          <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-800 p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'rounded-md p-2 transition-colors',
                viewMode === 'grid'
                  ? 'bg-[#39FF14]/20 text-[#39FF14]'
                  : 'text-zinc-400 hover:text-white'
              )}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'rounded-md p-2 transition-colors',
                viewMode === 'table'
                  ? 'bg-[#39FF14]/20 text-[#39FF14]'
                  : 'text-zinc-400 hover:text-white'
              )}
              title="Table view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchInventory}
            disabled={loading}
            className="rounded-lg bg-zinc-800 p-2 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={cn('h-5 w-5', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Content */}
        {viewMode === 'grid' ? (
          // Grid View
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {loading ? (
              // Loading skeletons
              Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-64 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900"
                />
              ))
            ) : items.length === 0 ? (
              <div className="col-span-full py-12 text-center">
                <Package className="mx-auto h-12 w-12 text-zinc-600" />
                <h3 className="mt-4 text-lg font-medium text-white">
                  No items found
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  {search || category || showLowStockOnly
                    ? 'Try adjusting your filters'
                    : 'Get started by adding your first inventory item'}
                </p>
                {(search || category || showLowStockOnly) && (
                  <button
                    onClick={() => {
                      setSearch('');
                      setCategory('');
                      setShowLowStockOnly(false);
                    }}
                    className="mt-4 text-sm text-[#39FF14] hover:underline"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              items.map((item) => (
                <InventoryCard
                  key={item.sku}
                  item={item}
                  showCost={showCost}
                  showPrice={showPrice}
                  onAdjust={() => setAdjustItem(item)}
                  onQuickAdjust={(delta) => handleQuickAdjust(item, delta)}
                  onDelete={canDelete ? () => handleDeleteItem(item) : undefined}
                />
              ))
            )}
          </div>
        ) : (
          // Table View
          <DataTable
            columns={columns}
            data={items}
            loading={loading}
            emptyMessage="No inventory items found"
            rowKey="sku"
            onRowClick={(row) => {
              window.location.href = `/command-center/inventory/${row.sku}`;
            }}
            hoverable
            striped
          />
        )}

        {/* Results Count */}
        {!loading && items.length > 0 && (
          <p className="text-sm text-zinc-500">
            Showing {items.length} item{items.length !== 1 ? 's' : ''}
            {(search || category || showLowStockOnly) && ' (filtered)'}
          </p>
        )}

        {/* Stock Adjustment Modal */}
        {adjustItem && (
          <StockAdjustModal
            item={adjustItem}
            isOpen={true}
            onClose={() => setAdjustItem(null)}
            onSubmit={handleStockAdjust}
            isSubmitting={isAdjusting}
          />
        )}
      </div>
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Maps auth role to API role format
 */
function mapRoleForApi(role: string): string {
  const mapping: Record<string, string> = {
    owner: 'Owner',
    admin: 'Admin',
    office: 'Office',
    project_manager: 'Manager',
    driver: 'Driver',
    viewer: 'Sales',
  };
  return mapping[role] || 'Driver';
}

export default InventoryPage;
