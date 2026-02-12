/**
 * Document Management Types for RCRS
 *
 * Defines types for document sharing between admin, reps, and customers.
 */

// Document type identifiers
export type DocumentType =
  | 'job_image'
  | 'invoice'
  | 'contract'
  | 'warranty'
  | 'inspection_report'
  | 'insurance_document';

// Document categories by type
export type DocumentCategory =
  // Job images
  | 'before_photo'
  | 'during_photo'
  | 'after_photo'
  | 'damage_photo'
  | 'completion_photo'
  // Invoices
  | 'estimate'
  | 'progress_invoice'
  | 'final_invoice'
  | 'credit_memo'
  // Contracts
  | 'proposal'
  | 'signed_contract'
  | 'change_order'
  | 'addendum'
  // Warranties
  | 'manufacturer_warranty'
  | 'workmanship_warranty'
  | 'extended_warranty'
  // Inspection reports
  | 'initial_inspection'
  | 'progress_inspection'
  | 'final_inspection'
  | 'third_party_inspection'
  // Insurance documents
  | 'claim_documentation'
  | 'adjuster_report'
  | 'approval_letter'
  | 'payment_summary';

// Main document interface
export interface Document {
  id: string;
  jobId: string;
  customerId: string;
  repId: string;
  type: DocumentType;
  category: DocumentCategory;
  filename: string;
  originalName: string;
  fileUrl: string;
  thumbnailUrl: string | null;
  mimeType: string;
  fileSize: number;
  description: string;
  isProfileImage: boolean;
  // Admin approval for sharing
  adminApproved: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  // Customer sharing
  sharedWithCustomer: boolean;
  sharedAt: string | null;
  sharedBy: string | null;
  repNotes: string | null;
  // Upload info
  uploadedBy: string;
  uploadedAt: string;
  // Additional metadata
  metadata: Record<string, unknown>;
}

// Document type definition
export interface DocumentTypeDefinition {
  id: DocumentType;
  name: string;
  description: string;
  icon: string;
  categories: DocumentCategory[];
}

// Sharing log entry
export interface SharingLogEntry {
  id: string;
  documentId: string;
  action: 'uploaded' | 'approved' | 'shared' | 'unshared' | 'deleted' | 'downloaded';
  performedBy: string;
  performedAt: string;
  recipientType: 'customer' | 'rep' | null;
  recipientId: string | null;
  notes: string | null;
}

// Document filter options
export interface DocumentFilters {
  jobId?: string;
  customerId?: string;
  repId?: string;
  type?: DocumentType;
  category?: DocumentCategory;
  adminApproved?: boolean;
  sharedWithCustomer?: boolean;
  uploadedBy?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Bulk operation request
export interface BulkDocumentOperation {
  documentIds: string[];
  operation: 'approve' | 'revoke_approval' | 'share' | 'unshare' | 'delete';
  performedBy: string;
  notes?: string;
}

// Upload request
export interface DocumentUploadRequest {
  jobId: string;
  customerId: string;
  repId: string;
  type: DocumentType;
  category: DocumentCategory;
  description?: string;
  setAsProfileImage?: boolean;
}

// Share request
export interface DocumentShareRequest {
  documentId: string;
  repId: string;
  notes?: string;
}

// API response types
export interface DocumentsResponse {
  success: boolean;
  documents?: Document[];
  total?: number;
  error?: string;
}

export interface DocumentResponse {
  success: boolean;
  document?: Document;
  error?: string;
}

export interface BulkOperationResponse {
  success: boolean;
  processed: number;
  failed: number;
  errors?: string[];
}

// Document stats for dashboard
export interface DocumentStats {
  totalDocuments: number;
  byType: Record<DocumentType, number>;
  pendingApproval: number;
  sharedWithCustomers: number;
  uploadedThisMonth: number;
}

// Customer document view (filtered/sanitized for customer access)
export interface CustomerDocument {
  id: string;
  jobId: string;
  type: DocumentType;
  category: DocumentCategory;
  originalName: string;
  fileUrl: string;
  thumbnailUrl: string | null;
  description: string;
  sharedAt: string;
  repNotes: string | null;
}

// Document display config for UI
export const DOCUMENT_TYPE_CONFIG: Record<DocumentType, {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
}> = {
  job_image: {
    label: 'Job Images',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    icon: 'Image'
  },
  invoice: {
    label: 'Invoices',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    icon: 'Receipt'
  },
  contract: {
    label: 'Contracts',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    icon: 'FileSignature'
  },
  warranty: {
    label: 'Warranties',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    icon: 'Shield'
  },
  inspection_report: {
    label: 'Inspection Reports',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    icon: 'ClipboardCheck'
  },
  insurance_document: {
    label: 'Insurance Documents',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/20',
    icon: 'FileText'
  }
};

// Category display labels
export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  // Job images
  before_photo: 'Before Photo',
  during_photo: 'Progress Photo',
  after_photo: 'After Photo',
  damage_photo: 'Damage Photo',
  completion_photo: 'Completion Photo',
  // Invoices
  estimate: 'Estimate',
  progress_invoice: 'Progress Invoice',
  final_invoice: 'Final Invoice',
  credit_memo: 'Credit Memo',
  // Contracts
  proposal: 'Proposal',
  signed_contract: 'Signed Contract',
  change_order: 'Change Order',
  addendum: 'Addendum',
  // Warranties
  manufacturer_warranty: 'Manufacturer Warranty',
  workmanship_warranty: 'Workmanship Warranty',
  extended_warranty: 'Extended Warranty',
  // Inspection reports
  initial_inspection: 'Initial Inspection',
  progress_inspection: 'Progress Inspection',
  final_inspection: 'Final Inspection',
  third_party_inspection: 'Third Party Inspection',
  // Insurance documents
  claim_documentation: 'Claim Documentation',
  adjuster_report: 'Adjuster Report',
  approval_letter: 'Approval Letter',
  payment_summary: 'Payment Summary'
};
