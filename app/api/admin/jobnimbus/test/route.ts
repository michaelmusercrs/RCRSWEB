import { NextResponse } from 'next/server';
import { jobNimbusService, isJobNimbusConfigured, getApiStatus } from '@/lib/jobnimbus-service';
import { requireAdmin } from '@/lib/auth-service';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  const apiStatus = getApiStatus();

  if (!isJobNimbusConfigured()) {
    return NextResponse.json({
      success: false,
      configured: false,
      error: 'JobNimbus API key not configured',
      message: 'Please set JOBNIMBUS_API_KEY in your .env.local file',
      apiUrl: apiStatus.apiUrl,
    }, { status: 500 });
  }

  try {
    // Test basic connection
    const connectionTest = await jobNimbusService.testConnection();

    if (!connectionTest.success) {
      return NextResponse.json({
        success: false,
        configured: true,
        error: 'API connection failed',
        message: connectionTest.message,
        apiUrl: apiStatus.apiUrl,
      }, { status: 500 });
    }

    // Get full stats
    const stats = await jobNimbusService.getStats();

    return NextResponse.json({
      success: true,
      configured: true,
      apiUrl: apiStatus.apiUrl,
      message: 'JobNimbus API connection successful',
      stats: {
        totalContacts: stats.contacts,
        totalJobs: stats.jobs,
        totalEstimates: stats.estimates,
        totalTasks: stats.tasks,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('JobNimbus test error:', error);
    return NextResponse.json({
      success: false,
      configured: true,
      error: 'API test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      apiUrl: apiStatus.apiUrl,
    }, { status: 500 });
  }
}
