// Hand-written stub — regenerate with:
// npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/supabase.ts
//
// Must match the shape @supabase/supabase-js expects (GenericSchema): every table
// needs Row/Insert/Update/Relationships, and the schema needs the empty
// Views/Functions/Enums/CompositeTypes maps + the __InternalSupabase marker.
// Without this, the client types every table as `never`.

export interface Database {
  __InternalSupabase: { PostgrestVersion: '12' };
  public: {
    Tables: {
      custom_restaurants: {
        Row: {
          id: string;
          created_at: string;
          name: string;
          address: string;
          distance_miles: number;
          rating: number | null;
          price_level: number | null;
          cuisine_types: string[];
          lat: number;
          lng: number;
        };
        Insert: {
          id?: string;
          created_at?: string;
          name: string;
          address?: string;
          distance_miles?: number;
          rating?: number | null;
          price_level?: number | null;
          cuisine_types?: string[];
          lat?: number;
          lng?: number;
        };
        Update: Partial<Database['public']['Tables']['custom_restaurants']['Insert']>;
        Relationships: [];
      };
      custom_recipes: {
        Row: {
          id: string;
          created_at: string;
          name: string;
          cuisine: string;
          effort: string;
          ready_in_minutes: number;
          servings: number;
          ingredients: unknown;
          steps: unknown;
          sections: unknown;
          image_url: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          name: string;
          cuisine?: string;
          effort?: string;
          ready_in_minutes?: number;
          servings?: number;
          ingredients?: unknown;
          steps?: unknown;
          sections?: unknown;
          image_url?: string | null;
        };
        Update: Partial<Database['public']['Tables']['custom_recipes']['Insert']>;
        Relationships: [];
      };
      grocery_list: {
        Row: {
          id: string;
          created_at: string;
          text: string;
          amount: string | null;
          unit: string | null;
          checked: boolean;
          source: string;
          store: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          text: string;
          amount?: string | null;
          unit?: string | null;
          checked?: boolean;
          source?: string;
          store?: string | null;
        };
        Update: Partial<Database['public']['Tables']['grocery_list']['Insert']>;
        Relationships: [];
      };
      stores: {
        Row: {
          id: string;
          created_at: string;
          name: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          created_at?: string;
          name: string;
          sort_order?: number;
        };
        Update: Partial<Database['public']['Tables']['stores']['Insert']>;
        Relationships: [];
      };
      ingredient_stores: {
        Row: {
          normalized_name: string;
          store: string;
          updated_at: string;
        };
        Insert: {
          normalized_name: string;
          store: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['ingredient_stores']['Insert']>;
        Relationships: [];
      };
      favorite_restaurants: {
        Row: {
          place_id: string;
          created_at: string;
          name: string;
          address: string;
          distance_miles: number;
          rating: number | null;
          price_level: number | null;
          cuisine_types: string[];
          lat: number;
          lng: number;
        };
        Insert: {
          place_id: string;
          created_at?: string;
          name: string;
          address?: string;
          distance_miles?: number;
          rating?: number | null;
          price_level?: number | null;
          cuisine_types?: string[];
          lat?: number;
          lng?: number;
        };
        Update: Partial<Database['public']['Tables']['favorite_restaurants']['Insert']>;
        Relationships: [];
      };
      meal_plan: {
        Row: {
          id: string;
          created_at: string;
          plan_date: string;
          type: 'recipe' | 'leftovers' | 'eat_out' | 'empty';
          recipe_id: string | null;
          recipe_name: string | null;
          note: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          plan_date: string;
          type: string;
          recipe_id?: string | null;
          recipe_name?: string | null;
          note?: string | null;
        };
        Update: Partial<Database['public']['Tables']['meal_plan']['Insert']>;
        Relationships: [];
      };
      shopping_checks: {
        Row: {
          week_start: string;
          checked_keys: unknown;
        };
        Insert: {
          week_start: string;
          checked_keys?: unknown;
        };
        Update: Partial<Database['public']['Tables']['shopping_checks']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
