-- Run this in your Supabase SQL editor

create table if not exists grocery_list (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  amount text,
  unit text,
  checked boolean not null default false,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

-- Enable real-time updates for this table
alter publication supabase_realtime add table grocery_list;
