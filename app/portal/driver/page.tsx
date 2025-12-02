'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Truck, MapPin, Phone, Clock, CheckCircle2, Camera, Package,
  Navigation, ArrowLeft, Loader2, RefreshCw, User, AlertCircle
} from 'lucide-react';
import type { Delivery, Driver } from '@/lib/delivery-portal-service';

type DeliveryStatus = 'Scheduled' | 'Loaded' | 'En Route' | 'Arrived' | 'Delivered';

const statusColors: Record<DeliveryStatus, string> = {
  Scheduled: 'bg-yellow-500',
  Loaded: 'bg-blue-500',
  'En Route': 'bg-purple-500',
  Arrived: 'bg-orange-500',
  Delivered: 'bg-green-500',
};

const statusOrder: DeliveryStatus[] = ['Scheduled', 'Loaded', 'En Route', 'Arrived', 'Delivered'];

export default function DriverPortal() {
  const router = useRouter();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [view, setView] = useState<'list' | 'detail'>('list');

  useEffect(() => {
    const storedDriver = sessionStorage.getItem('driver');
    if (!storedDriver) {
      router.push('/portal');
      return;
    }
    setDriver(JSON.parse(storedDriver));
    loadDeliveries(JSON.parse(storedDriver).id);
  }, [router]);

  const loadDeliveries = async (driverId: string) => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const response = await fetch(`/api/portal/deliveries?driverId=${driverId}&date=${today}`);
      const data = await response.json();
      setDeliveries(data);
    } catch (error) {
      console.error('Error loading deliveries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmLoad = async (delivery: Delivery) => {
    if (!driver) return;
    setIsUpdating(true);
    try {
      await fetch('/api/portal/deliveries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryId: delivery.deliveryId,
          action: 'confirmLoad',
          driverName: driver.name,
        }),
      });
      await loadDeliveries(driver.id);
      setSelectedDelivery(null);
    } catch (error) {
      console.error('Error confirming load:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusUpdate = async (delivery: Delivery, newStatus: DeliveryStatus) => {
    if (!driver) return;
    setIsUpdating(true);
    try {
      await fetch('/api/portal/deliveries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryId: delivery.deliveryId,
          action: 'updateStatus',
          status: newStatus,
        }),
      });
      await loadDeliveries(driver.id);

      // If delivered, go back to list
      if (newStatus === 'Delivered') {
        setView('list');
        setSelectedDelivery(null);
      } else {
        // Refresh selected delivery
        const updated = deliveries.find(d => d.deliveryId === delivery.deliveryId);
        if (updated) setSelectedDelivery({ ...updated, status: newStatus });
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const getNextStatus = (current: DeliveryStatus): DeliveryStatus | null => {
    const currentIndex = statusOrder.indexOf(current);
    if (currentIndex < statusOrder.length - 1) {
      return statusOrder[currentIndex + 1];
    }
    return null;
  };

  const openNavigation = (address: string) => {
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('driver');
    router.push('/portal');
  };

  if (!driver) return null;

  // Delivery Detail View
  if (view === 'detail' && selectedDelivery) {
    const nextStatus = getNextStatus(selectedDelivery.status as DeliveryStatus);

    return (
      <div className="min-h-screen bg-neutral-900">
        {/* Header */}
        <div className="bg-neutral-800 border-b border-neutral-700 p-4">
          <button
            onClick={() => { setView('list'); setSelectedDelivery(null); }}
            className="flex items-center gap-2 text-neutral-400 hover:text-white mb-3"
          >
            <ArrowLeft size={20} />
            Back to List
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-white">{selectedDelivery.jobName}</h1>
              <p className="text-sm text-neutral-400">{selectedDelivery.deliveryId}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${statusColors[selectedDelivery.status as DeliveryStatus]}`}>
              {selectedDelivery.status}
            </span>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Customer Info */}
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
            <h3 className="font-semibold text-white mb-3">Customer</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-neutral-300">
                <User size={18} className="text-neutral-500" />
                {selectedDelivery.customerName}
              </div>
              <a
                href={`tel:${selectedDelivery.customerPhone}`}
                className="flex items-center gap-3 text-brand-green"
              >
                <Phone size={18} />
                {selectedDelivery.customerPhone}
              </a>
            </div>
          </div>

          {/* Address & Navigation */}
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
            <h3 className="font-semibold text-white mb-3">Delivery Address</h3>
            <p className="text-neutral-300 mb-3">{selectedDelivery.jobAddress}</p>
            <button
              onClick={() => openNavigation(selectedDelivery.jobAddress)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
            >
              <Navigation size={20} />
              Open in Maps
            </button>
          </div>

          {/* Materials */}
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
            <h3 className="font-semibold text-white mb-3">Materials</h3>
            <div className="text-neutral-300 whitespace-pre-wrap">
              {selectedDelivery.materials}
            </div>
          </div>

          {/* Time Tracking */}
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
            <h3 className="font-semibold text-white mb-3">Timeline</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-400">Scheduled</span>
                <span className="text-white">{selectedDelivery.scheduledTime}</span>
              </div>
              {selectedDelivery.loadConfirmedTime && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">Load Confirmed</span>
                  <span className="text-white">
                    {new Date(selectedDelivery.loadConfirmedTime).toLocaleTimeString()}
                  </span>
                </div>
              )}
              {selectedDelivery.departedTime && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">Departed</span>
                  <span className="text-white">
                    {new Date(selectedDelivery.departedTime).toLocaleTimeString()}
                  </span>
                </div>
              )}
              {selectedDelivery.arrivedTime && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">Arrived</span>
                  <span className="text-white">
                    {new Date(selectedDelivery.arrivedTime).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pb-6">
            {/* Confirm Load Button */}
            {selectedDelivery.status === 'Scheduled' && !selectedDelivery.loadConfirmed && (
              <button
                onClick={() => handleConfirmLoad(selectedDelivery)}
                disabled={isUpdating}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2"
              >
                {isUpdating ? <Loader2 className="animate-spin" size={20} /> : <Package size={20} />}
                Confirm Load
              </button>
            )}

            {/* Take Photo Button */}
            <button className="w-full bg-neutral-700 hover:bg-neutral-600 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2">
              <Camera size={20} />
              Take Photo ({selectedDelivery.photoCount} uploaded)
            </button>

            {/* Next Status Button */}
            {nextStatus && selectedDelivery.status !== 'Scheduled' && (
              <button
                onClick={() => handleStatusUpdate(selectedDelivery, nextStatus)}
                disabled={isUpdating}
                className={`w-full font-bold py-4 rounded-lg flex items-center justify-center gap-2 ${
                  nextStatus === 'Delivered'
                    ? 'bg-green-600 hover:bg-green-500'
                    : 'bg-brand-green hover:bg-lime-400 text-black'
                } disabled:bg-neutral-700 disabled:text-neutral-500`}
              >
                {isUpdating ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : nextStatus === 'Delivered' ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <Truck size={20} />
                )}
                {nextStatus === 'En Route' && 'Start Delivery'}
                {nextStatus === 'Arrived' && 'Mark Arrived'}
                {nextStatus === 'Delivered' && 'Complete Delivery'}
              </button>
            )}
          </div>
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
          onClick={() => loadDeliveries(driver.id)}
          disabled={isLoading}
          className="p-2 bg-neutral-800 rounded-lg hover:bg-neutral-700"
        >
          <RefreshCw size={20} className={`text-neutral-400 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Deliveries List */}
      <div className="px-4 pb-6 space-y-3">
        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="animate-spin mx-auto text-brand-green" size={32} />
            <p className="text-neutral-400 mt-2">Loading deliveries...</p>
          </div>
        ) : deliveries.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="mx-auto text-neutral-600" size={48} />
            <p className="text-neutral-400 mt-2">No deliveries scheduled for today</p>
          </div>
        ) : (
          deliveries.map(delivery => (
            <button
              key={delivery.deliveryId}
              onClick={() => { setSelectedDelivery(delivery); setView('detail'); }}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-left hover:border-neutral-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-white">{delivery.jobName}</h3>
                  <p className="text-sm text-neutral-400">{delivery.customerName}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${statusColors[delivery.status as DeliveryStatus]}`}>
                  {delivery.status}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm text-neutral-400 mb-2">
                <MapPin size={14} />
                <span className="truncate">{delivery.jobAddress}</span>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-neutral-500">
                  <Clock size={14} />
                  {delivery.scheduledTime}
                </div>
                {delivery.loadConfirmed && (
                  <div className="flex items-center gap-1 text-green-500">
                    <CheckCircle2 size={14} />
                    Loaded
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
