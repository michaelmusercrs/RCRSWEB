'use client';

import { useState, useEffect } from 'react';
import { Wrench, Upload, X, Loader2, CheckCircle, Clock, Calendar, ChevronDown, AlertTriangle } from 'lucide-react';

interface ServiceRequestFormProps {
  customerId: string;
  token?: string;
}

interface ExistingRequest {
  id: string;
  type: string;
  description: string;
  preferredDate: string;
  urgency: string;
  status: string;
  assignedTo?: string;
  scheduledDate?: string;
  resolution?: string;
  photos: string[];
  createdAt: string;
  updatedAt: string;
}

const SERVICE_TYPES = [
  { value: 'maintenance', label: 'Routine Maintenance', description: 'Gutter cleaning, debris removal, annual check-up' },
  { value: 'repair', label: 'Repair Needed', description: 'Fix a known issue or damage' },
  { value: 'inspection', label: 'Free Inspection', description: 'Post-storm or annual roof inspection' },
  { value: 'other', label: 'Other Service', description: 'Custom request or question' },
];

const URGENCY_LEVELS = [
  { value: 'low', label: 'Low', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'emergency', label: 'Emergency', color: 'bg-red-100 text-red-700 border-red-200' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
  reviewed: { label: 'Reviewed', color: 'bg-purple-100 text-purple-700' },
  scheduled: { label: 'Scheduled', color: 'bg-green-100 text-green-700' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
};

export default function ServiceRequestForm({ customerId, token }: ServiceRequestFormProps) {
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [urgency, setUrgency] = useState('medium');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [existingRequests, setExistingRequests] = useState<ExistingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExistingRequests();
  }, [token]);

  const fetchExistingRequests = async () => {
    if (!token) { setLoading(false); return; }
    try {
      const response = await fetch(`/api/customer/service-request?token=${token}`);
      if (response.ok) {
        const data = await response.json();
        setExistingRequests(data.requests || []);
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
        formData.append('description', 'Service request photo');
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
    if (!type || !description.trim()) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/customer/service-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          type,
          description: description.trim(),
          preferredDate,
          urgency,
          photos,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit service request');
      }

      const data = await response.json();
      setSubmitted(true);

      // Add to existing requests
      setExistingRequests(prev => [{
        id: data.request.id,
        type: data.request.type,
        description: description.trim(),
        preferredDate,
        urgency: data.request.urgency,
        status: data.request.status,
        photos,
        createdAt: data.request.createdAt,
        updatedAt: data.request.createdAt,
      }, ...prev]);

      // Reset form
      setType('');
      setDescription('');
      setPreferredDate('');
      setUrgency('medium');
      setPhotos([]);

      setTimeout(() => setSubmitted(false), 5000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit service request';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Get min date for date picker (tomorrow)
  const minDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-[#0066CC]" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {submitted && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-medium text-green-800">Service Request Submitted</p>
            <p className="text-sm text-green-700 mt-1">
              We will review your request and get back to you within 1 business day.
            </p>
          </div>
        </div>
      )}

      {/* Request Form */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-semibold text-neutral-800 mb-2 flex items-center gap-2">
          <Wrench className="text-[#0066CC]" size={20} />
          Request a Service
        </h3>
        <p className="text-sm text-neutral-500 mb-6">
          Need maintenance, repair, or an inspection? Let us know and we will get it scheduled.
        </p>

        {/* Service Type */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-neutral-700 mb-2">Service Type</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SERVICE_TYPES.map(st => (
              <button
                key={st.value}
                type="button"
                onClick={() => setType(st.value)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  type === st.value
                    ? 'bg-blue-50 border-[#0066CC] ring-2 ring-offset-1 ring-[#0066CC]'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                <p className={`font-medium text-sm ${type === st.value ? 'text-[#0066CC]' : 'text-neutral-800'}`}>
                  {st.label}
                </p>
                <p className="text-xs mt-0.5 text-neutral-500">{st.description}</p>
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
            placeholder="Describe what you need help with..."
            rows={4}
            className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent resize-none"
          />
        </div>

        {/* Preferred Date */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            <Calendar className="inline mr-1" size={14} />
            Preferred Date (optional)
          </label>
          <input
            type="date"
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
            min={minDate}
            className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent"
          />
        </div>

        {/* Urgency */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-neutral-700 mb-2">Urgency</label>
          <div className="flex gap-2">
            {URGENCY_LEVELS.map(level => (
              <button
                key={level.value}
                type="button"
                onClick={() => setUrgency(level.value)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                  urgency === level.value
                    ? `${level.color} ring-2 ring-offset-1 ring-[#0066CC]`
                    : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                {level.label}
              </button>
            ))}
          </div>
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
          disabled={!type || !description.trim() || submitting}
          className="w-full bg-[#0066CC] text-white py-3 rounded-xl font-medium hover:bg-[#005bb5] disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Submitting...
            </>
          ) : (
            <>
              <Wrench size={18} />
              Submit Service Request
            </>
          )}
        </button>
      </div>

      {/* Existing Requests */}
      {existingRequests.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h4 className="font-semibold text-neutral-800 mb-4 flex items-center gap-2">
            <Clock className="text-[#0066CC]" size={20} />
            Your Service Requests
          </h4>
          <div className="space-y-4">
            {existingRequests.map(req => {
              const statusInfo = STATUS_CONFIG[req.status] || STATUS_CONFIG.submitted;
              const typeLabel = SERVICE_TYPES.find(t => t.value === req.type)?.label || req.type;
              return (
                <div key={req.id} className="border border-neutral-100 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-neutral-800">{typeLabel}</p>
                      <p className="text-sm text-neutral-500 mt-0.5">
                        Submitted {new Date(req.createdAt).toLocaleDateString()}
                        {req.preferredDate && ` | Preferred: ${new Date(req.preferredDate).toLocaleDateString()}`}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-600 mt-2">{req.description}</p>
                  {req.scheduledDate && (
                    <p className="text-sm text-[#0066CC] mt-2 flex items-center gap-1">
                      <Calendar size={14} />
                      Scheduled for {new Date(req.scheduledDate).toLocaleDateString()}
                    </p>
                  )}
                  {req.resolution && (
                    <div className="mt-3 pl-4 border-l-2 border-[#0066CC]">
                      <p className="text-sm text-neutral-500 font-medium">Resolution</p>
                      <p className="text-sm text-neutral-600">{req.resolution}</p>
                    </div>
                  )}
                  {req.assignedTo && (
                    <p className="text-xs text-neutral-400 mt-2">Assigned to: {req.assignedTo}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
