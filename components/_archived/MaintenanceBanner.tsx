'use client';

/**
 * Maintenance Banner Component
 *
 * Displays a banner when maintenance mode is active.
 * Can be used in layouts to show across all pages.
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface MaintenanceData {
  maintenanceMode: boolean;
  message: string;
  endTime?: string;
  canBypass?: boolean;
}

interface MaintenanceBannerProps {
  variant?: 'full' | 'banner';
  showClose?: boolean;
  onBypass?: () => void;
}

export default function MaintenanceBanner({
  variant = 'banner',
  showClose = false,
  onBypass,
}: MaintenanceBannerProps) {
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const res = await fetch('/api/admin/system/maintenance');
        const data = await res.json();
        if (data.success) {
          setMaintenanceData(data.data);
        }
      } catch (error) {
        console.error('Error checking maintenance status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkMaintenance();

    // Check periodically
    const interval = setInterval(checkMaintenance, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !maintenanceData?.maintenanceMode || dismissed) {
    return null;
  }

  // Format end time if available
  const formatEndTime = (endTime: string) => {
    const date = new Date(endTime);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Full page maintenance mode
  if (variant === 'full') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900">
        <div className="max-w-md mx-auto px-6 py-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-500 rounded-full mb-6">
            <AlertTriangle className="w-10 h-10 text-black" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">Under Maintenance</h1>
          <p className="text-gray-300 text-lg mb-6">{maintenanceData.message}</p>
          {maintenanceData.endTime && (
            <p className="text-gray-400">
              Expected back: {formatEndTime(maintenanceData.endTime)}
            </p>
          )}
          {maintenanceData.canBypass && onBypass && (
            <button
              onClick={onBypass}
              className="mt-8 px-6 py-3 bg-brand-green hover:bg-lime-400 text-black font-semibold rounded-lg transition-colors"
            >
              Continue Anyway
            </button>
          )}
        </div>
      </div>
    );
  }

  // Banner mode
  return (
    <div className="bg-yellow-500 text-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">
              <span className="font-bold">Maintenance Mode:</span> {maintenanceData.message}
              {maintenanceData.endTime && (
                <span className="ml-2 text-yellow-800">
                  (Expected: {formatEndTime(maintenanceData.endTime)})
                </span>
              )}
            </p>
          </div>
          {showClose && (
            <button
              onClick={() => setDismissed(true)}
              className="p-1 hover:bg-yellow-600 rounded transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
