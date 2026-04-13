// Hand-written stub — regenerate with:
// npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/supabase.ts

export interface Database {
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
        Insert: Omit<Database['public']['Tables']['custom_restaurants']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['custom_restaurants']['Insert']>;
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
          image_url: string | null;
        };
        Insert: Omit<Database['public']['Tables']['custom_recipes']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['custom_recipes']['Insert']>;
      };
    };
  };
}
