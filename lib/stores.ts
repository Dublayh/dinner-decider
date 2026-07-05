import { supabase } from './supabase';

export interface Store {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export async function getStores(): Promise<Store[]> {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addStore(name: string): Promise<Store> {
  const trimmed = name.trim();
  // New stores go to the end of the list.
  const existing = await getStores();
  const sort_order = existing.length ? Math.max(...existing.map(s => s.sort_order)) + 1 : 0;
  const { data, error } = await supabase
    .from('stores')
    .insert({ name: trimmed, sort_order })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Delete a store and detach it from every item + learned mapping that referenced it,
// so nothing is left pointing at a store that no longer exists.
export async function deleteStore(store: Store): Promise<void> {
  const [{ error: e1 }, { error: e2 }, { error: e3 }] = await Promise.all([
    supabase.from('grocery_list').update({ store: null }).eq('store', store.name),
    supabase.from('ingredient_stores').delete().eq('store', store.name),
    supabase.from('stores').delete().eq('id', store.id),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;
}
