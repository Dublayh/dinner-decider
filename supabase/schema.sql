-- Run in Supabase SQL editor

create table if not exists public.custom_restaurants (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null,
  address       text not null default '',
  distance_miles numeric(5,2) not null default 0,
  rating        numeric(2,1),
  price_level   smallint check (price_level between 1 and 4),
  cuisine_types text[] not null default '{}',
  lat           numeric(10,7) not null default 0,
  lng           numeric(10,7) not null default 0
);

create table if not exists public.custom_recipes (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  name             text not null,
  cuisine          text not null default 'Custom',
  effort           text not null default 'medium'
                     check (effort in ('quick', 'medium', 'weekend')),
  ready_in_minutes integer not null default 0,
  servings         integer not null default 2,
  ingredients      jsonb not null default '[]',
  steps            jsonb not null default '[]',
  image_url        text
);

alter table public.custom_restaurants enable row level security;
alter table public.custom_recipes enable row level security;

create policy "allow all on custom_restaurants"
  on public.custom_restaurants for all using (true) with check (true);

create policy "allow all on custom_recipes"
  on public.custom_recipes for all using (true) with check (true);
