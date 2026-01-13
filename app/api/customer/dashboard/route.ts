import { NextResponse } from 'next/server';

const JOBNIMBUS_API_KEY = process.env.JOBNIMBUS_API_KEY;
const JOBNIMBUS_API_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

function mapStatusToPhase(status?: string): string {
  const statusMap: Record<string, string> = {
    'lead': 'lead',
    'new': 'lead',
    'contacted': 'inspection',
    'appointment set': 'inspection',
    'inspected': 'estimate',
    'estimate sent': 'estimate',
    'proposal sent': 'estimate',
    'contract signed': 'contract',
    'permit': 'permit',
    'material ordered': 'materials',
    'scheduled': 'scheduled',
    'in progress': 'in_progress',
    'work in progress': 'in_progress',
    'complete': 'complete',
    'closed': 'complete',
  };
  const normalized = (status || '').toLowerCase();
  return statusMap[normalized] || 'lead';
}

function calculateProgress(phase: string): number {
  const phases = ['lead', 'inspection', 'estimate', 'contract', 'permit', 'materials', 'scheduled', 'in_progress', 'complete'];
  const index = phases.indexOf(phase);
  if (index === -1) return 0;
  return Math.round((index / (phases.length - 1)) * 100);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get('customerId');

  if (!customerId) {
    return NextResponse.json({ success: false, error: 'Customer ID required' }, { status: 400 });
  }

  // Demo mode when API key not configured
  if (!JOBNIMBUS_API_KEY || customerId === 'demo-customer') {
    return NextResponse.json({
      success: true,
      jobs: [
        {
          jnid: 'demo-job-1',
          name: 'Roof Replacement',
          status: 'in_progress',
          phase: 'in_progress',
          progress: 75,
          address: '123 Main St, Hartselle, AL',
          startDate: 'January 10, 2026',
          estimatedCompletion: 'January 15, 2026',
        },
      ],
      appointments: [
        {
          id: 'apt-1',
          title: 'Final Inspection',
          date: 'January 15, 2026',
          time: '10:00 AM',
          type: 'inspection',
          status: 'scheduled',
        },
      ],
      weather: {
        current: { temp: 55, condition: 'Partly Cloudy', icon: 'cloud-sun' },
        forecast: [
          { day: 'Today', high: 55, low: 38, condition: 'Partly Cloudy', workable: true },
          { day: 'Tomorrow', high: 52, low: 35, condition: 'Sunny', workable: true },
          { day: 'Wednesday', high: 48, low: 32, condition: 'Cloudy', workable: true },
          { day: 'Thursday', high: 45, low: 30, condition: 'Rain', workable: false },
          { day: 'Friday', high: 50, low: 34, condition: 'Sunny', workable: true },
        ],
      },
      messages: [
        {
          id: 'msg-1',
          from: 'River City Roofing',
          content: 'Welcome to your customer portal! We\'re excited to work on your project. Feel free to send us any questions here.',
          timestamp: new Date().toISOString(),
          isCustomer: false,
        },
      ],
    });
  }

  try {
    // Fetch jobs for this customer
    const jobsResponse = await fetch(
      `${JOBNIMBUS_API_URL}/jobs?filter=primary.jnid:"${customerId}"`,
      {
        headers: {
          'Authorization': `Bearer ${JOBNIMBUS_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const jobsData = await jobsResponse.json();
    const jobs = (jobsData.results || []).map((job: Record<string, unknown>) => {
      const status = job.status as string;
      const phase = mapStatusToPhase(status);
      return {
        jnid: job.jnid as string,
        name: (job.name as string) || 'Roofing Project',
        status,
        phase,
        progress: calculateProgress(phase),
        address: [
          job.address_line1,
          job.city,
          job.state_text,
          job.zip,
        ].filter(Boolean).join(', ') || 'Address on file',
        startDate: job.date_start ? new Date((job.date_start as number) * 1000).toLocaleDateString() : undefined,
        estimatedCompletion: job.date_end ? new Date((job.date_end as number) * 1000).toLocaleDateString() : undefined,
      };
    });

    // Fetch tasks/appointments
    const tasksResponse = await fetch(
      `${JOBNIMBUS_API_URL}/tasks?filter=primary.jnid:"${customerId}"&sort=-date_start`,
      {
        headers: {
          'Authorization': `Bearer ${JOBNIMBUS_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const tasksData = await tasksResponse.json();
    const appointments = (tasksData.results || []).map((task: Record<string, unknown>) => ({
      id: task.jnid,
      title: task.title || 'Appointment',
      date: task.date_start ? new Date((task.date_start as number) * 1000).toLocaleDateString() : 'TBD',
      time: task.date_start ? new Date((task.date_start as number) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD',
      type: (task.type as string)?.toLowerCase().includes('inspect') ? 'inspection' :
            (task.type as string)?.toLowerCase().includes('install') ? 'installation' : 'followup',
      status: task.status === 'completed' ? 'completed' :
              task.status === 'confirmed' ? 'confirmed' : 'scheduled',
    }));

    // Weather data (would integrate with weather API in production)
    const weather = {
      current: { temp: 55, condition: 'Partly Cloudy', icon: 'cloud-sun' },
      forecast: [
        { day: 'Today', high: 55, low: 38, condition: 'Partly Cloudy', workable: true },
        { day: 'Tomorrow', high: 52, low: 35, condition: 'Sunny', workable: true },
        { day: 'Wednesday', high: 48, low: 32, condition: 'Cloudy', workable: true },
        { day: 'Thursday', high: 45, low: 30, condition: 'Rain', workable: false },
        { day: 'Friday', high: 50, low: 34, condition: 'Sunny', workable: true },
      ],
    };

    return NextResponse.json({
      success: true,
      jobs,
      appointments,
      weather,
      messages: [],
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load dashboard' }, { status: 500 });
  }
}
