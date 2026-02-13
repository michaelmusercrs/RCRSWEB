'use client';

/**
 * StormAlert Component
 *
 * Displays storm and hail alerts with call-to-action for contacting about storm damage.
 * Used in customer portal to notify customers of potential roof damage situations.
 *
 * Features:
 * - Hail alert banner with severity indicator
 * - "Contact us about storm damage" CTA
 * - Push notification concept (visual)
 * - Dismissible alerts
 */

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CloudLightning,
  Phone,
  X,
  Bell,
  Shield,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import type { WeatherAlert, StormRisk, HailReport } from '@/lib/weather-service';

interface StormAlertProps {
  zipcode?: string;
  address?: string;
  showCTA?: boolean;
  companyPhone?: string;
  onDismiss?: () => void;
  className?: string;
}

interface AlertData {
  alerts: WeatherAlert[];
  stormRisk: StormRisk;
  hasActiveAlerts: boolean;
  hasHailRisk: boolean;
  affectsRoofing: boolean;
  hailReports?: HailReport[];
}

export default function StormAlert({
  zipcode = '35640',
  address,
  showCTA = true,
  companyPhone = '256-274-8530',
  onDismiss,
  className = '',
}: StormAlertProps) {
  const [alertData, setAlertData] = useState<AlertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [showNotificationBanner, setShowNotificationBanner] = useState(false);

  useEffect(() => {
    fetchAlerts();
  }, [zipcode, address]);

  const fetchAlerts = async () => {
    setLoading(true);

    try {
      const response = await fetch(
        `/api/weather/alerts/${zipcode}?includeHailReports=true&daysBack=7`
      );
      const data = await response.json();

      if (data.success && data.data) {
        setAlertData(data.data);

        // Show notification banner if there are severe alerts
        if (
          data.data.alerts.some(
            (a: WeatherAlert) => a.severity === 'severe' || a.severity === 'extreme'
          )
        ) {
          setShowNotificationBanner(true);
        }
      }
    } catch (err) {
      console.error('Alert fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const dismissAlert = (alertId: string) => {
    setDismissed(new Set([...dismissed, alertId]));
  };

  const getSeverityColor = (severity: WeatherAlert['severity']) => {
    switch (severity) {
      case 'extreme':
        return 'bg-red-600 border-red-500';
      case 'severe':
        return 'bg-red-500/20 border-red-500/50';
      case 'moderate':
        return 'bg-orange-500/20 border-orange-500/50';
      default:
        return 'bg-yellow-500/20 border-yellow-500/50';
    }
  };

  const getSeverityTextColor = (severity: WeatherAlert['severity']) => {
    switch (severity) {
      case 'extreme':
        return 'text-white';
      case 'severe':
        return 'text-red-400';
      case 'moderate':
        return 'text-orange-400';
      default:
        return 'text-yellow-400';
    }
  };

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (!alertData || (!alertData.hasActiveAlerts && !alertData.hailReports?.length)) {
    return null; // No alerts to show
  }

  const activeAlerts = alertData.alerts.filter((alert) => !dismissed.has(alert.id));
  const recentHailReports = alertData.hailReports?.slice(0, 3) || [];

  if (activeAlerts.length === 0 && recentHailReports.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Push Notification Concept Banner */}
      {showNotificationBanner && (
        <div className="bg-gradient-to-r from-lime-500/20 to-transparent rounded-xl border border-lime-500/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-lime-500/20 p-2">
                <Bell className="h-5 w-5 text-lime-400" />
              </div>
              <div>
                <p className="font-medium text-white">Stay Informed About Storm Damage</p>
                <p className="text-sm text-zinc-400">
                  Enable notifications to get alerts when severe weather affects your area
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowNotificationBanner(false)}
              className="px-4 py-2 bg-lime-500 text-black text-sm font-medium rounded-lg hover:bg-lime-400 transition-colors"
            >
              Enable Alerts
            </button>
          </div>
        </div>
      )}

      {/* Active Weather Alerts */}
      {activeAlerts.map((alert) => (
        <div
          key={alert.id}
          className={`rounded-xl border ${getSeverityColor(alert.severity)} overflow-hidden`}
        >
          <div className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {alert.type === 'hail' || alert.isHailRelated ? (
                  <div className="rounded-full bg-blue-500/20 p-2">
                    <CloudLightning className="h-6 w-6 text-blue-400" />
                  </div>
                ) : (
                  <div className={`rounded-full p-2 ${
                    alert.severity === 'extreme' ? 'bg-white/20' : 'bg-red-500/20'
                  }`}>
                    <AlertTriangle className={`h-6 w-6 ${
                      alert.severity === 'extreme' ? 'text-white' : 'text-red-400'
                    }`} />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={`font-bold ${getSeverityTextColor(alert.severity)}`}>
                      {alert.event}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      alert.severity === 'extreme'
                        ? 'bg-white/20 text-white'
                        : alert.severity === 'severe'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-orange-500/20 text-orange-400'
                    }`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    {alert.isHailRelated && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                        HAIL RISK
                      </span>
                    )}
                  </div>
                  <p className={`mt-1 text-sm ${
                    alert.severity === 'extreme' ? 'text-white/80' : 'text-zinc-400'
                  }`}>
                    {alert.headline}
                  </p>
                  {alert.expires && (
                    <p className={`mt-2 text-xs ${
                      alert.severity === 'extreme' ? 'text-white/60' : 'text-zinc-500'
                    }`}>
                      Expires: {new Date(alert.expires).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => dismissAlert(alert.id)}
                className={`p-1 rounded hover:bg-white/10 transition-colors ${
                  alert.severity === 'extreme' ? 'text-white/60' : 'text-zinc-500'
                }`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Storm Damage CTA */}
          {showCTA && alert.affectsRoofing && (
            <div className={`px-4 py-3 border-t ${
              alert.severity === 'extreme'
                ? 'bg-white/10 border-white/20'
                : 'bg-zinc-900/50 border-zinc-800'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className={`h-4 w-4 ${
                    alert.severity === 'extreme' ? 'text-white' : 'text-lime-400'
                  }`} />
                  <span className={`text-sm font-medium ${
                    alert.severity === 'extreme' ? 'text-white' : 'text-white'
                  }`}>
                    Worried about roof damage?
                  </span>
                </div>
                <a
                  href={`tel:${companyPhone}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-lime-500 text-black text-sm font-bold rounded-lg hover:bg-lime-400 transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  Call for Free Inspection
                </a>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Recent Hail Reports in Area */}
      {recentHailReports.length > 0 && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CloudLightning className="h-5 w-5 text-blue-400" />
              <h3 className="font-bold text-white">Recent Hail Reports Near You</h3>
            </div>
            <div className="space-y-2">
              {recentHailReports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg"
                >
                  <div>
                    <p className="text-white font-medium">
                      {report.location}, {report.county}
                    </p>
                    <p className="text-sm text-zinc-400">
                      {report.hailSize} hail - {report.distance} miles away
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      report.severity === 'severe'
                        ? 'bg-red-500/20 text-red-400'
                        : report.severity === 'moderate'
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {report.severity.toUpperCase()}
                    </span>
                    <p className="text-xs text-zinc-500 mt-1">
                      {new Date(report.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hail Damage CTA */}
          {showCTA && (
            <div className="px-4 py-3 border-t border-blue-500/30 bg-zinc-900/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Hail can cause hidden roof damage</p>
                  <p className="text-sm text-zinc-400">Get a free inspection to check your roof</p>
                </div>
                <a
                  href={`tel:${companyPhone}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white text-sm font-bold rounded-lg hover:bg-blue-400 transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  {companyPhone}
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Storm Risk Summary */}
      {alertData.stormRisk && alertData.stormRisk.level !== 'low' && (
        <div className={`rounded-xl border p-4 ${
          alertData.stormRisk.level === 'severe'
            ? 'bg-red-500/10 border-red-500/30'
            : alertData.stormRisk.level === 'high'
            ? 'bg-orange-500/10 border-orange-500/30'
            : 'bg-yellow-500/10 border-yellow-500/30'
        }`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={`h-5 w-5 ${
              alertData.stormRisk.level === 'severe'
                ? 'text-red-400'
                : alertData.stormRisk.level === 'high'
                ? 'text-orange-400'
                : 'text-yellow-400'
            }`} />
            <div>
              <h4 className="font-medium text-white">
                {alertData.stormRisk.level.charAt(0).toUpperCase() + alertData.stormRisk.level.slice(1)} Storm Risk
              </h4>
              <p className="text-sm text-zinc-400 mt-1">{alertData.stormRisk.message}</p>
              {alertData.stormRisk.hasHailRisk && (
                <div className="flex items-center gap-2 mt-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-400" />
                  <span className="text-sm text-blue-400">Hail potential in forecast</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact Storm Alert Banner
 *
 * A smaller version for use in headers or notification areas
 */
export function StormAlertBanner({
  zipcode = '35640',
  companyPhone = '256-274-8530',
}: {
  zipcode?: string;
  companyPhone?: string;
}) {
  const [hasAlert, setHasAlert] = useState(false);
  const [alertType, setAlertType] = useState<'hail' | 'storm' | 'weather'>('weather');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkAlerts = async () => {
      try {
        const response = await fetch(`/api/weather/alerts/${zipcode}`);
        const data = await response.json();

        if (data.success && data.data) {
          const alerts = data.data.alerts || [];
          const hasHail = alerts.some((a: WeatherAlert) => a.isHailRelated);
          const hasSevere = alerts.some(
            (a: WeatherAlert) => a.severity === 'severe' || a.severity === 'extreme'
          );

          setHasAlert(alerts.length > 0);
          setAlertType(hasHail ? 'hail' : hasSevere ? 'storm' : 'weather');
        }
      } catch (err) {
        console.error('Alert check error:', err);
      }
    };

    checkAlerts();
  }, [zipcode]);

  if (!hasAlert || dismissed) {
    return null;
  }

  return (
    <div className={`w-full py-2 px-4 ${
      alertType === 'hail'
        ? 'bg-blue-600'
        : alertType === 'storm'
        ? 'bg-red-600'
        : 'bg-orange-600'
    }`}>
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          {alertType === 'hail' ? (
            <CloudLightning className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          <span className="text-sm font-medium">
            {alertType === 'hail'
              ? 'Hail Alert: Your area may have experienced hail damage'
              : alertType === 'storm'
              ? 'Severe Weather Alert: Storm activity in your area'
              : 'Weather Advisory: Check your roof for potential damage'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={`tel:${companyPhone}`}
            className="text-sm text-white font-bold hover:underline flex items-center gap-1"
          >
            <Phone className="h-4 w-4" />
            Free Inspection
          </a>
          <button
            onClick={() => setDismissed(true)}
            className="text-white/70 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
