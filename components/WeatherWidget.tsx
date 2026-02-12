'use client';

/**
 * WeatherWidget Component
 *
 * Displays current weather conditions and 7-day forecast.
 * Used in customer portal dashboard and command center.
 *
 * Features:
 * - Current temperature and conditions
 * - 7-day forecast with workability indicators
 * - Storm risk level badge
 * - Responsive design
 */

import { useState, useEffect } from 'react';
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  CloudFog,
  Wind,
  Droplets,
  Thermometer,
  AlertTriangle,
  RefreshCw,
  MapPin,
  type LucideIcon,
} from 'lucide-react';
import type { WeatherData, DayForecast, StormRisk } from '@/lib/weather-service';

interface WeatherWidgetProps {
  zipcode?: string;
  address?: string;
  showForecast?: boolean;
  showAlerts?: boolean;
  compact?: boolean;
  onStormRiskChange?: (risk: StormRisk) => void;
  className?: string;
}

// Map weather icon names to Lucide icons
const WEATHER_ICONS: Record<string, LucideIcon> = {
  sun: Sun,
  'cloud-sun': Cloud,
  cloud: Cloud,
  'cloud-rain': CloudRain,
  'cloud-snow': CloudSnow,
  'cloud-lightning': CloudLightning,
  'cloud-drizzle': CloudDrizzle,
  'cloud-fog': CloudFog,
};

// Storm risk level colors
const RISK_COLORS: Record<StormRisk['level'], { bg: string; text: string; border: string }> = {
  low: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
  moderate: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  severe: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
};

export default function WeatherWidget({
  zipcode = '35640',
  address,
  showForecast = true,
  showAlerts = true,
  compact = false,
  onStormRiskChange,
  className = '',
}: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWeather();
  }, [zipcode, address]);

  const fetchWeather = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/weather/forecast/${zipcode}`);
      const data = await response.json();

      if (data.success && data.data) {
        setWeather(data.data);
        if (onStormRiskChange && data.data.stormRisk) {
          onStormRiskChange(data.data.stormRisk);
        }
      } else {
        setError(data.error || 'Failed to load weather data');
      }
    } catch (err) {
      console.error('Weather fetch error:', err);
      setError('Unable to load weather data');
    } finally {
      setLoading(false);
    }
  };

  const getWeatherIcon = (iconName: string): LucideIcon => {
    return WEATHER_ICONS[iconName] || Cloud;
  };

  if (loading) {
    return (
      <div className={`rounded-xl border border-zinc-800 bg-zinc-900 p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-lime-400" />
          <span className="ml-2 text-zinc-400">Loading weather...</span>
        </div>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className={`rounded-xl border border-zinc-800 bg-zinc-900 p-6 ${className}`}>
        <div className="text-center py-8">
          <Cloud className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-2 text-zinc-400">{error || 'Unable to load weather'}</p>
          <button
            onClick={fetchWeather}
            className="mt-4 px-4 py-2 text-sm bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const CurrentIcon = getWeatherIcon(weather.current.icon);
  const riskColors = RISK_COLORS[weather.stormRisk?.level || 'low'];

  if (compact) {
    return (
      <div className={`rounded-xl border border-zinc-800 bg-zinc-900 p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-zinc-800 p-2">
              <CurrentIcon className="h-6 w-6 text-lime-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{weather.current.temp}°F</p>
              <p className="text-sm text-zinc-400">{weather.current.condition}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500">{weather.location}</p>
            {weather.stormRisk && (
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${riskColors.bg} ${riskColors.text}`}>
                {weather.stormRisk.level.charAt(0).toUpperCase() + weather.stormRisk.level.slice(1)} Risk
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden ${className}`}>
      {/* Header with current weather */}
      <div className="p-6 bg-gradient-to-br from-lime-500/10 to-transparent">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm">
            <MapPin className="h-4 w-4" />
            {weather.location}
          </div>
          <button
            onClick={fetchWeather}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            title="Refresh weather"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-6">
          <div className="rounded-2xl bg-lime-500/20 p-4">
            <CurrentIcon className="h-12 w-12 text-lime-400" />
          </div>
          <div>
            <p className="text-5xl font-bold text-white">{weather.current.temp}°F</p>
            <p className="text-zinc-400 mt-1">{weather.current.condition}</p>
          </div>
        </div>

        {/* Current conditions details */}
        <div className="flex gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2 text-zinc-400">
            <Thermometer className="h-4 w-4" />
            <span>Feels like {weather.current.feelsLike}°F</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <Wind className="h-4 w-4" />
            <span>{weather.current.windSpeed} mph</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <Droplets className="h-4 w-4" />
            <span>{weather.current.humidity}%</span>
          </div>
        </div>

        {/* Workability indicator */}
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${
            weather.current.isWorkable
              ? 'bg-green-500/10 text-green-400'
              : 'bg-red-500/10 text-red-400'
          }`}>
            {weather.current.isWorkable ? (
              <>
                <Sun className="h-4 w-4" />
                <span className="text-sm font-medium">Good for Roofing Work</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {weather.current.workabilityReason || 'Weather Hold'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Storm Risk Banner */}
      {showAlerts && weather.stormRisk && (
        <div className={`px-6 py-3 border-t ${riskColors.border} ${riskColors.bg}`}>
          <div className="flex items-center gap-3">
            {weather.stormRisk.level !== 'low' && (
              <AlertTriangle className={`h-5 w-5 ${riskColors.text}`} />
            )}
            <div>
              <span className={`font-medium ${riskColors.text}`}>
                {weather.stormRisk.level.charAt(0).toUpperCase() + weather.stormRisk.level.slice(1)} Storm Risk
              </span>
              <p className="text-sm text-zinc-400">{weather.stormRisk.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* 7-Day Forecast */}
      {showForecast && (
        <div className="border-t border-zinc-800">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h3 className="font-semibold text-white">7-Day Forecast</h3>
          </div>
          <div className="divide-y divide-zinc-800">
            {weather.forecast.map((day: DayForecast, index: number) => {
              const DayIcon = getWeatherIcon(day.icon);
              return (
                <div
                  key={day.date}
                  className={`px-6 py-3 flex items-center gap-4 ${
                    !day.isWorkable ? 'bg-red-500/5' : ''
                  }`}
                >
                  <div className="w-24">
                    <span className="text-white font-medium">{day.dayOfWeek}</span>
                  </div>
                  <DayIcon className={`h-5 w-5 ${day.isWorkable ? 'text-lime-400' : 'text-red-400'}`} />
                  <div className="flex-1 text-zinc-400 text-sm">{day.condition}</div>
                  <div className="text-right">
                    <span className="text-white font-medium">{day.high}°</span>
                    <span className="text-zinc-500 ml-1">/ {day.low}°</span>
                  </div>
                  <div className="w-20 text-right">
                    <span className={`text-xs px-2 py-1 rounded ${
                      day.isWorkable
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {day.isWorkable ? 'Workable' : 'Hold'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Alerts List */}
      {showAlerts && weather.alerts && weather.alerts.length > 0 && (
        <div className="border-t border-zinc-800 p-6">
          <h3 className="font-semibold text-white mb-4">Active Weather Alerts</h3>
          <div className="space-y-3">
            {weather.alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border ${
                  alert.severity === 'extreme' || alert.severity === 'severe'
                    ? 'bg-red-500/10 border-red-500/30'
                    : alert.severity === 'moderate'
                    ? 'bg-orange-500/10 border-orange-500/30'
                    : 'bg-yellow-500/10 border-yellow-500/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${
                    alert.severity === 'extreme' || alert.severity === 'severe'
                      ? 'text-red-400'
                      : alert.severity === 'moderate'
                      ? 'text-orange-400'
                      : 'text-yellow-400'
                  }`} />
                  <div>
                    <p className="font-medium text-white">{alert.event}</p>
                    <p className="text-sm text-zinc-400 mt-1">{alert.headline}</p>
                    {alert.isHailRelated && (
                      <span className="inline-block mt-2 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                        Hail Risk
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last updated */}
      <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-950/50">
        <p className="text-xs text-zinc-500">
          Last updated: {new Date(weather.lastUpdated).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
