'use client';

import { useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import {
  Edit, Eye, Search, Save, Loader2, ExternalLink,
  MapPin, Globe, Users, Calendar, Clock, Image as ImageIcon, Check
} from 'lucide-react';
import { serviceAreas, ServiceArea } from '@/lib/servicesData';

const statusColors = {
  'Active': { bg: 'bg-brand-green/20', text: 'text-brand-green', border: 'border-brand-green/30' },
  'Expansion': { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
};

export default function AreasAdmin() {
  const [areaList, setAreaList] = useState<ServiceArea[]>(serviceAreas);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [editingArea, setEditingArea] = useState<ServiceArea | null>(null);

  const filteredAreas = areaList.filter(area => {
    const matchesSearch = area.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      area.state.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !selectedStatus || area.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const handleSave = (updatedArea: ServiceArea) => {
    setAreaList(prev =>
      prev.map(a => a.id === updatedArea.id ? updatedArea : a)
    );
    setEditingArea(null);
  };

  if (editingArea) {
    return (
      <AreaEditor
        area={editingArea}
        onSave={handleSave}
        onCancel={() => setEditingArea(null)}
      />
    );
  }

  return (
    <AdminLayout
      title="Service Areas"
      subtitle={`${areaList.length} locations configured`}
      actions={
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500 mr-2">Edit locally - changes sync with code</span>
        </div>
      }
    >
      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
          <input
            type="text"
            placeholder="Search areas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-orange-500/50 transition-all"
          />
        </div>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 transition-all"
        >
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Expansion">Expansion</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{serviceAreas.filter(a => a.status === 'Active').length}</div>
          <div className="text-sm text-neutral-500">Active Areas</div>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{serviceAreas.filter(a => a.status === 'Expansion').length}</div>
          <div className="text-sm text-neutral-500">Expansion Markets</div>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{serviceAreas.filter(a => a.state === 'AL').length}</div>
          <div className="text-sm text-neutral-500">Alabama</div>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{serviceAreas.filter(a => a.state === 'TN').length}</div>
          <div className="text-sm text-neutral-500">Tennessee</div>
        </div>
      </div>

      {/* Areas Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredAreas.map(area => {
          const colors = statusColors[area.status];

          return (
            <div
              key={area.id}
              className="group bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-2xl overflow-hidden transition-all hover:bg-white/[0.04]"
            >
              {/* Image */}
              <div className="relative h-40 bg-gradient-to-br from-neutral-800 to-neutral-900">
                {area.image ? (
                  <img
                    src={area.image}
                    alt={area.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <MapPin size={48} className="text-neutral-700" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute top-3 right-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
                    {area.status}
                  </span>
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-xl font-bold text-white mb-1">
                    {area.name}, {area.state}
                  </h3>
                  <p className="text-sm text-neutral-300">{area.coverage}</p>
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <div className="flex flex-wrap items-center gap-3 mb-4 text-sm text-neutral-400">
                  {area.population && (
                    <span className="flex items-center gap-1.5">
                      <Users size={14} />
                      {area.population}
                    </span>
                  )}
                  {area.responseTime && (
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} />
                      {area.responseTime}
                    </span>
                  )}
                  {area.launchDate && (
                    <span className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      {area.launchDate}
                    </span>
                  )}
                </div>

                {area.regionalPartner && (
                  <div className="mb-4 px-3 py-2 bg-white/5 rounded-lg text-sm">
                    <span className="text-neutral-500">Regional Partner:</span>{' '}
                    <span className="text-white">{area.regionalPartner}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 border-t border-white/5">
                  <Link
                    href={`/service-areas/${area.slug}`}
                    target="_blank"
                    className="flex-1 p-2.5 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
                  >
                    <Eye size={14} />
                    View
                  </Link>
                  <button
                    onClick={() => setEditingArea(area)}
                    className="flex-1 p-2.5 bg-white/5 hover:bg-orange-500/20 rounded-xl flex items-center justify-center gap-2 text-sm text-neutral-400 hover:text-orange-400 transition-colors"
                  >
                    <Edit size={14} />
                    Edit
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Note */}
      <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
        <p className="text-sm text-yellow-400">
          <strong>Note:</strong> Service area data is stored in <code className="bg-black/30 px-1 rounded">lib/servicesData.ts</code>.
          Changes made here update the local preview. To persist changes, update the source file.
        </p>
      </div>
    </AdminLayout>
  );
}

function AreaEditor({
  area,
  onSave,
  onCancel,
}: {
  area: ServiceArea;
  onSave: (area: ServiceArea) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState(area);
  const [isSaving, setIsSaving] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 500));
    onSave(formData);
    setIsSaving(false);
  };

  const updateArrayField = (field: keyof ServiceArea, value: string) => {
    const arr = value.split('\n').filter(v => v.trim());
    setFormData({ ...formData, [field]: arr });
  };

  return (
    <AdminLayout
      title="Edit Service Area"
      subtitle={`Editing: ${area.name}, ${area.state}`}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium transition-all shadow-lg shadow-orange-500/25 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Save Changes
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Image Section */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
          <label className="block text-sm font-medium text-neutral-300 mb-4 flex items-center gap-2">
            <ImageIcon size={16} className="text-orange-400" />
            Area Image
          </label>
          <div className="flex flex-col md:flex-row gap-6">
            {/* Image Preview */}
            <div className="w-full md:w-64 h-40 bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
              {formData.image && !imageError ? (
                <img
                  src={formData.image}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-neutral-500">
                  <MapPin size={32} className="mb-2" />
                  <span className="text-xs">No image</span>
                </div>
              )}
            </div>

            {/* Image Input */}
            <div className="flex-1">
              <input
                type="text"
                value={formData.image || ''}
                onChange={(e) => {
                  setFormData({ ...formData, image: e.target.value });
                  setImageError(false);
                }}
                placeholder="/uploads/area-image.jpg"
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:border-orange-500/50 transition-all outline-none mb-3"
              />

              {/* Quick Select */}
              <div className="flex flex-wrap gap-2">
                {[
                  '/uploads/area-huntsville-rocket.jpg',
                  '/uploads/area-decatur.png',
                  '/uploads/area-madison.jpg',
                  '/uploads/area-athens.jpg',
                  '/uploads/area-birmingham.jpg',
                  '/uploads/area-nashville.webp',
                  '/uploads/area-north-alabama.png',
                ].map(img => (
                  <button
                    key={img}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, image: img });
                      setImageError(false);
                    }}
                    className={`w-12 h-12 rounded-lg overflow-hidden border transition-colors ${
                      formData.image === img ? 'border-orange-500' : 'border-white/10 hover:border-orange-500/50'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">City/Area Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-orange-500/50 transition-all outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">State</label>
              <select
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-orange-500/50 transition-all outline-none"
              >
                <option value="AL">Alabama (AL)</option>
                <option value="TN">Tennessee (TN)</option>
                <option value="GA">Georgia (GA)</option>
                <option value="MS">Mississippi (MS)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'Expansion' })}
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-orange-500/50 transition-all outline-none"
              >
                <option value="Active">Active</option>
                <option value="Expansion">Expansion</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-neutral-300 mb-2">Description</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-orange-500/50 transition-all outline-none resize-none"
              placeholder="Brief description of services in this area..."
            />
          </div>
        </div>

        {/* Coverage Details */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Coverage Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Coverage Area</label>
              <input
                type="text"
                value={formData.coverage}
                onChange={(e) => setFormData({ ...formData, coverage: e.target.value })}
                placeholder="City and surrounding areas"
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:border-orange-500/50 transition-all outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Services Offered</label>
              <input
                type="text"
                value={formData.services}
                onChange={(e) => setFormData({ ...formData, services: e.target.value })}
                placeholder="All residential and commercial"
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:border-orange-500/50 transition-all outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Population</label>
              <input
                type="text"
                value={formData.population || ''}
                onChange={(e) => setFormData({ ...formData, population: e.target.value })}
                placeholder="~200,000"
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:border-orange-500/50 transition-all outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Response Time</label>
              <input
                type="text"
                value={formData.responseTime || ''}
                onChange={(e) => setFormData({ ...formData, responseTime: e.target.value })}
                placeholder="Same-day available"
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:border-orange-500/50 transition-all outline-none"
              />
            </div>
          </div>
        </div>

        {/* Expansion Info (if expansion) */}
        {formData.status === 'Expansion' && (
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Expansion Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Launch Date</label>
                <input
                  type="text"
                  value={formData.launchDate || ''}
                  onChange={(e) => setFormData({ ...formData, launchDate: e.target.value })}
                  placeholder="Q4 2025"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:border-orange-500/50 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Regional Partner</label>
                <input
                  type="text"
                  value={formData.regionalPartner || ''}
                  onChange={(e) => setFormData({ ...formData, regionalPartner: e.target.value })}
                  placeholder="Partner name"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:border-orange-500/50 transition-all outline-none"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-neutral-300 mb-2">Expansion Timeline</label>
              <p className="text-xs text-neutral-500 mb-2">One milestone per line</p>
              <textarea
                value={(formData.expansionTimeline || []).join('\n')}
                onChange={(e) => updateArrayField('expansionTimeline', e.target.value)}
                rows={4}
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-orange-500/50 transition-all outline-none resize-y"
                placeholder="Q3 2025: Market analysis&#10;Q4 2025: Launch"
              />
            </div>
          </div>
        )}

        {/* Key Details */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Key Details</h3>
          <p className="text-xs text-neutral-500 mb-3">One detail per line</p>
          <textarea
            value={(formData.keyDetails || []).join('\n')}
            onChange={(e) => updateArrayField('keyDetails', e.target.value)}
            rows={4}
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-orange-500/50 transition-all outline-none resize-y"
            placeholder="Headquarters location&#10;Full service center&#10;Emergency response team"
          />
        </div>

        {/* Map Query */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Map Settings</h3>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Map Query</label>
            <input
              type="text"
              value={formData.mapQuery || ''}
              onChange={(e) => setFormData({ ...formData, mapQuery: e.target.value })}
              placeholder="Huntsville,+AL"
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:border-orange-500/50 transition-all outline-none"
            />
            <p className="text-xs text-neutral-500 mt-2">Used for Google Maps embed. Use + for spaces.</p>
          </div>
        </div>

        {/* Preview Link */}
        <div className="pt-4 border-t border-white/5">
          <Link
            href={`/service-areas/${formData.slug}`}
            target="_blank"
            className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 transition-colors"
          >
            <ExternalLink size={16} />
            View live area page
          </Link>
        </div>
      </form>
    </AdminLayout>
  );
}
