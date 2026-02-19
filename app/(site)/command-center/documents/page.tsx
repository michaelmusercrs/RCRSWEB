'use client';

/**
 * RCRS Command Center - Document Management
 *
 * Admin interface for managing documents, approving sharing,
 * and overseeing document distribution to customers.
 */

import { useState, useEffect, useCallback } from 'react';
import NextImage from 'next/image';
import {
  FileText,
  Image,
  Receipt,
  Shield,
  ClipboardCheck,
  FileSignature,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Share2,
  Eye,
  Download,
  Trash2,
  RefreshCw,
  ChevronDown,
  AlertCircle,
  CheckSquare,
  Square,
  MoreVertical,
  Clock,
  User,
  Building2,
  FolderOpen
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import {
  Document,
  DocumentType,
  DocumentStats,
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

export default function DocumentManagementPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<DocumentType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'shared'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [actionMenuDoc, setActionMenuDoc] = useState<string | null>(null);

  // Fetch documents and stats
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [docsRes, statsRes] = await Promise.all([
        fetch('/api/documents'),
        fetch('/api/documents?action=stats')
      ]);

      const docsData = await docsRes.json();
      const statsData = await statsRes.json();

      if (docsData.success) setDocuments(docsData.documents);
      if (statsData.success) setStats(statsData.stats);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter documents
  const filteredDocs = documents.filter(doc => {
    // Type filter
    if (filterType !== 'all' && doc.type !== filterType) return false;

    // Status filter
    if (filterStatus === 'pending' && doc.adminApproved) return false;
    if (filterStatus === 'approved' && (!doc.adminApproved || doc.sharedWithCustomer)) return false;
    if (filterStatus === 'shared' && !doc.sharedWithCustomer) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        doc.originalName.toLowerCase().includes(query) ||
        doc.description.toLowerCase().includes(query) ||
        doc.jobId.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Toggle document selection
  const toggleSelection = (docId: string) => {
    const newSelected = new Set(selectedDocs);
    if (newSelected.has(docId)) {
      newSelected.delete(docId);
    } else {
      newSelected.add(docId);
    }
    setSelectedDocs(newSelected);
  };

  // Select all visible documents
  const selectAll = () => {
    if (selectedDocs.size === filteredDocs.length) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(filteredDocs.map(d => d.id)));
    }
  };

  // Approve document
  const approveDocument = async (docId: string) => {
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          documentId: docId,
          approvedBy: user?.userId
        })
      });

      if ((await response.json()).success) {
        fetchData();
      }
    } catch (error) {
      console.error('Error approving document:', error);
    }
    setActionMenuDoc(null);
  };

  // Revoke approval
  const revokeApproval = async (docId: string) => {
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'revoke-approval',
          documentId: docId,
          performedBy: user?.userId
        })
      });

      if ((await response.json()).success) {
        fetchData();
      }
    } catch (error) {
      console.error('Error revoking approval:', error);
    }
    setActionMenuDoc(null);
  };

  // Bulk approve
  const bulkApprove = async () => {
    if (selectedDocs.size === 0) return;

    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk-approve',
          documentIds: Array.from(selectedDocs),
          approvedBy: user?.userId
        })
      });

      if ((await response.json()).success) {
        setSelectedDocs(new Set());
        fetchData();
      }
    } catch (error) {
      console.error('Error bulk approving:', error);
    }
  };

  // Delete document
  const deleteDocument = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const response = await fetch(
        `/api/documents?documentId=${docId}&deletedBy=${user?.userId}`,
        { method: 'DELETE' }
      );

      if ((await response.json()).success) {
        fetchData();
      }
    } catch (error) {
      console.error('Error deleting document:', error);
    }
    setActionMenuDoc(null);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Document Management</h1>
          <p className="text-zinc-400 mt-1">
            Manage and approve documents for customer sharing
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white transition-colors"
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-green/20 rounded-lg flex items-center justify-center">
                <FolderOpen className="text-blue-400" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.totalDocuments}</p>
                <p className="text-sm text-zinc-500">Total Documents</p>
              </div>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <Clock className="text-amber-400" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.pendingApproval}</p>
                <p className="text-sm text-zinc-500">Pending Approval</p>
              </div>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Share2 className="text-green-400" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.sharedWithCustomers}</p>
                <p className="text-sm text-zinc-500">Shared with Customers</p>
              </div>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Image className="text-purple-400" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.uploadedThisMonth}</p>
                <p className="text-sm text-zinc-500">Uploaded This Month</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500/50"
            />
          </div>

          {/* Filter buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                showFilters ? "bg-lime-500/20 text-lime-400" : "bg-zinc-800 text-zinc-400 hover:text-white"
              )}
            >
              <Filter size={16} />
              Filters
              <ChevronDown size={14} className={showFilters ? 'rotate-180' : ''} />
            </button>

            {/* Quick status filters */}
            {['all', 'pending', 'approved', 'shared'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status as typeof filterStatus)}
                className={cn(
                  "px-3 py-2 rounded-lg text-sm capitalize transition-colors",
                  filterStatus === status
                    ? "bg-lime-500/20 text-lime-400"
                    : "bg-zinc-800 text-zinc-400 hover:text-white"
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <p className="text-sm text-zinc-400 mb-3">Filter by document type:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterType('all')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm transition-colors",
                  filterType === 'all'
                    ? "bg-lime-500/20 text-lime-400"
                    : "bg-zinc-800 text-zinc-400 hover:text-white"
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
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
                      filterType === type
                        ? `${config.bgColor} ${config.color}`
                        : "bg-zinc-800 text-zinc-400 hover:text-white"
                    )}
                  >
                    <Icon size={14} />
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedDocs.size > 0 && (
        <div className="bg-lime-500/10 border border-lime-500/30 rounded-xl p-4 flex items-center justify-between">
          <p className="text-lime-400">
            <span className="font-bold">{selectedDocs.size}</span> document(s) selected
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={bulkApprove}
              className="flex items-center gap-2 px-4 py-2 bg-lime-500 text-black font-medium rounded-lg hover:bg-lime-400 transition-colors"
            >
              <CheckCircle2 size={16} />
              Approve Selected
            </button>
            <button
              onClick={() => setSelectedDocs(new Set())}
              className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Documents Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-zinc-800 bg-zinc-800/50 text-sm font-medium text-zinc-400">
          <div className="col-span-1">
            <button onClick={selectAll} className="hover:text-white transition-colors">
              {selectedDocs.size === filteredDocs.length && filteredDocs.length > 0 ? (
                <CheckSquare size={18} className="text-lime-400" />
              ) : (
                <Square size={18} />
              )}
            </button>
          </div>
          <div className="col-span-4">Document</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Uploaded</div>
          <div className="col-span-1">Actions</div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="p-12 text-center">
            <RefreshCw className="animate-spin text-lime-400 mx-auto mb-4" size={32} />
            <p className="text-zinc-500">Loading documents...</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredDocs.length === 0 && (
          <div className="p-12 text-center">
            <FolderOpen className="text-zinc-600 mx-auto mb-4" size={48} />
            <p className="text-zinc-400 font-medium">No documents found</p>
            <p className="text-zinc-500 text-sm mt-1">
              {searchQuery || filterType !== 'all' || filterStatus !== 'all'
                ? 'Try adjusting your filters'
                : 'Documents will appear here when uploaded'}
            </p>
          </div>
        )}

        {/* Document rows */}
        {!isLoading && filteredDocs.map((doc) => {
          const Icon = TYPE_ICONS[doc.type];
          const config = DOCUMENT_TYPE_CONFIG[doc.type];
          const isSelected = selectedDocs.has(doc.id);

          return (
            <div
              key={doc.id}
              className={cn(
                "grid grid-cols-12 gap-4 p-4 border-b border-zinc-800 items-center hover:bg-zinc-800/30 transition-colors",
                isSelected && "bg-lime-500/5"
              )}
            >
              {/* Selection */}
              <div className="col-span-1">
                <button
                  onClick={() => toggleSelection(doc.id)}
                  className="hover:text-white transition-colors"
                >
                  {isSelected ? (
                    <CheckSquare size={18} className="text-lime-400" />
                  ) : (
                    <Square size={18} className="text-zinc-500" />
                  )}
                </button>
              </div>

              {/* Document info */}
              <div className="col-span-4">
                <div className="flex items-start gap-3">
                  {doc.thumbnailUrl ? (
                    <NextImage
                      src={doc.thumbnailUrl}
                      alt={`${doc.filename} document thumbnail`}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-lg object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", config.bgColor)}>
                      <Icon className={config.color} size={20} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">{doc.originalName}</p>
                    <p className="text-sm text-zinc-500 truncate">{doc.description || 'No description'}</p>
                    <p className="text-xs text-zinc-600 mt-1">
                      {doc.jobId} | {formatFileSize(doc.fileSize)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Type */}
              <div className="col-span-2">
                <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium", config.bgColor, config.color)}>
                  <Icon size={12} />
                  {CATEGORY_LABELS[doc.category] || doc.category}
                </span>
              </div>

              {/* Status */}
              <div className="col-span-2">
                <div className="flex flex-col gap-1">
                  {doc.sharedWithCustomer ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-400">
                      <Share2 size={12} />
                      Shared
                    </span>
                  ) : doc.adminApproved ? (
                    <span className="inline-flex items-center gap-1 text-xs text-blue-400">
                      <CheckCircle2 size={12} />
                      Approved
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                      <Clock size={12} />
                      Pending
                    </span>
                  )}
                  {doc.isProfileImage && (
                    <span className="inline-flex items-center gap-1 text-xs text-purple-400">
                      <Image size={12} />
                      Profile
                    </span>
                  )}
                </div>
              </div>

              {/* Uploaded */}
              <div className="col-span-2">
                <p className="text-sm text-zinc-400">{formatDate(doc.uploadedAt)}</p>
                <p className="text-xs text-zinc-600 flex items-center gap-1">
                  <User size={10} />
                  {doc.uploadedBy}
                </p>
              </div>

              {/* Actions */}
              <div className="col-span-1 relative">
                <button
                  onClick={() => setActionMenuDoc(actionMenuDoc === doc.id ? null : doc.id)}
                  className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  <MoreVertical size={18} className="text-zinc-400" />
                </button>

                {/* Action dropdown */}
                {actionMenuDoc === doc.id && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-10">
                    <div className="py-1">
                      <button
                        onClick={() => window.open(doc.fileUrl, '_blank')}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
                      >
                        <Eye size={14} />
                        View
                      </button>
                      <button
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = doc.fileUrl;
                          a.download = doc.filename;
                          a.click();
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
                      >
                        <Download size={14} />
                        Download
                      </button>
                      <div className="border-t border-zinc-700 my-1" />
                      {!doc.adminApproved ? (
                        <button
                          onClick={() => approveDocument(doc.id)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-lime-400 hover:bg-zinc-700 transition-colors"
                        >
                          <CheckCircle2 size={14} />
                          Approve for Sharing
                        </button>
                      ) : (
                        <button
                          onClick={() => revokeApproval(doc.id)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-amber-400 hover:bg-zinc-700 transition-colors"
                        >
                          <XCircle size={14} />
                          Revoke Approval
                        </button>
                      )}
                      <div className="border-t border-zinc-700 my-1" />
                      <button
                        onClick={() => deleteDocument(doc.id)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-zinc-700 transition-colors"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Click outside to close action menu */}
      {actionMenuDoc && (
        <div
          className="fixed inset-0 z-5"
          onClick={() => setActionMenuDoc(null)}
        />
      )}
    </div>
  );
}
