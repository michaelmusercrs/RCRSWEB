'use client';

import { useState } from 'react';
import { MapPin, Navigation, Truck, Clock, Package, ExternalLink, Maximize2, X } from 'lucide-react';

// Service area configuration for Huntsville, AL region
const SERVICE_AREA = {
  center: { lat: 34.7304, lng: -86.5861 },
  zoom: 10,
  bounds: {
    north: 35.2,
    south: 34.2,
    east: -86.0,
    west: -87.2,
  },
};

// Warehouse location
const WAREHOUSE = {
  lat: 34.7304,
  lng: -86.5861,
  address: '2710 Memorial Pkwy SW, Huntsville, AL 35801',
};

export interface MapDelivery {
  id: string;
  jobName: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  lat?: number;
  lng?: number;
  status: 'pending' | 'en_route' | 'arrived' | 'delivered';
  priority: 'normal' | 'rush' | 'urgent';
  scheduledTime?: string;
  customerName?: string;
  itemCount?: number;
  estimatedArrival?: string;
}

interface DeliveryMapProps {
  deliveries: MapDelivery[];
  selectedDeliveryId?: string;
  onSelectDelivery?: (deliveryId: string) => void;
  showWarehouse?: boolean;
  showServiceArea?: boolean;
  height?: string;
}

export default function DeliveryMap({
  deliveries,
  selectedDeliveryId,
  onSelectDelivery,
  showWarehouse = true,
  showServiceArea = true,
  height = '400px',
}: DeliveryMapProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Build Google Maps embed URL
  const buildEmbedUrl = () => {
    if (deliveries.length === 0) {
      // Show service area centered map
      return `https://www.google.com/maps/embed/v1/place?key=&q=${WAREHOUSE.lat},${WAREHOUSE.lng}&zoom=10`;
    }

    if (deliveries.length === 1) {
      const d = deliveries[0];
      const address = encodeURIComponent(`${d.address}, ${d.city}, ${d.state} ${d.zip || ''}`);
      return `https://www.google.com/maps/embed/v1/place?key=&q=${address}`;
    }

    // Multiple deliveries - show directions
    const origin = encodeURIComponent(WAREHOUSE.address);
    const waypoints = deliveries.slice(0, -1).map(d =>
      encodeURIComponent(`${d.address}, ${d.city}, ${d.state}`)
    ).join('|');
    const destination = encodeURIComponent(
      `${deliveries[deliveries.length - 1].address}, ${deliveries[deliveries.length - 1].city}, ${deliveries[deliveries.length - 1].state}`
    );

    return `https://www.google.com/maps/embed/v1/directions?key=&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}`;
  };

  // Open in full Google Maps
  const openFullMap = () => {
    if (deliveries.length === 0) {
      window.open(`https://www.google.com/maps/@${WAREHOUSE.lat},${WAREHOUSE.lng},11z`, '_blank');
      return;
    }

    const origin = encodeURIComponent(WAREHOUSE.address);
    const stops = deliveries.map(d =>
      encodeURIComponent(`${d.address}, ${d.city}, ${d.state} ${d.zip || ''}`)
    );

    if (stops.length === 1) {
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${stops[0]}`, '_blank');
    } else {
      const waypoints = stops.slice(0, -1).join('|');
      const destination = stops[stops.length - 1];
      window.open(
        `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}`,
        '_blank'
      );
    }
  };

  // Status colors
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500',
    en_route: 'bg-blue-500',
    arrived: 'bg-purple-500',
    delivered: 'bg-green-500',
  };

  const priorityColors: Record<string, string> = {
    normal: 'border-neutral-500',
    rush: 'border-orange-500',
    urgent: 'border-red-500',
  };

  const MapContent = () => (
    <div className="relative w-full h-full bg-neutral-800 rounded-xl overflow-hidden">
      {/* Map Placeholder - In production, use Google Maps API or similar */}
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-700 to-neutral-900">
        {/* Simple visual representation */}
        <div className="absolute inset-4 border border-neutral-600 rounded-lg opacity-30" />

        {/* Service area indicator */}
        {showServiceArea && (
          <div className="absolute top-4 left-4 bg-black/50 rounded-lg px-3 py-2 text-xs text-neutral-300">
            <span className="text-brand-green font-semibold">Service Area:</span> North Alabama
          </div>
        )}

        {/* Warehouse marker */}
        {showWarehouse && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              <div className="w-10 h-10 bg-brand-green rounded-full flex items-center justify-center shadow-lg">
                <Truck size={20} className="text-black" />
              </div>
              <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap text-xs text-white bg-black/70 px-2 py-1 rounded">
                Warehouse
              </div>
            </div>
          </div>
        )}

        {/* Delivery markers - positioned in a simple grid for visualization */}
        {deliveries.map((delivery, index) => {
          const angle = (index / deliveries.length) * 2 * Math.PI;
          const radius = 80 + (index % 3) * 30;
          const x = 50 + (Math.cos(angle) * radius / 4);
          const y = 50 + (Math.sin(angle) * radius / 4);

          return (
            <button
              key={delivery.id}
              onClick={() => onSelectDelivery?.(delivery.id)}
              className={`
                absolute transform -translate-x-1/2 -translate-y-1/2
                transition-all duration-200 hover:scale-110 z-10
                ${selectedDeliveryId === delivery.id ? 'scale-125 z-20' : ''}
              `}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center shadow-lg
                border-2 ${priorityColors[delivery.priority]}
                ${statusColors[delivery.status]}
              `}>
                <span className="text-white text-xs font-bold">{index + 1}</span>
              </div>
            </button>
          );
        })}

        {/* No deliveries message */}
        {deliveries.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-neutral-400">
              <MapPin size={48} className="mx-auto mb-2 opacity-50" />
              <p>No deliveries to display</p>
            </div>
          </div>
        )}
      </div>

      {/* Map controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-10 h-10 bg-neutral-800 hover:bg-neutral-700 rounded-lg flex items-center justify-center text-white shadow-lg"
        >
          {isExpanded ? <X size={20} /> : <Maximize2 size={20} />}
        </button>
        <button
          onClick={openFullMap}
          className="w-10 h-10 bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center justify-center text-white shadow-lg"
          title="Open in Google Maps"
        >
          <ExternalLink size={20} />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-black/70 rounded-lg p-3 text-xs text-white">
        <div className="font-semibold mb-2">Status</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>En Route</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span>Arrived</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Delivered</span>
          </div>
        </div>
      </div>

      {/* Delivery count */}
      <div className="absolute bottom-4 right-4 bg-black/70 rounded-lg px-3 py-2 text-white text-sm">
        <span className="font-semibold text-brand-green">{deliveries.length}</span> deliveries
      </div>
    </div>
  );

  // Expanded modal view
  if (isExpanded) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
        <div className="w-full max-w-6xl h-[80vh]">
          <MapContent />
        </div>
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <MapContent />
    </div>
  );
}

// Delivery list with map integration
interface DeliveryMapListProps {
  deliveries: MapDelivery[];
  onNavigate?: (delivery: MapDelivery) => void;
  onSelect?: (delivery: MapDelivery) => void;
}

export function DeliveryMapList({ deliveries, onNavigate, onSelect }: DeliveryMapListProps) {
  const statusLabels: Record<string, string> = {
    pending: 'Pending',
    en_route: 'En Route',
    arrived: 'Arrived',
    delivered: 'Delivered',
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    en_route: 'bg-blue-500/20 text-blue-400',
    arrived: 'bg-purple-500/20 text-purple-400',
    delivered: 'bg-green-500/20 text-green-400',
  };

  return (
    <div className="space-y-2">
      {deliveries.map((delivery, index) => (
        <div
          key={delivery.id}
          className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 hover:border-neutral-600 transition-colors"
        >
          <div className="flex items-start gap-4">
            {/* Stop number */}
            <div className="flex-shrink-0 w-8 h-8 bg-brand-green rounded-full flex items-center justify-center">
              <span className="text-black font-bold text-sm">{index + 1}</span>
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-white truncate">{delivery.jobName}</h3>
                  {delivery.customerName && (
                    <p className="text-sm text-neutral-400">{delivery.customerName}</p>
                  )}
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[delivery.status]}`}>
                  {statusLabels[delivery.status]}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-2 text-sm text-neutral-400">
                <MapPin size={14} />
                <span className="truncate">{delivery.address}, {delivery.city}</span>
              </div>

              <div className="flex items-center gap-4 mt-2 text-sm">
                {delivery.scheduledTime && (
                  <div className="flex items-center gap-1 text-neutral-500">
                    <Clock size={14} />
                    <span>{delivery.scheduledTime}</span>
                  </div>
                )}
                {delivery.itemCount && (
                  <div className="flex items-center gap-1 text-neutral-500">
                    <Package size={14} />
                    <span>{delivery.itemCount} items</span>
                  </div>
                )}
                {delivery.priority !== 'normal' && (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    delivery.priority === 'urgent'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-orange-500/20 text-orange-400'
                  }`}>
                    {delivery.priority.toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            {/* Navigate button */}
            <button
              onClick={() => {
                const address = encodeURIComponent(
                  `${delivery.address}, ${delivery.city}, ${delivery.state} ${delivery.zip || ''}`
                );
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${address}`, '_blank');
                onNavigate?.(delivery);
              }}
              className="flex-shrink-0 w-10 h-10 bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center justify-center text-white"
            >
              <Navigation size={20} />
            </button>
          </div>
        </div>
      ))}

      {deliveries.length === 0 && (
        <div className="text-center py-12">
          <MapPin className="mx-auto text-neutral-600" size={48} />
          <p className="text-neutral-400 mt-4">No deliveries to display</p>
        </div>
      )}
    </div>
  );
}
