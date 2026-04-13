import { supabase } from './supabase';
import type { Recipe, EatInFilters } from '@/types';

/**
 * Calls the search-recipes Supabase Edge Function, which holds
 * SPOONACULAR_API_KEY and proxies Spoonacular complexSearch.
 */
export async function fetchRecipes(filters: EatInFilters): Promise<Recipe[]> {
  const { data, error } = await supabase.functions.invoke<Recipe[]>(
    'search-recipes',
    { body: { cuisines: filters.cuisines, efforts: filters.efforts, number: 20 } },
  );

  if (error) throw new Error(`Recipe fetch failed: ${error.message}`);
  return data ?? [];
}
