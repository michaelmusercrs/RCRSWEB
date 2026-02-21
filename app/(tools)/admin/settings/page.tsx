'use client';

/**
 * Admin Settings Page
 * Site configuration and settings management
 * Features: General settings, SEO, Contact info, Appearance, Integrations
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Settings,
  ArrowLeft,
  Home,
  Save,
  Globe,
  Mail,
  Phone,
  MapPin,
  Palette,
  Link2,
  Bell,
  Shield,
  Database,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Clock,
  Users,
  FileText,
  MessageSquare,
  Send,
  TestTube,
} from 'lucide-react';

interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: typeof Settings;
}

export default function AdminSettingsPage() {
  const [activeSection, setActiveSection] = useState('general');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form states
  const [generalSettings, setGeneralSettings] = useState({
    siteName: 'River City Roofing Solutions',
    tagline: 'North Alabama\'s Premier Roofing Company',
    siteUrl: 'https://rivercityroofingsolutions.com',
    adminEmail: 'admin@rivercityroofingsolutions.com',
    timezone: 'America/Chicago',
    dateFormat: 'MMMM D, YYYY',
  });

  const [contactSettings, setContactSettings] = useState({
    phone: '(256) 274-8530',
    email: 'rcrs@rivercityroofingsolutions.com',
    address: '3325 Central Pkwy SW',
    city: 'Decatur',
    state: 'AL',
    zip: '35603',
    hours: 'Mon-Fri: 8am-5pm, Sat: 9am-2pm',
  });

  const [seoSettings, setSeoSettings] = useState({
    metaTitle: 'River City Roofing Solutions | North Alabama Roofing Experts',
    metaDescription: 'Family-owned roofing company serving Huntsville, Madison, Decatur and all of North Alabama. Free inspections, financing available, storm damage specialists.',
    ogImage: '/uploads/logo.png',
    googleAnalytics: 'G-Y8PB85BZC5',
    googleVerification: '',
  });

  const [appearanceSettings, setAppearanceSettings] = useState({
    primaryColor: '#39FF14',
    secondaryColor: '#000000',
    accentColor: '#0066CC',
    logo: '/logo-nobg.png',
    favicon: '/favicon.ico',
    showAnnouncement: false,
    announcementText: '',
  });

  const [integrationSettings, setIntegrationSettings] = useState({
    googleSheetsConnected: true,
    jobNimbusConnected: false,
    emailServiceConnected: true,
    smsServiceConnected: false,
    webhookUrl: '',
  });

  // GroupMe settings state
  const [groupMeSettings, setGroupMeSettings] = useState({
    botId: '',
    enabled: false,
    notifyOn: {
      newLead: true,
      profileEditPending: true,
      lowInventory: true,
      jobStatusChange: true,
      customerPortalActivity: true,
      deliveryUpdates: true,
      slaAlerts: true,
    },
  });
  const [groupMeTesting, setGroupMeTesting] = useState(false);
  const [groupMeTestResult, setGroupMeTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch saved settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/admin/settings');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            if (data.data.general) setGeneralSettings(prev => ({ ...prev, ...data.data.general }));
            if (data.data.contact) setContactSettings(prev => ({ ...prev, ...data.data.contact }));
            if (data.data.seo) setSeoSettings(prev => ({ ...prev, ...data.data.seo }));
            if (data.data.appearance) setAppearanceSettings(prev => ({ ...prev, ...data.data.appearance }));
            if (data.data.integrations) setIntegrationSettings(prev => ({ ...prev, ...data.data.integrations }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      }
    };
    fetchSettings();
  }, []);

  // Fetch GroupMe config on mount
  useEffect(() => {
    const fetchGroupMeConfig = async () => {
      try {
        const response = await fetch('/api/notifications/groupme');
        if (response.ok) {
          const data = await response.json();
          setGroupMeSettings(prev => ({
            ...prev,
            enabled: data.enabled,
            notifyOn: data.notifyOn || prev.notifyOn,
          }));
        }
      } catch (error) {
        console.error('Failed to fetch GroupMe config:', error);
      }
    };
    fetchGroupMeConfig();
  }, []);

  // Test GroupMe connection
  const testGroupMeConnection = async () => {
    if (!groupMeSettings.botId) {
      setGroupMeTestResult({ success: false, message: 'Please enter a Bot ID first' });
      return;
    }
    setGroupMeTesting(true);
    setGroupMeTestResult(null);
    try {
      const response = await fetch(`/api/notifications/groupme?action=test&botId=${groupMeSettings.botId}`);
      const data = await response.json();
      setGroupMeTestResult({
        success: data.success,
        message: data.message || (data.success ? 'Test message sent!' : 'Test failed'),
      });
    } catch (error) {
      setGroupMeTestResult({ success: false, message: 'Failed to test connection' });
    } finally {
      setGroupMeTesting(false);
    }
  };

  const sections: SettingsSection[] = [
    { id: 'general', title: 'General', description: 'Basic site settings', icon: Settings },
    { id: 'contact', title: 'Contact Info', description: 'Business contact details', icon: Phone },
    { id: 'seo', title: 'SEO & Analytics', description: 'Search engine optimization', icon: Globe },
    { id: 'appearance', title: 'Appearance', description: 'Colors, logo, branding', icon: Palette },
    { id: 'integrations', title: 'Integrations', description: 'Third-party services', icon: Link2 },
    { id: 'notifications', title: 'Notifications', description: 'Email and alert settings', icon: Bell },
    { id: 'security', title: 'Security', description: 'Access and permissions', icon: Shield },
    { id: 'backup', title: 'Backup & Data', description: 'Data management', icon: Database },
  ];

  const [saveError, setSaveError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          general: generalSettings,
          contact: contactSettings,
          seo: seoSettings,
          appearance: appearanceSettings,
          integrations: integrationSettings,
          groupMe: groupMeSettings,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save settings');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save settings');
      setTimeout(() => setSaveError(''), 5000);
    } finally {
      setSaving(false);
    }
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                Site Name
              </label>
              <input
                type="text"
                value={generalSettings.siteName}
                onChange={(e) => setGeneralSettings(prev => ({ ...prev, siteName: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                Tagline
              </label>
              <input
                type="text"
                value={generalSettings.tagline}
                onChange={(e) => setGeneralSettings(prev => ({ ...prev, tagline: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                Site URL
              </label>
              <input
                type="url"
                value={generalSettings.siteUrl}
                onChange={(e) => setGeneralSettings(prev => ({ ...prev, siteUrl: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                Admin Email
              </label>
              <input
                type="email"
                value={generalSettings.adminEmail}
                onChange={(e) => setGeneralSettings(prev => ({ ...prev, adminEmail: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  Timezone
                </label>
                <select
                  value={generalSettings.timezone}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, timezone: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white focus:outline-none focus:border-brand-green/50 transition-colors"
                >
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  Date Format
                </label>
                <select
                  value={generalSettings.dateFormat}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, dateFormat: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white focus:outline-none focus:border-brand-green/50 transition-colors"
                >
                  <option value="MMMM D, YYYY">January 15, 2026</option>
                  <option value="MM/DD/YYYY">01/15/2026</option>
                  <option value="DD/MM/YYYY">15/01/2026</option>
                  <option value="YYYY-MM-DD">2026-01-15</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 'contact':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={contactSettings.phone}
                  onChange={(e) => setContactSettings(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={contactSettings.email}
                  onChange={(e) => setContactSettings(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                Street Address
              </label>
              <input
                type="text"
                value={contactSettings.address}
                onChange={(e) => setContactSettings(prev => ({ ...prev, address: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={contactSettings.city}
                  onChange={(e) => setContactSettings(prev => ({ ...prev, city: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  State
                </label>
                <input
                  type="text"
                  value={contactSettings.state}
                  onChange={(e) => setContactSettings(prev => ({ ...prev, state: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  ZIP Code
                </label>
                <input
                  type="text"
                  value={contactSettings.zip}
                  onChange={(e) => setContactSettings(prev => ({ ...prev, zip: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                Business Hours
              </label>
              <input
                type="text"
                value={contactSettings.hours}
                onChange={(e) => setContactSettings(prev => ({ ...prev, hours: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
                placeholder="Mon-Fri: 8am-6pm, Sat: 9am-2pm"
              />
            </div>
          </div>
        );

      case 'seo':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                Meta Title
              </label>
              <input
                type="text"
                value={seoSettings.metaTitle}
                onChange={(e) => setSeoSettings(prev => ({ ...prev, metaTitle: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
              />
              <p className="text-xs text-neutral-500 mt-1">{seoSettings.metaTitle.length}/60 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                Meta Description
              </label>
              <textarea
                value={seoSettings.metaDescription}
                onChange={(e) => setSeoSettings(prev => ({ ...prev, metaDescription: e.target.value }))}
                rows={3}
                className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors resize-none"
              />
              <p className="text-xs text-neutral-500 mt-1">{seoSettings.metaDescription.length}/160 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                Open Graph Image URL
              </label>
              <input
                type="text"
                value={seoSettings.ogImage}
                onChange={(e) => setSeoSettings(prev => ({ ...prev, ogImage: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                Google Analytics ID
              </label>
              <input
                type="text"
                value={seoSettings.googleAnalytics}
                onChange={(e) => setSeoSettings(prev => ({ ...prev, googleAnalytics: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
                placeholder="UA-XXXXXXXXX-X or G-XXXXXXXXXX"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                Google Site Verification
              </label>
              <input
                type="text"
                value={seoSettings.googleVerification}
                onChange={(e) => setSeoSettings(prev => ({ ...prev, googleVerification: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
                placeholder="Verification code"
              />
            </div>
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  Primary Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={appearanceSettings.primaryColor}
                    onChange={(e) => setAppearanceSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                    className="w-10 h-10 rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={appearanceSettings.primaryColor}
                    onChange={(e) => setAppearanceSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                    className="flex-1 px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-brand-green/50 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  Secondary Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={appearanceSettings.secondaryColor}
                    onChange={(e) => setAppearanceSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                    className="w-10 h-10 rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={appearanceSettings.secondaryColor}
                    onChange={(e) => setAppearanceSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                    className="flex-1 px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-brand-green/50 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  Accent Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={appearanceSettings.accentColor}
                    onChange={(e) => setAppearanceSettings(prev => ({ ...prev, accentColor: e.target.value }))}
                    className="w-10 h-10 rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={appearanceSettings.accentColor}
                    onChange={(e) => setAppearanceSettings(prev => ({ ...prev, accentColor: e.target.value }))}
                    className="flex-1 px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-brand-green/50 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                Logo URL
              </label>
              <input
                type="text"
                value={appearanceSettings.logo}
                onChange={(e) => setAppearanceSettings(prev => ({ ...prev, logo: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                Favicon URL
              </label>
              <input
                type="text"
                value={appearanceSettings.favicon}
                onChange={(e) => setAppearanceSettings(prev => ({ ...prev, favicon: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
              />
            </div>

            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-white font-medium">Announcement Banner</p>
                  <p className="text-sm text-neutral-500">Show a banner at the top of the site</p>
                </div>
                <button
                  onClick={() => setAppearanceSettings(prev => ({ ...prev, showAnnouncement: !prev.showAnnouncement }))}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    appearanceSettings.showAnnouncement ? 'bg-brand-green' : 'bg-neutral-700'
                  }`}
                >
                  <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${
                    appearanceSettings.showAnnouncement ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
              {appearanceSettings.showAnnouncement && (
                <input
                  type="text"
                  value={appearanceSettings.announcementText}
                  onChange={(e) => setAppearanceSettings(prev => ({ ...prev, announcementText: e.target.value }))}
                  placeholder="Enter announcement text..."
                  className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
                />
              )}
            </div>
          </div>
        );

      case 'integrations':
        return (
          <div className="space-y-4">
            {[
              { id: 'googleSheets', name: 'Google Sheets', description: 'Sync data with Google Sheets', connected: integrationSettings.googleSheetsConnected },
              { id: 'jobNimbus', name: 'JobNimbus CRM', description: 'Connect to JobNimbus for lead management', connected: integrationSettings.jobNimbusConnected },
              { id: 'emailService', name: 'Email Service', description: 'Transactional email delivery', connected: integrationSettings.emailServiceConnected },
              { id: 'smsService', name: 'SMS Service', description: 'Text message notifications', connected: integrationSettings.smsServiceConnected },
            ].map(integration => (
              <div key={integration.id} className="p-4 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    integration.connected ? 'bg-emerald-500/10' : 'bg-neutral-500/10'
                  }`}>
                    {integration.connected ? (
                      <CheckCircle size={20} className="text-emerald-400" />
                    ) : (
                      <AlertCircle size={20} className="text-neutral-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-white font-medium">{integration.name}</p>
                    <p className="text-sm text-neutral-500">{integration.description}</p>
                  </div>
                </div>
                <button className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  integration.connected
                    ? 'bg-white/5 hover:bg-white/10 text-neutral-400'
                    : 'bg-brand-green hover:bg-lime-400 text-black'
                }`}>
                  {integration.connected ? 'Manage' : 'Connect'}
                </button>
              </div>
            ))}

            <div className="mt-6">
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                Webhook URL (for custom integrations)
              </label>
              <input
                type="url"
                value={integrationSettings.webhookUrl}
                onChange={(e) => setIntegrationSettings(prev => ({ ...prev, webhookUrl: e.target.value }))}
                placeholder="https://your-webhook-url.com/endpoint"
                className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
              />
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            {/* GroupMe Integration */}
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <MessageSquare className="w-5 h-5 text-brand-green" />
                <div>
                  <h3 className="text-white font-medium">GroupMe Team Notifications</h3>
                  <p className="text-sm text-neutral-500">Send instant alerts to Michael & Sara via GroupMe</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Enable/Disable toggle */}
                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg">
                  <div>
                    <p className="text-white font-medium">Enable GroupMe Notifications</p>
                    <p className="text-xs text-neutral-500">Toggle all GroupMe notifications on/off</p>
                  </div>
                  <button
                    onClick={() => setGroupMeSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      groupMeSettings.enabled ? 'bg-brand-green' : 'bg-neutral-700'
                    }`}
                  >
                    <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${
                      groupMeSettings.enabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                {/* Bot ID Input */}
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-2">
                    GroupMe Bot ID
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={groupMeSettings.botId}
                      onChange={(e) => setGroupMeSettings(prev => ({ ...prev, botId: e.target.value }))}
                      placeholder="Enter your GroupMe Bot ID"
                      className="flex-1 px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors font-mono text-sm"
                    />
                    <button
                      onClick={testGroupMeConnection}
                      disabled={groupMeTesting || !groupMeSettings.botId}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {groupMeTesting ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <TestTube size={16} />
                      )}
                      Test
                    </button>
                  </div>
                  <p className="text-xs text-neutral-500 mt-2">
                    Create a bot at <a href="https://dev.groupme.com/bots" target="_blank" rel="noopener noreferrer" className="text-brand-green hover:underline">dev.groupme.com/bots</a>
                  </p>
                  {groupMeTestResult && (
                    <div className={`mt-2 p-3 rounded-lg flex items-center gap-2 ${
                      groupMeTestResult.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {groupMeTestResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                      <span className="text-sm">{groupMeTestResult.message}</span>
                    </div>
                  )}
                </div>

                {/* Notification Types */}
                <div className="border-t border-white/5 pt-4 mt-4">
                  <p className="text-sm font-medium text-neutral-400 mb-3">Notify On:</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'newLead', label: 'New Customer Leads', icon: Users },
                      { key: 'profileEditPending', label: 'Profile Edit Pending', icon: FileText },
                      { key: 'lowInventory', label: 'Low Inventory Alerts', icon: AlertCircle },
                      { key: 'jobStatusChange', label: 'Job Status Changes', icon: RefreshCw },
                      { key: 'customerPortalActivity', label: 'Portal Activity', icon: Globe },
                      { key: 'deliveryUpdates', label: 'Delivery Updates', icon: Send },
                      { key: 'slaAlerts', label: 'SLA Alerts', icon: Bell },
                    ].map(({ key, label, icon: Icon }) => (
                      <div
                        key={key}
                        className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                          groupMeSettings.notifyOn[key as keyof typeof groupMeSettings.notifyOn]
                            ? 'bg-brand-green/5 border border-brand-green/20'
                            : 'bg-white/[0.02] border border-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon size={14} className={
                            groupMeSettings.notifyOn[key as keyof typeof groupMeSettings.notifyOn]
                              ? 'text-brand-green'
                              : 'text-neutral-500'
                          } />
                          <span className="text-sm text-neutral-300">{label}</span>
                        </div>
                        <button
                          onClick={() => setGroupMeSettings(prev => ({
                            ...prev,
                            notifyOn: {
                              ...prev.notifyOn,
                              [key]: !prev.notifyOn[key as keyof typeof prev.notifyOn],
                            },
                          }))}
                          className={`w-10 h-5 rounded-full transition-colors ${
                            groupMeSettings.notifyOn[key as keyof typeof groupMeSettings.notifyOn]
                              ? 'bg-brand-green'
                              : 'bg-neutral-700'
                          }`}
                        >
                          <span className={`block w-4 h-4 bg-white rounded-full transition-transform ${
                            groupMeSettings.notifyOn[key as keyof typeof groupMeSettings.notifyOn]
                              ? 'translate-x-5'
                              : 'translate-x-0.5'
                          }`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Email Notifications */}
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="w-5 h-5 text-neutral-400" />
                <h3 className="text-white font-medium">Email Notifications</h3>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'New form submission', enabled: true },
                  { label: 'Low inventory alerts', enabled: true },
                  { label: 'New blog comments', enabled: false },
                  { label: 'Weekly analytics report', enabled: true },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-neutral-400">{item.label}</span>
                    <button className={`w-12 h-6 rounded-full transition-colors ${
                      item.enabled ? 'bg-brand-green' : 'bg-neutral-700'
                    }`}>
                      <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${
                        item.enabled ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
              <h3 className="text-white font-medium mb-2">Change Admin Password</h3>
              <p className="text-sm text-neutral-500 mb-4">Update the admin panel password</p>
              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="Current password"
                  className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
                />
                <input
                  type="password"
                  placeholder="New password"
                  className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 transition-colors"
                />
                <button className="px-4 py-2 bg-brand-green hover:bg-lime-400 text-black font-medium rounded-lg transition-colors">
                  Update Password
                </button>
              </div>
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <h3 className="text-amber-400 font-medium mb-2">Security Notice</h3>
              <p className="text-sm text-amber-400/70">
                For production use, we recommend implementing a proper authentication system like NextAuth, Clerk, or Auth0.
              </p>
            </div>
          </div>
        );

      case 'backup':
        return (
          <div className="space-y-6">
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
              <h3 className="text-white font-medium mb-2">Export Data</h3>
              <p className="text-sm text-neutral-500 mb-4">Download all website data as JSON</p>
              <div className="flex gap-3">
                <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors">
                  <FileText size={16} />
                  Export Blog Posts
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors">
                  <Users size={16} />
                  Export Team Data
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors">
                  <Database size={16} />
                  Export All
                </button>
              </div>
            </div>

            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
              <h3 className="text-white font-medium mb-2">Last Backup</h3>
              <div className="flex items-center gap-2 text-neutral-400">
                <Clock size={16} />
                <span>February 4, 2026 at 3:45 PM</span>
              </div>
            </div>

            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <h3 className="text-red-400 font-medium mb-2">Danger Zone</h3>
              <p className="text-sm text-red-400/70 mb-4">
                Permanently delete all data. This action cannot be undone.
              </p>
              <button className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-colors">
                Delete All Data
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href="/admin"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={18} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Settings</h1>
                  <p className="text-sm text-neutral-400">Configure site settings</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {saved && (
                  <span className="flex items-center gap-2 text-emerald-400 text-sm">
                    <CheckCircle size={16} />
                    Saved!
                  </span>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-green hover:bg-lime-400 text-black font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save Changes
                    </>
                  )}
                </button>
                <Link
                  href="/"
                  target="_blank"
                  className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 text-sm transition-colors"
                >
                  <Home size={16} />
                  View Site
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex gap-8">
            {/* Sidebar */}
            <div className="w-64 flex-shrink-0">
              <nav className="space-y-1">
                {sections.map(section => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                        activeSection === section.id
                          ? 'bg-brand-green/10 text-brand-green'
                          : 'text-neutral-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon size={18} />
                      <div className="text-left">
                        <p className="font-medium text-sm">{section.title}</p>
                        <p className="text-xs opacity-60">{section.description}</p>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Content */}
            <div className="flex-1">
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                <h2 className="text-xl font-semibold text-white mb-6">
                  {sections.find(s => s.id === activeSection)?.title}
                </h2>
                {renderSectionContent()}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
