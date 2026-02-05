'use client';

/**
 * RCRS Command Center - Inventory Item Detail Page
 *
 * Shows full details for a single inventory item:
 * - Item information (name, SKU, description, category, etc.)
 * - Stock level with visual indicator
 * - Stock adjustment form
 * - Edit item form (permission gated)
 * - Stock history/audit log placeholder
 * - Delete button (permission gated)
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  Edit,
  Trash2,
  Save,
  X,
  Plus,
  Minus,
  AlertTriangle,
  MapPin,
  Building2,
  Clock,
  User,
  RefreshCw,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { PermissionGate, usePermissionCheck } from '@/components/command-center/PermissionGate';
import { StockAdjustModal } from '@/components/command-center/StockAdjustModal';

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

interface InventoryApiResponse {
  success: boolean;
  data?: {
    item?: InventoryItem;
    items?: InventoryItem[];
  };
  error?: string;
  message?: string;
}

// =============================================================================
// CATEGORIES
// =============================================================================

const CATEGORIES = [
  'Fasteners',
  'Underlayment',
  'Flashing',
  'Ventilation',
  'Sealants',
  'Accessories',
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function InventoryItemPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const sku = params?.sku as string;

  // State
  const [item, setItem] = React.useState<InventoryItem | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Edit mode
  const [isEditing, setIsEditing] = React.useState(false);
  const [editForm, setEditForm] = React.useState<Partial<InventoryItem>>({});
  const [isSaving, setIsSaving] = React.useState(false);

  // Stock adjustment modal
  const [showAdjustModal, setShowAdjustModal] = React.useState(false);
  const [isAdjusting, setIsAdjusting] = React.useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Permission checks - using correct permission names from types/roles.ts
  const canViewCosts = usePermissionCheck('inventory.viewCosts');
  const canEdit = usePermissionCheck('inventory.edit');
  const canDelete = usePermissionCheck('inventory.delete');

  // Role-based visibility - match the main inventory page logic
  // Sales and Driver roles should NOT see cost/price information
  // Owner, Admin, Manager can see costs (per ROLE_PERMISSIONS in lib/permissions.ts)
  const userRole = user?.role;
  const showCost = canViewCosts || userRole === 'owner' || userRole === 'admin' || userRole === 'project_manager';
  const showPrice = canViewCosts || userRole === 'owner' || userRole === 'admin' || userRole === 'office' || userRole === 'project_manager';

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  const fetchItem = React.useCallback(async () => {
    if (!sku) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (user?.role) params.append('role', mapRoleForApi(user.role));

      const response = await fetch(`/api/command-center/inventory?search=${encodeURIComponent(sku)}&${params.toString()}`);
      const data: InventoryApiResponse = await response.json();

      if (data.success && data.data?.items) {
        const foundItem = data.data.items.find((i) => i.sku === sku);
        if (foundItem) {
          setItem(foundItem);
          setEditForm(foundItem);
        } else {
          setError('Item not found');
        }
      } else {
        setError(data.error || 'Failed to fetch item');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [sku, user?.role]);

  React.useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  // =============================================================================
  // HANDLERS
  // =============================================================================

  const handleSave = async () => {
    if (!item || !editForm) return;

    setIsSaving(true);

    try {
      const response = await fetch('/api/command-center/inventory', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.userId || '',
          'x-user-name': user?.name || '',
          'x-user-role': user?.role ? mapRoleForApi(user.role) : 'Driver',
        },
        body: JSON.stringify({
          sku: item.sku,
          updates: {
            name: editForm.name,
            description: editForm.description,
            category: editForm.category,
            minStock: editForm.minStock,
            maxStock: editForm.maxStock,
            unit: editForm.unit,
            location: editForm.location,
            supplier: editForm.supplier,
            imageUrl: editForm.imageUrl,
            ...(showCost && { cost: editForm.cost }),
            ...(showPrice && { price: editForm.price }),
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        setItem({ ...item, ...editForm });
        setIsEditing(false);
      } else {
        alert(data.error || 'Failed to save changes');
      }
    } catch {
      alert('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStockAdjust = async (
    itemSku: string,
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
        body: JSON.stringify({ sku: itemSku, adjustment, reason }),
      });

      const data = await response.json();

      if (data.success) {
        await fetchItem();
        setShowAdjustModal(false);
      } else {
        alert(data.error || 'Failed to adjust stock');
      }
    } catch {
      alert('Failed to adjust stock');
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;

    setIsDeleting(true);

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
        router.push('/command-center/inventory');
      } else {
        alert(data.error || 'Failed to delete item');
      }
    } catch {
      alert('Failed to delete item');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCancelEdit = () => {
    setEditForm(item || {});
    setIsEditing(false);
  };

  // =============================================================================
  // COMPUTED VALUES
  // =============================================================================

  const stockPercentage = item
    ? Math.min(100, (item.quantity / (item.maxStock || item.minStock * 3)) * 100)
    : 0;

  const isLowStock = item ? item.quantity <= item.minStock : false;
  const isWarningStock = item
    ? item.quantity <= item.minStock * 1.5 && item.quantity > item.minStock
    : false;

  // =============================================================================
  // RENDER
  // =============================================================================

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-lime-500" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Package className="h-16 w-16 text-zinc-600" />
        <h2 className="mt-4 text-xl font-semibold text-white">
          {error || 'Item not found'}
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          The item you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <Link
          href="/command-center/inventory"
          className="mt-6 inline-flex items-center gap-2 text-lime-400 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Inventory
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Link & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/command-center/inventory"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Inventory
          </Link>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancelEdit}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-zinc-900 transition-colors hover:bg-lime-400 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <>
                <PermissionGate permission="inventory.edit">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </button>
                </PermissionGate>

                <PermissionGate permission="inventory.delete">
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </PermissionGate>
              </>
            )}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Image & Quick Actions */}
          <div className="space-y-6">
            {/* Image */}
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
              <div className="aspect-square">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-zinc-800">
                    <Package className="h-24 w-24 text-zinc-600" />
                  </div>
                )}
              </div>
            </div>

            {/* Stock Level Card */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-400">Stock Level</h3>
                {isLowStock && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-1 text-xs font-semibold text-red-400">
                    <AlertTriangle className="h-3 w-3" />
                    Low Stock
                  </span>
                )}
                {isWarningStock && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-1 text-xs font-semibold text-yellow-400">
                    <AlertTriangle className="h-3 w-3" />
                    Warning
                  </span>
                )}
              </div>

              <div className="mt-4 text-center">
                <span
                  className={cn(
                    'text-5xl font-bold',
                    isLowStock && 'text-red-400',
                    isWarningStock && 'text-yellow-400',
                    !isLowStock && !isWarningStock && 'text-lime-400'
                  )}
                >
                  {item.quantity}
                </span>
                <span className="ml-2 text-lg text-zinc-500">
                  {item.unit || 'units'}
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Min: {item.minStock}</span>
                  <span>Max: {item.maxStock || '-'}</span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      isLowStock && 'bg-red-500',
                      isWarningStock && 'bg-yellow-500',
                      !isLowStock && !isWarningStock && 'bg-lime-500'
                    )}
                    style={{ width: `${stockPercentage}%` }}
                  />
                </div>
              </div>

              {/* Quick adjust buttons */}
              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => setShowAdjustModal(true)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-lime-500/20 py-3 text-sm font-semibold text-lime-400 transition-colors hover:bg-lime-500/30"
                >
                  <RefreshCw className="h-4 w-4" />
                  Adjust Stock
                </button>
              </div>
            </div>
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6 lg:col-span-2">
            {/* Item Details Card */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-lg font-semibold text-white">Item Details</h2>

              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                {/* SKU */}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    SKU
                  </label>
                  <p className="mt-1 font-mono text-lg text-lime-400">{item.sku}</p>
                </div>

                {/* Name */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
                    />
                  ) : (
                    <p className="mt-1 text-lg font-medium text-white">{item.name}</p>
                  )}
                </div>

                {/* Description */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Description
                  </label>
                  {isEditing ? (
                    <textarea
                      value={editForm.description || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, description: e.target.value })
                      }
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
                    />
                  ) : (
                    <p className="mt-1 text-zinc-400">
                      {item.description || 'No description'}
                    </p>
                  )}
                </div>

                {/* Category */}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Category
                  </label>
                  {isEditing ? (
                    <select
                      value={editForm.category || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, category: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-1">
                      <span className="inline-flex rounded-full bg-zinc-800 px-3 py-1 text-sm font-medium text-zinc-300">
                        {item.category}
                      </span>
                    </p>
                  )}
                </div>

                {/* Unit */}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Unit
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.unit || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, unit: e.target.value })
                      }
                      placeholder="each, box, roll..."
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
                    />
                  ) : (
                    <p className="mt-1 text-zinc-300">{item.unit || 'each'}</p>
                  )}
                </div>

                {/* Min Stock */}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Minimum Stock
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editForm.minStock || 0}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          minStock: parseInt(e.target.value) || 0,
                        })
                      }
                      min="0"
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
                    />
                  ) : (
                    <p className="mt-1 text-zinc-300">{item.minStock}</p>
                  )}
                </div>

                {/* Max Stock */}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Maximum Stock
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editForm.maxStock || ''}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          maxStock: e.target.value
                            ? parseInt(e.target.value)
                            : undefined,
                        })
                      }
                      min="0"
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
                    />
                  ) : (
                    <p className="mt-1 text-zinc-300">{item.maxStock || '-'}</p>
                  )}
                </div>

                {/* Cost (conditional) */}
                {showCost && (
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Cost
                    </label>
                    {isEditing ? (
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.cost || ''}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              cost: e.target.value
                                ? parseFloat(e.target.value)
                                : undefined,
                            })
                          }
                          min="0"
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-7 pr-4 text-white focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
                        />
                      </div>
                    ) : (
                      <p className="mt-1 text-zinc-300">
                        {item.cost != null ? `$${item.cost.toFixed(2)}` : '-'}
                      </p>
                    )}
                  </div>
                )}

                {/* Price (conditional) */}
                {showPrice && (
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Price
                    </label>
                    {isEditing ? (
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.price || ''}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              price: e.target.value
                                ? parseFloat(e.target.value)
                                : undefined,
                            })
                          }
                          min="0"
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-7 pr-4 text-white focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
                        />
                      </div>
                    ) : (
                      <p className="mt-1 font-medium text-lime-400">
                        {item.price != null ? `$${item.price.toFixed(2)}` : '-'}
                      </p>
                    )}
                  </div>
                )}

                {/* Location */}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    <MapPin className="mr-1 inline h-3 w-3" />
                    Location
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.location || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, location: e.target.value })
                      }
                      placeholder="Warehouse, Shelf A..."
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
                    />
                  ) : (
                    <p className="mt-1 text-zinc-300">
                      {item.location || 'Not specified'}
                    </p>
                  )}
                </div>

                {/* Supplier */}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    <Building2 className="mr-1 inline h-3 w-3" />
                    Supplier
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.supplier || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, supplier: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
                    />
                  ) : (
                    <p className="mt-1 text-zinc-300">
                      {item.supplier || 'Not specified'}
                    </p>
                  )}
                </div>

                {/* Image URL (edit mode only) */}
                {isEditing && (
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Image URL
                    </label>
                    <input
                      type="url"
                      value={editForm.imageUrl || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, imageUrl: e.target.value })
                      }
                      placeholder="https://..."
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
                    />
                  </div>
                )}
              </div>

              {/* Last Updated */}
              {item.lastUpdated && (
                <div className="mt-6 flex items-center gap-4 border-t border-zinc-800 pt-4 text-sm text-zinc-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Last updated:{' '}
                    {new Date(item.lastUpdated).toLocaleString()}
                  </span>
                  {item.updatedBy && (
                    <span className="inline-flex items-center gap-1">
                      <User className="h-4 w-4" />
                      by {item.updatedBy}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Stock History Placeholder */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-zinc-400" />
                <h3 className="text-lg font-semibold text-white">Stock History</h3>
              </div>
              <p className="mt-4 text-center text-sm text-zinc-500">
                Stock history and audit log will appear here.
              </p>
              <div className="mt-4 rounded-lg bg-zinc-800/50 p-8 text-center">
                <History className="mx-auto h-12 w-12 text-zinc-700" />
                <p className="mt-2 text-sm text-zinc-600">
                  Audit trail coming soon
                </p>
              </div>
            </div>
          </div>
        </div>

      {/* Stock Adjustment Modal */}
      {showAdjustModal && item && (
        <StockAdjustModal
          item={item}
          isOpen={showAdjustModal}
          onClose={() => setShowAdjustModal(false)}
          onSubmit={handleStockAdjust}
          isSubmitting={isAdjusting}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center gap-3 text-red-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">Delete Item</h3>
            </div>

            <p className="mt-4 text-sm text-zinc-400">
              Are you sure you want to delete <strong>{item.name}</strong>? This
              action cannot be undone.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

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

export default InventoryItemPage;
