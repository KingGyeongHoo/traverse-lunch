-- Exercise the real RPC and unique index without retaining fixture rows.
begin;
select set_config('request.jwt.claim.sub',
  (select user_id::text from public.lunch_members order by team_id, user_id limit 1), true);
set local role authenticated;
do $$
declare
  team uuid := (select team_id from public.lunch_members where user_id = auth.uid() limit 1);
  details jsonb := jsonb_build_object('name', '__Duplicate 식당__', 'category', '한식',
    'distance', null, 'note', '', 'closedDays', '[]'::jsonb,
    'address', '서울 영등포구 양평로 12', 'latitude', 37.5326909883438, 'longitude', 126.90489166462);
  result jsonb;
  first_id text;
  second_id text;
  variant text;
  constraint_name text;
begin
  result := public.lunch_mutate(team, 'save', jsonb_build_object('input', details));
  select r->>'id' into first_id from jsonb_array_elements(result->'restaurants') r where r->>'name' = '__Duplicate 식당__';
  foreach variant in array array['__duplicate식당__', '__DUPLICATE 식당__', U&'__Duplicate\00A0식\3000당__'] loop
    begin
      perform public.lunch_mutate(team, 'save', jsonb_build_object('input', details || jsonb_build_object('name', variant)));
      raise exception 'Duplicate insert was allowed';
    exception when unique_violation then
      get stacked diagnostics constraint_name = CONSTRAINT_NAME;
      if constraint_name <> 'lunch_restaurants_team_address_name_unique' then raise; end if;
    end;
  end loop;
  -- Same address with another store name is valid.
  result := public.lunch_mutate(team, 'save', jsonb_build_object('input', details || jsonb_build_object('name', '__Different 식당__')));
  select r->>'id' into second_id from jsonb_array_elements(result->'restaurants') r where r->>'name' = '__Different 식당__';
  begin
    perform public.lunch_mutate(team, 'save', jsonb_build_object('id', second_id, 'input', details));
    raise exception 'Duplicate rename was allowed';
  exception when unique_violation then null;
  end;
  -- Editing the original record, including its name formatting, is valid.
  perform public.lunch_mutate(team, 'save', jsonb_build_object('id', first_id, 'input', details || jsonb_build_object('name', '__duplicate식당__')));
  -- Same name at another address is valid, but moving it onto the first is not.
  result := public.lunch_mutate(team, 'save', jsonb_build_object('input', details || jsonb_build_object('address', '서울 영등포구 양평로 8', 'latitude', 37.5325527443156, 'longitude', 126.90507772707741)));
  select r->>'id' into second_id from jsonb_array_elements(result->'restaurants') r where r->>'name' = '__Duplicate 식당__';
  begin
    perform public.lunch_mutate(team, 'save', jsonb_build_object('id', second_id, 'input', details));
    raise exception 'Duplicate address update was allowed';
  exception when unique_violation then null;
  end;
end $$;
rollback;
select 'Duplicate insert, rename, self-edit and shared-address checks passed; writes rolled back' as result,
  count(*) as restaurants,
  count(*) filter (where address = '') as missing_addresses,
  count(*) filter (where note <> '') as nonempty_notes
from public.lunch_restaurants;
