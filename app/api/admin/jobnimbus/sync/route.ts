import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { jnSyncEngine } from '@/lib/jn-sync-engine';

export async function POST() {
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

  try {
    const syncResult = await jnSyncEngine.runFullSync();

    return NextResponse.json({
      success: true,
      message: 'Sync completed successfully',
      syncedContacts: syncResult.contactsSynced,
      syncedJobs: syncResult.jobsSynced,
      syncedNotes: syncResult.notesSynced,
      duration: syncResult.syncDuration,
      errors: syncResult.errors,
      timestamp: syncResult.completedAt,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { success: false, error: 'Sync failed. Please check your API configuration.' },
      { status: 500 }
    );
  }
}

// GET - Get sync status
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  const syncStatus = jnSyncEngine.getSyncStatus();

  return NextResponse.json({
    success: true,
    isConfigured: syncStatus.isConfigured,
    lastSync: syncStatus.lastSync,
  });
}
