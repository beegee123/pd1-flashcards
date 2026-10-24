-- pd1-flashcards: last generated card set per week + selected week (single row, id = 1)
-- Run in the Supabase SQL Editor of the shared project. Safe to re-run.

create table if not exists public.pd1_flashcards (
  id            int primary key default 1,
  cards_by_week jsonb not null default '{}'::jsonb,
  selected_week int  not null default 1,
  updated_at    timestamptz not null default now()
);

-- The app uses the public anon key from the browser, so allow anon
-- to read/write this table only.
alter table public.pd1_flashcards enable row level security;

drop policy if exists "anon read"   on public.pd1_flashcards;
drop policy if exists "anon insert" on public.pd1_flashcards;
drop policy if exists "anon update" on public.pd1_flashcards;

create policy "anon read"   on public.pd1_flashcards for select to anon using (true);
create policy "anon insert" on public.pd1_flashcards for insert to anon with check (true);
create policy "anon update" on public.pd1_flashcards for update to anon using (true) with check (true);
