'use client';

import { useState } from 'react';
import {
  MapPin, Phone, Clock, Package, Navigation, User, AlertCircle,
  CheckCircle2, Camera, ChevronDown, ChevronUp, Truck, Play, Flag
} from 'lucide-react';
import NavigateButton from './NavigateButton';

export interface DeliveryItem {
  id: string;
  jobName: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  customerName: string;
  customerPhone: string;
  materials: Array<{
    name: string;
    quantity: number;
    unit: string;
  }>;
  status: 'pending' | 'assigned' | 'loaded' | 'en_route' | 'arrived' | 'delivered';
  priority: 'normal' | 'rush' | 'urgent';
  scheduledDate: string;
  scheduledTime?: string;
  estimatedArrival?: string;
  specialInstructions?: string;
  photoCount?: number;
  driverNotes?: string;
}

interface DeliveryCardProps {
  delivery: DeliveryItem;
  variant?: 'compact' | 'full';
  showActions?: boolean;
  onStatusChange?: (deliveryId: string, newStatus: DeliveryItem['status']) => void;
  onNavigate?: (delivery: DeliveryItem) => void;
  onCall?: (phoneNumber: string) => void;
  onTakePhoto?: (deliveryId: string) => void;
}

export default function DeliveryCard({
  delivery,
  variant = 'compact',
  showActions = true,
  onStatusChange,
  onNavigate,
  onCall,
  onTakePhoto,
}: DeliveryCardProps) {
  const [isExpanded, setIsExpanded] = useState(variant === 'full');

  // Status configuration
  const statusConfig: Record<string, { label: string; color: string; icon: typeof Truck }> = {
    pending: { label: 'Pending', color: 'bg-gray-500', icon: Clock },
    assigned: { label: 'Assigned', color: 'bg-cyan-500', icon: User },
    loaded: { label: 'Loaded', color: 'bg-yellow-500', icon: Package },
    en_route: { label: 'En Route', color: 'bg-blue-500', icon: Truck },
    arrived: { label: 'Arrived', color: 'bg-purple-500', icon: MapPin },
    delivered: { label: 'Delivered', color: 'bg-green-500', icon: CheckCircle2 },
  };

  const currentStatus = statusConfig[delivery.status];
  const StatusIcon = currentStatus.icon;

  // Next action based on status
  const getNextAction = (): { label: string; status: DeliveryItem['status'] } | null => {
    const statusFlow: Record<string, DeliveryItem['status']> = {
      pending: 'assigned',
      assigned: 'loaded',
      loaded: 'en_route',
      en_route: 'arrived',
      arrived: 'delivered',
    };

    const nextStatus = statusFlow[delivery.status];
    if (!nextStatus) return null;

    const actionLabels: Record<string, string> = {
      assigned: 'Accept',
      loaded: 'Verify Load',
      en_route: 'Start Delivery',
      arrived: 'Mark Arrived',
      delivered: 'Complete',
    };

    return { label: actionLabels[nextStatus], status: nextStatus };
  };

  const nextAction = getNextAction();

  return (
    <div className={`
      bg-neutral-800 border rounded-xl overflow-hidden
      transition-all duration-200
      ${delivery.priority === 'urgent' ? 'border-red-500/50' :
        delivery.priority === 'rush' ? 'border-orange-500/50' : 'border-neutral-700'}
    `}>
      {/* Priority banner */}
      {delivery.priority !== 'normal' && (
        <div className={`
          px-4 py-1 text-xs font-semibold flex items-center gap-2
          ${delivery.priority === 'urgent' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}
        `}>
          <AlertCircle size={14} />
          {delivery.priority === 'urgent' ? 'URGENT DELIVERY' : 'RUSH DELIVERY'}
        </div>
      )}

      {/* Main content */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate">{delivery.jobName}</h3>
            <p className="text-sm text-neutral-400">{delivery.customerName}</p>
          </div>
          <span className={`
            px-2.5 py-1 rounded-full text-xs font-medium text-white flex items-center gap-1.5
            ${currentStatus.color}
          `}>
            <StatusIcon size={12} />
            {currentStatus.label}
          </span>
        </div>

        {/* Address */}
        <div className="mt-3 flex items-start gap-2">
          <MapPin size={16} className="text-neutral-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-neutral-300">
            <p>{delivery.address}</p>
            <p className="text-neutral-400">{delivery.city}, {delivery.state} {delivery.zip}</p>
          </div>
        </div>

        {/* Time info */}
        <div className="mt-3 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-neutral-400">
            <Clock size={14} />
            <span>{delivery.scheduledTime || 'TBD'}</span>
          </div>
          {delivery.estimatedArrival && (
            <div className="flex items-center gap-1.5 text-brand-green">
              <Flag size={14} />
              <span>ETA: {delivery.estimatedArrival}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-neutral-500">
            <Package size={14} />
            <span>{delivery.materials.length} items</span>
          </div>
        </div>

        {/* Expandable section */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-neutral-700 space-y-4">
            {/* Customer contact */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User size={16} className="text-neutral-500" />
                <span className="text-sm text-neutral-300">{delivery.customerName}</span>
              </div>
              <button
                onClick={() => {
                  window.location.href = `tel:${delivery.customerPhone}`;
                  onCall?.(delivery.customerPhone);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600/20 text-green-400 rounded-lg text-sm hover:bg-green-600/30"
              >
                <Phone size={14} />
                {delivery.customerPhone}
              </button>
            </div>

            {/* Materials list */}
            <div>
              <h4 className="text-sm font-medium text-neutral-400 mb-2">Materials</h4>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {delivery.materials.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-1.5 px-3 bg-neutral-700/50 rounded-lg text-sm"
                  >
                    <span className="text-neutral-300">{item.name}</span>
                    <span className="text-neutral-400 font-medium">
                      {item.quantity} {item.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Special instructions */}
            {delivery.specialInstructions && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-400 font-medium">Special Instructions</p>
                <p className="text-sm text-yellow-200 mt-1">{delivery.specialInstructions}</p>
              </div>
            )}

            {/* Driver notes */}
            {delivery.driverNotes && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-blue-400 font-medium">Driver Notes</p>
                <p className="text-sm text-blue-200 mt-1">{delivery.driverNotes}</p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="mt-4 pt-4 border-t border-neutral-700">
            <div className="flex items-center gap-2">
              {/* Navigate button */}
              <div className="flex-1">
                <NavigateButton
                  address={delivery.address}
                  city={delivery.city}
                  state={delivery.state}
                  zip={delivery.zip}
                  size="sm"
                  fullWidth
                />
              </div>

              {/* Photo button */}
              {onTakePhoto && ['arrived', 'delivered'].includes(delivery.status) && (
                <button
                  onClick={() => onTakePhoto(delivery.id)}
                  className="p-2.5 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-white"
                >
                  <Camera size={20} />
                </button>
              )}

              {/* Expand toggle */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2.5 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-white"
              >
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            </div>

            {/* Next action button */}
            {nextAction && onStatusChange && (
              <button
                onClick={() => onStatusChange(delivery.id, nextAction.status)}
                className="w-full mt-3 py-3 bg-brand-green hover:bg-lime-400 text-black font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Play size={18} />
                {nextAction.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Delivery queue component
interface DeliveryQueueProps {
  deliveries: DeliveryItem[];
  onStatusChange?: (deliveryId: string, newStatus: DeliveryItem['status']) => void;
  onNavigate?: (delivery: DeliveryItem) => void;
  emptyMessage?: string;
}

export function DeliveryQueue({
  deliveries,
  onStatusChange,
  onNavigate,
  emptyMessage = 'No pending deliveries',
}: DeliveryQueueProps) {
  // Sort by priority, then by scheduled time
  const sortedDeliveries = [...deliveries].sort((a, b) => {
    const priorityOrder = { urgent: 0, rush: 1, normal: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return (a.scheduledTime || '').localeCompare(b.scheduledTime || '');
  });

  if (sortedDeliveries.length === 0) {
    return (
      <div className="text-center py-12">
        <Truck className="mx-auto text-neutral-600" size={48} />
        <p className="text-neutral-400 mt-4">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedDeliveries.map((delivery) => (
        <DeliveryCard
          key={delivery.id}
          delivery={delivery}
          onStatusChange={onStatusChange}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}
