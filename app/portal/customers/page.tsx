'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, Users, Plus, Copy, Send, Eye, EyeOff, Trash2,
  Phone, Mail, MapPin, Calendar, FileText, MessageSquare,
  CheckCircle, XCircle, RefreshCw, ExternalLink, Search,
  ChevronDown, Settings, Link2
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { TEAM_MEMBERS } from '@/lib/team-roles';

interface PortalSettings {
  showWeather: boolean;
  showHailReports: boolean;
  showAppointments: boolean;
  showDocuments: boolean;
  showMessages: boolean;
  showJobProgress: boolean;
  allowFileUpload: boolean;
  allowMessages: boolean;
}

interface CustomerPortal {
  accessToken: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  salesRepName: string;
  salesRepSlug: string;
  jobId: string;
  createdAt: string;
  lastAccessedAt: string;
  isActive: boolean;
  notificationSent: boolean;
  notificationChannel: string;
  portalUrl: string;
  settings?: PortalSettings;
}

export default function CustomerPortalsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [portals, setPortals] = useState<CustomerPortal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // New customer form
  const [newCustomer, setNewCustomer] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    salesRepSlug: '',
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/portal');
    } else if (user && !['owner', 'admin', 'office', 'project_manager'].includes(user.role)) {
      router.push('/portal/dashboard');
    } else if (user) {
      fetchPortals();
    }
  }, [user, authLoading, router]);

  const fetchPortals = async () => {
    try {
      const response = await fetch('/api/admin/customer-portal');
      if (response.ok) {
        const data = await response.json();
        setPortals(data.portals || []);
      }
    } catch (error) {
      console.error('Error fetching portals:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPortal = async () => {
    if (!newCustomer.customerName || (!newCustomer.customerEmail && !newCustomer.customerPhone)) {
      alert('Please enter customer name and at least email or phone');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/admin/customer-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer),
      });

      if (response.ok) {
        setShowCreateModal(false);
        setNewCustomer({
          customerName: '',
          customerEmail: '',
          customerPhone: '',
          customerAddress: '',
          salesRepSlug: '',
        });
        fetchPortals();
      }
    } catch (error) {
      console.error('Error creating portal:', error);
    } finally {
      setCreating(false);
    }
  };

  const togglePortalStatus = async (accessToken: string, currentStatus: boolean) => {
    try {
      const response = await fetch('/api/admin/customer-portal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          action: currentStatus ? 'deactivate' : 'activate',
        }),
      });

      if (response.ok) {
        fetchPortals();
      }
    } catch (error) {
      console.error('Error toggling portal:', error);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const filteredPortals = portals.filter(p =>
    p.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.customerPhone.includes(searchTerm)
  );

  const salesReps = TEAM_MEMBERS.filter(m =>
    ['owner', 'admin', 'project_manager'].includes(m.role) && m.isActive
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-green" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/portal/dashboard')}
                className="text-neutral-400 hover:text-white"
              >
                ← Back
              </button>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="text-brand-green" size={24} />
                  Customer Portals
                </h1>
                <p className="text-sm text-neutral-400">{portals.length} customer portals</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-green text-black font-medium rounded-lg hover:bg-brand-green/90 transition-colors"
            >
              <Plus size={18} />
              Create Portal
            </button>
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-12 pr-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50"
          />
        </div>
      </div>

      {/* Portals List */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {filteredPortals.length === 0 ? (
          <div className="bg-neutral-900 rounded-xl p-12 text-center border border-neutral-800">
            <Users className="text-neutral-600 mx-auto mb-4" size={48} />
            <h3 className="text-lg font-semibold text-white mb-2">No Customer Portals</h3>
            <p className="text-neutral-400 mb-6">Create your first customer portal to share project info with homeowners.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-brand-green text-black font-medium rounded-lg hover:bg-brand-green/90"
            >
              Create First Portal
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPortals.map((portal) => (
              <div
                key={portal.accessToken}
                className={`bg-neutral-900 rounded-xl border ${
                  portal.isActive ? 'border-neutral-800' : 'border-red-900/50'
                } overflow-hidden`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">{portal.customerName}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          portal.isActive
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {portal.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {portal.notificationSent && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                            Notified via {portal.notificationChannel}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-neutral-400 mb-4">
                        {portal.customerEmail && (
                          <span className="flex items-center gap-1">
                            <Mail size={14} />
                            {portal.customerEmail}
                          </span>
                        )}
                        {portal.customerPhone && (
                          <span className="flex items-center gap-1">
                            <Phone size={14} />
                            {portal.customerPhone}
                          </span>
                        )}
                        {portal.customerAddress && (
                          <span className="flex items-center gap-1">
                            <MapPin size={14} />
                            {portal.customerAddress}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs text-neutral-500">
                        <span>Rep: {portal.salesRepName}</span>
                        <span>•</span>
                        <span>Created: {new Date(portal.createdAt).toLocaleDateString()}</span>
                        {portal.lastAccessedAt && (
                          <>
                            <span>•</span>
                            <span>Last visited: {new Date(portal.lastAccessedAt).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(portal.portalUrl, portal.accessToken)}
                        className={`p-2 rounded-lg transition-colors ${
                          copied === portal.accessToken
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                        title="Copy portal link"
                      >
                        {copied === portal.accessToken ? <CheckCircle size={18} /> : <Copy size={18} />}
                      </button>
                      <a
                        href={portal.portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors"
                        title="Open portal"
                      >
                        <ExternalLink size={18} />
                      </a>
                      <button
                        onClick={() => setShowSettingsModal(portal.accessToken)}
                        className="p-2 bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors"
                        title="Settings"
                      >
                        <Settings size={18} />
                      </button>
                      <button
                        onClick={() => togglePortalStatus(portal.accessToken, portal.isActive)}
                        className={`p-2 rounded-lg transition-colors ${
                          portal.isActive
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        }`}
                        title={portal.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {portal.isActive ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-neutral-800">
                    <button
                      onClick={() => {
                        const smsText = `Hi ${portal.customerName.split(' ')[0]}! Your River City Roofing customer portal is ready. View appointments, documents & more: ${portal.portalUrl}`;
                        window.open(`sms:${portal.customerPhone}?body=${encodeURIComponent(smsText)}`);
                      }}
                      disabled={!portal.customerPhone}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-sm hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send size={14} />
                      Send SMS
                    </button>
                    <button
                      onClick={() => {
                        const subject = 'Your Customer Portal is Ready - River City Roofing';
                        const body = `Hi ${portal.customerName.split(' ')[0]},\n\nYour River City Roofing customer portal is ready! You can view appointments, documents, and more here:\n\n${portal.portalUrl}\n\nIf you have any questions, reply to this email.\n\n- River City Roofing Solutions`;
                        window.open(`mailto:${portal.customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
                      }}
                      disabled={!portal.customerEmail}
                      className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-sm hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Mail size={14} />
                      Send Email
                    </button>
                    <button
                      onClick={() => copyToClipboard(
                        `Hi ${portal.customerName.split(' ')[0]}! Your River City Roofing customer portal is ready. View appointments, documents & more: ${portal.portalUrl}`,
                        `sms-${portal.accessToken}`
                      )}
                      className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 text-neutral-400 rounded-lg text-sm hover:text-white"
                    >
                      <Copy size={14} />
                      {copied === `sms-${portal.accessToken}` ? 'Copied!' : 'Copy Message'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Portal Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 rounded-2xl max-w-lg w-full p-6 border border-neutral-800">
            <h2 className="text-xl font-bold text-white mb-6">Create Customer Portal</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={newCustomer.customerName}
                  onChange={(e) => setNewCustomer({ ...newCustomer, customerName: e.target.value })}
                  placeholder="John Smith"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={newCustomer.customerPhone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, customerPhone: e.target.value })}
                    placeholder="(256) 555-1234"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newCustomer.customerEmail}
                    onChange={(e) => setNewCustomer({ ...newCustomer, customerEmail: e.target.value })}
                    placeholder="john@example.com"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Address
                </label>
                <input
                  type="text"
                  value={newCustomer.customerAddress}
                  onChange={(e) => setNewCustomer({ ...newCustomer, customerAddress: e.target.value })}
                  placeholder="123 Main St, Huntsville, AL 35801"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Assigned Sales Rep
                </label>
                <select
                  value={newCustomer.salesRepSlug}
                  onChange={(e) => setNewCustomer({ ...newCustomer, salesRepSlug: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green/50"
                >
                  <option value="">Select a rep...</option>
                  {salesReps.map((rep) => (
                    <option key={rep.id} value={rep.slug}>{rep.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-3 bg-neutral-800 text-white rounded-xl hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createPortal}
                disabled={creating || !newCustomer.customerName}
                className="flex-1 px-4 py-3 bg-brand-green text-black font-medium rounded-xl hover:bg-brand-green/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating && <Loader2 className="animate-spin" size={18} />}
                Create Portal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <PortalSettingsModal
          accessToken={showSettingsModal}
          portal={portals.find(p => p.accessToken === showSettingsModal)}
          onClose={() => setShowSettingsModal(null)}
          onSave={() => {
            setShowSettingsModal(null);
            fetchPortals();
          }}
        />
      )}
    </div>
  );
}

// Portal Settings Modal Component
function PortalSettingsModal({
  accessToken,
  portal,
  onClose,
  onSave,
}: {
  accessToken: string;
  portal?: CustomerPortal;
  onClose: () => void;
  onSave: () => void;
}) {
  const defaultSettings: PortalSettings = {
    showWeather: true,
    showHailReports: true,
    showAppointments: true,
    showDocuments: true,
    showMessages: true,
    showJobProgress: true,
    allowFileUpload: true,
    allowMessages: true,
  };

  const [settings, setSettings] = useState<PortalSettings>(
    portal?.settings || defaultSettings
  );
  const [saving, setSaving] = useState(false);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/customer-portal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          action: 'update-settings',
          settings,
        }),
      });

      if (response.ok) {
        onSave();
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 rounded-2xl max-w-lg w-full p-6 border border-neutral-800">
        <h2 className="text-xl font-bold text-white mb-2">Portal Settings</h2>
        <p className="text-neutral-400 text-sm mb-6">Control what this customer can see and do</p>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-neutral-300 uppercase tracking-wider">Visible Sections</h3>

          {[
            { key: 'showJobProgress', label: 'Job Progress Tracker', desc: 'Show project phases and progress bar' },
            { key: 'showAppointments', label: 'Appointments', desc: 'Show scheduled appointments' },
            { key: 'showDocuments', label: 'Documents', desc: 'Show estimates, invoices, contracts' },
            { key: 'showMessages', label: 'Message History', desc: 'Show communication history' },
            { key: 'showWeather', label: 'Weather Forecast', desc: 'Show 5-day weather forecast' },
            { key: 'showHailReports', label: 'Hail Reports', desc: 'Show nearby hail activity' },
          ].map((item) => (
            <label key={item.key} className="flex items-center justify-between p-3 bg-neutral-800 rounded-xl cursor-pointer hover:bg-neutral-750">
              <div>
                <p className="text-white font-medium">{item.label}</p>
                <p className="text-sm text-neutral-400">{item.desc}</p>
              </div>
              <input
                type="checkbox"
                checked={settings[item.key as keyof typeof settings]}
                onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                className="w-5 h-5 rounded bg-neutral-700 border-neutral-600 text-brand-green focus:ring-brand-green/50"
              />
            </label>
          ))}

          <h3 className="text-sm font-medium text-neutral-300 uppercase tracking-wider mt-6">Customer Actions</h3>

          {[
            { key: 'allowFileUpload', label: 'Allow File Uploads', desc: 'Customer can upload photos/documents' },
            { key: 'allowMessages', label: 'Allow Messages', desc: 'Customer can send messages to rep' },
          ].map((item) => (
            <label key={item.key} className="flex items-center justify-between p-3 bg-neutral-800 rounded-xl cursor-pointer hover:bg-neutral-750">
              <div>
                <p className="text-white font-medium">{item.label}</p>
                <p className="text-sm text-neutral-400">{item.desc}</p>
              </div>
              <input
                type="checkbox"
                checked={settings[item.key as keyof typeof settings]}
                onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                className="w-5 h-5 rounded bg-neutral-700 border-neutral-600 text-brand-green focus:ring-brand-green/50"
              />
            </label>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-neutral-800 text-white rounded-xl hover:bg-neutral-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex-1 px-4 py-3 bg-brand-green text-black font-medium rounded-xl hover:bg-brand-green/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="animate-spin" size={18} />}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
