// GET/POST /api/admin/jobnimbus/sync-status
// Sync Dashboard:
// - GET: Last sync time, records synced, sync errors
// - POST: Manual sync trigger

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { isJobNimbusConfigured, jobNimbusService } from '@/lib/jobnimbus-service';
import { jnSyncEngine } from '@/lib/jn-sync-engine';

// GET - Get current sync status
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const syncStatus = jnSyncEngine.getSyncStatus();

    // Get live JN stats
    let jnStats = null;
    if (isJobNimbusConfigured()) {
      try {
        jnStats = await jobNimbusService.getStats();
      } catch (error) {
        console.error('Error fetching JN stats:', error);
      }
    }

    return NextResponse.json({
      success: true,
      isConfigured: syncStatus.isConfigured,
      lastSync: syncStatus.lastSync
        ? {
            timestamp: syncStatus.lastSync.completedAt,
            contactsSynced: syncStatus.lastSync.contactsSynced,
            jobsSynced: syncStatus.lastSync.jobsSynced,
            notesSynced: syncStatus.lastSync.notesSynced,
            duration: syncStatus.lastSync.syncDuration,
            errors: syncStatus.lastSync.errors,
            errorCount: syncStatus.lastSync.errors.length,
          }
        : null,
      jnStats: jnStats
        ? {
            totalContacts: jnStats.contacts,
            totalJobs: jnStats.jobs,
            totalEstimates: jnStats.estimates,
            totalTasks: jnStats.tasks,
          }
        : null,
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get sync status',
      },
      { status: 500 }
    );
  }
}

// POST - Trigger manual sync
export async function POST() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  if (!isJobNimbusConfigured()) {
    return NextResponse.json(
      { success: false, error: 'JobNimbus API not configured' },
      { status: 500 }
    );
  }

  try {
    const syncResult = await jnSyncEngine.runFullSync();

    return NextResponse.json({
      success: true,
      message: 'Sync completed',
      sync: {
        contactsSynced: syncResult.contactsSynced,
        jobsSynced: syncResult.jobsSynced,
        notesSynced: syncResult.notesSynced,
        duration: syncResult.syncDuration,
        errors: syncResult.errors,
        startedAt: syncResult.startedAt,
        completedAt: syncResult.completedAt,
      },
    });
  } catch (error) {
    console.error('Error running sync:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      },
      { status: 500 }
    );
  }
}
