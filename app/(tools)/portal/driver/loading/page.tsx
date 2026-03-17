'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  Truck,
  CheckCircle,
  MapPin,
  Clock,
  Printer,
  RefreshCw,
  AlertTriangle,
  CheckSquare,
  Square,
  Loader2,
  ClipboardCheck,
  Camera,
} from 'lucide-react';

// ============================================
// PIPELINE TYPES
// ============================================

type PipelineStage =
  | 'ORDER_CREATED' | 'ORDER_REVIEWED' | 'DRIVER_ASSIGNED' | 'WAREHOUSE_NOTIFIED'
  | 'MATERIALS_PULLED' | 'LOAD_VERIFIED' | 'DEPARTURE_CONFIRMED' | 'EN_ROUTE'
  | 'ARRIVED_AT_SITE' | 'UNLOADING' | 'DELIVERY_CONFIRMED' | 'QC_PHOTOS'
  | 'OFFICE_NOTIFIED' | 'BILLING_REVIEW' | 'INVOICE_SENT' | 'PAYMENT_RECEIVED' | 'JOB_CLOSED';

interface PipelineOrderItem {
  itemId: string;
  productId: string;
  productName: string;
  sku: string;
  category: string;
  quantity: number;
  unit: string;
  pulledQty: number;
  verifiedQty: number;
}

interface PipelineOrder {
  orderId: string;
  currentStage: PipelineStage;
  priority: 'normal' | 'rush' | 'urgent';
  jobName: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryZip: string;
  scheduledDeliveryDate?: string;
  scheduledDeliveryTime?: string;
  assignedDriverId?: string;
  assignedDriverName?: string;
  items: PipelineOrderItem[];
  specialInstructions?: string;
  cancelled: boolean;
}

// Stages that are "loadable" - orders waiting for warehouse/driver to pull & verify
const LOADABLE_STAGES: PipelineStage[] = [
  'WAREHOUSE_NOTIFIED',
  'MATERIALS_PULLED',
  'LOAD_VERIFIED',
];

export default function DriverLoadingPage() {
  const [orders, setOrders] = useState<PipelineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedItems, setLoadedItems] = useState<Set<string>>(new Set());
  const [verifiedOrders, setVerifiedOrders] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoOrderId, setPhotoOrderId] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string[]>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLoadableOrders = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch orders at loadable stages from the pipeline
      const responses = await Promise.all(
        LOADABLE_STAGES.map(stage =>
          fetch(`/api/portal/pipeline?action=atStage&stage=${stage}`)
            .then(r => r.ok ? r.json() : [])
            .catch(() => [])
        )
      );
      const allOrders: PipelineOrder[] = responses.flat();

      // Dedupe by orderId (in case of race conditions)
      const seen = new Set<string>();
      const unique = allOrders.filter(o => {
        if (seen.has(o.orderId)) return false;
        seen.add(o.orderId);
        return !o.cancelled;
      });

      // Sort: urgent first, then by scheduled time
      unique.sort((a, b) => {
        const priorityOrder = { urgent: 0, rush: 1, normal: 2 };
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        return (a.scheduledDeliveryTime || '').localeCompare(b.scheduledDeliveryTime || '');
      });

      setOrders(unique);
    } catch (err) {
      console.error('Error fetching pipeline orders:', err);
      setError('Failed to load orders from pipeline');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoadableOrders();
  }, [fetchLoadableOrders]);

  // Clear messages
  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [successMessage]);

  const toggleItem = (key: string) => {
    setLoadedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isOrderFullyChecked = (order: PipelineOrder) => {
    return order.items.every((_, idx) =>
      loadedItems.has(`${order.orderId}-${idx}`)
    );
  };

  // Handle photo capture for an order
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !photoOrderId) return;
    setUploadingPhoto(true);

    const newUrls: string[] = [...(photoUrls[photoOrderId] || [])];
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append('photo', file);
        formData.append('ticketId', photoOrderId);
        formData.append('stage', 'MATERIALS_PULLED');
        const response = await fetch('/api/portal/delivery/photos', {
          method: 'POST',
          body: formData,
        });
        const result = await response.json();
        if (result.success && result.photo?.url) {
          newUrls.push(result.photo.url);
        }
      } catch { /* continue */ }
    }

    setPhotoUrls(prev => ({ ...prev, [photoOrderId]: newUrls }));
    setUploadingPhoto(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Verify load: transitions to MATERIALS_PULLED if at WAREHOUSE_NOTIFIED,
  // or to LOAD_VERIFIED if at MATERIALS_PULLED
  const markLoadVerified = async (order: PipelineOrder) => {
    setIsSubmitting(true);
    setError(null);
    try {
      // Determine which stage to transition to
      let targetStage: PipelineStage;
      if (order.currentStage === 'WAREHOUSE_NOTIFIED') {
        targetStage = 'MATERIALS_PULLED';
      } else if (order.currentStage === 'MATERIALS_PULLED') {
        targetStage = 'LOAD_VERIFIED';
      } else {
        // Already at LOAD_VERIFIED or beyond
        setVerifiedOrders(prev => new Set(prev).add(order.orderId));
        setIsSubmitting(false);
        return;
      }

      // Get GPS for LOAD_VERIFIED
      let gpsLat: number | undefined;
      let gpsLng: number | undefined;
      if (targetStage === 'LOAD_VERIFIED' && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
            });
          });
          gpsLat = pos.coords.latitude;
          gpsLng = pos.coords.longitude;
        } catch { /* GPS optional for loading page */ }
      }

      const body: Record<string, unknown> = {
        action: 'transitionStage',
        orderId: order.orderId,
        stage: targetStage,
      };

      // Include photos if available
      const photos = photoUrls[order.orderId];
      if (photos && photos.length > 0) {
        body.photoUrls = photos;
      }

      if (gpsLat !== undefined && gpsLng !== undefined) {
        body.gpsLat = gpsLat;
        body.gpsLng = gpsLng;
      }

      // Build pulled items data
      body.pulledItems = order.items.map(item => ({
        productId: item.productId,
        pulledQty: item.quantity,
      }));

      const response = await fetch('/api/portal/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success) {
        setVerifiedOrders(prev => new Set(prev).add(order.orderId));
        setSuccessMessage(`${order.jobName} - ${targetStage === 'MATERIALS_PULLED' ? 'Materials Pulled' : 'Load Verified'}!`);
        fetchLoadableOrders();
      } else {
        setError(result.error || 'Failed to update order');
      }
    } catch (err) {
      console.error('Error verifying load:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalItems = orders.reduce((sum, o) => sum + o.items.length, 0);
  const loadedCount = loadedItems.size;
  const allLoaded = totalItems > 0 && loadedCount === totalItems;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'rush':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default:
        return 'bg-zinc-700 text-zinc-300 border-zinc-600';
    }
  };

  const getStageLabel = (stage: PipelineStage) => {
    switch (stage) {
      case 'WAREHOUSE_NOTIFIED': return 'Needs Pulling';
      case 'MATERIALS_PULLED': return 'Needs Load Verify';
      case 'LOAD_VERIFIED': return 'Ready to Go';
      default: return stage;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-brand-green animate-spin" />
          <p className="text-zinc-400">Loading pipeline orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Hidden file input for photos */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handlePhotoCapture}
      />

      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/portal/driver"
              className="text-zinc-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-brand-green" />
                Loading Checklist
              </h1>
              <p className="text-sm text-zinc-400">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchLoadableOrders()}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 text-zinc-300 hover:text-white rounded-lg border border-zinc-700 print:hidden"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>
      </header>

      {/* Summary Bar */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-brand-green" />
            <span className="text-zinc-300 text-sm">
              <strong className="text-white">{orders.length}</strong> deliveries
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-brand-green" />
            <span className="text-zinc-300 text-sm">
              <strong className="text-white">{totalItems}</strong> items total
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-brand-green" />
            <span className="text-zinc-300 text-sm">
              <strong className="text-white">{loadedCount}</strong> / {totalItems} checked
            </span>
          </div>
          {allLoaded && (
            <span className="px-2 py-1 bg-brand-green/20 text-brand-green text-xs font-bold rounded border border-brand-green/30">
              ALL CHECKED
            </span>
          )}
        </div>
        {/* Progress bar */}
        <div className="mt-2 w-full bg-zinc-800 rounded-full h-2">
          <div
            className="bg-brand-green h-2 rounded-full transition-all duration-300"
            style={{ width: `${totalItems > 0 ? (loadedCount / totalItems) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="mx-4 mt-3 p-3 bg-brand-green/20 border border-brand-green/40 rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-brand-green flex-shrink-0" />
          <span className="text-brand-green font-bold text-sm">{successMessage}</span>
        </div>
      )}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-500/20 border border-red-500/40 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-red-400 font-bold text-sm">{error}</span>
        </div>
      )}

      {/* Content */}
      <div className="px-4 sm:px-6 py-6 space-y-6 max-w-4xl mx-auto">
        {orders.length === 0 ? (
          <div className="text-center py-16">
            <Truck className="w-16 h-16 mx-auto mb-4 text-zinc-700" />
            <h2 className="text-xl font-semibold text-white mb-2">No Orders to Load</h2>
            <p className="text-zinc-400">
              No pipeline orders are waiting for loading right now.
            </p>
          </div>
        ) : (
          orders.map(order => {
            const orderChecked = isOrderFullyChecked(order);
            const isVerified = verifiedOrders.has(order.orderId) || order.currentStage === 'LOAD_VERIFIED';
            const stageLabel = getStageLabel(order.currentStage);
            const orderPhotos = photoUrls[order.orderId] || [];

            return (
              <div
                key={order.orderId}
                className={`bg-zinc-900 border rounded-xl overflow-hidden ${
                  isVerified ? 'border-brand-green/40' : 'border-zinc-800'
                }`}
              >
                {/* Order Header */}
                <div className="px-4 sm:px-6 py-4 border-b border-zinc-800">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm text-brand-green">
                          {order.orderId}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded border ${getPriorityColor(order.priority)}`}
                        >
                          {order.priority.toUpperCase()}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-bold rounded border ${
                          order.currentStage === 'LOAD_VERIFIED'
                            ? 'bg-brand-green/20 text-brand-green border-brand-green/30'
                            : order.currentStage === 'MATERIALS_PULLED'
                            ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                            : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                        }`}>
                          {stageLabel}
                        </span>
                        {isVerified && (
                          <span className="px-2 py-0.5 text-xs font-bold bg-brand-green/20 text-brand-green rounded border border-brand-green/30">
                            VERIFIED
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-white">
                        {order.jobName}
                      </h3>
                      <div className="flex items-center gap-1 text-sm text-zinc-400 mt-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {order.deliveryAddress}, {order.deliveryCity}, {order.deliveryState} {order.deliveryZip}
                      </div>
                      <div className="text-sm text-zinc-500 mt-1">
                        Customer: {order.customerName} | {order.customerPhone}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm text-zinc-400">
                        <Clock className="w-3.5 h-3.5" />
                        {order.scheduledDeliveryTime || 'No time set'}
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">
                        {order.items.length} items
                      </div>
                    </div>
                  </div>
                  {order.specialInstructions && (
                    <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <div className="flex items-center gap-1 text-xs text-amber-400 font-medium mb-1">
                        <AlertTriangle className="w-3 h-3" />
                        Special Instructions
                      </div>
                      <p className="text-sm text-amber-300">
                        {order.specialInstructions}
                      </p>
                    </div>
                  )}
                </div>

                {/* Materials Checklist */}
                <div className="divide-y divide-zinc-800">
                  {order.items.map((item, idx) => {
                    const key = `${order.orderId}-${idx}`;
                    const isLoaded = loadedItems.has(key);

                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-3 px-4 sm:px-6 py-3 cursor-pointer transition-colors ${
                          isLoaded ? 'bg-brand-green/5' : 'hover:bg-zinc-800/50'
                        }`}
                        onClick={() => toggleItem(key)}
                      >
                        <div>
                          {isLoaded ? (
                            <CheckSquare className="w-5 h-5 text-brand-green" />
                          ) : (
                            <Square className="w-5 h-5 text-zinc-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium ${isLoaded ? 'text-brand-green line-through' : 'text-white'}`}>
                            {item.productName}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {item.sku ? `SKU: ${item.sku}` : `ID: ${item.productId}`}
                            {item.category && ` | ${item.category}`}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-lg font-bold ${isLoaded ? 'text-brand-green' : 'text-white'}`}>
                            {item.quantity}
                          </div>
                          <div className="text-xs text-zinc-500">{item.unit}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Photo + Verify Section */}
                <div className="px-4 sm:px-6 py-4 border-t border-zinc-800 space-y-3">
                  {/* Photo button for staged materials */}
                  {!isVerified && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setPhotoOrderId(order.orderId);
                          fileInputRef.current?.click();
                        }}
                        disabled={uploadingPhoto && photoOrderId === order.orderId}
                        className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 text-sm font-medium border border-zinc-700 transition-colors disabled:opacity-50"
                      >
                        {uploadingPhoto && photoOrderId === order.orderId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Camera className="w-4 h-4" />
                        )}
                        {orderPhotos.length > 0 ? `${orderPhotos.length} Photo${orderPhotos.length > 1 ? 's' : ''}` : 'Take Photo'}
                      </button>
                      {orderPhotos.length > 0 && (
                        <span className="text-brand-green text-xs font-medium flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Photos attached
                        </span>
                      )}
                    </div>
                  )}

                  {isVerified ? (
                    <div className="flex items-center gap-2 text-brand-green">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Load Verified</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => markLoadVerified(order)}
                      disabled={!orderChecked || isSubmitting}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-colors ${
                        orderChecked
                          ? 'bg-brand-green text-black hover:brightness-90'
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <CheckCircle className="w-5 h-5" />
                      )}
                      {orderChecked
                        ? order.currentStage === 'WAREHOUSE_NOTIFIED'
                          ? 'Confirm Materials Pulled'
                          : 'Mark Load as Verified'
                        : `${
                            order.items.filter((_, i) =>
                              loadedItems.has(`${order.orderId}-${i}`)
                            ).length
                          } / ${order.items.length} items checked`}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
