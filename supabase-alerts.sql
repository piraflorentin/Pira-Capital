-- Run once in Supabase Dashboard → SQL Editor (same place as before).
-- Alert preferences + sent-alert log for ETF price & news notifications.
create table if not exists alert_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  min_move_pct numeric not null default 2.0,
  price_alerts boolean not null default true,
  news_alerts boolean not null default true,
  updated_at timestamptz default now()
);
alter table alert_prefs enable row level security;
drop policy if exists "own prefs only" on alert_prefs;
create policy "own prefs only" on alert_prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant all on table alert_prefs to authenticated;

create table if not exists alert_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  kind text not null,
  ticker text not null default '',
  title text not null default '',
  created_at timestamptz default now()
);
alter table alert_log enable row level security;
drop policy if exists "own log only" on alert_log;
create policy "own log only" on alert_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant all on table alert_log to authenticated;
