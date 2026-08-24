/**
 * GAF material-summary PDF preview — renders the cheat-sheet for one report and
 * returns it as a PDF (no JobNimbus write). For inspecting output before/without
 * attaching.
 *
 *   GET /api/portal/gaf/preview?order=<GAF order #>
 *   Auth: CRON_SECRET bearer OR admin/owner/office/manager session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listMessageIds, getMessage, getAttachmentBase64 } from '@/lib/gaf/gmail-service';
import { isRealQuickMeasureReport, addressFromSubject, orderNumberFromBody } from '@/lib/gaf/quickmeasure-parse';
import { extractMeasurementsFromPdf } from '@/lib/gaf/pdf-measurements';
import { buildMaterialSummary } from '@/lib/gaf/coverage-config';
import { renderSummaryPdf } from '@/lib/gaf/summary-pdf';
import { parseAddress } from '@/lib/gaf/jn-address-match';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const bearer = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (!bearer) {
    const { requireAuth } = await import('@/lib/auth-service');
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    if (!['admin', 'owner', 'manager', 'office'].includes(auth.user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }
  }

  const order = (request.nextUrl.searchParams.get('order') || '').trim();
  if (!order) return NextResponse.json({ error: 'order query param required' }, { status: 400 });

  // Find the report email by order number (GAF puts "Order #<n>" in the body).
  const ids = await listMessageIds(`from:services@gaf.com "${order}" has:attachment`, 5);
  let picked: Awaited<ReturnType<typeof getMessage>> | null = null;
  for (const id of ids) {
    const msg = await getMessage(id);
    if (!isRealQuickMeasureReport(msg.subject)) continue;
    if (orderNumberFromBody(msg.bodyText) !== order) continue;
    picked = msg;
    break;
  }
  if (!picked) return NextResponse.json({ error: `no QuickMeasure report found for order ${order}` }, { status: 404 });

  const pdfAtt = picked.attachments.find(a => /^full report/i.test(a.filename) && /\.pdf$/i.test(a.filename))
    || picked.attachments.find(a => /\.pdf$/i.test(a.filename) && !/property owner/i.test(a.filename));
  if (!pdfAtt) return NextResponse.json({ error: 'no Full Report PDF on the email' }, { status: 404 });

  const address = addressFromSubject(picked.subject);
  const pa = parseAddress(address);
  const pdfBuffer = Buffer.from(await getAttachmentBase64(picked.id, pdfAtt.attachmentId), 'base64');
  const { measurements } = await extractMeasurementsFromPdf(pdfBuffer);
  const summary = buildMaterialSummary(measurements, { city: pa.city, zip: pa.zip });
  const out = await renderSummaryPdf(address, order, measurements, summary);

  return new NextResponse(new Uint8Array(out), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="GAF-Summary-${order}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
