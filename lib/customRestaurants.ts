import { supabase } from './supabase';
import type { Restaurant } from '@/types';

export async function getCustomRestaurants(): Promise<Restaurant[]> {
  const { data, error } = await supabase
    .from('custom_restaurants')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToRestaurant);
}

export async function addCustomRestaurant(
  r: Omit<Restaurant, 'id' | 'isCustom'>,
): Promise<Restaurant> {
  const { data, error } = await supabase
    .from('custom_restaurants')
    .insert({
      name: r.name,
      address: r.address,
      distance_miles: r.distanceMiles,
      rating: r.rating ?? null,
      price_level: r.priceLevel ?? null,
      cuisine_types: r.cuisineTypes,
      lat: r.location.lat,
      lng: r.location.lng,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToRestaurant(data);
}

export async function deleteCustomRestaurant(id: string): Promise<void> {
  const { error } = await supabase.from('custom_restaurants').delete().eq('id', id);
  if (error) throw error;
}

function rowToRestaurant(row: any): Restaurant {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    distanceMiles: row.distance_miles,
    rating: row.rating ?? undefined,
    priceLevel: row.price_level ?? undefined,
    cuisineTypes: row.cuisine_types,
    location: { lat: row.lat, lng: row.lng },
    isCustom: true,
  };
}
