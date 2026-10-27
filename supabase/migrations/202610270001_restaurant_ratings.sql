begin;

create table if not exists public.lunch_restaurant_ratings (
  restaurant_id uuid not null references public.lunch_restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  primary key (restaurant_id, user_id)
);
alter table public.lunch_restaurant_ratings enable row level security;
revoke all on public.lunch_restaurant_ratings from public, anon, authenticated;

create or replace function public.lunch_rating_snapshot(p_team uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.lunch_members where team_id = p_team and user_id = auth.uid()
  ) then raise exception '별점 정보를 확인할 수 없어요.'; end if;
  return coalesce((
    select jsonb_object_agg(r.id::text, jsonb_build_object(
      'average', scores.average, 'count', scores.count, 'mine', scores.mine
    ))
    from public.lunch_restaurants r
    cross join lateral (
      select coalesce(avg(v.score), 0)::float8 as average,
        count(v.score)::integer as count,
        coalesce(max(v.score) filter (where v.user_id = auth.uid()), 0)::integer as mine
      from public.lunch_restaurant_ratings v where v.restaurant_id = r.id
    ) scores
    where r.team_id = p_team
  ), '{}'::jsonb);
end $$;

create or replace function public.lunch_set_rating(p_team uuid, p_restaurant uuid, p_score integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.lunch_members where team_id = p_team and user_id = auth.uid()
  ) then raise exception '별점 정보를 확인할 수 없어요.'; end if;
  if p_score is null or p_score not between 0 and 5 then raise exception '별점은 0~5점으로 선택해 주세요.'; end if;
  if not exists (select 1 from public.lunch_restaurants where id = p_restaurant and team_id = p_team)
    then raise exception '식당을 찾을 수 없어요.'; end if;
  if p_score = 0 then
    delete from public.lunch_restaurant_ratings where restaurant_id = p_restaurant and user_id = auth.uid();
  else
    insert into public.lunch_restaurant_ratings (restaurant_id, user_id, score)
      values (p_restaurant, auth.uid(), p_score)
      on conflict (restaurant_id, user_id) do update set score = excluded.score;
  end if;
  return public.lunch_rating_snapshot(p_team);
end $$;

revoke all on function public.lunch_rating_snapshot(uuid), public.lunch_set_rating(uuid, uuid, integer) from public, anon;
grant execute on function public.lunch_rating_snapshot(uuid), public.lunch_set_rating(uuid, uuid, integer) to authenticated;
commit;
