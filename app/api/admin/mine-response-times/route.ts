// Admin Mine Response Times API
// POST: Trigger JN historical response time mining
// GET: Retrieve stored response time data

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { jnResponseMiner } from '@/lib/jn-response-miner';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    // This is a long-running operation (2-5 minutes)
    // Run in background and return immediately
    const resultPromise = jnResponseMiner.mineResponseTimes();

    // Wait up to 10 seconds for quick results, otherwise return pending
    const timeoutPromise = new Promise<null>(resolve =>
      setTimeout(() => resolve(null), 10000)
    );

    const result = await Promise.race([resultPromise, timeoutPromise]);

    if (result) {
      return NextResponse.json({
        success: true,
        status: 'complete',
        data: {
          repStats: result.repStats,
          totalJobsFetched: result.totalJobsFetched,
          totalJobsWithNotes: result.totalJobsWithNotes,
          totalOfficeAssigned: result.totalOfficeAssigned,
          totalWithRepResponse: result.totalWithRepResponse,
          durationMs: result.durationMs,
          errorCount: result.errors.length,
          errors: result.errors.slice(0, 5),
        },
      });
    }

    // Still running — let it continue in the background
    resultPromise.then(r => {
      console.log(`[MineResponseTimes] Background mining complete: ${r.repStats.length} reps, ${r.totalWithRepResponse} data points`);
    }).catch(err => {
      console.error('[MineResponseTimes] Background mining failed:', err);
    });

    return NextResponse.json({
      success: true,
      status: 'running',
      message: 'Mining started in background. Check back in a few minutes or call GET to retrieve results.',
    });
  } catch (error) {
    console.error('Error mining response times:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const storedTimes = await jnResponseMiner.getStoredResponseTimes();

    return NextResponse.json({
      success: true,
      data: {
        repStats: storedTimes,
        count: storedTimes.length,
        lastMinedAt: storedTimes.length > 0 ? storedTimes[0].lastMinedAt : null,
      },
    });
  } catch (error) {
    console.error('Error fetching stored response times:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
