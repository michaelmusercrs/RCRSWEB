'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  User,
  Save,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Phone,
  Mail,
  Globe,
  Plus,
  Trash2,
  Camera,
  History,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { teamMembers, TeamMember } from '@/lib/teamData';

interface ProfileChanges {
  bio?: string;
  tagline?: string;
  phone?: string;
  email?: string;
  altEmail?: string;
  profileImage?: string;
  facebook?: string;
  instagram?: string;
  x?: string;
  tiktok?: string;
  linkedin?: string;
  keyStrengths?: string[];
  responsibilities?: string[];
}

interface PendingEdit {
  id: string;
  submittedAt: string;
  changes: ProfileChanges;
}

interface EditHistoryItem {
  id: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  changes: ProfileChanges;
}

export default function MyProfilePage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null);
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);
  const [editHistory, setEditHistory] = useState<EditHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState<ProfileChanges>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/portal');
    }
  }, [user, authLoading, router]);

  // Load team member data
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      setIsLoading(true);

      // Find team member by slug from auth user
      const member = teamMembers.find(m => m.slug === user.userId.toLowerCase().replace(/^rvr-\d+-?/, '').toLowerCase()) ||
                     teamMembers.find(m => m.email.toLowerCase() === user.email.toLowerCase());

      if (member) {
        setTeamMember(member);
        setFormData({
          bio: member.bio,
          tagline: member.tagline || '',
          phone: member.phone,
          email: member.email,
          altEmail: member.altEmail,
          facebook: member.facebook || '',
          instagram: member.instagram || '',
          x: member.x || '',
          tiktok: member.tiktok || '',
          linkedin: member.linkedin || '',
          keyStrengths: member.keyStrengths || [],
          responsibilities: member.responsibilities || [],
        });
      }

      // Check for pending edit
      try {
        const pendingResponse = await fetch(`/api/profile/submit-edit?userId=${user.userId}`);
        if (pendingResponse.ok) {
          const data = await pendingResponse.json();
          if (data.hasPendingEdit) {
            setPendingEdit(data.pendingEdit);
            // Merge pending changes into form
            setFormData(prev => ({ ...prev, ...data.pendingEdit.changes }));
          }
        }

        // Load edit history
        const historyResponse = await fetch(`/api/profile/my-edits?userId=${user.userId}`);
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          setEditHistory(historyData.edits);
        }
      } catch (error) {
        console.error('Error loading profile data:', error);
      }

      setIsLoading(false);
    };

    loadData();
  }, [user]);

  // Track changes
  useEffect(() => {
    if (!teamMember) return;

    const originalData: ProfileChanges = {
      bio: teamMember.bio,
      tagline: teamMember.tagline || '',
      phone: teamMember.phone,
      email: teamMember.email,
      altEmail: teamMember.altEmail,
      facebook: teamMember.facebook || '',
      instagram: teamMember.instagram || '',
      x: teamMember.x || '',
      tiktok: teamMember.tiktok || '',
      linkedin: teamMember.linkedin || '',
      keyStrengths: teamMember.keyStrengths || [],
      responsibilities: teamMember.responsibilities || [],
    };

    const changed = Object.keys(formData).some(key => {
      const k = key as keyof ProfileChanges;
      const original = originalData[k];
      const current = formData[k];

      if (Array.isArray(original) && Array.isArray(current)) {
        return JSON.stringify(original) !== JSON.stringify(current);
      }
      return original !== current;
    });

    setHasChanges(changed);
  }, [formData, teamMember]);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !hasChanges) return;

    setIsSaving(true);
    setMessage(null);

    try {
      // Only send changed fields
      const changedFields: ProfileChanges = {};
      const originalData: ProfileChanges = {
        bio: teamMember?.bio,
        tagline: teamMember?.tagline || '',
        phone: teamMember?.phone,
        email: teamMember?.email,
        altEmail: teamMember?.altEmail,
        facebook: teamMember?.facebook || '',
        instagram: teamMember?.instagram || '',
        x: teamMember?.x || '',
        tiktok: teamMember?.tiktok || '',
        linkedin: teamMember?.linkedin || '',
        keyStrengths: teamMember?.keyStrengths || [],
        responsibilities: teamMember?.responsibilities || [],
      };

      (Object.keys(formData) as (keyof ProfileChanges)[]).forEach(key => {
        const original = originalData[key];
        const current = formData[key];

        if (Array.isArray(original) && Array.isArray(current)) {
          if (JSON.stringify(original) !== JSON.stringify(current)) {
            (changedFields as Record<string, unknown>)[key] = current;
          }
        } else if (original !== current) {
          (changedFields as Record<string, unknown>)[key] = current;
        }
      });

      const response = await fetch('/api/profile/submit-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.userId,
          changes: changedFields,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: 'success',
          text: 'Your changes have been submitted for approval. You will be notified once they are reviewed.',
        });
        setPendingEdit(data.editRequest);
        setHasChanges(false);

        // Refresh history
        const historyResponse = await fetch(`/api/profile/my-edits?userId=${user.userId}`);
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          setEditHistory(historyData.edits);
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to submit changes' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel pending edit
  const handleCancelPending = async () => {
    if (!user || !pendingEdit) return;

    try {
      const response = await fetch(
        `/api/profile/my-edits?editId=${pendingEdit.id}&userId=${user.userId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        setPendingEdit(null);
        // Reset form to original data
        if (teamMember) {
          setFormData({
            bio: teamMember.bio,
            tagline: teamMember.tagline || '',
            phone: teamMember.phone,
            email: teamMember.email,
            altEmail: teamMember.altEmail,
            facebook: teamMember.facebook || '',
            instagram: teamMember.instagram || '',
            x: teamMember.x || '',
            tiktok: teamMember.tiktok || '',
            linkedin: teamMember.linkedin || '',
            keyStrengths: teamMember.keyStrengths || [],
            responsibilities: teamMember.responsibilities || [],
          });
        }
        setMessage({ type: 'success', text: 'Pending changes cancelled.' });

        // Refresh history
        const historyResponse = await fetch(`/api/profile/my-edits?userId=${user.userId}`);
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          setEditHistory(historyData.edits);
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to cancel pending changes' });
    }
  };

  // Handle array field changes
  const handleArrayFieldChange = (field: 'keyStrengths' | 'responsibilities', index: number, value: string) => {
    setFormData(prev => {
      const current = [...(prev[field] || [])];
      current[index] = value;
      return { ...prev, [field]: current };
    });
  };

  const handleAddArrayItem = (field: 'keyStrengths' | 'responsibilities') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...(prev[field] || []), ''],
    }));
  };

  const handleRemoveArrayItem = (field: 'keyStrengths' | 'responsibilities', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] || []).filter((_, i) => i !== index),
    }));
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-green" size={48} />
      </div>
    );
  }

  // No team member found
  if (!teamMember) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 p-6">
        <div className="max-w-2xl mx-auto text-center py-12">
          <AlertTriangle size={48} className="mx-auto text-yellow-500 mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Profile Not Found</h1>
          <p className="text-neutral-400 mb-6">
            We couldn't find your team profile. Please contact an administrator.
          </p>
          <Link
            href="/portal/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/portal/dashboard"
              className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mb-2"
            >
              <ArrowLeft size={16} />
              Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-white">Edit My Profile</h1>
            <p className="text-neutral-400">
              Changes will be submitted for approval before going live on the website.
            </p>
          </div>
          <Link
            href={`/team/${teamMember.slug}`}
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
          >
            <Eye size={16} />
            View Live Profile
          </Link>
        </div>

        {/* Pending Edit Warning */}
        {pendingEdit && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <Clock size={20} className="text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-400">Pending Changes</h3>
                <p className="text-sm text-yellow-300/80 mt-1">
                  You have changes submitted on {formatDate(pendingEdit.submittedAt)} awaiting approval.
                  Any new edits will update your pending submission.
                </p>
              </div>
              <button
                onClick={handleCancelPending}
                className="text-yellow-500 hover:text-yellow-300 text-sm underline"
              >
                Cancel pending
              </button>
            </div>
          </div>
        )}

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${
              message.type === 'success'
                ? 'bg-green-500/10 border border-green-500/30'
                : message.type === 'warning'
                ? 'bg-yellow-500/10 border border-yellow-500/30'
                : 'bg-red-500/10 border border-red-500/30'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
            ) : message.type === 'warning' ? (
              <AlertTriangle size={20} className="text-yellow-500 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p
                className={`text-sm ${
                  message.type === 'success'
                    ? 'text-green-300'
                    : message.type === 'warning'
                    ? 'text-yellow-300'
                    : 'text-red-300'
                }`}
              >
                {message.text}
              </p>
            </div>
            <button
              onClick={() => setMessage(null)}
              className="text-neutral-400 hover:text-white"
            >
              <XCircle size={16} />
            </button>
          </div>
        )}

        {/* Profile Preview */}
        <div className="mb-8 p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-neutral-800">
              {teamMember.profileImage ? (
                <Image
                  src={teamMember.profileImage}
                  alt={teamMember.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User size={32} className="text-neutral-600" />
                </div>
              )}
              <Link
                href="/portal/my-profile/images"
                className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity"
              >
                <Camera size={20} className="text-white" />
              </Link>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{teamMember.name}</h2>
              <p className="text-brand-green">{teamMember.position}</p>
              <p className="text-sm text-neutral-400">{teamMember.category}</p>
            </div>
          </div>
        </div>

        {/* Quick Links to Sub-Pages */}
        <div className="mb-8 grid grid-cols-2 gap-4">
          <Link
            href="/portal/my-profile/images"
            className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-brand-green/30 transition-colors group"
          >
            <div className="p-2 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
              <Camera size={20} className="text-purple-400" />
            </div>
            <div>
              <p className="font-medium text-white">Manage Images</p>
              <p className="text-xs text-neutral-400">Profile photo, truck, job photos</p>
            </div>
          </Link>
          <Link
            href="/portal/my-profile/reviews"
            className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-brand-green/30 transition-colors group"
          >
            <div className="p-2 bg-yellow-500/10 rounded-lg group-hover:bg-yellow-500/20 transition-colors">
              <FileText size={20} className="text-yellow-400" />
            </div>
            <div>
              <p className="font-medium text-white">Manage Reviews</p>
              <p className="text-xs text-neutral-400">Add, display, and feature reviews</p>
            </div>
          </Link>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Tagline */}
          <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
            <label className="block">
              <span className="text-sm font-medium text-white mb-2 block">Tagline</span>
              <input
                type="text"
                value={formData.tagline || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, tagline: e.target.value }))}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:border-brand-green focus:outline-none"
                placeholder="A brief tagline about yourself..."
              />
              <p className="text-xs text-neutral-500 mt-2">
                A short description that appears under your name on the team page.
              </p>
            </label>
          </div>

          {/* Bio */}
          <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
            <label className="block">
              <span className="text-sm font-medium text-white mb-2 block">Biography</span>
              <textarea
                value={formData.bio || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))}
                rows={6}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:border-brand-green focus:outline-none resize-none"
                placeholder="Tell us about yourself..."
              />
              <p className="text-xs text-neutral-500 mt-2">
                Your full biography that appears on your profile page.
              </p>
            </label>
          </div>

          {/* Contact Info */}
          <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Phone size={18} className="text-brand-green" />
              Contact Information
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-medium text-neutral-300 mb-2 block">Phone</span>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:border-brand-green focus:outline-none"
                  placeholder="256-555-0123"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-neutral-300 mb-2 block">Email</span>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:border-brand-green focus:outline-none"
                  placeholder="name@rcrsal.com"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-neutral-300 mb-2 block">
                  Alternate Email
                </span>
                <input
                  type="email"
                  value={formData.altEmail || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, altEmail: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:border-brand-green focus:outline-none"
                  placeholder="name@rcrsal.com"
                />
              </label>
            </div>
          </div>

          {/* Social Links */}
          <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Globe size={18} className="text-brand-green" />
              Social Media Links
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-medium text-neutral-300 mb-2 block">Facebook</span>
                <input
                  type="url"
                  value={formData.facebook || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, facebook: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:border-brand-green focus:outline-none"
                  placeholder="https://facebook.com/..."
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-neutral-300 mb-2 block">Instagram</span>
                <input
                  type="url"
                  value={formData.instagram || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, instagram: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:border-brand-green focus:outline-none"
                  placeholder="https://instagram.com/..."
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-neutral-300 mb-2 block">X (Twitter)</span>
                <input
                  type="url"
                  value={formData.x || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, x: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:border-brand-green focus:outline-none"
                  placeholder="https://x.com/..."
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-neutral-300 mb-2 block">TikTok</span>
                <input
                  type="url"
                  value={formData.tiktok || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tiktok: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:border-brand-green focus:outline-none"
                  placeholder="https://tiktok.com/@..."
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-neutral-300 mb-2 block">LinkedIn</span>
                <input
                  type="url"
                  value={formData.linkedin || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, linkedin: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:border-brand-green focus:outline-none"
                  placeholder="https://linkedin.com/in/..."
                />
              </label>
            </div>
          </div>

          {/* Key Strengths */}
          <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">Key Strengths</h3>
            <div className="space-y-3">
              {(formData.keyStrengths || []).map((strength, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={strength}
                    onChange={(e) => handleArrayFieldChange('keyStrengths', index, e.target.value)}
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:border-brand-green focus:outline-none"
                    placeholder="Enter a key strength..."
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveArrayItem('keyStrengths', index)}
                    className="p-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => handleAddArrayItem('keyStrengths')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-neutral-300 rounded-xl transition-colors"
              >
                <Plus size={16} />
                Add Strength
              </button>
            </div>
          </div>

          {/* Responsibilities */}
          <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">Responsibilities</h3>
            <div className="space-y-3">
              {(formData.responsibilities || []).map((resp, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={resp}
                    onChange={(e) =>
                      handleArrayFieldChange('responsibilities', index, e.target.value)
                    }
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:border-brand-green focus:outline-none"
                    placeholder="Enter a responsibility..."
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveArrayItem('responsibilities', index)}
                    className="p-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => handleAddArrayItem('responsibilities')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-neutral-300 rounded-xl transition-colors"
              >
                <Plus size={16} />
                Add Responsibility
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-between p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
            <div>
              {hasChanges ? (
                <p className="text-sm text-yellow-400">
                  <AlertTriangle size={14} className="inline mr-1" />
                  You have unsaved changes
                </p>
              ) : (
                <p className="text-sm text-neutral-500">No changes to submit</p>
              )}
            </div>
            <button
              type="submit"
              disabled={!hasChanges || isSaving}
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand-green hover:bg-green-400 text-black font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Submit for Approval
                </>
              )}
            </button>
          </div>
        </form>

        {/* Edit History */}
        <div className="mt-8">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mb-4"
          >
            <History size={18} />
            <span className="text-sm font-medium">
              {showHistory ? 'Hide' : 'Show'} Edit History ({editHistory.length})
            </span>
          </button>

          {showHistory && editHistory.length > 0 && (
            <div className="space-y-4">
              {editHistory.map((edit) => (
                <div
                  key={edit.id}
                  className="p-4 bg-white/[0.02] border border-white/5 rounded-xl"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {edit.status === 'pending' && (
                        <Clock size={16} className="text-yellow-500" />
                      )}
                      {edit.status === 'approved' && (
                        <CheckCircle2 size={16} className="text-green-500" />
                      )}
                      {edit.status === 'rejected' && (
                        <XCircle size={16} className="text-red-500" />
                      )}
                      <span
                        className={`text-sm font-medium capitalize ${
                          edit.status === 'pending'
                            ? 'text-yellow-400'
                            : edit.status === 'approved'
                            ? 'text-green-400'
                            : 'text-red-400'
                        }`}
                      >
                        {edit.status}
                      </span>
                    </div>
                    <span className="text-xs text-neutral-500">
                      {formatDate(edit.submittedAt)}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-400">
                    {Object.keys(edit.changes).length} field(s) changed:{' '}
                    {Object.keys(edit.changes).join(', ')}
                  </p>
                  {edit.reviewedBy && (
                    <p className="text-xs text-neutral-500 mt-1">
                      Reviewed by {edit.reviewedBy} on {formatDate(edit.reviewedAt!)}
                    </p>
                  )}
                  {edit.rejectionReason && (
                    <p className="text-sm text-red-400 mt-2">
                      Reason: {edit.rejectionReason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {showHistory && editHistory.length === 0 && (
            <p className="text-sm text-neutral-500">No edit history yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
