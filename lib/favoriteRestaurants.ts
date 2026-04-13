import { supabase } from './supabase';
import type { Restaurant } from '@/types';

function rowToRestaurant(row: any): Restaurant {
  return {
    id: row.place_id,
    name: row.name,
    address: row.address,
    distanceMiles: row.distance_miles,
    rating: row.rating ?? undefined,
    priceLevel: row.price_level ?? undefined,
    cuisineTypes: row.cuisine_types ?? [],
    isCustom: false,
    location: { lat: row.lat, lng: row.lng },
  };
}

export async function getFavoriteRestaurants(): Promise<Restaurant[]> {
  const { data, error } = await supabase
    .from('favorite_restaurants')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToRestaurant);
}

export async function getFavoritePlaceIds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('favorite_restaurants')
    .select('place_id');
  if (error) throw error;
  return new Set((data ?? []).map(r => r.place_id));
}

export async function addFavoriteRestaurant(r: Restaurant): Promise<void> {
  const { error } = await supabase.from('favorite_restaurants').upsert({
    place_id: r.id,
    name: r.name,
    address: r.address,
    distance_miles: r.distanceMiles,
    rating: r.rating ?? null,
    price_level: r.priceLevel ?? null,
    cuisine_types: r.cuisineTypes,
    lat: r.location.lat,
    lng: r.location.lng,
  }, { onConflict: 'place_id' });
  if (error) throw error;
}

export async function removeFavoriteRestaurant(placeId: string): Promise<void> {
  const { error } = await supabase
    .from('favorite_restaurants')
    .delete()
    .eq('place_id', placeId);
  if (error) throw error;
}
