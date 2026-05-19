import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { jobNimbusService, isJobNimbusConfigured, JobNimbusError } from '@/lib/jobnimbus-service';

// GET /api/jobnimbus/job/[id] - Fetch live job details from JobNimbus
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
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

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const includeContact = searchParams.get('includeContact') === 'true';
  const includeEstimates = searchParams.get('includeEstimates') === 'true';
  const includeTasks = searchParams.get('includeTasks') === 'true';
  const includeAll = searchParams.get('includeAll') === 'true';

  try {
    // Get the job details
    const job = await jobNimbusService.getJob(id);

    if (!job) {
      return NextResponse.json(
        {
          success: false,
          error: 'Job not found',
          message: `No job found with ID: ${id}`
        },
        { status: 404 }
      );
    }

    // Build the response object
    const response: any = {
      success: true,
      job: {
        jnid: job.jnid,
        number: job.number,
        name: job.name,
        description: job.description,
        status: job.status,
        phase: jobNimbusService.mapStatusToPhase(job.status),
        salesRep: job.sales_rep_name,
        salesRepId: job.sales_rep,
        contactId: job.primary?.id,
        address: {
          full: [job.address_line1, job.address_line2, job.city, job.state_text, job.zip]
            .filter(Boolean)
            .join(', '),
          line1: job.address_line1,
          line2: job.address_line2,
          city: job.city,
          state: job.state_text,
          zip: job.zip,
        },
        dates: {
          start: job.date_start ? new Date(job.date_start * 1000).toISOString() : null,
          end: job.date_end ? new Date(job.date_end * 1000).toISOString() : null,
          created: job.created_at ? new Date(job.created_at * 1000).toISOString() : null,
          updated: job.updated_at ? new Date(job.updated_at * 1000).toISOString() : null,
        },
      },
    };

    // Optionally include related contact info
    if ((includeContact || includeAll) && job.primary?.id) {
      try {
        const contact = await jobNimbusService.getContact(job.primary.id);
        response.contact = {
          jnid: contact.jnid,
          displayName: jobNimbusService.getContactName(contact),
          firstName: contact.first_name,
          lastName: contact.last_name,
          email: contact.email,
          phone: jobNimbusService.getContactPhone(contact),
          mobilePhone: contact.mobile_phone,
          homePhone: contact.home_phone,
          workPhone: contact.work_phone,
          address: {
            full: jobNimbusService.formatAddress(contact),
            line1: contact.address_line1,
            line2: contact.address_line2,
            city: contact.city,
            state: contact.state_text,
            zip: contact.zip,
          },
          status: contact.status,
          source: contact.source,
        };
      } catch (e) {
        console.error('Error fetching contact for job:', e);
        response.contact = null;
        response.contactError = 'Failed to fetch contact details';
      }
    }

    // Optionally include estimates
    if ((includeEstimates || includeAll) && job.primary?.id) {
      try {
        const estimates = await jobNimbusService.getEstimatesForContact(job.primary.id);
        response.estimates = estimates.map(e => ({
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
        }));
      } catch (e) {
        console.error('Error fetching estimates for job:', e);
        response.estimates = [];
        response.estimatesError = 'Failed to fetch estimates';
      }
    }

    // Optionally include tasks/appointments
    if ((includeTasks || includeAll) && job.primary?.id) {
      try {
        const tasks = await jobNimbusService.getTasksForContact(job.primary.id);
        response.tasks = tasks.map(t => ({
          jnid: t.jnid,
          title: t.title,
          description: t.description,
          type: t.type,
          status: t.status,
          dateStart: t.date_start ? new Date(t.date_start * 1000).toISOString() : null,
          dateEnd: t.date_end ? new Date(t.date_end * 1000).toISOString() : null,
          assignedTo: t.assigned_to,
        }));
      } catch (e) {
        console.error('Error fetching tasks for job:', e);
        response.tasks = [];
        response.tasksError = 'Failed to fetch tasks';
      }
    }

    // Calculate job progress based on status/phase
    const phases = [
      { id: 'lead', progress: 0 },
      { id: 'inspection', progress: 10 },
      { id: 'estimate', progress: 20 },
      { id: 'contract', progress: 30 },
      { id: 'permit', progress: 40 },
      { id: 'materials', progress: 50 },
      { id: 'scheduled', progress: 60 },
      { id: 'in_progress', progress: 75 },
      { id: 'quality_check', progress: 90 },
      { id: 'complete', progress: 100 },
    ];

    const currentPhase = phases.find(p => p.id === response.job.phase);
    const nextPhaseIndex = phases.findIndex(p => p.id === response.job.phase) + 1;
    const nextPhase = phases[nextPhaseIndex] || phases[phases.length - 1];

    response.job.progress = {
      percentage: currentPhase?.progress || 0,
      currentPhase: response.job.phase,
      nextPhase: nextPhase?.id,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('JobNimbus job fetch error:', error);

    if (error instanceof JobNimbusError) {
      if (error.statusCode === 404) {
        return NextResponse.json(
          {
            success: false,
            error: 'Job not found',
            message: `No job found with ID: ${id}`
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: 'JobNimbus API error',
          message: error.message,
          statusCode: error.statusCode,
        },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch job details',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
