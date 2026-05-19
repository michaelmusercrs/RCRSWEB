import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { weatherService } from '@/lib/weather-service';
import { teamMembers } from '@/lib/teamData';
import { getReviewsForMember, generalReviews } from '@/lib/reviewsData';
import { leadPortalService } from '@/lib/lead-portal-service';
import { customerPortalService } from '@/lib/customer-portal-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JOBNIMBUS_API_KEY = process.env.JOBNIMBUS_API_KEY;
const JOBNIMBUS_API_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

// JN requires the `filter` query param to be a JSON-encoded Elasticsearch
// bool query. The old `filter=primary.jnid:"X"` string form returns HTTP
// 400 "Filter syntax error: not valid JSON". Verified 2026-05-19.
function jnFilterByPrimaryId(customerId: string): string {
  const filter = { must: [{ term: { 'primary.id': customerId } }] };
  return `filter=${encodeURIComponent(JSON.stringify(filter))}`;
}

// Map JobNimbus status to job phase
function mapStatusToPhase(status?: string): string {
  const statusMap: Record<string, string> = {
    'lead': 'lead',
    'new': 'lead',
    'new lead': 'lead',
    'contacted': 'inspection',
    'appointment set': 'inspection',
    'inspection scheduled': 'inspection',
    'inspected': 'estimate',
    'estimate sent': 'estimate',
    'proposal sent': 'estimate',
    'estimate approved': 'contract',
    'contract signed': 'contract',
    'sold': 'contract',
    'permit': 'permit',
    'permit submitted': 'permit',
    'permit approved': 'permit',
    'material ordered': 'materials',
    'materials ordered': 'materials',
    'scheduled': 'scheduled',
    'install scheduled': 'scheduled',
    'in progress': 'in_progress',
    'work in progress': 'in_progress',
    'installing': 'in_progress',
    'quality check': 'quality_check',
    'final inspection': 'quality_check',
    'complete': 'complete',
    'closed': 'complete',
    'completed': 'complete',
    'finished': 'complete',
  };
  const normalized = (status || '').toLowerCase().trim();
  return statusMap[normalized] || 'lead';
}

// Calculate progress percentage based on phase
function calculateProgress(phase: string): number {
  const phases: Record<string, number> = {
    'lead': 5,
    'inspection': 15,
    'estimate': 25,
    'contract': 35,
    'permit': 45,
    'materials': 55,
    'scheduled': 65,
    'in_progress': 80,
    'quality_check': 90,
    'complete': 100,
  };
  return phases[phase] || 0;
}

// Get sales rep info from team data
function getSalesRepInfo(salesRepName?: string) {
  // Try to find by name first
  if (salesRepName) {
    const nameLower = salesRepName.toLowerCase();
    const member = teamMembers.find(m =>
      m.name.toLowerCase().includes(nameLower) ||
      nameLower.includes(m.name.toLowerCase().split(' ')[0])
    );
    if (member) {
      const reviews = getReviewsForMember(member.slug, 3);
      return {
        slug: member.slug,
        name: member.name,
        position: member.position,
        phone: member.phone,
        email: member.email,
        bio: member.bio,
        tagline: member.tagline,
        profileImage: member.profileImage || '/uploads/placeholder-profile.jpg',
        truckImage: member.truckImage || null,
        facebook: member.facebook,
        instagram: member.instagram,
        tiktok: member.tiktok,
        linkedin: member.linkedin,
        keyStrengths: member.keyStrengths || [],
        reviews: reviews.map(r => ({
          id: r.id,
          name: r.name,
          rating: r.rating,
          text: r.text,
          date: r.date,
          source: r.source,
        })),
        averageRating: reviews.length > 0
          ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
          : 5.0,
      };
    }
  }

  // Default to company info
  return {
    slug: 'company',
    name: 'River City Roofing Solutions',
    position: 'Your Roofing Team',
    phone: '256-274-8530',
    email: 'contact@rcrsal.com',
    bio: 'River City Roofing Solutions is a family-owned roofing company serving North Alabama since 2018. We specialize in storm damage repairs, insurance claims, and complete roof replacements.',
    tagline: 'Family-Owned. Quality-Driven. Community-Focused.',
    profileImage: '/logo.png',
    truckImage: null,
    facebook: 'https://www.facebook.com/RiverCityRoofingSolutions',
    instagram: 'https://www.instagram.com/rivercityroofingsolutions/',
    tiktok: 'https://www.tiktok.com/@river.city.roofin',
    linkedin: null,
    keyStrengths: [
      'Expert insurance claim navigation',
      'Quality craftsmanship',
      'Transparent communication',
      'Family values',
    ],
    reviews: generalReviews.slice(0, 3).map(r => ({
      id: r.id,
      name: r.name,
      rating: r.rating,
      text: r.text,
      date: r.date,
      source: r.source,
    })),
    averageRating: 5.0,
  };
}

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const { searchParams } = new URL(request.url);
  const requestedCustomerId = searchParams.get('customerId');
  const customerAddress = searchParams.get('address') || 'Hartselle, AL';

  if (!requestedCustomerId) {
    return NextResponse.json({ success: false, error: 'Customer ID required' }, { status: 400 });
  }

  // SECURITY: Prevent horizontal privilege escalation.
  // Customers can ONLY access their own data. The authenticated user's ID (from JWT)
  // must match the requested customerId. Admins/owners can access any customer.
  if (auth.user.role === 'customer' && auth.user.userId !== requestedCustomerId) {
    console.warn(
      `SECURITY: Horizontal privilege escalation attempt. ` +
      `User ${auth.user.userId} tried to access customer ${requestedCustomerId}`
    );
    return NextResponse.json(
      { success: false, error: 'Access denied: you can only view your own data' },
      { status: 403 }
    );
  }
  const customerId = requestedCustomerId;

  // Always try to get real weather data
  let weatherData = null;
  let hailReports: Awaited<ReturnType<typeof weatherService.getHailReports>> = [];

  try {
    weatherData = await weatherService.getWeather(customerAddress);
    hailReports = await weatherService.getHailReports(customerAddress, 30, 50);
  } catch (error) {
    console.error('Weather fetch error:', error);
  }

  // Require API key - no demo mode
  if (!JOBNIMBUS_API_KEY) {
    return NextResponse.json(
      {
        success: false,
        error: 'Customer portal is not configured',
        message: 'Please contact River City Roofing at 256-274-8530 for assistance.'
      },
      { status: 500 }
    );
  }

  try {
    // Fetch customer contact info first
    const contactResponse = await fetch(
      `${JOBNIMBUS_API_URL}/contacts/${customerId}`,
      {
        headers: {
          'Authorization': `Bearer ${JOBNIMBUS_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    let contactData: Record<string, unknown> = {};
    if (contactResponse.ok) {
      contactData = await contactResponse.json();
    }

    const address = [
      contactData.address_line1,
      contactData.city,
      contactData.state_text,
      contactData.zip,
    ].filter(Boolean).join(', ') || customerAddress;

    // Get sales rep info from contact
    const salesRep = getSalesRepInfo(contactData.sales_rep_name as string);

    // Fetch jobs for this customer
    const jobsResponse = await fetch(
      `${JOBNIMBUS_API_URL}/jobs?${jnFilterByPrimaryId(customerId)}`,
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
        ].filter(Boolean).join(', ') || address,
        startDate: job.date_start ? new Date((job.date_start as number) * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : undefined,
        estimatedCompletion: job.date_end ? new Date((job.date_end as number) * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : undefined,
        description: job.description as string || '',
        materials: (job as Record<string, unknown>).material_type as string || '',
        warrantyYears: 50,
      };
    });

    // Fetch tasks/appointments
    const tasksResponse = await fetch(
      `${JOBNIMBUS_API_URL}/tasks?${jnFilterByPrimaryId(customerId)}&sort=-date_start`,
      {
        headers: {
          'Authorization': `Bearer ${JOBNIMBUS_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const tasksData = await tasksResponse.json();
    const appointments = (tasksData.results || []).map((task: Record<string, unknown>) => {
      const taskType = (task.type as string)?.toLowerCase() || '';
      let type: 'inspection' | 'installation' | 'followup' = 'followup';
      if (taskType.includes('inspect')) type = 'inspection';
      else if (taskType.includes('install')) type = 'installation';

      return {
        id: task.jnid as string,
        title: (task.title as string) || 'Appointment',
        date: task.date_start ? new Date((task.date_start as number) * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD',
        time: task.date_start ? new Date((task.date_start as number) * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'TBD',
        type,
        status: task.status === 'completed' ? 'completed' :
                task.status === 'confirmed' ? 'confirmed' : 'scheduled',
        description: task.description as string || '',
      };
    });

    // Fetch estimates for documents
    const estimatesResponse = await fetch(
      `${JOBNIMBUS_API_URL}/estimates?${jnFilterByPrimaryId(customerId)}`,
      {
        headers: {
          'Authorization': `Bearer ${JOBNIMBUS_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const estimatesData = await estimatesResponse.json();
    const documents: Array<{
      id: string;
      title: string;
      type: string;
      fileUrl: string;
      uploadedAt: string;
      description: string;
      amount?: number;
    }> = (estimatesData.results || []).map((est: Record<string, unknown>) => ({
      id: est.jnid as string,
      title: `Estimate #${est.number || 'N/A'}`,
      type: 'estimate',
      fileUrl: est.public_url as string || est.pdf_url as string || '#',
      uploadedAt: est.created_at ? new Date((est.created_at as number) * 1000).toISOString() : new Date().toISOString(),
      description: est.description as string || 'Project estimate',
      amount: est.total as number || 0,
    }));

    // Fetch invoices
    const invoicesResponse = await fetch(
      `${JOBNIMBUS_API_URL}/invoices?${jnFilterByPrimaryId(customerId)}`,
      {
        headers: {
          'Authorization': `Bearer ${JOBNIMBUS_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (invoicesResponse.ok) {
      const invoicesData = await invoicesResponse.json();
      (invoicesData.results || []).forEach((inv: Record<string, unknown>) => {
        documents.push({
          id: inv.jnid as string,
          title: `Invoice #${inv.number || 'N/A'}`,
          type: 'invoice',
          fileUrl: inv.public_url as string || inv.pdf_url as string || '#',
          uploadedAt: inv.created_at ? new Date((inv.created_at as number) * 1000).toISOString() : new Date().toISOString(),
          description: inv.description as string || 'Project invoice',
          amount: inv.total as number || 0,
        });
      });
    }

    // Fetch notes/messages
    const notesResponse = await fetch(
      // JN stores notes inside the /activities collection — there is no /notes endpoint.
      `${JOBNIMBUS_API_URL}/activities?${jnFilterByPrimaryId(customerId)}&sort=-created_at&limit=50`,
      {
        headers: {
          'Authorization': `Bearer ${JOBNIMBUS_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    let messages: Array<{ id: string; from: string; content: string; timestamp: string; isCustomer: boolean }> = [];
    if (notesResponse.ok) {
      const notesData = await notesResponse.json();
      messages = (notesData.results || [])
        .filter((note: Record<string, unknown>) => {
          const content = note.content as string;
          return content?.includes('[Customer Portal') || content?.includes('[Staff Reply');
        })
        .map((note: Record<string, unknown>) => {
          const content = note.content as string;
          const isCustomer = content?.includes('[Customer Portal');
          const cleanContent = content
            ?.replace('[Customer Portal Message]', '')
            .replace('[Staff Reply]', '')
            .trim();

          return {
            id: note.jnid as string,
            from: isCustomer ? 'You' : salesRep.name,
            content: cleanContent,
            timestamp: note.created_at ? new Date((note.created_at as number) * 1000).toISOString() : new Date().toISOString(),
            isCustomer,
          };
        });
    }

    // Add welcome message if no messages exist
    if (messages.length === 0) {
      messages.push({
        id: 'welcome',
        from: salesRep.name,
        content: `Welcome to your customer portal! I'm ${salesRep.name.split(' ')[0]}, your dedicated roofing specialist. Feel free to send me any questions about your project here.`,
        timestamp: new Date().toISOString(),
        isCustomer: false,
      });
    }

    // Get real weather for customer's address
    let finalWeatherData = weatherData;
    if (!finalWeatherData) {
      try {
        finalWeatherData = await weatherService.getWeather(address);
      } catch (e) {
        console.error('Weather error:', e);
      }
    }

    // Get hail reports for customer's area
    let finalHailReports = hailReports;
    if (finalHailReports.length === 0) {
      try {
        finalHailReports = await weatherService.getHailReports(address, 30, 50);
      } catch (e) {
        console.error('Hail reports error:', e);
      }
    }

    // Calculate payment status from invoices
    let paymentStatus = null;
    if (documents.some(d => d.type === 'invoice' || d.type === 'estimate')) {
      const estimates = documents.filter(d => d.type === 'estimate');
      const invoices = documents.filter(d => d.type === 'invoice');
      const total = estimates.reduce((sum, e) => sum + (e.amount || 0), 0) ||
                   invoices.reduce((sum, i) => sum + (i.amount || 0), 0);

      paymentStatus = {
        total,
        paid: 0,
        due: total,
        dueDate: 'Upon completion',
        method: 'Insurance claim or financing available',
      };
    }

    // Resolve a portal token for this customer so the JWT-logged-in dashboard
    // can hit the token-based form endpoints (service request, warranty claim,
    // notification preferences). If no Sheets lead exists yet, create one so
    // the customer's submissions are persisted under a stable ID.
    let portalToken = '';
    try {
      const existingLead = await leadPortalService.getLeadByCustomerId(customerId);
      if (existingLead) {
        portalToken = existingLead.accessToken;
      } else {
        const portalAccess = customerPortalService.createPortalAccess({
          customerName: (contactData.display_name as string) ||
            `${contactData.first_name || ''} ${contactData.last_name || ''}`.trim() ||
            'Customer',
          customerEmail: (contactData.email as string) || '',
          customerPhone: (contactData.mobile_phone as string) ||
            (contactData.home_phone as string) ||
            (contactData.work_phone as string) || '',
          customerAddress: address,
          salesRepId: salesRep.slug || '',
          salesRepName: salesRep.name || '',
          salesRepSlug: salesRep.slug || '',
          jobId: jobs[0]?.jnid || '',
        });
        // Override the auto-generated CUST id with the JN customerId so
        // future lookups succeed (we authenticate by jnid).
        portalAccess.customerId = customerId;
        const newLead = await leadPortalService.createLead({
          portalAccess,
          shortCode: customerPortalService.generateShortCode(),
          source: 'jobnimbus_login',
          jobnimbusContactId: customerId,
          jobnimbusId: jobs[0]?.jnid || undefined,
        });
        portalToken = newLead.accessToken;
      }
    } catch (tokenErr) {
      // Non-fatal — forms simply won't be available this session.
      console.warn('[customer/dashboard] Failed to resolve portal token:', tokenErr);
    }

    return NextResponse.json({
      success: true,
      jobs,
      appointments,
      weather: finalWeatherData,
      hailReports: finalHailReports.slice(0, 10),
      salesRep,
      messages,
      documents,
      warranty: jobs.length > 0 && jobs.some((j: { phase: string }) => j.phase === 'complete') ? {
        type: 'IKO Dynasty Limited Lifetime Warranty',
        years: 50,
        coverage: 'Shingles and installation labor',
        registrationDate: new Date().toISOString(),
        documentUrl: '#',
      } : null,
      paymentStatus,
      customerImages: [],
      portalToken,
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load dashboard' }, { status: 500 });
  }
}
