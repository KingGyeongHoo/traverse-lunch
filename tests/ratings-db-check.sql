insert into auth.users values ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002'), ('00000000-0000-4000-8000-000000000003');
insert into public.lunch_members values ('00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000002');
insert into public.lunch_restaurants values ('00000000-0000-4000-8000-000000000020', '00000000-0000-4000-8000-000000000010');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
select public.lunch_set_rating('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000020',5);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', false);
select public.lunch_set_rating('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000020',2);
do $$ declare x jsonb; begin
  x := public.lunch_rating_snapshot('00000000-0000-4000-8000-000000000010')->'00000000-0000-4000-8000-000000000020';
  if (x->>'average')::numeric <> 3.5 or (x->>'count')::int <> 2 or (x->>'mine')::int <> 2 then raise exception 'average or own score incorrect: %', x; end if;
end $$;
select public.lunch_set_rating('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000020',0);
do $$ declare x jsonb; begin
  x := public.lunch_rating_snapshot('00000000-0000-4000-8000-000000000010')->'00000000-0000-4000-8000-000000000020';
  if (x->>'average')::numeric <> 5 or (x->>'count')::int <> 1 or (x->>'mine')::int <> 0 then raise exception 'clear incorrect: %', x; end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', false);
do $$ begin
  begin
    perform public.lunch_rating_snapshot('00000000-0000-4000-8000-000000000010');
    raise exception 'non-member access was allowed';
  exception when raise_exception then
    if sqlerrm = 'non-member access was allowed' then raise; end if;
  end;
end $$;
