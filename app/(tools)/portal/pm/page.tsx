'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Package, Truck, RotateCcw, Plus, Search,
  Calendar, MapPin, User, ChevronRight, AlertCircle,
  CheckCircle2, Clock, Loader2, X, ArrowLeft, FileText,
  ChevronDown, ChevronUp, Eye, RefreshCw, Hash, Navigation,
  Clipboard, AlertTriangle
} from 'lucide-react';
import Link from 'next/link';

// ============================================
// TYPES
// ============================================

interface MaterialItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  category: string;
}

interface InventoryItem {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  currentQty: number;
  unit: string;
  unitCost: number;
  retailPrice: number;
  supplier: string;
  location: string;
}

interface PipelineEvent {
  eventId: string;
  orderId: string;
  stage: string;
  timestamp: string;
  performedByName: string;
  performedByRole: string;
  notes?: string;
}

interface PipelineOrder {
  orderId: string;
  currentStage: string;
  priority: 'normal' | 'rush' | 'urgent';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  createdByName: string;
  createdByRole: string;
  jobNumber: string;
  jobName: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryZip: string;
  requestedDeliveryDate: string;
  scheduledDeliveryDate?: string;
  scheduledDeliveryTime?: string;
  assignedDriverId?: string;
  assignedDriverName?: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    pulledQty: number;
    verifiedQty: number;
    deliveredQty: number;
  }>;
  totalCost: number;
  totalPrice: number;
  paymentStatus: string;
  specialInstructions?: string;
  notes?: string;
  cancelled: boolean;
  cancelReason?: string;
  completedAt?: string;
  events: PipelineEvent[];
}

interface PMUser {
  userId: string;
  name: string;
  email: string;
  role: string;
}

// ============================================
// PIPELINE STAGE CONFIG (mirrors server)
// ============================================

const PIPELINE_STAGES = [
  'ORDER_CREATED', 'ORDER_REVIEWED', 'DRIVER_ASSIGNED', 'WAREHOUSE_NOTIFIED',
  'MATERIALS_PULLED', 'LOAD_VERIFIED', 'DEPARTURE_CONFIRMED', 'EN_ROUTE',
  'ARRIVED_AT_SITE', 'UNLOADING', 'DELIVERY_CONFIRMED', 'SIGNATURE_CAPTURED',
  'QC_PHOTOS', 'OFFICE_NOTIFIED', 'BILLING_REVIEW', 'INVOICE_SENT',
  'PAYMENT_RECEIVED', 'JOB_CLOSED'
];

const STAGE_LABELS: Record<string, string> = {
  ORDER_CREATED: 'Order Created',
  ORDER_REVIEWED: 'Reviewed',
  DRIVER_ASSIGNED: 'Driver Assigned',
  WAREHOUSE_NOTIFIED: 'Warehouse Notified',
  MATERIALS_PULLED: 'Materials Pulled',
  LOAD_VERIFIED: 'Load Verified',
  DEPARTURE_CONFIRMED: 'Departed',
  EN_ROUTE: 'En Route',
  ARRIVED_AT_SITE: 'Arrived',
  UNLOADING: 'Unloading',
  DELIVERY_CONFIRMED: 'Delivered',
  SIGNATURE_CAPTURED: 'Signed',
  QC_PHOTOS: 'QC Photos',
  OFFICE_NOTIFIED: 'Office Notified',
  BILLING_REVIEW: 'Billing',
  INVOICE_SENT: 'Invoiced',
  PAYMENT_RECEIVED: 'Paid',
  JOB_CLOSED: 'Closed',
};

// Simplified stage groups for the PM view
const PM_STAGE_GROUPS = [
  { label: 'Created', stages: ['ORDER_CREATED'], color: 'bg-zinc-500' },
  { label: 'Reviewed', stages: ['ORDER_REVIEWED'], color: 'bg-blue-500' },
  { label: 'Assigned', stages: ['DRIVER_ASSIGNED', 'WAREHOUSE_NOTIFIED'], color: 'bg-indigo-500' },
  { label: 'Pulling', stages: ['MATERIALS_PULLED', 'LOAD_VERIFIED'], color: 'bg-yellow-500' },
  { label: 'In Transit', stages: ['DEPARTURE_CONFIRMED', 'EN_ROUTE'], color: 'bg-orange-500' },
  { label: 'On Site', stages: ['ARRIVED_AT_SITE', 'UNLOADING'], color: 'bg-purple-500' },
  { label: 'Delivered', stages: ['DELIVERY_CONFIRMED', 'SIGNATURE_CAPTURED', 'QC_PHOTOS'], color: 'bg-brand-green' },
  { label: 'Billing', stages: ['OFFICE_NOTIFIED', 'BILLING_REVIEW', 'INVOICE_SENT', 'PAYMENT_RECEIVED'], color: 'bg-emerald-500' },
  { label: 'Closed', stages: ['JOB_CLOSED'], color: 'bg-green-600' },
];

function getStageGroupIndex(stage: string): number {
  for (let i = 0; i < PM_STAGE_GROUPS.length; i++) {
    if (PM_STAGE_GROUPS[i].stages.includes(stage)) return i;
  }
  return 0;
}

function getStageGroupLabel(stage: string): string {
  for (const group of PM_STAGE_GROUPS) {
    if (group.stages.includes(stage)) return group.label;
  }
  return stage;
}

function getStageGroupColor(stage: string): string {
  for (const group of PM_STAGE_GROUPS) {
    if (group.stages.includes(stage)) return group.color;
  }
  return 'bg-zinc-500';
}

// ============================================
// INVENTORY PRODUCT DATA (from inventoryData.ts)
// ============================================

const INVENTORY_PRODUCTS: InventoryItem[] = [
  { productId: 'item-123', productName: '1 1/4 EG Nails', sku: 'NAIL-EG-114', category: 'Fasteners', currentQty: 45, unit: 'box', unitCost: 27.50, retailPrice: 64.90, supplier: 'ABC Supply', location: 'Warehouse A' },
  { productId: 'item-124', productName: 'Bottom Caps (plastic)', sku: 'CAP-PLST-BTM', category: 'Fasteners', currentQty: 85, unit: 'bag', unitCost: 16.50, retailPrice: 29.15, supplier: 'ABC Supply', location: 'Warehouse A' },
  { productId: 'item-125', productName: 'RCRS Syn Felt', sku: 'FELT-SYN-RCRS', category: 'Underlayment', currentQty: 62, unit: 'roll', unitCost: 66.00, retailPrice: 79.86, supplier: 'IKO Industries', location: 'Warehouse B' },
  { productId: 'item-126', productName: 'Ice & Water Shield', sku: 'UDL-ICE-WTR', category: 'Underlayment', currentQty: 38, unit: 'roll', unitCost: 62.70, retailPrice: 114.22, supplier: 'GAF Materials', location: 'Warehouse B' },
  { productId: 'item-127', productName: 'Ridge Vent 4LF', sku: 'VENT-RIDGE-4', category: 'Ventilation', currentQty: 220, unit: 'piece', unitCost: 7.15, retailPrice: 10.20, supplier: 'Air Vent Inc', location: 'Warehouse A' },
  { productId: 'item-128', productName: '1 1/2" Black Bullet Boot', sku: 'BOOT-BLK-15', category: 'Flashing', currentQty: 95, unit: 'each', unitCost: 16.67, retailPrice: 20.89, supplier: 'Oatey', location: 'Warehouse A' },
  { productId: 'item-129', productName: '2" Black Bullet Boot', sku: 'BOOT-BLK-20', category: 'Flashing', currentQty: 88, unit: 'each', unitCost: 17.77, retailPrice: 22.54, supplier: 'Oatey', location: 'Warehouse A' },
  { productId: 'item-130', productName: '3" Black Bullet Boot', sku: 'BOOT-BLK-30', category: 'Flashing', currentQty: 72, unit: 'each', unitCost: 20.19, retailPrice: 38.29, supplier: 'Oatey', location: 'Warehouse A' },
  { productId: 'item-131', productName: '4" Black Bullet Boot', sku: 'BOOT-BLK-40', category: 'Flashing', currentQty: 45, unit: 'each', unitCost: 37.48, retailPrice: 42.50, supplier: 'Oatey', location: 'Warehouse A' },
  { productId: 'item-132', productName: 'Sealant', sku: 'SEAL-ROOF-01', category: 'Sealants', currentQty: 120, unit: 'tube', unitCost: 9.35, retailPrice: 10.00, supplier: 'Geocel', location: 'Warehouse A' },
  { productId: 'item-133', productName: 'Zipper Boot', sku: 'BOOT-ZIP-01', category: 'Flashing', currentQty: 75, unit: 'each', unitCost: 37.40, retailPrice: 48.00, supplier: 'Oatey', location: 'Warehouse A' },
];

// ============================================
// COMPONENTS
// ============================================

/** Visual pipeline stage progression bar */
function PipelineProgress({ currentStage, cancelled }: { currentStage: string; cancelled: boolean }) {
  const currentGroupIdx = getStageGroupIndex(currentStage);

  if (cancelled) {
    return (
      <div className="flex items-center gap-1">
        <div className="flex-1 h-2 rounded-full bg-red-500/30">
          <div className="h-full rounded-full bg-red-500 w-full" />
        </div>
        <span className="text-xs font-bold text-red-400 ml-2">CANCELLED</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Compact progress bar */}
      <div className="flex gap-0.5">
        {PM_STAGE_GROUPS.map((group, idx) => {
          const isComplete = idx < currentGroupIdx;
          const isCurrent = idx === currentGroupIdx;
          return (
            <div
              key={group.label}
              className="flex-1 h-2 rounded-full overflow-hidden"
              title={group.label}
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isComplete ? 'bg-brand-green' :
                  isCurrent ? group.color + ' animate-pulse' :
                  'bg-zinc-800'
                }`}
                style={{ width: '100%' }}
              />
            </div>
          );
        })}
      </div>
      {/* Current stage label */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">
          Stage {PIPELINE_STAGES.indexOf(currentStage) + 1} of {PIPELINE_STAGES.length}
        </span>
        <span className={`font-semibold ${
          currentStage === 'JOB_CLOSED' ? 'text-green-400' : 'text-brand-green'
        }`}>
          {STAGE_LABELS[currentStage] || currentStage}
        </span>
      </div>
    </div>
  );
}

/** Priority badge */
function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'normal') return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
      priority === 'urgent' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
      'bg-orange-500/20 text-orange-400 border border-orange-500/30'
    }`}>
      {priority === 'urgent' && <AlertTriangle size={10} />}
      {priority}
    </span>
  );
}

/** Expandable order detail card */
function OrderCard({
  order,
  showCost,
}: {
  order: PipelineOrder;
  showCost: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const groupIdx = getStageGroupIndex(order.currentStage);
  const groupColor = getStageGroupColor(order.currentStage);

  // Determine if the order is actively being delivered
  const isInTransit = ['DEPARTURE_CONFIRMED', 'EN_ROUTE', 'ARRIVED_AT_SITE', 'UNLOADING'].includes(order.currentStage);
  const isDelivered = groupIdx >= 6; // Delivered group or beyond

  return (
    <div className={`bg-zinc-900 rounded-xl border transition-all ${
      order.cancelled ? 'border-red-500/30 opacity-60' :
      order.priority === 'urgent' ? 'border-red-500/40' :
      order.priority === 'rush' ? 'border-orange-500/40' :
      'border-zinc-800'
    } ${isInTransit ? 'ring-1 ring-brand-green/20' : ''}`}>
      {/* Order header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Stage indicator dot */}
            <div className={`w-3 h-3 mt-1.5 rounded-full flex-shrink-0 ${
              order.cancelled ? 'bg-red-500' : groupColor
            } ${isInTransit ? 'animate-pulse' : ''}`} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-white truncate">{order.jobName}</h3>
                <PriorityBadge priority={order.priority} />
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Hash size={12} />
                  {order.jobNumber}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={12} />
                  {order.deliveryAddress}{order.deliveryCity ? `, ${order.deliveryCity}` : ''}
                </span>
                {order.requestedDeliveryDate && (
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(order.requestedDeliveryDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`px-2 py-1 rounded text-[11px] font-bold whitespace-nowrap ${
              order.cancelled ? 'bg-red-500/20 text-red-400' :
              isDelivered ? 'bg-green-500/20 text-green-400' :
              isInTransit ? 'bg-brand-green/20 text-brand-green' :
              'bg-yellow-500/20 text-yellow-400'
            }`}>
              {order.cancelled ? 'Cancelled' : getStageGroupLabel(order.currentStage)}
            </span>
            {expanded ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
          </div>
        </div>

        {/* Pipeline progress bar */}
        <div className="mt-3">
          <PipelineProgress currentStage={order.currentStage} cancelled={order.cancelled} />
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-zinc-800 p-4 space-y-4">
          {/* Delivery / Driver info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Delivery Info</h4>
              <div className="space-y-1 text-sm">
                <p className="text-zinc-300">
                  <span className="text-zinc-500">Address:</span>{' '}
                  {order.deliveryAddress}, {order.deliveryCity}, {order.deliveryState} {order.deliveryZip}
                </p>
                {order.customerName && (
                  <p className="text-zinc-300">
                    <span className="text-zinc-500">Customer:</span> {order.customerName}
                  </p>
                )}
                {order.customerPhone && (
                  <p className="text-zinc-300">
                    <span className="text-zinc-500">Phone:</span>{' '}
                    <a href={`tel:${order.customerPhone}`} className="text-brand-green hover:underline">{order.customerPhone}</a>
                  </p>
                )}
                <p className="text-zinc-300">
                  <span className="text-zinc-500">Requested:</span>{' '}
                  {order.requestedDeliveryDate ? new Date(order.requestedDeliveryDate).toLocaleDateString() : 'Not set'}
                </p>
                {order.scheduledDeliveryDate && (
                  <p className="text-zinc-300">
                    <span className="text-zinc-500">Scheduled:</span>{' '}
                    {new Date(order.scheduledDeliveryDate).toLocaleDateString()}
                    {order.scheduledDeliveryTime ? ` at ${order.scheduledDeliveryTime}` : ''}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Driver & Tracking</h4>
              <div className="space-y-1 text-sm">
                {order.assignedDriverName ? (
                  <>
                    <p className="text-zinc-300 flex items-center gap-2">
                      <User size={14} className="text-brand-green" />
                      <span className="font-medium text-white">{order.assignedDriverName}</span>
                    </p>
                    {isInTransit && (
                      <div className="mt-2 p-2 bg-brand-green/10 border border-brand-green/20 rounded-lg">
                        <p className="text-brand-green text-xs font-bold flex items-center gap-1">
                          <Navigation size={12} className="animate-pulse" />
                          {order.currentStage === 'EN_ROUTE' ? 'Driver is en route to job site' :
                           order.currentStage === 'ARRIVED_AT_SITE' ? 'Driver arrived at job site' :
                           order.currentStage === 'UNLOADING' ? 'Unloading materials at job site' :
                           'Driver has departed warehouse'}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-zinc-500 italic">No driver assigned yet</p>
                )}
                <p className="text-zinc-300">
                  <span className="text-zinc-500">Created:</span>{' '}
                  {new Date(order.createdAt).toLocaleString()}
                </p>
                <p className="text-zinc-300">
                  <span className="text-zinc-500">Last Updated:</span>{' '}
                  {new Date(order.updatedAt).toLocaleString()}
                </p>
                <p className="text-zinc-300">
                  <span className="text-zinc-500">Payment:</span>{' '}
                  <span className={`font-medium ${
                    order.paymentStatus === 'paid' ? 'text-green-400' :
                    order.paymentStatus === 'invoiced' ? 'text-yellow-400' :
                    'text-zinc-400'
                  }`}>
                    {order.paymentStatus}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Materials list */}
          <div>
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Materials ({order.items.length} items)</h4>
            <div className="bg-zinc-800/50 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-700 text-left">
                    <th className="py-2 px-3 text-zinc-400 font-medium">Product</th>
                    <th className="py-2 px-3 text-zinc-400 font-medium text-right">Qty</th>
                    <th className="py-2 px-3 text-zinc-400 font-medium text-right">Pulled</th>
                    <th className="py-2 px-3 text-zinc-400 font-medium text-right">Delivered</th>
                    {showCost && <th className="py-2 px-3 text-zinc-400 font-medium text-right">Total</th>}
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-zinc-800 last:border-0">
                      <td className="py-2 px-3 text-white">{item.productName}</td>
                      <td className="py-2 px-3 text-zinc-300 text-right">{item.quantity} {item.unit}</td>
                      <td className="py-2 px-3 text-right">
                        <span className={item.pulledQty >= item.quantity ? 'text-green-400' : 'text-yellow-400'}>
                          {item.pulledQty || 0}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className={item.deliveredQty >= item.quantity ? 'text-green-400' : 'text-zinc-400'}>
                          {item.deliveredQty || 0}
                        </span>
                      </td>
                      {showCost && (
                        <td className="py-2 px-3 text-white text-right font-medium">${item.totalPrice?.toFixed(2) || '0.00'}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
                {showCost && (
                  <tfoot>
                    <tr className="border-t border-zinc-700">
                      <td colSpan={4} className="py-2 px-3 text-right font-bold text-zinc-300">Total:</td>
                      <td className="py-2 px-3 text-right font-bold text-brand-green">${order.totalPrice?.toFixed(2) || '0.00'}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Notes / Special Instructions */}
          {(order.specialInstructions || order.notes || order.cancelReason) && (
            <div className="space-y-2">
              {order.specialInstructions && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-yellow-400 text-sm">
                    <span className="font-bold">Instructions:</span> {order.specialInstructions}
                  </p>
                </div>
              )}
              {order.notes && (
                <div className="p-3 bg-zinc-800 rounded-lg">
                  <p className="text-zinc-300 text-sm">
                    <span className="font-bold text-zinc-400">Notes:</span> {order.notes}
                  </p>
                </div>
              )}
              {order.cancelReason && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-red-400 text-sm">
                    <span className="font-bold">Cancel Reason:</span> {order.cancelReason}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Event timeline (last 5) */}
          {order.events && order.events.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Recent Activity</h4>
              <div className="space-y-2">
                {order.events.slice(-5).reverse().map((event, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-sm">
                    <div className="w-1.5 h-1.5 mt-2 rounded-full bg-brand-green flex-shrink-0" />
                    <div>
                      <p className="text-white">
                        <span className="font-medium">{STAGE_LABELS[event.stage] || event.stage}</span>
                        <span className="text-zinc-500"> by {event.performedByName}</span>
                      </p>
                      <p className="text-zinc-500 text-xs">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                      {event.notes && <p className="text-zinc-400 text-xs mt-0.5">{event.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function PMPortal() {
  const [user, setUser] = useState<PMUser | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'create' | 'orders' | 'returns'>('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orders, setOrders] = useState<PipelineOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>(INVENTORY_PRODUCTS);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderFilter, setOrderFilter] = useState<'all' | 'active' | 'delivered' | 'cancelled'>('all');

  // Create order form state
  const [orderForm, setOrderForm] = useState({
    jobNumber: '',
    jobName: '',
    deliveryAddress: '',
    deliveryCity: '',
    deliveryState: 'AL',
    deliveryZip: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    priority: 'normal' as 'normal' | 'rush' | 'urgent',
    requestedDeliveryDate: '',
    notes: '',
    specialInstructions: '',
  });
  const [selectedMaterials, setSelectedMaterials] = useState<MaterialItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [addQty, setAddQty] = useState<Record<string, number>>({});

  // Check user role permissions for cost visibility
  const canSeeCost = user?.role === 'admin' || user?.role === 'owner' || user?.role === 'office';

  useEffect(() => {
    // Check for logged in PM user
    const stored = sessionStorage.getItem('portalUser');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (['project_manager', 'pm', 'owner', 'admin', 'manager', 'office'].includes(parsed.role)) {
        setUser(parsed);
        loadOrders(parsed.userId);
      }
    }
  }, []);

  const loadOrders = useCallback(async (userId?: string) => {
    setIsLoading(true);
    try {
      // Fetch orders from the pipeline API
      const response = await fetch('/api/portal/pipeline?action=list&limit=200');
      if (response.ok) {
        const data = await response.json();
        // Filter to orders created by this PM (or show all if admin/owner/office)
        const allOrders: PipelineOrder[] = Array.isArray(data) ? data : (data.orders || []);
        if (user?.role === 'admin' || user?.role === 'owner' || user?.role === 'office') {
          setOrders(allOrders);
        } else {
          // PM sees their own orders
          const uid = userId || user?.userId;
          setOrders(allOrders.filter(o => o.createdBy === uid));
        }
      }

      // Also try loading live inventory levels
      const invRes = await fetch('/api/portal/inventory');
      if (invRes.ok) {
        const invData = await invRes.json();
        if (invData.inventory && invData.inventory.length > 0) {
          setInventory(invData.inventory);
        }
      }
    } catch (error) {
      // Fall back to static inventory data
      setInventory(INVENTORY_PRODUCTS);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // ============================================
  // MATERIAL SELECTION HANDLERS
  // ============================================

  const handleAddMaterial = (item: InventoryItem) => {
    const qty = addQty[item.productId] || 1;
    if (qty <= 0) return;

    const existing = selectedMaterials.find(m => m.productId === item.productId);
    if (existing) {
      setSelectedMaterials(prev => prev.map(m =>
        m.productId === item.productId
          ? { ...m, quantity: m.quantity + qty, totalPrice: (m.quantity + qty) * m.unitPrice }
          : m
      ));
    } else {
      setSelectedMaterials(prev => [...prev, {
        productId: item.productId,
        productName: item.productName,
        quantity: qty,
        unit: item.unit,
        unitPrice: item.retailPrice,
        totalPrice: qty * item.retailPrice,
        category: item.category,
      }]);
    }
    // Reset the qty input for this item
    setAddQty(prev => ({ ...prev, [item.productId]: 1 }));
  };

  const handleUpdateMaterialQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveMaterial(productId);
      return;
    }
    setSelectedMaterials(prev => prev.map(m =>
      m.productId === productId
        ? { ...m, quantity: newQty, totalPrice: newQty * m.unitPrice }
        : m
    ));
  };

  const handleRemoveMaterial = (productId: string) => {
    setSelectedMaterials(prev => prev.filter(m => m.productId !== productId));
  };

  // ============================================
  // SUBMIT ORDER
  // ============================================

  const handleSubmitOrder = async () => {
    if (!user) return;
    setSubmitError(null);
    setSubmitSuccess(null);

    // Validation
    if (!orderForm.jobNumber.trim()) {
      setSubmitError('Job Number is required');
      return;
    }
    if (!orderForm.jobName.trim()) {
      setSubmitError('Job Name / Customer is required');
      return;
    }
    if (!orderForm.deliveryAddress.trim()) {
      setSubmitError('Delivery Address is required');
      return;
    }
    if (!orderForm.requestedDeliveryDate) {
      setSubmitError('Scheduled Delivery Date is required');
      return;
    }
    if (selectedMaterials.length === 0) {
      setSubmitError('Please add at least one material to the order');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/portal/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createOrder',
          jobNumber: orderForm.jobNumber.trim(),
          jobName: orderForm.jobName.trim(),
          deliveryAddress: orderForm.deliveryAddress.trim(),
          deliveryCity: orderForm.deliveryCity.trim(),
          deliveryState: orderForm.deliveryState,
          deliveryZip: orderForm.deliveryZip.trim(),
          customerName: orderForm.customerName.trim(),
          customerPhone: orderForm.customerPhone.trim(),
          customerEmail: orderForm.customerEmail.trim(),
          priority: orderForm.priority,
          requestedDeliveryDate: orderForm.requestedDeliveryDate,
          notes: orderForm.notes.trim(),
          specialInstructions: orderForm.specialInstructions.trim(),
          items: selectedMaterials.map(m => ({
            productId: m.productId,
            quantity: m.quantity,
            unit: m.unit,
          })),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSubmitSuccess(data.message || `Order ${data.order?.orderId} created successfully!`);
        // Reset form
        setOrderForm({
          jobNumber: '',
          jobName: '',
          deliveryAddress: '',
          deliveryCity: '',
          deliveryState: 'AL',
          deliveryZip: '',
          customerName: '',
          customerPhone: '',
          customerEmail: '',
          priority: 'normal',
          requestedDeliveryDate: '',
          notes: '',
          specialInstructions: '',
        });
        setSelectedMaterials([]);
        setAddQty({});
        // Reload orders and switch to orders tab
        await loadOrders();
        setTimeout(() => {
          setActiveTab('orders');
          setSubmitSuccess(null);
        }, 2000);
      } else {
        setSubmitError(data.error || 'Failed to create order');
      }
    } catch (error) {
      setSubmitError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================
  // FILTER LOGIC
  // ============================================

  const categories = ['all', ...Array.from(new Set(inventory.map(i => i.category)))];

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = !searchTerm ||
      item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const filteredOrders = orders.filter(o => {
    if (orderFilter === 'active') return !o.cancelled && !['JOB_CLOSED', 'PAYMENT_RECEIVED'].includes(o.currentStage);
    if (orderFilter === 'delivered') return !o.cancelled && getStageGroupIndex(o.currentStage) >= 6;
    if (orderFilter === 'cancelled') return o.cancelled;
    return true;
  });

  // Stats
  const activeOrders = orders.filter(o => !o.cancelled && !['JOB_CLOSED'].includes(o.currentStage));
  const inTransitOrders = orders.filter(o => !o.cancelled && ['DEPARTURE_CONFIRMED', 'EN_ROUTE', 'ARRIVED_AT_SITE', 'UNLOADING'].includes(o.currentStage));
  const deliveredOrders = orders.filter(o => !o.cancelled && getStageGroupIndex(o.currentStage) >= 6);
  const pendingReviewOrders = orders.filter(o => !o.cancelled && o.currentStage === 'ORDER_CREATED');

  const materialsTotal = selectedMaterials.reduce((sum, m) => sum + m.totalPrice, 0);

  // ============================================
  // RENDER: ACCESS DENIED
  // ============================================

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="text-yellow-500" size={32} />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Access Required</h1>
          <p className="text-zinc-400 mb-6">Please log in to access the Project Manager portal.</p>
          <Link
            href="/portal"
            className="inline-flex items-center gap-2 bg-brand-green hover:bg-lime-400 text-black font-bold px-6 py-3 rounded-xl transition-colors"
          >
            <ArrowLeft size={18} />
            Back to Portal
          </Link>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: MAIN PAGE
  // ============================================

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <Link href="/portal" className="text-neutral-400 hover:text-white transition-colors">
                <ArrowLeft size={20} />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-white">Project Manager Portal</h1>
                <p className="text-sm text-neutral-400">Welcome, {user.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadOrders()}
                disabled={isLoading}
                className="flex items-center gap-2 text-neutral-400 hover:text-white px-3 py-2 rounded-lg transition-colors"
              >
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className="flex items-center gap-2 bg-brand-green hover:bg-lime-400 text-black font-bold px-4 py-2 rounded-lg transition-colors"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">Create Material Order</span>
                <span className="sm:hidden">New Order</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-neutral-900/50 border-b border-neutral-800 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 min-w-max">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Package },
              { id: 'create', label: 'Create Order', icon: Plus },
              { id: 'orders', label: 'My Orders', icon: Truck },
              { id: 'returns', label: 'Returns', icon: RotateCcw },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 whitespace-nowrap text-sm ${
                    activeTab === tab.id
                      ? 'text-brand-green border-brand-green'
                      : 'text-neutral-400 border-transparent hover:text-white'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                  {tab.id === 'orders' && activeOrders.length > 0 && (
                    <span className="bg-brand-green/20 text-brand-green text-xs font-bold px-1.5 py-0.5 rounded-full">
                      {activeOrders.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* ============================================ */}
        {/* DASHBOARD TAB */}
        {/* ============================================ */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-neutral-900 rounded-xl p-4 sm:p-6 border border-neutral-800">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                    <Clock className="text-yellow-500" size={20} />
                  </div>
                  <span className="text-neutral-400 text-sm">Pending Review</span>
                </div>
                <p className="text-3xl font-bold text-white">{pendingReviewOrders.length}</p>
              </div>
              <div className="bg-neutral-900 rounded-xl p-4 sm:p-6 border border-neutral-800">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Truck className="text-blue-500" size={20} />
                  </div>
                  <span className="text-neutral-400 text-sm">In Transit</span>
                </div>
                <p className="text-3xl font-bold text-white">{inTransitOrders.length}</p>
              </div>
              <div className="bg-neutral-900 rounded-xl p-4 sm:p-6 border border-neutral-800">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="text-green-500" size={20} />
                  </div>
                  <span className="text-neutral-400 text-sm">Delivered</span>
                </div>
                <p className="text-3xl font-bold text-white">{deliveredOrders.length}</p>
              </div>
              <div className="bg-neutral-900 rounded-xl p-4 sm:p-6 border border-neutral-800">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <FileText className="text-purple-500" size={20} />
                  </div>
                  <span className="text-neutral-400 text-sm">Total Orders</span>
                </div>
                <p className="text-3xl font-bold text-white">{orders.length}</p>
              </div>
            </div>

            {/* In-Transit Orders Highlight */}
            {inTransitOrders.length > 0 && (
              <div className="bg-brand-green/5 border border-brand-green/20 rounded-xl p-4">
                <h3 className="text-brand-green font-bold flex items-center gap-2 mb-3">
                  <Navigation size={16} className="animate-pulse" />
                  Active Deliveries
                </h3>
                <div className="space-y-3">
                  {inTransitOrders.map(order => (
                    <div key={order.orderId} className="bg-zinc-900 rounded-lg p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">{order.jobName}</p>
                        <p className="text-xs text-zinc-400">{order.deliveryAddress}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {order.assignedDriverName && (
                          <span className="text-xs text-zinc-400">{order.assignedDriverName}</span>
                        )}
                        <span className="px-2 py-1 bg-brand-green/20 text-brand-green text-xs font-bold rounded">
                          {STAGE_LABELS[order.currentStage]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Orders */}
            <div className="bg-neutral-900 rounded-xl border border-neutral-800">
              <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Recent Orders</h2>
                <button
                  onClick={() => setActiveTab('orders')}
                  className="text-brand-green text-sm font-medium hover:underline flex items-center gap-1"
                >
                  View All <ChevronRight size={14} />
                </button>
              </div>
              <div className="divide-y divide-neutral-800">
                {orders.slice(0, 5).map(order => (
                  <div key={order.orderId} className="p-4 flex items-center justify-between gap-3 hover:bg-zinc-800/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        order.cancelled ? 'bg-red-500' : getStageGroupColor(order.currentStage)
                      }`} />
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">{order.jobName}</p>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <span>#{order.jobNumber}</span>
                          <span>{order.deliveryAddress}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`px-2 py-1 rounded text-[11px] font-bold ${
                        order.cancelled ? 'bg-red-500/20 text-red-400' :
                        getStageGroupIndex(order.currentStage) >= 6 ? 'bg-green-500/20 text-green-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {order.cancelled ? 'Cancelled' : getStageGroupLabel(order.currentStage)}
                      </span>
                      <p className="text-xs text-neutral-500 mt-1">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
                {orders.length === 0 && (
                  <div className="flex flex-col items-center py-12 gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center">
                      <Package className="text-zinc-500" size={32} />
                    </div>
                    <div className="text-center">
                      <p className="text-white font-medium">No orders yet</p>
                      <p className="text-zinc-500 text-sm">Create your first material order to get started</p>
                    </div>
                    <button
                      onClick={() => setActiveTab('create')}
                      className="mt-2 px-4 py-2 bg-brand-green text-black font-bold rounded-lg hover:bg-lime-400 transition-colors flex items-center gap-2"
                    >
                      <Plus size={18} />
                      Create Material Order
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* CREATE ORDER TAB */}
        {/* ============================================ */}
        {activeTab === 'create' && (
          <div className="space-y-6">
            {/* Success / Error banners */}
            {submitSuccess && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle2 className="text-green-400 flex-shrink-0" size={20} />
                <p className="text-green-400 font-medium">{submitSuccess}</p>
              </div>
            )}
            {submitError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
                <AlertCircle className="text-red-400 flex-shrink-0" size={20} />
                <p className="text-red-400 font-medium">{submitError}</p>
                <button onClick={() => setSubmitError(null)} className="ml-auto text-red-400 hover:text-red-300">
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT: Order Form */}
              <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-5 sm:p-6">
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <Clipboard size={20} className="text-brand-green" />
                  Create Material Order
                </h2>

                {/* Job Number */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Job Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={orderForm.jobNumber}
                    onChange={e => setOrderForm(prev => ({ ...prev, jobNumber: e.target.value }))}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green/30"
                    placeholder="JOB-2026-001"
                  />
                </div>

                {/* Job Name / Customer */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Job Name / Customer <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={orderForm.jobName}
                    onChange={e => setOrderForm(prev => ({ ...prev, jobName: e.target.value }))}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green/30"
                    placeholder="Smith Roof Replacement"
                  />
                </div>

                {/* Delivery Address */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Delivery Address <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={orderForm.deliveryAddress}
                    onChange={e => setOrderForm(prev => ({ ...prev, deliveryAddress: e.target.value }))}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green/30"
                    placeholder="123 Main St"
                  />
                </div>

                {/* City / State / Zip */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-neutral-300 mb-1">City</label>
                    <input
                      type="text"
                      value={orderForm.deliveryCity}
                      onChange={e => setOrderForm(prev => ({ ...prev, deliveryCity: e.target.value }))}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green/30"
                      placeholder="Huntsville"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1">State</label>
                    <input
                      type="text"
                      value={orderForm.deliveryState}
                      onChange={e => setOrderForm(prev => ({ ...prev, deliveryState: e.target.value }))}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green/30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1">ZIP</label>
                    <input
                      type="text"
                      value={orderForm.deliveryZip}
                      onChange={e => setOrderForm(prev => ({ ...prev, deliveryZip: e.target.value }))}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green/30"
                      placeholder="35801"
                    />
                  </div>
                </div>

                {/* Priority - Radio buttons */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Priority</label>
                  <div className="flex gap-2">
                    {([
                      { value: 'normal', label: 'Normal', desc: 'Standard delivery', color: 'border-zinc-600 bg-zinc-800', activeColor: 'border-brand-green bg-brand-green/10 ring-1 ring-brand-green/30' },
                      { value: 'urgent', label: 'Urgent', desc: '+$50 surcharge', color: 'border-zinc-600 bg-zinc-800', activeColor: 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30' },
                      { value: 'rush', label: 'Rush', desc: '+$100 surcharge', color: 'border-zinc-600 bg-zinc-800', activeColor: 'border-red-500 bg-red-500/10 ring-1 ring-red-500/30' },
                    ] as const).map(opt => (
                      <label
                        key={opt.value}
                        className={`flex-1 cursor-pointer rounded-lg border p-3 transition-all ${
                          orderForm.priority === opt.value ? opt.activeColor : opt.color + ' hover:border-zinc-500'
                        }`}
                      >
                        <input
                          type="radio"
                          name="priority"
                          value={opt.value}
                          checked={orderForm.priority === opt.value}
                          onChange={e => setOrderForm(prev => ({ ...prev, priority: e.target.value as typeof orderForm.priority }))}
                          className="sr-only"
                        />
                        <div className="text-center">
                          <p className={`text-sm font-bold ${
                            orderForm.priority === opt.value
                              ? opt.value === 'normal' ? 'text-brand-green' : opt.value === 'urgent' ? 'text-orange-400' : 'text-red-400'
                              : 'text-white'
                          }`}>
                            {opt.label}
                          </p>
                          <p className="text-[11px] text-zinc-500 mt-0.5">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Scheduled Delivery Date */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Scheduled Delivery Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={orderForm.requestedDeliveryDate}
                    onChange={e => setOrderForm(prev => ({ ...prev, requestedDeliveryDate: e.target.value }))}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green/30"
                  />
                </div>

                {/* Customer Info (optional) */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1">Customer Name</label>
                    <input
                      type="text"
                      value={orderForm.customerName}
                      onChange={e => setOrderForm(prev => ({ ...prev, customerName: e.target.value }))}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green/30"
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1">Customer Phone</label>
                    <input
                      type="tel"
                      value={orderForm.customerPhone}
                      onChange={e => setOrderForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green/30"
                      placeholder="(256) 555-1234"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Notes</label>
                  <textarea
                    value={orderForm.notes}
                    onChange={e => setOrderForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green/30"
                    rows={2}
                    placeholder="Gate code, driveway access, delivery location on property..."
                  />
                </div>

                {/* Selected Materials Summary (in form) */}
                {selectedMaterials.length > 0 && (
                  <div className="bg-zinc-800/80 rounded-lg p-4 mb-4 border border-zinc-700">
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                      <Package size={14} className="text-brand-green" />
                      Selected Materials ({selectedMaterials.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedMaterials.map(m => (
                        <div key={m.productId} className="flex items-center justify-between text-sm gap-2">
                          <span className="text-neutral-300 truncate">{m.productName}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleUpdateMaterialQty(m.productId, m.quantity - 1)}
                              className="w-6 h-6 rounded bg-zinc-700 hover:bg-zinc-600 text-white flex items-center justify-center text-xs"
                            >
                              -
                            </button>
                            <span className="text-white font-medium w-8 text-center">{m.quantity}</span>
                            <button
                              onClick={() => handleUpdateMaterialQty(m.productId, m.quantity + 1)}
                              className="w-6 h-6 rounded bg-zinc-700 hover:bg-zinc-600 text-white flex items-center justify-center text-xs"
                            >
                              +
                            </button>
                            <span className="text-zinc-500 text-xs w-10">{m.unit}</span>
                            {canSeeCost && (
                              <span className="text-white font-medium w-16 text-right">${m.totalPrice.toFixed(2)}</span>
                            )}
                            <button
                              onClick={() => handleRemoveMaterial(m.productId)}
                              className="text-red-400 hover:text-red-300 ml-1"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {canSeeCost && (
                        <div className="border-t border-zinc-700 pt-2 mt-2 flex justify-between items-center">
                          <span className="text-white font-bold">Materials Total</span>
                          <span className="text-brand-green font-bold text-lg">${materialsTotal.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  onClick={handleSubmitOrder}
                  disabled={isSubmitting}
                  className="w-full bg-brand-green hover:bg-lime-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Creating Order...
                    </>
                  ) : (
                    <>
                      <Plus size={20} />
                      Create Material Order
                    </>
                  )}
                </button>
              </div>

              {/* RIGHT: Product Selector */}
              <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-5 sm:p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Package size={20} className="text-brand-green" />
                  Product Catalog ({inventory.length} items)
                </h2>

                {/* Search & Filter */}
                <div className="space-y-3 mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-9 pr-4 py-2 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green/30"
                      placeholder="Search products..."
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                          categoryFilter === cat
                            ? 'bg-brand-green text-black'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                        }`}
                      >
                        {cat === 'all' ? 'All' : cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product List */}
                <div className="max-h-[600px] overflow-y-auto space-y-2 pr-1">
                  {filteredInventory.map(item => {
                    const isAlreadySelected = selectedMaterials.some(m => m.productId === item.productId);
                    const qty = addQty[item.productId] || 1;
                    const isLowStock = item.currentQty <= 10;

                    return (
                      <div
                        key={item.productId}
                        className={`bg-zinc-800/60 rounded-lg p-3 border transition-colors ${
                          isAlreadySelected ? 'border-brand-green/30 bg-brand-green/5' : 'border-zinc-700/50 hover:border-zinc-600'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-white text-sm truncate">{item.productName}</p>
                            <p className="text-xs text-zinc-500">{item.category} {item.sku ? `/ ${item.sku}` : ''}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {canSeeCost && (
                              <p className="text-sm font-bold text-white">${item.retailPrice.toFixed(2)}<span className="text-zinc-500 font-normal">/{item.unit}</span></p>
                            )}
                            <p className={`text-xs font-medium ${
                              isLowStock ? 'text-red-400' : 'text-zinc-400'
                            }`}>
                              {item.currentQty} in stock
                              {isLowStock && ' (Low)'}
                            </p>
                          </div>
                        </div>
                        {/* Quantity input + Add button */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-zinc-900 rounded-lg border border-zinc-700 overflow-hidden">
                            <button
                              onClick={() => setAddQty(prev => ({ ...prev, [item.productId]: Math.max(1, (prev[item.productId] || 1) - 1) }))}
                              className="px-2 py-1 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={item.currentQty}
                              value={qty}
                              onChange={e => setAddQty(prev => ({ ...prev, [item.productId]: Math.max(1, parseInt(e.target.value) || 1) }))}
                              className="w-12 text-center bg-transparent text-white text-sm py-1 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              onClick={() => setAddQty(prev => ({ ...prev, [item.productId]: Math.min(item.currentQty, (prev[item.productId] || 1) + 1) }))}
                              className="px-2 py-1 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-zinc-500 text-xs">{item.unit}(s)</span>
                          <button
                            onClick={() => handleAddMaterial(item)}
                            disabled={item.currentQty <= 0}
                            className={`ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              item.currentQty <= 0
                                ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                                : isAlreadySelected
                                  ? 'bg-brand-green/20 text-brand-green hover:bg-brand-green/30'
                                  : 'bg-brand-green text-black hover:bg-lime-400'
                            }`}
                          >
                            <Plus size={14} />
                            {isAlreadySelected ? 'Add More' : 'Add Item'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {filteredInventory.length === 0 && (
                    <div className="text-center py-8 text-neutral-400">
                      <Package size={32} className="mx-auto mb-2 text-zinc-600" />
                      <p>No products match your search</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* MY ORDERS TAB */}
        {/* ============================================ */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex gap-1.5">
                {([
                  { value: 'all', label: 'All Orders' },
                  { value: 'active', label: 'Active' },
                  { value: 'delivered', label: 'Delivered' },
                  { value: 'cancelled', label: 'Cancelled' },
                ] as const).map(f => (
                  <button
                    key={f.value}
                    onClick={() => setOrderFilter(f.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      orderFilter === f.value
                        ? 'bg-brand-green text-black'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => loadOrders()}
                disabled={isLoading}
                className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors"
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            {/* Orders List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="animate-spin text-brand-green" size={32} />
              </div>
            ) : filteredOrders.length > 0 ? (
              <div className="space-y-3">
                {filteredOrders.map(order => (
                  <OrderCard
                    key={order.orderId}
                    order={order}
                    showCost={canSeeCost}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-zinc-900 rounded-xl border border-zinc-800">
                <Package className="w-12 h-12 mx-auto mb-4 text-zinc-700" />
                <h3 className="text-base font-bold text-white mb-2">
                  {orderFilter === 'all' ? 'No Orders Yet' : `No ${orderFilter} orders`}
                </h3>
                <p className="text-zinc-500 text-sm mb-4">
                  {orderFilter === 'all'
                    ? 'Create your first material order to get started'
                    : 'Try a different filter to see orders'}
                </p>
                {orderFilter === 'all' && (
                  <button
                    onClick={() => setActiveTab('create')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-brand-green text-black rounded-xl hover:bg-lime-400 font-bold text-sm transition-all"
                  >
                    <Plus size={16} />
                    Create Material Order
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============================================ */}
        {/* RETURNS TAB */}
        {/* ============================================ */}
        {activeTab === 'returns' && (
          <div className="bg-neutral-900 rounded-xl border border-neutral-800">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Returns & Credits</h2>
              <Link
                href="/portal/delivery/returns"
                className="flex items-center gap-2 text-brand-green text-sm font-medium hover:underline"
              >
                <RotateCcw size={14} />
                Manage Returns
              </Link>
            </div>
            <div className="p-8 text-center">
              <RotateCcw className="w-12 h-12 mx-auto mb-4 text-zinc-700" />
              <h3 className="text-base font-bold text-white mb-2">Return Materials</h3>
              <p className="text-zinc-500 text-sm mb-4">
                To create a return, expand an order in the My Orders tab and use the return workflow,
                or visit the Returns management page.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setActiveTab('orders')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700 font-medium text-sm transition-colors"
                >
                  <Eye size={16} />
                  View My Orders
                </button>
                <Link
                  href="/portal/delivery/returns"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 font-bold text-sm transition-colors"
                >
                  <RotateCcw size={16} />
                  Returns Page
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
