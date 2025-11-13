'use client';

/**
 * Team Management Client Component
 * Full CRUD interface for managing team members
 */

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Upload,
  ChevronUp,
  ChevronDown,
  User,
  Mail,
  Phone,
  Briefcase,
  MapPin,
  Calendar,
  Loader2,
} from 'lucide-react';
import { TeamMember, teamCategories } from '@/lib/teamData';

export default function TeamManageClient() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isEditing, setIsEditing] = useState(false);
  const [editingMember, setEditingMember] = useState<Partial<TeamMember> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch team members
  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/team-members');
      const data = await response.json();
      if (data.success) {
        setMembers(data.members);
        setFilteredMembers(data.members);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
      alert('Failed to load team members');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  // Filter members when search or category changes
  useEffect(() => {
    let filtered = members;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(m => m.category === selectedCategory);
    }

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        m =>
          m.name.toLowerCase().includes(search) ||
          m.position.toLowerCase().includes(search) ||
          m.email.toLowerCase().includes(search)
      );
    }

    setFilteredMembers(filtered);
  }, [searchTerm, selectedCategory, members]);

  // Handle add new member
  const handleAddNew = () => {
    setEditingMember({
      name: '',
      position: '',
      category: 'Production',
      email: '',
      phone: '',
      company: 'River City Roofing Solutions',
      displayOrder: members.length + 1,
      bio: '',
      altEmail: '',
      slug: '',
    });
    setIsEditing(true);
  };

  // Handle edit member
  const handleEdit = (member: TeamMember) => {
    setEditingMember({ ...member });
    setIsEditing(true);
  };

  // Handle save (create or update)
  const handleSave = async () => {
    if (!editingMember || !editingMember.name || !editingMember.email) {
      alert('Please fill in required fields (Name and Email)');
      return;
    }

    setIsSaving(true);
    try {
      const isNewMember = !editingMember.slug;
      const url = isNewMember
        ? '/api/admin/team-members'
        : `/api/admin/team-members/${editingMember.slug}`;
      const method = isNewMember ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingMember),
      });

      const data = await response.json();

      if (data.success) {
        await fetchMembers();
        setIsEditing(false);
        setEditingMember(null);
        alert(data.message);
      } else {
        alert(data.error || 'Failed to save team member');
      }
    } catch (error) {
      console.error('Error saving member:', error);
      alert('Failed to save team member');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async (slug: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/team-members/${slug}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        await fetchMembers();
        alert(data.message);
      } else {
        alert(data.error || 'Failed to delete team member');
      }
    } catch (error) {
      console.error('Error deleting member:', error);
      alert('Failed to delete team member');
    }
  };

  // Handle reorder (move up/down)
  const handleReorder = async (slug: string, direction: 'up' | 'down') => {
    const index = filteredMembers.findIndex(m => m.slug === slug);
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === filteredMembers.length - 1)
    ) {
      return;
    }

    const newOrder = [...filteredMembers];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    // Swap
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];

    // Update displayOrder
    const updates = newOrder.map((member, idx) => ({
      slug: member.slug,
      displayOrder: idx + 1,
    }));

    try {
      const response = await fetch('/api/admin/team-members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members: updates }),
      });

      const data = await response.json();

      if (data.success) {
        await fetchMembers();
      } else {
        alert(data.error || 'Failed to reorder');
      }
    } catch (error) {
      console.error('Error reordering:', error);
      alert('Failed to reorder team members');
    }
  };

  // Handle image upload
  const handleImageUpload = (field: 'profileImage' | 'truckImage') => {
    // Open image upload in new window or modal
    const uploadWindow = window.open('/admin/upload', '_blank', 'width=800,height=600');

    // Listen for message from upload window
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'image-uploaded') {
        setEditingMember(prev => prev ? { ...prev, [field]: event.data.url } : null);
        uploadWindow?.close();
        window.removeEventListener('message', handleMessage);
      }
    };

    window.addEventListener('message', handleMessage);
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, position, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF00] focus:border-transparent"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF00] focus:border-transparent bg-white"
          >
            <option value="all">All Categories</option>
            {teamCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Add New Button */}
          <button
            onClick={handleAddNew}
            className="flex items-center space-x-2 px-6 py-2 bg-[#00FF00] hover:bg-[#00DD00] text-black font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Add Member</span>
          </button>
        </div>

        {/* Results Count */}
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredMembers.length} of {members.length} team members
        </div>
      </div>

      {/* Team Members List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredMembers.map((member, index) => (
            <div
              key={member.slug}
              className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                {/* Member Info */}
                <div className="flex items-start space-x-4 flex-1">
                  {/* Profile Image */}
                  <div className="flex-shrink-0">
                    {member.profileImage ? (
                      <Image
                        src={member.profileImage}
                        alt={member.name}
                        width={80}
                        height={80}
                        className="rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                        <User className="w-10 h-10 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">{member.name}</h3>
                    <p className="text-sm text-gray-600 flex items-center mt-1">
                      <Briefcase className="w-4 h-4 mr-1" />
                      {member.position}
                    </p>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-gray-600 flex items-center">
                        <Mail className="w-4 h-4 mr-2" />
                        {member.email}
                      </p>
                      {member.phone && (
                        <p className="text-sm text-gray-600 flex items-center">
                          <Phone className="w-4 h-4 mr-2" />
                          {member.phone}
                        </p>
                      )}
                      {member.region && (
                        <p className="text-sm text-gray-600 flex items-center">
                          <MapPin className="w-4 h-4 mr-2" />
                          {member.region}
                        </p>
                      )}
                    </div>
                    <div className="mt-3">
                      <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                        {member.category}
                      </span>
                      <span className="inline-block ml-2 px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        Order: {member.displayOrder}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col space-y-2">
                  {/* Reorder Buttons */}
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleReorder(member.slug, 'up')}
                      disabled={index === 0}
                      className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <ChevronUp className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleReorder(member.slug, 'down')}
                      disabled={index === filteredMembers.length - 1}
                      className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Edit/Delete Buttons */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(member)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(member.slug, member.name)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {filteredMembers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No team members found</p>
            </div>
          )}
        </div>
      )}

      {/* Edit/Add Modal */}
      {isEditing && editingMember && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingMember.slug ? 'Edit Team Member' : 'Add New Team Member'}
              </h2>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditingMember(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingMember.name || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF00]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Position <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingMember.position || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, position: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF00]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={editingMember.email || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF00]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={editingMember.phone || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF00]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editingMember.category || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, category: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF00] bg-white"
                    required
                  >
                    {teamCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Region</label>
                  <input
                    type="text"
                    value={editingMember.region || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, region: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF00]"
                    placeholder="e.g., Birmingham, Nashville"
                  />
                </div>
              </div>

              {/* Tagline */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tagline</label>
                <input
                  type="text"
                  value={editingMember.tagline || ''}
                  onChange={(e) => setEditingMember({ ...editingMember, tagline: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF00]"
                  placeholder="Brief one-liner about the person"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Bio</label>
                <textarea
                  value={editingMember.bio || ''}
                  onChange={(e) => setEditingMember({ ...editingMember, bio: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF00] resize-none"
                  placeholder="Full biography..."
                />
              </div>

              {/* Images */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Profile Image URL</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={editingMember.profileImage || ''}
                      onChange={(e) => setEditingMember({ ...editingMember, profileImage: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF00]"
                      placeholder="/uploads/profile.jpg"
                    />
                    <button
                      onClick={() => handleImageUpload('profileImage')}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg transition-colors"
                      title="Upload image"
                    >
                      <Upload className="w-5 h-5" />
                    </button>
                  </div>
                  {editingMember.profileImage && (
                    <div className="mt-2">
                      <Image
                        src={editingMember.profileImage}
                        alt="Profile preview"
                        width={100}
                        height={100}
                        className="rounded-lg object-cover"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Truck Image URL</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={editingMember.truckImage || ''}
                      onChange={(e) => setEditingMember({ ...editingMember, truckImage: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF00]"
                      placeholder="/uploads/truck.jpg"
                    />
                    <button
                      onClick={() => handleImageUpload('truckImage')}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg transition-colors"
                      title="Upload image"
                    >
                      <Upload className="w-5 h-5" />
                    </button>
                  </div>
                  {editingMember.truckImage && (
                    <div className="mt-2">
                      <Image
                        src={editingMember.truckImage}
                        alt="Truck preview"
                        width={100}
                        height={100}
                        className="rounded-lg object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Social Media */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Facebook</label>
                  <input
                    type="text"
                    value={editingMember.facebook || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, facebook: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF00]"
                    placeholder="URL"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Instagram</label>
                  <input
                    type="text"
                    value={editingMember.instagram || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, instagram: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF00]"
                    placeholder="URL"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">X (Twitter)</label>
                  <input
                    type="text"
                    value={editingMember.x || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, x: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF00]"
                    placeholder="URL"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditingMember(null);
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2 bg-[#00FF00] hover:bg-[#00DD00] text-black font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    <span>Save</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
