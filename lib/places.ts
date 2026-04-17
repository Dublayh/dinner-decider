import { supabase } from './supabase';
import type { Restaurant, EatOutFilters } from '@/types';

interface NearbyRestaurantsPayload {
  lat: number;
  lng: number;
  radiusMiles: number;
  cuisines: string[];
  vibes: string[];
}

export async function fetchNearbyRestaurants(
  lat: number,
  lng: number,
  filters: EatOutFilters,
): Promise<Restaurant[]> {
  const { data, error } = await supabase.functions.invoke(
    'nearby-restaurants',
    {
      body: {
        lat,
        lng,
        radiusMiles: filters.radiusMiles,
        cuisines: filters.cuisines,
        vibes: filters.vibes,
      } satisfies NearbyRestaurantsPayload,
    },
  );

  if (error) throw new Error(`Places fetch failed: ${error.message}`);
  const results: any[] = data ?? [];

  // Calculate distance client-side and map to Restaurant shape
  const restaurants: Restaurant[] = results.map(p => ({
    id: p.id,
    name: p.name,
    address: p.address ?? '',
    distanceMiles: parseFloat(metersToMiles(distanceBetween(lat, lng, p.location?.lat ?? lat, p.location?.lng ?? lng)).toFixed(1)),
    rating: p.rating ?? undefined,
    priceLevel: p.priceLevel ?? undefined,
    cuisineTypes: p.cuisineTypes ?? [],
    isCustom: false,
    websiteUri: p.websiteUri ?? undefined,
    location: p.location ?? { lat, lng },
  }));

  // Deduplicate by name — keep the closest location of each chain
  const seen = new Map<string, Restaurant>();
  for (const r of restaurants) {
    const key = r.name.toLowerCase().trim();
    const existing = seen.get(key);
    if (!existing || r.distanceMiles < existing.distanceMiles) {
      seen.set(key, r);
    }
  }
  return Array.from(seen.values());
}

function metersToMiles(meters: number): number {
  return meters / 1609.34;
}

function distanceBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function searchRestaurants(
  query: string,
  lat: number,
  lng: number,
  radiusMiles: number = 5,
): Promise<Restaurant[]> {
  const { data, error } = await supabase.functions.invoke(
    'search-restaurants',
    { body: { query, latitude: lat, longitude: lng, radiusMiles } },
  );

  if (error) throw new Error(`Search failed: ${error.message}`);

  const places = data?.results ?? [];
  return places.map((p: any): Restaurant => {
    const placeLat = p.geometry?.location?.lat ?? lat;
    const placeLng = p.geometry?.location?.lng ?? lng;
    const distMeters = distanceBetween(lat, lng, placeLat, placeLng);
    return {
      id: p.place_id,
      name: p.name ?? 'Unknown',
      address: p.formatted_address ?? p.vicinity ?? '',
      distanceMiles: parseFloat(metersToMiles(distMeters).toFixed(1)),
      rating: p.rating,
      priceLevel: p.price_level,
      cuisineTypes: p.types ?? [],
      isCustom: false,
      location: { lat: placeLat, lng: placeLng },
    };
  });
}
