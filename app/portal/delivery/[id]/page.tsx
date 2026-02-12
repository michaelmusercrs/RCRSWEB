'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Truck, MapPin, Phone, Clock, CheckCircle2, Camera, Package,
  Navigation, Loader2, RefreshCw, User, AlertCircle, Play, Flag,
  ClipboardCheck, ImagePlus, ChevronRight, X,
  Upload, CheckSquare, Square, MessageSquare, Route
} from 'lucide-react';
import NavigateButton from '@/components/delivery/NavigateButton';

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
  loadVerifiedAt?: string;
  loadVerifiedBy?: string;
  departedAt?: string;
  arrivedAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  deliveryNotes?: string;
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

const statusConfig: Record<string, { label: string; color: string; next?: string }> = {
  created: { label: 'Created', color: 'bg-white/50', next: 'assigned' },
  assigned: { label: 'Assigned', color: 'bg-cyan-500', next: 'materials_pulled' },
  materials_pulled: { label: 'Materials Pulled', color: 'bg-yellow-500', next: 'load_verified' },
  load_verified: { label: 'Load Verified', color: 'bg-brand-green', next: 'en_route' },
  en_route: { label: 'En Route', color: 'bg-purple-500', next: 'arrived' },
  arrived: { label: 'Arrived', color: 'bg-orange-500', next: 'delivered' },
  delivered: { label: 'Delivered', color: 'bg-teal-500', next: 'proof_captured' },
  picked_up: { label: 'Picked Up', color: 'bg-teal-500', next: 'proof_captured' },
  proof_captured: { label: 'Proof Captured', color: 'bg-brand-green', next: 'qc_photos' },
  qc_photos: { label: 'QC Photos', color: 'bg-pink-500', next: 'completed' },
  completed: { label: 'Completed', color: 'bg-green-500' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500' },
};

const workflowSteps = [
  { status: 'load_verified', label: 'Verify Load', icon: ClipboardCheck, action: 'verify-load' },
  { status: 'en_route', label: 'Start Delivery', icon: Truck, action: 'start-delivery' },
  { status: 'arrived', label: 'Mark Arrived', icon: MapPin, action: 'mark-arrived' },
  { status: 'delivered', label: 'Complete Delivery', icon: Package, action: 'complete-delivery' },
  { status: 'proof_captured', label: 'Take Photos', icon: Camera, action: 'capture-proof' },
  { status: 'qc_photos', label: 'QC Photos', icon: Camera, action: 'upload-qc' },
  { status: 'completed', label: 'Complete', icon: CheckCircle2, action: 'complete-ticket' },
];

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

  const handleWorkflowAction = async (action: string) => {
    if (!ticket || !driver) return;
    setIsUpdating(true);

    try {
      let body: Record<string, unknown> = {
        action,
        ticketId: ticket.ticketId,
      };

      // Add action-specific data
      if (action === 'verify-load') {
        body.verifiedBy = driver.name;
        if (navigator.geolocation) {
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
            });
            body.gpsLocation = `${pos.coords.latitude},${pos.coords.longitude}`;
          } catch {}
        }
      }

      if (action === 'mark-arrived') {
        if (navigator.geolocation) {
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
            });
            body.gpsLocation = `${pos.coords.latitude},${pos.coords.longitude}`;
          } catch {}
        }
      }

      if (action === 'complete-delivery') {
        body.notes = deliveryNotes;
      }

      const response = await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success && result.ticket) {
        setTicket(result.ticket);
        setDeliveryNotes('');

        if (action === 'complete-ticket') {
          router.push('/portal/delivery');
        }
      }
    } catch (error) {
      console.error('Error updating ticket:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const getCurrentStepIndex = (status: string): number => {
    const stepStatuses = workflowSteps.map(s => s.status);
    if (status === 'materials_pulled') return 0;
    const idx = stepStatuses.indexOf(status);
    return idx >= 0 ? idx : -1;
  };

  const getNextAction = (status: string): typeof workflowSteps[0] | null => {
    const currentIdx = getCurrentStepIndex(status);
    if (currentIdx < 0) return null;
    if (status === 'materials_pulled') return workflowSteps[0];
    if (currentIdx < workflowSteps.length - 1) return workflowSteps[currentIdx + 1];
    return null;
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
          <button
            onClick={() => router.push('/portal/delivery')}
            className="mt-4 px-4 py-2 bg-brand-green text-black rounded-lg"
          >
            Back to Deliveries
          </button>
        </div>
      </div>
    );
  }

  const config = statusConfig[ticket.status] || { label: ticket.status, color: 'bg-white/50' };
  const nextAction = getNextAction(ticket.status);

  // Notes View
  if (view === 'notes') {
    return (
      <div className="min-h-screen bg-neutral-900">
        <div className="bg-neutral-800 border-b border-neutral-700 p-4">
          <button
            onClick={() => setView('detail')}
            className="flex items-center gap-2 text-neutral-400 hover:text-white"
          >
            <ArrowLeft size={20} />
            Back to Delivery
          </button>
        </div>

        <div className="p-4 space-y-6">
          <div className="text-center">
            <MessageSquare className="mx-auto text-brand-green mb-4" size={48} />
            <h2 className="text-xl font-bold text-white">Delivery Notes</h2>
            <p className="text-neutral-400 mt-2">Add any notes about this delivery</p>
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
            onClick={() => {
              handleWorkflowAction('complete-delivery');
              setView('detail');
            }}
            disabled={isUpdating}
            className="w-full bg-brand-green hover:bg-lime-400 disabled:bg-neutral-700 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2"
          >
            {isUpdating ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
            Save Notes
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
          <button
            onClick={() => setView('detail')}
            className="flex items-center gap-2 text-neutral-400 hover:text-white"
          >
            <ArrowLeft size={20} />
            Back to Delivery
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
                <p className={`font-medium ${item.completedAt ? 'text-green-400' : 'text-white'}`}>
                  {item.description}
                </p>
                {item.completedAt && (
                  <p className="text-neutral-500 text-xs mt-1">
                    Completed {new Date(item.completedAt).toLocaleString()} by {item.completedBy}
                  </p>
                )}
                {item.required && !item.completedAt && (
                  <span className="text-red-400 text-xs">Required</span>
                )}
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
    <div className="min-h-screen bg-neutral-900 pb-24">
      {/* Header */}
      <div className="bg-neutral-800 border-b border-neutral-700 p-4 sticky top-0 z-10">
        <button
          onClick={() => router.push('/portal/delivery')}
          className="flex items-center gap-2 text-neutral-400 hover:text-white mb-3"
        >
          <ArrowLeft size={20} />
          Back to Deliveries
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">{ticket.jobName}</h1>
            <p className="text-sm text-neutral-400">{ticket.ticketId}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${config.color}`}>
            {config.label}
          </span>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-neutral-800 border-b border-neutral-700 p-4 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {workflowSteps.map((step, idx) => {
            const currentIdx = getCurrentStepIndex(ticket.status);
            const isCompleted = ticket.status === 'materials_pulled' ? idx < 0 : idx <= currentIdx;
            const isCurrent = ticket.status === step.status ||
              (ticket.status === 'materials_pulled' && idx === 0);

            return (
              <div
                key={step.status}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                  isCompleted ? 'bg-green-500/20 text-green-400' :
                  isCurrent ? 'bg-brand-green/20 text-brand-green' :
                  'bg-neutral-700 text-neutral-500'
                }`}
              >
                <step.icon size={16} />
                <span className="text-xs font-medium whitespace-nowrap">{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 space-y-4">
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
            <Phone size={20} />
            Call Customer
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
            <a
              href={`tel:${ticket.customerPhone}`}
              className="flex items-center gap-3 text-brand-green"
            >
              <Phone size={18} />
              {ticket.customerPhone}
            </a>
            {ticket.customerEmail && (
              <div className="flex items-center gap-3 text-neutral-400 text-sm">
                {ticket.customerEmail}
              </div>
            )}
          </div>
        </div>

        {/* Address */}
        <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
          <h3 className="font-semibold text-white mb-3">Delivery Address</h3>
          <div className="flex items-start gap-3">
            <MapPin size={18} className="text-neutral-500 mt-0.5" />
            <div>
              <p className="text-neutral-300">{ticket.jobAddress}</p>
              <p className="text-neutral-400 text-sm">
                {ticket.city}, {ticket.state} {ticket.zip}
              </p>
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
                <div className="text-right">
                  <p className="text-white font-medium">{item.quantity} {item.unit}</p>
                </div>
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

        {/* Timeline */}
        <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
          <h3 className="font-semibold text-white mb-3">Timeline</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-400">Scheduled</span>
              <span className="text-white">{ticket.scheduledTime || ticket.scheduledDate || 'TBD'}</span>
            </div>
            {ticket.loadVerifiedAt && (
              <div className="flex justify-between">
                <span className="text-neutral-400">Load Verified</span>
                <span className="text-white">{new Date(ticket.loadVerifiedAt).toLocaleTimeString()}</span>
              </div>
            )}
            {ticket.departedAt && (
              <div className="flex justify-between">
                <span className="text-neutral-400">Departed</span>
                <span className="text-white">{new Date(ticket.departedAt).toLocaleTimeString()}</span>
              </div>
            )}
            {ticket.arrivedAt && (
              <div className="flex justify-between">
                <span className="text-neutral-400">Arrived</span>
                <span className="text-white">{new Date(ticket.arrivedAt).toLocaleTimeString()}</span>
              </div>
            )}
            {ticket.deliveredAt && (
              <div className="flex justify-between">
                <span className="text-neutral-400">Delivered</span>
                <span className="text-white">{new Date(ticket.deliveredAt).toLocaleTimeString()}</span>
              </div>
            )}
            {ticket.completedAt && (
              <div className="flex justify-between">
                <span className="text-neutral-400">Completed</span>
                <span className="text-white">{new Date(ticket.completedAt).toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setView('checklist')}
            className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-center hover:bg-neutral-700"
          >
            <ClipboardCheck className="mx-auto text-blue-400 mb-2" size={24} />
            <span className="text-white text-sm">Checklist</span>
            <span className="text-neutral-500 text-xs block">{checklist.filter(c => c.completedAt).length}/{checklist.length} done</span>
          </button>
          <button
            onClick={() => setView('notes')}
            className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-center hover:bg-neutral-700"
          >
            <MessageSquare className="mx-auto text-purple-400 mb-2" size={24} />
            <span className="text-white text-sm">Notes</span>
            <span className="text-neutral-500 text-xs block">{ticket.deliveryNotes ? 'Has notes' : 'Add notes'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-center hover:bg-neutral-700"
          >
            <Camera className="mx-auto text-brand-green mb-2" size={24} />
            <span className="text-white text-sm">Take Photo</span>
            <span className="text-neutral-500 text-xs block">{ticket.photoCount} uploaded</span>
          </button>
          <button
            onClick={() => router.push('/portal/delivery/route')}
            className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-center hover:bg-neutral-700"
          >
            <Route className="mx-auto text-orange-400 mb-2" size={24} />
            <span className="text-white text-sm">View Route</span>
            <span className="text-neutral-500 text-xs block">Plan deliveries</span>
          </button>
        </div>
      </div>

      {/* Fixed Bottom Action */}
      {nextAction && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-neutral-900 border-t border-neutral-700 safe-area-pb">
          <button
            onClick={() => handleWorkflowAction(nextAction.action)}
            disabled={isUpdating}
            className={`w-full font-bold py-4 rounded-xl flex items-center justify-center gap-2 ${
              nextAction.status === 'completed'
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-brand-green hover:bg-lime-400 text-black'
            } disabled:bg-neutral-700 disabled:text-neutral-500`}
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
    </div>
  );
}
