/**
 * Portal Roof Measure API
 * 
 * Endpoints:
 *   POST { action: 'search', query: string }          → Search JN contacts/jobs
 *   POST { action: 'create-job', ... }                → Create new JN contact + job
 *   POST { action: 'measure', jobJnid, contactJnid, address }  → Run measurement + storm report, attach to JN
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { jobNimbusService } from '@/lib/jobnimbus-service';
import { roofReportService } from '@/lib/roof-report-service';
import { stormReportService } from '@/lib/storm-report-service';

export const maxDuration = 800;
export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['owner', 'admin', 'manager', 'sales'];

export async function POST(request: NextRequest) {
  // Auth check
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  
  if (!ALLOWED_ROLES.includes(auth.user.role)) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions. Required: owner, admin, manager, or sales role.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'search':
        return handleSearch(body.query);
      case 'create-job':
        return handleCreateJob(body);
      case 'measure':
        return handleMeasure(body, auth.user);
      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Roof measure API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

// ── Search JN contacts and jobs ────────────────────────────────────────────

async function handleSearch(query: string) {
  if (!query || query.trim().length < 2) {
    return NextResponse.json({ success: true, results: [] });
  }

  const q = query.trim();

  try {
    // Search contacts - JN API supports filter syntax
    const contactResult = await jobNimbusService.getContacts({ limit: 20 });
    const jobResult = await jobNimbusService.getJobs({ limit: 50 });

    const qLower = q.toLowerCase();

    // Filter contacts by name or address
    const matchedContacts = contactResult.results.filter((c: any) => {
      const name = `${c.first_name || ''} ${c.last_name || ''} ${c.display_name || ''}`.toLowerCase();
      const addr = `${c.address_line1 || ''} ${c.city || ''} ${c.zip || ''}`.toLowerCase();
      return name.includes(qLower) || addr.includes(qLower);
    }).slice(0, 10);

    // Filter jobs by name, number, or address
    const matchedJobs = jobResult.results.filter((j: any) => {
      const name = `${j.name || ''} ${j.number || ''}`.toLowerCase();
      const addr = `${j.address_line1 || ''} ${j.city || ''} ${j.zip || ''}`.toLowerCase();
      return name.includes(qLower) || addr.includes(qLower);
    }).slice(0, 10);

    // Build combined results with contact info for each job
    const results = [];

    // Add contacts with their jobs
    for (const contact of matchedContacts) {
      const contactJobs = matchedJobs.filter((j: any) => j.primary?.id === contact.jnid);
      const address = [contact.address_line1, contact.city, contact.state_text, contact.zip]
        .filter(Boolean).join(', ');

      if (contactJobs.length > 0) {
        for (const job of contactJobs) {
          const jobAddr = [job.address_line1, job.city, job.state_text, job.zip]
            .filter(Boolean).join(', ');
          results.push({
            type: 'job',
            contactJnid: contact.jnid,
            jobJnid: job.jnid,
            contactName: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.display_name || 'Unknown',
            jobName: job.name || job.number || 'Untitled Job',
            jobNumber: job.number || '',
            jobStatus: job.status || '',
            address: jobAddr || address,
            phone: contact.mobile_phone || contact.home_phone || '',
            email: contact.email || '',
          });
        }
      } else {
        results.push({
          type: 'contact',
          contactJnid: contact.jnid,
          jobJnid: null,
          contactName: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.display_name || 'Unknown',
          jobName: null,
          jobNumber: null,
          jobStatus: null,
          address,
          phone: contact.mobile_phone || contact.home_phone || '',
          email: contact.email || '',
        });
      }
    }

    // Add orphan jobs (no matching contact found above)
    const usedJobIds = new Set(results.map(r => r.jobJnid).filter(Boolean));
    for (const job of matchedJobs) {
      if (!usedJobIds.has(job.jnid)) {
        const addr = [job.address_line1, job.city, job.state_text, job.zip]
          .filter(Boolean).join(', ');
        results.push({
          type: 'job',
          contactJnid: job.primary?.id || null,
          jobJnid: job.jnid,
          contactName: job.name || 'Unknown',
          jobName: job.name || job.number || 'Untitled Job',
          jobNumber: job.number || '',
          jobStatus: job.status || '',
          address: addr,
          phone: '',
          email: '',
        });
      }
    }

    return NextResponse.json({ success: true, results: results.slice(0, 15) });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search JobNimbus', results: [] },
      { status: 500 }
    );
  }
}

// ── Create new JN contact + job ────────────────────────────────────────────

async function handleCreateJob(body: {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}) {
  const { firstName, lastName, phone, email, address, city, state, zip } = body;

  if (!firstName || !lastName || !address) {
    return NextResponse.json(
      { success: false, error: 'First name, last name, and address are required' },
      { status: 400 }
    );
  }

  // Create contact
  const contact = await jobNimbusService.createContact({
    first_name: firstName,
    last_name: lastName,
    display_name: `${firstName} ${lastName}`,
    mobile_phone: phone || undefined,
    email: email || undefined,
    address_line1: address,
    city,
    state_text: state,
    zip,
    source_name: 'Roof Measure Tool',
  });

  // Create job linked to contact
  const job = await jobNimbusService.createJob({
    name: `${firstName} ${lastName} - Roof Measurement`,
    description: 'Created from Roof Measure Tool',
    primary: { jnid: contact.jnid },
    address_line1: address,
    city,
    state_text: state,
    zip,
    status: 'Lead',
  } as any);

  return NextResponse.json({
    success: true,
    contact: {
      jnid: contact.jnid,
      name: `${firstName} ${lastName}`,
    },
    job: {
      jnid: job.jnid,
      name: job.name,
      number: job.number,
    },
  });
}

// ── Run measurement + storm report ─────────────────────────────────────────

async function handleMeasure(
  body: { jobJnid: string; contactJnid: string; address: string },
  user: { userId: string; name: string }
) {
  const { jobJnid, contactJnid, address } = body;

  if (!jobJnid || !contactJnid || !address) {
    return NextResponse.json(
      { success: false, error: 'Job ID, Contact ID, and address are required' },
      { status: 400 }
    );
  }

  // Run roof measurement
  const roofReport = await roofReportService.generateReport({
    address,
    customerId: contactJnid,
  });

  // Parse address parts for storm report (best effort)
  const addrParts = address.split(',').map(s => s.trim());
  const streetAddr = addrParts[0] || address;
  const city = addrParts[1] || '';
  const stateZip = (addrParts[2] || '').split(' ').filter(Boolean);
  const state = stateZip[0] || 'AL';
  const zip = stateZip[1] || '';

  // Run storm report (don't block on failure)
  let stormReport = null;
  try {
    stormReport = await stormReportService.generateReport({
      address: streetAddr,
      city,
      state,
      zip,
      customerId: contactJnid,
    });
  } catch (err) {
    console.warn('Storm report failed (non-blocking):', err);
  }

  // Build note content for JN
  const noteLines = [
    `🏠 ROOF MEASUREMENT REPORT`,
    `Report ID: ${roofReport.reportId}`,
    `Generated: ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })}`,
    `Measured by: ${user.name}`,
    `Address: ${roofReport.address}`,
    ``,
    `📐 MEASUREMENTS:`,
    `• Total Roof Area: ${roofReport.totalRoofAreaSqFt.toLocaleString()} sq ft`,
    `• Roof Squares: ${roofReport.roofSquares}`,
    `• Segments: ${roofReport.segmentCount}`,
    `• Primary Pitch: ${roofReport.primaryPitch}`,
    `• Roof Style: ${roofReport.roofStyle}`,
    `• Ridge: ${roofReport.totalRidgeFt} ft`,
    `• Rake: ${roofReport.totalRakeFt} ft`,
    `• Valley: ${roofReport.totalValleyFt} ft`,
    `• Eave: ${roofReport.totalEaveFt} ft`,
    `• Hip: ${roofReport.totalHipFt} ft`,
    `• Perimeter: ${roofReport.perimeterFt} ft`,
    `• Confidence: ${roofReport.overallConfidence}`,
  ];

  if (stormReport) {
    noteLines.push(
      ``,
      `⛈️ STORM/HAIL REPORT:`,
      `• Risk Level: ${stormReport.riskLevel}`,
      `• Risk Score: ${stormReport.riskScore}/100`,
      `• Hail Events (${stormReport.searchRadiusMiles}mi): ${stormReport.hailEvents?.length || 0}`,
    );
    if (stormReport.hailEvents?.length > 0) {
      const recent = stormReport.hailEvents.slice(0, 5);
      for (const evt of recent) {
        noteLines.push(`  - ${evt.date}: ${evt.size} hail, ${evt.distance}mi away`);
      }
    }
    noteLines.push(`• Recommendation: ${stormReport.recommendation}`);
  }

  if (roofReport.shareToken) {
    const shareUrl = roofReportService.getShareUrl(roofReport.shareToken);
    noteLines.push(``, `🔗 Report Link: ${shareUrl}`);
  }

  // Attach note to JN job
  try {
    await jobNimbusService.createNoteOnJob(jobJnid, contactJnid, noteLines.join('\n'));
  } catch (err) {
    console.error('Failed to create JN note:', err);
    // Don't fail the whole request
  }

  return NextResponse.json({
    success: true,
    roofReport: {
      reportId: roofReport.reportId,
      address: roofReport.address,
      totalRoofAreaSqFt: roofReport.totalRoofAreaSqFt,
      roofSquares: roofReport.roofSquares,
      segmentCount: roofReport.segmentCount,
      primaryPitch: roofReport.primaryPitch,
      roofStyle: roofReport.roofStyle,
      totalRidgeFt: roofReport.totalRidgeFt,
      totalRakeFt: roofReport.totalRakeFt,
      totalValleyFt: roofReport.totalValleyFt,
      totalEaveFt: roofReport.totalEaveFt,
      totalHipFt: roofReport.totalHipFt,
      perimeterFt: roofReport.perimeterFt,
      overallConfidence: roofReport.overallConfidence,
      shareToken: roofReport.shareToken,
      shareUrl: roofReportService.getShareUrl(roofReport.shareToken),
      satelliteImageUrl: roofReport.satelliteImageUrl,
    },
    stormReport: stormReport ? {
      riskLevel: stormReport.riskLevel,
      riskScore: stormReport.riskScore,
      hailEventCount: stormReport.hailEvents?.length || 0,
      recommendation: stormReport.recommendation,
      reportId: stormReport.reportId,
    } : null,
    jnNoteAttached: true,
  });
}
