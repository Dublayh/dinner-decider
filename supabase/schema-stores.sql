-- Run this in your Supabase SQL editor.
-- Adds "which store do we buy this at?" to the shared grocery list.

-- 1. Each grocery item can be tagged with a store (name string, nullable = unassigned).
alter table grocery_list add column if not exists store text;

-- 2. The couple's list of stores (Costco, Kroger, Trader Joe's…). Order is user-controlled.
create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table stores enable row level security;
drop policy if exists "allow all" on stores;
create policy "allow all" on stores for all using (true) with check (true);

-- 3. Memory: which store an ingredient is usually bought at, keyed by normalized name.
--    Assign "milk" → Costco once and every future "milk" auto-lands there.
create table if not exists ingredient_stores (
  normalized_name text primary key,
  store text not null,
  updated_at timestamptz not null default now()
);

alter table ingredient_stores enable row level security;
drop policy if exists "allow all" on ingredient_stores;
create policy "allow all" on ingredient_stores for all using (true) with check (true);

-- 4. Real-time so both users see store-list edits sync (grocery_list is already published).
alter publication supabase_realtime add table stores;
