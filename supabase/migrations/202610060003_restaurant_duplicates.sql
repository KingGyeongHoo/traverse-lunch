begin;

-- Enforce uniqueness within each team, including concurrent inserts/renames.
create unique index lunch_restaurants_team_name_unique
  on public.lunch_restaurants(team_id, translate(
    -- Same whitespace characters and ASCII case folding as restaurantNameKey().
    regexp_replace(name, U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+', '', 'g'),
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'
  ));

notify pgrst, 'reload schema';
commit;
