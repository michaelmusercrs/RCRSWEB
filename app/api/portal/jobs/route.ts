import { NextRequest, NextResponse } from 'next/server';
import { jobSyncService } from '@/lib/job-sync-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'get-job': {
        const jobId = searchParams.get('jobId');
        if (!jobId) {
          return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
        }

        const job = await jobSyncService.getJob(jobId);
        if (!job) {
          return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        return NextResponse.json({ job });
      }

      case 'list-jobs': {
        const status = searchParams.get('status');
        const projectManagerId = searchParams.get('projectManagerId');
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');
        const limit = searchParams.get('limit');

        const jobs = await jobSyncService.getJobs({
          status: status as any || undefined,
          projectManagerId: projectManagerId || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          limit: limit ? parseInt(limit) : undefined
        });

        return NextResponse.json({ jobs });
      }

      case 'export-all': {
        const data = await jobSyncService.exportAllJobsData();
        return NextResponse.json(data);
      }

      default:
        // Default: list all jobs
        const jobs = await jobSyncService.getJobs();
        return NextResponse.json({ jobs });
    }
  } catch (error) {
    console.error('Jobs API GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create-job': {
        const jobId = `JOB-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        const job = await jobSyncService.createOrUpdateJob({
          jobId,
          ...data
        });

        return NextResponse.json({ success: true, job });
      }

      case 'update-job': {
        if (!data.jobId) {
          return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
        }

        const job = await jobSyncService.createOrUpdateJob(data);
        return NextResponse.json({ success: true, job });
      }

      case 'update-from-ticket': {
        const job = await jobSyncService.updateJobFromTicket(data.jobId, {
          ticketId: data.ticketId,
          ticketType: data.ticketType,
          materialCost: data.materialCost,
          materialCharge: data.materialCharge,
          photoIds: data.photoIds,
          billingId: data.billingId
        });

        if (!job) {
          return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, job });
      }

      case 'sync-to-jobnimbus': {
        const result = await jobSyncService.syncToJobNimbus(data.jobId);
        return NextResponse.json({ success: result.success, result });
      }

      case 'sync-all-jobnimbus': {
        const results = await jobSyncService.syncAllPendingToJobNimbus();
        return NextResponse.json({
          success: true,
          totalSynced: results.filter(r => r.success).length,
          totalFailed: results.filter(r => !r.success).length,
          results
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Jobs API POST error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
