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
  created: { label: 'Created', color: 'bg-zinc-600', next: 'assigned' },
  assigned: { label: 'Assigned', color: 'bg-cyan-600', next: 'materials_pulled' },
  materials_pulled: { label: 'Materials Pulled', color: 'bg-yellow-600', next: 'load_verified' },
  load_verified: { label: 'Load Verified', color: 'bg-brand-green/80', next: 'en_route' },
  en_route: { label: 'En Route', color: 'bg-purple-600', next: 'arrived' },
  arrived: { label: 'Arrived', color: 'bg-orange-600', next: 'delivered' },
  delivered: { label: 'Delivered', color: 'bg-teal-600', next: 'proof_captured' },
  picked_up: { label: 'Picked Up', color: 'bg-teal-600', next: 'proof_captured' },
  proof_captured: { label: 'Proof Captured', color: 'bg-brand-green/80', next: 'qc_photos' },
  qc_photos: { label: 'QC Photos', color: 'bg-pink-600', next: 'completed' },
  completed: { label: 'Completed', color: 'bg-green-600' },
  cancelled: { label: 'Cancelled', color: 'bg-red-600' },
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
        body: JSON.stringify({ action: 'eta-update', driverId, date: today }),
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
      const body: Record<string, unknown> = { action, ticketId: selectedTicket.ticketId };

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
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
  };

  const getETAForTicket = (ticketId: string): DeliveryETA | undefined => etas.find(e => e.ticketId === ticketId);

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
      <div className="min-h-screen bg-black pb-24">
        {/* Header */}
        <div className="bg-zinc-900 border-b border-zinc-800 p-4 safe-top">
          <button
            onClick={() => { setView('list'); setSelectedTicket(null); }}
            className="flex items-center gap-2 text-zinc-400 active:text-brand-green mb-3 py-1"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Back to Route</span>
          </button>
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-white truncate">{selectedTicket.jobName}</h1>
              <p className="text-xs text-zinc-500 font-mono">{selectedTicket.ticketId}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${config.color} ml-3 flex-shrink-0`}>
              {config.label}
            </span>
          </div>
        </div>

        {/* Progress Steps - horizontal scroll */}
        <div className="bg-zinc-900/80 border-b border-zinc-800 p-3 overflow-x-auto">
          <div className="flex gap-1.5 min-w-max">
            {workflowSteps.map((step, idx) => {
              const currentIdx = getCurrentStepIndex(selectedTicket.status);
              const isCompleted = selectedTicket.status === 'materials_pulled' ? idx < 0 : idx <= currentIdx;
              const isCurrent = selectedTicket.status === step.status ||
                (selectedTicket.status === 'materials_pulled' && idx === 0);
              return (
                <div
                  key={step.status}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors ${
                    isCompleted ? 'bg-brand-green/20 text-brand-green' :
                    isCurrent ? 'bg-brand-green/10 text-brand-green ring-1 ring-brand-green/40' :
                    'bg-zinc-800/60 text-zinc-600'
                  }`}
                >
                  <step.icon size={14} />
                  <span className="text-[11px] font-semibold whitespace-nowrap">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* ETA Card */}
          {ticketETA && ticketETA.estimatedMinutesAway > 0 && (
            <div className="bg-brand-green/10 border border-brand-green/30 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-brand-green">
                  <Timer size={18} />
                  <span className="font-bold text-sm">ETA</span>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-brand-green">{formatETA(ticketETA)}</p>
                  <p className="text-[11px] text-zinc-500">~{formatTimeFromISO(ticketETA.estimatedArrival)}</p>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-zinc-500">
                Stop {ticketETA.stopNumber} of {ticketETA.totalStops}
              </div>
            </div>
          )}

          {/* Customer Info */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
              <User size={16} className="text-brand-green" /> Customer
            </h3>
            <div className="space-y-2">
              <p className="text-zinc-300 text-sm">{selectedTicket.customerName}</p>
              <a
                href={`tel:${selectedTicket.customerPhone}`}
                className="flex items-center gap-3 bg-brand-green/10 border border-brand-green/30 rounded-xl px-4 py-3 text-brand-green active:bg-brand-green/20 transition-colors"
              >
                <Phone size={18} />
                <span className="font-bold text-sm">{selectedTicket.customerPhone}</span>
                <span className="ml-auto text-xs opacity-70">Tap to Call</span>
              </a>
            </div>
          </div>

          {/* Address & Navigation */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
              <MapPin size={16} className="text-brand-green" /> Delivery Address
            </h3>
            <p className="text-zinc-300 text-sm">{selectedTicket.jobAddress}</p>
            <p className="text-zinc-500 text-xs mb-4">
              {selectedTicket.city}, {selectedTicket.state} {selectedTicket.zip}
            </p>
            <button
              onClick={() => openNavigation(selectedTicket)}
              className="w-full bg-brand-green active:brightness-90 text-black font-black py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm transition-all"
            >
              <Navigation size={18} />
              Navigate to Stop
            </button>
          </div>

          {/* Materials */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
              <Package size={16} className="text-brand-green" />
              Materials ({selectedTicket.materials?.length || 0})
            </h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {selectedTicket.materials?.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b border-zinc-800/60 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm truncate">{item.productName}</p>
                    {item.sku && <p className="text-zinc-600 text-[11px] font-mono">{item.sku}</p>}
                  </div>
                  <p className="text-brand-green font-bold text-sm ml-3 flex-shrink-0">{item.quantity} {item.unit}</p>
                </div>
              ))}
            </div>
            {selectedTicket.specialInstructions && (
              <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <p className="text-yellow-400 text-xs font-bold">⚠ Special Instructions</p>
                <p className="text-yellow-200/90 text-sm mt-1">{selectedTicket.specialInstructions}</p>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
              <Clock size={16} className="text-brand-green" /> Timeline
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Scheduled</span>
                <span className="text-white font-medium">{selectedTicket.scheduledTime || 'TBD'}</span>
              </div>
              {selectedTicket.loadVerifiedAt && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Load Verified</span>
                  <span className="text-brand-green font-medium">{new Date(selectedTicket.loadVerifiedAt).toLocaleTimeString()}</span>
                </div>
              )}
              {selectedTicket.departedAt && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Departed</span>
                  <span className="text-brand-green font-medium">{new Date(selectedTicket.departedAt).toLocaleTimeString()}</span>
                </div>
              )}
              {selectedTicket.arrivedAt && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Arrived</span>
                  <span className="text-brand-green font-medium">{new Date(selectedTicket.arrivedAt).toLocaleTimeString()}</span>
                </div>
              )}
              {selectedTicket.deliveredAt && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Delivered</span>
                  <span className="text-brand-green font-medium">{new Date(selectedTicket.deliveredAt).toLocaleTimeString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Delivery Notes (for complete-delivery step) */}
          {selectedTicket.status === 'arrived' && (
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

          {/* Quick Action Grid */}
          <div className="grid grid-cols-2 gap-3">
            <button className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center active:bg-zinc-800 transition-colors">
              <Camera className="mx-auto text-brand-green mb-2" size={24} />
              <span className="text-white text-sm font-medium block">Take Photo</span>
              <span className="text-zinc-600 text-[11px]">{selectedTicket.photoCount} uploaded</span>
            </button>
            <button
              onClick={() => setView('checklist')}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center active:bg-zinc-800 transition-colors"
            >
              <ClipboardCheck className="mx-auto text-blue-400 mb-2" size={24} />
              <span className="text-white text-sm font-medium block">Checklist</span>
              <span className="text-zinc-600 text-[11px]">View all steps</span>
            </button>
          </div>
        </div>

        {/* Fixed Bottom Action */}
        {nextAction && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/95 backdrop-blur-sm border-t border-zinc-800 safe-bottom">
            <button
              onClick={() => handleWorkflowAction(nextAction.action)}
              disabled={isUpdating}
              className={`w-full font-black py-4 rounded-2xl flex items-center justify-center gap-2.5 text-base transition-all active:scale-[0.98] ${
                nextAction.status === 'completed'
                  ? 'bg-green-500 active:bg-green-400 text-black'
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
      </div>
    );
  }

  // ============================================
  // CHECKLIST VIEW
  // ============================================
  if (view === 'checklist' && selectedTicket) {
    return (
      <div className="min-h-screen bg-black">
        <div className="bg-zinc-900 border-b border-zinc-800 p-4 safe-top">
          <button
            onClick={() => setView('detail')}
            className="flex items-center gap-2 text-zinc-400 active:text-brand-green py-1"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Back to Delivery</span>
          </button>
          <h1 className="text-lg font-bold text-white mt-3">Delivery Checklist</h1>
        </div>

        <div className="p-4 space-y-2">
          {checklist.map(item => (
            <div
              key={item.checklistId}
              className={`bg-zinc-900 border rounded-2xl p-4 flex items-start gap-3 ${
                item.completedAt ? 'border-brand-green/40' : 'border-zinc-800'
              }`}
            >
              {item.completedAt ? (
                <CheckSquare className="text-brand-green flex-shrink-0 mt-0.5" size={20} />
              ) : (
                <Square className="text-zinc-600 flex-shrink-0 mt-0.5" size={20} />
              )}
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm ${item.completedAt ? 'text-brand-green' : 'text-white'}`}>
                  {item.description}
                </p>
                {item.completedAt && (
                  <p className="text-zinc-600 text-[11px] mt-1">
                    ✓ {new Date(item.completedAt).toLocaleString()} by {item.completedBy}
                  </p>
                )}
                {item.required && !item.completedAt && (
                  <span className="text-red-400 text-[11px] font-bold">Required</span>
                )}
              </div>
            </div>
          ))}
          {checklist.length === 0 && (
            <div className="text-center py-16">
              <ClipboardCheck className="mx-auto text-zinc-700" size={48} />
              <p className="text-zinc-500 mt-4 text-sm">No checklist items</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================
  // ROUTE LIST VIEW (Main Screen)
  // ============================================
  const activeTickets = tickets.filter(t => !['completed', 'cancelled'].includes(t.status));
  const completedTickets = tickets.filter(t => ['completed', 'cancelled'].includes(t.status));

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
            <p className="text-2xl font-black text-white">{tickets.length}</p>
            <p className="text-[11px] text-zinc-500 font-medium">Total</p>
          </div>
          <div>
            <p className="text-2xl font-black text-brand-green">{completedTickets.length}</p>
            <p className="text-[11px] text-zinc-500 font-medium">Done</p>
          </div>
          <div>
            <p className="text-2xl font-black text-orange-400">{activeTickets.length}</p>
            <p className="text-[11px] text-zinc-500 font-medium">Remaining</p>
          </div>
        </div>
        {tickets.length > 0 && (
          <div className="mt-3">
            <div className="w-full bg-zinc-800 rounded-full h-2.5">
              <div
                className="bg-brand-green h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${tickets.length > 0 ? (completedTickets.length / tickets.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Date & Refresh */}
      <div className="p-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Today&apos;s Route</h2>
          <p className="text-xs text-zinc-500">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => { loadTickets(driver.id); loadETAs(driver.id); }}
          disabled={isLoading}
          className="p-2.5 bg-zinc-900 rounded-xl active:bg-zinc-800 border border-zinc-800"
        >
          <RefreshCw size={18} className={`text-brand-green ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tickets List */}
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
              <p className="text-white font-bold text-sm">Loading route...</p>
              <p className="text-zinc-600 text-xs">Fetching your deliveries</p>
            </div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Truck className="text-zinc-600" size={32} />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-sm">No deliveries today</p>
              <p className="text-zinc-600 text-xs">Check back later for new assignments</p>
            </div>
          </div>
        ) : (
          <>
            {/* Active Stops */}
            {activeTickets.map((ticket, idx) => {
              const config = statusConfig[ticket.status];
              const eta = getETAForTicket(ticket.ticketId);
              const isEnRoute = ['en_route', 'arrived'].includes(ticket.status);
              return (
                <div
                  key={ticket.ticketId}
                  className={`bg-zinc-900 border rounded-2xl overflow-hidden transition-all ${
                    isEnRoute ? 'border-brand-green/50 ring-1 ring-brand-green/20' : 'border-zinc-800'
                  }`}
                >
                  <button
                    onClick={() => {
                      setSelectedTicket(ticket);
                      loadTicketDetails(ticket.ticketId);
                      setView('detail');
                    }}
                    className="w-full p-4 text-left active:bg-zinc-800/50"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isEnRoute ? 'bg-brand-green text-black' : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          <span className="text-sm font-black">{idx + 1}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-white text-sm truncate">{ticket.jobName}</h3>
                          <p className="text-xs text-zinc-500">{ticket.customerName}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold text-white ${config.color}`}>
                          {config.label}
                        </span>
                        {eta && eta.estimatedMinutesAway > 0 && (
                          <span className="text-[11px] text-brand-green font-bold">
                            ETA: {formatETA(eta)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-2 ml-11">
                      <MapPin size={12} />
                      <span className="truncate">{ticket.jobAddress}, {ticket.city}</span>
                    </div>

                    <div className="flex items-center justify-between ml-11">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-zinc-600">
                          <Clock size={12} />
                          {ticket.scheduledTime || 'TBD'}
                        </span>
                        <span className="flex items-center gap-1 text-zinc-600">
                          <Package size={12} />
                          {ticket.materials?.length || 0}
                        </span>
                        {ticket.priority !== 'normal' && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            ticket.priority === 'urgent' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                          }`}>
                            {ticket.priority.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <ChevronRight size={18} className="text-zinc-700" />
                    </div>
                  </button>

                  {/* Quick Actions Bar */}
                  <div className="border-t border-zinc-800 px-3 py-2 flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); openNavigation(ticket); }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-brand-green/15 text-brand-green rounded-lg text-xs font-bold active:bg-brand-green/25"
                    >
                      <Navigation size={13} />
                      Navigate
                    </button>
                    <a
                      href={`tel:${ticket.customerPhone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 px-3 py-1.5 bg-brand-green/10 text-brand-green rounded-lg text-xs font-bold active:bg-brand-green/20"
                    >
                      <Phone size={13} />
                      Call
                    </a>
                    {ticket.specialInstructions && (
                      <span className="flex items-center gap-1 px-2 py-1.5 text-yellow-400 text-[11px] font-medium">
                        <AlertCircle size={13} />
                        Notes
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Completed Stops */}
            {completedTickets.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-bold text-zinc-500 mb-2 px-1 uppercase tracking-wider">
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
                    className="w-full bg-zinc-900/40 border border-zinc-800/40 rounded-2xl p-3 text-left mb-2 opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-brand-green/20 flex items-center justify-center">
                          <CheckCircle2 size={14} className="text-brand-green" />
                        </div>
                        <div>
                          <h3 className="font-medium text-zinc-300 text-sm">{ticket.jobName}</h3>
                          <p className="text-[11px] text-zinc-600">{ticket.customerName}</p>
                        </div>
                      </div>
                      {ticket.deliveredAt && (
                        <span className="text-[11px] text-zinc-600">
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
