-- Run in Supabase SQL editor
CREATE TABLE IF NOT EXISTS public.favorite_restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id text UNIQUE NOT NULL,
  name text NOT NULL,
  address text NOT NULL DEFAULT '',
  distance_miles numeric DEFAULT 0,
  rating numeric,
  price_level integer,
  cuisine_types text[] DEFAULT '{}',
  lat numeric DEFAULT 0,
  lng numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.favorite_restaurants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON public.favorite_restaurants FOR ALL USING (true) WITH CHECK (true);
