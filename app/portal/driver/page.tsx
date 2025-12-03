'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Truck, MapPin, Phone, Clock, CheckCircle2, Camera, Package,
  Navigation, ArrowLeft, Loader2, RefreshCw, User, AlertCircle,
  ClipboardCheck, ImagePlus, FileSignature, ChevronRight, X,
  Upload, CheckSquare, Square
} from 'lucide-react';
import type { DeliveryTicket, TicketStatus, ChecklistItem, TicketPhoto } from '@/lib/delivery-workflow-service';
import type { Driver } from '@/lib/delivery-portal-service';

const statusConfig: Record<TicketStatus, { label: string; color: string; next?: TicketStatus }> = {
  created: { label: 'Created', color: 'bg-gray-500', next: 'assigned' },
  assigned: { label: 'Assigned', color: 'bg-cyan-500', next: 'materials_pulled' },
  materials_pulled: { label: 'Materials Pulled', color: 'bg-yellow-500', next: 'load_verified' },
  load_verified: { label: 'Load Verified', color: 'bg-blue-500', next: 'en_route' },
  en_route: { label: 'En Route', color: 'bg-purple-500', next: 'arrived' },
  arrived: { label: 'Arrived', color: 'bg-orange-500', next: 'delivered' },
  delivered: { label: 'Delivered', color: 'bg-teal-500', next: 'proof_captured' },
  picked_up: { label: 'Picked Up', color: 'bg-teal-500', next: 'proof_captured' },
  proof_captured: { label: 'Proof Captured', color: 'bg-indigo-500', next: 'qc_photos' },
  qc_photos: { label: 'QC Photos', color: 'bg-pink-500', next: 'completed' },
  completed: { label: 'Completed', color: 'bg-green-500' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500' },
};

const workflowSteps = [
  { status: 'load_verified', label: 'Verify Load', icon: ClipboardCheck, action: 'verify-load' },
  { status: 'en_route', label: 'Start Delivery', icon: Truck, action: 'start-delivery' },
  { status: 'arrived', label: 'Mark Arrived', icon: MapPin, action: 'mark-arrived' },
  { status: 'delivered', label: 'Complete Delivery', icon: Package, action: 'complete-delivery' },
  { status: 'proof_captured', label: 'Capture Proof', icon: FileSignature, action: 'capture-proof' },
  { status: 'qc_photos', label: 'QC Photos', icon: Camera, action: 'upload-qc' },
  { status: 'completed', label: 'Complete', icon: CheckCircle2, action: 'complete-ticket' },
];

export default function DriverPortal() {
  const router = useRouter();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [tickets, setTickets] = useState<DeliveryTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<DeliveryTicket | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [photos, setPhotos] = useState<TicketPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [view, setView] = useState<'list' | 'detail' | 'checklist' | 'photos' | 'signature'>('list');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [signedBy, setSignedBy] = useState('');

  useEffect(() => {
    const storedDriver = sessionStorage.getItem('driver');
    if (!storedDriver) {
      router.push('/portal');
      return;
    }
    setDriver(JSON.parse(storedDriver));
    loadTickets(JSON.parse(storedDriver).id);
  }, [router]);

  const loadTickets = async (driverId: string) => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const response = await fetch(`/api/portal/tickets?driverId=${driverId}&date=${today}`);
      const data = await response.json();
      setTickets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading tickets:', error);
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTicketDetails = useCallback(async (ticketId: string) => {
    try {
      const [ticketRes, checklistRes, photosRes] = await Promise.all([
        fetch(`/api/portal/tickets?ticketId=${ticketId}`),
        fetch(`/api/portal/tickets/checklist?ticketId=${ticketId}`),
        fetch(`/api/portal/tickets/photos?ticketId=${ticketId}`),
      ]);

      const ticket = await ticketRes.json();
      setSelectedTicket(ticket);

      if (checklistRes.ok) {
        const checklistData = await checklistRes.json();
        setChecklist(Array.isArray(checklistData) ? checklistData : []);
      }

      if (photosRes.ok) {
        const photosData = await photosRes.json();
        setPhotos(Array.isArray(photosData) ? photosData : []);
      }
    } catch (error) {
      console.error('Error loading ticket details:', error);
    }
  }, []);

  const handleWorkflowAction = async (action: string) => {
    if (!selectedTicket || !driver) return;
    setIsUpdating(true);

    try {
      let body: Record<string, unknown> = {
        action,
        ticketId: selectedTicket.ticketId,
      };

      // Add action-specific data
      if (action === 'verify-load') {
        body.verifiedBy = driver.name;
        // Try to get GPS
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

      if (action === 'capture-proof') {
        body.signedBy = signedBy;
        // In a real app, you'd capture actual signature data
        body.signature = `Signed by ${signedBy} on ${new Date().toLocaleString()}`;
      }

      const response = await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success && result.ticket) {
        setSelectedTicket(result.ticket);
        await loadTickets(driver.id);

        // Reset form fields
        setDeliveryNotes('');
        setSignedBy('');

        // If completed, go back to list
        if (action === 'complete-ticket') {
          setView('list');
          setSelectedTicket(null);
        }
      }
    } catch (error) {
      console.error('Error updating ticket:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const getCurrentStepIndex = (status: TicketStatus): number => {
    const stepStatuses = workflowSteps.map(s => s.status);
    // Materials pulled allows starting at verify load
    if (status === 'materials_pulled') return 0;
    const idx = stepStatuses.indexOf(status);
    return idx >= 0 ? idx : -1;
  };

  const getNextAction = (status: TicketStatus): typeof workflowSteps[0] | null => {
    const currentIdx = getCurrentStepIndex(status);
    if (currentIdx < 0) return null;
    if (status === 'materials_pulled') return workflowSteps[0];
    if (currentIdx < workflowSteps.length - 1) return workflowSteps[currentIdx + 1];
    return null;
  };

  const openNavigation = (ticket: DeliveryTicket) => {
    const address = `${ticket.jobAddress}, ${ticket.city}, ${ticket.state} ${ticket.zip}`;
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('driver');
    router.push('/portal');
  };

  if (!driver) return null;

  // Signature Capture View
  if (view === 'signature' && selectedTicket) {
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
            <FileSignature className="mx-auto text-brand-green mb-4" size={48} />
            <h2 className="text-xl font-bold text-white">Capture Proof of Delivery</h2>
            <p className="text-neutral-400 mt-2">Enter the name of person accepting delivery</p>
          </div>

          <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
            <label className="block text-sm text-neutral-400 mb-2">Received By</label>
            <input
              type="text"
              value={signedBy}
              onChange={(e) => setSignedBy(e.target.value)}
              placeholder="Enter name"
              className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-4 py-3 text-white"
            />
          </div>

          <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
            <p className="text-sm text-neutral-400 mb-2">Signature Area</p>
            <div className="w-full h-40 bg-white rounded-lg border-2 border-dashed border-neutral-400 flex items-center justify-center">
              <p className="text-neutral-500">Tap to sign (coming soon)</p>
            </div>
          </div>

          <button
            onClick={() => handleWorkflowAction('capture-proof')}
            disabled={!signedBy || isUpdating}
            className="w-full bg-brand-green hover:bg-lime-400 disabled:bg-neutral-700 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2"
          >
            {isUpdating ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
            Confirm Proof of Delivery
          </button>
        </div>
      </div>
    );
  }

  // Ticket Detail View
  if (view === 'detail' && selectedTicket) {
    const nextAction = getNextAction(selectedTicket.status);
    const config = statusConfig[selectedTicket.status];

    return (
      <div className="min-h-screen bg-neutral-900 pb-24">
        {/* Header */}
        <div className="bg-neutral-800 border-b border-neutral-700 p-4">
          <button
            onClick={() => { setView('list'); setSelectedTicket(null); }}
            className="flex items-center gap-2 text-neutral-400 hover:text-white mb-3"
          >
            <ArrowLeft size={20} />
            Back to List
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-white">{selectedTicket.jobName}</h1>
              <p className="text-sm text-neutral-400">{selectedTicket.ticketId}</p>
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
              const currentIdx = getCurrentStepIndex(selectedTicket.status);
              const isCompleted = selectedTicket.status === 'materials_pulled' ? idx < 0 : idx <= currentIdx;
              const isCurrent = selectedTicket.status === step.status ||
                (selectedTicket.status === 'materials_pulled' && idx === 0);

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
          {/* Customer Info */}
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
            <h3 className="font-semibold text-white mb-3">Customer</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-neutral-300">
                <User size={18} className="text-neutral-500" />
                {selectedTicket.customerName}
              </div>
              <a
                href={`tel:${selectedTicket.customerPhone}`}
                className="flex items-center gap-3 text-brand-green"
              >
                <Phone size={18} />
                {selectedTicket.customerPhone}
              </a>
            </div>
          </div>

          {/* Address & Navigation */}
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
            <h3 className="font-semibold text-white mb-3">Delivery Address</h3>
            <p className="text-neutral-300 mb-1">{selectedTicket.jobAddress}</p>
            <p className="text-neutral-400 text-sm mb-4">
              {selectedTicket.city}, {selectedTicket.state} {selectedTicket.zip}
            </p>
            <button
              onClick={() => openNavigation(selectedTicket)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
            >
              <Navigation size={20} />
              Navigate
            </button>
          </div>

          {/* Materials */}
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
            <h3 className="font-semibold text-white mb-3">Materials ({selectedTicket.materials?.length || 0} items)</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {selectedTicket.materials?.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b border-neutral-700 last:border-0">
                  <div>
                    <p className="text-white text-sm">{item.productName}</p>
                    <p className="text-neutral-500 text-xs">{item.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">{item.quantity} {item.unit}</p>
                  </div>
                </div>
              ))}
            </div>
            {selectedTicket.specialInstructions && (
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-400 text-sm font-medium">Special Instructions</p>
                <p className="text-yellow-200 text-sm mt-1">{selectedTicket.specialInstructions}</p>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
            <h3 className="font-semibold text-white mb-3">Timeline</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-400">Scheduled</span>
                <span className="text-white">{selectedTicket.scheduledTime || 'TBD'}</span>
              </div>
              {selectedTicket.loadVerifiedAt && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">Load Verified</span>
                  <span className="text-white">{new Date(selectedTicket.loadVerifiedAt).toLocaleTimeString()}</span>
                </div>
              )}
              {selectedTicket.departedAt && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">Departed</span>
                  <span className="text-white">{new Date(selectedTicket.departedAt).toLocaleTimeString()}</span>
                </div>
              )}
              {selectedTicket.arrivedAt && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">Arrived</span>
                  <span className="text-white">{new Date(selectedTicket.arrivedAt).toLocaleTimeString()}</span>
                </div>
              )}
              {selectedTicket.deliveredAt && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">Delivered</span>
                  <span className="text-white">{new Date(selectedTicket.deliveredAt).toLocaleTimeString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Delivery Notes (for complete-delivery step) */}
          {selectedTicket.status === 'arrived' && (
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
              <h3 className="font-semibold text-white mb-3">Delivery Notes</h3>
              <textarea
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Add any notes about the delivery..."
                rows={3}
                className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-4 py-3 text-white resize-none"
              />
            </div>
          )}

          {/* Photo Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-center hover:bg-neutral-700"
            >
              <Camera className="mx-auto text-brand-green mb-2" size={24} />
              <span className="text-white text-sm">Take Photo</span>
              <span className="text-neutral-500 text-xs block">{selectedTicket.photoCount} uploaded</span>
            </button>
            <button
              onClick={() => setView('checklist')}
              className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-center hover:bg-neutral-700"
            >
              <ClipboardCheck className="mx-auto text-blue-400 mb-2" size={24} />
              <span className="text-white text-sm">Checklist</span>
              <span className="text-neutral-500 text-xs block">View all steps</span>
            </button>
          </div>
        </div>

        {/* Fixed Bottom Action */}
        {nextAction && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-neutral-900 border-t border-neutral-700">
            <button
              onClick={() => {
                if (nextAction.action === 'capture-proof') {
                  setView('signature');
                } else {
                  handleWorkflowAction(nextAction.action);
                }
              }}
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

  // Checklist View
  if (view === 'checklist' && selectedTicket) {
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

  // List View
  return (
    <div className="min-h-screen bg-neutral-900">
      {/* Header */}
      <div className="bg-brand-green p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black/20 rounded-full flex items-center justify-center">
              <Truck size={20} className="text-black" />
            </div>
            <div>
              <h1 className="font-bold text-black">{driver.name}</h1>
              <p className="text-sm text-black/70">{driver.vehicle}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-black/70 hover:text-black"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Today's Date & Refresh */}
      <div className="p-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Today's Deliveries</h2>
          <p className="text-sm text-neutral-400">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => loadTickets(driver.id)}
          disabled={isLoading}
          className="p-2 bg-neutral-800 rounded-lg hover:bg-neutral-700"
        >
          <RefreshCw size={20} className={`text-neutral-400 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tickets List */}
      <div className="px-4 pb-6 space-y-3">
        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="animate-spin mx-auto text-brand-green" size={32} />
            <p className="text-neutral-400 mt-2">Loading deliveries...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="mx-auto text-neutral-600" size={48} />
            <p className="text-neutral-400 mt-2">No deliveries scheduled for today</p>
          </div>
        ) : (
          tickets.map(ticket => {
            const config = statusConfig[ticket.status];
            return (
              <button
                key={ticket.ticketId}
                onClick={() => {
                  setSelectedTicket(ticket);
                  loadTicketDetails(ticket.ticketId);
                  setView('detail');
                }}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-left hover:border-neutral-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{ticket.jobName}</h3>
                    <p className="text-sm text-neutral-400">{ticket.customerName}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${config.color} ml-2 flex-shrink-0`}>
                    {config.label}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-neutral-400 mb-2">
                  <MapPin size={14} />
                  <span className="truncate">{ticket.jobAddress}, {ticket.city}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-neutral-500">
                      <Clock size={14} />
                      {ticket.scheduledTime || 'TBD'}
                    </div>
                    <div className="flex items-center gap-1 text-neutral-500">
                      <Package size={14} />
                      {ticket.materials?.length || 0} items
                    </div>
                    {ticket.priority !== 'normal' && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        ticket.priority === 'urgent' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        {ticket.priority.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <ChevronRight size={20} className="text-neutral-500" />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
