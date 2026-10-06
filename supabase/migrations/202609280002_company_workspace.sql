begin;
-- A single internal workspace for the company. No invite UI is required.
create table lunch_private.company_workspace (
  singleton boolean primary key default true check (singleton),
  team_id uuid not null unique references public.lunch_teams(id)
);
alter table lunch_private.company_workspace enable row level security;
revoke all on lunch_private.company_workspace from public, anon, authenticated;

create function lunch_private.open_company() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  company_id uuid;
  company_name text;
  existing_count integer;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('lunch.company.workspace', 0));
  select team_id into company_id from lunch_private.company_workspace where singleton;
  if company_id is null then
    select count(*) into existing_count from public.lunch_teams;
    if existing_count > 1 then
      raise exception '회사 공용 목록을 지정해 주세요.';
    elsif existing_count = 1 then
      select id into company_id from public.lunch_teams;
    else
      insert into public.lunch_teams(name, created_by)
        values ('우리 회사', auth.uid()) returning id into company_id;
    end if;
    insert into lunch_private.company_workspace(singleton, team_id) values (true, company_id);
  end if;
  insert into public.lunch_members(team_id, user_id)
    values (company_id, auth.uid()) on conflict do nothing;
  select name into company_name from public.lunch_teams where id = company_id;
  return jsonb_build_object('id', company_id, 'name', company_name);
end $$;

create function public.lunch_open_company() returns jsonb
language sql security invoker set search_path = ''
as $$ select lunch_private.open_company() $$;

revoke all on function lunch_private.open_company(), public.lunch_open_company() from public, anon;
grant execute on function lunch_private.open_company(), public.lunch_open_company() to authenticated;
commit;
