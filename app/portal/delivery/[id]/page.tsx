'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Truck, MapPin, Phone, Clock, CheckCircle2, Camera, Package,
  Navigation, Loader2, RefreshCw, User, AlertCircle, Play, Flag,
  ClipboardCheck, ImagePlus, ChevronRight, X,
  Upload, CheckSquare, Square, MessageSquare, Route, MapPinned
} from 'lucide-react';
import NavigateButton from '@/components/delivery/NavigateButton';
import DeliveryPipeline from '@/components/delivery/DeliveryPipeline';
import { DeliveryStage, getStageConfig, getNextStage } from '@/lib/delivery-pipeline';

interface MaterialItem {
  productId: string;
  productName: string;
  sku?: string;
  quantity: number;
  unit: string;
}

interface DeliveryTicket {
  ticketId: string;
  ticketType: string;
  status: string;
  pipelineStage: DeliveryStage;
  jobName: string;
  jobAddress: string;
  city: string;
  state: string;
  zip: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  projectManager?: string;
  pmPhone?: string;
  materials: MaterialItem[];
  priority: 'normal' | 'rush' | 'urgent';
  scheduledDate?: string;
  scheduledTime?: string;
  specialInstructions?: string;
  photoCount: number;
  stageTimestamps: Partial<Record<DeliveryStage, string>>;
  stagePhotos: Partial<Record<DeliveryStage, number>>;
  gpsLocations: Partial<Record<DeliveryStage, string>>;
  deliveryNotes?: string;
  assignedDriver?: string;
  assignedVehicle?: string;
}

interface ChecklistItem {
  checklistId: string;
  ticketId: string;
  step: string;
  description: string;
  required: boolean;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
}

interface Driver {
  id: string;
  name: string;
  vehicle: string;
  phone: string;
}

// Map old statuses to pipeline stages for backward compat
function mapStatusToStage(status: string, pipelineStage?: DeliveryStage): DeliveryStage {
  if (pipelineStage) return pipelineStage;
  const mapping: Record<string, DeliveryStage> = {
    created: 'ORDER_CREATED',
    assigned: 'DRIVER_ASSIGNED',
    materials_pulled: 'MATERIALS_PULLED',
    load_verified: 'LOAD_VERIFIED',
    en_route: 'EN_ROUTE',
    arrived: 'ARRIVED_AT_SITE',
    delivered: 'DELIVERY_CONFIRMED',
    picked_up: 'DELIVERY_CONFIRMED',
    proof_captured: 'QC_PHOTOS',
    qc_photos: 'QC_PHOTOS',
    completed: 'JOB_CLOSED',
    cancelled: 'ORDER_CREATED',
  };
  return mapping[status] || 'ORDER_CREATED';
}

export default function DeliveryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const ticketId = params.id as string;

  const [driver, setDriver] = useState<Driver | null>(null);
  const [ticket, setTicket] = useState<DeliveryTicket | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [view, setView] = useState<'detail' | 'checklist' | 'photos' | 'notes'>('detail');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);

  useEffect(() => {
    const storedDriver = sessionStorage.getItem('driver');
    if (!storedDriver) {
      router.push('/portal');
      return;
    }
    setDriver(JSON.parse(storedDriver));
    loadTicketDetails();
  }, [router, ticketId]);

  const loadTicketDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const [ticketRes, checklistRes] = await Promise.all([
        fetch(`/api/portal/tickets?ticketId=${ticketId}`),
        fetch(`/api/portal/tickets/checklist?ticketId=${ticketId}`),
      ]);

      if (ticketRes.ok) {
        const ticketData = await ticketRes.json();
        // Ensure pipeline stage exists
        if (!ticketData.pipelineStage) {
          ticketData.pipelineStage = mapStatusToStage(ticketData.status);
        }
        if (!ticketData.stageTimestamps) ticketData.stageTimestamps = {};
        if (!ticketData.stagePhotos) ticketData.stagePhotos = {};
        if (!ticketData.gpsLocations) ticketData.gpsLocations = {};
        setTicket(ticketData);
        setDeliveryNotes(ticketData.deliveryNotes || '');
      }

      if (checklistRes.ok) {
        const checklistData = await checklistRes.json();
        setChecklist(Array.isArray(checklistData) ? checklistData : []);
      }
    } catch (error) {
      console.error('Error loading ticket details:', error);
    } finally {
      setIsLoading(false);
    }
  }, [ticketId]);

  const captureGPS = async (): Promise<string | null> => {
    if (!navigator.geolocation) return null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, enableHighAccuracy: true });
      });
      return `${pos.coords.latitude},${pos.coords.longitude}`;
    } catch {
      return null;
    }
  };

  const handleAdvanceStage = async (nextStage: DeliveryStage) => {
    if (!ticket || !driver) return;
    setIsUpdating(true);

    try {
      const stageConfig = getStageConfig(nextStage);
      const body: Record<string, unknown> = {
        action: 'advance-pipeline',
        ticketId: ticket.ticketId,
        nextStage,
        driverName: driver.name,
      };

      // Capture GPS if required
      if (stageConfig.requiresGPS) {
        const gps = await captureGPS();
        if (gps) body.gpsLocation = gps;
      }

      // Photo check - stage requires photo but none uploaded yet
      if (stageConfig.requiresPhoto && !(ticket.stagePhotos[ticket.pipelineStage] ?? 0)) {
        // Allow advance but flag it
        body.photoMissing = true;
      }

      if (deliveryNotes.trim()) {
        body.notes = deliveryNotes;
      }

      const response = await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success && result.ticket) {
        if (!result.ticket.pipelineStage) {
          result.ticket.pipelineStage = nextStage;
        }
        if (!result.ticket.stageTimestamps) result.ticket.stageTimestamps = {};
        if (!result.ticket.stagePhotos) result.ticket.stagePhotos = {};
        if (!result.ticket.gpsLocations) result.ticket.gpsLocations = {};
        setTicket(result.ticket);
        setDeliveryNotes('');

        if (nextStage === 'JOB_CLOSED') {
          router.push('/portal/delivery');
        }
      }
    } catch (error) {
      console.error('Error advancing pipeline:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePhotoUpload = async () => {
    if (!ticket) return;
    setPhotoUploading(true);
    // Simulate photo upload - in production this would use camera API
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) { setPhotoUploading(false); return; }

        const formData = new FormData();
        formData.append('photo', file);
        formData.append('ticketId', ticket.ticketId);
        formData.append('stage', ticket.pipelineStage);

        try {
          const gps = await captureGPS();
          if (gps) formData.append('gpsLocation', gps);

          const res = await fetch('/api/portal/delivery/photos', {
            method: 'POST',
            body: formData,
          });
          if (res.ok) {
            // Update local photo count
            setTicket(prev => {
              if (!prev) return prev;
              const newPhotos = { ...prev.stagePhotos };
              newPhotos[prev.pipelineStage] = (newPhotos[prev.pipelineStage] ?? 0) + 1;
              return { ...prev, stagePhotos: newPhotos, photoCount: prev.photoCount + 1 };
            });
          }
        } catch {
          console.error('Photo upload failed');
        } finally {
          setPhotoUploading(false);
        }
      };
      input.click();
    } catch {
      setPhotoUploading(false);
    }
  };

  if (!driver || isLoading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-green" size={48} />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto text-red-500" size={48} />
          <p className="text-white mt-4">Delivery not found</p>
          <button onClick={() => router.push('/portal/delivery')} className="mt-4 px-4 py-2 bg-brand-green text-black rounded-lg">
            Back to Deliveries
          </button>
        </div>
      </div>
    );
  }

  const currentStage = ticket.pipelineStage;
  const stageConfig = getStageConfig(currentStage);
  const nextStage = getNextStage(currentStage);

  // Notes View
  if (view === 'notes') {
    return (
      <div className="min-h-screen bg-neutral-900">
        <div className="bg-neutral-800 border-b border-neutral-700 p-4">
          <button onClick={() => setView('detail')} className="flex items-center gap-2 text-neutral-400 hover:text-white">
            <ArrowLeft size={20} /> Back to Delivery
          </button>
        </div>
        <div className="p-4 space-y-6">
          <div className="text-center">
            <MessageSquare className="mx-auto text-brand-green mb-4" size={48} />
            <h2 className="text-xl font-bold text-white">Delivery Notes</h2>
          </div>
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
            <textarea
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="Enter delivery notes..."
              rows={6}
              className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-4 py-3 text-white resize-none"
            />
          </div>
          <button
            onClick={() => setView('detail')}
            className="w-full bg-brand-green hover:bg-lime-400 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={20} /> Save Notes
          </button>
        </div>
      </div>
    );
  }

  // Checklist View
  if (view === 'checklist') {
    return (
      <div className="min-h-screen bg-neutral-900">
        <div className="bg-neutral-800 border-b border-neutral-700 p-4">
          <button onClick={() => setView('detail')} className="flex items-center gap-2 text-neutral-400 hover:text-white">
            <ArrowLeft size={20} /> Back to Delivery
          </button>
          <h1 className="text-lg font-bold text-white mt-3">Delivery Checklist</h1>
        </div>
        <div className="p-4 space-y-2">
          {checklist.map(item => (
            <div
              key={item.checklistId}
              className={`bg-neutral-800 border rounded-xl p-4 flex items-start gap-3 ${
                item.completedAt ? 'border-green-500/50' : 'border-neutral-700'
              }`}
            >
              {item.completedAt ? (
                <CheckSquare className="text-green-500 flex-shrink-0 mt-0.5" size={20} />
              ) : (
                <Square className="text-neutral-500 flex-shrink-0 mt-0.5" size={20} />
              )}
              <div className="flex-1">
                <p className={`font-medium ${item.completedAt ? 'text-green-400' : 'text-white'}`}>{item.description}</p>
                {item.completedAt && (
                  <p className="text-neutral-500 text-xs mt-1">
                    Completed {new Date(item.completedAt).toLocaleString()} by {item.completedBy}
                  </p>
                )}
                {item.required && !item.completedAt && <span className="text-red-400 text-xs">Required</span>}
              </div>
            </div>
          ))}
          {checklist.length === 0 && (
            <div className="text-center py-12">
              <ClipboardCheck className="mx-auto text-neutral-600" size={48} />
              <p className="text-neutral-400 mt-4">No checklist items</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main Detail View
  return (
    <div className="min-h-screen bg-neutral-900 pb-28">
      {/* Header */}
      <div className="bg-neutral-800 border-b border-neutral-700 p-4 sticky top-0 z-10">
        <button onClick={() => router.push('/portal/delivery')} className="flex items-center gap-2 text-neutral-400 hover:text-white mb-3">
          <ArrowLeft size={20} /> Back to Deliveries
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">{ticket.jobName}</h1>
            <p className="text-sm text-neutral-400">{ticket.ticketId}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${stageConfig.bgColor} ${stageConfig.color} border ${stageConfig.borderColor}`}>
            {stageConfig.shortLabel}
          </span>
        </div>
      </div>

      {/* 18-Stage Pipeline Tracker */}
      <div className="bg-neutral-800/50 border-b border-neutral-700 p-4">
        <DeliveryPipeline
          currentStage={currentStage}
          onAdvance={handleAdvanceStage}
          compact={true}
          timestamps={ticket.stageTimestamps}
          photos={ticket.stagePhotos}
        />
      </div>

      <div className="p-4 space-y-4">
        {/* Photo Requirements Banner */}
        {stageConfig.requiresPhoto && (
          <div className={`rounded-xl border-2 p-4 ${
            (ticket.stagePhotos[currentStage] ?? 0) > 0
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-amber-500/10 border-amber-500/30 animate-pulse'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Camera size={24} className={
                  (ticket.stagePhotos[currentStage] ?? 0) > 0 ? 'text-green-400' : 'text-amber-400'
                } />
                <div>
                  <p className={`font-bold text-sm ${
                    (ticket.stagePhotos[currentStage] ?? 0) > 0 ? 'text-green-400' : 'text-amber-400'
                  }`}>
                    {(ticket.stagePhotos[currentStage] ?? 0) > 0
                      ? `${ticket.stagePhotos[currentStage]} photo(s) uploaded`
                      : 'Photo required for this step'}
                  </p>
                  <p className="text-xs text-neutral-500">{stageConfig.description}</p>
                </div>
              </div>
              <button
                onClick={handlePhotoUpload}
                disabled={photoUploading}
                className="px-4 py-2 bg-brand-green text-black rounded-lg font-bold text-sm hover:brightness-90 disabled:opacity-50 flex items-center gap-2"
              >
                {photoUploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                {photoUploading ? 'Uploading...' : 'Take Photo'}
              </button>
            </div>
          </div>
        )}

        {/* GPS Banner */}
        {stageConfig.requiresGPS && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 flex items-center gap-3">
            <MapPinned size={20} className="text-blue-400" />
            <div>
              <p className="text-blue-400 text-sm font-medium">GPS will be captured automatically</p>
              {ticket.gpsLocations[currentStage] && (
                <p className="text-xs text-blue-400/60">
                  Last: {ticket.gpsLocations[currentStage]}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <NavigateButton
            address={ticket.jobAddress}
            city={ticket.city}
            state={ticket.state}
            zip={ticket.zip}
            size="lg"
            fullWidth
          />
          <a
            href={`tel:${ticket.customerPhone}`}
            className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
          >
            <Phone size={20} /> Call Customer
          </a>
        </div>

        {/* Customer Info */}
        <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
          <h3 className="font-semibold text-white mb-3">Customer</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-neutral-300">
              <User size={18} className="text-neutral-500" />
              {ticket.customerName}
            </div>
            <a href={`tel:${ticket.customerPhone}`} className="flex items-center gap-3 text-brand-green">
              <Phone size={18} /> {ticket.customerPhone}
            </a>
          </div>
        </div>

        {/* Address */}
        <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
          <h3 className="font-semibold text-white mb-3">Delivery Address</h3>
          <div className="flex items-start gap-3">
            <MapPin size={18} className="text-neutral-500 mt-0.5" />
            <div>
              <p className="text-neutral-300">{ticket.jobAddress}</p>
              <p className="text-neutral-400 text-sm">{ticket.city}, {ticket.state} {ticket.zip}</p>
            </div>
          </div>
        </div>

        {/* Materials */}
        <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
          <h3 className="font-semibold text-white mb-3">Materials ({ticket.materials?.length || 0} items)</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {ticket.materials?.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center py-2 border-b border-neutral-700 last:border-0">
                <div>
                  <p className="text-white text-sm">{item.productName}</p>
                  {item.sku && <p className="text-neutral-500 text-xs">{item.sku}</p>}
                </div>
                <p className="text-white font-medium">{item.quantity} {item.unit}</p>
              </div>
            ))}
            {(!ticket.materials || ticket.materials.length === 0) && (
              <p className="text-neutral-500 text-sm">No materials listed</p>
            )}
          </div>
          {ticket.specialInstructions && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-400 text-sm font-medium">Special Instructions</p>
              <p className="text-yellow-200 text-sm mt-1">{ticket.specialInstructions}</p>
            </div>
          )}
        </div>

        {/* Full Pipeline Detail View */}
        <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
          <h3 className="font-semibold text-white mb-3">Delivery Pipeline</h3>
          <DeliveryPipeline
            currentStage={currentStage}
            onAdvance={handleAdvanceStage}
            compact={false}
            showDetails={true}
            timestamps={ticket.stageTimestamps}
            photos={ticket.stagePhotos}
          />
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setView('checklist')} className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-center hover:bg-neutral-700">
            <ClipboardCheck className="mx-auto text-blue-400 mb-2" size={24} />
            <span className="text-white text-sm">Checklist</span>
            <span className="text-neutral-500 text-xs block">{checklist.filter(c => c.completedAt).length}/{checklist.length} done</span>
          </button>
          <button onClick={() => setView('notes')} className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-center hover:bg-neutral-700">
            <MessageSquare className="mx-auto text-purple-400 mb-2" size={24} />
            <span className="text-white text-sm">Notes</span>
            <span className="text-neutral-500 text-xs block">{ticket.deliveryNotes ? 'Has notes' : 'Add notes'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={handlePhotoUpload} disabled={photoUploading} className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-center hover:bg-neutral-700">
            <Camera className="mx-auto text-brand-green mb-2" size={24} />
            <span className="text-white text-sm">Take Photo</span>
            <span className="text-neutral-500 text-xs block">{ticket.photoCount} uploaded</span>
          </button>
          <button onClick={() => router.push('/portal/delivery/route')} className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-center hover:bg-neutral-700">
            <Route className="mx-auto text-orange-400 mb-2" size={24} />
            <span className="text-white text-sm">View Route</span>
            <span className="text-neutral-500 text-xs block">Plan deliveries</span>
          </button>
        </div>
      </div>

      {/* Fixed Bottom Action */}
      {nextStage && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-neutral-900 border-t border-neutral-700 safe-area-pb">
          <button
            onClick={() => handleAdvanceStage(nextStage)}
            disabled={isUpdating}
            className={`w-full font-bold py-4 rounded-xl flex items-center justify-center gap-2 ${
              nextStage === 'JOB_CLOSED'
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-brand-green hover:bg-lime-400 text-black'
            } disabled:bg-neutral-700 disabled:text-neutral-500`}
          >
            {isUpdating ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <ChevronRight size={20} />
            )}
            {getStageConfig(nextStage).actionLabel}
            {getStageConfig(currentStage).requiresPhoto && !(ticket.stagePhotos[currentStage] ?? 0) && (
              <span className="text-xs opacity-70 ml-2">(photo recommended)</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
