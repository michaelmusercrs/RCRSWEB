'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ClipboardCheck,
  ClipboardList,
  CheckSquare,
  Star,
  Camera,
  Ruler,
  MessageSquare,
  FileText,
  Share2,
  Printer,
  Download,
  Plus,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  MapPin,
  Calendar,
  Wrench,
  Shield,
  Eye,
  MoreVertical,
  ArrowRight,
  Trash2,
  Save,
  Upload,
  CloudRain,
  Hammer,
  ArrowLeft,
  X,
  Loader2,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface InspectionTemplate {
  id: string;
  name: string;
  description: string;
  sections: InspectionSection[];
  estimatedMinutes: number;
  createdBy: string;
  isDefault: boolean;
  createdAt: string;
}

interface InspectionSection {
  id: string;
  name: string;
  order: number;
  items: InspectionItem[];
}

interface InspectionItem {
  id: string;
  label: string;
  type: 'checkbox' | 'rating' | 'text' | 'photo' | 'measurement' | 'select';
  required: boolean;
  options?: string[];
  helpText?: string;
  order: number;
}

interface InspectionReport {
  id: string;
  templateId: string;
  templateName: string;
  customerId: string;
  customerName: string;
  address: string;
  jobId?: string;
  leadId?: string;
  inspectorId: string;
  inspectorName: string;
  status: 'draft' | 'in_progress' | 'completed' | 'approved' | 'shared';
  startedAt: string;
  completedAt?: string;
  responses: InspectionResponse[];
  photos: { url: string; caption: string; sectionId: string; uploadedAt: string }[];
  overallCondition: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  summary: string;
  recommendations: string[];
  estimatedRepairCost?: number;
  urgencyLevel: 'none' | 'routine' | 'soon' | 'urgent' | 'emergency';
  shareToken?: string;
  sharedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface InspectionResponse {
  itemId: string;
  sectionId: string;
  value: string | boolean | number;
  notes?: string;
  photoUrls?: string[];
}

interface InspectionStats {
  totalInspections: number;
  thisMonth: number;
  pendingCompletion: number;
  sharedWithCustomers: number;
  byCondition: Record<string, number>;
  byTemplate: Record<string, number>;
  byUrgency: Record<string, number>;
  averageCompletionMinutes: number;
}

type ViewTab = 'dashboard' | 'active' | 'completed' | 'form' | 'complete-form' | 'view';

// =============================================================================
// CONSTANTS
// =============================================================================

const CONDITION_COLORS: Record<string, string> = {
  excellent: 'text-green-400',
  good: 'text-[#39FF14]',
  fair: 'text-yellow-400',
  poor: 'text-orange-400',
  critical: 'text-red-400',
};

const CONDITION_BG: Record<string, string> = {
  excellent: 'bg-green-500/20 border-green-500/30',
  good: 'bg-[#39FF14]/20 border-[#39FF14]/30',
  fair: 'bg-yellow-500/20 border-yellow-500/30',
  poor: 'bg-orange-500/20 border-orange-500/30',
  critical: 'bg-red-500/20 border-red-500/30',
};

const URGENCY_COLORS: Record<string, string> = {
  none: 'text-gray-400',
  routine: 'text-blue-400',
  soon: 'text-yellow-400',
  urgent: 'text-orange-400',
  emergency: 'text-red-400',
};

const URGENCY_BG: Record<string, string> = {
  none: 'bg-gray-500/20 border-gray-500/30',
  routine: 'bg-blue-500/20 border-blue-500/30',
  soon: 'bg-yellow-500/20 border-yellow-500/30',
  urgent: 'bg-orange-500/20 border-orange-500/30',
  emergency: 'bg-red-500/20 border-red-500/30',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_progress: 'In Progress',
  completed: 'Completed',
  approved: 'Approved',
  shared: 'Shared',
};

const RATING_LABELS: Record<number, string> = {
  1: 'Critical',
  2: 'Poor',
  3: 'Fair',
  4: 'Good',
  5: 'Excellent',
};

const TEMPLATE_ICONS: Record<string, typeof ClipboardCheck> = {
  'tmpl-standard': ClipboardCheck,
  'tmpl-storm': CloudRain,
};

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function InspectionsPage() {
  // State
  const [activeTab, setActiveTab] = useState<ViewTab>('dashboard');
  const [templates, setTemplates] = useState<InspectionTemplate[]>([]);
  const [inspections, setInspections] = useState<InspectionReport[]>([]);
  const [stats, setStats] = useState<InspectionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [startForm, setStartForm] = useState({
    customerId: '',
    customerName: '',
    address: '',
    inspectorId: '',
    inspectorName: '',
    jobId: '',
    leadId: '',
  });

  // Active inspection editing
  const [activeInspection, setActiveInspection] = useState<InspectionReport | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<InspectionTemplate | null>(null);
  const [completionPercent, setCompletionPercent] = useState(0);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [itemNotes, setItemNotes] = useState<Record<string, boolean>>({});

  // Completion form
  const [completionForm, setCompletionForm] = useState({
    overallCondition: 'good' as InspectionReport['overallCondition'],
    summary: '',
    recommendations: [''] as string[],
    estimatedRepairCost: '',
    urgencyLevel: 'none' as InspectionReport['urgencyLevel'],
  });

  // View inspection
  const [viewInspection, setViewInspection] = useState<InspectionReport | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [templateFilter, setTemplateFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Share result
  const [shareResult, setShareResult] = useState<{ shareUrl: string; token: string } | null>(null);

  // ---------------------------------------------------------------------------
  // DATA LOADING
  // ---------------------------------------------------------------------------

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [templatesRes, inspectionsRes] = await Promise.all([
        fetch('/api/inspections/templates'),
        fetch('/api/inspections'),
      ]);

      if (templatesRes.ok) {
        const tData = await templatesRes.json();
        setTemplates(tData.templates || []);
      }

      if (inspectionsRes.ok) {
        const iData = await inspectionsRes.json();
        setInspections(iData.inspections || []);
        setStats(iData.stats || null);
      }
    } catch (error) {
      console.error('Failed to load inspection data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---------------------------------------------------------------------------
  // ACTIONS
  // ---------------------------------------------------------------------------

  const handleStartInspection = async () => {
    if (!selectedTemplateId || !startForm.customerName || !startForm.address || !startForm.inspectorName) {
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          customerId: startForm.customerId || `cust-${Date.now()}`,
          customerName: startForm.customerName,
          address: startForm.address,
          inspectorId: startForm.inspectorId || `insp-${Date.now()}`,
          inspectorName: startForm.inspectorName,
          jobId: startForm.jobId || undefined,
          leadId: startForm.leadId || undefined,
        }),
      });

      if (res.ok) {
        const inspection = await res.json();
        setShowStartModal(false);
        setStartForm({
          customerId: '',
          customerName: '',
          address: '',
          inspectorId: '',
          inspectorName: '',
          jobId: '',
          leadId: '',
        });
        await openInspectionForm(inspection.id);
        await loadData();
      }
    } catch (error) {
      console.error('Failed to start inspection:', error);
    } finally {
      setSaving(false);
    }
  };

  const openInspectionForm = async (inspectionId: string) => {
    try {
      const res = await fetch(`/api/inspections/${inspectionId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveInspection(data.inspection);
        setActiveTemplate(data.template);
        setCompletionPercent(data.completionPercent || 0);
        // Expand first section by default
        if (data.template?.sections?.length > 0) {
          setExpandedSections(new Set([data.template.sections[0].id]));
        }
        setActiveTab('form');
      }
    } catch (error) {
      console.error('Failed to load inspection:', error);
    }
  };

  const handleResponseChange = async (
    sectionId: string,
    itemId: string,
    value: string | boolean | number,
    notes?: string
  ) => {
    if (!activeInspection) return;

    // Optimistic local update
    const updatedResponses = [...activeInspection.responses];
    const existingIdx = updatedResponses.findIndex((r) => r.itemId === itemId);
    const newResponse: InspectionResponse = { itemId, sectionId, value, notes };

    if (existingIdx >= 0) {
      updatedResponses[existingIdx] = newResponse;
    } else {
      updatedResponses.push(newResponse);
    }

    setActiveInspection({
      ...activeInspection,
      responses: updatedResponses,
    });

    // Auto-save to server
    try {
      const res = await fetch(`/api/inspections/${activeInspection.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          responses: [newResponse],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCompletionPercent(data.completionPercent || 0);
      }
    } catch (error) {
      console.error('Failed to save response:', error);
    }
  };

  const handleCompleteInspection = async () => {
    if (!activeInspection || !completionForm.summary) return;

    try {
      setSaving(true);
      const res = await fetch(`/api/inspections/${activeInspection.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          summary: completionForm.summary,
          recommendations: completionForm.recommendations.filter((r) => r.trim()),
          overallCondition: completionForm.overallCondition,
          urgencyLevel: completionForm.urgencyLevel,
          estimatedRepairCost: completionForm.estimatedRepairCost
            ? parseFloat(completionForm.estimatedRepairCost)
            : undefined,
        }),
      });

      if (res.ok) {
        setActiveTab('dashboard');
        setActiveInspection(null);
        setActiveTemplate(null);
        setCompletionForm({
          overallCondition: 'good',
          summary: '',
          recommendations: [''],
          estimatedRepairCost: '',
          urgencyLevel: 'none',
        });
        await loadData();
      }
    } catch (error) {
      console.error('Failed to complete inspection:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleShareInspection = async (inspectionId: string) => {
    try {
      const res = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'share' }),
      });

      if (res.ok) {
        const result = await res.json();
        setShareResult(result);
        await loadData();
      }
    } catch (error) {
      console.error('Failed to share inspection:', error);
    }
  };

  const handleDeleteInspection = async (inspectionId: string) => {
    if (!confirm('Delete this inspection? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Failed to delete inspection:', error);
    }
  };

  const handleViewInspection = async (inspectionId: string) => {
    try {
      const res = await fetch(`/api/inspections/${inspectionId}`);
      if (res.ok) {
        const data = await res.json();
        setViewInspection(data.inspection);
        setActiveTemplate(data.template);
        setCompletionPercent(data.completionPercent || 0);
        setActiveTab('view');
      }
    } catch (error) {
      console.error('Failed to load inspection:', error);
    }
  };

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  const getResponseValue = (itemId: string): string | boolean | number | undefined => {
    if (!activeInspection) return undefined;
    const resp = activeInspection.responses.find((r) => r.itemId === itemId);
    return resp?.value;
  };

  const getResponseNotes = (itemId: string): string | undefined => {
    if (!activeInspection) return undefined;
    const resp = activeInspection.responses.find((r) => r.itemId === itemId);
    return resp?.notes;
  };

  const toggleSection = (sectionId: string) => {
    const next = new Set(expandedSections);
    if (next.has(sectionId)) {
      next.delete(sectionId);
    } else {
      next.add(sectionId);
    }
    setExpandedSections(next);
  };

  const filteredCompletedInspections = inspections.filter((i) => {
    const isCompleted =
      i.status === 'completed' || i.status === 'approved' || i.status === 'shared';
    if (!isCompleted) return false;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (
        !i.customerName.toLowerCase().includes(term) &&
        !i.address.toLowerCase().includes(term) &&
        !i.inspectorName.toLowerCase().includes(term)
      ) {
        return false;
      }
    }

    if (templateFilter !== 'all' && i.templateId !== templateFilter) return false;

    return true;
  });

  const activeInspections = inspections.filter(
    (i) => i.status === 'in_progress' || i.status === 'draft'
  );

  // ---------------------------------------------------------------------------
  // RENDER: LOADING
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#39FF14] mx-auto mb-4" />
          <p className="text-gray-400">Loading inspections...</p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: INSPECTION FORM
  // ---------------------------------------------------------------------------

  if (activeTab === 'form' && activeInspection && activeTemplate) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setActiveTab('dashboard');
                  setActiveInspection(null);
                  setActiveTemplate(null);
                  loadData();
                }}
                className="text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold">{activeTemplate.name}</h1>
                <p className="text-sm text-gray-400">
                  {activeInspection.customerName} &mdash; {activeInspection.address}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-400">
                <Clock className="w-4 h-4 inline mr-1" />
                ~{activeTemplate.estimatedMinutes} min
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#39FF14] rounded-full transition-all duration-300"
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-[#39FF14]">
                  {completionPercent}%
                </span>
              </div>
              {completionPercent === 100 && (
                <button
                  onClick={() => setActiveTab('complete-form')}
                  className="px-4 py-2 bg-[#39FF14] text-black rounded-lg font-medium hover:bg-[#39FF14]/90 transition-colors"
                >
                  Complete
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="max-w-5xl mx-auto p-6 space-y-4">
          {activeTemplate.sections
            .sort((a, b) => a.order - b.order)
            .map((section) => {
              const isExpanded = expandedSections.has(section.id);
              const sectionItems = section.items.sort((a, b) => a.order - b.order);
              const answeredCount = sectionItems.filter((item) =>
                activeInspection.responses.some(
                  (r) => r.itemId === item.id && r.value !== '' && r.value !== null && r.value !== undefined
                )
              ).length;

              return (
                <div
                  key={section.id}
                  className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden"
                >
                  {/* Section Header */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-[#39FF14]" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                      <h2 className="text-lg font-semibold">{section.name}</h2>
                    </div>
                    <div className="text-sm text-gray-400">
                      {answeredCount}/{sectionItems.length} items
                    </div>
                  </button>

                  {/* Section Items */}
                  {isExpanded && (
                    <div className="border-t border-gray-700 divide-y divide-gray-700/50">
                      {sectionItems.map((item) => (
                        <InspectionItemField
                          key={item.id}
                          item={item}
                          sectionId={section.id}
                          value={getResponseValue(item.id)}
                          notes={getResponseNotes(item.id)}
                          showNotes={!!itemNotes[item.id]}
                          onToggleNotes={() =>
                            setItemNotes((prev) => ({
                              ...prev,
                              [item.id]: !prev[item.id],
                            }))
                          }
                          onChange={(value, notes) =>
                            handleResponseChange(section.id, item.id, value, notes)
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

          {/* Bottom actions */}
          <div className="flex items-center justify-between pt-4 pb-8">
            <button
              onClick={() => {
                setActiveTab('dashboard');
                setActiveInspection(null);
                setActiveTemplate(null);
                loadData();
              }}
              className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Save & Exit
            </button>
            <button
              onClick={() => setActiveTab('complete-form')}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                completionPercent >= 100
                  ? 'bg-[#39FF14] text-black hover:bg-[#39FF14]/90'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
              disabled={completionPercent < 100}
            >
              Complete Inspection
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: COMPLETION FORM
  // ---------------------------------------------------------------------------

  if (activeTab === 'complete-form' && activeInspection) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <button
              onClick={() => setActiveTab('form')}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold">Complete Inspection</h1>
              <p className="text-sm text-gray-400">
                {activeInspection.customerName} &mdash; {activeInspection.address}
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto p-6 space-y-6">
          {/* Overall Condition */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Overall Roof Condition <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-5 gap-2">
              {(['excellent', 'good', 'fair', 'poor', 'critical'] as const).map(
                (condition) => (
                  <button
                    key={condition}
                    onClick={() =>
                      setCompletionForm((f) => ({ ...f, overallCondition: condition }))
                    }
                    className={`p-3 rounded-lg border text-center capitalize text-sm font-medium transition-colors ${
                      completionForm.overallCondition === condition
                        ? CONDITION_BG[condition] + ' ' + CONDITION_COLORS[condition]
                        : 'border-gray-600 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    {condition}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Urgency Level */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Urgency Level <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-5 gap-2">
              {(['none', 'routine', 'soon', 'urgent', 'emergency'] as const).map(
                (level) => (
                  <button
                    key={level}
                    onClick={() =>
                      setCompletionForm((f) => ({ ...f, urgencyLevel: level }))
                    }
                    className={`p-3 rounded-lg border text-center capitalize text-sm font-medium transition-colors ${
                      completionForm.urgencyLevel === level
                        ? URGENCY_BG[level] + ' ' + URGENCY_COLORS[level]
                        : 'border-gray-600 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    {level}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Inspection Summary <span className="text-red-400">*</span>
            </label>
            <textarea
              value={completionForm.summary}
              onChange={(e) =>
                setCompletionForm((f) => ({ ...f, summary: e.target.value }))
              }
              placeholder="Describe the overall condition, key findings, and any immediate concerns..."
              rows={4}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14] resize-none"
            />
          </div>

          {/* Recommendations */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Recommendations
            </label>
            <div className="space-y-2">
              {completionForm.recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm w-6">{idx + 1}.</span>
                  <input
                    type="text"
                    value={rec}
                    onChange={(e) => {
                      const updated = [...completionForm.recommendations];
                      updated[idx] = e.target.value;
                      setCompletionForm((f) => ({ ...f, recommendations: updated }));
                    }}
                    placeholder="Enter recommendation..."
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-lg p-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]"
                  />
                  {completionForm.recommendations.length > 1 && (
                    <button
                      onClick={() => {
                        const updated = completionForm.recommendations.filter(
                          (_, i) => i !== idx
                        );
                        setCompletionForm((f) => ({ ...f, recommendations: updated }));
                      }}
                      className="text-gray-500 hover:text-red-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() =>
                setCompletionForm((f) => ({
                  ...f,
                  recommendations: [...f.recommendations, ''],
                }))
              }
              className="mt-3 text-sm text-[#39FF14] hover:text-[#39FF14]/80 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Add Recommendation
            </button>
          </div>

          {/* Estimated Repair Cost */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Estimated Repair Cost (optional)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                $
              </span>
              <input
                type="number"
                value={completionForm.estimatedRepairCost}
                onChange={(e) =>
                  setCompletionForm((f) => ({
                    ...f,
                    estimatedRepairCost: e.target.value,
                  }))
                }
                placeholder="0.00"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 pl-8 text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 pb-8">
            <button
              onClick={() => setActiveTab('form')}
              className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Back to Checklist
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setActiveTab('dashboard');
                  setActiveInspection(null);
                  setActiveTemplate(null);
                  loadData();
                }}
                className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Save className="w-4 h-4 inline mr-1" />
                Save Draft
              </button>
              <button
                onClick={handleCompleteInspection}
                disabled={saving || !completionForm.summary}
                className="px-6 py-2 bg-[#39FF14] text-black rounded-lg font-medium hover:bg-[#39FF14]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Submit Inspection
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: VIEW INSPECTION
  // ---------------------------------------------------------------------------

  if (activeTab === 'view' && viewInspection) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setActiveTab('dashboard');
                  setViewInspection(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold">Inspection Report</h1>
                <p className="text-sm text-gray-400">
                  {viewInspection.customerName} &mdash; {viewInspection.address}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleShareInspection(viewInspection.id)}
                className="px-3 py-1.5 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm flex items-center gap-1"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm flex items-center gap-1"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Report Header */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase">Customer</p>
                <p className="font-medium">{viewInspection.customerName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Address</p>
                <p className="font-medium">{viewInspection.address}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Inspector</p>
                <p className="font-medium">{viewInspection.inspectorName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Date</p>
                <p className="font-medium">
                  {new Date(viewInspection.completedAt || viewInspection.startedAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase">Template</p>
                <p className="font-medium">{viewInspection.templateName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Condition</p>
                <p className={`font-medium capitalize ${CONDITION_COLORS[viewInspection.overallCondition]}`}>
                  {viewInspection.overallCondition}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Urgency</p>
                <p className={`font-medium capitalize ${URGENCY_COLORS[viewInspection.urgencyLevel]}`}>
                  {viewInspection.urgencyLevel}
                </p>
              </div>
              {viewInspection.estimatedRepairCost !== undefined && (
                <div>
                  <p className="text-xs text-gray-500 uppercase">Est. Repair Cost</p>
                  <p className="font-medium">${viewInspection.estimatedRepairCost.toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          {viewInspection.summary && (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#39FF14]" />
                Summary
              </h3>
              <p className="text-gray-300 whitespace-pre-wrap">{viewInspection.summary}</p>
            </div>
          )}

          {/* Recommendations */}
          {viewInspection.recommendations.length > 0 && (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-[#39FF14]" />
                Recommendations
              </h3>
              <ul className="space-y-2">
                {viewInspection.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-gray-300">
                    <span className="text-[#39FF14] font-medium mt-0.5">{idx + 1}.</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Inspection Responses by Section */}
          {activeTemplate &&
            activeTemplate.sections
              .sort((a, b) => a.order - b.order)
              .map((section) => {
                const sectionResponses = viewInspection.responses.filter(
                  (r) => r.sectionId === section.id
                );
                if (sectionResponses.length === 0) return null;

                return (
                  <div
                    key={section.id}
                    className="bg-gray-800 border border-gray-700 rounded-xl p-6"
                  >
                    <h3 className="font-semibold mb-4">{section.name}</h3>
                    <div className="space-y-3">
                      {section.items
                        .sort((a, b) => a.order - b.order)
                        .map((item) => {
                          const resp = sectionResponses.find(
                            (r) => r.itemId === item.id
                          );
                          if (!resp) return null;

                          return (
                            <div
                              key={item.id}
                              className="flex items-start justify-between py-2 border-b border-gray-700/50 last:border-0"
                            >
                              <span className="text-gray-300 text-sm flex-1">
                                {item.label}
                              </span>
                              <span className="text-white font-medium text-sm ml-4">
                                {item.type === 'rating'
                                  ? `${resp.value}/5 (${RATING_LABELS[Number(resp.value)] || ''})`
                                  : item.type === 'checkbox'
                                  ? resp.value
                                    ? 'Yes'
                                    : 'No'
                                  : String(resp.value)}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })}

          {/* Share result */}
          {shareResult && (
            <div className="bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-xl p-4">
              <p className="text-sm text-[#39FF14] font-medium mb-2">
                Share link generated:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareResult.shareUrl}
                  className="flex-1 bg-gray-800 border border-gray-600 rounded-lg p-2 text-white text-sm"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareResult.shareUrl);
                  }}
                  className="px-3 py-2 bg-[#39FF14] text-black rounded-lg text-sm font-medium hover:bg-[#39FF14]/90"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          <div className="pb-8" />
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: MAIN DASHBOARD
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal/dashboard" className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <ClipboardCheck className="w-6 h-6 text-[#39FF14]" />
                Roof Inspections
              </h1>
              <p className="text-sm text-gray-400">
                Manage inspection checklists, reports, and customer sharing
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowStartModal(true)}
            className="px-4 py-2 bg-[#39FF14] text-black rounded-lg font-medium hover:bg-[#39FF14]/90 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Inspection
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <ClipboardList className="w-4 h-4" />
                Total Inspections
              </div>
              <p className="text-2xl font-bold">{stats.totalInspections}</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <Calendar className="w-4 h-4" />
                This Month
              </div>
              <p className="text-2xl font-bold text-[#39FF14]">{stats.thisMonth}</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <Clock className="w-4 h-4" />
                Pending Completion
              </div>
              <p className="text-2xl font-bold text-yellow-400">
                {stats.pendingCompletion}
              </p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <Share2 className="w-4 h-4" />
                Shared with Customers
              </div>
              <p className="text-2xl font-bold text-blue-400">
                {stats.sharedWithCustomers}
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-800 rounded-xl p-1 border border-gray-700">
          {[
            { key: 'dashboard', label: 'Quick Start', icon: Plus },
            { key: 'active', label: `Active (${activeInspections.length})`, icon: Clock },
            { key: 'completed', label: 'Completed', icon: CheckCircle },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as ViewTab)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-[#39FF14]/20 text-[#39FF14]'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB: Quick Start */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Start an Inspection</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => {
                const Icon = TEMPLATE_ICONS[template.id] || ClipboardCheck;
                return (
                  <div
                    key={template.id}
                    className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-[#39FF14]/50 transition-colors"
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <div className="p-2 rounded-lg bg-[#39FF14]/10">
                        <Icon className="w-6 h-6 text-[#39FF14]" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{template.name}</h3>
                        <p className="text-sm text-gray-400 mt-1">
                          {template.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        {template.sections.length} sections &middot; ~
                        {template.estimatedMinutes} min
                      </div>
                      <button
                        onClick={() => {
                          setSelectedTemplateId(template.id);
                          setShowStartModal(true);
                        }}
                        className="px-3 py-1.5 bg-[#39FF14] text-black rounded-lg text-sm font-medium hover:bg-[#39FF14]/90 transition-colors flex items-center gap-1"
                      >
                        <ArrowRight className="w-3 h-3" /> Start
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Active inspections quick view */}
            {activeInspections.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Continue In Progress</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeInspections.slice(0, 4).map((insp) => (
                    <ActiveInspectionCard
                      key={insp.id}
                      inspection={insp}
                      onContinue={() => openInspectionForm(insp.id)}
                      onDelete={() => handleDeleteInspection(insp.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: Active Inspections */}
        {activeTab === 'active' && (
          <div className="space-y-4">
            {activeInspections.length === 0 ? (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
                <ClipboardList className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-4">No active inspections</p>
                <button
                  onClick={() => setShowStartModal(true)}
                  className="px-4 py-2 bg-[#39FF14] text-black rounded-lg font-medium hover:bg-[#39FF14]/90 transition-colors"
                >
                  Start New Inspection
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeInspections.map((insp) => (
                  <ActiveInspectionCard
                    key={insp.id}
                    inspection={insp}
                    onContinue={() => openInspectionForm(insp.id)}
                    onDelete={() => handleDeleteInspection(insp.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: Completed Inspections */}
        {activeTab === 'completed' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by customer, address, or inspector..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-3 py-2 border rounded-lg transition-colors flex items-center gap-1 text-sm ${
                  showFilters
                    ? 'border-[#39FF14] text-[#39FF14]'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                <Filter className="w-4 h-4" /> Filters
              </button>
            </div>

            {showFilters && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Template</label>
                  <select
                    value={templateFilter}
                    onChange={(e) => setTemplateFilter(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-[#39FF14]"
                  >
                    <option value="all">All Templates</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Table */}
            {filteredCompletedInspections.length === 0 ? (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
                <CheckCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No completed inspections found</p>
              </div>
            ) : (
              <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700 text-gray-400">
                        <th className="text-left py-3 px-4 font-medium">Customer</th>
                        <th className="text-left py-3 px-4 font-medium">Address</th>
                        <th className="text-left py-3 px-4 font-medium">Template</th>
                        <th className="text-left py-3 px-4 font-medium">Inspector</th>
                        <th className="text-left py-3 px-4 font-medium">Date</th>
                        <th className="text-left py-3 px-4 font-medium">Condition</th>
                        <th className="text-left py-3 px-4 font-medium">Urgency</th>
                        <th className="text-right py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                      {filteredCompletedInspections.map((insp) => (
                        <tr
                          key={insp.id}
                          className="hover:bg-gray-700/30 transition-colors"
                        >
                          <td className="py-3 px-4 font-medium">
                            {insp.customerName}
                          </td>
                          <td className="py-3 px-4 text-gray-400 max-w-[200px] truncate">
                            {insp.address}
                          </td>
                          <td className="py-3 px-4 text-gray-400">
                            {insp.templateName}
                          </td>
                          <td className="py-3 px-4 text-gray-400">
                            {insp.inspectorName}
                          </td>
                          <td className="py-3 px-4 text-gray-400">
                            {new Date(
                              insp.completedAt || insp.startedAt
                            ).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`capitalize font-medium ${
                                CONDITION_COLORS[insp.overallCondition]
                              }`}
                            >
                              {insp.overallCondition}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`capitalize ${
                                URGENCY_COLORS[insp.urgencyLevel]
                              }`}
                            >
                              {insp.urgencyLevel}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleViewInspection(insp.id)}
                                className="p-1.5 text-gray-400 hover:text-white rounded transition-colors"
                                title="View"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleShareInspection(insp.id)}
                                className="p-1.5 text-gray-400 hover:text-[#39FF14] rounded transition-colors"
                                title="Share"
                              >
                                <Share2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => window.print()}
                                className="p-1.5 text-gray-400 hover:text-white rounded transition-colors"
                                title="Print"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Start Inspection Modal */}
      {showStartModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Start New Inspection</h2>
              <button
                onClick={() => {
                  setShowStartModal(false);
                  setSelectedTemplateId('');
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Template Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Template <span className="text-red-400">*</span>
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white focus:outline-none focus:border-[#39FF14]"
                >
                  <option value="">Select a template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (~{t.estimatedMinutes} min)
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Customer Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={startForm.customerName}
                  onChange={(e) =>
                    setStartForm((f) => ({ ...f, customerName: e.target.value }))
                  }
                  placeholder="John Smith"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Property Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={startForm.address}
                  onChange={(e) =>
                    setStartForm((f) => ({ ...f, address: e.target.value }))
                  }
                  placeholder="123 Main St, Huntsville, AL 35801"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]"
                />
              </div>

              {/* Inspector Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Inspector Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={startForm.inspectorName}
                  onChange={(e) =>
                    setStartForm((f) => ({ ...f, inspectorName: e.target.value }))
                  }
                  placeholder="Inspector name"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]"
                />
              </div>

              {/* Optional fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Job ID (optional)
                  </label>
                  <input
                    type="text"
                    value={startForm.jobId}
                    onChange={(e) =>
                      setStartForm((f) => ({ ...f, jobId: e.target.value }))
                    }
                    placeholder="JN-12345"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Lead ID (optional)
                  </label>
                  <input
                    type="text"
                    value={startForm.leadId}
                    onChange={(e) =>
                      setStartForm((f) => ({ ...f, leadId: e.target.value }))
                    }
                    placeholder="lead-abc123"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14]"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-700 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowStartModal(false);
                  setSelectedTemplateId('');
                }}
                className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartInspection}
                disabled={
                  saving ||
                  !selectedTemplateId ||
                  !startForm.customerName ||
                  !startForm.address ||
                  !startForm.inspectorName
                }
                className="px-4 py-2 bg-[#39FF14] text-black rounded-lg font-medium hover:bg-[#39FF14]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ClipboardCheck className="w-4 h-4" />
                )}
                Start Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Result Toast */}
      {shareResult && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-800 border border-[#39FF14]/30 rounded-xl p-4 shadow-2xl max-w-md">
          <div className="flex items-start justify-between mb-2">
            <p className="text-sm text-[#39FF14] font-medium flex items-center gap-1">
              <CheckCircle className="w-4 h-4" /> Share Link Ready
            </p>
            <button
              onClick={() => setShareResult(null)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareResult.shareUrl}
              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg p-2 text-white text-xs"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareResult.shareUrl);
              }}
              className="px-3 py-2 bg-[#39FF14] text-black rounded-lg text-xs font-medium hover:bg-[#39FF14]/90 whitespace-nowrap"
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Active Inspection Card
 */
function ActiveInspectionCard({
  inspection,
  onContinue,
  onDelete,
}: {
  inspection: InspectionReport;
  onContinue: () => void;
  onDelete: () => void;
}) {
  const totalResponses = inspection.responses.length;
  const startDate = new Date(inspection.startedAt).toLocaleDateString();

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-yellow-500/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold">{inspection.customerName}</h3>
          <p className="text-sm text-gray-400 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3" />
            {inspection.address}
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
          {STATUS_LABELS[inspection.status]}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs text-gray-400 mb-4">
        <div>
          <ClipboardList className="w-3 h-3 inline mr-1" />
          {inspection.templateName}
        </div>
        <div>
          <User className="w-3 h-3 inline mr-1" />
          {inspection.inspectorName}
        </div>
        <div>
          <Calendar className="w-3 h-3 inline mr-1" />
          {startDate}
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span>{totalResponses} items answered</span>
        </div>
        <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-yellow-400 rounded-full transition-all"
            style={{ width: `${Math.min(totalResponses * 5, 100)}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onContinue}
          className="flex-1 py-2 bg-[#39FF14] text-black rounded-lg text-sm font-medium hover:bg-[#39FF14]/90 transition-colors flex items-center justify-center gap-1"
        >
          <ArrowRight className="w-3 h-3" /> Continue
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-gray-500 hover:text-red-400 rounded-lg border border-gray-700 hover:border-red-500/30 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Inspection Item Field - renders the correct input for each item type
 */
function InspectionItemField({
  item,
  sectionId,
  value,
  notes,
  showNotes,
  onToggleNotes,
  onChange,
}: {
  item: InspectionItem;
  sectionId: string;
  value: string | boolean | number | undefined;
  notes: string | undefined;
  showNotes: boolean;
  onToggleNotes: () => void;
  onChange: (value: string | boolean | number, notes?: string) => void;
}) {
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-4">
        {/* Label */}
        <div className="flex-1">
          <label className="text-sm text-gray-200">
            {item.label}
            {item.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          {item.helpText && (
            <p className="text-xs text-gray-500 mt-0.5">{item.helpText}</p>
          )}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2">
          {item.type === 'checkbox' && (
            <button
              onClick={() => onChange(!value)}
              className={`w-10 h-6 rounded-full transition-colors relative ${
                value ? 'bg-[#39FF14]' : 'bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${
                  value ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          )}

          {item.type === 'rating' && (
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => onChange(star)}
                  className="group relative"
                  title={RATING_LABELS[star]}
                >
                  <Star
                    className={`w-6 h-6 transition-colors ${
                      Number(value) >= star
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-600 hover:text-gray-400'
                    }`}
                  />
                </button>
              ))}
              {value !== undefined && (
                <span className="text-xs text-gray-400 ml-2">
                  {RATING_LABELS[Number(value)]}
                </span>
              )}
            </div>
          )}

          {item.type === 'text' && (
            <textarea
              value={String(value || '')}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Enter notes..."
              rows={2}
              className="w-64 bg-gray-700 border border-gray-600 rounded-lg p-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14] resize-none"
            />
          )}

          {item.type === 'photo' && (
            <div className="flex items-center gap-2">
              <label className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-600 cursor-pointer flex items-center gap-1 transition-colors">
                <Camera className="w-4 h-4" />
                Upload
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      onChange(e.target.files[0].name);
                    }
                  }}
                />
              </label>
              {value && (
                <span className="text-xs text-[#39FF14] flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Uploaded
                </span>
              )}
            </div>
          )}

          {item.type === 'measurement' && (
            <input
              type="number"
              value={value !== undefined ? String(value) : ''}
              onChange={(e) =>
                onChange(e.target.value ? parseFloat(e.target.value) : '')
              }
              placeholder="0"
              className="w-28 bg-gray-700 border border-gray-600 rounded-lg p-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#39FF14] text-center"
            />
          )}

          {item.type === 'select' && item.options && (
            <select
              value={String(value || '')}
              onChange={(e) => onChange(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-[#39FF14]"
            >
              <option value="">Select...</option>
              {item.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          )}

          {/* Notes toggle */}
          <button
            onClick={onToggleNotes}
            className={`p-1.5 rounded transition-colors ${
              showNotes || notes
                ? 'text-[#39FF14]'
                : 'text-gray-600 hover:text-gray-400'
            }`}
            title="Add notes"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notes field */}
      {showNotes && (
        <div className="mt-2 ml-0">
          <input
            type="text"
            value={notes || ''}
            onChange={(e) => onChange(value ?? '', e.target.value)}
            placeholder="Add a note..."
            className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg p-2 text-xs text-gray-300 placeholder-gray-500 focus:outline-none focus:border-[#39FF14]"
          />
        </div>
      )}
    </div>
  );
}
