'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Settings, Sun, Moon, Monitor, User, GraduationCap, Bell,
  ChevronRight, LogOut, Award, Flame, X, Camera, Check
} from 'lucide-react';
import { useTraining, USER_ROLES, ROLE_TRAINING_MODULES } from '@/lib/training-context';

export default function SettingsMenu() {
  const {
    settings,
    updateSettings,
    progress,
    currentTheme,
    setShowTrainingPopup
  } = useTraining();

  const [isOpen, setIsOpen] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const requiredModules = ROLE_TRAINING_MODULES[settings.role] || [];
  const completedCount = requiredModules.filter(m => progress.completedModules.includes(m)).length;
  const trainingProgress = Math.round((completedCount / requiredModules.length) * 100);

  const handleThemeChange = (theme: 'dark' | 'light' | 'system') => {
    updateSettings({ theme });
  };

  return (
    <div ref={menuRef} className="relative">
      {/* Settings Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors relative"
        aria-label="Settings"
      >
        <Settings
          className={`text-neutral-400 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`}
          size={20}
        />
        {progress.streak > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
            <Flame size={10} className="text-white" />
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-80 bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-slide-down">
          {/* User Profile Header */}
          <div className="p-4 bg-gradient-to-r from-white/[0.02] to-transparent border-b border-white/5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowProfileEditor(true)}
                className="relative group"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-green to-emerald-600 flex items-center justify-center overflow-hidden">
                  {settings.profileImage ? (
                    <img src={settings.profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="text-black" size={24} />
                  )}
                </div>
                <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera size={16} className="text-white" />
                </div>
              </button>
              <div className="flex-1">
                <div className="font-semibold text-white">{settings.displayName}</div>
                <div className="text-xs text-neutral-400">{USER_ROLES[settings.role]}</div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-brand-green font-bold">
                  <Award size={14} />
                  {progress.points}
                </div>
                {progress.streak > 0 && (
                  <div className="flex items-center gap-1 text-xs text-orange-400">
                    <Flame size={10} />
                    {progress.streak} day streak
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Theme Selection */}
          <div className="p-3 border-b border-white/5">
            <div className="text-xs text-neutral-500 uppercase tracking-wider mb-2 px-1">Theme</div>
            <div className="flex gap-2">
              {[
                { id: 'dark', icon: Moon, label: 'Dark' },
                { id: 'light', icon: Sun, label: 'Light' },
                { id: 'system', icon: Monitor, label: 'System' },
              ].map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => handleThemeChange(id as 'dark' | 'light' | 'system')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    settings.theme === id
                      ? 'bg-brand-green text-black'
                      : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Training Progress */}
          <div className="p-3 border-b border-white/5">
            <div className="text-xs text-neutral-500 uppercase tracking-wider mb-2 px-1">Training</div>
            <button
              onClick={() => {
                setShowTrainingPopup(true);
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/5 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-green/20 flex items-center justify-center">
                <GraduationCap className="text-brand-green" size={20} />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-white">Training Progress</div>
                <div className="h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
                  <div
                    className="h-1.5 bg-brand-green rounded-full transition-all"
                    style={{ width: `${trainingProgress}%` }}
                  />
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-brand-green">{trainingProgress}%</div>
                <div className="text-xs text-neutral-500">{completedCount}/{requiredModules.length}</div>
              </div>
              <ChevronRight className="text-neutral-500 group-hover:text-neutral-300 transition-colors" size={16} />
            </button>

            <div className="flex items-center justify-between mt-2 px-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={progress.dontShowPopup}
                  onChange={(e) => updateSettings({ ...settings })}
                  disabled
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-brand-green focus:ring-brand-green focus:ring-offset-0"
                />
                <span className="text-xs text-neutral-500">Disable training popup</span>
              </label>
              <Link
                href="/portal/admin/training"
                onClick={() => setIsOpen(false)}
                className="text-xs text-brand-green hover:text-lime-400 transition-colors"
              >
                Full Training
              </Link>
            </div>
          </div>

          {/* Notifications */}
          <div className="p-3 border-b border-white/5">
            <div className="text-xs text-neutral-500 uppercase tracking-wider mb-2 px-1">Notifications</div>
            <div className="space-y-2">
              {[
                { key: 'training', label: 'Training reminders' },
                { key: 'deliveries', label: 'Delivery updates' },
                { key: 'inventory', label: 'Low stock alerts' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                  <span className="text-sm text-neutral-300">{label}</span>
                  <div
                    onClick={() => updateSettings({
                      notifications: {
                        ...settings.notifications,
                        [key]: !settings.notifications[key as keyof typeof settings.notifications]
                      }
                    })}
                    className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer ${
                      settings.notifications[key as keyof typeof settings.notifications]
                        ? 'bg-brand-green'
                        : 'bg-white/10'
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        settings.notifications[key as keyof typeof settings.notifications]
                          ? 'translate-x-5'
                          : 'translate-x-1'
                      }`}
                    />
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="p-3">
            <Link
              href="/portal/admin/training"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors text-neutral-300 hover:text-white"
            >
              <GraduationCap size={18} />
              <span className="text-sm">Training Portal</span>
            </Link>
            <Link
              href="/portal"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors text-neutral-300 hover:text-white"
            >
              <LogOut size={18} />
              <span className="text-sm">Back to Portal</span>
            </Link>
          </div>
        </div>
      )}

      {/* Profile Editor Modal */}
      {showProfileEditor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Edit Profile</h3>
              <button
                onClick={() => setShowProfileEditor(false)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
              >
                <X size={16} className="text-neutral-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Profile Image */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-green to-emerald-600 flex items-center justify-center overflow-hidden">
                  {settings.profileImage ? (
                    <img src={settings.profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="text-black" size={32} />
                  )}
                </div>
                <div>
                  <label className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-medium text-white cursor-pointer transition-colors inline-block">
                    Upload Image
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            updateSettings({ profileImage: ev.target?.result as string });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  {settings.profileImage && (
                    <button
                      onClick={() => updateSettings({ profileImage: '' })}
                      className="ml-2 text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Display Name</label>
                <input
                  type="text"
                  value={settings.displayName}
                  onChange={(e) => updateSettings({ displayName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:border-brand-green focus:outline-none"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Email</label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => updateSettings({ email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:border-brand-green focus:outline-none"
                />
              </div>

              {/* Role (display only) */}
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Role</label>
                <div className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-neutral-500">
                  {USER_ROLES[settings.role]} (contact admin to change)
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowProfileEditor(false)}
                className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowProfileEditor(false)}
                className="px-6 py-2 bg-brand-green hover:bg-lime-400 text-black font-semibold rounded-xl text-sm flex items-center gap-2 transition-colors"
              >
                <Check size={16} />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
