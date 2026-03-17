'use client';

import { useState, useEffect } from 'react';
import { Bell, Mail, MessageSquare, CloudRain, RefreshCw, Loader2, CheckCircle } from 'lucide-react';

interface NotificationPreferencesProps {
  customerId: string;
  token?: string;
}

interface Preferences {
  emailNotifications: boolean;
  smsNotifications: boolean;
  weatherAlerts: boolean;
  statusUpdates: boolean;
}

const NOTIFICATION_OPTIONS = [
  {
    key: 'emailNotifications' as const,
    label: 'Email Notifications',
    description: 'Receive updates and reminders via email',
    icon: Mail,
  },
  {
    key: 'smsNotifications' as const,
    label: 'SMS Notifications',
    description: 'Get text messages for important updates',
    icon: MessageSquare,
  },
  {
    key: 'weatherAlerts' as const,
    label: 'Weather Alerts',
    description: 'Notifications about severe weather or hail in your area',
    icon: CloudRain,
  },
  {
    key: 'statusUpdates' as const,
    label: 'Project Status Updates',
    description: 'Notifications when your project status changes',
    icon: RefreshCw,
  },
];

export default function NotificationPreferences({ customerId, token }: NotificationPreferencesProps) {
  const [preferences, setPreferences] = useState<Preferences>({
    emailNotifications: true,
    smsNotifications: true,
    weatherAlerts: true,
    statusUpdates: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, [token]);

  const fetchPreferences = async () => {
    if (!token) { setLoading(false); return; }
    try {
      const response = await fetch(`/api/customer/notification-preferences?token=${token}`);
      if (response.ok) {
        const data = await response.json();
        if (data.preferences) {
          setPreferences({
            emailNotifications: data.preferences.emailNotifications ?? true,
            smsNotifications: data.preferences.smsNotifications ?? true,
            weatherAlerts: data.preferences.weatherAlerts ?? true,
            statusUpdates: data.preferences.statusUpdates ?? true,
          });
        }
      }
    } catch {
      // Use defaults on error
    } finally {
      setLoading(false);
    }
  };

  const togglePreference = async (key: keyof Preferences) => {
    const newPrefs = { ...preferences, [key]: !preferences[key] };
    setPreferences(newPrefs);

    // Auto-save
    setSaving(true);
    try {
      const response = await fetch('/api/customer/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          ...newPrefs,
        }),
      });

      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // Revert on error
      setPreferences(preferences);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-[#0066CC]" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold text-neutral-800 flex items-center gap-2">
              <Bell className="text-[#0066CC]" size={20} />
              Notification Preferences
            </h3>
            <p className="text-sm text-neutral-500 mt-1">
              Choose how you would like to be notified about your roofing project.
            </p>
          </div>
          {saving && (
            <span className="text-xs text-neutral-400 flex items-center gap-1">
              <Loader2 className="animate-spin" size={12} />
              Saving...
            </span>
          )}
          {saved && !saving && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle size={12} />
              Saved
            </span>
          )}
        </div>

        <div className="space-y-1">
          {NOTIFICATION_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isEnabled = preferences[option.key];

            return (
              <div
                key={option.key}
                className="flex items-center justify-between p-4 rounded-xl hover:bg-neutral-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isEnabled ? 'bg-blue-100' : 'bg-neutral-100'
                  }`}>
                    <Icon className={isEnabled ? 'text-[#0066CC]' : 'text-neutral-400'} size={20} />
                  </div>
                  <div>
                    <p className="font-medium text-neutral-800">{option.label}</p>
                    <p className="text-sm text-neutral-500">{option.description}</p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <button
                  onClick={() => togglePreference(option.key)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4 ${
                    isEnabled ? 'bg-[#0066CC]' : 'bg-neutral-300'
                  }`}
                  role="switch"
                  aria-checked={isEnabled}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      isEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Even with notifications turned off, you can always check your portal
          for the latest updates. Critical safety alerts (like emergency weather warnings) may still be sent
          regardless of these settings.
        </p>
      </div>
    </div>
  );
}
