-- LEANR: profiles table + fitelo.co-only signup gate.
-- Auth domain restriction is enforced in three places (see CLAUDE.md "Auth" section):
--   1. queryParams hd hint on the client sign-in call (UX only, spoofable)
--   2. this trigger, which rejects the insert outright
--   3. middleware + RLS policy checking auth.jwt() ->> 'email'

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'dietitian',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "fitelo staff can read profiles"
  on public.profiles
  for select
  to authenticated
  using ((auth.jwt() ->> 'email') like '%@fitelo.co');

create policy "fitelo staff can update own profile"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid() and (auth.jwt() ->> 'email') like '%@fitelo.co');

-- Split into BEFORE (reject) + AFTER (insert) rather than one BEFORE INSERT
-- trigger: profiles.id has a FK to auth.users(id), and that row does not
-- exist yet while a BEFORE INSERT trigger is running, so writing to
-- profiles at that point would fail every signup with a FK violation.

create or replace function public.enforce_fitelo_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email not ilike '%@fitelo.co' then
    raise exception 'Sign-up restricted to @fitelo.co accounts';
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created_check_domain
  before insert on auth.users
  for each row
  execute function public.enforce_fitelo_domain();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    'dietitian'
  );

  return new;
end;
$$;

create trigger on_auth_user_created_make_profile
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
