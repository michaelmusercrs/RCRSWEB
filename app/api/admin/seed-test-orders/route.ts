/**
 * Seed Test Orders API
 *
 * Creates a few material orders in the pipeline so the system has real data
 * to play with. Two paths:
 *
 *  1. Tries JobNimbus first — pulls any jobs whose name contains "test"
 *     and creates a pipeline order for each, using a sample mix of catalog
 *     items so the loading-assist + warehouse display have something real
 *     to show.
 *
 *  2. If JN returns nothing (or isn't configured), falls back to 4 hardcoded
 *     "fake" jobs with realistic but obviously test names like
 *     "[TEST] Henderson Roof Replacement".
 *
 * All seeded orders are tagged with [TEST] in the jobName so they're easy
 * to find and delete later. The endpoint is idempotent — if it sees that
 * test orders already exist for the same JN job IDs, it skips them.
 *
 * Admin/Owner only.
 *
 * POST /api/admin/seed-test-orders
 *   { count?: number  // max number of orders to create, default 4 }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { materialOrderPipeline } from '@/lib/material-order-pipeline';
import { unifiedInventoryService } from '@/lib/unified-inventory-service';
import { jobNimbusService, isJobNimbusConfigured } from '@/lib/jobnimbus-service';

// Curated mix of items that exist in the seed catalog. The seeder picks
// a small subset for each test order so the warehouse display + loading
// assist have variety to work with.
const TEST_ITEM_POOL = [
  { productId: 'INV-0001', quantity: 45 }, // GAF Timberline HDZ Charcoal
  { productId: 'INV-0006', quantity: 6 },  // GAF Seal-A-Ridge Charcoal
  { productId: 'INV-0008', quantity: 4 },  // GAF Pro-Start Starter
  { productId: 'INV-0010', quantity: 3 },  // GAF FeltBuster Synthetic
  { productId: 'INV-0014', quantity: 2 },  // RCRS Syn Felt
  { productId: 'INV-0015', quantity: 2 },  // Ice & Water Shield
  { productId: 'INV-0016', quantity: 12 }, // Ridge Vent 4LF
  { productId: 'INV-0017', quantity: 4 },  // 1.5" Black Bullet Boot
  { productId: 'INV-0019', quantity: 2 },  // 3" Black Bullet Boot
  { productId: 'INV-0021', quantity: 12 }, // Sealant
  { productId: 'INV-0023', quantity: 60 }, // Step Flashing Aluminum
  { productId: 'INV-0024', quantity: 14 }, // Drip Edge Aluminum
  { productId: 'INV-0033', quantity: 2 },  // Coil Roofing Nails
];

// Hardcoded fallback jobs — used only when JN has no test jobs.
// All clearly tagged so Michael can spot them and delete with one filter.
const FALLBACK_JOBS = [
  {
    jobNumber: 'TEST-001',
    jobName: '[TEST] Henderson Roof Replacement',
    customerName: 'Mark Henderson',
    customerPhone: '(256) 555-0001',
    customerEmail: 'mhenderson+test@example.com',
    deliveryAddress: '1482 Oak Valley Dr',
    deliveryCity: 'Huntsville',
    deliveryState: 'AL',
    deliveryZip: '35801',
    priority: 'normal' as const,
    items: [
      { productId: 'INV-0001', quantity: 45 }, // GAF Charcoal
      { productId: 'INV-0006', quantity: 6 },  // Ridge cap
      { productId: 'INV-0008', quantity: 4 },  // Starter
      { productId: 'INV-0010', quantity: 3 },  // Felt
      { productId: 'INV-0015', quantity: 2 },  // I&W
      { productId: 'INV-0017', quantity: 4 },  // 1.5" boot
      { productId: 'INV-0024', quantity: 14 }, // Drip edge
    ],
    specialInstructions: 'Gate code is #4429. Stack on south side of driveway. Customer has dogs — keep gate closed.',
  },
  {
    jobNumber: 'TEST-002',
    jobName: '[TEST] Whitfield Insurance Repair',
    customerName: 'Sarah Whitfield',
    customerPhone: '(256) 555-0002',
    customerEmail: 'swhitfield+test@example.com',
    deliveryAddress: '305 Monroe St SW',
    deliveryCity: 'Decatur',
    deliveryState: 'AL',
    deliveryZip: '35601',
    priority: 'rush' as const,
    items: [
      { productId: 'INV-0001', quantity: 32 }, // GAF Charcoal
      { productId: 'INV-0006', quantity: 4 },  // Ridge cap
      { productId: 'INV-0010', quantity: 2 },  // Felt
      { productId: 'INV-0016', quantity: 8 },  // Ridge vent
      { productId: 'INV-0021', quantity: 12 }, // Sealant
      { productId: 'INV-0033', quantity: 2 },  // Coil nails
    ],
    specialInstructions: 'Insurance repair — adjuster will be on site. Driveway is steep, use parking brake.',
  },
  {
    jobNumber: 'TEST-003',
    jobName: '[TEST] Lakeview Apartments — Building C',
    customerName: 'Lakeview Property Mgmt',
    customerPhone: '(256) 555-0003',
    customerEmail: 'maintenance+test@lakeview.example',
    deliveryAddress: '4200 Memorial Pkwy SW',
    deliveryCity: 'Huntsville',
    deliveryState: 'AL',
    deliveryZip: '35802',
    priority: 'urgent' as const,
    items: [
      { productId: 'INV-0001', quantity: 96 }, // Bigger job — 96 bundles
      { productId: 'INV-0006', quantity: 12 },
      { productId: 'INV-0010', quantity: 8 },
      { productId: 'INV-0015', quantity: 6 },
      { productId: 'INV-0023', quantity: 60 },
      { productId: 'INV-0024', quantity: 28 },
    ],
    specialInstructions: 'URGENT — tarp coming off in storm forecast tonight. Park at Building C loading zone, NOT main entrance.',
  },
  {
    jobNumber: 'TEST-004',
    jobName: '[TEST] Martinez Driveway Drop',
    customerName: 'Carlos Martinez',
    customerPhone: '(256) 555-0004',
    customerEmail: 'cmartinez+test@example.com',
    deliveryAddress: '882 Pine Ridge Rd',
    deliveryCity: 'Madison',
    deliveryState: 'AL',
    deliveryZip: '35758',
    priority: 'normal' as const,
    items: [
      { productId: 'INV-0014', quantity: 2 },  // RCRS Felt
      { productId: 'INV-0019', quantity: 2 },  // 3" boot
      { productId: 'INV-0021', quantity: 6 },  // Sealant
      { productId: 'INV-0033', quantity: 1 },  // Coil nails
    ],
    specialInstructions: 'Small drop. Customer is home until 4pm, otherwise leave on driveway.',
  },
];

// Pick a deterministic subset of items for a JN-derived order so each
// test order has variety without being identical
function pickItemsForJN(seed: number, count: number = 5) {
  const out: { productId: string; quantity: number }[] = [];
  for (let i = 0; i < count; i++) {
    const idx = (seed * 7 + i * 13) % TEST_ITEM_POOL.length;
    out.push(TEST_ITEM_POOL[idx]);
  }
  return out;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (!['admin', 'owner'].includes(auth.user.role)) {
    return NextResponse.json({ error: 'Admin or owner role required' }, { status: 403 });
  }

  let body: { count?: number } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine
  }
  const maxCount = Math.min(Math.max(body.count || 4, 1), 10);

  const created: { orderId: string; jobName: string; source: 'jn' | 'fallback'; url: string }[] = [];
  const skipped: { jobName: string; reason: string }[] = [];

  // Look up existing pipeline orders so we don't double-seed
  const existingOrders = await materialOrderPipeline.getOrders({ cancelled: false, limit: 500 });
  const existingJobNumbers = new Set(existingOrders.map(o => o.jobNumber));
  const existingJobNames = new Set(existingOrders.map(o => o.jobName.toLowerCase()));

  // ============================================
  // PATH 1: Try JobNimbus
  // ============================================
  let jnJobs: Array<{
    jnid: string;
    number?: string;
    name?: string;
    address_line1?: string;
    city?: string;
    state_text?: string;
    zip?: string;
  }> = [];

  if (isJobNimbusConfigured()) {
    try {
      // Pull a healthy batch and filter client-side. JN's API doesn't have
      // a great free-text search, so we just grab recent jobs and look for
      // "test" in the name.
      const result = await jobNimbusService.getJobs({ limit: 200 });
      jnJobs = (result.results || []).filter(j =>
        (j.name || '').toLowerCase().includes('test')
      );
    } catch (err) {
      console.error('[seed-test-orders] JN fetch failed:', err);
    }
  }

  // Limit how many JN jobs we materialize
  const jnToSeed = jnJobs.slice(0, maxCount);

  for (let i = 0; i < jnToSeed.length; i++) {
    const job = jnToSeed[i];
    const jobName = `[TEST] ${job.name || 'Untitled JN Job'}`;
    const jobNumber = job.number || job.jnid;

    if (existingJobNumbers.has(jobNumber) || existingJobNames.has(jobName.toLowerCase())) {
      skipped.push({ jobName, reason: 'Already seeded' });
      continue;
    }

    try {
      const order = await materialOrderPipeline.createOrder({
        createdBy: auth.user.userId,
        createdByName: auth.user.name,
        createdByRole: auth.user.role,
        priority: i === 0 ? 'urgent' : i === 1 ? 'rush' : 'normal',
        jobNimbusId: job.jnid,
        jobNumber,
        jobName,
        customerName: 'JN Customer (test)',
        customerPhone: '(256) 555-0000',
        customerEmail: undefined,
        deliveryAddress: job.address_line1 || '100 Main St',
        deliveryCity: job.city || 'Decatur',
        deliveryState: job.state_text || 'AL',
        deliveryZip: job.zip || '35601',
        requestedDeliveryDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        items: pickItemsForJN(i, 5),
        specialInstructions: 'Auto-seeded from JobNimbus for testing',
        notes: `Seeded ${new Date().toISOString()} from JN ${job.jnid}`,
      });

      created.push({
        orderId: order.orderId,
        jobName: order.jobName,
        source: 'jn',
        url: `/portal/orders/${order.orderId}`,
      });
    } catch (err) {
      console.error(`[seed-test-orders] Failed to create order from JN job ${job.jnid}:`, err);
      skipped.push({
        jobName,
        reason: err instanceof Error ? err.message : 'createOrder failed',
      });
    }
  }

  // ============================================
  // PATH 2: Fallback to hardcoded jobs
  // ============================================
  // Use fallback jobs to fill up to maxCount if JN didn't supply enough
  const remaining = maxCount - created.length;
  if (remaining > 0) {
    for (let i = 0; i < Math.min(remaining, FALLBACK_JOBS.length); i++) {
      const job = FALLBACK_JOBS[i];

      if (existingJobNumbers.has(job.jobNumber) || existingJobNames.has(job.jobName.toLowerCase())) {
        skipped.push({ jobName: job.jobName, reason: 'Already seeded' });
        continue;
      }

      try {
        const order = await materialOrderPipeline.createOrder({
          createdBy: auth.user.userId,
          createdByName: auth.user.name,
          createdByRole: auth.user.role,
          priority: job.priority,
          jobNumber: job.jobNumber,
          jobName: job.jobName,
          customerName: job.customerName,
          customerPhone: job.customerPhone,
          customerEmail: job.customerEmail,
          deliveryAddress: job.deliveryAddress,
          deliveryCity: job.deliveryCity,
          deliveryState: job.deliveryState,
          deliveryZip: job.deliveryZip,
          requestedDeliveryDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
          items: job.items,
          specialInstructions: job.specialInstructions,
          notes: `Seeded ${new Date().toISOString()} (hardcoded fallback)`,
        });

        created.push({
          orderId: order.orderId,
          jobName: order.jobName,
          source: 'fallback',
          url: `/portal/orders/${order.orderId}`,
        });
      } catch (err) {
        console.error(`[seed-test-orders] Failed to create fallback order ${job.jobNumber}:`, err);
        skipped.push({
          jobName: job.jobName,
          reason: err instanceof Error ? err.message : 'createOrder failed',
        });
      }
    }
  }

  return NextResponse.json({
    success: true,
    summary: {
      requested: maxCount,
      created: created.length,
      skipped: skipped.length,
      jnJobsFound: jnJobs.length,
      jnConfigured: isJobNimbusConfigured(),
    },
    created,
    skipped,
    message: created.length === 0
      ? 'No new test orders created. Check skipped reasons.'
      : `Created ${created.length} test order${created.length === 1 ? '' : 's'}. Visit /portal/orders to see them.`,
  });
}

// GET — list which test orders currently exist (for reference + delete planning)
export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (!['admin', 'owner'].includes(auth.user.role)) {
    return NextResponse.json({ error: 'Admin or owner role required' }, { status: 403 });
  }

  const all = await materialOrderPipeline.getOrders({ cancelled: false, limit: 500 });
  const testOrders = all
    .filter(o => o.jobName.toLowerCase().includes('[test]') || o.jobName.toLowerCase().includes('test'))
    .map(o => ({
      orderId: o.orderId,
      jobName: o.jobName,
      jobNumber: o.jobNumber,
      currentStage: o.currentStage,
      priority: o.priority,
      itemCount: o.items.length,
      totalPrice: o.totalPrice,
      createdAt: o.createdAt,
      url: `/portal/orders/${o.orderId}`,
    }));

  return NextResponse.json({
    count: testOrders.length,
    orders: testOrders,
  });
}

// DELETE — cancel all test orders (cleanup)
export async function DELETE() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (!['admin', 'owner'].includes(auth.user.role)) {
    return NextResponse.json({ error: 'Admin or owner role required' }, { status: 403 });
  }

  const all = await materialOrderPipeline.getOrders({ cancelled: false, limit: 500 });
  const testOrders = all.filter(o =>
    o.jobName.toLowerCase().includes('[test]')
  );

  const cancelled: string[] = [];
  for (const order of testOrders) {
    try {
      await materialOrderPipeline.cancelOrder(
        order.orderId,
        auth.user.userId,
        auth.user.name,
        'Test data cleanup'
      );
      cancelled.push(order.orderId);
    } catch (err) {
      console.error(`[seed-test-orders] Failed to cancel ${order.orderId}:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    cancelled: cancelled.length,
    orderIds: cancelled,
    message: `Cancelled ${cancelled.length} test order${cancelled.length === 1 ? '' : 's'}. Holds released.`,
  });
}
