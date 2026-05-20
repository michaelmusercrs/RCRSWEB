import { NextResponse } from 'next/server';
import { jobNimbusService, isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { requireAdmin } from '@/lib/auth-service';
import { viewerForRole } from '@/lib/jn-redact';

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  // Admin-gated route — derive viewer from role (admin/owner => sees cost).
  const viewer = viewerForRole(auth.user.role, { email: auth.user.email, userId: auth.user.userId });

  if (!isJobNimbusConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: 'JobNimbus API key not configured',
        message: 'Please set JOBNIMBUS_API_KEY in your .env.local file'
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get('contactId');
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    if (contactId) {
      // Get estimates for specific contact
      const estimates = await jobNimbusService.getEstimatesForContact(contactId, viewer);
      return NextResponse.json({
        success: true,
        contactId,
        count: estimates.length,
        estimates: estimates.map(e => ({
          jnid: e.jnid,
          number: e.number,
          status: e.status,
          amount: e.amount,
          tax: e.tax,
          total: e.total,
          description: e.description,
          pdfUrl: e.pdf_url,
          publicUrl: e.public_url,
          createdAt: e.created_at ? new Date(e.created_at * 1000).toISOString() : null,
        })),
      });
    }

    // Get all estimates with pagination
    const result = await jobNimbusService.getEstimates({ limit, offset }, viewer);

    return NextResponse.json({
      success: true,
      count: result.count,
      estimates: result.results.map(e => ({
        jnid: e.jnid,
        number: e.number,
        status: e.status,
        amount: e.amount,
        tax: e.tax,
        total: e.total,
        description: e.description,
        contactId: e.primary?.id,
        jobId: e.related?.jnid,
        pdfUrl: e.pdf_url,
        publicUrl: e.public_url,
        createdAt: e.created_at ? new Date(e.created_at * 1000).toISOString() : null,
      })),
      pagination: {
        limit,
        offset,
        total: result.count,
        hasMore: offset + result.results.length < result.count,
      },
    });
  } catch (error) {
    console.error('Estimates API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch estimates',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
