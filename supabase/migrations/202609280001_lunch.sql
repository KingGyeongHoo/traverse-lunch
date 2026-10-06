begin;

create schema if not exists lunch_private;
revoke all on schema lunch_private from public, anon;
grant usage on schema lunch_private to authenticated;

create table public.lunch_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 50),
  invite_code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.lunch_members (
  team_id uuid not null references public.lunch_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (team_id, user_id)
);
create index lunch_members_user_idx on public.lunch_members(user_id);
create table public.lunch_restaurants (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.lunch_teams(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 50),
  category text not null check (category in ('한식', '중식', '일식', '양식', '분식', '기타')),
  distance text check (distance in ('가까움', '중간', '멂')),
  note text not null default '' check (char_length(note) <= 200),
  closed_days integer[] not null default '{}' check (closed_days <@ array[0,1,2,3,4,5,6] and array_position(closed_days, null) is null),
  excluded_date date,
  created_at timestamptz not null default now()
);
create index lunch_restaurants_team_idx on public.lunch_restaurants(team_id);

alter table public.lunch_teams enable row level security;
alter table public.lunch_members enable row level security;
alter table public.lunch_restaurants enable row level security;
revoke all on public.lunch_teams, public.lunch_members, public.lunch_restaurants from anon, authenticated;
grant select on public.lunch_teams, public.lunch_members to authenticated;
grant select, insert, update, delete on public.lunch_restaurants to authenticated;

create policy members_read_self on public.lunch_members for select to authenticated using (user_id = (select auth.uid()));
create policy teams_read_members on public.lunch_teams for select to authenticated using (id in (select team_id from public.lunch_members where user_id = (select auth.uid())));
create policy restaurants_members on public.lunch_restaurants for all to authenticated
  using (team_id in (select team_id from public.lunch_members where user_id = (select auth.uid())))
  with check (team_id in (select team_id from public.lunch_members where user_id = (select auth.uid())));

-- Only these two private functions bypass RLS to create memberships.
-- They always derive user identity from the signed JWT, never client arguments.
create function lunch_private.create_team(p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.lunch_teams;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요.'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 50 then raise exception '팀 이름은 1~50자로 입력해 주세요.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  if (select count(*) from public.lunch_teams where created_by = auth.uid()) >= 10 then raise exception '만들 수 있는 팀 수를 초과했어요.'; end if;
  insert into public.lunch_teams(name, created_by) values (btrim(p_name), auth.uid()) returning * into t;
  insert into public.lunch_members(team_id, user_id) values (t.id, auth.uid());
  return jsonb_build_object('id', t.id, 'name', t.name, 'inviteCode', t.invite_code);
end $$;
create function lunch_private.join_team(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.lunch_teams;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요.'; end if;
  if p_code is null or lower(btrim(p_code)) !~ '^[a-f0-9]{32}$' then raise exception '초대 코드를 확인해 주세요.'; end if;
  select * into t from public.lunch_teams where invite_code = lower(btrim(p_code));
  if not found then raise exception '초대 코드를 확인해 주세요.'; end if;
  insert into public.lunch_members(team_id, user_id) values (t.id, auth.uid()) on conflict do nothing;
  return jsonb_build_object('id', t.id, 'name', t.name, 'inviteCode', t.invite_code);
end $$;
create function public.lunch_create_team(p_name text) returns jsonb
language sql security invoker set search_path = '' as $$ select lunch_private.create_team(p_name) $$;
create function public.lunch_join_team(p_code text) returns jsonb
language sql security invoker set search_path = '' as $$ select lunch_private.join_team(p_code) $$;

create function public.lunch_snapshot(p_team uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if not exists(select 1 from public.lunch_members where team_id = p_team and user_id = auth.uid()) then raise exception '이 팀에 참여할 수 없어요. 초대 코드로 다시 연결해 주세요.'; end if;
  return jsonb_build_object(
    'today', today::text, 'weekday', extract(dow from today)::integer,
    'restaurants', coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'name', r.name, 'category', r.category, 'distance', r.distance,
      'note', r.note, 'closedDays', r.closed_days, 'excludedDate', r.excluded_date
    ) order by r.created_at, r.id) from public.lunch_restaurants r where r.team_id = p_team), '[]'::jsonb)
  );
end $$;

create function public.lunch_mutate(p_team uuid, p_action text, p_payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  snapshot jsonb;
  picked jsonb;
  input jsonb := p_payload->'input';
  max_distance text := coalesce(p_payload->>'distance', '멂');
begin
  if not exists(select 1 from public.lunch_members where team_id = p_team and user_id = auth.uid()) then raise exception '이 팀에 참여할 수 없어요. 초대 코드로 다시 연결해 주세요.'; end if;
  if p_action = 'save' then
    if input is null or jsonb_typeof(input) <> 'object' or jsonb_typeof(input->'closedDays') is distinct from 'array' or jsonb_typeof(input->'name') is distinct from 'string' or jsonb_typeof(input->'category') is distinct from 'string' or jsonb_typeof(input->'note') is distinct from 'string' then raise exception '식당 정보를 확인해 주세요.'; end if;
    if p_payload->>'id' is null then
      insert into public.lunch_restaurants(team_id, name, category, distance, note, closed_days)
      values (p_team, btrim(input->>'name'), input->>'category', input->>'distance', btrim(input->>'note'), array(select jsonb_array_elements_text(input->'closedDays')::integer));
    else
      update public.lunch_restaurants set name = btrim(input->>'name'), category = input->>'category', distance = input->>'distance', note = btrim(input->>'note'), closed_days = array(select jsonb_array_elements_text(input->'closedDays')::integer)
      where id = (p_payload->>'id')::uuid and team_id = p_team;
      if not found then raise exception '식당을 찾을 수 없어요. 목록을 새로고침해 주세요.'; end if;
    end if;
  elsif p_action = 'delete' then
    delete from public.lunch_restaurants where id = (p_payload->>'id')::uuid and team_id = p_team;
    if not found then raise exception '식당을 찾을 수 없어요. 목록을 새로고침해 주세요.'; end if;
  elsif p_action = 'exclude' then
    if jsonb_typeof(p_payload->'excludedToday') is distinct from 'boolean' then raise exception '제외 설정을 확인해 주세요.'; end if;
    update public.lunch_restaurants set excluded_date = case when (p_payload->>'excludedToday')::boolean then today else null end
      where id = (p_payload->>'id')::uuid and team_id = p_team;
    if not found then raise exception '식당을 찾을 수 없어요. 목록을 새로고침해 주세요.'; end if;
  elsif p_action = 'pick' then
    if max_distance not in ('가까움', '중간', '멂', 'all') then raise exception '거리 조건을 확인해 주세요.'; end if;
  else raise exception '지원하지 않는 작업이에요.';
  end if;
  snapshot := public.lunch_snapshot(p_team);
  if p_action = 'pick' then
    -- Pick from the same snapshot returned to the app; use database time.
    select item into picked from jsonb_array_elements(snapshot->'restaurants') item
    where not (item->'closedDays' @> jsonb_build_array((snapshot->>'weekday')::integer))
      and (item->>'excludedDate') is distinct from snapshot->>'today'
      and (max_distance in ('멂', 'all') or item->>'distance' = '가까움' or (max_distance = '중간' and item->>'distance' = '중간'))
    order by random() limit 1;
    if picked is null then raise exception '오늘 조건에 맞는 식당이 없어요.'; end if;
    snapshot := snapshot || jsonb_build_object('picked', picked);
  end if;
  return snapshot;
end $$;

revoke all on function lunch_private.create_team(text), lunch_private.join_team(text) from public, anon;
grant execute on function lunch_private.create_team(text), lunch_private.join_team(text) to authenticated;
revoke all on function public.lunch_create_team(text), public.lunch_join_team(text), public.lunch_snapshot(uuid), public.lunch_mutate(uuid,text,jsonb) from public, anon;
grant execute on function public.lunch_create_team(text), public.lunch_join_team(text), public.lunch_snapshot(uuid), public.lunch_mutate(uuid,text,jsonb) to authenticated;

commit;
