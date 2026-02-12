// Job Status Update API Route
// PUT: Update a job's status in Sheets and push the change to JobNimbus.
// This is the canonical endpoint for status transitions on jobs.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { jobSyncService, type JobRecord } from '@/lib/job-sync-service';
import { isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { groupMeService, getGroupMeConfigFromEnv } from '@/lib/groupme-service';

const VALID_STATUSES: JobRecord['jobStatus'][] = [
  'lead', 'estimate', 'contract', 'scheduled', 'in_progress', 'completed', 'cancelled',
];

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { jobId } = await params;

    let body: {
      status: JobRecord['jobStatus'];
      updatedBy?: string;
      notes?: string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    if (!body.status || !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    // Get existing job
    const oldJob = await jobSyncService.getJob(jobId);
    if (!oldJob) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    const oldStatus = oldJob.jobStatus;
    if (oldStatus === body.status) {
      return NextResponse.json({
        success: true,
        data: { jobId, status: body.status, message: 'Status unchanged' },
      });
    }

    // Update status in Sheets
    const updatedFields: Partial<JobRecord> & { jobId: string } = {
      jobId,
      jobStatus: body.status,
    };

    // Auto-set date fields based on status transitions
    const now = new Date().toISOString();
    if (body.status === 'estimate' && !oldJob.estimateDate) {
      updatedFields.estimateDate = now;
    } else if (body.status === 'contract' && !oldJob.contractDate) {
      updatedFields.contractDate = now;
    } else if (body.status === 'scheduled' && !oldJob.scheduledStartDate) {
      updatedFields.scheduledStartDate = now;
    } else if (body.status === 'in_progress' && !oldJob.actualStartDate) {
      updatedFields.actualStartDate = now;
    } else if (body.status === 'completed' && !oldJob.completionDate) {
      updatedFields.completionDate = now;
    }

    if (body.notes) {
      updatedFields.notes = oldJob.notes
        ? `${oldJob.notes}\n[${now}] ${body.updatedBy || 'system'}: ${body.notes}`
        : `[${now}] ${body.updatedBy || 'system'}: ${body.notes}`;
    }

    const job = await jobSyncService.createOrUpdateJob(updatedFields);

    // Push to JobNimbus (non-blocking)
    let jnSyncPromise: Promise<any> | null = null;
    if (isJobNimbusConfigured()) {
      jnSyncPromise = jobSyncService.syncToJobNimbus(jobId).then(syncResult => {
        if (syncResult.success) {
          console.log(`[Job ${jobId}] Status ${oldStatus} -> ${body.status} synced to JN`);
        } else {
          console.warn(`[Job ${jobId}] JN status sync failed: ${syncResult.message}`);
        }
        return syncResult;
      }).catch(err => {
        console.warn(`[Job ${jobId}] JN status sync error:`, err);
        return { success: false, message: String(err) };
      });
    }

    // GroupMe notification (non-blocking)
    try {
      const groupMeConfig = getGroupMeConfigFromEnv();
      if (groupMeConfig.enabled && groupMeConfig.botId && groupMeConfig.notifyOn.jobStatusChange) {
        const notification = groupMeService.createJobStatusNotification({
          jobId: job.jobId,
          jobName: job.jobName || job.jobId,
          customerName: job.customerName || 'Unknown Customer',
          oldStatus: oldStatus || 'New',
          newStatus: body.status,
          updatedBy: body.updatedBy,
        });
        groupMeService.sendNotification(groupMeConfig, notification).catch(() => {});
      }
    } catch {
      // GroupMe notification is non-critical
    }

    // Wait for JN sync result to include in response
    let jnResult = null;
    if (jnSyncPromise) {
      jnResult = await jnSyncPromise;
    }

    return NextResponse.json({
      success: true,
      data: {
        jobId: job.jobId,
        oldStatus,
        newStatus: body.status,
        jobName: job.jobName,
        customerName: job.customerName,
        updatedAt: job.updatedAt,
        jobnimbus: jnResult ? {
          synced: jnResult.success,
          message: jnResult.message,
        } : { synced: false, message: 'JN not configured' },
      },
    });

  } catch (error) {
    console.error('Error updating job status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
