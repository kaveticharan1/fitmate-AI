-- FitMate buddy mode: small groups of friends sharing a daily summary they choose.
-- Applied to Supabase project "fitmate-buddies" (xhfnsvtzwikdmjzgduvb, ap-south-1, free plan).
-- Tables live in a private schema; the app talks only to the six RPC functions below,
-- and each one checks the member's secret (stored only in the phone's secure storage).
create extension if not exists pgcrypto with schema extensions;

create schema if not exists buddy;
revoke all on schema buddy from public, anon, authenticated;

create table buddy.groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table buddy.members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references buddy.groups(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  secret_hash text not null,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index members_group_idx on buddy.members(group_id);

create table buddy.summaries (
  member_id uuid primary key references buddy.members(id) on delete cascade,
  day date not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table buddy.cheers (
  id bigint generated always as identity primary key,
  group_id uuid not null references buddy.groups(id) on delete cascade,
  from_member uuid not null references buddy.members(id) on delete cascade,
  to_member uuid not null references buddy.members(id) on delete cascade,
  kind text not null check (kind in ('clap', 'fire', 'strong', 'water', 'walk')),
  created_at timestamptz not null default now()
);
create index cheers_to_idx on buddy.cheers(to_member, created_at desc);
create index cheers_from_idx on buddy.cheers(from_member, created_at desc);

alter table buddy.groups enable row level security;
alter table buddy.members enable row level security;
alter table buddy.summaries enable row level security;
alter table buddy.cheers enable row level security;

-- ── helpers (not callable by the app) ───────────────────────────────────────
create function buddy.check_secret(p_secret text) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_secret is null or char_length(p_secret) < 32 or char_length(p_secret) > 128 then
    raise exception 'bad_secret';
  end if;
end $$;

create function buddy.clean_name(p_name text, p_max int) returns text
language plpgsql immutable set search_path = '' as $$
declare v text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if char_length(v) < 1 or char_length(v) > p_max then
    raise exception 'bad_name';
  end if;
  return v;
end $$;

create function buddy.auth_member(p_member uuid, p_secret text) returns buddy.members
language plpgsql security definer set search_path = '' as $$
declare m buddy.members;
begin
  select * into m from buddy.members
   where id = p_member and secret_hash = extensions.crypt(p_secret, secret_hash);
  if not found then
    raise exception 'not_member';
  end if;
  update buddy.members set last_seen = now() where id = m.id;
  return m;
end $$;

create function buddy.num(p jsonb, k text, lo numeric, hi numeric) returns numeric
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p -> k) = 'number'
              then least(greatest((p ->> k)::numeric, lo), hi) end
$$;

-- Keeps only known fields, within sane ranges.
create function buddy.clean_summary(p jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'steps',         round(buddy.num(p, 'steps', 0, 100000)),
    'stepGoal',      round(buddy.num(p, 'stepGoal', 1000, 50000)),
    'workoutsWeek',  round(buddy.num(p, 'workoutsWeek', 0, 21)),
    'waterDaysWeek', round(buddy.num(p, 'waterDaysWeek', 0, 7)),
    'waterPct',      round(buddy.num(p, 'waterPct', 0, 100)),
    'streak',        round(buddy.num(p, 'streak', 0, 3650)),
    'loggedToday',   case when jsonb_typeof(p -> 'loggedToday') = 'boolean' then p -> 'loggedToday' end,
    'workoutToday',  case when jsonb_typeof(p -> 'workoutToday') = 'boolean' then p -> 'workoutToday' end,
    'weightTrend',   case when p ->> 'weightTrend' in ('down', 'steady', 'up') then p -> 'weightTrend' end
  ))
$$;

create function buddy.new_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := extensions.gen_random_bytes(8);
  out text := '';
begin
  for i in 0..7 loop
    out := out || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return out;
end $$;

-- ── API for the app ─────────────────────────────────────────────────────────
create function public.buddy_create_group(p_group_name text, p_display_name text, p_secret text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g buddy.groups; m buddy.members; tries int := 0;
begin
  perform buddy.check_secret(p_secret);
  loop
    begin
      insert into buddy.groups(code, name) values (buddy.new_code(), buddy.clean_name(p_group_name, 40)) returning * into g;
      exit;
    exception when unique_violation then
      tries := tries + 1;
      if tries > 5 then raise; end if;
    end;
  end loop;
  insert into buddy.members(group_id, display_name, secret_hash)
  values (g.id, buddy.clean_name(p_display_name, 30), extensions.crypt(p_secret, extensions.gen_salt('bf', 8)))
  returning * into m;
  return jsonb_build_object('groupId', g.id, 'code', g.code, 'memberId', m.id);
end $$;

create function public.buddy_join_group(p_code text, p_display_name text, p_secret text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g buddy.groups; m buddy.members;
begin
  perform buddy.check_secret(p_secret);
  select * into g from buddy.groups where code = upper(btrim(p_code));
  if not found then raise exception 'no_group'; end if;
  if (select count(*) from buddy.members where group_id = g.id) >= 20 then raise exception 'group_full'; end if;
  insert into buddy.members(group_id, display_name, secret_hash)
  values (g.id, buddy.clean_name(p_display_name, 30), extensions.crypt(p_secret, extensions.gen_salt('bf', 8)))
  returning * into m;
  return jsonb_build_object('groupId', g.id, 'code', g.code, 'memberId', m.id);
end $$;

create function public.buddy_push_summary(p_member uuid, p_secret text, p_day date, p_data jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare m buddy.members;
begin
  m := buddy.auth_member(p_member, p_secret);
  if p_day < current_date - 2 or p_day > current_date + 1 then raise exception 'bad_day'; end if;
  insert into buddy.summaries(member_id, day, data, updated_at)
  values (m.id, p_day, buddy.clean_summary(coalesce(p_data, '{}'::jsonb)), now())
  on conflict (member_id) do update set day = excluded.day, data = excluded.data, updated_at = now();
end $$;

create function public.buddy_get_group(p_member uuid, p_secret text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m buddy.members; g buddy.groups;
begin
  m := buddy.auth_member(p_member, p_secret);
  select * into g from buddy.groups where id = m.group_id;
  return jsonb_build_object(
    'group', jsonb_build_object('id', g.id, 'name', g.name, 'code', g.code),
    'me', m.id,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'name', x.display_name, 'lastSeen', x.last_seen,
        'day', s.day, 'summary', s.data, 'updatedAt', s.updated_at
      ) order by x.joined_at)
      from buddy.members x left join buddy.summaries s on s.member_id = x.id
      where x.group_id = g.id), '[]'::jsonb),
    'cheers', coalesce((
      select jsonb_agg(jsonb_build_object('from', f.display_name, 'kind', c.kind, 'at', c.created_at) order by c.created_at desc)
      from (select * from buddy.cheers where to_member = m.id and created_at > now() - interval '7 days'
            order by created_at desc limit 20) c
      join buddy.members f on f.id = c.from_member), '[]'::jsonb)
  );
end $$;

create function public.buddy_send_cheer(p_member uuid, p_secret text, p_to uuid, p_kind text) returns void
language plpgsql security definer set search_path = '' as $$
declare m buddy.members;
begin
  m := buddy.auth_member(p_member, p_secret);
  if p_to = m.id or not exists (select 1 from buddy.members where id = p_to and group_id = m.group_id) then
    raise exception 'bad_target';
  end if;
  if (select count(*) from buddy.cheers where from_member = m.id and created_at > now() - interval '1 day') >= 30 then
    raise exception 'too_many';
  end if;
  insert into buddy.cheers(group_id, from_member, to_member, kind) values (m.group_id, m.id, p_to, p_kind);
end $$;

create function public.buddy_leave_group(p_member uuid, p_secret text) returns void
language plpgsql security definer set search_path = '' as $$
declare m buddy.members;
begin
  m := buddy.auth_member(p_member, p_secret);
  delete from buddy.members where id = m.id;
  delete from buddy.groups g where g.id = m.group_id and not exists (select 1 from buddy.members x where x.group_id = g.id);
end $$;

-- Only the six API functions are callable from the app.
revoke execute on all functions in schema buddy from public, anon, authenticated;
revoke execute on function public.buddy_create_group(text, text, text), public.buddy_join_group(text, text, text),
  public.buddy_push_summary(uuid, text, date, jsonb), public.buddy_get_group(uuid, text),
  public.buddy_send_cheer(uuid, text, uuid, text), public.buddy_leave_group(uuid, text) from public;
grant execute on function public.buddy_create_group(text, text, text), public.buddy_join_group(text, text, text),
  public.buddy_push_summary(uuid, text, date, jsonb), public.buddy_get_group(uuid, text),
  public.buddy_send_cheer(uuid, text, uuid, text), public.buddy_leave_group(uuid, text) to anon, authenticated;
