'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Truck, MapPin, Phone, Clock, CheckCircle2, Camera, Package,
  Navigation, ArrowLeft, Loader2, RefreshCw, User, AlertCircle,
  ClipboardCheck, ChevronRight, ChevronDown,
  CheckSquare, Square, MessageSquare, Upload, Timer, Route as RouteIcon,
  Bell, AlertTriangle, ChevronUp
} from 'lucide-react';
import type { DeliveryTicket, TicketStatus, ChecklistItem, TicketPhoto } from '@/lib/delivery-workflow-service';
import type { Driver } from '@/lib/delivery-portal-service';

interface DeliveryETA {
  ticketId: string;
  stopNumber: number;
  totalStops: number;
  estimatedArrival: string;
  estimatedMinutesAway: number;
  driverName: string;
  status: TicketStatus;
  lastUpdated: string;
}

const statusConfig: Record<TicketStatus, { label: string; color: string; next?: TicketStatus }> = {
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
  { status: 'load_verified' as TicketStatus, label: 'Verify Load', icon: ClipboardCheck, action: 'verify-load' },
  { status: 'en_route' as TicketStatus, label: 'Start Delivery', icon: Truck, action: 'start-delivery' },
  { status: 'arrived' as TicketStatus, label: 'Mark Arrived', icon: MapPin, action: 'mark-arrived' },
  { status: 'delivered' as TicketStatus, label: 'Complete Delivery', icon: Package, action: 'complete-delivery' },
  { status: 'proof_captured' as TicketStatus, label: 'Take Photos', icon: Camera, action: 'capture-proof' },
  { status: 'qc_photos' as TicketStatus, label: 'QC Photos', icon: Camera, action: 'upload-qc' },
  { status: 'completed' as TicketStatus, label: 'Complete', icon: CheckCircle2, action: 'complete-ticket' },
];

function formatETA(eta: DeliveryETA): string {
  if (eta.estimatedMinutesAway <= 0) return 'Now';
  if (eta.estimatedMinutesAway < 60) return `${eta.estimatedMinutesAway} min`;
  const hours = Math.floor(eta.estimatedMinutesAway / 60);
  const mins = eta.estimatedMinutesAway % 60;
  return `${hours}h ${mins}m`;
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

export default function DriverPortal() {
  const router = useRouter();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [tickets, setTickets] = useState<DeliveryTicket[]>([]);
  const [etas, setEtas] = useState<DeliveryETA[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<DeliveryTicket | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [photos, setPhotos] = useState<TicketPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [view, setView] = useState<'list' | 'detail' | 'checklist' | 'photos'>('list');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [issueNotes, setIssueNotes] = useState('');
  const [showIssueField, setShowIssueField] = useState(false);
  const [expandedStop, setExpandedStop] = useState<string | null>(null);

  useEffect(() => {
    const storedDriver = sessionStorage.getItem('driver');
    if (!storedDriver) {
      router.push('/portal');
      return;
    }
    const parsed = JSON.parse(storedDriver);
    setDriver(parsed);
    loadTickets(parsed.id);
    loadETAs(parsed.id);
  }, [router]);

  // Auto-refresh ETAs every 60 seconds
  useEffect(() => {
    if (!driver) return;
    const interval = setInterval(() => {
      loadETAs(driver.id);
    }, 60000);
    return () => clearInterval(interval);
  }, [driver]);

  const loadTickets = async (driverId: string) => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const response = await fetch(`/api/portal/tickets?driverId=${driverId}&date=${today}`);
      const data = await response.json();
      const ticketList = Array.isArray(data) ? data : [];
      // Sort: active first, then by scheduled time
      ticketList.sort((a: DeliveryTicket, b: DeliveryTicket) => {
        const aComplete = ['completed', 'cancelled'].includes(a.status) ? 1 : 0;
        const bComplete = ['completed', 'cancelled'].includes(b.status) ? 1 : 0;
        if (aComplete !== bComplete) return aComplete - bComplete;
        return (a.scheduledTime || '').localeCompare(b.scheduledTime || '');
      });
      setTickets(ticketList);
    } catch (error) {
      console.error('Error loading tickets:', error);
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadETAs = async (driverId: string) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const response = await fetch('/api/portal/tickets/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'eta-update',
          driverId,
          date: today,
        }),
      });
      const data = await response.json();
      if (data.success && Array.isArray(data.etas)) {
        setEtas(data.etas);
      }
    } catch (error) {
      console.error('Error loading ETAs:', error);
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
      const body: Record<string, unknown> = {
        action,
        ticketId: selectedTicket.ticketId,
      };

      if (action === 'verify-load') {
        body.verifiedBy = driver.name;
        if (navigator.geolocation) {
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
            });
            body.gpsLocation = `${pos.coords.latitude},${pos.coords.longitude}`;
          } catch { /* GPS optional */ }
        }
      }

      if (action === 'mark-arrived') {
        if (navigator.geolocation) {
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
            });
            body.gpsLocation = `${pos.coords.latitude},${pos.coords.longitude}`;
          } catch { /* GPS optional */ }
        }
      }

      if (action === 'complete-delivery') {
        body.notes = [deliveryNotes, issueNotes].filter(Boolean).join('\n---\n');
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
        await loadETAs(driver.id);

        setDeliveryNotes('');
        setIssueNotes('');
        setShowIssueField(false);

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

  const getETAForTicket = (ticketId: string): DeliveryETA | undefined => {
    return etas.find(e => e.ticketId === ticketId);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('driver');
    router.push('/portal');
  };

  if (!driver) return null;

  // ============================================
  // TICKET DETAIL VIEW
  // ============================================
  if (view === 'detail' && selectedTicket) {
    const nextAction = getNextAction(selectedTicket.status);
    const config = statusConfig[selectedTicket.status];
    const ticketETA = getETAForTicket(selectedTicket.ticketId);

    return (
      <div className="min-h-screen bg-zinc-950 pb-24">
        {/* Header */}
        <div className="bg-zinc-900 border-b border-zinc-800 p-4">
          <button
            onClick={() => { setView('list'); setSelectedTicket(null); }}
            className="flex items-center gap-2 text-zinc-400 hover:text-white mb-3"
          >
            <ArrowLeft size={20} />
            Back to Route
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-white">{selectedTicket.jobName}</h1>
              <p className="text-sm text-zinc-500">{selectedTicket.ticketId}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${config.color}`}>
              {config.label}
            </span>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="bg-zinc-900 border-b border-zinc-800 p-4 overflow-x-auto">
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
                    isCurrent ? 'bg-lime-500/20 text-lime-400' :
                    'bg-zinc-800 text-zinc-600'
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
          {/* ETA Card */}
          {ticketETA && ticketETA.estimatedMinutesAway > 0 && (
            <div className="bg-lime-500/10 border border-lime-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-lime-400">
                  <Timer size={18} />
                  <span className="font-medium">ETA</span>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-lime-400">{formatETA(ticketETA)}</p>
                  <p className="text-xs text-zinc-500">
                    ~{formatTimeFromISO(ticketETA.estimatedArrival)}
                  </p>
                </div>
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                Stop {ticketETA.stopNumber} of {ticketETA.totalStops}
              </div>
            </div>
          )}

          {/* Customer Info with Call Button */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h3 className="font-semibold text-white mb-3">Customer</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-zinc-300">
                <User size={18} className="text-zinc-500" />
                {selectedTicket.customerName}
              </div>
              <a
                href={`tel:${selectedTicket.customerPhone}`}
                className="flex items-center gap-3 bg-lime-500/10 border border-lime-500/30 rounded-lg px-4 py-3 text-lime-400 hover:bg-lime-500/20 transition-colors"
              >
                <Phone size={18} />
                <span className="font-medium">{selectedTicket.customerPhone}</span>
                <span className="ml-auto text-sm">Tap to Call</span>
              </a>
            </div>
          </div>

          {/* Address & Navigation */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h3 className="font-semibold text-white mb-3">Delivery Address</h3>
            <p className="text-zinc-300 mb-1">{selectedTicket.jobAddress}</p>
            <p className="text-zinc-500 text-sm mb-4">
              {selectedTicket.city}, {selectedTicket.state} {selectedTicket.zip}
            </p>
            <button
              onClick={() => openNavigation(selectedTicket)}
              className="w-full bg-brand-green hover:bg-brand-green text-black font-bold py-3 rounded-lg flex items-center justify-center gap-2"
            >
              <Navigation size={20} />
              Navigate to Stop
            </button>
          </div>

          {/* Materials */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h3 className="font-semibold text-white mb-3">Materials ({selectedTicket.materials?.length || 0} items)</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {selectedTicket.materials?.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                  <div>
                    <p className="text-white text-sm">{item.productName}</p>
                    <p className="text-zinc-600 text-xs">{item.sku}</p>
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
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h3 className="font-semibold text-white mb-3">Timeline</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Scheduled</span>
                <span className="text-white">{selectedTicket.scheduledTime || 'TBD'}</span>
              </div>
              {selectedTicket.loadVerifiedAt && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">Load Verified</span>
                  <span className="text-white">{new Date(selectedTicket.loadVerifiedAt).toLocaleTimeString()}</span>
                </div>
              )}
              {selectedTicket.departedAt && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">Departed</span>
                  <span className="text-white">{new Date(selectedTicket.departedAt).toLocaleTimeString()}</span>
                </div>
              )}
              {selectedTicket.arrivedAt && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">Arrived</span>
                  <span className="text-white">{new Date(selectedTicket.arrivedAt).toLocaleTimeString()}</span>
                </div>
              )}
              {selectedTicket.deliveredAt && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">Delivered</span>
                  <span className="text-white">{new Date(selectedTicket.deliveredAt).toLocaleTimeString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Delivery Notes (for complete-delivery step) */}
          {selectedTicket.status === 'arrived' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
              <div>
                <h3 className="font-semibold text-white mb-3">Delivery Notes</h3>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="Add any notes about the delivery..."
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white resize-none focus:border-lime-500 focus:outline-none"
                />
              </div>

              {/* Report Issue Toggle */}
              <button
                onClick={() => setShowIssueField(!showIssueField)}
                className="flex items-center gap-2 text-yellow-400 text-sm hover:text-yellow-300"
              >
                <AlertTriangle size={16} />
                {showIssueField ? 'Hide Issue Report' : 'Report an Issue'}
                {showIssueField ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showIssueField && (
                <div>
                  <label className="block text-sm text-yellow-400 mb-2">Issue Description</label>
                  <textarea
                    value={issueNotes}
                    onChange={(e) => setIssueNotes(e.target.value)}
                    placeholder="Describe the issue (damaged materials, access problem, etc.)..."
                    rows={3}
                    className="w-full bg-zinc-800 border border-yellow-500/50 rounded-lg px-4 py-3 text-white resize-none focus:border-yellow-500 focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* Action Buttons Row */}
          <div className="grid grid-cols-2 gap-3">
            <button
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:bg-zinc-800 transition-colors"
            >
              <Camera className="mx-auto text-lime-400 mb-2" size={24} />
              <span className="text-white text-sm">Take Photo</span>
              <span className="text-zinc-600 text-xs block">{selectedTicket.photoCount} uploaded</span>
            </button>
            <button
              onClick={() => setView('checklist')}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:bg-zinc-800 transition-colors"
            >
              <ClipboardCheck className="mx-auto text-blue-400 mb-2" size={24} />
              <span className="text-white text-sm">Checklist</span>
              <span className="text-zinc-600 text-xs block">View all steps</span>
            </button>
          </div>
        </div>

        {/* Fixed Bottom Action */}
        {nextAction && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950 border-t border-zinc-800">
            <button
              onClick={() => handleWorkflowAction(nextAction.action)}
              disabled={isUpdating}
              className={`w-full font-bold py-4 rounded-xl flex items-center justify-center gap-2 ${
                nextAction.status === 'completed'
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-lime-500 hover:bg-lime-400 text-black'
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
      </div>
    );
  }

  // ============================================
  // CHECKLIST VIEW
  // ============================================
  if (view === 'checklist' && selectedTicket) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <div className="bg-zinc-900 border-b border-zinc-800 p-4">
          <button
            onClick={() => setView('detail')}
            className="flex items-center gap-2 text-zinc-400 hover:text-white"
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
              className={`bg-zinc-900 border rounded-xl p-4 flex items-start gap-3 ${
                item.completedAt ? 'border-green-500/50' : 'border-zinc-800'
              }`}
            >
              {item.completedAt ? (
                <CheckSquare className="text-green-500 flex-shrink-0 mt-0.5" size={20} />
              ) : (
                <Square className="text-zinc-600 flex-shrink-0 mt-0.5" size={20} />
              )}
              <div className="flex-1">
                <p className={`font-medium ${item.completedAt ? 'text-green-400' : 'text-white'}`}>
                  {item.description}
                </p>
                {item.completedAt && (
                  <p className="text-zinc-600 text-xs mt-1">
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
              <ClipboardCheck className="mx-auto text-zinc-700" size={48} />
              <p className="text-zinc-500 mt-4">No checklist items</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================
  // ROUTE LIST VIEW
  // ============================================

  const activeTickets = tickets.filter(t => !['completed', 'cancelled'].includes(t.status));
  const completedTickets = tickets.filter(t => ['completed', 'cancelled'].includes(t.status));

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="bg-lime-500 p-4">
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

      {/* Route Summary Bar */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-white">{tickets.length}</p>
            <p className="text-xs text-zinc-500">Total Stops</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-lime-400">{completedTickets.length}</p>
            <p className="text-xs text-zinc-500">Completed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-400">{activeTickets.length}</p>
            <p className="text-xs text-zinc-500">Remaining</p>
          </div>
        </div>
        {tickets.length > 0 && (
          <div className="mt-3">
            <div className="w-full bg-zinc-800 rounded-full h-2">
              <div
                className="bg-lime-500 h-2 rounded-full transition-all"
                style={{ width: `${tickets.length > 0 ? (completedTickets.length / tickets.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Today's Date & Refresh */}
      <div className="p-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Today's Route</h2>
          <p className="text-sm text-zinc-500">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => { loadTickets(driver.id); loadETAs(driver.id); }}
          disabled={isLoading}
          className="p-2 bg-zinc-900 rounded-lg hover:bg-zinc-800 border border-zinc-800"
        >
          <RefreshCw size={20} className={`text-zinc-400 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tickets List */}
      <div className="px-4 pb-6 space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center py-12 gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-lime-500/20 to-emerald-500/20 border border-lime-500/30 flex items-center justify-center">
                <Truck className="text-lime-400" size={28} />
              </div>
              <div className="absolute inset-0 rounded-xl border-2 border-lime-500/30 animate-ping" />
            </div>
            <div className="text-center">
              <p className="text-white font-medium">Loading route...</p>
              <p className="text-zinc-600 text-sm">Fetching your deliveries</p>
            </div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center">
              <Truck className="text-zinc-600" size={32} />
            </div>
            <div className="text-center">
              <p className="text-white font-medium">No deliveries today</p>
              <p className="text-zinc-600 text-sm">Check back later for new assignments</p>
            </div>
          </div>
        ) : (
          <>
            {/* Active Stops */}
            {activeTickets.map((ticket, idx) => {
              const config = statusConfig[ticket.status];
              const eta = getETAForTicket(ticket.ticketId);
              const isExpanded = expandedStop === ticket.ticketId;
              const isEnRoute = ['en_route', 'arrived'].includes(ticket.status);

              return (
                <div
                  key={ticket.ticketId}
                  className={`bg-zinc-900 border rounded-xl overflow-hidden transition-all ${
                    isEnRoute ? 'border-lime-500/50 ring-1 ring-lime-500/20' : 'border-zinc-800'
                  }`}
                >
                  {/* Main Card */}
                  <button
                    onClick={() => {
                      setSelectedTicket(ticket);
                      loadTicketDetails(ticket.ticketId);
                      setView('detail');
                    }}
                    className="w-full p-4 text-left"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isEnRoute ? 'bg-lime-500 text-black' : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          <span className="text-sm font-bold">{idx + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white truncate">{ticket.jobName}</h3>
                          <p className="text-sm text-zinc-400">{ticket.customerName}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${config.color}`}>
                          {config.label}
                        </span>
                        {eta && eta.estimatedMinutesAway > 0 && (
                          <span className="text-xs text-lime-400 font-medium">
                            ETA: {formatETA(eta)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2 ml-11">
                      <MapPin size={14} />
                      <span className="truncate">{ticket.jobAddress}, {ticket.city}</span>
                    </div>

                    <div className="flex items-center justify-between ml-11">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-zinc-600">
                          <Clock size={14} />
                          {ticket.scheduledTime || 'TBD'}
                        </div>
                        <div className="flex items-center gap-1 text-zinc-600">
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
                      <ChevronRight size={20} className="text-zinc-600" />
                    </div>
                  </button>

                  {/* Quick Actions Bar */}
                  <div className="border-t border-zinc-800 px-4 py-2 flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); openNavigation(ticket); }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-brand-green/20 text-blue-400 rounded-lg text-xs font-medium hover:bg-brand-green/30"
                    >
                      <Navigation size={14} />
                      Navigate
                    </button>
                    <a
                      href={`tel:${ticket.customerPhone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 px-3 py-1.5 bg-lime-500/20 text-lime-400 rounded-lg text-xs font-medium hover:bg-lime-500/30"
                    >
                      <Phone size={14} />
                      Call
                    </a>
                    {ticket.specialInstructions && (
                      <div className="flex items-center gap-1 px-2 py-1.5 text-yellow-400 text-xs">
                        <AlertCircle size={14} />
                        <span>Instructions</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Completed Stops */}
            {completedTickets.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-zinc-500 mb-3 px-1">
                  Completed ({completedTickets.length})
                </h3>
                {completedTickets.map(ticket => (
                  <button
                    key={ticket.ticketId}
                    onClick={() => {
                      setSelectedTicket(ticket);
                      loadTicketDetails(ticket.ticketId);
                      setView('detail');
                    }}
                    className="w-full bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 text-left mb-2 opacity-60"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                          <CheckCircle2 size={16} className="text-green-500" />
                        </div>
                        <div>
                          <h3 className="font-medium text-zinc-300 text-sm">{ticket.jobName}</h3>
                          <p className="text-xs text-zinc-600">{ticket.customerName}</p>
                        </div>
                      </div>
                      {ticket.deliveredAt && (
                        <span className="text-xs text-zinc-600">
                          {new Date(ticket.deliveredAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
