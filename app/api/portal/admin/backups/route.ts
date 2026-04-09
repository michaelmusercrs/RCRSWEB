/**
 * Admin Backups API
 *
 * GET: List available Google Sheets backups from Vercel Blob storage.
 * Returns backup dates with metadata from manifest files.
 *
 * Auth: owner or admin only (via requireAdmin).
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  // Require admin/owner auth
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const { list } = await import('@vercel/blob');

    // List all manifest files to find backup dates
    const manifestBlobs = await list({ prefix: 'backups/' });

    // Filter to only manifest.json files and fetch their contents
    const manifests = manifestBlobs.blobs.filter((b) =>
      b.pathname.endsWith('/manifest.json'),
    );

    // Sort by date descending (newest first)
    manifests.sort((a, b) => {
      // Extract date from path: backups/YYYY-MM-DD/manifest.json
      const dateA = a.pathname.split('/')[1] || '';
      const dateB = b.pathname.split('/')[1] || '';
      return dateB.localeCompare(dateA);
    });

    // Fetch manifest content for each backup (limit to last 30 to avoid timeout)
    const backups = [];
    const manifestsToFetch = manifests.slice(0, 30);

    for (const manifest of manifestsToFetch) {
      try {
        const res = await fetch(manifest.url, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          backups.push({
            date: data.date,
            timestamp: data.timestamp,
            elapsedSeconds: data.elapsedSeconds,
            blobUrl: manifest.url,
            blobSize: manifest.size,
            uploadedAt: manifest.uploadedAt,
            totals: data.totals,
            sheets: {
              master: data.sheets?.master
                ? {
                    title: data.sheets.master.sheetTitle,
                    tabCount: data.sheets.master.tabCount,
                    successCount: data.sheets.master.successCount,
                    errorCount: data.sheets.master.errorCount,
                    totalRows: data.sheets.master.totalRows,
                  }
                : null,
              meetings: data.sheets?.meetings
                ? {
                    title: data.sheets.meetings.sheetTitle,
                    tabCount: data.sheets.meetings.tabCount,
                    successCount: data.sheets.meetings.successCount,
                    errorCount: data.sheets.meetings.errorCount,
                    totalRows: data.sheets.meetings.totalRows,
                  }
                : null,
            },
          });
        }
      } catch {
        // Skip manifests that can't be fetched
        backups.push({
          date: manifest.pathname.split('/')[1] || 'unknown',
          timestamp: manifest.uploadedAt,
          blobUrl: manifest.url,
          blobSize: manifest.size,
          uploadedAt: manifest.uploadedAt,
          totals: null,
          sheets: null,
          error: 'Could not read manifest',
        });
      }
    }

    return NextResponse.json({
      success: true,
      count: backups.length,
      totalAvailable: manifests.length,
      backups,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[admin/backups] Failed to list backups:', message);

    return NextResponse.json(
      { success: false, error: `Failed to list backups: ${message}` },
      { status: 500 },
    );
  }
}
