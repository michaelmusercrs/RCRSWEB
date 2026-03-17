'use client';

/**
 * RCRS Command Center - Weather & Storm Monitoring Dashboard
 *
 * Real-time NWS weather alerts, storm radar, storm history tracking,
 * customer impact analysis, and lead generation tools.
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  CloudRain,
  CloudLightning,
  Wind,
  Snowflake,
  Thermometer,
  Droplets,
  AlertTriangle,
  AlertCircle,
  MapPin,
  Users,
  TrendingUp,
  Calendar,
  Eye,
  Bell,
  Zap,
  Target,
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Loader2,
  Shield,
  ArrowLeft,
  Clock,
  Activity,
  BarChart3,
  Plus,
  Search,
  Filter,
  ExternalLink,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface WeatherAlert {
  id: string;
  type: string;
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  title: string;
  description: string;
  area: string;
  counties: string[];
  startTime: string;
  endTime: string;
  source: string;
  isActive: boolean;
  affectedCustomers: number;
  affectedJobs: number;
  hailSize?: string;
  windSpeed?: number;
  createdAt: string;
}

interface StormEvent {
  id: string;
  date: string;
  type: string;
  counties: string[];
  severity: string;
  hailSize?: string;
  windSpeed?: number;
  description: string;
  estimatedDamage: string;
  leadsGenerated: number;
  customersAffected: number;
  followUpStatus: string;
  notes: string;
  createdAt: string;
}

interface AlertsResponse {
  success: boolean;
  alerts: WeatherAlert[];
  total: number;
  activeCount: number;
  summary: {
    totalAffectedCustomers: number;
    totalAffectedJobs: number;
    hasSevereAlert: boolean;
    highestSeverity: string | null;
  };
}

interface StormsResponse {
  success: boolean;
  events: StormEvent[];
  total: number;
  totalAllTime: number;
  summary: {
    totalLeadsGenerated: number;
    pendingFollowUps: number;
    inProgressFollowUps: number;
  };
}

interface WeatherData {
  current: {
    temp: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    windGust?: number;
    condition: string;
    isWorkable: boolean;
    workabilityReason?: string;
  };
  forecast: Array<{
    date: string;
    dayOfWeek: string;
    high: number;
    low: number;
    condition: string;
    precipChance: number;
    windSpeed: number;
    isWorkable: boolean;
  }>;
  location: string;
  stormRisk: {
    level: string;
    message: string;
    hasActiveAlerts: boolean;
    hasHailRisk: boolean;
  };
}

interface ImpactData {
  affectedCustomers: number;
  affectedJobs: number;
  affectedZips: string[];
  potentialLeads: number;
  estimatedHomes?: number;
  conversionEstimate?: number;
  counties: string[];
  severity: string;
}

// =============================================================================
// Severity helpers
// =============================================================================

const SEVERITY_CONFIG: Record<string, { bg: string; border: string; text: string; badge: string; label: string }> = {
  extreme: { bg: 'bg-red-900/40', border: 'border-red-500/60', text: 'text-red-400', badge: 'bg-red-600 text-white', label: 'EXTREME' },
  severe:  { bg: 'bg-orange-900/40', border: 'border-orange-500/60', text: 'text-orange-400', badge: 'bg-orange-600 text-white', label: 'SEVERE' },
  moderate:{ bg: 'bg-yellow-900/40', border: 'border-yellow-500/60', text: 'text-yellow-400', badge: 'bg-yellow-600 text-black', label: 'MODERATE' },
  minor:   { bg: 'bg-blue-900/40', border: 'border-blue-500/60', text: 'text-blue-400', badge: 'bg-blue-600 text-white', label: 'MINOR' },
};

function getSeverityConfig(severity: string) {
  return SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.minor;
}

const ALERT_TYPE_ICONS: Record<string, typeof CloudLightning> = {
  severe_thunderstorm: CloudLightning,
  tornado: Wind,
  hail: CloudRain,
  wind: Wind,
  flood: Droplets,
  winter_storm: Snowflake,
  heat: Thermometer,
  general: AlertCircle,
};

function getAlertIcon(type: string) {
  return ALERT_TYPE_ICONS[type] || AlertCircle;
}

function formatAlertType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0) return 'Expired';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m remaining`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h remaining`;
  const days = Math.floor(hours / 24);
  return `${days}d remaining`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// =============================================================================
// Log Storm Modal
// =============================================================================

function LogStormModal({ onClose, onSubmit }: {
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState('hail');
  const [counties, setCounties] = useState('');
  const [severity, setSeverity] = useState('moderate');
  const [hailSize, setHailSize] = useState('');
  const [windSpeed, setWindSpeed] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedDamage, setEstimatedDamage] = useState('moderate');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit({
      date,
      type,
      counties: counties.split(',').map(c => c.trim()).filter(Boolean),
      severity,
      hailSize: hailSize || undefined,
      windSpeed: windSpeed ? parseInt(windSpeed, 10) : undefined,
      description,
      estimatedDamage,
    });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-black text-white uppercase tracking-wider">Log Storm Event</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <AlertCircle className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">Type *</label>
              <select value={type} onChange={e => setType(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14]">
                <option value="hail">Hail</option>
                <option value="severe_thunderstorm">Severe Thunderstorm</option>
                <option value="tornado">Tornado</option>
                <option value="wind">High Wind</option>
                <option value="flood">Flood</option>
                <option value="winter_storm">Winter Storm</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">Affected Counties * <span className="text-gray-500 font-normal">(comma-separated)</span></label>
            <input type="text" value={counties} onChange={e => setCounties(e.target.value)} required
              placeholder="Morgan, Madison, Limestone"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14]" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">Severity</label>
              <select value={severity} onChange={e => setSeverity(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14]">
                <option value="minor">Minor</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
                <option value="extreme">Extreme</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">Estimated Damage</label>
              <select value={estimatedDamage} onChange={e => setEstimatedDamage(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14]">
                <option value="none">None</option>
                <option value="minor">Minor</option>
                <option value="moderate">Moderate</option>
                <option value="significant">Significant</option>
                <option value="severe">Severe</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">Hail Size</label>
              <input type="text" value={hailSize} onChange={e => setHailSize(e.target.value)}
                placeholder='e.g., 1 inch, golf ball'
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">Wind Speed (mph)</label>
              <input type="number" value={windSpeed} onChange={e => setWindSpeed(e.target.value)}
                placeholder="e.g., 65"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14]" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="Describe the storm event..."
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14] resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-700 text-gray-300 font-bold rounded-lg hover:border-gray-500 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 py-2.5 bg-[#39FF14] text-black font-black uppercase tracking-wider rounded-lg hover:bg-lime-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Log Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function WeatherCommandCenterPage() {
  // State
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [alertsSummary, setAlertsSummary] = useState<AlertsResponse['summary'] | null>(null);
  const [storms, setStorms] = useState<StormEvent[]>([]);
  const [stormsSummary, setStormsSummary] = useState<StormsResponse['summary'] | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [expandedStorm, setExpandedStorm] = useState<string | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [impactData, setImpactData] = useState<ImpactData | null>(null);
  const [stormFilter, setStormFilter] = useState({ type: '', county: '' });
  const [lastRefresh, setLastRefresh] = useState<string>('');

  // Fetch all data
  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [alertsRes, stormsRes, weatherRes, impactRes] = await Promise.all([
        fetch('/api/weather/alerts?active=true').then(r => r.json()).catch(() => null),
        fetch('/api/weather/storms?limit=20').then(r => r.json()).catch(() => null),
        fetch('/api/weather/forecast/35601').then(r => r.json()).then(r => r.data || null).catch(() => null),
        fetch('/api/weather/impact').then(r => r.json()).catch(() => null),
      ]);

      if (alertsRes?.success) {
        setAlerts(alertsRes.alerts);
        setAlertsSummary(alertsRes.summary);
      }
      if (stormsRes?.success) {
        setStorms(stormsRes.events);
        setStormsSummary(stormsRes.summary);
      }
      if (weatherRes?.current) {
        setWeather(weatherRes);
      }
      if (impactRes?.success && impactRes.alerts) {
        // Aggregate impact from active alerts
        const allCounties = [...new Set((impactRes.alerts as Array<{ counties: string[] }>).flatMap((a: { counties: string[] }) => a.counties))];
        setImpactData({
          affectedCustomers: impactRes.totalAffectedCustomers || 0,
          affectedJobs: impactRes.totalAffectedJobs || 0,
          affectedZips: [],
          potentialLeads: 0,
          counties: allCounties,
          severity: 'moderate',
        });
      }

      setLastRefresh(new Date().toISOString());
    } catch (err) {
      console.error('Failed to fetch weather data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => fetchData(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Log storm event handler
  const handleLogStorm = async (data: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/weather/storms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        setShowLogModal(false);
        fetchData(true);
      }
    } catch (err) {
      console.error('Failed to log storm event:', err);
    }
  };

  // Generate lead list (for now, opens check-my-address with pre-populated data)
  const handleGenerateLeads = (alert: WeatherAlert) => {
    const counties = alert.counties.join(', ');
    window.open(`/check-my-address?source=storm-alert&counties=${encodeURIComponent(counties)}`, '_blank');
  };

  // Get impact for a specific alert
  const handleViewImpact = async (alertId: string) => {
    try {
      const res = await fetch(`/api/weather/impact?alertId=${alertId}`);
      const data = await res.json();
      if (data.success) {
        setImpactData(data.impact);
      }
    } catch (err) {
      console.error('Failed to fetch impact:', err);
    }
  };

  // Filter storms
  const filteredStorms = storms.filter(s => {
    if (stormFilter.type && !s.type.toLowerCase().includes(stormFilter.type.toLowerCase())) return false;
    if (stormFilter.county && !s.counties.some(c => c.toLowerCase().includes(stormFilter.county.toLowerCase()))) return false;
    return true;
  });

  const activeAlerts = alerts.filter(a => a.isActive && new Date(a.endTime) > new Date());
  const hasActiveAlerts = activeAlerts.length > 0;
  const highestSeverity = alertsSummary?.highestSeverity || null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#39FF14] animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm uppercase tracking-wider">Loading Weather Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Active Alert Banner */}
      {hasActiveAlerts && (
        <div className={`${
          highestSeverity === 'extreme' ? 'bg-red-900/60 border-red-500' :
          highestSeverity === 'severe' ? 'bg-orange-900/60 border-orange-500' :
          highestSeverity === 'moderate' ? 'bg-yellow-900/60 border-yellow-500' :
          'bg-blue-900/60 border-blue-500'
        } border-b-2 px-6 py-4`}>
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`w-6 h-6 flex-shrink-0 ${
                highestSeverity === 'extreme' ? 'text-red-400' :
                highestSeverity === 'severe' ? 'text-orange-400' :
                highestSeverity === 'moderate' ? 'text-yellow-400' :
                'text-blue-400'
              } animate-pulse`} />
              <div>
                <p className="font-black text-white uppercase tracking-wider text-sm">
                  {activeAlerts.length} Active Weather Alert{activeAlerts.length !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-gray-300 mt-0.5">
                  {activeAlerts[0]?.title}
                  {activeAlerts.length > 1 && ` (+${activeAlerts.length - 1} more)`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => document.getElementById('alerts-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5">
                <Eye className="w-4 h-4" /> View Details
              </button>
              <button onClick={() => handleViewImpact(activeAlerts[0]?.id)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5">
                <Users className="w-4 h-4" /> Customer Impact
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/command-center" className="text-gray-400 hover:text-[#39FF14] transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <CloudLightning className="w-6 h-6 text-[#39FF14]" />
              <h1 className="text-2xl font-black uppercase tracking-wider">Weather Command Center</h1>
            </div>
            <p className="text-gray-400 text-sm ml-14">
              Real-time severe weather monitoring, storm tracking, and lead generation
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-gray-500">
                Updated {timeAgo(lastRefresh)}
              </span>
            )}
            <button onClick={() => fetchData(true)} disabled={refreshing}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button onClick={() => setShowLogModal(true)}
              className="px-4 py-2 bg-[#39FF14] text-black font-black uppercase tracking-wider text-sm rounded-lg hover:bg-lime-400 transition-all flex items-center gap-2">
              <Plus className="w-4 h-4" /> Log Storm
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* ================================================================ */}
        {/* Current Conditions Cards                                         */}
        {/* ================================================================ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Temperature */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Thermometer className="w-4 h-4 text-[#39FF14]" />
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Temperature</span>
            </div>
            <p className="text-3xl font-black text-white">{weather?.current.temp || '--'}°F</p>
            <p className="text-xs text-gray-500 mt-1">
              Feels like {weather?.current.feelsLike || '--'}°F
            </p>
          </div>

          {/* Wind */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wind className="w-4 h-4 text-[#39FF14]" />
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Wind</span>
            </div>
            <p className="text-3xl font-black text-white">{weather?.current.windSpeed || '--'} <span className="text-lg text-gray-400">mph</span></p>
            {weather?.current.windGust && (
              <p className="text-xs text-gray-500 mt-1">Gusts to {weather.current.windGust} mph</p>
            )}
          </div>

          {/* Humidity */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Droplets className="w-4 h-4 text-[#39FF14]" />
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Humidity</span>
            </div>
            <p className="text-3xl font-black text-white">{weather?.current.humidity || '--'}%</p>
            <p className="text-xs text-gray-500 mt-1">{weather?.current.condition || 'Loading...'}</p>
          </div>

          {/* Storm Risk */}
          <div className={`rounded-xl p-4 border ${
            weather?.stormRisk.level === 'severe' ? 'bg-red-900/30 border-red-500/40' :
            weather?.stormRisk.level === 'high' ? 'bg-orange-900/30 border-orange-500/40' :
            weather?.stormRisk.level === 'moderate' ? 'bg-yellow-900/30 border-yellow-500/40' :
            'bg-gray-900 border-gray-800'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-[#39FF14]" />
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Storm Risk</span>
            </div>
            <p className={`text-2xl font-black uppercase ${
              weather?.stormRisk.level === 'severe' ? 'text-red-400' :
              weather?.stormRisk.level === 'high' ? 'text-orange-400' :
              weather?.stormRisk.level === 'moderate' ? 'text-yellow-400' :
              'text-green-400'
            }`}>
              {weather?.stormRisk.level || 'Low'}
            </p>
            <p className="text-xs text-gray-500 mt-1">{weather?.location || 'Huntsville, AL'}</p>
          </div>
        </div>

        {/* 5-Day Forecast Strip */}
        {weather?.forecast && weather.forecast.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#39FF14]" />
                5-Day Forecast
              </h3>
              <span className="text-xs text-gray-500">{weather.location}</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {weather.forecast.slice(0, 5).map((day, i) => (
                <div key={i} className={`text-center p-3 rounded-lg ${day.isWorkable ? 'bg-gray-800/50' : 'bg-red-900/20 border border-red-800/30'}`}>
                  <p className="text-xs font-bold text-gray-400">{day.dayOfWeek}</p>
                  <p className="text-lg font-black text-white mt-1">{day.high}°</p>
                  <p className="text-xs text-gray-500">{day.low}°</p>
                  <p className="text-xs text-gray-400 mt-1">{day.condition}</p>
                  {day.precipChance > 0 && (
                    <p className="text-xs text-blue-400 mt-0.5">{day.precipChance}% rain</p>
                  )}
                  {!day.isWorkable && (
                    <p className="text-[10px] text-red-400 mt-1 font-semibold">NO WORK</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* Storm Radar                                                      */}
        {/* ================================================================ */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#39FF14]" />
              Storm Radar - North Alabama
            </h3>
            <a href="https://radar.weather.gov/station/KHTX/standard" target="_blank" rel="noopener noreferrer"
              className="text-xs text-[#39FF14] hover:underline flex items-center gap-1">
              Full Radar <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="relative bg-gray-950">
            <img
              src="https://radar.weather.gov/ridge/standard/KHTX_0.gif"
              alt="NWS Radar - Huntsville, AL (KHTX)"
              className="w-full h-auto max-h-[400px] object-contain mx-auto"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent) {
                  const fallback = document.createElement('div');
                  fallback.className = 'flex items-center justify-center h-[300px] text-gray-500';
                  fallback.innerHTML = '<p class="text-sm">Radar image unavailable. <a href="https://radar.weather.gov/station/KHTX/standard" target="_blank" class="text-[#39FF14] underline">View on NWS</a></p>';
                  parent.appendChild(fallback);
                }
              }}
            />
          </div>
        </div>

        {/* Two-column layout: Alerts + Impact */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* ================================================================ */}
          {/* Active Alerts List                                               */}
          {/* ================================================================ */}
          <div className="lg:col-span-2" id="alerts-section">
            <div className="bg-gray-900 border border-gray-800 rounded-xl">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#39FF14]" />
                  Active Weather Alerts
                  {activeAlerts.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded-full">
                      {activeAlerts.length}
                    </span>
                  )}
                </h3>
              </div>

              {alerts.length === 0 ? (
                <div className="p-8 text-center">
                  <Shield className="w-12 h-12 text-green-500 mx-auto mb-3 opacity-50" />
                  <p className="text-gray-400 font-semibold">No Active Weather Alerts</p>
                  <p className="text-gray-500 text-sm mt-1">The service area is currently clear of severe weather.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {alerts.map(alert => {
                    const config = getSeverityConfig(alert.severity);
                    const Icon = getAlertIcon(alert.type);
                    const isExpanded = expandedAlert === alert.id;

                    return (
                      <div key={alert.id} className={`${config.bg} transition-all`}>
                        <button
                          onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                          className="w-full px-4 py-3 flex items-start gap-3 text-left"
                        >
                          <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${config.text}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2 py-0.5 text-xs font-black rounded ${config.badge}`}>
                                {config.label}
                              </span>
                              <span className="text-xs text-gray-400 font-semibold uppercase">
                                {formatAlertType(alert.type)}
                              </span>
                              {alert.hailSize && (
                                <span className="text-xs bg-purple-600/30 text-purple-300 px-1.5 py-0.5 rounded">
                                  Hail: {alert.hailSize}
                                </span>
                              )}
                              {alert.windSpeed && (
                                <span className="text-xs bg-cyan-600/30 text-cyan-300 px-1.5 py-0.5 rounded">
                                  Wind: {alert.windSpeed} mph
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-white font-semibold mt-1 line-clamp-2">{alert.title}</p>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {alert.counties.slice(0, 3).join(', ')}{alert.counties.length > 3 ? ` +${alert.counties.length - 3}` : ''}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {alert.isActive ? timeUntil(alert.endTime) : 'Expired'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {alert.affectedCustomers} customers
                              </span>
                            </div>
                          </div>
                          <ChevronDown className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 pl-12 space-y-3">
                            <div className="bg-black/30 rounded-lg p-3">
                              <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                                {alert.description.slice(0, 500)}
                                {alert.description.length > 500 && '...'}
                              </p>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="bg-black/20 rounded-lg p-2 text-center">
                                <p className="text-lg font-black text-white">{alert.affectedCustomers}</p>
                                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Customers</p>
                              </div>
                              <div className="bg-black/20 rounded-lg p-2 text-center">
                                <p className="text-lg font-black text-white">{alert.affectedJobs}</p>
                                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Active Jobs</p>
                              </div>
                              <div className="bg-black/20 rounded-lg p-2 text-center">
                                <p className="text-lg font-black text-white">{alert.counties.length}</p>
                                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Counties</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span>Source: {alert.source}</span>
                              <span>|</span>
                              <span>Start: {formatDateTime(alert.startTime)}</span>
                              <span>|</span>
                              <span>End: {formatDateTime(alert.endTime)}</span>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleGenerateLeads(alert)}
                                className="px-3 py-1.5 bg-[#39FF14]/20 text-[#39FF14] text-xs font-bold rounded-lg hover:bg-[#39FF14]/30 transition-all flex items-center gap-1.5">
                                <Target className="w-3 h-3" /> Generate Lead List
                              </button>
                              <button onClick={() => handleViewImpact(alert.id)}
                                className="px-3 py-1.5 bg-white/10 text-white text-xs font-bold rounded-lg hover:bg-white/20 transition-all flex items-center gap-1.5">
                                <BarChart3 className="w-3 h-3" /> View Impact
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ================================================================ */}
          {/* Impact Dashboard (sidebar)                                       */}
          {/* ================================================================ */}
          <div className="space-y-4">
            {/* Impact Summary */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl">
              <div className="px-4 py-3 border-b border-gray-800">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#39FF14]" />
                  Impact Dashboard
                </h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-black text-white">{alertsSummary?.totalAffectedCustomers || 0}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Affected Customers</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-black text-white">{alertsSummary?.totalAffectedJobs || 0}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Active Jobs at Risk</p>
                  </div>
                </div>

                {impactData && impactData.counties.length > 0 && (
                  <div className="bg-gray-800/30 rounded-lg p-3">
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">Affected Counties</p>
                    <div className="flex flex-wrap gap-1.5">
                      {impactData.counties.map(c => (
                        <span key={c} className="px-2 py-0.5 bg-gray-700/50 text-gray-300 text-xs rounded-full">{c}</span>
                      ))}
                    </div>
                  </div>
                )}

                {impactData && impactData.potentialLeads > 0 && (
                  <div className="bg-[#39FF14]/5 border border-[#39FF14]/20 rounded-lg p-3">
                    <p className="text-xs text-[#39FF14] uppercase tracking-wider font-semibold mb-1">Lead Opportunity</p>
                    <p className="text-2xl font-black text-[#39FF14]">{impactData.potentialLeads.toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-1">potential storm leads</p>
                    {impactData.affectedZips.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Across {impactData.affectedZips.length} zip codes
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Service Area Map Placeholder */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl">
              <div className="px-4 py-3 border-b border-gray-800">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#39FF14]" />
                  Service Area
                </h3>
              </div>
              <div className="p-4">
                <div className="bg-gray-800/50 rounded-lg p-6 text-center border border-dashed border-gray-700">
                  <MapPin className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-400 font-semibold">North Alabama Service Area</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Morgan, Madison, Limestone, Lawrence, Cullman, Marshall, DeKalb, Jackson, Colbert, Lauderdale
                  </p>
                  <a href="https://radar.weather.gov/station/KHTX/standard" target="_blank" rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-[#39FF14] hover:underline">
                    View Live Radar <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl">
              <div className="px-4 py-3 border-b border-gray-800">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#39FF14]" />
                  Quick Actions
                </h3>
              </div>
              <div className="p-3 space-y-2">
                <Link href="/check-my-address"
                  className="w-full px-3 py-2.5 bg-gray-800/50 hover:bg-gray-800 rounded-lg text-sm text-left font-semibold transition-all flex items-center gap-2">
                  <Target className="w-4 h-4 text-[#39FF14]" />
                  <span className="text-gray-300">Check My Address Tool</span>
                  <ChevronRight className="w-4 h-4 text-gray-600 ml-auto" />
                </Link>
                <button onClick={() => setShowLogModal(true)}
                  className="w-full px-3 py-2.5 bg-gray-800/50 hover:bg-gray-800 rounded-lg text-sm text-left font-semibold transition-all flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#39FF14]" />
                  <span className="text-gray-300">Log Storm Event</span>
                  <ChevronRight className="w-4 h-4 text-gray-600 ml-auto" />
                </button>
                <a href="https://www.spc.noaa.gov/products/outlook/" target="_blank" rel="noopener noreferrer"
                  className="w-full px-3 py-2.5 bg-gray-800/50 hover:bg-gray-800 rounded-lg text-sm text-left font-semibold transition-all flex items-center gap-2">
                  <CloudLightning className="w-4 h-4 text-[#39FF14]" />
                  <span className="text-gray-300">SPC Storm Outlook</span>
                  <ExternalLink className="w-3 h-3 text-gray-600 ml-auto" />
                </a>
                <a href="https://www.weather.gov/hun/" target="_blank" rel="noopener noreferrer"
                  className="w-full px-3 py-2.5 bg-gray-800/50 hover:bg-gray-800 rounded-lg text-sm text-left font-semibold transition-all flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#39FF14]" />
                  <span className="text-gray-300">NWS Huntsville Office</span>
                  <ExternalLink className="w-3 h-3 text-gray-600 ml-auto" />
                </a>
              </div>
            </div>

            {/* Storm Summary Stats */}
            {stormsSummary && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-[#39FF14]" />
                  Storm Stats
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Total Leads Generated</span>
                    <span className="text-sm font-black text-[#39FF14]">{stormsSummary.totalLeadsGenerated}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Pending Follow-ups</span>
                    <span className="text-sm font-black text-yellow-400">{stormsSummary.pendingFollowUps}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">In Progress</span>
                    <span className="text-sm font-black text-blue-400">{stormsSummary.inProgressFollowUps}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ================================================================ */}
        {/* Storm History Table                                              */}
        {/* ================================================================ */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="px-4 py-3 border-b border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#39FF14]" />
              Storm Event History
              {storms.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-gray-700 text-gray-300 text-xs font-bold rounded-full">
                  {storms.length}
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Filter className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <select
                  value={stormFilter.type}
                  onChange={e => setStormFilter(prev => ({ ...prev, type: e.target.value }))}
                  className="pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white focus:border-[#39FF14]"
                >
                  <option value="">All Types</option>
                  <option value="hail">Hail</option>
                  <option value="tornado">Tornado</option>
                  <option value="wind">Wind</option>
                  <option value="severe_thunderstorm">Severe T-Storm</option>
                  <option value="flood">Flood</option>
                </select>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="County..."
                  value={stormFilter.county}
                  onChange={e => setStormFilter(prev => ({ ...prev, county: e.target.value }))}
                  className="pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white placeholder-gray-500 w-32 focus:border-[#39FF14]"
                />
              </div>
            </div>
          </div>

          {filteredStorms.length === 0 ? (
            <div className="p-8 text-center">
              <Calendar className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-400 font-semibold">No Storm Events Logged</p>
              <p className="text-gray-500 text-sm mt-1">
                Click &quot;Log Storm&quot; to record a storm event for tracking and follow-up.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wider">
                    <th className="text-left px-4 py-2.5">Date</th>
                    <th className="text-left px-4 py-2.5">Type</th>
                    <th className="text-left px-4 py-2.5 hidden md:table-cell">Counties</th>
                    <th className="text-left px-4 py-2.5">Severity</th>
                    <th className="text-left px-4 py-2.5 hidden lg:table-cell">Hail</th>
                    <th className="text-left px-4 py-2.5 hidden lg:table-cell">Wind</th>
                    <th className="text-center px-4 py-2.5">Leads</th>
                    <th className="text-left px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredStorms.map(storm => {
                    const isExpanded = expandedStorm === storm.id;
                    const sConfig = getSeverityConfig(storm.severity);

                    return (
                      <React.Fragment key={storm.id}>
                        <tr className={`hover:bg-gray-800/30 transition-colors cursor-pointer ${isExpanded ? 'bg-gray-800/20' : ''}`}
                            onClick={() => setExpandedStorm(isExpanded ? null : storm.id)}>
                          <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{formatDate(storm.date)}</td>
                          <td className="px-4 py-3">
                            <span className="text-white font-semibold">{formatAlertType(storm.type)}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                            {storm.counties.slice(0, 2).join(', ')}{storm.counties.length > 2 ? ` +${storm.counties.length - 2}` : ''}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 text-xs font-bold rounded ${sConfig.badge}`}>
                              {sConfig.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{storm.hailSize || '-'}</td>
                          <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{storm.windSpeed ? `${storm.windSpeed} mph` : '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-black ${storm.leadsGenerated > 0 ? 'text-[#39FF14]' : 'text-gray-500'}`}>
                              {storm.leadsGenerated}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                              storm.followUpStatus === 'completed' ? 'bg-green-600/20 text-green-400' :
                              storm.followUpStatus === 'in_progress' ? 'bg-blue-600/20 text-blue-400' :
                              'bg-yellow-600/20 text-yellow-400'
                            }`}>
                              {storm.followUpStatus.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={9} className="px-4 py-4 bg-gray-800/20">
                              <div className="grid md:grid-cols-2 gap-4 pl-2">
                                <div>
                                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Description</p>
                                  <p className="text-sm text-gray-300">{storm.description || 'No description provided.'}</p>
                                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mt-3 mb-1">Notes</p>
                                  <p className="text-sm text-gray-300">{storm.notes || 'No notes.'}</p>
                                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mt-3 mb-1">Counties</p>
                                  <div className="flex flex-wrap gap-1">
                                    {storm.counties.map(c => (
                                      <span key={c} className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded-full">{c}</span>
                                    ))}
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                                      <p className="text-lg font-black text-white">{storm.customersAffected}</p>
                                      <p className="text-[10px] text-gray-400 uppercase">Customers</p>
                                    </div>
                                    <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                                      <p className="text-lg font-black text-[#39FF14]">{storm.leadsGenerated}</p>
                                      <p className="text-[10px] text-gray-400 uppercase">Leads</p>
                                    </div>
                                    <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                                      <p className="text-lg font-black text-white capitalize">{storm.estimatedDamage}</p>
                                      <p className="text-[10px] text-gray-400 uppercase">Damage Est.</p>
                                    </div>
                                  </div>
                                  <p className="text-xs text-gray-500">Logged: {formatDateTime(storm.createdAt)}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ================================================================ */}
        {/* Lead Generation Panel                                            */}
        {/* ================================================================ */}
        <div className="bg-gray-900 border border-[#39FF14]/20 rounded-xl">
          <div className="px-4 py-3 border-b border-[#39FF14]/10">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Target className="w-4 h-4 text-[#39FF14]" />
              Storm Lead Generation
            </h3>
          </div>
          <div className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-gray-300 text-sm leading-relaxed mb-4">
                  After a storm hits, generate targeted outreach lists for affected zip codes. Homeowners in storm-damaged areas
                  are most likely to need roof inspections within the first 7-14 days after a major weather event.
                </p>
                <div className="space-y-2 text-sm text-gray-400">
                  <p className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-[#39FF14]" />
                    Automatic impact analysis from NWS alerts
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[#39FF14]" />
                    Zip code-level targeting for door knocking
                  </p>
                  <p className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-[#39FF14]" />
                    Existing customer outreach for affected areas
                  </p>
                  <p className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-[#39FF14]" />
                    Integration with &quot;Check My Address&quot; public tool
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3 justify-center">
                <Link href="/check-my-address"
                  className="px-6 py-3 bg-[#39FF14] text-black font-black uppercase tracking-wider text-sm rounded-lg hover:bg-lime-400 transition-all flex items-center justify-center gap-2">
                  <Target className="w-4 h-4" /> Open Storm Check Tool
                </Link>
                <button onClick={() => setShowLogModal(true)}
                  className="px-6 py-3 border-2 border-[#39FF14]/40 text-[#39FF14] font-black uppercase tracking-wider text-sm rounded-lg hover:bg-[#39FF14]/10 transition-all flex items-center justify-center gap-2">
                  <CloudLightning className="w-4 h-4" /> Log Storm &amp; Generate Leads
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Log Storm Modal */}
      {showLogModal && (
        <LogStormModal
          onClose={() => setShowLogModal(false)}
          onSubmit={handleLogStorm}
        />
      )}
    </div>
  );
}
