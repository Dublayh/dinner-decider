import { supabase } from './supabase';
import type { Recipe } from '@/types';

export async function getCustomRecipes(): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('custom_recipes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToRecipe);
}

export async function getCustomRecipeById(id: string): Promise<Recipe | null> {
  const { data, error } = await supabase
    .from('custom_recipes')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return rowToRecipe(data);
}

export async function addCustomRecipe(
  recipe: Omit<Recipe, 'id' | 'isCustom'>,
): Promise<Recipe> {
  const { data, error } = await supabase
    .from('custom_recipes')
    .insert({
      name: recipe.name,
      cuisine: recipe.cuisine,
      effort: recipe.effort,
      ready_in_minutes: recipe.readyInMinutes,
      servings: recipe.servings,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      sections: recipe.sections ?? null,
      image_url: recipe.imageUrl ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToRecipe(data);
}

export async function updateCustomRecipe(
  id: string,
  recipe: Omit<Recipe, 'id' | 'isCustom'>,
): Promise<Recipe> {
  const { data, error } = await supabase
    .from('custom_recipes')
    .update({
      name: recipe.name,
      cuisine: recipe.cuisine,
      effort: recipe.effort,
      ready_in_minutes: recipe.readyInMinutes,
      servings: recipe.servings,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      sections: recipe.sections ?? null,
      image_url: recipe.imageUrl ?? null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return rowToRecipe(data);
}

export async function saveSpoonacularRecipe(recipe: Recipe): Promise<Recipe> {
  return addCustomRecipe({
    name: recipe.name,
    cuisine: recipe.cuisine,
    effort: recipe.effort,
    readyInMinutes: recipe.readyInMinutes,
    servings: recipe.servings,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    imageUrl: recipe.imageUrl,
  });
}

export async function deleteCustomRecipe(id: string): Promise<void> {
  const { error } = await supabase.from('custom_recipes').delete().eq('id', id);
  if (error) throw error;
}

function rowToRecipe(row: any): Recipe {
  return {
    id: row.id,
    name: row.name,
    cuisine: row.cuisine,
    effort: row.effort,
    readyInMinutes: row.ready_in_minutes,
    servings: row.servings,
    ingredients: row.ingredients ?? [],
    steps: row.steps ?? [],
    sections: row.sections ?? undefined,
    imageUrl: row.image_url ?? undefined,
    isCustom: true,
  };
}
