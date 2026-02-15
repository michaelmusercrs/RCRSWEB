import { NextRequest, NextResponse } from 'next/server';
import { createPublicRateLimiter, withRateLimit } from '@/lib/rate-limiter';

const publicRateLimiter = createPublicRateLimiter();

const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const SOLAR_KEY = process.env.GOOGLE_SOLAR_API_KEY || MAPS_KEY;

const SQ_M_TO_SQ_FT = 10.7639;
const STANDARD_PITCHES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12];

function degreesToPitch12(deg: number): string {
  const raw = Math.tan(deg * Math.PI / 180) * 12;
  const nearest = STANDARD_PITCHES.reduce((a, b) => Math.abs(b - raw) < Math.abs(a - raw) ? b : a);
  return `${nearest}/12`;
}

function azimuthToDirection(az: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(az / 45) % 8];
}

function calcMaterials(area: number, perimeter: number, ridge: number, pipeBoots: number) {
  const shingleBundles = Math.ceil(area / 33.3);
  const m = {
    shingles: { bundles: shingleBundles, cost: shingleBundles * 38.5 },
    underlayment: { rolls: Math.ceil(area / 400), cost: Math.ceil(area / 400) * 62 },
    starterStrip: { bundles: Math.ceil(perimeter / 100), cost: Math.ceil(perimeter / 100) * 24 },
    ridgeCap: { bundles: Math.ceil(ridge / 25), cost: Math.ceil(ridge / 25) * 56 },
    dripEdge: { pieces: Math.ceil(perimeter / 10), cost: Math.ceil(perimeter / 10) * 5.5 },
    iceWaterShield: { rolls: Math.max(2, Math.ceil(perimeter / 75)), cost: Math.max(2, Math.ceil(perimeter / 75)) * 78 },
    nails: { boxes: Math.max(2, Math.ceil(shingleBundles / 10)), cost: Math.max(2, Math.ceil(shingleBundles / 10)) * 12.5 },
    stepFlashing: { pieces: Math.ceil(perimeter * 0.15), cost: Math.ceil(perimeter * 0.15) * 1.8 },
    pipeBoots: { count: pipeBoots, cost: pipeBoots * 14 },
  };
  const totalMaterialCost = Object.values(m).reduce((s, v) => s + v.cost, 0);
  return { materials: m, totalMaterialCost: Math.round(totalMaterialCost * 100) / 100 };
}

async function geocode(address: string) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${MAPS_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.length) return null;
  const r = data.results[0];
  const loc = r.geometry.location;
  const postalComp = r.address_components?.find((c: any) => c.types.includes('postal_code'));
  const stateComp = r.address_components?.find((c: any) => c.types.includes('administrative_area_level_1'));
  return {
    lat: loc.lat,
    lng: loc.lng,
    formattedAddress: r.formatted_address,
    postalCode: postalComp?.short_name || '',
    state: stateComp?.short_name || '',
  };
}

async function getSolarData(lat: number, lng: number) {
  const qualities = ['HIGH', 'MEDIUM', 'BASE'];
  for (const q of qualities) {
    const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=${q}&key=${SOLAR_KEY}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      return { data, quality: q };
    }
    if (res.status !== 404) {
      const err = await res.text();
      throw new Error(`Solar API error (${res.status}): ${err}`);
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, publicRateLimiter, async () => {
  const address = req.nextUrl.searchParams.get('address');
  if (!address) return NextResponse.json({ error: 'Address is required' }, { status: 400 });

  try {
    const geo = await geocode(address);
    if (!geo) return NextResponse.json({ error: 'Address not found. Please check and try again.' }, { status: 404 });

    const solar = await getSolarData(geo.lat, geo.lng);
    if (!solar) return NextResponse.json({ error: 'No satellite roof data available for this location.' }, { status: 404 });

    const { data, quality } = solar;
    const whole = data.solarPotential?.wholeRoofStats;
    const roofSegments = data.solarPotential?.roofSegmentStats || [];
    const bbox = data.solarPotential?.boundingBox;
    const imageryDate = data.imageryDate;

    const totalRoofAreaSqFt = (whole?.areaMeters2 || 0) * SQ_M_TO_SQ_FT;
    const groundFootprintSqFt = (whole?.groundAreaMeters2 || 0) * SQ_M_TO_SQ_FT;

    const segments = roofSegments.map((s: any) => ({
      pitchDegrees: s.pitchDegrees || 0,
      pitch12: degreesToPitch12(s.pitchDegrees || 0),
      azimuthDegrees: s.azimuthDegrees || 0,
      direction: azimuthToDirection(s.azimuthDegrees || 0),
      areaSqFt: (s.stats?.areaMeters2 || 0) * SQ_M_TO_SQ_FT,
      groundAreaSqFt: (s.stats?.groundAreaMeters2 || 0) * SQ_M_TO_SQ_FT,
    }));

    // Primary pitch (weighted average)
    const totalSegArea = segments.reduce((s: number, seg: any) => s + seg.areaSqFt, 0);
    const primaryPitchDegrees = totalSegArea > 0
      ? segments.reduce((s: number, seg: any) => s + seg.pitchDegrees * seg.areaSqFt, 0) / totalSegArea
      : 0;
    const pitchMultiplier = 1 / Math.cos(primaryPitchDegrees * Math.PI / 180);

    // Bounding box perimeter
    let estimatedPerimeterFt = 0, estimatedRidgeFt = 0, estimatedRakesFt = 0;
    if (bbox) {
      const ne = bbox.ne || bbox.high;
      const sw = bbox.sw || bbox.low;
      if (ne && sw) {
        const centerLat = (ne.latitude + sw.latitude) / 2;
        const latDiff = (ne.latitude - sw.latitude) * 364000;
        const lngDiff = (ne.longitude - sw.longitude) * 288200 * Math.cos(centerLat * Math.PI / 180);
        estimatedPerimeterFt = Math.round(2 * (latDiff + lngDiff) * 1.05);
        estimatedRidgeFt = Math.round(Math.max(latDiff, lngDiff) * 1.05);
        estimatedRakesFt = Math.round(Math.min(latDiff, lngDiff) * 2 * 1.05);
      }
    }
    // Fallback from sqrt of ground area
    if (estimatedPerimeterFt === 0 && groundFootprintSqFt > 0) {
      const side = Math.sqrt(groundFootprintSqFt);
      estimatedPerimeterFt = Math.round(4 * side * 1.05);
      estimatedRidgeFt = Math.round(side * 1.05);
      estimatedRakesFt = Math.round(side * 2 * 1.05);
    }

    const segCount = segments.length;
    const estimatedValleysFt = Math.round(Math.max(0, segCount - 2) * estimatedRakesFt * 0.3);
    const estimatedHipsFt = Math.round(Math.max(0, segCount - 1) * estimatedRakesFt * 0.25);

    const roofSquares = Math.round(totalRoofAreaSqFt / 100 * 10) / 10;
    const roofComplexity = segCount <= 4 ? 'Simple' : segCount <= 8 ? 'Moderate' : 'Complex';

    const { materials, totalMaterialCost } = calcMaterials(totalRoofAreaSqFt, estimatedPerimeterFt, estimatedRidgeFt, 3);

    const result = {
      address: geo.formattedAddress,
      lat: geo.lat,
      lng: geo.lng,
      postalCode: geo.postalCode,
      state: geo.state,
      imageryDate: imageryDate ? `${imageryDate.year}-${String(imageryDate.month).padStart(2, '0')}-${String(imageryDate.day).padStart(2, '0')}` : 'N/A',
      quality,
      totalRoofAreaSqFt: Math.round(totalRoofAreaSqFt),
      groundFootprintSqFt: Math.round(groundFootprintSqFt),
      segments,
      primaryPitchDegrees: Math.round(primaryPitchDegrees * 10) / 10,
      primaryPitch12: degreesToPitch12(primaryPitchDegrees),
      pitchMultiplier: Math.round(pitchMultiplier * 1000) / 1000,
      estimatedPerimeterFt,
      estimatedRidgeFt,
      estimatedRakesFt,
      estimatedValleysFt,
      estimatedHipsFt,
      roofSquares,
      segmentCount: segCount,
      roofComplexity,
      materials,
      totalMaterialCost,
    };

    return NextResponse.json(result);
  } catch (e: any) {
    console.error('Roof report error:', e);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
  });
}
