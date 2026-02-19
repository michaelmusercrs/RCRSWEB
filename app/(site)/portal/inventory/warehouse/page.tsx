'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Thermometer,
  DoorOpen,
  DoorClosed,
  Lightbulb,
  LightbulbOff,
  Power,
  RefreshCw,
  Loader2,
  Wifi,
  WifiOff,
  AlertTriangle,
  Snowflake,
  Flame,
  ChevronUp,
  ChevronDown,
  Activity,
  Warehouse,
  Settings,
  Volume2,
  Monitor,
  Eye,
  ToggleLeft,
  ToggleRight,
  Zap,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface DeviceStatus {
  entityId: string;
  name: string;
  state: string;
  available: boolean;
  lastChanged?: string;
}

interface DoorStatus {
  bayNumber: number;
  entityId: string;
  state: 'open' | 'closed' | 'opening' | 'closing' | 'unknown';
}

interface SensorReading {
  entityId: string;
  state: string;
  unit?: string;
  lastUpdated?: string;
}

interface WarehouseStatus {
  configured: boolean;
  message?: string;
  devices: DeviceStatus[];
  doors: DoorStatus[];
  sensors: {
    temperature: SensorReading;
    motion: SensorReading;
  };
}

type LightZone = 'loading_bay' | 'main' | 'all';

// ============================================
// COMPONENT
// ============================================

export default function WarehouseControlsPage() {
  const [status, setStatus] = useState<WarehouseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // AC controls
  const [acOn, setAcOn] = useState(false);
  const [targetTemp, setTargetTemp] = useState(72);
  const [acMode, setAcMode] = useState<'cool' | 'heat' | 'auto'>('auto');
  const [acLoading, setAcLoading] = useState(false);

  // Door controls
  const [doorLoading, setDoorLoading] = useState<Record<number, boolean>>({});

  // Light controls
  const [lightLoading, setLightLoading] = useState<Record<string, boolean>>({});

  // Warehouse mode
  const [warehouseMode, setWarehouseMode] = useState<string>('loading');
  const [modeLoading, setModeLoading] = useState(false);

  // Announcement
  const [announcement, setAnnouncement] = useState('');
  const [announcePriority, setAnnouncePriority] = useState<'normal' | 'urgent'>('normal');
  const [announcing, setAnnouncing] = useState(false);

  // ============================================
  // FETCH STATUS
  // ============================================

  const fetchStatus = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setRefreshing(true);

      const response = await fetch('/api/portal/delivery/iot');
      if (!response.ok) throw new Error('Failed to fetch warehouse status');

      const data = await response.json();
      setStatus(data);
      setError('');

      // Derive AC state from temperature sensor
      if (data.sensors?.temperature) {
        const temp = parseFloat(data.sensors.temperature.state);
        if (!isNaN(temp)) {
          // If we can read the temperature, assume AC is on
          setAcOn(true);
        }
      }
    } catch (err) {
      console.error('Error fetching warehouse status:', err);
      setError('Could not connect to warehouse controls');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Poll every 30 seconds
    const interval = setInterval(() => fetchStatus(false), 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // ============================================
  // IOT ACTIONS
  // ============================================

  const callIoT = async (body: Record<string, unknown>): Promise<boolean> => {
    try {
      const response = await fetch('/api/portal/delivery/iot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      return data.success === true;
    } catch (err) {
      console.error('IoT action failed:', err);
      return false;
    }
  };

  // Door toggle
  const toggleDoor = async (bayNumber: number, currentState: string) => {
    setDoorLoading(prev => ({ ...prev, [bayNumber]: true }));
    const operation = currentState === 'open' ? 'close' : 'open';
    await callIoT({ action: 'door', operation, bayNumber });
    // Refresh status after a short delay to let the door move
    setTimeout(() => fetchStatus(false), 2000);
    setDoorLoading(prev => ({ ...prev, [bayNumber]: false }));
  };

  // Light control
  const toggleLight = async (zone: LightZone, turnOn: boolean) => {
    setLightLoading(prev => ({ ...prev, [zone]: true }));

    if (zone === 'loading_bay' || zone === 'all') {
      await callIoT({ action: 'lights', color: turnOn ? 'green' : 'off' });
    }
    if (zone === 'main' || zone === 'all') {
      await callIoT({
        action: 'mode',
        mode: turnOn ? 'loading' : 'closed',
      });
    }

    setTimeout(() => fetchStatus(false), 1000);
    setLightLoading(prev => ({ ...prev, [zone]: false }));
  };

  // Set light color
  const setLightColor = async (color: string) => {
    setLightLoading(prev => ({ ...prev, loading_bay: true }));
    await callIoT({ action: 'lights', color });
    setTimeout(() => fetchStatus(false), 500);
    setLightLoading(prev => ({ ...prev, loading_bay: false }));
  };

  // Warehouse mode
  const changeMode = async (mode: string) => {
    setModeLoading(true);
    setWarehouseMode(mode);
    await callIoT({ action: 'mode', mode });
    setTimeout(() => fetchStatus(false), 1000);
    setModeLoading(false);
  };

  // AC control (calls HA climate service via IoT proxy)
  const toggleAC = async () => {
    setAcLoading(true);
    const newState = !acOn;
    setAcOn(newState);
    // Use the existing IoT API pattern - this would need a climate entity in HA
    // For now we trigger a scene
    await callIoT({
      action: 'scene',
      sceneName: newState ? 'warehouse_ac_on' : 'warehouse_ac_off',
    });
    setAcLoading(false);
  };

  const adjustTemp = async (delta: number) => {
    const newTemp = Math.max(60, Math.min(85, targetTemp + delta));
    setTargetTemp(newTemp);
    // This would call climate.set_temperature in HA
    await callIoT({
      action: 'scene',
      sceneName: `warehouse_temp_${newTemp}`,
    });
  };

  // Announcement
  const sendAnnouncement = async () => {
    if (!announcement.trim()) return;
    setAnnouncing(true);
    await callIoT({
      action: 'announce',
      message: announcement.trim(),
      priority: announcePriority,
    });
    setAnnouncement('');
    setAnnouncing(false);
  };

  // Flash alert
  const flashAlert = async () => {
    await callIoT({ action: 'flash-alert' });
  };

  // ============================================
  // HELPERS
  // ============================================

  const isConnected = status?.configured === true;

  const getCurrentTemp = (): string => {
    if (!status?.sensors?.temperature) return '--';
    const temp = status.sensors.temperature.state;
    if (temp === 'unavailable' || temp === 'unknown') return '--';
    return `${parseFloat(temp).toFixed(1)}`;
  };

  const getTempUnit = (): string => {
    return status?.sensors?.temperature?.unit || 'F';
  };

  const isMotionDetected = (): boolean => {
    return status?.sensors?.motion?.state === 'on';
  };

  const getDoorState = (bayNumber: number): string => {
    const door = status?.doors?.find(d => d.bayNumber === bayNumber);
    return door?.state || 'unknown';
  };

  const isLightOn = (entityId: string): boolean => {
    const device = status?.devices?.find(d => d.entityId === entityId);
    return device?.state === 'on';
  };

  const formatLastChanged = (dateStr?: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal/inventory" className="text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-[#39FF14]" />
                Warehouse Controls
              </h1>
              <p className="text-sm text-zinc-400">
                Smart warehouse management via Home Assistant
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Connection Status */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ${
              isConnected
                ? 'bg-[#39FF14]/10 border-[#39FF14]/30 text-[#39FF14]'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              <span className="hidden sm:inline">{isConnected ? 'Connected' : 'Offline'}</span>
            </div>
            <button
              onClick={() => fetchStatus()}
              disabled={refreshing}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#39FF14] animate-spin" />
        </div>
      ) : error && !status ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <WifiOff className="w-12 h-12 text-zinc-600" />
          <p className="text-zinc-400">{error}</p>
          <button
            onClick={() => fetchStatus()}
            className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {/* Not configured banner */}
          {!isConnected && (
            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-400 font-medium">Home Assistant Not Connected</p>
                <p className="text-sm text-amber-400/70 mt-1">
                  Set the <code className="bg-amber-500/20 px-1.5 py-0.5 rounded text-xs">HA_ACCESS_TOKEN</code> and{' '}
                  <code className="bg-amber-500/20 px-1.5 py-0.5 rounded text-xs">HA_BASE_URL</code> environment variables
                  to enable smart warehouse controls. Controls below show simulated state.
                </p>
              </div>
            </div>
          )}

          {/* Quick Status Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Thermometer className="w-4 h-4 text-[#39FF14]" />
                <span className="text-xs text-zinc-500">Temperature</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {getCurrentTemp()}<span className="text-sm text-zinc-500">{getTempUnit()}</span>
              </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-[#39FF14]" />
                <span className="text-xs text-zinc-500">Motion</span>
              </div>
              <div className={`text-lg font-bold ${isMotionDetected() ? 'text-amber-400' : 'text-zinc-500'}`}>
                {isMotionDetected() ? 'Detected' : 'Clear'}
              </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <DoorOpen className="w-4 h-4 text-[#39FF14]" />
                <span className="text-xs text-zinc-500">Doors Open</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {status?.doors?.filter(d => d.state === 'open').length || 0}
                <span className="text-sm text-zinc-500"> / 3</span>
              </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-[#39FF14]" />
                <span className="text-xs text-zinc-500">Devices Online</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {status?.devices?.filter(d => d.available).length || 0}
                <span className="text-sm text-zinc-500"> / {status?.devices?.length || 0}</span>
              </div>
            </div>
          </div>

          {/* Main Controls Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ===== AC CONTROL ===== */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    acOn ? 'bg-[#39FF14]/10' : 'bg-zinc-800'
                  }`}>
                    {acMode === 'cool' ? (
                      <Snowflake className={`w-5 h-5 ${acOn ? 'text-blue-400' : 'text-zinc-600'}`} />
                    ) : acMode === 'heat' ? (
                      <Flame className={`w-5 h-5 ${acOn ? 'text-orange-400' : 'text-zinc-600'}`} />
                    ) : (
                      <Thermometer className={`w-5 h-5 ${acOn ? 'text-[#39FF14]' : 'text-zinc-600'}`} />
                    )}
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white">AC / Climate</h2>
                    <p className="text-xs text-zinc-500">
                      {acOn ? `${acMode === 'cool' ? 'Cooling' : acMode === 'heat' ? 'Heating' : 'Auto'} to ${targetTemp}F` : 'System off'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleAC}
                  disabled={acLoading}
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    acOn ? 'bg-[#39FF14]' : 'bg-zinc-700'
                  }`}
                >
                  <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    acOn ? 'translate-x-7' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              <div className="p-5">
                {/* Current / Target Temp */}
                <div className="flex items-center justify-between mb-6">
                  <div className="text-center">
                    <p className="text-xs text-zinc-500 mb-1">Current</p>
                    <p className="text-3xl font-bold text-white">
                      {getCurrentTemp()}<span className="text-lg text-zinc-500">F</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => adjustTemp(-1)}
                      disabled={!acOn}
                      className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                    <div className="text-center min-w-[60px]">
                      <p className="text-xs text-zinc-500 mb-1">Target</p>
                      <p className={`text-3xl font-bold ${acOn ? 'text-[#39FF14]' : 'text-zinc-600'}`}>
                        {targetTemp}<span className="text-lg text-zinc-500">F</span>
                      </p>
                    </div>
                    <button
                      onClick={() => adjustTemp(1)}
                      disabled={!acOn}
                      className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronUp className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Mode Selection */}
                <div className="flex gap-2">
                  {(['cool', 'heat', 'auto'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setAcMode(mode)}
                      disabled={!acOn}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        acMode === mode && acOn
                          ? mode === 'cool'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : mode === 'heat'
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                              : 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700 disabled:opacity-30'
                      }`}
                    >
                      {mode === 'cool' && <Snowflake className="w-3.5 h-3.5 inline mr-1.5" />}
                      {mode === 'heat' && <Flame className="w-3.5 h-3.5 inline mr-1.5" />}
                      {mode === 'auto' && <Settings className="w-3.5 h-3.5 inline mr-1.5" />}
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ===== ROLL-UP DOORS ===== */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
                <div className="w-10 h-10 rounded-lg bg-[#39FF14]/10 flex items-center justify-center">
                  <DoorOpen className="w-5 h-5 text-[#39FF14]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Roll-Up Doors</h2>
                  <p className="text-xs text-zinc-500">Loading bay door controls</p>
                </div>
              </div>

              <div className="p-5 space-y-3">
                {[1, 2, 3].map(bayNum => {
                  const doorState = getDoorState(bayNum);
                  const isOpen = doorState === 'open';
                  const isMoving = doorState === 'opening' || doorState === 'closing';
                  const isLoading = doorLoading[bayNum];

                  return (
                    <div
                      key={bayNum}
                      className="flex items-center justify-between p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        {isOpen ? (
                          <DoorOpen className="w-6 h-6 text-[#39FF14]" />
                        ) : (
                          <DoorClosed className="w-6 h-6 text-zinc-500" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-white">Bay {bayNum}</p>
                          <p className={`text-xs ${
                            isOpen ? 'text-[#39FF14]' : isMoving ? 'text-amber-400' : 'text-zinc-500'
                          }`}>
                            {isMoving ? (doorState === 'opening' ? 'Opening...' : 'Closing...') :
                             isOpen ? 'Open' : doorState === 'unknown' ? 'Unknown' : 'Closed'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleDoor(bayNum, doorState)}
                        disabled={isLoading || isMoving}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isOpen
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                            : 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30 hover:bg-[#39FF14]/30'
                        } disabled:opacity-30`}
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isOpen ? (
                          'Close'
                        ) : (
                          'Open'
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ===== OVERHEAD LIGHTS ===== */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
                <div className="w-10 h-10 rounded-lg bg-[#39FF14]/10 flex items-center justify-center">
                  <Lightbulb className="w-5 h-5 text-[#39FF14]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Overhead Lights</h2>
                  <p className="text-xs text-zinc-500">Zone lighting controls</p>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Main Light */}
                <div className="flex items-center justify-between p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    {isLightOn('light.warehouse_main') ? (
                      <Lightbulb className="w-6 h-6 text-amber-400" />
                    ) : (
                      <LightbulbOff className="w-6 h-6 text-zinc-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-white">Main Warehouse</p>
                      <p className="text-xs text-zinc-500">
                        {isLightOn('light.warehouse_main') ? 'On' : 'Off'}
                        {status?.devices?.find(d => d.entityId === 'light.warehouse_main')?.lastChanged &&
                          ` - ${formatLastChanged(status.devices.find(d => d.entityId === 'light.warehouse_main')?.lastChanged)}`
                        }
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleLight('main', !isLightOn('light.warehouse_main'))}
                    disabled={lightLoading.main}
                    className="relative w-12 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: isLightOn('light.warehouse_main') ? '#39FF14' : '#3f3f46' }}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      isLightOn('light.warehouse_main') ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                {/* Loading Bay Light */}
                <div className="flex items-center justify-between p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    {isLightOn('light.warehouse_loading_bay') ? (
                      <Lightbulb className="w-6 h-6 text-[#39FF14]" />
                    ) : (
                      <LightbulbOff className="w-6 h-6 text-zinc-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-white">Loading Bay</p>
                      <p className="text-xs text-zinc-500">
                        {isLightOn('light.warehouse_loading_bay') ? 'On' : 'Off'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleLight('loading_bay', !isLightOn('light.warehouse_loading_bay'))}
                    disabled={lightLoading.loading_bay}
                    className="relative w-12 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: isLightOn('light.warehouse_loading_bay') ? '#39FF14' : '#3f3f46' }}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      isLightOn('light.warehouse_loading_bay') ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                {/* Bay Light Color Buttons */}
                <div>
                  <p className="text-xs text-zinc-500 mb-2">Bay Light Color</p>
                  <div className="flex gap-2">
                    {[
                      { color: 'green', bg: 'bg-green-500', label: 'Ready' },
                      { color: 'yellow', bg: 'bg-amber-500', label: 'Loading' },
                      { color: 'red', bg: 'bg-red-500', label: 'Stop' },
                      { color: 'blue', bg: 'bg-blue-500', label: 'Receiving' },
                    ].map(item => (
                      <button
                        key={item.color}
                        onClick={() => setLightColor(item.color)}
                        className={`flex-1 flex flex-col items-center gap-1 py-2 px-2 rounded-lg border border-zinc-700 hover:border-zinc-500 transition-colors`}
                      >
                        <div className={`w-4 h-4 rounded-full ${item.bg}`} />
                        <span className="text-[10px] text-zinc-400">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* All Lights Toggle */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => toggleLight('all', true)}
                    disabled={lightLoading.all}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30 rounded-lg text-sm font-medium hover:bg-[#39FF14]/20 transition-colors disabled:opacity-50"
                  >
                    <Power className="w-4 h-4" />
                    All Lights On
                  </button>
                  <button
                    onClick={() => toggleLight('all', false)}
                    disabled={lightLoading.all}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors disabled:opacity-50"
                  >
                    <Power className="w-4 h-4" />
                    All Lights Off
                  </button>
                </div>
              </div>
            </div>

            {/* ===== WAREHOUSE MODE ===== */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
                <div className="w-10 h-10 rounded-lg bg-[#39FF14]/10 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-[#39FF14]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Warehouse Mode</h2>
                  <p className="text-xs text-zinc-500">Preset lighting and automation profiles</p>
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    { mode: 'loading', label: 'Loading', desc: 'Yellow bay, full lights', icon: '🔶' },
                    { mode: 'departure', label: 'Departure', desc: 'Green bay, lights on', icon: '🟢' },
                    { mode: 'receiving', label: 'Receiving', desc: 'Blue bay, full lights', icon: '🔵' },
                    { mode: 'closed', label: 'Closed', desc: 'All lights off', icon: '🔴' },
                  ].map(item => (
                    <button
                      key={item.mode}
                      onClick={() => changeMode(item.mode)}
                      disabled={modeLoading}
                      className={`p-4 rounded-xl border text-left transition-colors ${
                        warehouseMode === item.mode
                          ? 'bg-[#39FF14]/10 border-[#39FF14]/30'
                          : 'bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600'
                      } disabled:opacity-50`}
                    >
                      <div className="text-2xl mb-2">{item.icon}</div>
                      <p className={`text-sm font-medium ${
                        warehouseMode === item.mode ? 'text-[#39FF14]' : 'text-white'
                      }`}>
                        {item.label}
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{item.desc}</p>
                    </button>
                  ))}
                </div>

                {/* Flash Alert */}
                <button
                  onClick={flashAlert}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-colors"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Flash Emergency Alert
                </button>
              </div>
            </div>

            {/* ===== ANNOUNCEMENT ===== */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden lg:col-span-2">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
                <div className="w-10 h-10 rounded-lg bg-[#39FF14]/10 flex items-center justify-center">
                  <Volume2 className="w-5 h-5 text-[#39FF14]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Warehouse Announcement</h2>
                  <p className="text-xs text-zinc-500">Broadcast a message via the warehouse speaker (TTS)</p>
                </div>
              </div>

              <div className="p-5">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={announcement}
                    onChange={e => setAnnouncement(e.target.value)}
                    placeholder="Type your announcement..."
                    className="flex-1 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-[#39FF14]/50 focus:ring-1 focus:ring-[#39FF14]/30"
                    onKeyDown={e => {
                      if (e.key === 'Enter') sendAnnouncement();
                    }}
                  />
                  <div className="flex gap-2">
                    <select
                      value={announcePriority}
                      onChange={e => setAnnouncePriority(e.target.value as 'normal' | 'urgent')}
                      className="px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none"
                    >
                      <option value="normal">Normal</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <button
                      onClick={sendAnnouncement}
                      disabled={announcing || !announcement.trim()}
                      className="px-5 py-2.5 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      {announcing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Announce'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== DEVICE STATUS ===== */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden lg:col-span-2">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
                <div className="w-10 h-10 rounded-lg bg-[#39FF14]/10 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-[#39FF14]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">All Devices</h2>
                  <p className="text-xs text-zinc-500">Live status from Home Assistant</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left px-5 py-3 text-zinc-400 font-medium">Device</th>
                      <th className="text-left px-5 py-3 text-zinc-400 font-medium">Entity ID</th>
                      <th className="text-center px-5 py-3 text-zinc-400 font-medium">State</th>
                      <th className="text-center px-5 py-3 text-zinc-400 font-medium">Available</th>
                      <th className="text-right px-5 py-3 text-zinc-400 font-medium">Last Changed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {(status?.devices || []).map(device => (
                      <tr key={device.entityId} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-5 py-3 text-white font-medium">{device.name}</td>
                        <td className="px-5 py-3 text-zinc-500 font-mono text-xs">{device.entityId}</td>
                        <td className="px-5 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            device.state === 'on' || device.state === 'open'
                              ? 'bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30'
                              : device.state === 'off' || device.state === 'closed'
                                ? 'bg-zinc-700 text-zinc-400 border border-zinc-600'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}>
                            {device.state}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          {device.available ? (
                            <span className="text-[#39FF14]">Online</span>
                          ) : (
                            <span className="text-red-400">Offline</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right text-zinc-500 text-xs">
                          {formatLastChanged(device.lastChanged)}
                        </td>
                      </tr>
                    ))}
                    {(!status?.devices || status.devices.length === 0) && (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-zinc-500">
                          No device data available. Connect to Home Assistant to see live statuses.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
