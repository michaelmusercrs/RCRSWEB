'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus, Edit, Trash2, Eye, Search, Phone, Mail,
  User, Save, X, Loader2, ExternalLink, MapPin, RefreshCw, Users, Sparkles
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';

interface TeamMember {
  slug: string;
  name: string;
  company: string;
  category: string;
  position: string;
  phone: string;
  email: string;
  altEmail: string;
  displayOrder: number;
  tagline: string;
  bio: string;
  region: string;
  launchDate: string;
  profileImage: string;
  truckImage: string;
  facebook: string;
  instagram: string;
  x: string;
  tiktok: string;
  linkedin: string;
}

const teamCategories = [
  'Leadership',
  'Regional Partner',
  'Office',
  'Production',
  'Partners & Advisors',
  'In Loving Memory',
];

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  'Leadership': { bg: 'bg-brand-green/20', text: 'text-brand-green', border: 'border-brand-green/30' },
  'Regional Partner': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  'Office': { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  'Production': { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  'Partners & Advisors': { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  'In Loving Memory': { bg: 'bg-neutral-500/20', text: 'text-neutral-400', border: 'border-neutral-500/30' },
};

export default function TeamAdmin() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/cms/team');
      const data = await response.json();
      setMembers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading team members:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMembers = members.filter(member => {
    const matchesSearch = member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.position?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || member.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSave = async (member: TeamMember) => {
    try {
      if (isCreating) {
        await fetch('/api/cms/team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(member),
        });
      } else {
        await fetch('/api/cms/team', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(member),
        });
      }
      await loadMembers();
      setEditingMember(null);
      setIsCreating(false);
    } catch (error) {
      console.error('Error saving team member:', error);
    }
  };

  const handleDelete = async (slug: string) => {
    if (confirm('Are you sure you want to delete this team member?')) {
      try {
        await fetch(`/api/cms/team?slug=${slug}`, { method: 'DELETE' });
        await loadMembers();
      } catch (error) {
        console.error('Error deleting team member:', error);
      }
    }
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingMember({
      slug: '',
      name: '',
      company: 'River City Roofing Solutions',
      category: 'Production',
      position: '',
      phone: '',
      email: '',
      altEmail: '',
      displayOrder: members.length + 1,
      tagline: '',
      bio: '',
      region: '',
      launchDate: '',
      profileImage: '',
      truckImage: '',
      facebook: '',
      instagram: '',
      x: '',
      tiktok: '',
      linkedin: '',
    });
  };

  // Edit Modal
  if (editingMember) {
    return (
      <TeamEditor
        member={editingMember}
        isNew={isCreating}
        onSave={handleSave}
        onCancel={() => { setEditingMember(null); setIsCreating(false); }}
      />
    );
  }

  return (
    <AdminLayout
      title="Team Members"
      subtitle={`${members.length} team members (Google Sheets)`}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={loadMembers}
            disabled={isLoading}
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <RefreshCw size={18} className={`text-neutral-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleCreate}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/25"
          >
            <Plus size={18} />
            Add Member
          </button>
        </div>
      }
    >
      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
          <input
            type="text"
            placeholder="Search team members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/50 transition-all"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green/50 transition-all"
        >
          <option value="">All Categories</option>
          {teamCategories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 mb-4">
            <Loader2 className="animate-spin text-emerald-400" size={32} />
          </div>
          <p className="text-neutral-400">Loading team from Google Sheets...</p>
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 mb-4">
            <Users className="text-neutral-500" size={32} />
          </div>
          <p className="text-neutral-400 mb-2">No team members found</p>
          <p className="text-neutral-500 text-sm">
            Make sure the "team-members-import" sheet exists in your Google Spreadsheet
          </p>
        </div>
      ) : (
        /* Team Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMembers.map(member => {
            const colors = categoryColors[member.category] || categoryColors['Production'];
            return (
              <div
                key={member.slug}
                className="group relative bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 hover:bg-white/[0.04] transition-all duration-300"
              >
                {/* Photo */}
                <div className="relative h-56 bg-gradient-to-br from-neutral-800 to-neutral-900">
                  {member.profileImage ? (
                    <img
                      src={member.profileImage}
                      alt={member.name}
                      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User size={64} className="text-neutral-700" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute top-3 right-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
                      {member.category}
                    </span>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="font-semibold text-white text-xl mb-1">{member.name}</h3>
                    <p className="text-brand-green text-sm font-medium">{member.position}</p>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 space-y-2">
                  {member.phone && (
                    <div className="flex items-center gap-3 text-sm text-neutral-400">
                      <Phone size={14} className="text-neutral-500" />
                      {member.phone}
                    </div>
                  )}
                  {member.email && (
                    <div className="flex items-center gap-3 text-sm text-neutral-400 truncate">
                      <Mail size={14} className="text-neutral-500 flex-shrink-0" />
                      <span className="truncate">{member.email}</span>
                    </div>
                  )}
                  {member.region && (
                    <div className="flex items-center gap-3 text-sm text-neutral-400">
                      <MapPin size={14} className="text-neutral-500" />
                      {member.region}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-4 mt-4 border-t border-white/5">
                    <Link
                      href={`/team/${member.slug}`}
                      target="_blank"
                      className="flex-1 p-2.5 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
                    >
                      <Eye size={14} />
                      View
                    </Link>
                    <button
                      onClick={() => setEditingMember(member)}
                      className="flex-1 p-2.5 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
                    >
                      <Edit size={14} />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(member.slug)}
                      className="p-2.5 bg-white/5 hover:bg-red-500/20 rounded-xl transition-colors group/del"
                    >
                      <Trash2 size={14} className="text-neutral-400 group-hover/del:text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}

function TeamEditor({
  member,
  isNew,
  onSave,
  onCancel,
}: {
  member: TeamMember;
  isNew: boolean;
  onSave: (member: TeamMember) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState(member);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    // Generate slug from name if new
    const slug = formData.slug || formData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    await onSave({ ...formData, slug });
    setIsSaving(false);
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
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={onCancel}
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <X size={18} className="text-neutral-400" />
                </button>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">
                    {isNew ? 'Add Team Member' : `Edit: ${member.name}`}
                  </h1>
                  <p className="text-sm text-neutral-400">
                    {isNew ? 'Create a new team profile' : 'Update profile information'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={onCancel}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/25"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Save to Sheets
                </button>
              </div>
            </div>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto p-6 space-y-8">
          {/* Profile Image Preview */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <div className="flex items-start gap-6">
              <div className="w-32 h-32 bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-2xl overflow-hidden flex-shrink-0 border border-white/10">
                {formData.profileImage ? (
                  <img
                    src={formData.profileImage}
                    alt={formData.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User size={48} className="text-neutral-600" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-neutral-300 mb-2">Profile Image URL</label>
                <input
                  type="text"
                  value={formData.profileImage || ''}
                  onChange={(e) => setFormData({ ...formData, profileImage: e.target.value })}
                  placeholder="/uploads/name.png or Google Drive URL"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-brand-green/50 transition-all"
                />
                <p className="text-xs text-neutral-500 mt-2">Use /uploads/filename.png or a Google Drive share link</p>
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Sparkles size={18} className="text-emerald-400" />
              Basic Information
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Full Name"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-brand-green/50 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Position *</label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  placeholder="Job Title"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-brand-green/50 transition-all"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green/50 transition-all"
                >
                  {teamCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Display Order</label>
                <input
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green/50 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Phone size={18} className="text-blue-400" />
              Contact Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="256-555-1234"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-brand-green/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@rcrsal.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-brand-green/50 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Regional Partner Fields */}
          {formData.category === 'Regional Partner' && (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <MapPin size={18} className="text-orange-400" />
                Regional Partner Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Region</label>
                  <input
                    type="text"
                    value={formData.region || ''}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    placeholder="Nashville, Birmingham, etc."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-brand-green/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Launch Date</label>
                  <input
                    type="text"
                    value={formData.launchDate || ''}
                    onChange={(e) => setFormData({ ...formData, launchDate: e.target.value })}
                    placeholder="Q4 2025"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-brand-green/50 transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tagline & Bio */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Profile Content</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Tagline</label>
                <input
                  type="text"
                  value={formData.tagline || ''}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  placeholder="Short description that appears under name"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-brand-green/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Full Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Full biography..."
                  rows={8}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-brand-green/50 transition-all resize-y"
                />
              </div>
            </div>
          </div>

          {/* Social Links */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Social Media Links</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-neutral-500 mb-2">Facebook</label>
                <input
                  type="url"
                  value={formData.facebook || ''}
                  onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                  placeholder="https://facebook.com/..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-neutral-500 focus:outline-none focus:border-brand-green/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-2">Instagram</label>
                <input
                  type="url"
                  value={formData.instagram || ''}
                  onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                  placeholder="https://instagram.com/..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-neutral-500 focus:outline-none focus:border-brand-green/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-2">TikTok</label>
                <input
                  type="url"
                  value={formData.tiktok || ''}
                  onChange={(e) => setFormData({ ...formData, tiktok: e.target.value })}
                  placeholder="https://tiktok.com/..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-neutral-500 focus:outline-none focus:border-brand-green/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-2">LinkedIn</label>
                <input
                  type="url"
                  value={formData.linkedin || ''}
                  onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                  placeholder="https://linkedin.com/in/..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-neutral-500 focus:outline-none focus:border-brand-green/50 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Preview Link */}
          {!isNew && formData.slug && (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
              <Link
                href={`/team/${formData.slug}`}
                target="_blank"
                className="inline-flex items-center gap-2 text-brand-green hover:text-lime-400 transition-colors"
              >
                <ExternalLink size={16} />
                View live profile
              </Link>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
