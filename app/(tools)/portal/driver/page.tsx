'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Truck, MapPin, Phone, Clock, CheckCircle2, Camera, Package,
  Navigation, ArrowLeft, Loader2, RefreshCw, User, AlertCircle,
  ClipboardCheck, ChevronRight, ChevronDown,
  CheckSquare, Square, MessageSquare, Upload, Timer,
  Bell, AlertTriangle, ChevronUp, Shield, Warehouse, CircleDot
} from 'lucide-react';

// ============================================
// PIPELINE TYPES
// ============================================

type PipelineStage =
  | 'ORDER_CREATED'
  | 'ORDER_REVIEWED'
  | 'DRIVER_ASSIGNED'
  | 'WAREHOUSE_NOTIFIED'
  | 'MATERIALS_PULLED'
  | 'LOAD_VERIFIED'
  | 'DEPARTURE_CONFIRMED'
  | 'EN_ROUTE'
  | 'ARRIVED_AT_SITE'
  | 'UNLOADING'
  | 'DELIVERY_CONFIRMED'
  | 'QC_PHOTOS'
  | 'OFFICE_NOTIFIED'
  | 'BILLING_REVIEW'
  | 'INVOICE_SENT'
  | 'PAYMENT_RECEIVED'
  | 'JOB_CLOSED';

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
  deliveredQty: number;
  notes?: string;
}

interface PipelineOrder {
  orderId: string;
  currentStage: PipelineStage;
  priority: 'normal' | 'rush' | 'urgent';
  createdAt: string;
  updatedAt: string;
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
  items: PipelineOrderItem[];
  specialInstructions?: string;
  notes?: string;
  cancelled: boolean;
  events: Array<{
    eventId: string;
    stage: PipelineStage;
    timestamp: string;
    performedByName: string;
    notes?: string;
  }>;
}

interface DriverInfo {
  id: string;
  name: string;
  vehicle: string;
  email?: string;
  phone?: string;
}

// ============================================
// DRIVER WORKFLOW STAGES (the 8 stages drivers care about)
// ============================================

const DRIVER_STAGES: PipelineStage[] = [
  'MATERIALS_PULLED',
  'LOAD_VERIFIED',
  'DEPARTURE_CONFIRMED',
  'EN_ROUTE',
  'ARRIVED_AT_SITE',
  'UNLOADING',
  'DELIVERY_CONFIRMED',
  'QC_PHOTOS',
];

interface StageButton {
  stage: PipelineStage;
  label: string;
  icon: typeof Truck;
  requiresPhoto: boolean;
  requiresGPS: boolean;
  description: string;
  inventoryAction?: string;
}

const STAGE_BUTTONS: StageButton[] = [
  {
    stage: 'MATERIALS_PULLED',
    label: 'Materials Pulled',
    icon: Package,
    requiresPhoto: true,
    requiresGPS: false,
    description: 'Photo of staged materials at warehouse',
  },
  {
    stage: 'LOAD_VERIFIED',
    label: 'Load Verified',
    icon: ClipboardCheck,
    requiresPhoto: true,
    requiresGPS: true,
    description: 'Photo of loaded truck + GPS at warehouse',
  },
  {
    stage: 'DEPARTURE_CONFIRMED',
    label: 'Departed',
    icon: Truck,
    requiresPhoto: false,
    requiresGPS: true,
    description: 'GPS auto-captured on departure',
  },
  {
    stage: 'EN_ROUTE',
    label: 'En Route',
    icon: Navigation,
    requiresPhoto: false,
    requiresGPS: true,
    description: 'GPS tracking while driving',
  },
  {
    stage: 'ARRIVED_AT_SITE',
    label: 'Arrived',
    icon: MapPin,
    requiresPhoto: true,
    requiresGPS: true,
    description: 'Photo of job site + GPS at arrival',
  },
  {
    stage: 'UNLOADING',
    label: 'Unloading',
    icon: Package,
    requiresPhoto: true,
    requiresGPS: false,
    description: 'Photo of materials being unloaded',
  },
  {
    stage: 'DELIVERY_CONFIRMED',
    label: 'Delivery Confirmed',
    icon: CheckCircle2,
    requiresPhoto: true,
    requiresGPS: true,
    description: 'Final photo + GPS. DEDUCTS INVENTORY.',
    inventoryAction: 'Inventory will be deducted',
  },
  {
    stage: 'QC_PHOTOS',
    label: 'QC Photos',
    icon: Camera,
    requiresPhoto: true,
    requiresGPS: true,
    description: 'Quality check photos of completed delivery',
  },
];

const STAGE_COLOR: Record<PipelineStage, string> = {
  ORDER_CREATED: 'bg-zinc-600',
  ORDER_REVIEWED: 'bg-zinc-600',
  DRIVER_ASSIGNED: 'bg-cyan-600',
  WAREHOUSE_NOTIFIED: 'bg-cyan-600',
  MATERIALS_PULLED: 'bg-yellow-600',
  LOAD_VERIFIED: 'bg-brand-green/80',
  DEPARTURE_CONFIRMED: 'bg-blue-600',
  EN_ROUTE: 'bg-purple-600',
  ARRIVED_AT_SITE: 'bg-orange-600',
  UNLOADING: 'bg-amber-600',
  DELIVERY_CONFIRMED: 'bg-teal-600',
  QC_PHOTOS: 'bg-pink-600',
  OFFICE_NOTIFIED: 'bg-brand-green/80',
  BILLING_REVIEW: 'bg-brand-green/80',
  INVOICE_SENT: 'bg-brand-green/80',
  PAYMENT_RECEIVED: 'bg-green-600',
  JOB_CLOSED: 'bg-green-600',
};

const STAGE_LABELS: Record<PipelineStage, string> = {
  ORDER_CREATED: 'Order Created',
  ORDER_REVIEWED: 'Reviewed',
  DRIVER_ASSIGNED: 'Assigned to You',
  WAREHOUSE_NOTIFIED: 'Warehouse Notified',
  MATERIALS_PULLED: 'Materials Pulled',
  LOAD_VERIFIED: 'Load Verified',
  DEPARTURE_CONFIRMED: 'Departed',
  EN_ROUTE: 'En Route',
  ARRIVED_AT_SITE: 'Arrived',
  UNLOADING: 'Unloading',
  DELIVERY_CONFIRMED: 'Delivered',
  QC_PHOTOS: 'QC Complete',
  OFFICE_NOTIFIED: 'Office Notified',
  BILLING_REVIEW: 'Billing Review',
  INVOICE_SENT: 'Invoice Sent',
  PAYMENT_RECEIVED: 'Paid',
  JOB_CLOSED: 'Closed',
};

// ============================================
// HELPER: Get GPS position as a promise
// ============================================

function getGPS(): Promise<{ lat: number; lng: number } | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}

// ============================================
// HELPER: Upload photo and return URL
// ============================================

async function uploadPhoto(file: File, orderId: string, stage: string, gpsLocation?: string): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('ticketId', orderId);
    formData.append('stage', stage);
    if (gpsLocation) formData.append('gpsLocation', gpsLocation);

    const response = await fetch('/api/portal/delivery/photos', {
      method: 'POST',
      body: formData,
    });
    const result = await response.json();
    if (result.success && result.photo?.url) {
      return result.photo.url;
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================
// HELPER: Get the next driver stage from current pipeline stage
// ============================================

function getNextDriverStage(currentStage: PipelineStage): StageButton | null {
  const ALL_STAGES: PipelineStage[] = [
    'ORDER_CREATED', 'ORDER_REVIEWED', 'DRIVER_ASSIGNED', 'WAREHOUSE_NOTIFIED',
    'MATERIALS_PULLED', 'LOAD_VERIFIED', 'DEPARTURE_CONFIRMED', 'EN_ROUTE',
    'ARRIVED_AT_SITE', 'UNLOADING', 'DELIVERY_CONFIRMED', 'QC_PHOTOS',
    'OFFICE_NOTIFIED', 'BILLING_REVIEW', 'INVOICE_SENT', 'PAYMENT_RECEIVED', 'JOB_CLOSED'
  ];
  const currentIdx = ALL_STAGES.indexOf(currentStage);
  if (currentIdx === -1) return null;

  // Find the next stage in the pipeline that the driver can perform
  for (let i = currentIdx + 1; i < ALL_STAGES.length; i++) {
    const nextStage = ALL_STAGES[i];
    const btn = STAGE_BUTTONS.find(b => b.stage === nextStage);
    if (btn) return btn;
  }
  return null;
}

// ============================================
// HELPER: Get driver stage index for progress display
// ============================================

function getDriverStageIndex(stage: PipelineStage): number {
  return DRIVER_STAGES.indexOf(stage);
}

function isDriverStageComplete(orderStage: PipelineStage, checkStage: PipelineStage): boolean {
  const ALL_STAGES: PipelineStage[] = [
    'ORDER_CREATED', 'ORDER_REVIEWED', 'DRIVER_ASSIGNED', 'WAREHOUSE_NOTIFIED',
    'MATERIALS_PULLED', 'LOAD_VERIFIED', 'DEPARTURE_CONFIRMED', 'EN_ROUTE',
    'ARRIVED_AT_SITE', 'UNLOADING', 'DELIVERY_CONFIRMED', 'QC_PHOTOS',
    'OFFICE_NOTIFIED', 'BILLING_REVIEW', 'INVOICE_SENT', 'PAYMENT_RECEIVED', 'JOB_CLOSED'
  ];
  return ALL_STAGES.indexOf(orderStage) >= ALL_STAGES.indexOf(checkStage);
}

function isOrderComplete(stage: PipelineStage): boolean {
  const COMPLETE_STAGES: PipelineStage[] = ['QC_PHOTOS', 'OFFICE_NOTIFIED', 'BILLING_REVIEW', 'INVOICE_SENT', 'PAYMENT_RECEIVED', 'JOB_CLOSED'];
  return COMPLETE_STAGES.includes(stage);
}

function formatTimeFromISO(isoString: string): string {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function DriverPortal() {
  const router = useRouter();
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [orders, setOrders] = useState<PipelineOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<PipelineOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [issueNotes, setIssueNotes] = useState('');
  const [showIssueField, setShowIssueField] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([]);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'acquiring' | 'acquired' | 'failed'>('idle');
  const [currentGPS, setCurrentGPS] = useState<{ lat: number; lng: number } | null>(null);
  const [showPhotoPrompt, setShowPhotoPrompt] = useState(false);
  const [pendingStage, setPendingStage] = useState<StageButton | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load driver info from session
  useEffect(() => {
    const storedDriver = sessionStorage.getItem('driver');
    if (!storedDriver) {
      router.push('/portal');
      return;
    }
    const parsed = JSON.parse(storedDriver);
    setDriver(parsed);
    loadOrders(parsed.id);
  }, [router]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!driver) return;
    const interval = setInterval(() => {
      loadOrders(driver.id);
    }, 60000);
    return () => clearInterval(interval);
  }, [driver]);

  // Clear success/error messages after 4 seconds
  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [successMessage]);
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 6000);
      return () => clearTimeout(t);
    }
  }, [error]);

  // ============================================
  // DATA LOADING
  // ============================================

  const loadOrders = async (driverId: string) => {
    setIsLoading(true);
    try {
      // Fetch pipeline orders assigned to this driver
      const response = await fetch(`/api/portal/pipeline?action=byDriver&driverId=${driverId}`);
      if (!response.ok) throw new Error('Failed to load orders');
      const data = await response.json();
      const orderList: PipelineOrder[] = Array.isArray(data) ? data : [];

      // Sort: active first, then by priority, then by scheduled time
      orderList.sort((a, b) => {
        const aComplete = isOrderComplete(a.currentStage) || a.cancelled ? 1 : 0;
        const bComplete = isOrderComplete(b.currentStage) || b.cancelled ? 1 : 0;
        if (aComplete !== bComplete) return aComplete - bComplete;
        const priorityOrder = { urgent: 0, rush: 1, normal: 2 };
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        return (a.scheduledDeliveryTime || '').localeCompare(b.scheduledDeliveryTime || '');
      });

      setOrders(orderList);

      // Update selected order if it exists
      if (selectedOrder) {
        const updated = orderList.find(o => o.orderId === selectedOrder.orderId);
        if (updated) setSelectedOrder(updated);
      }
    } catch (err) {
      console.error('Error loading pipeline orders:', err);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // STAGE TRANSITION
  // ============================================

  const handleStageTransition = async (stageButton: StageButton) => {
    if (!selectedOrder || !driver) return;

    // If photo is required and we don't have one yet, prompt for photo first
    if (stageButton.requiresPhoto && pendingPhotos.length === 0) {
      setPendingStage(stageButton);
      setShowPhotoPrompt(true);
      return;
    }

    // If GPS required, acquire it
    let gps = currentGPS;
    if (stageButton.requiresGPS && !gps) {
      setGpsStatus('acquiring');
      gps = await getGPS();
      if (!gps) {
        setGpsStatus('failed');
        setError(`GPS required for ${stageButton.label}. Please enable location services and try again.`);
        return;
      }
      setGpsStatus('acquired');
      setCurrentGPS(gps);
    }

    setIsUpdating(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        action: 'transitionStage',
        orderId: selectedOrder.orderId,
        stage: stageButton.stage,
      };

      // Attach photos
      if (pendingPhotos.length > 0) {
        body.photoUrls = pendingPhotos;
      }

      // Attach GPS
      if (gps) {
        body.gpsLat = gps.lat;
        body.gpsLng = gps.lng;
      }

      // Attach notes for delivery confirmation
      if (stageButton.stage === 'DELIVERY_CONFIRMED' || stageButton.stage === 'UNLOADING') {
        const allNotes = [deliveryNotes, issueNotes].filter(Boolean).join('\n---\n');
        if (allNotes) body.notes = allNotes;
      }

      const response = await fetch('/api/portal/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();

      if (result.success && result.order) {
        setSelectedOrder(result.order);
        setSuccessMessage(`${stageButton.label} confirmed!`);
        // Reset state
        setPendingPhotos([]);
        setCurrentGPS(null);
        setGpsStatus('idle');
        setDeliveryNotes('');
        setIssueNotes('');
        setShowIssueField(false);
        setShowPhotoPrompt(false);
        setPendingStage(null);
        // Refresh order list
        await loadOrders(driver.id);

        // If this was the last driver stage (QC_PHOTOS), go back to list
        if (stageButton.stage === 'QC_PHOTOS') {
          setTimeout(() => {
            setView('list');
            setSelectedOrder(null);
          }, 1500);
        }
      } else {
        setError(result.error || 'Failed to transition stage');
      }
    } catch (err) {
      console.error('Stage transition error:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  // ============================================
  // PHOTO HANDLING
  // ============================================

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedOrder || !pendingStage) return;

    setUploadingPhoto(true);
    const newPhotos: string[] = [...pendingPhotos];

    for (const file of Array.from(files)) {
      const gpsStr = currentGPS ? `${currentGPS.lat},${currentGPS.lng}` : undefined;
      const url = await uploadPhoto(file, selectedOrder.orderId, pendingStage.stage, gpsStr);
      if (url) {
        newPhotos.push(url);
      }
    }

    setPendingPhotos(newPhotos);
    setUploadingPhoto(false);

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';

    // If we have enough photos, auto-proceed with the transition
    if (newPhotos.length > 0) {
      setShowPhotoPrompt(false);
      // Small delay to let state update, then proceed
      setTimeout(() => {
        handleStageTransitionWithPhotos(pendingStage, newPhotos);
      }, 100);
    }
  };

  // Proceed with transition after photos are captured
  const handleStageTransitionWithPhotos = async (stageButton: StageButton, photos: string[]) => {
    if (!selectedOrder || !driver) return;

    let gps = currentGPS;
    if (stageButton.requiresGPS && !gps) {
      setGpsStatus('acquiring');
      gps = await getGPS();
      if (!gps) {
        setGpsStatus('failed');
        setError(`GPS required for ${stageButton.label}. Please enable location services.`);
        return;
      }
      setGpsStatus('acquired');
      setCurrentGPS(gps);
    }

    setIsUpdating(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        action: 'transitionStage',
        orderId: selectedOrder.orderId,
        stage: stageButton.stage,
        photoUrls: photos,
      };

      if (gps) {
        body.gpsLat = gps.lat;
        body.gpsLng = gps.lng;
      }

      if (stageButton.stage === 'DELIVERY_CONFIRMED' || stageButton.stage === 'UNLOADING') {
        const allNotes = [deliveryNotes, issueNotes].filter(Boolean).join('\n---\n');
        if (allNotes) body.notes = allNotes;
      }

      const response = await fetch('/api/portal/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();

      if (result.success && result.order) {
        setSelectedOrder(result.order);
        setSuccessMessage(`${stageButton.label} confirmed!`);
        setPendingPhotos([]);
        setCurrentGPS(null);
        setGpsStatus('idle');
        setDeliveryNotes('');
        setIssueNotes('');
        setShowIssueField(false);
        setPendingStage(null);
        await loadOrders(driver.id);

        if (stageButton.stage === 'QC_PHOTOS') {
          setTimeout(() => {
            setView('list');
            setSelectedOrder(null);
          }, 1500);
        }
      } else {
        setError(result.error || 'Failed to transition stage');
      }
    } catch (err) {
      console.error('Stage transition error:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const openNavigation = (order: PipelineOrder) => {
    const address = `${order.deliveryAddress}, ${order.deliveryCity}, ${order.deliveryState} ${order.deliveryZip}`;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('driver');
    router.push('/portal');
  };

  if (!driver) return null;

  // ============================================
  // ORDER DETAIL VIEW
  // ============================================
  if (view === 'detail' && selectedOrder) {
    const nextAction = getNextDriverStage(selectedOrder.currentStage);
    const stageColor = STAGE_COLOR[selectedOrder.currentStage] || 'bg-zinc-600';
    const stageLabel = STAGE_LABELS[selectedOrder.currentStage] || selectedOrder.currentStage;

    // Determine if order is past driver stages
    const driverDone = isOrderComplete(selectedOrder.currentStage) ||
      isDriverStageComplete(selectedOrder.currentStage, 'QC_PHOTOS');

    return (
      <div className="min-h-screen bg-black pb-28">
        {/* Hidden file input for photo capture */}
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
        <div className="bg-zinc-900 border-b border-zinc-800 p-4 safe-top">
          <button
            onClick={() => { setView('list'); setSelectedOrder(null); setPendingPhotos([]); setPendingStage(null); setShowPhotoPrompt(false); }}
            className="flex items-center gap-2 text-zinc-400 active:text-brand-green mb-3 py-1"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Back to Route</span>
          </button>
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-white truncate">{selectedOrder.jobName}</h1>
              <p className="text-xs text-zinc-500 font-mono">{selectedOrder.orderId}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${stageColor} ml-3 flex-shrink-0`}>
              {stageLabel}
            </span>
          </div>
        </div>

        {/* Success / Error Messages */}
        {successMessage && (
          <div className="mx-4 mt-3 p-3 bg-brand-green/20 border border-brand-green/40 rounded-xl flex items-center gap-2">
            <CheckCircle2 size={18} className="text-brand-green flex-shrink-0" />
            <span className="text-brand-green font-bold text-sm">{successMessage}</span>
          </div>
        )}
        {error && (
          <div className="mx-4 mt-3 p-3 bg-red-500/20 border border-red-500/40 rounded-xl flex items-center gap-2">
            <AlertCircle size={18} className="text-red-400 flex-shrink-0" />
            <span className="text-red-400 font-bold text-sm">{error}</span>
          </div>
        )}

        {/* Pipeline Progress Steps - horizontal scroll */}
        <div className="bg-zinc-900/80 border-b border-zinc-800 p-3 overflow-x-auto">
          <div className="flex gap-1.5 min-w-max">
            {STAGE_BUTTONS.map((step) => {
              const isCompleted = isDriverStageComplete(selectedOrder.currentStage, step.stage);
              const isCurrent = selectedOrder.currentStage === step.stage ||
                // If between warehouse and first driver stage
                (getDriverStageIndex(selectedOrder.currentStage) === -1 &&
                  step.stage === 'MATERIALS_PULLED' &&
                  getNextDriverStage(selectedOrder.currentStage)?.stage === 'MATERIALS_PULLED');
              return (
                <div
                  key={step.stage}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors ${
                    isCompleted ? 'bg-brand-green/20 text-brand-green' :
                    isCurrent ? 'bg-brand-green/10 text-brand-green ring-1 ring-brand-green/40' :
                    'bg-zinc-800/60 text-zinc-600'
                  }`}
                >
                  <step.icon size={14} />
                  <span className="text-[11px] font-semibold whitespace-nowrap">{step.label}</span>
                  {step.requiresPhoto && (
                    <Camera size={10} className={isCompleted ? 'text-brand-green/60' : 'text-zinc-700'} />
                  )}
                  {step.requiresGPS && (
                    <MapPin size={10} className={isCompleted ? 'text-brand-green/60' : 'text-zinc-700'} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Customer Info */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
              <User size={16} className="text-brand-green" /> Customer
            </h3>
            <div className="space-y-2">
              <p className="text-zinc-300 text-sm">{selectedOrder.customerName}</p>
              {selectedOrder.customerPhone && (
                <a
                  href={`tel:${selectedOrder.customerPhone}`}
                  className="flex items-center gap-3 bg-brand-green/10 border border-brand-green/30 rounded-xl px-4 py-3 text-brand-green active:bg-brand-green/20 transition-colors"
                >
                  <Phone size={18} />
                  <span className="font-bold text-sm">{selectedOrder.customerPhone}</span>
                  <span className="ml-auto text-xs opacity-70">Tap to Call</span>
                </a>
              )}
            </div>
          </div>

          {/* Address & Navigation */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
              <MapPin size={16} className="text-brand-green" /> Delivery Address
            </h3>
            <p className="text-zinc-300 text-sm">{selectedOrder.deliveryAddress}</p>
            <p className="text-zinc-500 text-xs mb-4">
              {selectedOrder.deliveryCity}, {selectedOrder.deliveryState} {selectedOrder.deliveryZip}
            </p>
            <button
              onClick={() => openNavigation(selectedOrder)}
              className="w-full bg-brand-green active:brightness-90 text-black font-black py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm transition-all"
            >
              <Navigation size={18} />
              Navigate to Job Site
            </button>
          </div>

          {/* Materials */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
              <Package size={16} className="text-brand-green" />
              Materials ({selectedOrder.items?.length || 0})
            </h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {selectedOrder.items?.map((item, idx) => (
                <div key={item.itemId || idx} className="flex justify-between items-center py-2 border-b border-zinc-800/60 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm truncate">{item.productName}</p>
                    {item.sku && <p className="text-zinc-600 text-[11px] font-mono">{item.sku}</p>}
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className="text-brand-green font-bold text-sm">{item.quantity} {item.unit}</p>
                    {item.pulledQty > 0 && item.pulledQty !== item.quantity && (
                      <p className="text-yellow-400 text-[10px]">Pulled: {item.pulledQty}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {selectedOrder.specialInstructions && (
              <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <p className="text-yellow-400 text-xs font-bold flex items-center gap-1">
                  <AlertTriangle size={12} /> Special Instructions
                </p>
                <p className="text-yellow-200/90 text-sm mt-1">{selectedOrder.specialInstructions}</p>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
              <Clock size={16} className="text-brand-green" /> Timeline
            </h3>
            <div className="space-y-2 text-sm">
              {selectedOrder.scheduledDeliveryDate && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Scheduled</span>
                  <span className="text-white font-medium">
                    {selectedOrder.scheduledDeliveryDate}
                    {selectedOrder.scheduledDeliveryTime ? ` ${selectedOrder.scheduledDeliveryTime}` : ''}
                  </span>
                </div>
              )}
              {selectedOrder.events
                ?.filter(e => DRIVER_STAGES.includes(e.stage))
                .map((event) => (
                  <div key={event.eventId} className="flex justify-between">
                    <span className="text-zinc-500">{STAGE_LABELS[event.stage]}</span>
                    <span className="text-brand-green font-medium">{formatTimeFromISO(event.timestamp)}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Delivery Notes (show when at ARRIVED_AT_SITE or UNLOADING) */}
          {(selectedOrder.currentStage === 'ARRIVED_AT_SITE' || selectedOrder.currentStage === 'UNLOADING') && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <h3 className="font-bold text-white text-sm">Delivery Notes</h3>
              <textarea
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Add any notes about the delivery..."
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm resize-none focus:border-brand-green focus:ring-1 focus:ring-brand-green/30 focus:outline-none placeholder-zinc-600"
              />
              <button
                onClick={() => setShowIssueField(!showIssueField)}
                className="flex items-center gap-2 text-yellow-400 text-sm active:text-yellow-300 py-1"
              >
                <AlertTriangle size={16} />
                {showIssueField ? 'Hide Issue Report' : 'Report an Issue'}
                {showIssueField ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showIssueField && (
                <textarea
                  value={issueNotes}
                  onChange={(e) => setIssueNotes(e.target.value)}
                  placeholder="Describe the issue..."
                  rows={3}
                  className="w-full bg-zinc-800 border border-yellow-500/40 rounded-xl px-4 py-3 text-white text-sm resize-none focus:border-yellow-500 focus:outline-none placeholder-zinc-600"
                />
              )}
            </div>
          )}

          {/* Photo Upload Section (when photo prompt is showing) */}
          {showPhotoPrompt && pendingStage && (
            <div className="bg-zinc-900 border-2 border-brand-green/50 rounded-2xl p-4 space-y-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Camera size={16} className="text-brand-green" />
                Photo Required: {pendingStage.label}
              </h3>
              <p className="text-zinc-400 text-xs">{pendingStage.description}</p>

              {pendingPhotos.length > 0 && (
                <div className="flex items-center gap-2 text-brand-green text-sm">
                  <CheckCircle2 size={16} />
                  <span className="font-bold">{pendingPhotos.length} photo{pendingPhotos.length > 1 ? 's' : ''} captured</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="flex-1 bg-brand-green active:brightness-90 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm disabled:bg-zinc-700 disabled:text-zinc-500"
                >
                  {uploadingPhoto ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Camera size={18} />
                  )}
                  {uploadingPhoto ? 'Uploading...' : 'Take Photo'}
                </button>
                {pendingPhotos.length > 0 && (
                  <button
                    onClick={() => handleStageTransitionWithPhotos(pendingStage, pendingPhotos)}
                    disabled={isUpdating}
                    className="flex-1 bg-brand-green active:brightness-90 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm"
                  >
                    <CheckCircle2 size={18} />
                    Continue
                  </button>
                )}
              </div>

              <button
                onClick={() => { setShowPhotoPrompt(false); setPendingStage(null); setPendingPhotos([]); }}
                className="w-full text-zinc-500 text-xs py-1 active:text-zinc-300"
              >
                Cancel
              </button>
            </div>
          )}

          {/* GPS Status Indicator */}
          {gpsStatus !== 'idle' && (
            <div className={`rounded-xl px-4 py-2 flex items-center gap-2 text-sm ${
              gpsStatus === 'acquiring' ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400' :
              gpsStatus === 'acquired' ? 'bg-brand-green/10 border border-brand-green/30 text-brand-green' :
              'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {gpsStatus === 'acquiring' && <Loader2 className="animate-spin" size={16} />}
              {gpsStatus === 'acquired' && <MapPin size={16} />}
              {gpsStatus === 'failed' && <AlertCircle size={16} />}
              <span className="font-medium">
                {gpsStatus === 'acquiring' && 'Acquiring GPS...'}
                {gpsStatus === 'acquired' && `GPS: ${currentGPS?.lat.toFixed(4)}, ${currentGPS?.lng.toFixed(4)}`}
                {gpsStatus === 'failed' && 'GPS unavailable - enable location services'}
              </span>
            </div>
          )}

          {/* Quick Actions */}
          {!showPhotoPrompt && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  if (nextAction) {
                    setPendingStage(nextAction);
                    fileInputRef.current?.click();
                  }
                }}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center active:bg-zinc-800 transition-colors"
              >
                <Camera className="mx-auto text-brand-green mb-2" size={24} />
                <span className="text-white text-sm font-medium block">Take Photo</span>
                <span className="text-zinc-600 text-[11px]">{pendingPhotos.length} staged</span>
              </button>
              <button
                onClick={async () => {
                  setGpsStatus('acquiring');
                  const gps = await getGPS();
                  if (gps) {
                    setCurrentGPS(gps);
                    setGpsStatus('acquired');
                  } else {
                    setGpsStatus('failed');
                  }
                }}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center active:bg-zinc-800 transition-colors"
              >
                <MapPin className="mx-auto text-blue-400 mb-2" size={24} />
                <span className="text-white text-sm font-medium block">Get GPS</span>
                <span className="text-zinc-600 text-[11px]">{currentGPS ? 'Acquired' : 'Tap to get'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Fixed Bottom Action Button */}
        {nextAction && !showPhotoPrompt && !driverDone && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/95 backdrop-blur-sm border-t border-zinc-800 safe-bottom">
            {/* Requirements indicator */}
            <div className="flex items-center justify-center gap-3 mb-2 text-[11px]">
              {nextAction.requiresPhoto && (
                <span className={`flex items-center gap-1 ${pendingPhotos.length > 0 ? 'text-brand-green' : 'text-zinc-500'}`}>
                  <Camera size={12} />
                  Photo {pendingPhotos.length > 0 ? '(ready)' : '(required)'}
                </span>
              )}
              {nextAction.requiresGPS && (
                <span className={`flex items-center gap-1 ${currentGPS ? 'text-brand-green' : 'text-zinc-500'}`}>
                  <MapPin size={12} />
                  GPS {currentGPS ? '(ready)' : '(auto)'}
                </span>
              )}
              {nextAction.inventoryAction && (
                <span className="flex items-center gap-1 text-amber-400">
                  <Shield size={12} />
                  {nextAction.inventoryAction}
                </span>
              )}
            </div>
            <button
              onClick={() => handleStageTransition(nextAction)}
              disabled={isUpdating}
              className={`w-full font-black py-4 rounded-2xl flex items-center justify-center gap-2.5 text-base transition-all active:scale-[0.98] ${
                nextAction.stage === 'DELIVERY_CONFIRMED'
                  ? 'bg-amber-500 active:bg-amber-400 text-black'
                  : nextAction.stage === 'QC_PHOTOS'
                  ? 'bg-pink-500 active:bg-pink-400 text-black'
                  : 'bg-brand-green active:brightness-90 text-black'
              } disabled:bg-zinc-800 disabled:text-zinc-600`}
            >
              {isUpdating ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <nextAction.icon size={20} />
              )}
              {nextAction.label}
            </button>
          </div>
        )}

        {/* Completed state */}
        {driverDone && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/95 backdrop-blur-sm border-t border-zinc-800 safe-bottom">
            <div className="w-full bg-green-500/20 border border-green-500/40 py-4 rounded-2xl flex items-center justify-center gap-2.5 text-base text-green-400">
              <CheckCircle2 size={20} />
              <span className="font-bold">Delivery Complete</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================
  // ROUTE LIST VIEW (Main Screen)
  // ============================================
  const activeOrders = orders.filter(o => !isOrderComplete(o.currentStage) && !o.cancelled);
  const completedOrders = orders.filter(o => isOrderComplete(o.currentStage) || o.cancelled);

  return (
    <div className="min-h-screen bg-black">
      {/* Header - Neon Green */}
      <div className="bg-brand-green p-4 safe-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black/20 rounded-full flex items-center justify-center">
              <Truck size={20} className="text-black" />
            </div>
            <div>
              <h1 className="font-black text-black text-base">{driver.name}</h1>
              <p className="text-sm text-black/60 font-medium">{driver.vehicle}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-sm text-black/60 active:text-black font-medium py-1 px-2">
            Logout
          </button>
        </div>
      </div>

      {/* Route Summary */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-black text-white">{orders.length}</p>
            <p className="text-[11px] text-zinc-500 font-medium">Total</p>
          </div>
          <div>
            <p className="text-2xl font-black text-brand-green">{completedOrders.length}</p>
            <p className="text-[11px] text-zinc-500 font-medium">Done</p>
          </div>
          <div>
            <p className="text-2xl font-black text-orange-400">{activeOrders.length}</p>
            <p className="text-[11px] text-zinc-500 font-medium">Remaining</p>
          </div>
        </div>
        {orders.length > 0 && (
          <div className="mt-3">
            <div className="w-full bg-zinc-800 rounded-full h-2.5">
              <div
                className="bg-brand-green h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${orders.length > 0 ? (completedOrders.length / orders.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Date & Refresh */}
      <div className="p-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Today&apos;s Deliveries</h2>
          <p className="text-xs text-zinc-500">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => { if (driver) loadOrders(driver.id); }}
          disabled={isLoading}
          className="p-2.5 bg-zinc-900 rounded-xl active:bg-zinc-800 border border-zinc-800"
        >
          <RefreshCw size={18} className={`text-brand-green ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Orders List */}
      <div className="px-4 pb-8 space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center py-16 gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-brand-green/10 border border-brand-green/30 flex items-center justify-center">
                <Truck className="text-brand-green" size={28} />
              </div>
              <div className="absolute inset-0 rounded-2xl border-2 border-brand-green/30 animate-ping" />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-sm">Loading deliveries...</p>
              <p className="text-zinc-600 text-xs">Fetching from pipeline</p>
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Truck className="text-zinc-600" size={32} />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-sm">No deliveries assigned</p>
              <p className="text-zinc-600 text-xs">Check back later for new assignments</p>
            </div>
          </div>
        ) : (
          <>
            {/* Active Orders */}
            {activeOrders.map((order, idx) => {
              const stageColor = STAGE_COLOR[order.currentStage] || 'bg-zinc-600';
              const stageLabel = STAGE_LABELS[order.currentStage] || order.currentStage;
              const nextAction = getNextDriverStage(order.currentStage);
              const isActive = ['EN_ROUTE', 'ARRIVED_AT_SITE', 'UNLOADING'].includes(order.currentStage);
              return (
                <div
                  key={order.orderId}
                  className={`bg-zinc-900 border rounded-2xl overflow-hidden transition-all ${
                    isActive ? 'border-brand-green/50 ring-1 ring-brand-green/20' : 'border-zinc-800'
                  }`}
                >
                  <button
                    onClick={() => {
                      setSelectedOrder(order);
                      setView('detail');
                      setPendingPhotos([]);
                      setCurrentGPS(null);
                      setGpsStatus('idle');
                    }}
                    className="w-full p-4 text-left active:bg-zinc-800/50"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isActive ? 'bg-brand-green text-black' : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          <span className="text-sm font-black">{idx + 1}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-white text-sm truncate">{order.jobName}</h3>
                          <p className="text-xs text-zinc-500">{order.customerName}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold text-white ${stageColor}`}>
                          {stageLabel}
                        </span>
                        {nextAction && (
                          <span className="text-[10px] text-zinc-500 font-medium">
                            Next: {nextAction.label}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-2 ml-11">
                      <MapPin size={12} />
                      <span className="truncate">{order.deliveryAddress}, {order.deliveryCity}</span>
                    </div>

                    <div className="flex items-center justify-between ml-11">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-zinc-600">
                          <Clock size={12} />
                          {order.scheduledDeliveryTime || 'TBD'}
                        </span>
                        <span className="flex items-center gap-1 text-zinc-600">
                          <Package size={12} />
                          {order.items?.length || 0} items
                        </span>
                        {order.priority !== 'normal' && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            order.priority === 'urgent' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                          }`}>
                            {order.priority.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <ChevronRight size={18} className="text-zinc-700" />
                    </div>

                    {/* Mini pipeline progress */}
                    <div className="mt-3 ml-11 flex gap-0.5">
                      {DRIVER_STAGES.map((stage) => (
                        <div
                          key={stage}
                          className={`h-1.5 flex-1 rounded-full ${
                            isDriverStageComplete(order.currentStage, stage)
                              ? 'bg-brand-green'
                              : order.currentStage === stage
                              ? 'bg-brand-green/40'
                              : 'bg-zinc-800'
                          }`}
                        />
                      ))}
                    </div>
                  </button>

                  {/* Quick Actions Bar */}
                  <div className="border-t border-zinc-800 px-3 py-2 flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); openNavigation(order); }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-brand-green/15 text-brand-green rounded-lg text-xs font-bold active:bg-brand-green/25"
                    >
                      <Navigation size={13} />
                      Navigate
                    </button>
                    {order.customerPhone && (
                      <a
                        href={`tel:${order.customerPhone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 px-3 py-1.5 bg-brand-green/10 text-brand-green rounded-lg text-xs font-bold active:bg-brand-green/20"
                      >
                        <Phone size={13} />
                        Call
                      </a>
                    )}
                    {order.specialInstructions && (
                      <span className="flex items-center gap-1 px-2 py-1.5 text-yellow-400 text-[11px] font-medium">
                        <AlertCircle size={13} />
                        Notes
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Completed Orders */}
            {completedOrders.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-bold text-zinc-500 mb-2 px-1 uppercase tracking-wider">
                  Completed ({completedOrders.length})
                </h3>
                {completedOrders.map(order => {
                  const deliveryEvent = order.events?.find(e => e.stage === 'DELIVERY_CONFIRMED');
                  return (
                    <button
                      key={order.orderId}
                      onClick={() => {
                        setSelectedOrder(order);
                        setView('detail');
                      }}
                      className="w-full bg-zinc-900/40 border border-zinc-800/40 rounded-2xl p-3 text-left mb-2 opacity-50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-brand-green/20 flex items-center justify-center">
                            <CheckCircle2 size={14} className="text-brand-green" />
                          </div>
                          <div>
                            <h3 className="font-medium text-zinc-300 text-sm">{order.jobName}</h3>
                            <p className="text-[11px] text-zinc-600">{order.customerName}</p>
                          </div>
                        </div>
                        {deliveryEvent && (
                          <span className="text-[11px] text-zinc-600">
                            {formatTimeFromISO(deliveryEvent.timestamp)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
