import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { jobSyncService } from '@/lib/job-sync-service';
import { groupMeService, getGroupMeConfigFromEnv } from '@/lib/groupme-service';
import { jnSyncEngine } from '@/lib/jn-sync-engine';
import { isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'get-job': {
        const jobId = searchParams.get('jobId');
        if (!jobId) {
          return apiError('Job ID is required', 400, 'MISSING_JOB_ID');
        }

        const job = await jobSyncService.getJob(jobId);
        if (!job) {
          return apiError('Job not found', 404, 'JOB_NOT_FOUND');
        }

        return apiSuccess({ job });
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

        return apiSuccess({ jobs });
      }

      case 'export-all': {
        const data = await jobSyncService.exportAllJobsData();
        return apiSuccess(data);
      }

      default:
        // Default: list all jobs
        const jobs = await jobSyncService.getJobs();
        return apiSuccess({ jobs });
    }
  } catch (error) {
    console.error('Jobs API GET error:', error);
    return apiError(getErrorMessage(error), 500, 'JOBS_FETCH_FAILED');
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

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

        // Auto-sync new job to JobNimbus (fire-and-forget)
        if (isJobNimbusConfigured()) {
          jobSyncService.syncToJobNimbus(jobId).then(syncResult => {
            if (syncResult.success) {
              console.log(`[Job ${jobId}] Auto-synced to JN: ${syncResult.message}`);
            } else {
              console.warn(`[Job ${jobId}] JN auto-sync failed: ${syncResult.message}`);
            }
          }).catch(err => {
            console.warn(`[Job ${jobId}] JN auto-sync error:`, err);
          });
        }

        return apiSuccess({ job });
      }

      case 'update-job': {
        if (!data.jobId) {
          return apiError('Job ID is required', 400, 'MISSING_JOB_ID');
        }

        // Get old job status for comparison
        const oldJob = await jobSyncService.getJob(data.jobId);
        const oldStatus = oldJob?.jobStatus;

        const job = await jobSyncService.createOrUpdateJob(data);

        // Send GroupMe notification if status changed
        if (job && data.jobStatus && oldStatus !== data.jobStatus) {
          try {
            const groupMeConfig = getGroupMeConfigFromEnv();
            if (groupMeConfig.enabled && groupMeConfig.botId && groupMeConfig.notifyOn.jobStatusChange) {
              const notification = groupMeService.createJobStatusNotification({
                jobId: job.jobId,
                jobName: job.jobName || job.jobId,
                customerName: job.customerName || 'Unknown Customer',
                oldStatus: oldStatus || 'New',
                newStatus: data.jobStatus,
                updatedBy: data.updatedBy,
              });
              await groupMeService.sendNotification(groupMeConfig, notification);
            }
          } catch (notifyError) {
            console.error('Failed to send job status notification:', notifyError);
          }

          // Push status change to JobNimbus (fire-and-forget)
          if (isJobNimbusConfigured()) {
            jobSyncService.syncToJobNimbus(data.jobId).then(syncResult => {
              if (syncResult.success) {
                console.log(`[Job ${data.jobId}] Status change synced to JN: ${oldStatus} -> ${data.jobStatus}`);
              } else {
                console.warn(`[Job ${data.jobId}] JN status sync failed: ${syncResult.message}`);
              }
            }).catch(err => {
              console.warn(`[Job ${data.jobId}] JN status sync error:`, err);
            });
          }
        }

        return apiSuccess({ job });
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
          return apiError('Job not found', 404, 'JOB_NOT_FOUND');
        }

        return apiSuccess({ job });
      }

      case 'sync-to-jobnimbus': {
        const result = await jobSyncService.syncToJobNimbus(data.jobId);
        if (!result.success) {
          return apiError(result.message || 'JobNimbus sync failed', 502, 'JN_SYNC_FAILED');
        }
        return apiSuccess({ result });
      }

      case 'sync-all-jobnimbus': {
        const results = await jobSyncService.syncAllPendingToJobNimbus();
        return apiSuccess({
          totalSynced: results.filter(r => r.success).length,
          totalFailed: results.filter(r => !r.success).length,
          results
        });
      }

      default:
        return apiError('Invalid action', 400, 'INVALID_ACTION');
    }
  } catch (error) {
    console.error('Jobs API POST error:', error);
    return apiError(getErrorMessage(error), 500, 'JOBS_UPDATE_FAILED');
  }
}
