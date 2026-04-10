/**
 * Customer Breakdown API
 *
 * GET  /api/portal/customer-breakdowns                          → list (role-filtered)
 * GET  /api/portal/customer-breakdowns?action=dropdowns         → return suppliers/subs/config
 * GET  /api/portal/customer-breakdowns?action=lookup&rNumber=X  → R-number → JN + commissions lookup
 * GET  /api/portal/customer-breakdowns?breakdownId=X            → single breakdown
 * POST /api/portal/customer-breakdowns                          → create or update breakdown
 * POST /api/portal/customer-breakdowns { action: 'calculate' }  → compute totals without saving
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { jobNimbusService } from '@/lib/jobnimbus-service';
import { emailService } from '@/lib/email-service';
import { TEAM_MEMBERS, getTeamMembersByRole } from '@/lib/team-roles';
import {
  loadDropdownConfig,
  saveBreakdown,
  listBreakdowns,
  getBreakdownById,
  getBreakdownByRNumber,
  calculateTotals,
  canCreateBreakdown,
  canViewAdminTier,
  redactAdminTier,
  detectNewVendorAlerts,
  generateBreakdownId,
  type CustomerBreakdown,
  type NewVendorAlert,
} from '@/lib/customer-breakdown-service';
import fs from 'fs/promises';
import path from 'path';

// ─── GET ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const config = await loadDropdownConfig();

  // Dropdown config — returns suppliers, subs, workers comp rate, etc.
  if (action === 'dropdowns') {
    // Include inspector options from current team (managers + PMs + owners + admins)
    const inspectorRoles = ['owner', 'admin', 'manager', 'project_manager'];
    const inspectors = TEAM_MEMBERS
      .filter(m => m.isActive && inspectorRoles.includes(m.role))
      .map(m => ({ id: m.id, name: m.name, initials: m.name.split(' ').map(p => p[0]).join('').toUpperCase() }));
    // Sales reps (used for auto-populate confirmation)
    const salesReps = [...getTeamMembersByRole('sales'), ...getTeamMembersByRole('driver')]
      .filter(m => m.isActive)
      .map(m => ({ id: m.id, name: m.name }));

    return NextResponse.json({
      success: true,
      config: {
        suppliers: config.suppliers.filter(s => s.active),
        subcontractors: config.subcontractors.filter(s => s.active),
        workersComp: config.workersComp,
        overheadTiers: config.overheadTiers,
        profitSplits: config.profitSplits,
        newEntryThresholds: {
          supplier: config.newEntryThresholds.supplier,
          subcontractor: config.newEntryThresholds.subcontractor,
        },
        inspectors,
        salesReps,
        canCreate: canCreateBreakdown(auth.user.role, config),
        canViewAdminTier: canViewAdminTier(auth.user.role, config),
      },
    });
  }

  // R-number lookup — pulls JN job + commissions for auto-populate
  if (action === 'lookup') {
    const rNumber = url.searchParams.get('rNumber') || '';
    if (!rNumber.trim()) {
      return NextResponse.json({ success: false, error: 'rNumber required' }, { status: 400 });
    }
    return await handleLookup(rNumber.trim());
  }

  // Pending-changes detector — returns any diffs between the portal
  // breakdown and the corresponding per-job Google Sheet tab. Used by the
  // sync-review UI so Sara's in-sheet edits can be surfaced to a portal
  // user for accept/reject.
  if (action === 'pending-changes') {
    const id = url.searchParams.get('breakdownId');
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'breakdownId required' },
        { status: 400 }
      );
    }
    const result = await getBreakdownById(id);
    if (!result) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    const { detectPendingChanges } = await import('@/lib/breakdown-sheet-sync');
    const diff = await detectPendingChanges(result.breakdown, result.totals);
    return NextResponse.json({
      success: true,
      breakdownId: id,
      rNumber: result.breakdown.rNumber,
      hasChanges: diff.hasChanges,
      changes: diff.changes,
    });
  }

  // Single breakdown
  const breakdownId = url.searchParams.get('breakdownId');
  if (breakdownId) {
    const result = await getBreakdownById(breakdownId);
    if (!result) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({
      success: true,
      breakdown: result.breakdown,
      totals: canViewAdminTier(auth.user.role, config) ? result.totals : redactAdminTier(result.totals),
      viewTier: canViewAdminTier(auth.user.role, config) ? 'admin' : 'public',
    });
  }

  // List all
  const all = await listBreakdowns({
    salesRep: url.searchParams.get('salesRep') || undefined,
    status: url.searchParams.get('status') || undefined,
  });
  const isAdminTier = canViewAdminTier(auth.user.role, config);
  return NextResponse.json({
    success: true,
    breakdowns: all.map(x => ({
      breakdown: x.breakdown,
      totals: isAdminTier ? x.totals : redactAdminTier(x.totals),
    })),
    viewTier: isAdminTier ? 'admin' : 'public',
    count: all.length,
  });
}

// ─── POST ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const body = await req.json();
  const action = body.action || 'create';
  const config = await loadDropdownConfig();

  // Live calculation — no save
  if (action === 'calculate') {
    const totals = calculateTotals(body.breakdown as CustomerBreakdown, config);
    return NextResponse.json({
      success: true,
      totals: canViewAdminTier(auth.user.role, config) ? totals : redactAdminTier(totals),
    });
  }

  // Sync FROM sheet → portal. Admin/owner only. Reads the per-job tab
  // back, merges the sheet-editable fields (jobTotal, permit, materials,
  // labor) onto the existing portal breakdown, recomputes totals, and
  // persists. Used to accept Sara's in-sheet edits.
  if (action === 'sync-from-sheet') {
    if (!canViewAdminTier(auth.user.role, config)) {
      return NextResponse.json(
        { success: false, error: 'Admin/owner role required to sync from sheet' },
        { status: 403 }
      );
    }

    const id = body.breakdownId as string | undefined;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'breakdownId required' },
        { status: 400 }
      );
    }

    const existing = await getBreakdownById(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const { readBreakdownSheet } = await import('@/lib/breakdown-sheet-sync');
    const read = await readBreakdownSheet(existing.breakdown.rNumber);
    if (!read.success || !read.parsed) {
      return NextResponse.json(
        { success: false, error: read.reason || 'Sheet read failed' },
        { status: 500 }
      );
    }

    // Merge: sheet wins for fields the sheet owns, portal keeps everything else
    const merged: CustomerBreakdown = {
      ...existing.breakdown,
      jobTotal: typeof read.parsed.jobTotal === 'number' ? read.parsed.jobTotal : existing.breakdown.jobTotal,
      permit: typeof read.parsed.permit === 'number' ? read.parsed.permit : existing.breakdown.permit,
      materials: read.parsed.materials || existing.breakdown.materials,
      labor: read.parsed.labor || existing.breakdown.labor,
      updatedAt: new Date().toISOString(),
    };

    const newTotals = calculateTotals(merged, config);
    const ok = await saveBreakdown(merged, newTotals);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'saveBreakdown failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      breakdown: merged,
      totals: canViewAdminTier(auth.user.role, config) ? newTotals : redactAdminTier(newTotals),
      source: 'sheet',
    });
  }

  // Create or update
  if (action === 'create' || action === 'update') {
    if (!canCreateBreakdown(auth.user.role, config)) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to create breakdowns' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    const input = body.breakdown as Partial<CustomerBreakdown>;

    // Validate required fields
    if (!input.rNumber || !input.customerName || typeof input.jobTotal !== 'number') {
      return NextResponse.json(
        { success: false, error: 'rNumber, customerName, and jobTotal are required' },
        { status: 400 }
      );
    }

    // Build full breakdown
    const breakdown: CustomerBreakdown = {
      breakdownId: input.breakdownId || generateBreakdownId(),
      rNumber: input.rNumber,
      jnJobNumber: input.jnJobNumber || '',
      jnJobId: input.jnJobId || '',
      customerName: input.customerName,
      address: input.address || '',
      salesRep: input.salesRep || '',
      inspector: input.inspector || '',
      dateInstalled: input.dateInstalled || '',
      jobTotal: Number(input.jobTotal) || 0,
      permit: Number(input.permit) || 0,
      otherCosts: input.otherCosts || [],
      materials: input.materials || [],
      labor: input.labor || [],
      paymentsIn: input.paymentsIn || [],
      commissionsPaid: input.commissionsPaid || { revisions: [] },
      notes: input.notes || '',
      status: input.status || 'draft',
      createdAt: input.createdAt || now,
      updatedAt: now,
      createdBy: input.createdBy || auth.user.email || 'unknown',
      approvedBy: input.approvedBy,
      approvedAt: input.approvedAt,
    };

    // Calculate totals server-side (don't trust client)
    const totals = calculateTotals(breakdown, config);

    // Detect new vendors over threshold
    const alerts = detectNewVendorAlerts(breakdown, config);

    // Persist
    const ok = await saveBreakdown(breakdown, totals);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Failed to save breakdown' }, { status: 500 });
    }

    // Send notifications if thresholds tripped
    if (alerts.length > 0) {
      // Fire and forget — don't block the save response
      sendNewVendorAlerts(breakdown, alerts, auth.user.email || auth.user.name || 'unknown', config)
        .catch(e => console.error('Alert send failed:', e));
    }

    return NextResponse.json({
      success: true,
      breakdown,
      totals: canViewAdminTier(auth.user.role, config) ? totals : redactAdminTier(totals),
      alerts: alerts.length > 0 ? alerts : undefined,
    });
  }

  return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
}

// ─── R-number Lookup Handler ─────────────────────────────────────────────

async function handleLookup(rNumber: string): Promise<NextResponse> {
  // 1. Try the local CustomerBreakdowns sheet first (we may already have this)
  const existing = await getBreakdownByRNumber(rNumber);
  if (existing) {
    return NextResponse.json({
      success: true,
      source: 'customer-breakdowns',
      autoPopulated: {
        rNumber: existing.breakdown.rNumber,
        customerName: existing.breakdown.customerName,
        address: existing.breakdown.address,
        salesRep: existing.breakdown.salesRep,
        inspector: existing.breakdown.inspector,
        dateInstalled: existing.breakdown.dateInstalled,
        jobTotal: existing.breakdown.jobTotal,
        jnJobId: existing.breakdown.jnJobId,
        jnJobNumber: existing.breakdown.jnJobNumber,
      },
      existingBreakdownId: existing.breakdown.breakdownId,
    });
  }

  // 2. Try JobNimbus — search by number in both "R-1234" and "R1234" formats
  const candidates = [
    rNumber,
    rNumber.replace(/^R\s*/i, 'R-'),
    rNumber.replace(/^R-?/i, ''),
    rNumber.replace(/^R\s*/i, 'R'),
  ];
  let jnJob = null;
  let tried: string[] = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    tried.push(candidate);
    try {
      jnJob = await jobNimbusService.getJobByNumber(candidate);
      if (jnJob) break;
    } catch {
      // continue to next candidate
    }
  }

  if (jnJob) {
    // Extract address
    const addressParts = [
      jnJob.address_line1,
      jnJob.address_line2,
      jnJob.city,
      jnJob.state_text,
      jnJob.zip,
    ].filter(Boolean);
    const address = addressParts.join(', ');

    return NextResponse.json({
      success: true,
      source: 'jobnimbus',
      autoPopulated: {
        rNumber,
        jnJobId: jnJob.jnid,
        jnJobNumber: jnJob.number || rNumber,
        customerName: jnJob.name || '',
        address,
        salesRep: jnJob.sales_rep_name || '',
        dateInstalled: jnJob.date_end
          ? new Date(jnJob.date_end * 1000).toISOString().split('T')[0]
          : '',
      },
      rawJnJob: {
        jnid: jnJob.jnid,
        number: jnJob.number,
        name: jnJob.name,
      },
    });
  }

  // 3. Fall back to commissions.json — best effort match by job number
  try {
    const commissionsPath = path.join(process.cwd(), 'data', 'commissions.json');
    const raw = await fs.readFile(commissionsPath, 'utf8');
    const commissions = JSON.parse(raw) as Array<{
      salesRep: string;
      date: string;
      amount: number;
      jobNumber: string;
      customer: string;
    }>;
    const stripped = rNumber.replace(/^R-?/i, '').trim();
    const match = commissions.find(
      c =>
        c.jobNumber &&
        (c.jobNumber === rNumber ||
          c.jobNumber === `R${stripped}` ||
          c.jobNumber === `R-${stripped}` ||
          c.jobNumber.replace(/^R-?/i, '') === stripped)
    );
    if (match) {
      return NextResponse.json({
        success: true,
        source: 'commissions',
        autoPopulated: {
          rNumber,
          customerName: match.customer,
          salesRep: match.salesRep,
          dateInstalled: match.date,
          address: '',
        },
        commissionRecord: match,
      });
    }
  } catch {
    // ignore — commissions.json may not exist or be readable
  }

  // 4. Nothing found — return empty template
  return NextResponse.json({
    success: true,
    source: 'none',
    autoPopulated: { rNumber },
    message: `No existing data found for ${rNumber}. Tried JobNimbus candidates: ${tried.join(', ')}. Fill in manually.`,
  });
}

// ─── New-vendor notification ─────────────────────────────────────────────

async function sendNewVendorAlerts(
  breakdown: CustomerBreakdown,
  alerts: NewVendorAlert[],
  enteredBy: string,
  config: Awaited<ReturnType<typeof loadDropdownConfig>>
): Promise<void> {
  const recipients = config.newEntryThresholds.notifyRecipients;
  if (!recipients || recipients.length === 0) return;

  const rows = alerts
    .map(
      a =>
        `<tr><td style="padding:8px;border-bottom:1px solid #333;">${a.type === 'supplier' ? 'Supplier' : 'Subcontractor'}</td><td style="padding:8px;border-bottom:1px solid #333;"><strong>${escapeHtml(a.name)}</strong></td><td style="padding:8px;border-bottom:1px solid #333;text-align:right;">$${a.amount.toFixed(2)}</td><td style="padding:8px;border-bottom:1px solid #333;text-align:right;color:#999;">threshold: $${a.threshold}</td></tr>`
    )
    .join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;background:#0a0a0a;color:#fff;">
      <div style="background:#000;padding:20px;border-bottom:2px solid #39FF14;">
        <h2 style="color:#39FF14;margin:0;">New Vendor Alert · Customer Breakdown</h2>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;">A new vendor was added above the notification threshold on a customer breakdown:</p>
        <p style="margin:0 0 8px;"><strong>Job:</strong> ${escapeHtml(breakdown.rNumber)} &middot; ${escapeHtml(breakdown.customerName)}</p>
        <p style="margin:0 0 8px;"><strong>Sales Rep:</strong> ${escapeHtml(breakdown.salesRep || 'n/a')}</p>
        <p style="margin:0 0 8px;"><strong>Entered by:</strong> ${escapeHtml(enteredBy)}</p>
        <p style="margin:0 0 16px;"><strong>Job Total:</strong> $${breakdown.jobTotal.toFixed(2)}</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#111;">
          <thead>
            <tr style="background:#1a1a1a;"><th style="padding:8px;text-align:left;color:#39FF14;">Type</th><th style="padding:8px;text-align:left;color:#39FF14;">Name</th><th style="padding:8px;text-align:right;color:#39FF14;">Amount</th><th style="padding:8px;text-align:right;color:#39FF14;">Threshold</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin:16px 0 0;color:#888;font-size:12px;">This notification was triggered because one or more vendors on this breakdown are not in the approved dropdown list and exceed the threshold set in data/breakdown-dropdowns.json. Review in the portal and either approve (add to dropdown) or flag for review.</p>
      </div>
      <div style="background:#000;padding:16px;text-align:center;font-size:12px;color:#666;border-top:1px solid #333;">
        River City Roofing Solutions · rcrsal.com
      </div>
    </div>
  `;

  await emailService.send({
    to: recipients.join(','),
    subject: `New Vendor Alert: ${breakdown.rNumber} - ${alerts.length} vendor${alerts.length > 1 ? 's' : ''} over threshold`,
    body: html,
  });
}

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
