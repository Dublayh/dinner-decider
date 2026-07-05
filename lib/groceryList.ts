import { supabase } from './supabase';
import { parseAmount, formatAmount } from './amountUtils';
import type { Recipe } from '@/types';

export interface GroceryItem {
  id: string;
  text: string;
  amount?: string | null;
  unit?: string | null;
  checked: boolean;
  source: string;
  store?: string | null;
  created_at: string;
}

// Shared normaliser for grouping/combining items and keying the store memory.
// Lowercases, collapses whitespace, and strips a trailing plural "s".
export function normalizeIngredientName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/(?<=[a-z])s\b/, '');
}

// Look up the remembered store for a batch of item names (the auto-learn feature).
// Returns a map of normalized name → store for names we've seen assigned before.
async function resolveRememberedStores(names: string[]): Promise<Map<string, string>> {
  const norms = [...new Set(names.map(normalizeIngredientName))].filter(Boolean);
  if (norms.length === 0) return new Map();
  const { data, error } = await supabase
    .from('ingredient_stores')
    .select('normalized_name, store')
    .in('normalized_name', norms);
  if (error) throw error;
  return new Map((data ?? []).map(r => [r.normalized_name, r.store]));
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
  // Auto-assign the store this ingredient is usually bought at, if we've learned one.
  const remembered = await resolveRememberedStores([text]);
  const store = remembered.get(normalizeIngredientName(text)) ?? null;
  const { data, error } = await supabase
    .from('grocery_list')
    .insert({ text, amount, unit, source, store, checked: false })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addGroceryItems(
  items: { text: string; amount?: string; unit?: string; source?: string }[],
): Promise<void> {
  const remembered = await resolveRememberedStores(items.map(i => i.text));
  const rows = items.map(i => ({
    text: i.text,
    amount: i.amount,
    unit: i.unit,
    source: i.source ?? 'manual',
    store: remembered.get(normalizeIngredientName(i.text)) ?? null,
    checked: false,
  }));
  const { error } = await supabase.from('grocery_list').insert(rows);
  if (error) throw error;
}

// Assign (or clear) the store for one or more grocery rows, and teach the memory so
// this ingredient auto-assigns next time. Passing store=null unassigns and forgets it.
export async function setItemStore(
  ids: string[],
  text: string,
  store: string | null,
): Promise<void> {
  const { error } = await supabase.from('grocery_list').update({ store }).in('id', ids);
  if (error) throw error;

  const normalized_name = normalizeIngredientName(text);
  if (!normalized_name) return;
  if (store) {
    const { error: memErr } = await supabase
      .from('ingredient_stores')
      .upsert({ normalized_name, store, updated_at: new Date().toISOString() });
    if (memErr) throw memErr;
  } else {
    const { error: memErr } = await supabase
      .from('ingredient_stores')
      .delete()
      .eq('normalized_name', normalized_name);
    if (memErr) throw memErr;
  }
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
