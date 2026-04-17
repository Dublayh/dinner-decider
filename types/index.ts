export type PriceLevel = 1 | 2 | 3 | 4;

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  distanceMiles: number;
  rating?: number;
  priceLevel?: PriceLevel;
  cuisineTypes: string[];
  isCustom: boolean;
  location: { lat: number; lng: number };
  websiteUri?: string;
}

export type EffortLevel = 'quick' | 'medium' | 'weekend';

export interface Ingredient {
  amount: string;
  unit: string;
  name: string;
}

export interface RecipeStep {
  number: number;
  step: string;
}

export interface RecipeSection {
  name: string;
  ingredients: Ingredient[];
  steps: RecipeStep[];
}

export interface Recipe {
  id: string;
  name: string;
  cuisine: string;
  effort: EffortLevel;
  imageUrl?: string;
  readyInMinutes: number;
  servings: number;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  sections?: RecipeSection[];
  isCustom: boolean;
}

export const CUISINE_OPTIONS = [
  'Italian', 'Mexican', 'Japanese', 'Indian', 'American',
  'Thai', 'Mediterranean', 'Chinese', 'Korean', 'Greek', 'French',
  'Breakfast', 'Dessert', 'Spice Mixes', 'Sauces',
] as const;

// Cuisines shown on eat-in / eat-out filter screens (excludes recipe-only categories)
export const WHEEL_CUISINE_OPTIONS = CUISINE_OPTIONS.filter(
  c => c !== 'Spice Mixes' && c !== 'Sauces'
) as unknown as readonly string[];

export const VIBE_OPTIONS = [
  'Casual', 'Romantic', 'Fast', 'Trendy', 'Family-friendly',
] as const;

export const EFFORT_OPTIONS: { label: string; value: EffortLevel }[] = [
  { label: 'Quick (< 30 min)', value: 'quick' },
  { label: 'Medium (30-60 min)', value: 'medium' },
  { label: 'Weekend project', value: 'weekend' },
];

export type CuisineOption = typeof CUISINE_OPTIONS[number];
export type VibeOption = typeof VIBE_OPTIONS[number];

export interface EatOutFilters {
  cuisines: CuisineOption[];
  vibes: VibeOption[];
  radiusMiles: number;
}

export interface EatInFilters {
  cuisines: string[];
  efforts: EffortLevel[];
}

export type WheelItem<T> = {
  id: string;
  label: string;
  data: T;
};
