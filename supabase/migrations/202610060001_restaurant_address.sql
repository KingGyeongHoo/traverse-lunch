begin;

alter table public.lunch_restaurants
  add column address text not null default '' check (char_length(address) <= 200),
  add column latitude double precision check (latitude between -90 and 90),
  add column longitude double precision check (longitude between -180 and 180),
  add column distance_meters integer check (distance_meters between 0 and 20015115);

create function lunch_private.set_restaurant_location() returns trigger
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
    new.distance := case when new.distance_meters <= 300 then '가까움'
      when new.distance_meters <= 600 then '중간' else '멂' end;
  end if;
  return new;
end $$;

create trigger lunch_restaurant_location
before insert or update on public.lunch_restaurants
for each row execute function lunch_private.set_restaurant_location();

-- Preserve the measured office distances without restoring deleted notes.
update public.lunch_restaurants r
set distance_meters = measured.meters
from (values
  ('582d3c62-e441-46c3-8e19-1b9198c40d07'::uuid, 0),
  ('c8c0ae9f-88ba-48f7-9f10-477a5e25697c'::uuid, 22),
  ('60c97872-edb7-4433-b0e1-04ab5a27eeb2'::uuid, 30),
  ('7c293c95-a9d2-488c-a302-c1710632f079'::uuid, 31),
  ('3f527e0c-c6df-4af8-9330-da93c71a1022'::uuid, 31),
  ('29f43b97-ecc8-47ac-b88e-ee6444180713'::uuid, 38),
  ('c1b11d52-c04d-49ec-9201-2fe9505bc061'::uuid, 53),
  ('595e779f-58be-4532-9800-a4b660138b16'::uuid, 62),
  ('23e9693f-8445-462b-baaa-26699d65ae8f'::uuid, 67),
  ('2272a7eb-98d6-4bed-91fa-f037cbb6e2cd'::uuid, 72),
  ('5d3ddb9b-a0e4-4773-82e9-fe1963d99a43'::uuid, 73),
  ('30b2101a-9b3d-4acd-8ed0-652f306fbee8'::uuid, 93),
  ('54c94cb0-62e0-449d-80ae-72e21e75465a'::uuid, 101),
  ('cd9475ae-2e8f-4229-b6d2-18035f769e3c'::uuid, 112),
  ('aa21011f-03a2-40cb-aa12-44abb25b3967'::uuid, 117),
  ('7c950699-b75f-4756-912c-57cc913c70c8'::uuid, 120),
  ('3cd8fc32-a478-4a33-a130-fa1dcce2b1a2'::uuid, 126),
  ('633081ae-0b31-4843-8c59-f0ddb0aae961'::uuid, 151),
  ('90304390-fcce-4deb-a1d8-66262547ae6b'::uuid, 153),
  ('dc527921-f04a-4b09-91c8-191dec3cc5ce'::uuid, 157),
  ('a4627aa9-a3ec-41dd-a01b-88f42434075c'::uuid, 160),
  ('4e156c53-657c-4781-9219-24368dce1ff4'::uuid, 170),
  ('727f3674-cb33-40b9-b417-b2ca84db3f7d'::uuid, 235),
  ('1e02b6bd-3a39-4759-8555-02f4a43beac5'::uuid, 237),
  ('25334044-4b27-4a3a-96b6-95cbeefeb3bb'::uuid, 237),
  ('2664df00-eca1-4dc7-8fbc-23ce25a02296'::uuid, 238),
  ('701dc777-6c68-41fd-8e73-e9bc6999358d'::uuid, 241),
  ('1e95632a-f1d6-45ce-be33-cf9d211351c2'::uuid, 516),
  ('ea0ffa25-9ee7-4bb8-9cc6-7f1e88082b54'::uuid, 510),
  ('d08f676d-a5da-41d8-b796-6963672140d1'::uuid, 538),
  ('2a5cf5ca-02ab-42f1-aac6-b424847784b3'::uuid, 501),
  ('8e881c56-b7a3-4039-96f3-4c6f5984daa6'::uuid, 561),
  ('c3327d3e-1128-49e3-8073-1c007e993130'::uuid, 593),
  ('4e0afb01-cdd9-4d5c-adaf-e99bcdffd7ee'::uuid, 600),
  ('ab4386ab-1e24-4135-8f8c-cf87fcb796dc'::uuid, 600),
  ('457f9987-87c9-47f5-8086-550e4b607de1'::uuid, 542),
  ('5b9cb1c1-f9d6-4bc7-b996-d165e4dd978f'::uuid, 490),
  ('fe50c097-bd2b-4f56-b392-41d7e19078cf'::uuid, 561),
  ('2c14b215-e880-44b0-9504-6e56abffec5c'::uuid, 561),
  ('3991e776-8d65-4248-98ac-8f8e44457eb1'::uuid, 542),
  ('5de7ff83-6e1b-4369-9b73-8d0f37d4e3d0'::uuid, 602),
  ('4dc59811-2b9a-47d5-a00c-ff214cd03d58'::uuid, 557),
  ('ecdeef70-a0e0-46c8-931e-20c84166b909'::uuid, 592),
  ('bff2cbbd-ea59-4d38-8391-7f5478bcb1be'::uuid, 580),
  ('be382a9e-fb03-48b7-bcab-bedc4abdcdda'::uuid, 578),
  ('fa66bca4-3654-403c-b2e3-32173028827b'::uuid, 578),
  ('b9b13c81-ffd1-4381-aaef-0e6f520e8ac6'::uuid, 634),
  ('a9c924f2-b8f4-462b-85ac-0d6f9b1f550b'::uuid, 416),
  ('9457bee9-5945-4cb7-9bd5-9e88d3f839f1'::uuid, 392),
  ('00dd76fc-ad34-4616-8190-905c76c8d6a8'::uuid, 616),
  ('e4c43eaa-d74d-4b51-bfe9-aad1b20b877c'::uuid, 616),
  ('5fab5e04-bcd2-4c93-9857-8a1a0d59243c'::uuid, 616),
  ('3fd711a7-76e0-4c41-9aa1-3d3b1ff6b185'::uuid, 616),
  ('305f4a8b-ad9d-4eee-ad69-88bcca743096'::uuid, 616),
  ('3ef5ab21-67a0-40b2-86a5-6ef71d24ada0'::uuid, 616),
  ('ced5a471-e5e9-429d-a9d7-d035eb4f5655'::uuid, 616),
  ('9fdaaefc-55a8-4f20-925b-eacba075460d'::uuid, 616),
  ('46d08f7e-2bf2-4de1-bf6e-5c4ba2963464'::uuid, 616),
  ('47a44f5a-6b13-4524-9797-a352d269ed76'::uuid, 616),
  ('e8d4691e-8375-475c-9dad-cd17aa0f1d1d'::uuid, 577),
  ('63cf9ef3-6ac8-4c06-88b4-63e280e00350'::uuid, 577),
  ('72dc1ccf-84c3-473c-bd30-659f825a5294'::uuid, 633),
  ('7731ef33-15d4-4cab-907e-2f7208dfc0b6'::uuid, 572),
  ('56eeec2e-aa7e-4e73-be16-99897fee4f0b'::uuid, 552),
  ('6f2ae030-a738-4216-81e6-c62c5d091b82'::uuid, 729),
  ('3b9aa554-dd85-4c10-8be9-2573b59e9476'::uuid, 702),
  ('513d432b-d6f9-46c2-8c99-d07f8881e77b'::uuid, 704),
  ('b13f983d-d985-4bc5-85e8-8976c23b20d4'::uuid, 644),
  ('bd5c523a-c4df-44b8-826f-fc6e51cb8fed'::uuid, 691),
  ('67e7f607-5e06-402a-8eda-8c63ab3e7aae'::uuid, 694),
  ('d89f53bc-318a-4e1f-9044-8e3dbc97671c'::uuid, 722),
  ('3c7f8468-2b78-4fb8-aab3-7369eb6b4418'::uuid, 725),
  ('9f68754c-0f5f-4b43-bcaf-51a2d839af6b'::uuid, 658),
  ('0152cc11-3e56-4e75-9d7b-102118dea4a4'::uuid, 715),
  ('cf9adcee-6b1b-4328-b80e-fab89c5022a0'::uuid, 716),
  ('77d7b24d-5dfd-434a-a769-9ee62d3b5560'::uuid, 753),
  ('b42bf472-7c1e-42dc-bdf3-4538e91a14fa'::uuid, 490),
  ('68adff39-afd4-4e70-a352-af913356ca08'::uuid, 519),
  ('8337cb0f-42c6-47ec-ac72-4449ba1e83d9'::uuid, 509),
  ('cb388d20-c9f8-4432-aab6-bc6b1a8feec3'::uuid, 486),
  ('9eb2a612-c282-484d-867e-a0d45c6f5ee7'::uuid, 527),
  ('d3dd9a14-1671-4ef9-9bfa-385653fd7e8c'::uuid, 505),
  ('332ab451-a027-4a7f-b538-afe86df60a9a'::uuid, 484),
  ('47c55ada-ad65-43a1-8339-825ffa2e37b1'::uuid, 524),
  ('dfe2cf69-2134-4b39-b5a1-0e07b6a2a800'::uuid, 501),
  ('e7d39842-7273-4a68-9278-b685e7fe3624'::uuid, 501),
  ('e0d36c5f-1e37-464e-af5c-d42671ad3af4'::uuid, 508),
  ('96377f14-21ad-4c18-9ebf-4f4b514d5c9f'::uuid, 532),
  ('3fd7894f-182a-492a-b407-c8acdfb28301'::uuid, 537),
  ('f8edc576-12a6-4807-895d-bfef69e9f692'::uuid, 480),
  ('e3cd77f9-e649-481b-8df9-3cbfa0935a1c'::uuid, 501),
  ('14928303-c3f5-445e-ab17-0a9ced00798d'::uuid, 479),
  ('e932e0bb-c137-49a4-8a38-d2060540993f'::uuid, 529),
  ('7c1e4141-f7a1-4824-a3ea-b4e02a11ce7b'::uuid, 557),
  ('0474b6b3-46ae-49bc-9f12-aaeade20ac1e'::uuid, 537),
  ('50f25684-d1c8-4841-8d29-327662b6b8ca'::uuid, 571),
  ('6fb86bde-b87e-4058-9deb-e879e491cb91'::uuid, 418),
  ('4e76068b-592d-4ef5-9387-f0a358519dcb'::uuid, 404),
  ('c8a1d5c2-a02a-4887-bdfb-f0e2dad57085'::uuid, 396)
) as measured(id, meters)
where r.id = measured.id and r.distance_meters is null;

create or replace function public.lunch_snapshot(p_team uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if not exists(select 1 from public.lunch_members where team_id = p_team and user_id = auth.uid()) then raise exception '이 팀에 참여할 수 없어요. 초대 코드로 다시 연결해 주세요.'; end if;
  return jsonb_build_object(
    'today', today::text, 'weekday', extract(dow from today)::integer,
    'restaurants', coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'name', r.name, 'category', r.category, 'distance', r.distance,
      'note', r.note, 'closedDays', r.closed_days, 'excludedDate', r.excluded_date,
      'address', r.address, 'latitude', r.latitude, 'longitude', r.longitude, 'distanceMeters', r.distance_meters
    ) order by r.created_at, r.id) from public.lunch_restaurants r where r.team_id = p_team), '[]'::jsonb)
  );
end $$;

create or replace function public.lunch_mutate(p_team uuid, p_action text, p_payload jsonb default '{}') returns jsonb
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

notify pgrst, 'reload schema';
commit;
