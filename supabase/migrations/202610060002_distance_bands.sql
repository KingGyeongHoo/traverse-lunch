begin;

alter table public.lunch_restaurants drop constraint lunch_restaurants_distance_check;
alter table public.lunch_restaurants add constraint lunch_restaurants_distance_check
  check (distance in ('가까움', '중간', '멂', '매우 멂'));

create or replace function lunch_private.set_restaurant_location() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.address := btrim(new.address);
  if new.address <> '' then
    if new.latitude is null or new.longitude is null
      or not (new.latitude between -90 and 90)
      or not (new.longitude between -180 and 180) then
      raise exception '주소와 좌표를 확인해 주세요.';
    end if;
    new.distance_meters := round(6371008.8 * 2 * asin(sqrt(least(1.0, greatest(0.0,
      power(sin(radians(new.latitude - 37.5326909883438) / 2), 2) +
      cos(radians(37.5326909883438)) * cos(radians(new.latitude)) *
      power(sin(radians(new.longitude - 126.90489166462) / 2), 2)
    )))))::integer;
  else
    if new.latitude is not null or new.longitude is not null then
      raise exception '주소와 좌표를 함께 입력해 주세요.';
    end if;
    if tg_op = 'UPDATE' and old.address <> '' then new.distance_meters := null; end if;
  end if;
  if new.distance_meters is not null then
    new.distance := case when new.distance_meters <= 250 then '가까움'
      when new.distance_meters <= 500 then '중간'
      when new.distance_meters <= 750 then '멂' else '매우 멂' end;
  end if;
  return new;
end $$;


-- Reclassify measured restaurants; keep names, notes and closures unchanged.
update public.lunch_restaurants set distance_meters = distance_meters
where distance_meters is not null;

create or replace function public.lunch_mutate(p_team uuid, p_action text, p_payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  snapshot jsonb;
  picked jsonb;
  input jsonb := p_payload->'input';
  max_distance text := coalesce(p_payload->>'distance', '매우 멂');
begin
  if not exists(select 1 from public.lunch_members where team_id = p_team and user_id = auth.uid()) then raise exception '이 팀에 참여할 수 없어요. 초대 코드로 다시 연결해 주세요.'; end if;
  if p_action = 'save' then
    if input is null or jsonb_typeof(input) <> 'object' or jsonb_typeof(input->'closedDays') is distinct from 'array' or jsonb_typeof(input->'name') is distinct from 'string' or jsonb_typeof(input->'category') is distinct from 'string' or jsonb_typeof(input->'note') is distinct from 'string' then raise exception '식당 정보를 확인해 주세요.'; end if;
    if input ? 'address' and jsonb_typeof(input->'address') is distinct from 'string' then
      raise exception '주소 형식을 확인해 주세요.';
    end if;
    if p_payload->>'id' is null then
      insert into public.lunch_restaurants(team_id, name, category, distance, note, closed_days, address, latitude, longitude)
      values (p_team, btrim(input->>'name'), input->>'category', input->>'distance', btrim(input->>'note'), array(select jsonb_array_elements_text(input->'closedDays')::integer), coalesce(btrim(input->>'address'), ''), (input->>'latitude')::double precision, (input->>'longitude')::double precision);
    else
      update public.lunch_restaurants set name = btrim(input->>'name'), category = input->>'category', distance = input->>'distance', note = btrim(input->>'note'), closed_days = array(select jsonb_array_elements_text(input->'closedDays')::integer),
        address = case when input ? 'address' then btrim(input->>'address') else address end,
        latitude = case when input ? 'address' then (input->>'latitude')::double precision else latitude end,
        longitude = case when input ? 'address' then (input->>'longitude')::double precision else longitude end
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
    if max_distance not in ('가까움', '중간', '멂', '매우 멂', 'all') then raise exception '거리 조건을 확인해 주세요.'; end if;
  else raise exception '지원하지 않는 작업이에요.';
  end if;
  snapshot := public.lunch_snapshot(p_team);
  if p_action = 'pick' then
    -- Pick from the same snapshot returned to the app; use database time.
    select item into picked from jsonb_array_elements(snapshot->'restaurants') item
    where not (item->'closedDays' @> jsonb_build_array((snapshot->>'weekday')::integer))
      and (item->>'excludedDate') is distinct from snapshot->>'today'
      and (max_distance in ('매우 멂', 'all') or item->>'distance' = '가까움' or (max_distance in ('중간', '멂') and item->>'distance' = '중간') or (max_distance = '멂' and item->>'distance' = '멂'))
    order by random() limit 1;
    if picked is null then raise exception '오늘 조건에 맞는 식당이 없어요.'; end if;
    snapshot := snapshot || jsonb_build_object('picked', picked);
  end if;
  return snapshot;
end $$;

notify pgrst, 'reload schema';
commit;
