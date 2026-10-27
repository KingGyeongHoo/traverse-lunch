create role anon;
create role authenticated;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table public.lunch_members (team_id uuid not null, user_id uuid not null);
create table public.lunch_restaurants (id uuid primary key, team_id uuid not null);
