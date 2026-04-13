-- Run this in the Supabase SQL editor to add sections support
-- The sections column stores optional recipe sections (spice rub, sauce, etc.)
ALTER TABLE public.custom_recipes
  ADD COLUMN IF NOT EXISTS sections jsonb DEFAULT NULL;
