-- PurposeBuilt ATMS hosted beta: who may open a private training sandbox.
-- Additive. Touches no DTCD or StormwaterCheck table, policy or function.
-- Accounts read only their own row; grants are made by the project owner
-- (SQL editor / service role), never by app users.

create table if not exists public.atms_beta_access (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  note       text check (note is null or length(note) <= 500)
);

alter table public.atms_beta_access enable row level security;

drop policy if exists atms_beta_access_own on public.atms_beta_access;
create policy atms_beta_access_own on public.atms_beta_access
  for select to authenticated using (user_id = auth.uid());

revoke all on public.atms_beta_access from public, anon, authenticated;
grant select on public.atms_beta_access to authenticated;

-- Owner helper: grant (or renew) access by email for a number of days.
create or replace function public.atms_beta_grant(p_email text, p_days integer default 60, p_note text default null)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare target uuid; until timestamptz;
begin
  select id into target from auth.users where lower(email) = lower(trim(p_email));
  if target is null then raise exception 'No PurposeBuilt account for %', p_email using errcode = 'P0002'; end if;
  if p_days is null or p_days < 1 or p_days > 366 then raise exception 'Days must be 1 to 366' using errcode = '22023'; end if;
  until := now() + make_interval(days => p_days);
  insert into public.atms_beta_access(user_id, expires_at, revoked_at, note) values (target, until, null, p_note)
  on conflict (user_id) do update set expires_at = excluded.expires_at, revoked_at = null, note = coalesce(excluded.note, atms_beta_access.note);
  return until;
end;
$$;

create or replace function public.atms_beta_revoke(p_email text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.atms_beta_access set revoked_at = now()
  where user_id = (select id from auth.users where lower(email) = lower(trim(p_email)));
$$;

revoke all on function public.atms_beta_grant(text, integer, text), public.atms_beta_revoke(text) from public, anon, authenticated;
