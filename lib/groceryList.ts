import { supabase } from './supabase';
import { parseAmount, formatAmount } from './amountUtils';
import type { Recipe } from '@/types';

export interface GroceryItem {
  id: string;
  text: string;
  amount?: string;
  unit?: string;
  checked: boolean;
  source: string;
  created_at: string;
}

export async function getGroceryItems(): Promise<GroceryItem[]> {
  const { data, error } = await supabase
    .from('grocery_list')
    .select('*')
    .order('checked', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addGroceryItem(
  text: string,
  amount?: string,
  unit?: string,
  source = 'manual',
): Promise<GroceryItem> {
  const { data, error } = await supabase
    .from('grocery_list')
    .insert({ text, amount, unit, source, checked: false })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addGroceryItems(
  items: { text: string; amount?: string; unit?: string; source?: string }[],
): Promise<void> {
  const rows = items.map(i => ({
    text: i.text,
    amount: i.amount,
    unit: i.unit,
    source: i.source ?? 'manual',
    checked: false,
  }));
  const { error } = await supabase.from('grocery_list').insert(rows);
  if (error) throw error;
}

function scaleIngredientAmount(amount: string, scale: number): string {
  if (scale === 1) return amount;
  const parsed = parseAmount(amount);
  if (parsed === null) return amount;
  return formatAmount(parsed * scale);
}

// Remove every grocery item that came from a given source (a recipe name).
// Used for the "undo" affordance and to keep re-adds idempotent.
export async function deleteGroceryItemsBySource(source: string): Promise<void> {
  const { error } = await supabase.from('grocery_list').delete().eq('source', source);
  if (error) throw error;
}

// Sync a single recipe's ingredients into the shared grocery list.
// Any existing items from this recipe are cleared first, so re-adding (e.g. at a
// different scale) refreshes rather than duplicates. `scale` multiplies amounts
// to match the recipe page's 1x/2x/3x toggle. Returns the number of items added.
export async function addRecipeToGroceryList(recipe: Recipe, scale = 1): Promise<number> {
  const ings = [
    ...(recipe.ingredients ?? []),
    ...(recipe.sections?.flatMap(s => s.ingredients ?? []) ?? []),
  ];
  const toAdd = ings
    .filter(ing => ing.name?.trim())
    .map(ing => ({ text: ing.name, amount: scaleIngredientAmount(ing.amount, scale), unit: ing.unit, source: recipe.name }));
  await deleteGroceryItemsBySource(recipe.name);
  if (toAdd.length > 0) await addGroceryItems(toAdd);
  return toAdd.length;
}

export async function toggleGroceryItem(id: string, checked: boolean): Promise<void> {
  const { error } = await supabase
    .from('grocery_list')
    .update({ checked })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteCheckedItems(): Promise<void> {
  const { error } = await supabase
    .from('grocery_list')
    .delete()
    .eq('checked', true);
  if (error) throw error;
}

export async function clearAllItems(): Promise<void> {
  const { error } = await supabase
    .from('grocery_list')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
}
