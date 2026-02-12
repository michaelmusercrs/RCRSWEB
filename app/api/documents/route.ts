import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { promises as fs } from 'fs';
import path from 'path';
import {
  Document,
  DocumentFilters,
  SharingLogEntry,
  DocumentType,
  DocumentCategory
} from '@/types/documents';
import { apiError, getErrorMessage } from '@/lib/api-response';

const DATA_FILE = path.join(process.cwd(), 'data', 'documents.json');

// Helper to read documents data
// Returns empty collections only when the data file genuinely does not exist yet.
// Parse errors and other I/O failures are thrown so callers can surface them.
async function readDocumentsData(): Promise<{
  documents: Document[];
  documentTypes: unknown[];
  sharingLog: SharingLogEntry[];
}> {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err: any) {
    // File not found is expected on first run -- return empty data
    if (err?.code === 'ENOENT') {
      return { documents: [], documentTypes: [], sharingLog: [] };
    }
    // Any other error (permission denied, corrupt JSON) should propagate
    throw err;
  }
}

// Helper to write documents data
async function writeDocumentsData(data: {
  documents: Document[];
  documentTypes: unknown[];
  sharingLog: SharingLogEntry[];
}): Promise<void> {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET - Fetch documents with optional filtering
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const data = await readDocumentsData();

    // Handle different actions
    switch (action) {
      case 'stats': {
        // Return document statistics
        const stats = {
          totalDocuments: data.documents.length,
          byType: {} as Record<DocumentType, number>,
          pendingApproval: data.documents.filter(d => !d.adminApproved).length,
          sharedWithCustomers: data.documents.filter(d => d.sharedWithCustomer).length,
          uploadedThisMonth: data.documents.filter(d => {
            const uploadDate = new Date(d.uploadedAt);
            const now = new Date();
            return uploadDate.getMonth() === now.getMonth() &&
                   uploadDate.getFullYear() === now.getFullYear();
          }).length
        };

        // Count by type
        data.documents.forEach(doc => {
          stats.byType[doc.type] = (stats.byType[doc.type] || 0) + 1;
        });

        return NextResponse.json({ success: true, stats });
      }

      case 'types': {
        return NextResponse.json({ success: true, types: data.documentTypes });
      }

      case 'sharing-log': {
        const documentId = searchParams.get('documentId');
        let logs = data.sharingLog;
        if (documentId) {
          logs = logs.filter(l => l.documentId === documentId);
        }
        return NextResponse.json({ success: true, logs });
      }

      case 'customer-documents': {
        // Get documents shared with a specific customer
        const customerId = searchParams.get('customerId');
        if (!customerId) {
          return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });
        }

        const customerDocs = data.documents
          .filter(d => d.customerId === customerId && d.sharedWithCustomer)
          .map(d => ({
            id: d.id,
            jobId: d.jobId,
            type: d.type,
            category: d.category,
            originalName: d.originalName,
            fileUrl: d.fileUrl,
            thumbnailUrl: d.thumbnailUrl,
            description: d.description,
            sharedAt: d.sharedAt,
            repNotes: d.repNotes
          }));

        return NextResponse.json({ success: true, documents: customerDocs });
      }

      case 'available-to-share': {
        // Get documents approved by admin but not yet shared
        const jobId = searchParams.get('jobId');
        const repId = searchParams.get('repId');

        let docs = data.documents.filter(d => d.adminApproved && !d.sharedWithCustomer);
        if (jobId) docs = docs.filter(d => d.jobId === jobId);
        if (repId) docs = docs.filter(d => d.repId === repId);

        return NextResponse.json({ success: true, documents: docs });
      }

      case 'pending-approval': {
        // Get documents pending admin approval
        const docs = data.documents.filter(d => !d.adminApproved);
        return NextResponse.json({ success: true, documents: docs });
      }

      default: {
        // Default: list with filters
        let documents = data.documents;

        // Apply filters
        const filters: DocumentFilters = {
          jobId: searchParams.get('jobId') || undefined,
          customerId: searchParams.get('customerId') || undefined,
          repId: searchParams.get('repId') || undefined,
          type: searchParams.get('type') as DocumentType | undefined,
          category: searchParams.get('category') as DocumentCategory | undefined,
          adminApproved: searchParams.get('adminApproved') === 'true' ? true :
                         searchParams.get('adminApproved') === 'false' ? false : undefined,
          sharedWithCustomer: searchParams.get('sharedWithCustomer') === 'true' ? true :
                              searchParams.get('sharedWithCustomer') === 'false' ? false : undefined,
          uploadedBy: searchParams.get('uploadedBy') || undefined,
          dateFrom: searchParams.get('dateFrom') || undefined,
          dateTo: searchParams.get('dateTo') || undefined
        };

        if (filters.jobId) documents = documents.filter(d => d.jobId === filters.jobId);
        if (filters.customerId) documents = documents.filter(d => d.customerId === filters.customerId);
        if (filters.repId) documents = documents.filter(d => d.repId === filters.repId);
        if (filters.type) documents = documents.filter(d => d.type === filters.type);
        if (filters.category) documents = documents.filter(d => d.category === filters.category);
        if (filters.adminApproved !== undefined) documents = documents.filter(d => d.adminApproved === filters.adminApproved);
        if (filters.sharedWithCustomer !== undefined) documents = documents.filter(d => d.sharedWithCustomer === filters.sharedWithCustomer);
        if (filters.uploadedBy) documents = documents.filter(d => d.uploadedBy === filters.uploadedBy);
        if (filters.dateFrom) documents = documents.filter(d => new Date(d.uploadedAt) >= new Date(filters.dateFrom!));
        if (filters.dateTo) documents = documents.filter(d => new Date(d.uploadedAt) <= new Date(filters.dateTo!));

        // Sort by upload date (newest first)
        documents.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

        return NextResponse.json({
          success: true,
          documents,
          total: documents.length
        });
      }
    }
  } catch (error) {
    console.error('Documents API GET error:', error);
    return apiError(getErrorMessage(error), 500, 'DOCUMENTS_FETCH_FAILED');
  }
}

// POST - Create document or perform actions
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action, ...payload } = body;

    const data = await readDocumentsData();

    switch (action) {
      case 'create': {
        // Create new document entry
        const newDoc: Document = {
          id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          jobId: payload.jobId,
          customerId: payload.customerId,
          repId: payload.repId,
          type: payload.type,
          category: payload.category,
          filename: payload.filename,
          originalName: payload.originalName,
          fileUrl: payload.fileUrl,
          thumbnailUrl: payload.thumbnailUrl || null,
          mimeType: payload.mimeType,
          fileSize: payload.fileSize,
          description: payload.description || '',
          isProfileImage: payload.setAsProfileImage || false,
          adminApproved: false,
          approvedBy: null,
          approvedAt: null,
          sharedWithCustomer: false,
          sharedAt: null,
          sharedBy: null,
          repNotes: null,
          uploadedBy: payload.uploadedBy,
          uploadedAt: new Date().toISOString(),
          metadata: payload.metadata || {}
        };

        // If this is the first image for the job, make it the profile image
        if (newDoc.type === 'job_image') {
          const existingJobImages = data.documents.filter(
            d => d.jobId === newDoc.jobId && d.type === 'job_image'
          );
          if (existingJobImages.length === 0) {
            newDoc.isProfileImage = true;
          }
        }

        data.documents.push(newDoc);

        // Add to sharing log
        data.sharingLog.push({
          id: `log-${Date.now()}`,
          documentId: newDoc.id,
          action: 'uploaded',
          performedBy: payload.uploadedBy,
          performedAt: new Date().toISOString(),
          recipientType: null,
          recipientId: null,
          notes: `Uploaded ${newDoc.originalName}`
        });

        await writeDocumentsData(data);
        return NextResponse.json({ success: true, document: newDoc });
      }

      case 'approve': {
        // Admin approves document for sharing
        const docIndex = data.documents.findIndex(d => d.id === payload.documentId);
        if (docIndex === -1) {
          return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        data.documents[docIndex].adminApproved = true;
        data.documents[docIndex].approvedBy = payload.approvedBy;
        data.documents[docIndex].approvedAt = new Date().toISOString();

        data.sharingLog.push({
          id: `log-${Date.now()}`,
          documentId: payload.documentId,
          action: 'approved',
          performedBy: payload.approvedBy,
          performedAt: new Date().toISOString(),
          recipientType: null,
          recipientId: null,
          notes: payload.notes || 'Approved for sharing'
        });

        await writeDocumentsData(data);
        return NextResponse.json({ success: true, document: data.documents[docIndex] });
      }

      case 'revoke-approval': {
        // Admin revokes sharing approval
        const docIndex = data.documents.findIndex(d => d.id === payload.documentId);
        if (docIndex === -1) {
          return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        data.documents[docIndex].adminApproved = false;
        data.documents[docIndex].sharedWithCustomer = false;
        data.documents[docIndex].sharedAt = null;
        data.documents[docIndex].sharedBy = null;

        data.sharingLog.push({
          id: `log-${Date.now()}`,
          documentId: payload.documentId,
          action: 'unshared',
          performedBy: payload.performedBy,
          performedAt: new Date().toISOString(),
          recipientType: null,
          recipientId: null,
          notes: payload.notes || 'Approval revoked'
        });

        await writeDocumentsData(data);
        return NextResponse.json({ success: true, document: data.documents[docIndex] });
      }

      case 'share': {
        // Rep shares document with customer
        const docIndex = data.documents.findIndex(d => d.id === payload.documentId);
        if (docIndex === -1) {
          return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        if (!data.documents[docIndex].adminApproved) {
          return NextResponse.json({ error: 'Document not approved for sharing' }, { status: 403 });
        }

        data.documents[docIndex].sharedWithCustomer = true;
        data.documents[docIndex].sharedAt = new Date().toISOString();
        data.documents[docIndex].sharedBy = payload.sharedBy;
        if (payload.repNotes) {
          data.documents[docIndex].repNotes = payload.repNotes;
        }

        data.sharingLog.push({
          id: `log-${Date.now()}`,
          documentId: payload.documentId,
          action: 'shared',
          performedBy: payload.sharedBy,
          performedAt: new Date().toISOString(),
          recipientType: 'customer',
          recipientId: data.documents[docIndex].customerId,
          notes: payload.repNotes || 'Shared with customer'
        });

        await writeDocumentsData(data);
        return NextResponse.json({ success: true, document: data.documents[docIndex] });
      }

      case 'unshare': {
        // Remove sharing from customer
        const docIndex = data.documents.findIndex(d => d.id === payload.documentId);
        if (docIndex === -1) {
          return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        data.documents[docIndex].sharedWithCustomer = false;
        data.documents[docIndex].sharedAt = null;
        data.documents[docIndex].sharedBy = null;

        data.sharingLog.push({
          id: `log-${Date.now()}`,
          documentId: payload.documentId,
          action: 'unshared',
          performedBy: payload.performedBy,
          performedAt: new Date().toISOString(),
          recipientType: 'customer',
          recipientId: data.documents[docIndex].customerId,
          notes: payload.notes || 'Unshared from customer'
        });

        await writeDocumentsData(data);
        return NextResponse.json({ success: true, document: data.documents[docIndex] });
      }

      case 'set-profile-image': {
        // Set document as job profile image
        const docIndex = data.documents.findIndex(d => d.id === payload.documentId);
        if (docIndex === -1) {
          return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // Remove profile image status from other images in the same job
        data.documents.forEach((doc, idx) => {
          if (doc.jobId === data.documents[docIndex].jobId && doc.type === 'job_image') {
            data.documents[idx].isProfileImage = false;
          }
        });

        // Set this one as profile image
        data.documents[docIndex].isProfileImage = true;

        await writeDocumentsData(data);
        return NextResponse.json({ success: true, document: data.documents[docIndex] });
      }

      case 'update-notes': {
        // Update rep notes on a document
        const docIndex = data.documents.findIndex(d => d.id === payload.documentId);
        if (docIndex === -1) {
          return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        data.documents[docIndex].repNotes = payload.repNotes;

        await writeDocumentsData(data);
        return NextResponse.json({ success: true, document: data.documents[docIndex] });
      }

      case 'bulk-approve': {
        // Bulk approve multiple documents
        const { documentIds, approvedBy, notes } = payload;
        let processed = 0;
        const errors: string[] = [];

        for (const docId of documentIds) {
          const docIndex = data.documents.findIndex(d => d.id === docId);
          if (docIndex === -1) {
            errors.push(`Document ${docId} not found`);
            continue;
          }

          data.documents[docIndex].adminApproved = true;
          data.documents[docIndex].approvedBy = approvedBy;
          data.documents[docIndex].approvedAt = new Date().toISOString();

          data.sharingLog.push({
            id: `log-${Date.now()}-${processed}`,
            documentId: docId,
            action: 'approved',
            performedBy: approvedBy,
            performedAt: new Date().toISOString(),
            recipientType: null,
            recipientId: null,
            notes: notes || 'Bulk approved'
          });

          processed++;
        }

        await writeDocumentsData(data);
        return NextResponse.json({
          success: true,
          processed,
          failed: errors.length,
          errors: errors.length > 0 ? errors : undefined
        });
      }

      case 'bulk-share': {
        // Bulk share multiple documents
        const { documentIds, sharedBy, repNotes } = payload;
        let processed = 0;
        const errors: string[] = [];

        for (const docId of documentIds) {
          const docIndex = data.documents.findIndex(d => d.id === docId);
          if (docIndex === -1) {
            errors.push(`Document ${docId} not found`);
            continue;
          }

          if (!data.documents[docIndex].adminApproved) {
            errors.push(`Document ${docId} not approved for sharing`);
            continue;
          }

          data.documents[docIndex].sharedWithCustomer = true;
          data.documents[docIndex].sharedAt = new Date().toISOString();
          data.documents[docIndex].sharedBy = sharedBy;
          if (repNotes) data.documents[docIndex].repNotes = repNotes;

          data.sharingLog.push({
            id: `log-${Date.now()}-${processed}`,
            documentId: docId,
            action: 'shared',
            performedBy: sharedBy,
            performedAt: new Date().toISOString(),
            recipientType: 'customer',
            recipientId: data.documents[docIndex].customerId,
            notes: repNotes || 'Bulk shared'
          });

          processed++;
        }

        await writeDocumentsData(data);
        return NextResponse.json({
          success: true,
          processed,
          failed: errors.length,
          errors: errors.length > 0 ? errors : undefined
        });
      }

      case 'log-download': {
        // Log when a document is downloaded
        data.sharingLog.push({
          id: `log-${Date.now()}`,
          documentId: payload.documentId,
          action: 'downloaded',
          performedBy: payload.downloadedBy,
          performedAt: new Date().toISOString(),
          recipientType: payload.downloaderType || null,
          recipientId: payload.downloaderId || null,
          notes: 'Document downloaded'
        });

        await writeDocumentsData(data);
        return NextResponse.json({ success: true });
      }

      default:
        return apiError('Invalid action', 400, 'INVALID_ACTION');
    }
  } catch (error) {
    console.error('Documents API POST error:', error);
    return apiError(getErrorMessage(error), 500, 'DOCUMENTS_UPDATE_FAILED');
  }
}

// DELETE - Remove document
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const deletedBy = searchParams.get('deletedBy');

    if (!documentId) {
      return apiError('Document ID required', 400, 'MISSING_DOCUMENT_ID');
    }

    const data = await readDocumentsData();
    const docIndex = data.documents.findIndex(d => d.id === documentId);

    if (docIndex === -1) {
      return apiError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    const deletedDoc = data.documents[docIndex];
    data.documents.splice(docIndex, 1);

    // Log deletion
    data.sharingLog.push({
      id: `log-${Date.now()}`,
      documentId: documentId,
      action: 'deleted',
      performedBy: deletedBy || 'unknown',
      performedAt: new Date().toISOString(),
      recipientType: null,
      recipientId: null,
      notes: `Deleted ${deletedDoc.originalName}`
    });

    await writeDocumentsData(data);
    return NextResponse.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    console.error('Documents API DELETE error:', error);
    return apiError(getErrorMessage(error), 500, 'DOCUMENT_DELETE_FAILED');
  }
}
