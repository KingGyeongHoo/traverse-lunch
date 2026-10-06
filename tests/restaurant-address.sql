-- Run against the configured company database. All test writes are rolled back.
begin;
select set_config('request.jwt.claim.sub',
  (select user_id::text from public.lunch_members order by team_id, user_id limit 1), true);
set local role authenticated;
do $$
declare
  team uuid := (select team_id from public.lunch_members where user_id = auth.uid() limit 1);
  before_count integer;
  result jsonb;
  item jsonb;
  restaurant_id text;
  details jsonb := jsonb_build_object('name', '__address_transaction_test__', 'category', '한식',
    'distance', '멂', 'note', '', 'closedDays', '[]'::jsonb,
    'address', '서울 영등포구 양평로 12', 'latitude', 37.5326909883438, 'longitude', 126.90489166462);
begin
  if team is null then raise exception 'A company member is required for this test'; end if;
  before_count := jsonb_array_length(public.lunch_snapshot(team)->'restaurants');
  result := public.lunch_mutate(team, 'save', jsonb_build_object('input', details));
  select r into item from jsonb_array_elements(result->'restaurants') r where r->>'name' = '__address_transaction_test__';
  restaurant_id := item->>'id';
  if restaurant_id is null or item->>'distanceMeters' <> '0' or item->>'distance' <> '가까움'
    or item->>'address' <> '서울 영등포구 양평로 12' or item->>'note' <> '' then
    raise exception 'Address registration failed: %', item;
  end if;
  if jsonb_array_length(result->'restaurants') <> before_count + 1 then raise exception 'Unexpected row count'; end if;

  details := details || jsonb_build_object('latitude', 37.5426909883438);
  result := public.lunch_mutate(team, 'save', jsonb_build_object('id', restaurant_id, 'input', details));
  select r into item from jsonb_array_elements(result->'restaurants') r where r->>'id' = restaurant_id;
  if item->>'distanceMeters' <> '1112' or item->>'distance' <> '매우 멂' then raise exception 'Address update failed'; end if;

  details := details - 'address' - 'latitude' - 'longitude';
  result := public.lunch_mutate(team, 'save', jsonb_build_object('id', restaurant_id, 'input', details));
  select r into item from jsonb_array_elements(result->'restaurants') r where r->>'id' = restaurant_id;
  if item->>'distanceMeters' <> '1112' or item->>'address' <> '서울 영등포구 양평로 12' then
    raise exception 'Legacy edits must preserve location';
  end if;

  details := details || jsonb_build_object('address', '', 'latitude', null, 'longitude', null, 'distance', null);
  result := public.lunch_mutate(team, 'save', jsonb_build_object('id', restaurant_id, 'input', details));
  select r into item from jsonb_array_elements(result->'restaurants') r where r->>'id' = restaurant_id;
  if item->>'address' <> '' or item->>'distanceMeters' is not null or item->>'latitude' is not null then
    raise exception 'Address clearing failed';
  end if;

  begin
    perform public.lunch_snapshot('00000000-0000-0000-0000-000000000000'::uuid);
    raise exception using errcode = 'XX000', message = 'Membership check failed';
  exception when sqlstate 'P0001' then null;
  end;
end $$;
rollback;
select 'Address persistence checks passed; test writes rolled back' as result,
  count(*) as restaurants,
  count(*) filter (where distance_meters is not null) as measured_restaurants,
  count(*) filter (where note <> '') as nonempty_notes
from public.lunch_restaurants;
