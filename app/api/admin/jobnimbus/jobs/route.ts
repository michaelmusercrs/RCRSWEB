import { NextResponse } from 'next/server';
import { jobNimbusService, isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { requireAdmin } from '@/lib/auth-service';

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

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
  const jobId = searchParams.get('jobId');
  const contactId = searchParams.get('contactId');
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    // Get specific job by ID
    if (jobId) {
      const job = await jobNimbusService.getJob(jobId);
      return NextResponse.json({
        success: true,
        job: {
          jnid: job.jnid,
          number: job.number,
          name: job.name,
          description: job.description,
          status: job.status,
          phase: jobNimbusService.mapStatusToPhase(job.status),
          salesRep: job.sales_rep_name,
          contactId: job.primary?.jnid,
          address: [
            job.address_line1,
            job.address_line2,
            job.city,
            job.state_text,
            job.zip,
          ].filter(Boolean).join(', '),
          startDate: job.date_start ? new Date(job.date_start * 1000).toISOString() : null,
          endDate: job.date_end ? new Date(job.date_end * 1000).toISOString() : null,
          createdAt: job.created_at ? new Date(job.created_at * 1000).toISOString() : null,
          updatedAt: job.updated_at ? new Date(job.updated_at * 1000).toISOString() : null,
        },
      });
    }

    // Get jobs for specific contact
    if (contactId) {
      const jobs = await jobNimbusService.getJobsForContact(contactId);
      return NextResponse.json({
        success: true,
        contactId,
        count: jobs.length,
        jobs: jobs.map(j => ({
          jnid: j.jnid,
          number: j.number,
          name: j.name,
          status: j.status,
          phase: jobNimbusService.mapStatusToPhase(j.status),
          address: [j.address_line1, j.city, j.state_text, j.zip].filter(Boolean).join(', '),
          startDate: j.date_start ? new Date(j.date_start * 1000).toISOString() : null,
          endDate: j.date_end ? new Date(j.date_end * 1000).toISOString() : null,
        })),
      });
    }

    // Get all jobs with pagination
    const result = await jobNimbusService.getJobs({ limit, offset });

    return NextResponse.json({
      success: true,
      count: result.count,
      jobs: result.results.map(j => ({
        jnid: j.jnid,
        number: j.number,
        name: j.name,
        status: j.status,
        phase: jobNimbusService.mapStatusToPhase(j.status),
        salesRep: j.sales_rep_name,
        contactId: j.primary?.jnid,
        address: [j.address_line1, j.city, j.state_text, j.zip].filter(Boolean).join(', '),
        startDate: j.date_start ? new Date(j.date_start * 1000).toISOString() : null,
        endDate: j.date_end ? new Date(j.date_end * 1000).toISOString() : null,
        createdAt: j.created_at ? new Date(j.created_at * 1000).toISOString() : null,
      })),
      pagination: {
        limit,
        offset,
        total: result.count,
        hasMore: offset + result.results.length < result.count,
      },
    });
  } catch (error) {
    console.error('Jobs API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch jobs',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
