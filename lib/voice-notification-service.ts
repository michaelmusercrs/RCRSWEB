// Voice & Notification Service for Driver Portal
// Handles text-to-speech, push notifications, and real-time tracking

export interface VoiceSettings {
  enabled: boolean;
  volume: number; // 0-1
  rate: number; // 0.1-10
  pitch: number; // 0-2
  voiceIndex: number; // Index of available voice
}

export interface NotificationSettings {
  pushEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  urgentOnly: boolean;
}

export interface GPSTrackingSettings {
  enabled: boolean;
  updateInterval: number; // seconds
  highAccuracy: boolean;
}

export interface LiveLocation {
  userId: string;
  userName: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  heading?: number;
  speed?: number;
  timestamp: string;
  status: 'active' | 'idle' | 'offline';
}

// Voice Service - Client-side only (uses Web Speech API)
class VoiceService {
  private synth: SpeechSynthesis | null = null;
  private settings: VoiceSettings = {
    enabled: true,
    volume: 0.8,
    rate: 1.0,
    pitch: 1.0,
    voiceIndex: 0,
  };

  constructor() {
    // Will be initialized on client
    if (typeof window !== 'undefined') {
      this.synth = window.speechSynthesis;
    }
  }

  // Initialize voice synthesis
  initialize(): boolean {
    if (typeof window === 'undefined') return false;
    this.synth = window.speechSynthesis;
    return true;
  }

  // Get available voices
  getVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices();
  }

  // Update settings
  updateSettings(settings: Partial<VoiceSettings>): void {
    this.settings = { ...this.settings, ...settings };
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('voiceSettings', JSON.stringify(this.settings));
    }
  }

  // Load settings from storage
  loadSettings(): VoiceSettings {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('voiceSettings');
      if (saved) {
        this.settings = JSON.parse(saved);
      }
    }
    return this.settings;
  }

  // Speak text
  speak(text: string, priority: 'normal' | 'urgent' = 'normal'): void {
    if (!this.synth || !this.settings.enabled) return;

    // Cancel current speech for urgent messages
    if (priority === 'urgent') {
      this.synth.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = priority === 'urgent' ? Math.min(1, this.settings.volume + 0.2) : this.settings.volume;
    utterance.rate = this.settings.rate;
    utterance.pitch = this.settings.pitch;

    const voices = this.getVoices();
    if (voices.length > this.settings.voiceIndex) {
      utterance.voice = voices[this.settings.voiceIndex];
    }

    this.synth.speak(utterance);
  }

  // Stop speaking
  stop(): void {
    if (this.synth) {
      this.synth.cancel();
    }
  }

  // Check if currently speaking
  isSpeaking(): boolean {
    return this.synth?.speaking || false;
  }

  // Pre-defined voice commands for drivers
  announceDeliveryAssigned(jobName: string, address: string, time: string): void {
    this.speak(
      `New delivery assigned. ${jobName}. Located at ${address}. Scheduled for ${time}. Check your app for details.`,
      'urgent'
    );
  }

  announceLoadingChecklist(items: Array<{ quantity: number; unit: string; name: string }>): void {
    let script = 'Loading checklist. ';
    items.forEach((item, i) => {
      script += `Item ${i + 1}: ${item.quantity} ${item.unit} ${item.name}. `;
    });
    script += 'Verify each item before confirming load.';
    this.speak(script);
  }

  announceNavigation(address: string, distance: string, eta: string): void {
    this.speak(`Navigating to ${address}. Distance ${distance}. Estimated arrival ${eta}.`);
  }

  announceArrival(jobName: string, customerName: string): void {
    this.speak(`Arrived at ${jobName}. Customer: ${customerName}. Please unload materials and capture photos.`);
  }

  announceDeliveryComplete(): void {
    this.speak('Delivery complete. Please capture signature and delivery photos before departing.', 'urgent');
  }

  announceUrgent(message: string): void {
    this.speak(message, 'urgent');
  }
}

// Push Notification Service
class PushNotificationService {
  private settings: NotificationSettings = {
    pushEnabled: true,
    soundEnabled: true,
    vibrationEnabled: true,
    urgentOnly: false,
  };

  private registration: ServiceWorkerRegistration | null = null;

  // Request notification permission
  async requestPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    return await Notification.requestPermission();
  }

  // Check if notifications are supported and permitted
  isEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    return 'Notification' in window && Notification.permission === 'granted';
  }

  // Update settings
  updateSettings(settings: Partial<NotificationSettings>): void {
    this.settings = { ...this.settings, ...settings };
    if (typeof window !== 'undefined') {
      localStorage.setItem('notificationSettings', JSON.stringify(this.settings));
    }
  }

  // Load settings
  loadSettings(): NotificationSettings {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('notificationSettings');
      if (saved) {
        this.settings = JSON.parse(saved);
      }
    }
    return this.settings;
  }

  // Show notification
  async notify(
    title: string,
    body: string,
    options: {
      icon?: string;
      badge?: string;
      tag?: string;
      priority?: 'normal' | 'urgent';
      actions?: Array<{ action: string; title: string }>;
      data?: any;
    } = {}
  ): Promise<void> {
    if (!this.settings.pushEnabled) return;
    if (this.settings.urgentOnly && options.priority !== 'urgent') return;

    if (!this.isEnabled()) {
      const permission = await this.requestPermission();
      if (permission !== 'granted') return;
    }

    const notificationOptions: NotificationOptions = {
      body,
      icon: options.icon || '/icon-192x192.png',
      badge: options.badge || '/badge-72x72.png',
      tag: options.tag,
      requireInteraction: options.priority === 'urgent',
      silent: !this.settings.soundEnabled,
      data: options.data,
    };

    // Use Service Worker if available for better reliability
    if (this.registration) {
      await this.registration.showNotification(title, notificationOptions);
    } else {
      new Notification(title, notificationOptions);
    }
  }

  // Pre-defined notifications
  notifyNewDelivery(jobName: string, address: string, time: string): void {
    this.notify(
      'New Delivery Assigned',
      `${jobName} - ${address} at ${time}`,
      { priority: 'urgent', tag: 'new-delivery' }
    );
  }

  notifyDeliveryReminder(jobName: string, minutesUntil: number): void {
    this.notify(
      'Delivery Reminder',
      `${jobName} in ${minutesUntil} minutes`,
      { priority: 'normal', tag: 'reminder' }
    );
  }

  notifyScheduleChange(message: string): void {
    this.notify(
      'Schedule Updated',
      message,
      { priority: 'urgent', tag: 'schedule-change' }
    );
  }

  notifyLowStock(productName: string, currentQty: number): void {
    this.notify(
      'Low Stock Alert',
      `${productName} is low (${currentQty} remaining)`,
      { priority: 'normal', tag: 'low-stock' }
    );
  }

  notifySLAWarning(ticketId: string, stage: string): void {
    this.notify(
      'SLA Warning',
      `Ticket ${ticketId} at ${stage} is approaching time limit`,
      { priority: 'urgent', tag: 'sla-warning' }
    );
  }
}

// GPS Tracking Service
class GPSTrackingService {
  private settings: GPSTrackingSettings = {
    enabled: true,
    updateInterval: 30, // seconds
    highAccuracy: true,
  };

  private watchId: number | null = null;
  private currentLocation: GeolocationPosition | null = null;
  private locationHistory: LiveLocation[] = [];
  private onLocationUpdate: ((location: LiveLocation) => void) | null = null;

  // Update settings
  updateSettings(settings: Partial<GPSTrackingSettings>): void {
    this.settings = { ...this.settings, ...settings };
    if (typeof window !== 'undefined') {
      localStorage.setItem('gpsSettings', JSON.stringify(this.settings));
    }

    // Restart tracking with new settings if currently active
    if (this.watchId !== null) {
      this.stopTracking();
      if (this.settings.enabled) {
        this.startTracking();
      }
    }
  }

  // Load settings
  loadSettings(): GPSTrackingSettings {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gpsSettings');
      if (saved) {
        this.settings = JSON.parse(saved);
      }
    }
    return this.settings;
  }

  // Check if geolocation is available
  isAvailable(): boolean {
    return typeof window !== 'undefined' && 'geolocation' in navigator;
  }

  // Request location permission
  async requestPermission(): Promise<PermissionState> {
    if (!this.isAvailable()) return 'denied';

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state;
    } catch {
      return 'prompt';
    }
  }

  // Get current location once
  async getCurrentLocation(): Promise<GeolocationPosition | null> {
    if (!this.isAvailable() || !this.settings.enabled) return null;

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.currentLocation = position;
          resolve(position);
        },
        () => resolve(null),
        {
          enableHighAccuracy: this.settings.highAccuracy,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }

  // Start continuous tracking
  startTracking(userId?: string, userName?: string): void {
    if (!this.isAvailable() || !this.settings.enabled) return;
    if (this.watchId !== null) return; // Already tracking

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.currentLocation = position;

        const location: LiveLocation = {
          userId: userId || 'unknown',
          userName: userName || 'Unknown',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading || undefined,
          speed: position.coords.speed || undefined,
          timestamp: new Date().toISOString(),
          status: 'active',
        };

        this.locationHistory.push(location);

        // Keep only last 100 locations in memory
        if (this.locationHistory.length > 100) {
          this.locationHistory.shift();
        }

        // Callback if set
        if (this.onLocationUpdate) {
          this.onLocationUpdate(location);
        }
      },
      (error) => {
        console.error('GPS Error:', error);
      },
      {
        enableHighAccuracy: this.settings.highAccuracy,
        timeout: this.settings.updateInterval * 1000,
        maximumAge: 0,
      }
    );
  }

  // Stop tracking
  stopTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  // Set callback for location updates
  setLocationCallback(callback: (location: LiveLocation) => void): void {
    this.onLocationUpdate = callback;
  }

  // Get last known location
  getLastLocation(): GeolocationPosition | null {
    return this.currentLocation;
  }

  // Get location history
  getLocationHistory(): LiveLocation[] {
    return [...this.locationHistory];
  }

  // Calculate distance from current location to destination
  getDistanceTo(destLat: number, destLng: number): number | null {
    if (!this.currentLocation) return null;

    const lat1 = this.currentLocation.coords.latitude;
    const lng1 = this.currentLocation.coords.longitude;

    return this.calculateDistance(lat1, lng1, destLat, destLng);
  }

  // Calculate ETA to destination (assuming average 30 mph)
  getETATo(destLat: number, destLng: number): number | null {
    const distance = this.getDistanceTo(destLat, destLng);
    if (distance === null) return null;

    // Use actual speed if available, otherwise assume 30 mph
    const speedMph = this.currentLocation?.coords.speed
      ? (this.currentLocation.coords.speed * 2.237) // m/s to mph
      : 30;

    return Math.round((distance / speedMph) * 60); // minutes
  }

  // Haversine formula for distance calculation
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * Math.PI / 180;
  }

  // Format GPS coordinates for display
  formatCoordinates(lat: number, lng: number): string {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }

  // Get Google Maps URL for location
  getGoogleMapsUrl(lat: number, lng: number): string {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }

  // Get navigation URL
  getNavigationUrl(destLat: number, destLng: number): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;
  }
}

// Export singleton instances
export const voiceService = new VoiceService();
export const pushNotificationService = new PushNotificationService();
export const gpsTrackingService = new GPSTrackingService();

// Combined driver assistance controller
export class DriverAssistanceController {
  private voice = voiceService;
  private notifications = pushNotificationService;
  private gps = gpsTrackingService;

  // Initialize all services
  async initialize(userId: string, userName: string): Promise<{
    voice: boolean;
    notifications: boolean;
    gps: boolean;
  }> {
    // Initialize voice
    const voiceReady = this.voice.initialize();

    // Request notification permission
    const notificationPermission = await this.notifications.requestPermission();
    const notificationsReady = notificationPermission === 'granted';

    // Start GPS tracking
    const gpsPermission = await this.gps.requestPermission();
    const gpsReady = gpsPermission === 'granted';
    if (gpsReady) {
      this.gps.startTracking(userId, userName);
    }

    return {
      voice: voiceReady,
      notifications: notificationsReady,
      gps: gpsReady,
    };
  }

  // Handle new delivery assignment
  onDeliveryAssigned(jobName: string, address: string, time: string): void {
    this.voice.announceDeliveryAssigned(jobName, address, time);
    this.notifications.notifyNewDelivery(jobName, address, time);
  }

  // Handle loading phase
  onStartLoading(items: Array<{ quantity: number; unit: string; name: string }>): void {
    this.voice.announceLoadingChecklist(items);
  }

  // Handle navigation start
  onStartNavigation(address: string, destLat: number, destLng: number): void {
    const distance = this.gps.getDistanceTo(destLat, destLng);
    const eta = this.gps.getETATo(destLat, destLng);

    this.voice.announceNavigation(
      address,
      distance ? `${distance.toFixed(1)} miles` : 'calculating',
      eta ? `${eta} minutes` : 'calculating'
    );
  }

  // Handle arrival
  onArrived(jobName: string, customerName: string): void {
    this.voice.announceArrival(jobName, customerName);
  }

  // Handle delivery complete
  onDeliveryComplete(): void {
    this.voice.announceDeliveryComplete();
  }

  // Handle SLA warning
  onSLAWarning(ticketId: string, stage: string, message: string): void {
    this.voice.announceUrgent(message);
    this.notifications.notifySLAWarning(ticketId, stage);
  }

  // Get current GPS status
  getGPSStatus(): {
    enabled: boolean;
    tracking: boolean;
    lastLocation: GeolocationPosition | null;
  } {
    return {
      enabled: this.gps.isAvailable(),
      tracking: this.gps.getLastLocation() !== null,
      lastLocation: this.gps.getLastLocation(),
    };
  }

  // Stop all services
  shutdown(): void {
    this.voice.stop();
    this.gps.stopTracking();
  }
}

export const driverAssistance = new DriverAssistanceController();
