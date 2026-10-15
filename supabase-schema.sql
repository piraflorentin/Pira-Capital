-- Run once in Supabase Dashboard → SQL Editor → New query → Run.
-- Creates one private per-user shelf for favorites, comparisons and picks.
create table if not exists user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}',
  updated_at timestamptz default now()
);
alter table user_state enable row level security;
drop policy if exists "own state only" on user_state;
create policy "own state only" on user_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant usage on schema public to anon, authenticated;
grant all on table user_state to authenticated;
