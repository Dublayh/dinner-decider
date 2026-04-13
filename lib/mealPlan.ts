import { supabase } from './supabase';

export interface MealPlanEntry {
  id: string;
  plan_date: string; // 'YYYY-MM-DD'
  type: 'recipe' | 'leftovers' | 'empty';
  recipe_id?: string;
  recipe_name?: string;
  note?: string;
}

export async function getMealPlanForRange(start: string, end: string): Promise<MealPlanEntry[]> {
  const { data, error } = await supabase
    .from('meal_plan')
    .select('*')
    .gte('plan_date', start)
    .lte('plan_date', end)
    .order('plan_date');
  if (error) throw error;
  return data ?? [];
}

export async function setMealPlanEntry(
  plan_date: string,
  entry: Omit<MealPlanEntry, 'id' | 'plan_date'>,
): Promise<void> {
  const { error } = await supabase
    .from('meal_plan')
    .upsert({ plan_date, ...entry }, { onConflict: 'plan_date' });
  if (error) throw error;
}

export async function getShoppingChecks(weekStart: string): Promise<string[]> {
  const { data } = await supabase
    .from('shopping_checks')
    .select('checked_keys')
    .eq('week_start', weekStart)
    .single();
  return data?.checked_keys ?? [];
}

export async function saveShoppingChecks(weekStart: string, keys: string[]): Promise<void> {
  const { error } = await supabase
    .from('shopping_checks')
    .upsert({ week_start: weekStart, checked_keys: keys }, { onConflict: 'week_start' });
  if (error) throw error;
}

export async function clearMealPlanEntry(plan_date: string): Promise<void> {
  const { error } = await supabase
    .from('meal_plan')
    .delete()
    .eq('plan_date', plan_date);
  if (error) throw error;
}
