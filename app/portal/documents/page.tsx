'use client';

/**
 * RCRS Portal - Rep Document Management
 *
 * Interface for reps to view available documents, share with customers,
 * upload new documents, and add notes to shared items.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Image,
  Receipt,
  Shield,
  ClipboardCheck,
  FileSignature,
  Search,
  Upload,
  Share2,
  Eye,
  Download,
  MessageSquare,
  RefreshCw,
  ChevronDown,
  CheckCircle2,
  Clock,
  XCircle,
  X,
  Plus,
  FolderOpen,
  Building2,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import {
  Document,
  DocumentType,
  DOCUMENT_TYPE_CONFIG,
  CATEGORY_LABELS
} from '@/types/documents';

// Document type icons
const TYPE_ICONS: Record<DocumentType, typeof FileText> = {
  job_image: Image,
  invoice: Receipt,
  contract: FileSignature,
  warranty: Shield,
  inspection_report: ClipboardCheck,
  insurance_document: FileText
};

// =============================================================================
// Upload Modal Component
// =============================================================================

function UploadModal({
  user,
  onClose,
  onSuccess,
}: {
  user: ReturnType<typeof useAuth>['user'];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [docType, setDocType] = useState<DocumentType>('job_image');
  const [category, setCategory] = useState<string>('before_photo');
  const [jobId, setJobId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [description, setDescription] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResults, setUploadResults] = useState<Array<{ name: string; success: boolean; error?: string }>>([]);

  const CATEGORY_OPTIONS: Record<DocumentType, { value: string; label: string }[]> = {
    job_image: [
      { value: 'before_photo', label: 'Before Photo' },
      { value: 'during_photo', label: 'Progress Photo' },
      { value: 'after_photo', label: 'After Photo' },
      { value: 'damage_photo', label: 'Damage Photo' },
      { value: 'completion_photo', label: 'Completion Photo' },
    ],
    invoice: [
      { value: 'estimate', label: 'Estimate' },
      { value: 'progress_invoice', label: 'Progress Invoice' },
      { value: 'final_invoice', label: 'Final Invoice' },
      { value: 'credit_memo', label: 'Credit Memo' },
    ],
    contract: [
      { value: 'proposal', label: 'Proposal' },
      { value: 'signed_contract', label: 'Signed Contract' },
      { value: 'change_order', label: 'Change Order' },
      { value: 'addendum', label: 'Addendum' },
    ],
    warranty: [
      { value: 'manufacturer_warranty', label: 'Manufacturer Warranty' },
      { value: 'workmanship_warranty', label: 'Workmanship Warranty' },
      { value: 'extended_warranty', label: 'Extended Warranty' },
    ],
    inspection_report: [
      { value: 'initial_inspection', label: 'Initial Inspection' },
      { value: 'progress_inspection', label: 'Progress Inspection' },
      { value: 'final_inspection', label: 'Final Inspection' },
      { value: 'third_party_inspection', label: 'Third Party Inspection' },
    ],
    insurance_document: [
      { value: 'claim_documentation', label: 'Claim Documentation' },
      { value: 'adjuster_report', label: 'Adjuster Report' },
      { value: 'approval_letter', label: 'Approval Letter' },
      { value: 'payment_summary', label: 'Payment Summary' },
    ],
  };

  // Update category when doc type changes
  useEffect(() => {
    const options = CATEGORY_OPTIONS[docType];
    if (options && options.length > 0) {
      setCategory(options[0].value);
    }
  }, [docType]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...droppedFiles]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Please select at least one file');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadResults([]);

    const results: Array<{ name: string; success: boolean; error?: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(Math.round(((i) / files.length) * 100));

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', docType);
        formData.append('category', category);
        formData.append('jobId', jobId || 'unassigned');
        formData.append('customerId', customerId || 'unassigned');
        formData.append('repId', user?.userId || 'unknown');
        formData.append('description', description);
        formData.append('uploadedBy', user?.name || 'Unknown');

        const response = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upload',
            filename: file.name,
            fileSize: file.size,
            mimeType: file.type,
            type: docType,
            category,
            jobId: jobId || 'unassigned',
            customerId: customerId || 'unassigned',
            repId: user?.userId || 'unknown',
            description,
            uploadedBy: user?.name || 'Unknown',
          }),
        });

        const data = await response.json();
        results.push({ name: file.name, success: data.success, error: data.error });
      } catch (err) {
        results.push({ name: file.name, success: false, error: 'Upload failed' });
      }
    }

    setUploadProgress(100);
    setUploadResults(results);

    const successCount = results.filter((r) => r.success).length;
    if (successCount > 0) {
      setTimeout(() => onSuccess(), 1500);
    }

    setUploading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-neutral-800 sticky top-0 bg-neutral-900 z-10">
          <h2 className="text-lg font-bold text-white">Upload Documents</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X size={20} className="text-neutral-400" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
              dragOver
                ? "border-brand-green bg-brand-green/5"
                : "border-neutral-700 hover:border-neutral-600"
            )}
            onClick={() => document.getElementById('file-upload-input')?.click()}
          >
            <Upload className={cn("mx-auto mb-3", dragOver ? "text-brand-green" : "text-neutral-500")} size={36} />
            <p className="text-white font-medium">Drop files here or click to browse</p>
            <p className="text-sm text-neutral-500 mt-1">
              Photos, PDFs, contracts - up to 10MB each
            </p>
            <input
              id="file-upload-input"
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Selected Files */}
          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-neutral-300">{files.length} file(s) selected</p>
              {files.map((file, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 bg-neutral-800 rounded-lg">
                  <FileText size={16} className="text-neutral-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{file.name}</p>
                    <p className="text-xs text-neutral-500">{formatSize(file.size)}</p>
                  </div>
                  <button
                    onClick={() => removeFile(idx)}
                    className="p-1 hover:bg-neutral-700 rounded transition-colors"
                  >
                    <X size={14} className="text-neutral-400" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Document Type */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1.5">Document Type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocumentType)}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-brand-green/50"
            >
              {Object.entries(DOCUMENT_TYPE_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-brand-green/50"
            >
              {(CATEGORY_OPTIONS[docType] || []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Job ID and Customer ID */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1.5">Job ID</label>
              <input
                type="text"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                placeholder="e.g., JOB-1234"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1.5">Customer ID</label>
              <input
                type="text"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="e.g., CUST-001"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the document(s)..."
              rows={2}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-green rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Upload Results */}
          {uploadResults.length > 0 && (
            <div className="space-y-1">
              {uploadResults.map((result, idx) => (
                <div key={idx} className={cn(
                  "flex items-center gap-2 p-2 rounded-lg text-sm",
                  result.success ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                )}>
                  {result.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  <span className="truncate">{result.name}</span>
                  {result.error && <span className="text-xs opacity-70">- {result.error}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-brand-green hover:bg-brand-green/90 rounded-lg text-black font-medium transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Upload size={18} />
              )}
              {uploading ? 'Uploading...' : `Upload ${files.length || ''} File${files.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RepDocumentsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [availableToShare, setAvailableToShare] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'available' | 'shared'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<DocumentType | 'all'>('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [shareNotes, setShareNotes] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  // Fetch documents
  const fetchData = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const [allDocsRes, availableRes] = await Promise.all([
        fetch(`/api/documents?repId=${user.userId}`),
        fetch(`/api/documents?action=available-to-share&repId=${user.userId}`)
      ]);

      const allDocsData = await allDocsRes.json();
      const availableData = await availableRes.json();

      if (allDocsData.success) setDocuments(allDocsData.documents);
      if (availableData.success) setAvailableToShare(availableData.documents);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get filtered documents based on active tab
  const getFilteredDocs = (): Document[] => {
    let docs: Document[];

    switch (activeTab) {
      case 'available':
        docs = availableToShare;
        break;
      case 'shared':
        docs = documents.filter(d => d.sharedWithCustomer);
        break;
      default:
        docs = documents;
    }

    // Apply type filter
    if (filterType !== 'all') {
      docs = docs.filter(d => d.type === filterType);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      docs = docs.filter(d =>
        d.originalName.toLowerCase().includes(query) ||
        d.description.toLowerCase().includes(query) ||
        d.jobId.toLowerCase().includes(query)
      );
    }

    return docs;
  };

  const filteredDocs = getFilteredDocs();

  // Share document with customer
  const shareDocument = async () => {
    if (!selectedDoc || !user) return;

    setIsSharing(true);
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'share',
          documentId: selectedDoc.id,
          sharedBy: user.userId,
          repNotes: shareNotes || null
        })
      });

      if ((await response.json()).success) {
        setShowShareModal(false);
        setSelectedDoc(null);
        setShareNotes('');
        fetchData();
      }
    } catch (error) {
      console.error('Error sharing document:', error);
    } finally {
      setIsSharing(false);
    }
  };

  // Unshare document
  const unshareDocument = async (doc: Document) => {
    if (!confirm('Remove this document from customer view?')) return;

    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unshare',
          documentId: doc.id,
          performedBy: user?.userId
        })
      });

      if ((await response.json()).success) {
        fetchData();
      }
    } catch (error) {
      console.error('Error unsharing document:', error);
    }
  };

  // Update notes
  const updateNotes = async (doc: Document, notes: string) => {
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-notes',
          documentId: doc.id,
          repNotes: notes
        })
      });

      if ((await response.json()).success) {
        fetchData();
      }
    } catch (error) {
      console.error('Error updating notes:', error);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Header */}
      <header className="bg-neutral-900/80 backdrop-blur-sm border-b border-neutral-800 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} className="text-neutral-400" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">Document Management</h1>
                <p className="text-sm text-neutral-400">View and share documents with customers</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-brand-green text-black font-medium rounded-lg hover:bg-brand-green/90 transition-colors"
              >
                <Upload size={18} />
                Upload
              </button>
              <button
                onClick={fetchData}
                className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
              >
                <RefreshCw size={18} className={cn("text-neutral-400", isLoading && "animate-spin")} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { id: 'all', label: 'All Documents', count: documents.length },
            { id: 'available', label: 'Ready to Share', count: availableToShare.length },
            { id: 'shared', label: 'Shared', count: documents.filter(d => d.sharedWithCustomer).length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors",
                activeTab === tab.id
                  ? "bg-brand-green text-black"
                  : "bg-neutral-800 text-neutral-400 hover:text-white"
              )}
            >
              {tab.label}
              <span className={cn(
                "px-2 py-0.5 rounded-full text-xs",
                activeTab === tab.id
                  ? "bg-black/20 text-black"
                  : "bg-neutral-700 text-neutral-300"
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search and Filters */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 mb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50"
              />
            </div>

            {/* Type filter */}
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                onClick={() => setFilterType('all')}
                className={cn(
                  "px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors",
                  filterType === 'all'
                    ? "bg-brand-green/20 text-brand-green"
                    : "bg-neutral-800 text-neutral-400 hover:text-white"
                )}
              >
                All Types
              </button>
              {Object.entries(DOCUMENT_TYPE_CONFIG).map(([type, config]) => {
                const Icon = TYPE_ICONS[type as DocumentType];
                return (
                  <button
                    key={type}
                    onClick={() => setFilterType(type as DocumentType)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors",
                      filterType === type
                        ? `${config.bgColor} ${config.color}`
                        : "bg-neutral-800 text-neutral-400 hover:text-white"
                    )}
                  >
                    <Icon size={14} />
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Documents Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="animate-spin text-brand-green" size={32} />
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-12 text-center">
            <FolderOpen className="text-neutral-600 mx-auto mb-4" size={48} />
            <p className="text-neutral-400 font-medium">No documents found</p>
            <p className="text-neutral-500 text-sm mt-1">
              {activeTab === 'available'
                ? 'Documents will appear here when approved by admin'
                : 'Upload documents or adjust your filters'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredDocs.map((doc) => {
              const Icon = TYPE_ICONS[doc.type];
              const config = DOCUMENT_TYPE_CONFIG[doc.type];

              return (
                <div
                  key={doc.id}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden hover:border-neutral-700 transition-colors"
                >
                  {/* Document preview/icon */}
                  <div className={cn("h-32 flex items-center justify-center", config.bgColor)}>
                    {doc.thumbnailUrl ? (
                      <img
                        src={doc.thumbnailUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Icon className={config.color} size={48} />
                    )}
                  </div>

                  {/* Document info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-white truncate">{doc.originalName}</h3>
                        <p className="text-sm text-neutral-500 truncate">{doc.description || 'No description'}</p>
                      </div>
                      {doc.isProfileImage && (
                        <span className="ml-2 px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                          Profile
                        </span>
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="flex items-center gap-3 text-xs text-neutral-500 mb-3">
                      <span className={cn("px-2 py-0.5 rounded", config.bgColor, config.color)}>
                        {CATEGORY_LABELS[doc.category]}
                      </span>
                      <span>{formatFileSize(doc.fileSize)}</span>
                      <span>{formatDate(doc.uploadedAt)}</span>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2 mb-3">
                      {doc.sharedWithCustomer ? (
                        <span className="flex items-center gap-1 text-xs text-green-400">
                          <Share2 size={12} />
                          Shared with customer
                        </span>
                      ) : doc.adminApproved ? (
                        <span className="flex items-center gap-1 text-xs text-blue-400">
                          <CheckCircle2 size={12} />
                          Ready to share
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-400">
                          <Clock size={12} />
                          Pending approval
                        </span>
                      )}
                    </div>

                    {/* Rep notes */}
                    {doc.repNotes && (
                      <div className="bg-neutral-800 rounded-lg p-2 mb-3">
                        <p className="text-xs text-neutral-400 flex items-start gap-1">
                          <MessageSquare size={12} className="mt-0.5 shrink-0" />
                          {doc.repNotes}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => window.open(doc.fileUrl, '_blank')}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-white transition-colors"
                      >
                        <Eye size={14} />
                        View
                      </button>

                      {doc.adminApproved && !doc.sharedWithCustomer && (
                        <button
                          onClick={() => {
                            setSelectedDoc(doc);
                            setShowShareModal(true);
                          }}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-brand-green hover:bg-brand-green/90 rounded-lg text-sm text-black font-medium transition-colors"
                        >
                          <Share2 size={14} />
                          Share
                        </button>
                      )}

                      {doc.sharedWithCustomer && (
                        <button
                          onClick={() => unshareDocument(doc)}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm text-red-400 transition-colors"
                        >
                          <XCircle size={14} />
                          Unshare
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Share Modal */}
      {showShareModal && selectedDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800">
              <h2 className="text-lg font-bold text-white">Share with Customer</h2>
              <button
                onClick={() => {
                  setShowShareModal(false);
                  setSelectedDoc(null);
                  setShareNotes('');
                }}
                className="p-1 hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <X size={20} className="text-neutral-400" />
              </button>
            </div>

            <div className="p-4">
              {/* Document preview */}
              <div className="flex items-center gap-3 mb-4 p-3 bg-neutral-800 rounded-lg">
                {(() => {
                  const Icon = TYPE_ICONS[selectedDoc.type];
                  const config = DOCUMENT_TYPE_CONFIG[selectedDoc.type];
                  return (
                    <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", config.bgColor)}>
                      <Icon className={config.color} size={24} />
                    </div>
                  );
                })()}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white truncate">{selectedDoc.originalName}</p>
                  <p className="text-sm text-neutral-500">{CATEGORY_LABELS[selectedDoc.category]}</p>
                </div>
              </div>

              {/* Notes input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Add a note for the customer (optional)
                </label>
                <textarea
                  value={shareNotes}
                  onChange={(e) => setShareNotes(e.target.value)}
                  placeholder="e.g., Here are the before photos of your roof..."
                  rows={3}
                  className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-brand-green/50 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowShareModal(false);
                    setSelectedDoc(null);
                    setShareNotes('');
                  }}
                  className="flex-1 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={shareDocument}
                  disabled={isSharing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-brand-green hover:bg-brand-green/90 rounded-lg text-black font-medium transition-colors disabled:opacity-50"
                >
                  {isSharing ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <Share2 size={18} />
                  )}
                  {isSharing ? 'Sharing...' : 'Share Document'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal - Real Implementation */}
      {showUploadModal && (
        <UploadModal
          user={user}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
