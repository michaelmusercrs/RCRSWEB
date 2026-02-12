'use client';

/**
 * RCRS Command Center - Phone System Management
 *
 * Administrative interface for managing the phone system:
 * - Extension management
 * - Ring group configuration
 * - System settings
 *
 * Requires: phone.manage permission
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Phone,
  Users,
  Settings,
  Plus,
  Edit2,
  Trash2,
  Save,
  RefreshCw,
  Bell,
  Volume2,
  Clock,
  Shield,
  Voicemail,
  PhoneForwarded,
  X,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PermissionGate } from '@/components/command-center/PermissionGate';
import {
  EXTENSIONS,
  RING_GROUPS,
  MAIN_DID,
  formatPhoneNumber,
  type Extension,
  type RingGroup,
} from '@/lib/phone-data';

export default function PhoneManagePage() {
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = React.useState<'extensions' | 'groups' | 'settings'>('extensions');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  // Check permission
  if (!hasPermission('phone.manage')) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Shield size={48} className="mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
          <p className="text-zinc-400 mb-4">You don't have permission to manage the phone system.</p>
          <Link
            href="/command-center/phone"
            className="inline-flex items-center gap-2 text-lime-400 hover:text-lime-300"
          >
            <ArrowLeft size={16} />
            Back to Phone System
          </Link>
        </div>
      </div>
    );
  }

  // Filter extensions by search
  const filteredExtensions = EXTENSIONS.filter(ext =>
    ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ext.extension.includes(searchQuery)
  );

  const handleSave = async () => {
    setSaving(true);
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/command-center/phone"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Phone System Management</h1>
            <p className="text-sm text-zinc-400">Configure extensions, ring groups, and settings</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-2 text-lime-400 text-sm">
              <Check size={16} />
              Saved!
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-lime-400 disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 pb-4">
        {[
          { id: 'extensions', label: 'Extensions', icon: Phone },
          { id: 'groups', label: 'Ring Groups', icon: Users },
          { id: 'settings', label: 'System Settings', icon: Settings },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-lime-500 text-black'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Extensions Tab */}
      {activeTab === 'extensions' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="relative max-w-xs">
              <input
                type="text"
                placeholder="Search extensions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2 pl-10 text-white placeholder-zinc-500 focus:border-lime-500 focus:outline-none"
              />
              <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            </div>
            <button className="inline-flex items-center gap-2 rounded-lg border border-lime-500 px-4 py-2 text-sm font-medium text-lime-400 hover:bg-lime-500/10 transition-colors">
              <Plus size={16} />
              Add Extension
            </button>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-800/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-400">Ext</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-400">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-400">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-400">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-400">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-400">Features</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-zinc-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExtensions.map(ext => (
                  <tr key={ext.extension} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-4 py-3">
                      <span className="font-mono text-lime-400">{ext.extension}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-white">{ext.name}</p>
                        <p className="text-xs text-zinc-500">{ext.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{ext.department}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        ext.role === 'Owner' ? 'bg-amber-500/20 text-amber-400' :
                        ext.role === 'Admin' ? 'bg-purple-500/20 text-purple-400' :
                        ext.role === 'Manager' ? 'bg-brand-green/20 text-blue-400' :
                        'bg-zinc-500/20 text-zinc-400'
                      }`}>
                        {ext.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                        ext.status === 'online' ? 'bg-lime-500/20 text-lime-400' :
                        ext.status === 'busy' ? 'bg-yellow-500/20 text-yellow-400' :
                        ext.status === 'dnd' ? 'bg-red-500/20 text-red-400' :
                        'bg-zinc-500/20 text-zinc-400'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          ext.status === 'online' ? 'bg-lime-400' :
                          ext.status === 'busy' ? 'bg-yellow-400' :
                          ext.status === 'dnd' ? 'bg-red-400' :
                          'bg-zinc-400'
                        }`} />
                        {ext.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {ext.voicemailEnabled && (
                          <span title="Voicemail Enabled" className="text-zinc-500">
                            <Voicemail size={14} />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ring Groups Tab */}
      {activeTab === 'groups' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-zinc-400">Configure how incoming calls are distributed</p>
            <button className="inline-flex items-center gap-2 rounded-lg border border-lime-500 px-4 py-2 text-sm font-medium text-lime-400 hover:bg-lime-500/10 transition-colors">
              <Plus size={16} />
              Add Ring Group
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {RING_GROUPS.map(group => (
              <div
                key={group.groupNumber}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{group.name}</h3>
                    <p className="text-sm text-zinc-400">{group.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Strategy</span>
                    <span className="text-white font-medium">{group.strategy}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Ring Timeout</span>
                    <span className="text-white font-medium">{group.ringTimeout}s</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Members</span>
                    <span className="text-white font-medium">{group.members.length} extensions</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-2">Member Extensions</p>
                  <div className="flex flex-wrap gap-2">
                    {group.members.map(member => (
                      <span key={member.extension} className="px-2 py-1 rounded bg-zinc-800 text-zinc-300 text-xs font-mono">
                        {member.extension}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">General Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Main DID Number</p>
                  <p className="text-sm text-zinc-400">Primary inbound number</p>
                </div>
                <span className="font-mono text-lime-400">{formatPhoneNumber(MAIN_DID)}</span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Business Hours</p>
                  <p className="text-sm text-zinc-400">When calls are routed normally</p>
                </div>
                <span className="text-white">Mon-Fri 8AM-6PM</span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">After Hours Routing</p>
                  <p className="text-sm text-zinc-400">Where calls go outside business hours</p>
                </div>
                <span className="text-white">Voicemail</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Voicemail Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Email Notifications</p>
                  <p className="text-sm text-zinc-400">Send voicemail recordings via email</p>
                </div>
                <button className="w-12 h-6 rounded-full bg-lime-500 p-1">
                  <span className="block w-4 h-4 rounded-full bg-white translate-x-6" />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Max Message Length</p>
                  <p className="text-sm text-zinc-400">Maximum voicemail duration</p>
                </div>
                <span className="text-white">3 minutes</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-amber-400 font-semibold mb-1">Advanced Settings</h3>
                <p className="text-amber-400/70 text-sm">
                  Some settings require system administrator access. Contact support for advanced configuration changes.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
