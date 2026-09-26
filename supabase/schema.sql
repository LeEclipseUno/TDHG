-- Wegenkenner backend: friend groups, daily scores, share previews.
-- Run once in the Supabase SQL editor. Players sign in anonymously, so auth.uid() is a stable device id.

create extension if not exists pgcrypto;

-- ---------- tables ----------
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null check (char_length(name) between 2 and 32),
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists members (
  group_id uuid not null references groups(id) on delete cascade,
  player_id uuid not null,
  nickname text not null check (char_length(nickname) between 2 and 16),
  joined_at timestamptz not null default now(),
  primary key (group_id, player_id)
);
create index if not exists members_player on members(player_id);

create table if not exists daily_scores (
  daily int not null,
  player_id uuid not null,
  nickname text,
  score int not null check (score between 0 and 100000),
  good int not null default 0,
  total int not null default 0,
  ms int not null default 0,
  created_at timestamptz not null default now(),
  primary key (daily, player_id)
);
create index if not exists daily_scores_daily on daily_scores(daily, score desc);

create table if not exists shares (
  id text primary key,
  player_id uuid not null,
  title text not null,
  text text not null,
  image text,
  param text,
  created_at timestamptz not null default now()
);

-- ---------- row level security ----------
alter table groups enable row level security;
alter table members enable row level security;
alter table daily_scores enable row level security;
alter table shares enable row level security;

drop policy if exists "own scores" on daily_scores;
create policy "own scores" on daily_scores for all to authenticated
  using (player_id = auth.uid()) with check (player_id = auth.uid());

drop policy if exists "my groups" on groups;
create policy "my groups" on groups for select to authenticated
  using (exists (select 1 from members m where m.group_id = groups.id and m.player_id = auth.uid()));

drop policy if exists "fellow members" on members;
create policy "fellow members" on members for select to authenticated
  using (exists (select 1 from members m where m.group_id = members.group_id and m.player_id = auth.uid()));

drop policy if exists "leave group" on members;
create policy "leave group" on members for delete to authenticated using (player_id = auth.uid());

drop policy if exists "own shares" on shares;
create policy "own shares" on shares for insert to authenticated with check (player_id = auth.uid());
drop policy if exists "read shares" on shares;
create policy "read shares" on shares for select to anon, authenticated using (true);

-- ---------- functions ----------
create or replace function make_code() returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1), '')
  from generate_series(1, 6);
$$;

create or replace function create_group(p_name text, p_nick text)
returns table (code text, name text) language plpgsql security definer set search_path = public as $$
declare g groups%rowtype; c text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  loop
    c := make_code();
    exit when not exists (select 1 from groups where groups.code = c);
  end loop;
  insert into groups (code, name, created_by) values (c, trim(p_name), auth.uid()) returning * into g;
  insert into members (group_id, player_id, nickname) values (g.id, auth.uid(), trim(p_nick));
  return query select g.code, g.name;
end $$;

create or replace function join_group(p_code text, p_nick text)
returns table (code text, name text) language plpgsql security definer set search_path = public as $$
declare g groups%rowtype;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into g from groups where groups.code = upper(trim(p_code));
  if not found then raise exception 'unknown group'; end if;
  insert into members (group_id, player_id, nickname) values (g.id, auth.uid(), trim(p_nick))
    on conflict (group_id, player_id) do update set nickname = excluded.nickname;
  return query select g.code, g.name;
end $$;

create or replace function my_groups()
returns table (code text, name text, members int) language sql security definer set search_path = public as $$
  select g.code, g.name, (select count(*)::int from members m2 where m2.group_id = g.id)
  from groups g join members m on m.group_id = g.id
  where m.player_id = auth.uid()
  order by m.joined_at;
$$;

create or replace function submit_daily(p_daily int, p_score int, p_good int, p_total int, p_ms int, p_nick text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into daily_scores (daily, player_id, nickname, score, good, total, ms)
    values (p_daily, auth.uid(), nullif(trim(p_nick), ''), p_score, p_good, p_total, p_ms)
    on conflict (daily, player_id) do update
      set score = greatest(daily_scores.score, excluded.score),
          good = case when excluded.score > daily_scores.score then excluded.good else daily_scores.good end,
          ms = case when excluded.score > daily_scores.score then excluded.ms else daily_scores.ms end,
          nickname = coalesce(excluded.nickname, daily_scores.nickname);
end $$;

-- Share of today's players you beat, and how many played.
create or replace function daily_percentile(p_daily int, p_score int)
returns table (better_than numeric, players int) language sql security definer set search_path = public as $$
  select case when count(*) <= 1 then null else round(100.0 * count(*) filter (where score < p_score) / (count(*) - 1), 0) end,
         count(*)::int
  from daily_scores where daily = p_daily;
$$;

-- Today's board of one group. Only members can read it.
drop function if exists group_board(text, int);
create or replace function group_board(p_code text, p_daily int)
returns table (nickname text, score int, good int, total int, ms int, played boolean, is_me boolean, plus boolean)
language sql security definer set search_path = public as $$
  select m.nickname, coalesce(s.score, 0), coalesce(s.good, 0), coalesce(s.total, 0), coalesce(s.ms, 0), s.player_id is not null, m.player_id = auth.uid(),
         exists (select 1 from premium p where p.player_id = m.player_id and p.until > now())
  from groups g
  join members m on m.group_id = g.id
  left join daily_scores s on s.player_id = m.player_id and s.daily = p_daily
  where g.code = upper(trim(p_code))
    and exists (select 1 from members me where me.group_id = g.id and me.player_id = auth.uid())
  order by s.score desc nulls last, s.ms asc nulls last, m.nickname;
$$;

-- Weekly totals of one group (the last 7 dailies including today).
drop function if exists group_week(text, int);
create or replace function group_week(p_code text, p_daily int)
returns table (nickname text, total int, days int, is_me boolean, plus boolean)
language sql security definer set search_path = public as $$
  select m.nickname, coalesce(sum(s.score), 0)::int, count(s.daily)::int, m.player_id = auth.uid(),
         exists (select 1 from premium p where p.player_id = m.player_id and p.until > now())
  from groups g
  join members m on m.group_id = g.id
  left join daily_scores s on s.player_id = m.player_id and s.daily between p_daily - 6 and p_daily
  where g.code = upper(trim(p_code))
    and exists (select 1 from members me where me.group_id = g.id and me.player_id = auth.uid())
  group by m.nickname, m.player_id
  order by 2 desc, m.nickname;
$$;

grant execute on function create_group(text, text), join_group(text, text), my_groups(), submit_daily(int, int, int, int, int, text), daily_percentile(int, int), group_board(text, int), group_week(text, int) to authenticated;

-- ---------- storage bucket for share cards ----------
insert into storage.buckets (id, name, public) values ('cards', 'cards', true) on conflict (id) do nothing;
drop policy if exists "upload cards" on storage.objects;
create policy "upload cards" on storage.objects for insert to authenticated with check (bucket_id = 'cards');
drop policy if exists "read cards" on storage.objects;
create policy "read cards" on storage.objects for select to anon, authenticated using (bucket_id = 'cards');

-- ---------- cloud save (signed-in players) ----------
create table if not exists player_state (
  player_id uuid primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table player_state enable row level security;
drop policy if exists "own state" on player_state;
create policy "own state" on player_state for all to authenticated
  using (player_id = auth.uid()) with check (player_id = auth.uid());

-- ---------- Wegenkenner Plus (yearly pass, written by the plus-hook function) ----------
create table if not exists premium (
  player_id uuid primary key,
  until timestamptz not null,
  source text,
  updated_at timestamptz not null default now()
);
alter table premium enable row level security;
drop policy if exists "own premium" on premium;
create policy "own premium" on premium for select to authenticated using (player_id = auth.uid());
grant select on premium to authenticated;
grant all on premium to service_role;
-- Give someone Plus by hand (for testing, or a gift):
--   insert into premium (player_id, until, source) values ('<player uuid>', now() + interval '1 year', 'manual')
--   on conflict (player_id) do update set until = excluded.until, source = excluded.source, updated_at = now();

-- ---------- daily reminders (Web Push) ----------
create table if not exists push_subs (
  endpoint text primary key,
  player_id uuid not null default auth.uid(),
  p256dh text not null,
  auth text not null,
  hour int not null default 18 check (hour between 0 and 23),
  minute int not null default 0 check (minute between 0 and 59),
  tz text not null default 'Europe/Amsterdam',
  lang text not null default 'nl',
  updated_at timestamptz not null default now()
);
alter table push_subs add column if not exists minute int not null default 0 check (minute between 0 and 59);
create index if not exists push_subs_player on push_subs(player_id);
alter table push_subs enable row level security;
drop policy if exists "own push subs" on push_subs;
create policy "own push subs" on push_subs for all to authenticated
  using (player_id = auth.uid()) with check (player_id = auth.uid());
grant select, insert, update, delete on push_subs to authenticated;
grant all on push_subs to service_role;

-- Trigger for the remind function, every five minutes. Enable the pg_cron and pg_net extensions first
-- (Database, Extensions), then run this once with your project ref, anon key and CRON_SECRET filled in:
--
-- select cron.schedule('remind', '*/5 * * * *', $$
--   select net.http_post(
--     url := 'https://<project-ref>.supabase.co/functions/v1/remind',
--     headers := '{"Content-Type":"application/json","Authorization":"Bearer <anon key>","x-cron-secret":"<CRON_SECRET>"}'::jsonb,
--     body := '{}'::jsonb)
-- $$);

-- ---------- referral codes (one personal Lemon Squeezy discount per Plus player, made by the referral function) ----------
create table if not exists referrals (
  player_id uuid primary key,
  code text not null unique,
  created_at timestamptz not null default now()
);
alter table referrals enable row level security;
drop policy if exists "own referral" on referrals;
create policy "own referral" on referrals for select to authenticated using (player_id = auth.uid());
grant select on referrals to authenticated;
grant all on referrals to service_role;

-- ---------- crash log (written by the app, read only in the dashboard) ----------
create table if not exists errors (
  id bigint generated always as identity primary key,
  player_id uuid default auth.uid(),
  message text not null,
  stack text,
  "where" text,
  url text,
  ua text,
  build text,
  lang text,
  screen text,
  created_at timestamptz not null default now()
);
create index if not exists errors_created on errors(created_at desc);
alter table errors enable row level security;
drop policy if exists "write errors" on errors;
create policy "write errors" on errors for insert to authenticated with check (true);
grant insert on errors to authenticated;
grant all on errors to service_role;
-- Look at them with:  select created_at, build, message, "where", ua from errors order by created_at desc limit 50;
-- Clean up old rows now and then:  delete from errors where created_at < now() - interval '60 days';
