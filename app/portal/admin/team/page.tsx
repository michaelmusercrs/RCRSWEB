'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Edit, Trash2, Eye, Search, Phone, Mail,
  User, Save, X, Loader2, ExternalLink, MapPin, RefreshCw
} from 'lucide-react';

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
    <div className="min-h-screen bg-neutral-900">
      {/* Header */}
      <div className="bg-neutral-800 border-b border-neutral-700 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal/admin" className="text-neutral-400 hover:text-white">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Team Members</h1>
              <p className="text-sm text-neutral-400">{members.length} team members (Google Sheets)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadMembers}
              disabled={isLoading}
              className="p-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg"
            >
              <RefreshCw size={18} className={`text-neutral-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleCreate}
              className="bg-brand-green hover:bg-lime-400 text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <Plus size={18} />
              Add Member
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
            <input
              type="text"
              placeholder="Search team members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-10 pr-4 py-3 text-white"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white"
          >
            <option value="">All Categories</option>
            {teamCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="animate-spin mx-auto text-brand-green" size={32} />
            <p className="text-neutral-400 mt-2">Loading team from Google Sheets...</p>
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-12">
            <User className="mx-auto text-neutral-600" size={48} />
            <p className="text-neutral-400 mt-4">No team members found</p>
            <p className="text-neutral-500 text-sm mt-2">
              Make sure the "team-members-import" sheet exists in your Google Spreadsheet
            </p>
          </div>
        ) : (
          /* Team Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMembers.map(member => (
              <div
                key={member.slug}
                className="bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden hover:border-neutral-600 transition-colors"
              >
                {/* Photo */}
                <div className="relative h-48 bg-neutral-700">
                  {member.profileImage ? (
                    <img
                      src={member.profileImage}
                      alt={member.name}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User size={48} className="text-neutral-600" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      member.category === 'Leadership' ? 'bg-brand-green text-black' :
                      member.category === 'Regional Partner' ? 'bg-blue-500 text-white' :
                      member.category === 'Office' ? 'bg-purple-500 text-white' :
                      member.category === 'Production' ? 'bg-orange-500 text-white' :
                      'bg-neutral-600 text-white'
                    }`}>
                      {member.category}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-white text-lg">{member.name}</h3>
                  <p className="text-brand-green text-sm mb-2">{member.position}</p>

                  {member.phone && (
                    <div className="flex items-center gap-2 text-sm text-neutral-400 mb-1">
                      <Phone size={14} />
                      {member.phone}
                    </div>
                  )}
                  {member.email && (
                    <div className="flex items-center gap-2 text-sm text-neutral-400 mb-1 truncate">
                      <Mail size={14} />
                      {member.email}
                    </div>
                  )}
                  {member.region && (
                    <div className="flex items-center gap-2 text-sm text-neutral-400">
                      <MapPin size={14} />
                      {member.region}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-neutral-700">
                    <Link
                      href={`/team/${member.slug}`}
                      target="_blank"
                      className="flex-1 p-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg flex items-center justify-center gap-1 text-sm text-neutral-400"
                    >
                      <Eye size={14} />
                      View
                    </Link>
                    <button
                      onClick={() => setEditingMember(member)}
                      className="flex-1 p-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg flex items-center justify-center gap-1 text-sm text-neutral-400"
                    >
                      <Edit size={14} />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(member.slug)}
                      className="p-2 bg-neutral-700 hover:bg-red-600 rounded-lg"
                    >
                      <Trash2 size={14} className="text-neutral-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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
    <div className="min-h-screen bg-neutral-900">
      {/* Header */}
      <div className="bg-neutral-800 border-b border-neutral-700 p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onCancel} className="text-neutral-400 hover:text-white">
              <X size={20} />
            </button>
            <h1 className="text-xl font-bold text-white">
              {isNew ? 'Add Team Member' : `Edit: ${member.name}`}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="bg-neutral-700 hover:bg-neutral-600 text-white font-bold px-4 py-2 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="bg-brand-green hover:bg-lime-400 text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Save to Sheets
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Profile Image Preview */}
        <div className="flex items-start gap-6">
          <div className="w-32 h-32 bg-neutral-700 rounded-xl overflow-hidden flex-shrink-0">
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
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white"
            />
            <p className="text-xs text-neutral-500 mt-1">Use /uploads/filename.png or a Google Drive share link</p>
          </div>
        </div>

        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Full Name"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white"
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
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white"
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
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white"
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
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white"
            />
          </div>
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="256-555-1234"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="name@rcrsal.com"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white"
            />
          </div>
        </div>

        {/* Regional Partner Fields */}
        {formData.category === 'Regional Partner' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Region</label>
              <input
                type="text"
                value={formData.region || ''}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                placeholder="Nashville, Birmingham, etc."
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Launch Date</label>
              <input
                type="text"
                value={formData.launchDate || ''}
                onChange={(e) => setFormData({ ...formData, launchDate: e.target.value })}
                placeholder="Q4 2025"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white"
              />
            </div>
          </div>
        )}

        {/* Tagline */}
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">Tagline</label>
          <input
            type="text"
            value={formData.tagline || ''}
            onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
            placeholder="Short description that appears under name"
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">Full Bio</label>
          <textarea
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            placeholder="Full biography..."
            rows={8}
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white resize-y"
          />
        </div>

        {/* Social Links */}
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-4">Social Media Links</label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Facebook</label>
              <input
                type="url"
                value={formData.facebook || ''}
                onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                placeholder="https://facebook.com/..."
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Instagram</label>
              <input
                type="url"
                value={formData.instagram || ''}
                onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                placeholder="https://instagram.com/..."
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">TikTok</label>
              <input
                type="url"
                value={formData.tiktok || ''}
                onChange={(e) => setFormData({ ...formData, tiktok: e.target.value })}
                placeholder="https://tiktok.com/..."
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">LinkedIn</label>
              <input
                type="url"
                value={formData.linkedin || ''}
                onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                placeholder="https://linkedin.com/in/..."
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 text-white text-sm"
              />
            </div>
          </div>
        </div>

        {/* Preview Link */}
        {!isNew && formData.slug && (
          <div className="pt-4 border-t border-neutral-700">
            <Link
              href={`/team/${formData.slug}`}
              target="_blank"
              className="inline-flex items-center gap-2 text-brand-green hover:underline"
            >
              <ExternalLink size={16} />
              View live profile
            </Link>
          </div>
        )}
      </form>
    </div>
  );
}
