import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');
  if (!query || query.length < 3) {
    return NextResponse.json({ results: [] });
  }

  // Try Google Places Autocomplete first
  if (GOOGLE_KEY) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=address&components=country:us&key=${GOOGLE_KEY}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.predictions?.length > 0) {
          // Get details for each prediction to get lat/lng and structured address
          const results = await Promise.all(
            data.predictions.slice(0, 5).map(async (pred: { place_id: string; description: string }) => {
              try {
                const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${pred.place_id}&fields=geometry,address_components,formatted_address&key=${GOOGLE_KEY}`;
                const detailRes = await fetch(detailUrl);
                const detail = await detailRes.json();
                const result = detail.result;
                if (!result?.geometry) return null;

                const components = result.address_components || [];
                const get = (type: string) => components.find((c: { types: string[] }) => c.types.includes(type));

                return {
                  formattedAddress: result.formatted_address || pred.description,
                  lat: result.geometry.location.lat,
                  lng: result.geometry.location.lng,
                  placeId: pred.place_id,
                  streetNumber: get('street_number')?.long_name || '',
                  street: get('route')?.long_name || '',
                  city: get('locality')?.long_name || get('sublocality')?.long_name || '',
                  county: (get('administrative_area_level_2')?.long_name || '').replace(' County', ''),
                  state: get('administrative_area_level_1')?.short_name || '',
                  zip: get('postal_code')?.long_name || '',
                  country: get('country')?.short_name || 'US',
                };
              } catch {
                return null;
              }
            })
          );
          return NextResponse.json({ results: results.filter(Boolean), source: 'google' });
        }
      }
    } catch (e) {
      console.error('Google Places error:', e);
    }
  }

  // Fallback: Google Geocoding API
  if (GOOGLE_KEY) {
    try {
      const bounds = '33.5,-88.5|35.5,-85.5'; // North Alabama bias
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&bounds=${encodeURIComponent(bounds)}&region=us&key=${GOOGLE_KEY}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.results?.length > 0) {
          const results = data.results.slice(0, 5).map((r: any) => {
            const components = r.address_components || [];
            const get = (type: string) => components.find((c: { types: string[] }) => c.types.includes(type));
            return {
              formattedAddress: r.formatted_address,
              lat: r.geometry.location.lat,
              lng: r.geometry.location.lng,
              placeId: r.place_id || '',
              streetNumber: get('street_number')?.long_name || '',
              street: get('route')?.long_name || '',
              city: get('locality')?.long_name || get('sublocality')?.long_name || '',
              county: (get('administrative_area_level_2')?.long_name || '').replace(' County', ''),
              state: get('administrative_area_level_1')?.short_name || '',
              zip: get('postal_code')?.long_name || '',
              country: get('country')?.short_name || 'US',
            };
          });
          return NextResponse.json({ results, source: 'geocode' });
        }
      }
    } catch (e) {
      console.error('Google Geocoding error:', e);
    }
  }

  // Last fallback: Nominatim
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=us&limit=5&addressdetails=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'RiverCityRoofingSolutions/1.0' } });
    if (res.ok) {
      const data = await res.json();
      const results = data
        .filter((item: any) => item.address && (item.address.road || item.address.city || item.address.town))
        .map((item: any) => {
          const addr = item.address;
          const city = addr.city || addr.town || addr.village || addr.hamlet || '';
          return {
            formattedAddress: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            placeId: String(item.place_id),
            streetNumber: addr.house_number || '',
            street: addr.road || '',
            city,
            county: (addr.county || '').replace(' County', ''),
            state: addr.state || '',
            zip: addr.postcode || '',
            country: 'US',
          };
        });
      return NextResponse.json({ results, source: 'nominatim' });
    }
  } catch (e) {
    console.error('Nominatim error:', e);
  }

  return NextResponse.json({ results: [], source: 'none' });
}
