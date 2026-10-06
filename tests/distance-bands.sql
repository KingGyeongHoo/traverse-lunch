-- All fixture writes and temporary exclusions are rolled back.
begin;
select set_config('request.jwt.claim.sub',
  (select user_id::text from public.lunch_members order by team_id, user_id limit 1), true);
set local role authenticated;
do $$
declare
  team uuid := (select team_id from public.lunch_members where user_id = auth.uid() limit 1);
  today date := (now() at time zone 'Asia/Seoul')::date;
  bands text[] := array['가까움', '중간', '멂', '매우 멂'];
  fixture record;
  saved public.lunch_restaurants;
  limit_index integer;
  result jsonb;
begin
  update public.lunch_restaurants set excluded_date = today where team_id = team;
  for fixture in select * from (values
    (0, '가까움', 1), (250, '가까움', 1), (251, '중간', 2),
    (500, '중간', 2), (501, '멂', 3), (750, '멂', 3), (751, '매우 멂', 4)
  ) as boundaries(meters, band, band_index) loop
    insert into public.lunch_restaurants(team_id, name, category, distance_meters)
    values (team, '__distance_boundary__' || fixture.meters, '한식', fixture.meters) returning * into saved;
    if saved.distance <> fixture.band then raise exception 'Wrong band at %m', fixture.meters; end if;
    for limit_index in 1..4 loop
      begin
        result := public.lunch_mutate(team, 'pick', jsonb_build_object('distance', bands[limit_index]));
        if fixture.band_index > limit_index or result->'picked'->>'id' <> saved.id::text then
          raise exception using errcode = 'XX000', message = 'Pick exceeded maximum distance';
        end if;
      exception when sqlstate 'P0001' then
        if fixture.band_index <= limit_index then raise exception 'Eligible restaurant was excluded'; end if;
      end;
    end loop;
    update public.lunch_restaurants set excluded_date = today where id = saved.id;
  end loop;
end $$;
rollback;
select 'Distance boundary and pick checks passed; test writes rolled back' as result,
  distance, count(*) as restaurants, min(distance_meters) as min_meters, max(distance_meters) as max_meters
from public.lunch_restaurants group by distance order by min(distance_meters);
