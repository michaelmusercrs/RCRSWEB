// Job Creation API Route
// POST: Create a new job in Sheets AND sync to JobNimbus in one call.
// This is the canonical endpoint for creating jobs that flow through
// the full pipeline: Sheets -> JN Contact -> JN Job.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { jobSyncService, type JobRecord } from '@/lib/job-sync-service';
import { isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { leadPortalService } from '@/lib/lead-portal-service';

interface CreateJobRequest {
  // Required
  jobName: string;
  customerName: string;
  customerAddress: string;

  // Optional customer info
  customerPhone?: string;
  customerEmail?: string;
  customerCity?: string;
  customerState?: string;
  customerZip?: string;

  // Job config
  jobType?: JobRecord['jobType'];
  jobStatus?: JobRecord['jobStatus'];
  projectManager?: string;
  projectManagerId?: string;
  salesRep?: string;
  contractAmount?: number;
  estimatedMaterialCost?: number;
  notes?: string;

  // Dates
  leadDate?: string;
  estimateDate?: string;
  contractDate?: string;
  scheduledStartDate?: string;

  // Link to existing lead
  leadId?: string;

  // Link to existing JN contact
  jobnimbusContactId?: string;

  // Options
  syncToJN?: boolean; // default true
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    let body: CreateJobRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.jobName || !body.customerName || !body.customerAddress) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          required: ['jobName', 'customerName', 'customerAddress'],
        },
        { status: 400 }
      );
    }

    // Generate job ID
    const jobId = `JOB-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // If linked to a lead, pull in any missing customer info
    let leadJnContactId = body.jobnimbusContactId;
    if (body.leadId && !leadJnContactId) {
      try {
        const lead = await leadPortalService.getLeadById(body.leadId);
        if (lead) {
          leadJnContactId = lead.jobnimbusContactId || undefined;
          if (!body.customerEmail) body.customerEmail = lead.customerEmail;
          if (!body.customerPhone) body.customerPhone = lead.customerPhone;
          if (!body.salesRep) body.salesRep = lead.salesRepName;
        }
      } catch {
        // Lead lookup is best-effort
      }
    }

    // Step 1: Create job in Google Sheets
    const job = await jobSyncService.createOrUpdateJob({
      jobId,
      jobNimbusId: leadJnContactId, // Link to JN contact if we have one
      jobName: body.jobName,
      jobType: body.jobType || 'residential',
      jobStatus: body.jobStatus || 'lead',
      customerName: body.customerName,
      customerPhone: body.customerPhone || '',
      customerEmail: body.customerEmail || '',
      customerAddress: body.customerAddress,
      customerCity: body.customerCity || '',
      customerState: body.customerState || 'AL',
      customerZip: body.customerZip || '',
      projectManager: body.projectManager || '',
      projectManagerId: body.projectManagerId || '',
      salesRep: body.salesRep,
      contractAmount: body.contractAmount,
      estimatedMaterialCost: body.estimatedMaterialCost,
      leadDate: body.leadDate || new Date().toISOString(),
      estimateDate: body.estimateDate,
      contractDate: body.contractDate,
      scheduledStartDate: body.scheduledStartDate,
      notes: body.notes || '',
    });

    // Step 2: Sync to JobNimbus (creates contact + job)
    let jnSync = null;
    const shouldSync = body.syncToJN !== false && isJobNimbusConfigured();

    if (shouldSync) {
      try {
        jnSync = await jobSyncService.syncToJobNimbus(jobId);
      } catch (err) {
        console.warn(`[Job ${jobId}] JN sync failed:`, err);
        jnSync = {
          success: false,
          jobId,
          action: 'skipped' as const,
          message: err instanceof Error ? err.message : 'Sync failed',
          timestamp: new Date().toISOString(),
        };
      }
    }

    // Step 3: If linked to a lead, update that lead's status
    if (body.leadId) {
      try {
        const newLeadStatus = body.jobStatus === 'estimate' ? 'estimate_sent'
          : body.jobStatus === 'contract' ? 'closed_won'
          : body.jobStatus === 'scheduled' ? 'inspection_scheduled'
          : undefined;
        if (newLeadStatus) {
          await leadPortalService.updateLeadStatus(body.leadId, newLeadStatus as any, 'system');
        }
      } catch {
        // Lead status update is best-effort
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        jobId: job.jobId,
        jobName: job.jobName,
        jobStatus: job.jobStatus,
        customerName: job.customerName,
        createdAt: job.createdAt,
        jobnimbus: jnSync ? {
          synced: jnSync.success,
          action: jnSync.action,
          jnJobId: jnSync.jobNimbusId,
          message: jnSync.message,
        } : {
          synced: false,
          action: 'skipped',
          message: shouldSync ? 'JN not configured' : 'Sync disabled',
        },
      },
    });

  } catch (error) {
    console.error('Error creating job:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
