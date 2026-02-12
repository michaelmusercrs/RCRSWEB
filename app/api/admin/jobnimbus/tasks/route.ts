import { NextResponse } from 'next/server';
import { jobNimbusService, isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { requireAdmin } from '@/lib/auth-service';

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get('contactId');
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    if (contactId) {
      // Get tasks for specific contact
      const tasks = await jobNimbusService.getTasksForContact(contactId);
      return NextResponse.json({
        success: true,
        contactId,
        count: tasks.length,
        tasks: tasks.map(t => ({
          jnid: t.jnid,
          title: t.title,
          description: t.description,
          type: t.type,
          status: t.status,
          startDate: t.date_start ? new Date(t.date_start * 1000).toISOString() : null,
          endDate: t.date_end ? new Date(t.date_end * 1000).toISOString() : null,
          assignedTo: t.assigned_to,
        })),
      });
    }

    // Get all tasks with pagination
    const result = await jobNimbusService.getTasks({ limit, offset });

    return NextResponse.json({
      success: true,
      count: result.count,
      tasks: result.results.map(t => ({
        jnid: t.jnid,
        title: t.title,
        description: t.description,
        type: t.type,
        status: t.status,
        contactId: t.primary?.jnid,
        startDate: t.date_start ? new Date(t.date_start * 1000).toISOString() : null,
        endDate: t.date_end ? new Date(t.date_end * 1000).toISOString() : null,
        assignedTo: t.assigned_to,
      })),
      pagination: {
        limit,
        offset,
        total: result.count,
        hasMore: offset + result.results.length < result.count,
      },
    });
  } catch (error) {
    console.error('Tasks API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch tasks',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
