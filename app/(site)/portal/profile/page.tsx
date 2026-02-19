'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  Save,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Camera,
  Truck,
  FileText,
  Plus,
  Trash2,
  Eye,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface ProfileData {
  slug: string;
  name: string;
  position: string;
  category: string;
  email: string;
  phone: string;
  altEmail: string;
  bio: string;
  tagline: string;
  region?: string;
  profileImage: string;
  truckImage: string;
  facebook: string;
  instagram: string;
  x: string;
  tiktok: string;
  linkedin: string;
  keyStrengths: string[];
  responsibilities: string[];
  hasPendingEdit: boolean;
  pendingEdit: {
    id: string;
    submittedAt: string;
    changes: Record<string, unknown>;
  } | null;
}

interface FormFields {
  bio: string;
  tagline: string;
  phone: string;
  email: string;
  altEmail: string;
  facebook: string;
  instagram: string;
  x: string;
  tiktok: string;
  linkedin: string;
  keyStrengths: string[];
  responsibilities: string[];
}

export default function ProfileEditPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [formData, setFormData] = useState<FormFields>({
    bio: '',
    tagline: '',
    phone: '',
    email: '',
    altEmail: '',
    facebook: '',
    instagram: '',
    x: '',
    tiktok: '',
    linkedin: '',
    keyStrengths: [],
    responsibilities: [],
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/portal');
    }
  }, [user, authLoading, router]);

  // Load profile
  const loadProfile = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/portal/profile');
      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json();
      if (data.success && data.profile) {
        const p = data.profile as ProfileData;
        setProfile(p);
        setFormData({
          bio: p.bio || '',
          tagline: p.tagline || '',
          phone: p.phone || '',
          email: p.email || '',
          altEmail: p.altEmail || '',
          facebook: p.facebook || '',
          instagram: p.instagram || '',
          x: p.x || '',
          tiktok: p.tiktok || '',
          linkedin: p.linkedin || '',
          keyStrengths: p.keyStrengths || [],
          responsibilities: p.responsibilities || [],
        });
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setMessage({ type: 'error', text: 'Failed to load profile data.' });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Detect changes
  const hasChanges = profile ? (
    formData.bio !== (profile.bio || '') ||
    formData.tagline !== (profile.tagline || '') ||
    formData.phone !== (profile.phone || '') ||
    formData.email !== (profile.email || '') ||
    formData.altEmail !== (profile.altEmail || '') ||
    formData.facebook !== (profile.facebook || '') ||
    formData.instagram !== (profile.instagram || '') ||
    formData.x !== (profile.x || '') ||
    formData.tiktok !== (profile.tiktok || '') ||
    formData.linkedin !== (profile.linkedin || '') ||
    JSON.stringify(formData.keyStrengths) !== JSON.stringify(profile.keyStrengths || []) ||
    JSON.stringify(formData.responsibilities) !== JSON.stringify(profile.responsibilities || [])
  ) : false;

  // Submit changes
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !hasChanges) return;

    setIsSaving(true);
    setMessage(null);

    // Build only changed fields
    const changes: Record<string, unknown> = {};
    if (formData.bio !== (profile.bio || '')) changes.bio = formData.bio;
    if (formData.tagline !== (profile.tagline || '')) changes.tagline = formData.tagline;
    if (formData.phone !== (profile.phone || '')) changes.phone = formData.phone;
    if (formData.email !== (profile.email || '')) changes.email = formData.email;
    if (formData.altEmail !== (profile.altEmail || '')) changes.altEmail = formData.altEmail;
    if (formData.facebook !== (profile.facebook || '')) changes.facebook = formData.facebook;
    if (formData.instagram !== (profile.instagram || '')) changes.instagram = formData.instagram;
    if (formData.x !== (profile.x || '')) changes.x = formData.x;
    if (formData.tiktok !== (profile.tiktok || '')) changes.tiktok = formData.tiktok;
    if (formData.linkedin !== (profile.linkedin || '')) changes.linkedin = formData.linkedin;
    if (JSON.stringify(formData.keyStrengths) !== JSON.stringify(profile.keyStrengths || [])) changes.keyStrengths = formData.keyStrengths;
    if (JSON.stringify(formData.responsibilities) !== JSON.stringify(profile.responsibilities || [])) changes.responsibilities = formData.responsibilities;

    try {
      const res = await fetch('/api/portal/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Changes submitted for approval! You\'ll be notified once reviewed.' });
        await loadProfile();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to submit changes.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Array field helpers
  const updateArrayItem = (field: 'keyStrengths' | 'responsibilities', index: number, value: string) => {
    setFormData(prev => {
      const arr = [...prev[field]];
      arr[index] = value;
      return { ...prev, [field]: arr };
    });
  };

  const addArrayItem = (field: 'keyStrengths' | 'responsibilities') => {
    setFormData(prev => ({ ...prev, [field]: [...prev[field], ''] }));
  };

  const removeArrayItem = (field: 'keyStrengths' | 'responsibilities', index: number) => {
    setFormData(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-2xl mx-auto text-center py-12">
          <AlertTriangle size={48} className="mx-auto text-yellow-500 mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Profile Not Found</h1>
          <p className="text-neutral-400 mb-6">We couldn&apos;t find your team profile. Contact an administrator.</p>
          <Link href="/portal/dashboard" className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <div className="relative z-10 max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/portal/dashboard" className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mb-2">
              <ArrowLeft size={16} /> Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <User className="text-blue-400" size={28} />
              Edit Profile
            </h1>
            <p className="text-neutral-400 mt-1">Update your public profile. Changes require admin approval.</p>
          </div>
          {profile.slug && (
            <Link
              href={`/team/${profile.slug}`}
              target="_blank"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm"
            >
              <Eye size={16} /> View Public Profile
            </Link>
          )}
        </div>

        {/* Pending banner */}
        {profile.hasPendingEdit && profile.pendingEdit && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-start gap-3">
            <Clock className="text-yellow-400 mt-0.5 flex-shrink-0" size={20} />
            <div>
              <p className="text-yellow-200 font-medium">Pending Changes</p>
              <p className="text-yellow-200/70 text-sm">
                You have changes submitted on {new Date(profile.pendingEdit.submittedAt).toLocaleDateString()} awaiting admin review.
              </p>
            </div>
          </div>
        )}

        {/* Status message */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${
            message.type === 'success' ? 'bg-green-500/10 border border-green-500/30' :
            message.type === 'error' ? 'bg-red-500/10 border border-red-500/30' :
            'bg-yellow-500/10 border border-yellow-500/30'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="text-green-400 mt-0.5 flex-shrink-0" size={20} /> :
             message.type === 'error' ? <XCircle className="text-red-400 mt-0.5 flex-shrink-0" size={20} /> :
             <AlertTriangle className="text-yellow-400 mt-0.5 flex-shrink-0" size={20} />}
            <p className={`text-sm ${
              message.type === 'success' ? 'text-green-200' :
              message.type === 'error' ? 'text-red-200' : 'text-yellow-200'
            }`}>{message.text}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Photos Section */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Camera size={20} className="text-blue-400" /> Photos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Profile Photo</label>
                <div className="w-32 h-32 rounded-full bg-white/10 border-2 border-dashed border-white/20 flex items-center justify-center overflow-hidden">
                  {profile.profileImage ? (
                    <img src={profile.profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="text-neutral-500" size={40} />
                  )}
                </div>
                <p className="text-xs text-neutral-500 mt-2">Contact admin to update photos</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Truck Photo</label>
                <div className="w-48 h-32 rounded-lg bg-white/10 border-2 border-dashed border-white/20 flex items-center justify-center overflow-hidden">
                  {profile.truckImage ? (
                    <img src={profile.truckImage} alt="Truck" className="w-full h-full object-cover" />
                  ) : (
                    <Truck className="text-neutral-500" size={40} />
                  )}
                </div>
                <p className="text-xs text-neutral-500 mt-2">Contact admin to update photos</p>
              </div>
            </div>
          </div>

          {/* Bio Section */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileText size={20} className="text-blue-400" /> Bio & Info
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">Tagline</label>
                <input
                  type="text"
                  value={formData.tagline}
                  onChange={e => setFormData(prev => ({ ...prev, tagline: e.target.value }))}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  placeholder="A short description about you..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">Bio</label>
                <textarea
                  rows={6}
                  value={formData.bio}
                  onChange={e => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-y"
                  placeholder="Tell customers about yourself..."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Social Media */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Social Media</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['facebook', 'instagram', 'x', 'tiktok', 'linkedin'] as const).map(platform => (
                <div key={platform}>
                  <label className="block text-sm font-medium text-neutral-300 mb-1 capitalize">{platform === 'x' ? 'X (Twitter)' : platform}</label>
                  <input
                    type="url"
                    value={formData[platform]}
                    onChange={e => setFormData(prev => ({ ...prev, [platform]: e.target.value }))}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    placeholder={`https://${platform === 'x' ? 'x.com' : platform + '.com'}/...`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Key Strengths */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Key Strengths</h2>
            <div className="space-y-2">
              {formData.keyStrengths.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={e => updateArrayItem('keyStrengths', i, e.target.value)}
                    className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    placeholder="Enter a key strength..."
                  />
                  <button type="button" onClick={() => removeArrayItem('keyStrengths', i)} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => addArrayItem('keyStrengths')} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors">
                <Plus size={14} /> Add Strength
              </button>
            </div>
          </div>

          {/* Responsibilities */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Responsibilities</h2>
            <div className="space-y-2">
              {formData.responsibilities.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={e => updateArrayItem('responsibilities', i, e.target.value)}
                    className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    placeholder="Enter a responsibility..."
                  />
                  <button type="button" onClick={() => removeArrayItem('responsibilities', i)} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => addArrayItem('responsibilities')} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors">
                <Plus size={14} /> Add Responsibility
              </button>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-neutral-500">
              {hasChanges ? 'You have unsaved changes' : 'No changes to submit'}
            </p>
            <button
              type="submit"
              disabled={!hasChanges || isSaving}
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all ${
                hasChanges && !isSaving
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/25'
                  : 'bg-white/10 text-neutral-500 cursor-not-allowed'
              }`}
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {isSaving ? 'Submitting...' : 'Submit for Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
