import { NextRequest, NextResponse } from 'next/server';
import { priceVerificationService } from '@/lib/price-verification-service';

// GET /api/portal/pricing/alerts - Get price alerts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as any || undefined;

    const alerts = await priceVerificationService.getPriceAlerts(status);

    // Calculate summary stats
    const summary = {
      total: alerts.length,
      new: alerts.filter(a => a.status === 'New').length,
      underReview: alerts.filter(a => a.status === 'Under Review').length,
      disputed: alerts.filter(a => a.status === 'Disputed').length,
      resolved: alerts.filter(a => a.status === 'Resolved').length,
      creditReceived: alerts.filter(a => a.status === 'Credit Received').length,
      totalOvercharges: alerts.reduce((sum, a) => sum + a.totalOvercharge, 0),
      pendingCredits: alerts
        .filter(a => ['New', 'Under Review', 'Disputed'].includes(a.status))
        .reduce((sum, a) => sum + a.totalOvercharge, 0),
      creditsReceived: alerts
        .filter(a => a.status === 'Credit Received')
        .reduce((sum, a) => sum + a.creditAmount, 0),
    };

    return NextResponse.json({ alerts, summary });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

// PATCH /api/portal/pricing/alerts - Update alert status
export async function PATCH(request: NextRequest) {
  try {
    const data = await request.json();
    const { alertId, ...updates } = data;

    if (!alertId) {
      return NextResponse.json({ error: 'Missing alertId' }, { status: 400 });
    }

    await priceVerificationService.updatePriceAlert(alertId, updates);

    // Log the action
    await priceVerificationService.logAuditAction(
      'ALERT_UPDATE',
      `Updated alert ${alertId}: ${JSON.stringify(updates)}`,
      updates.assignedTo || 'Unknown'
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating alert:', error);
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 });
  }
}
