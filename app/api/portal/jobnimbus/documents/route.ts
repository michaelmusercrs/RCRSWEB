// GET /api/portal/jobnimbus/documents
// Get documents/attachments from JobNimbus for a contact or job

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { jnSyncEngine } from '@/lib/jn-sync-engine';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  if (!isJobNimbusConfigured()) {
    return NextResponse.json(
      { success: false, error: 'JobNimbus API not configured' },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const contactJnid = searchParams.get('contactId');
    const jobJnid = searchParams.get('jobId');

    if (!contactJnid && !jobJnid) {
      return NextResponse.json(
        { success: false, error: 'contactId or jobId is required' },
        { status: 400 }
      );
    }

    let documents;
    if (jobJnid) {
      documents = await jnSyncEngine.getDocumentsForJob(jobJnid);
    } else {
      documents = await jnSyncEngine.getDocuments(contactJnid!);
    }

    // Group by content type
    const grouped = {
      images: documents.filter(d =>
        d.contentType.startsWith('image/')
      ),
      pdfs: documents.filter(d =>
        d.contentType === 'application/pdf'
      ),
      other: documents.filter(d =>
        !d.contentType.startsWith('image/') && d.contentType !== 'application/pdf'
      ),
    };

    return NextResponse.json({
      success: true,
      count: documents.length,
      documents,
      grouped,
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch documents',
      },
      { status: 500 }
    );
  }
}
