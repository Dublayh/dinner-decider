-- Run in Supabase SQL editor
create table if not exists public.meal_plan (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  plan_date   date not null unique,
  type        text not null check (type in ('recipe', 'leftovers', 'eat_out', 'empty')),
  recipe_id   uuid references public.custom_recipes(id) on delete set null,
  recipe_name text,
  note        text
);

alter table public.meal_plan enable row level security;
create policy "allow all on meal_plan"
  on public.meal_plan for all using (true) with check (true);

-- If table already exists, just update the constraint:
-- alter table public.meal_plan drop constraint if exists meal_plan_type_check;
-- alter table public.meal_plan add constraint meal_plan_type_check check (type in ('recipe', 'leftovers', 'eat_out', 'empty'));

-- Shopping list checked items
create table if not exists public.shopping_checks (
  week_start  date not null primary key,
  checked_keys jsonb not null default '[]'
);

alter table public.shopping_checks enable row level security;
create policy "allow all on shopping_checks"
  on public.shopping_checks for all using (true) with check (true);
