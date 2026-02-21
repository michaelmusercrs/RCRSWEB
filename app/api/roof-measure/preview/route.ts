import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

async function fetchImageBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return Buffer.from(buf).toString('base64');
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 });

  try {
    // 1. Geocode
    const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_KEY}`);
    const geoData = await geoRes.json();
    if (!geoData.results?.[0]) return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    const loc = geoData.results[0].geometry.location;
    const lat = loc.lat;
    const lng = loc.lng;
    const formatted = geoData.results[0].formatted_address;

    // 2. Fetch imagery in parallel — 3 overhead (Google, Esri, hybrid) + 4 street views
    const satUrl = (z: number, oLat = 0, oLng = 0) =>
      `https://maps.googleapis.com/maps/api/staticmap?center=${lat + oLat},${lng + oLng}&zoom=${z}&size=640x640&maptype=satellite&key=${GOOGLE_KEY}`;

    const esriExtent = 0.0006;
    const esriUrl = `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export?bbox=${lng - esriExtent},${lat - esriExtent},${lng + esriExtent},${lat + esriExtent}&bboxSR=4326&size=640,640&imageSR=4326&format=png&f=image`;

    const hybridUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=20&size=640x640&maptype=hybrid&key=${GOOGLE_KEY}`;

    // Street view from 4 offset positions along each direction — not just from the pin
    // This gives views from "down the street" looking back at the house
    const offset = 0.00025; // ~25 meters
    const svConfigs = [
      { label: 'From North', lat: lat + offset, lng, heading: 180 },
      { label: 'From East',  lat, lng: lng + offset, heading: 270 },
      { label: 'From South', lat: lat - offset, lng, heading: 0 },
      { label: 'From West',  lat, lng: lng - offset, heading: 90 },
    ];

    const svUrl = (sLat: number, sLng: number, heading: number) =>
      `https://maps.googleapis.com/maps/api/streetview?size=640x480&location=${sLat},${sLng}&heading=${heading}&pitch=20&fov=90&key=${GOOGLE_KEY}`;

    const [googleSat, esriSat, hybridView, ...svImages] = await Promise.all([
      fetchImageBase64(satUrl(20)),
      fetchImageBase64(esriUrl),
      fetchImageBase64(hybridUrl),
      ...svConfigs.map(c => fetchImageBase64(svUrl(c.lat, c.lng, c.heading))),
    ]);

    return NextResponse.json({
      address: formatted,
      lat,
      lng,
      overhead: [
        { source: 'Google Satellite', image: googleSat ? `data:image/png;base64,${googleSat}` : null },
        { source: 'Esri/ArcGIS', image: esriSat ? `data:image/png;base64,${esriSat}` : null },
        { source: 'Google Hybrid', image: hybridView ? `data:image/png;base64,${hybridView}` : null },
      ].filter(i => i.image),
      streetView: svConfigs.map((c, i) => ({
        heading: c.label,
        image: svImages[i] ? `data:image/png;base64,${svImages[i]}` : null,
      })).filter(i => i.image),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
