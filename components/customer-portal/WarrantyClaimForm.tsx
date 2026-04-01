'use client';

import { useState, useEffect } from 'react';
import { Shield, Upload, X, Loader2, CheckCircle, AlertTriangle, Clock, ChevronDown, type LucideIcon } from 'lucide-react';

interface WarrantyClaimFormProps {
  customerId: string;
  token?: string;
}

interface ExistingClaim {
  id: string;
  warrantyId: string;
  warrantyType: string;
  status: string;
  category: string;
  severity: string;
  issueDescription: string;
  resolution?: string;
  repairDate?: string;
  coveredByWarranty: boolean;
  photos: string[];
  createdAt: string;
  updatedAt: string;
}

interface WarrantyInfo {
  id: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  manufacturer?: string;
}

const CATEGORIES = [
  { value: 'leak', label: 'Roof Leak' },
  { value: 'shingle_damage', label: 'Missing/Damaged Shingles' },
  { value: 'flashing', label: 'Flashing Damage' },
  { value: 'gutter', label: 'Gutter Issue' },
  { value: 'ventilation', label: 'Ventilation Problem' },
  { value: 'other', label: 'Other' },
];

const URGENCY_LEVELS = [
  { value: 'minor', label: 'Low', description: 'Cosmetic or minor issue, no immediate concern', color: 'bg-green-100 text-green-700' },
  { value: 'moderate', label: 'Medium', description: 'Noticeable issue, should be addressed soon', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'major', label: 'High', description: 'Significant issue causing damage or risk', color: 'bg-orange-100 text-orange-700' },
  { value: 'emergency', label: 'Emergency', description: 'Active leak or structural concern', color: 'bg-red-100 text-red-700' },
];

const STATUS_LABELS: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700', icon: Clock },
  under_review: { label: 'Under Review', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  denied: { label: 'Denied', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle },
};

export default function WarrantyClaimForm({ customerId, token }: WarrantyClaimFormProps) {
  const [category, setCategory] = useState('');
  const [urgency, setUrgency] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [existingClaims, setExistingClaims] = useState<ExistingClaim[]>([]);
  const [warranties, setWarranties] = useState<WarrantyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(true);

  useEffect(() => {
    fetchExistingClaims();
  }, [token]);

  const fetchExistingClaims = async () => {
    if (!token) { setLoading(false); return; }
    try {
      const response = await fetch(`/api/customer/warranty-claim?token=${token}`);
      if (response.ok) {
        const data = await response.json();
        setExistingClaims(data.claims || []);
        setWarranties(data.warranties || []);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || photos.length >= 5) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length && photos.length + i < 5; i++) {
        const formData = new FormData();
        formData.append('file', files[i]);
        formData.append('description', 'Warranty claim photo');
        formData.append('type', 'photo');

        const response = await fetch(`/api/customer/${token}/upload`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          if (data.url) {
            setPhotos(prev => [...prev, data.url]);
          }
        }
      }
    } catch {
      // Photo upload is best-effort
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!category || !urgency || !description.trim()) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/customer/warranty-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          issueDescription: description,
          category,
          urgency,
          photos,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit claim');
      }

      const data = await response.json();
      setSubmitted(true);

      // Add to existing claims list
      setExistingClaims(prev => [{
        id: data.claim.id,
        warrantyId: data.claim.warrantyId,
        warrantyType: 'workmanship',
        status: data.claim.status,
        category: data.claim.category,
        severity: data.claim.severity,
        issueDescription: data.claim.issueDescription,
        coveredByWarranty: true,
        photos,
        createdAt: data.claim.createdAt,
        updatedAt: data.claim.createdAt,
      }, ...prev]);

      // Reset form
      setCategory('');
      setUrgency('');
      setDescription('');
      setPhotos([]);

      setTimeout(() => setSubmitted(false), 5000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit warranty claim';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-[#0066CC]" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Warranty Info Summary */}
      {warranties.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-neutral-800 mb-4 flex items-center gap-2">
            <Shield className="text-[#0066CC]" size={20} />
            Your Warranties
          </h3>
          <div className="space-y-3">
            {warranties.map(w => (
              <div key={w.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                <div>
                  <p className="font-medium text-neutral-800 capitalize">{w.type.replace('_', ' ')} Warranty</p>
                  <p className="text-sm text-neutral-500">
                    {new Date(w.startDate).toLocaleDateString()} - {new Date(w.endDate).toLocaleDateString()}
                    {w.manufacturer && ` | ${w.manufacturer}`}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  w.status === 'active' ? 'bg-green-100 text-green-700' :
                  w.status === 'expiring_soon' ? 'bg-yellow-100 text-yellow-700' :
                  w.status === 'expired' ? 'bg-red-100 text-red-700' :
                  'bg-neutral-100 text-neutral-600'
                }`}>
                  {w.status === 'expiring_soon' ? 'Expiring Soon' : w.status.charAt(0).toUpperCase() + w.status.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submitted Success */}
      {submitted && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-medium text-green-800">Warranty Claim Submitted</p>
            <p className="text-sm text-green-700 mt-1">
              Our team will review your claim and contact you within 1-2 business days.
            </p>
          </div>
        </div>
      )}

      {/* New Claim Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-neutral-800 mb-2 flex items-center gap-2">
            <Shield className="text-[#0066CC]" size={20} />
            Submit a Warranty Claim
          </h3>
          <p className="text-sm text-neutral-500 mb-6">
            Describe the issue and we will review it under your warranty coverage.
          </p>

          {/* Category */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-neutral-700 mb-2">Issue Category</label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-neutral-800 bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent"
              >
                <option value="">Select a category...</option>
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" size={18} />
            </div>
          </div>

          {/* Urgency */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-neutral-700 mb-2">Urgency Level</label>
            <div className="grid grid-cols-2 gap-2">
              {URGENCY_LEVELS.map(level => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setUrgency(level.value)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    urgency === level.value
                      ? `${level.color} border-current ring-2 ring-offset-1 ring-[#0066CC]`
                      : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  <p className="font-medium text-sm">{level.label}</p>
                  <p className="text-xs mt-0.5 opacity-75">{level.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-neutral-700 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue in detail. Include location on the roof, when you first noticed it, and any related concerns..."
              rows={4}
              className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent resize-none"
            />
          </div>

          {/* Photo Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Photos (optional, up to 5)
            </label>

            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {photos.map((url, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-neutral-200">
                    <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-0.5 right-0.5 p-0.5 bg-red-500 text-white rounded-full"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {photos.length < 5 && (
              <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-neutral-300 rounded-xl cursor-pointer hover:border-[#0066CC] hover:bg-blue-50/50 transition-colors">
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  disabled={uploading}
                />
                {uploading ? (
                  <>
                    <Loader2 className="animate-spin text-[#0066CC]" size={18} />
                    <span className="text-sm text-neutral-600">Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="text-neutral-400" size={18} />
                    <span className="text-sm text-neutral-600">Click to add photos</span>
                    <span className="text-xs text-neutral-400 ml-auto">{photos.length}/5</span>
                  </>
                )}
              </label>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!category || !urgency || !description.trim() || submitting}
            className="w-full bg-[#0066CC] text-white py-3 rounded-xl font-medium hover:bg-[#005bb5] disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Submitting Claim...
              </>
            ) : (
              <>
                <Shield size={18} />
                Submit Warranty Claim
              </>
            )}
          </button>
        </div>
      )}

      {/* Existing Claims */}
      {existingClaims.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h4 className="font-semibold text-neutral-800 mb-4 flex items-center gap-2">
            <Clock className="text-[#0066CC]" size={20} />
            Your Warranty Claims
          </h4>
          <div className="space-y-4">
            {existingClaims.map(claim => {
              const statusInfo = STATUS_LABELS[claim.status] || STATUS_LABELS.submitted;
              const StatusIcon = statusInfo.icon;
              return (
                <div key={claim.id} className="border border-neutral-100 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-neutral-800">
                        {CATEGORIES.find(c => c.value === claim.category)?.label || claim.category}
                      </p>
                      <p className="text-sm text-neutral-500 mt-0.5">
                        Submitted {new Date(claim.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                      <StatusIcon size={12} />
                      {statusInfo.label}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-600 mt-2">{claim.issueDescription}</p>
                  {claim.resolution && (
                    <div className="mt-3 pl-4 border-l-2 border-[#0066CC]">
                      <p className="text-sm text-neutral-500 font-medium">Resolution</p>
                      <p className="text-sm text-neutral-600">{claim.resolution}</p>
                      {claim.repairDate && (
                        <p className="text-xs text-neutral-400 mt-1">
                          Repair date: {new Date(claim.repairDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      URGENCY_LEVELS.find(u => u.value === claim.severity)?.color || 'bg-neutral-100 text-neutral-600'
                    }`}>
                      {URGENCY_LEVELS.find(u => u.value === claim.severity)?.label || claim.severity} priority
                    </span>
                    {claim.coveredByWarranty && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <Shield size={12} />
                        Covered by warranty
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
