-- pd1-flashcards: last generated card set per week + selected week
-- Table shape after the PD1 Hub migration: one row per signed-in user,
-- readable and writable only by its owner.
-- On an existing project, run pd1-hub/supabase/pd1hub_migration.sql instead;
-- this file is for reference and for setting up a fresh project. Safe to re-run.

create table if not exists public.pd1_flashcards (
  user_id    uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  id         int  not null default 1,  -- legacy, from before PD1 Hub
  cards_by_week jsonb not null default '{}'::jsonb,
  selected_week int  not null default 1,
  updated_at    timestamptz not null default now()
);

alter table public.pd1_flashcards enable row level security;

drop policy if exists "owner select" on public.pd1_flashcards;
drop policy if exists "owner insert" on public.pd1_flashcards;
drop policy if exists "owner update" on public.pd1_flashcards;
drop policy if exists "owner delete" on public.pd1_flashcards;

create policy "owner select" on public.pd1_flashcards for select to authenticated using (user_id = auth.uid());
create policy "owner insert" on public.pd1_flashcards for insert to authenticated with check (user_id = auth.uid());
create policy "owner update" on public.pd1_flashcards for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner delete" on public.pd1_flashcards for delete to authenticated using (user_id = auth.uid());
