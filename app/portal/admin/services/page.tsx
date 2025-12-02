'use client';

import { useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import {
  Edit, Eye, Search, Save, X, Loader2, ExternalLink,
  Home, Wrench, Building2, CloudRain, Flame, Shield, AlertTriangle, Droplet, Wind, Paintbrush,
  Image as ImageIcon, Plus, Check
} from 'lucide-react';
import { services, Service } from '@/lib/servicesData';

const iconMap: Record<string, React.ElementType> = {
  Home, Wrench, Building2, CloudRain, Flame, Shield, AlertTriangle, Droplet, Wind, Paintbrush, Search
};

const categoryColors = {
  'Primary': { bg: 'bg-brand-green/20', text: 'text-brand-green', border: 'border-brand-green/30' },
  'Additional': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
};

export default function ServicesAdmin() {
  const [serviceList, setServiceList] = useState<Service[]>(services);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editingService, setEditingService] = useState<Service | null>(null);

  const filteredServices = serviceList.filter(service => {
    const matchesSearch = service.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || service.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSave = (updatedService: Service) => {
    setServiceList(prev =>
      prev.map(s => s.id === updatedService.id ? updatedService : s)
    );
    setEditingService(null);
    // Note: This updates local state only. In production, save to Google Sheets API
  };

  if (editingService) {
    return (
      <ServiceEditor
        service={editingService}
        onSave={handleSave}
        onCancel={() => setEditingService(null)}
      />
    );
  }

  return (
    <AdminLayout
      title="Services"
      subtitle={`${serviceList.length} services configured`}
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
            placeholder="Search services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-brand-green/50 transition-all"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green/50 transition-all"
        >
          <option value="">All Categories</option>
          <option value="Primary">Primary Services</option>
          <option value="Additional">Additional Services</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{services.filter(s => s.category === 'Primary').length}</div>
          <div className="text-sm text-neutral-500">Primary Services</div>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{services.filter(s => s.category === 'Additional').length}</div>
          <div className="text-sm text-neutral-500">Additional Services</div>
        </div>
      </div>

      {/* Services Grid */}
      <div className="space-y-4">
        {filteredServices.map(service => {
          const Icon = iconMap[service.icon] || Home;
          const colors = categoryColors[service.category];

          return (
            <div
              key={service.id}
              className="group bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-2xl p-5 transition-all hover:bg-white/[0.04]"
            >
              <div className="flex items-start gap-5">
                {/* Image */}
                <div className="w-24 h-24 bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
                  {service.image ? (
                    <img
                      src={service.image}
                      alt={service.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon size={32} className="text-neutral-600" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 ${colors.bg} rounded-lg flex items-center justify-center`}>
                      <Icon size={16} className={colors.text} />
                    </div>
                    <h3 className="font-semibold text-white truncate group-hover:text-brand-green transition-colors">
                      {service.title}
                    </h3>
                    <span className={`px-2 py-0.5 ${colors.bg} ${colors.text} text-xs rounded-full font-medium border ${colors.border}`}>
                      {service.category}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-400 line-clamp-2 mb-3">{service.description}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                    {service.costRange && (
                      <span className="px-2 py-1 bg-white/5 rounded-lg">{service.costRange}</span>
                    )}
                    {service.timeline && (
                      <span className="px-2 py-1 bg-white/5 rounded-lg">{service.timeline}</span>
                    )}
                    <span className="text-neutral-600">/services/{service.slug}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link
                    href={`/services/${service.slug}`}
                    target="_blank"
                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                    title="View"
                  >
                    <Eye size={18} className="text-neutral-400" />
                  </Link>
                  <button
                    onClick={() => setEditingService(service)}
                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-brand-green/20 flex items-center justify-center transition-colors"
                    title="Edit"
                  >
                    <Edit size={18} className="text-neutral-400 hover:text-brand-green" />
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
          <strong>Note:</strong> Service data is stored in <code className="bg-black/30 px-1 rounded">lib/servicesData.ts</code>.
          Changes made here update the local preview. To persist changes, update the source file.
        </p>
      </div>
    </AdminLayout>
  );
}

function ServiceEditor({
  service,
  onSave,
  onCancel,
}: {
  service: Service;
  onSave: (service: Service) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState(service);
  const [isSaving, setIsSaving] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 500)); // Simulate save
    onSave(formData);
    setIsSaving(false);
  };

  const updateArrayField = (field: keyof Service, value: string) => {
    const arr = value.split('\n').filter(v => v.trim());
    setFormData({ ...formData, [field]: arr });
  };

  return (
    <AdminLayout
      title="Edit Service"
      subtitle={`Editing: ${service.title}`}
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
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-green to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-medium transition-all shadow-lg shadow-brand-green/25 disabled:opacity-50"
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
            <ImageIcon size={16} className="text-brand-green" />
            Service Image
          </label>
          <div className="flex flex-col md:flex-row gap-6">
            {/* Image Preview */}
            <div className="w-full md:w-48 h-32 bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
              {formData.image && !imageError ? (
                <img
                  src={formData.image}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-neutral-500">
                  <ImageIcon size={32} className="mb-2" />
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
                placeholder="/uploads/service-image.png"
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:border-brand-green/50 transition-all outline-none mb-3"
              />

              {/* Quick Select */}
              <div className="flex flex-wrap gap-2">
                {[
                  '/uploads/service-residential.png',
                  '/uploads/service-commercial.png',
                  '/uploads/service-storm.jpg',
                  '/uploads/service-chimney.png',
                  '/uploads/service-leafx.png',
                ].map(img => (
                  <button
                    key={img}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, image: img });
                      setImageError(false);
                    }}
                    className={`w-12 h-12 rounded-lg overflow-hidden border transition-colors ${
                      formData.image === img ? 'border-brand-green' : 'border-white/10 hover:border-brand-green/50'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    {formData.image === img && (
                      <div className="absolute inset-0 bg-brand-green/20 flex items-center justify-center">
                        <Check size={16} className="text-brand-green" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-green/50 transition-all outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as 'Primary' | 'Additional' })}
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-green/50 transition-all outline-none"
              >
                <option value="Primary">Primary Service</option>
                <option value="Additional">Additional Service</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-neutral-300 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-green/50 transition-all outline-none resize-none"
            />
          </div>
        </div>

        {/* Pricing & Timeline */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Pricing & Timeline</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Cost Range</label>
              <input
                type="text"
                value={formData.costRange || ''}
                onChange={(e) => setFormData({ ...formData, costRange: e.target.value })}
                placeholder="$500-$5,000"
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:border-brand-green/50 transition-all outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Timeline</label>
              <input
                type="text"
                value={formData.timeline || ''}
                onChange={(e) => setFormData({ ...formData, timeline: e.target.value })}
                placeholder="1-3 days"
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:border-brand-green/50 transition-all outline-none"
              />
            </div>
          </div>
        </div>

        {/* What's Included / Services */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Services Included</h3>
          <p className="text-xs text-neutral-500 mb-3">One item per line</p>
          <textarea
            value={(formData.whatsIncluded || formData.servicesIncluded || []).join('\n')}
            onChange={(e) => {
              if (formData.whatsIncluded) {
                updateArrayField('whatsIncluded', e.target.value);
              } else {
                updateArrayField('servicesIncluded', e.target.value);
              }
            }}
            rows={6}
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-brand-green/50 transition-all outline-none resize-y"
            placeholder="Free inspection&#10;Material selection&#10;Installation"
          />
        </div>

        {/* Key Benefits */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Key Benefits</h3>
          <p className="text-xs text-neutral-500 mb-3">One benefit per line</p>
          <textarea
            value={(formData.keyBenefits || []).join('\n')}
            onChange={(e) => updateArrayField('keyBenefits', e.target.value)}
            rows={4}
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-brand-green/50 transition-all outline-none resize-y"
            placeholder="Immediate protection&#10;Increased home value&#10;Energy efficiency"
          />
        </div>

        {/* Preview Link */}
        <div className="pt-4 border-t border-white/5">
          <Link
            href={`/services/${formData.slug}`}
            target="_blank"
            className="inline-flex items-center gap-2 text-brand-green hover:text-lime-400 transition-colors"
          >
            <ExternalLink size={16} />
            View live service page
          </Link>
        </div>
      </form>
    </AdminLayout>
  );
}
