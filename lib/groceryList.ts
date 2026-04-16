import { supabase } from './supabase';

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
