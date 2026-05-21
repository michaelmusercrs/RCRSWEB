// Customer-facing weather forecast (Huntsville). Public endpoint — no auth
// required because the forecast tile renders inside the customer portal
// page (which is itself token-gated).
//
// 1-hour server cache + Cache-Control: private, no-store on the response
// (customer-portal pages must not be cached on shared devices).

import { NextResponse } from 'next/server';
import { getHuntsvilleForecast } from '@/lib/huntsville-forecast';
import { getCustomerPortalConfig } from '@/lib/customer-portal-config';

export async function GET() {
  const forecast = await getHuntsvilleForecast();
  if (!forecast) {
    return NextResponse.json({
      success: false,
      error: 'Forecast unavailable right now. Please try again later.',
    }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  const cfg = getCustomerPortalConfig();
  return NextResponse.json({
    success: true,
    forecast,
    disclaimer: cfg.weatherDisclaimer,
    location: cfg.weatherTileLocation,
  }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
