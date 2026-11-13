-- ============================================================
-- Обновление v5.9: баннеры профиля и золотой админ. Выполнить один раз: Supabase → SQL Editor → Run. Можно запускать повторно.
--  • баннеры профиля: колонка profiles.banner и бакет banners (картинки, GIF, анимированный WebP до 5 МБ); ставить баннер может только
--    человек с Премиумом (или админ уровня 3+) — это проверяет сервер, а не телефон;
--  • золотой админ: все возможности Администратора, но уровень «закреплён» (app_admins.locked_by): снять его, сменить или ограничить
--    такого человека может только тот, кто закрепил (владелец). Выдаётся @skylo, владелец — @lampizza.
-- ============================================================

-- 1. Баннеры
alter table public.profiles add column if not exists banner text;
do $$ begin
  alter table public.profiles add constraint profiles_banner_len check (banner is null or char_length(banner) <= 200);
exception when duplicate_object then null; end $$;

create or replace function public.profiles_banner_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.banner is distinct from old.banner and new.banner is not null then
    if not (exists(select 1 from premium_users where user_id = new.id and (until is null or until > now()))
            or public.admin_role(auth.uid()) >= 3) then
      raise exception 'Баннеры доступны только с подпиской «Нить Премиум»';
    end if;
    if not (new.banner like 'p:%' or new.banner like new.id::text || '/%') then
      raise exception 'Недопустимый баннер';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_banner_guard on public.profiles;
create trigger profiles_banner_guard before update of banner on public.profiles
  for each row execute function public.profiles_banner_guard();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('banners', 'banners', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
drop policy if exists "banners upload own" on storage.objects;
create policy "banners upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'banners' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "banners update own" on storage.objects;
create policy "banners update own" on storage.objects for update to authenticated
  using (bucket_id = 'banners' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "banners delete own" on storage.objects;
create policy "banners delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'banners' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "banners read" on storage.objects;
create policy "banners read" on storage.objects for select using (bucket_id = 'banners');

-- 2. Золотой админ: закреплённый уровень
alter table public.app_admins add column if not exists gold boolean not null default false;
alter table public.app_admins add column if not exists locked_by uuid references auth.users on delete set null;

-- Назначить / снять уровень (1–3). Закреплённый уровень меняет только тот, кто его закрепил.
create or replace function public.admin_set_role(target uuid, newrole int) returns void
language plpgsql security definer set search_path = public as $$
declare tr int := public.admin_role(target); lk uuid;
begin
  if public.admin_role(auth.uid()) < 4 then raise exception 'Только Главный админ меняет уровни'; end if;
  select locked_by into lk from app_admins where user_id = target;
  if lk is not null and lk <> auth.uid() then raise exception 'Этот уровень закреплён — менять его может только владелец'; end if;
  if tr = 4 then raise exception 'Главного админа менять нельзя'; end if;
  if newrole not between 0 and 3 then raise exception 'Уровень от 1 до 3 (0 — снять)'; end if;
  if newrole = 0 then delete from app_admins where user_id = target;
  else insert into app_admins(user_id, role, granted_by) values (target, newrole, auth.uid())
       on conflict (user_id) do update set role = excluded.role, granted_by = excluded.granted_by, bought = false; end if;
  perform public.alog('role', target, newrole::text);
end $$;
grant execute on function public.admin_set_role(uuid, int) to authenticated;

-- Ограничить человека с закреплённым уровнем может только владелец
create or replace function public.admin_restrict(target uuid, k text, minutes int, why text) returns void
language plpgsql security definer set search_path = public as $$
declare r int := public.admin_role(auth.uid()); tr int := public.admin_role(target); lim int; u timestamptz; lk uuid;
begin
  if r < 1 then raise exception 'Нет прав'; end if;
  if target = auth.uid() then raise exception 'Себя ограничить нельзя'; end if;
  select locked_by into lk from app_admins where user_id = target;
  if lk is not null and lk <> auth.uid() then raise exception 'Этого человека может ограничить только владелец'; end if;
  if tr >= r then raise exception 'Нельзя ограничить админа вашего уровня или выше'; end if;
  if k not in ('mute','ban') then raise exception 'Неизвестное ограничение'; end if;
  if k = 'ban' and r < 2 then raise exception 'Бан доступен с уровня «Модератор»'; end if;
  lim := case when r = 1 then 60 when r = 2 then (case when k = 'ban' then 4320 else 10080 end) when r = 3 then 43200 else null end;
  if coalesce(minutes, 0) = 0 then
    if r < 4 then raise exception 'Навсегда может только Главный админ'; end if;
    u := null;
  else
    if lim is not null and minutes > lim then raise exception 'Ваш предел — % мин', lim; end if;
    u := now() + make_interval(mins => minutes);
  end if;
  update user_restrictions set revoked = true where user_id = target and kind = k and not revoked;
  insert into user_restrictions(user_id, kind, reason, until, by_admin) values (target, k, left(nullif(trim(why), ''), 200), u, auth.uid());
  perform public.alog(k, target, coalesce(minutes::text, '0') || ' мин. ' || coalesce(left(why, 100), ''));
end $$;
grant execute on function public.admin_restrict(uuid, text, int, text) to authenticated;

-- Поиск человека: теперь с признаком золотого админа
drop function if exists public.admin_find(text);
create or replace function public.admin_find(q text) returns table(
  id uuid, username text, display_name text, created timestamptz, role int, balance int, muted boolean, banned boolean, gifts int, farm_gifts int, gold boolean)
language plpgsql security definer set search_path = public as $$
begin
  if public.admin_role(auth.uid()) < 1 then raise exception 'Нет прав'; end if;
  return query
  select p.id, p.username::text, p.display_name::text, (select u.created_at from auth.users u where u.id = p.id),
         public.admin_role(p.id), coalesce((select w.balance from wallets w where w.user_id = p.id), 0),
         public.is_restricted(p.id, 'mute') and not public.is_restricted(p.id, 'ban'), public.is_restricted(p.id, 'ban'),
         (select count(*)::int from gifts g where g.owner = p.id), (select count(*)::int from gifts g where g.owner = p.id and g.farm),
         coalesce((select a.gold from app_admins a where a.user_id = p.id), false)
  from profiles p
  where p.username ilike '%' || replace(trim(q), '@', '') || '%' or p.display_name ilike '%' || trim(q) || '%'
  order by p.username limit 20;
end $$;
grant execute on function public.admin_find(text) to authenticated;

-- Обзор: команда с признаками gold / locked
create or replace function public.admin_overview() returns json
language plpgsql security definer set search_path = public as $$
begin
  if public.admin_role(auth.uid()) < 1 then raise exception 'Нет прав'; end if;
  return json_build_object(
    'users', (select count(*) from profiles),
    'new_day', (select count(*) from auth.users where created_at > now() - interval '1 day'),
    'msgs_day', (select count(*) from messages where created_at > now() - interval '1 day'),
    'knots', (select coalesce(sum(balance), 0) from wallets),
    'gifts', (select count(*) from gifts),
    'restr', coalesce((select json_agg(x) from (
        select r.id, r.user_id, r.kind, r.reason, r.until, r.by_admin, r.created_at
        from user_restrictions r where not r.revoked and (r.until is null or r.until > now()) order by r.created_at desc limit 50) x), '[]'::json),
    'team', coalesce((select json_agg(x) from (select a.user_id, a.role, a.bought, a.gold, (a.locked_by is not null) as locked from app_admins a order by a.role desc, a.added_at) x), '[]'::json));
end $$;
grant execute on function public.admin_overview() to authenticated;

-- 3. Выдаём золотого админа @skylo (все возможности Администратора), закрепляем за @lampizza и даём золотое звание
do $$
declare s uuid; o uuid;
begin
  select id into s from public.profiles where lower(username) = 'skylo';
  select id into o from public.profiles where lower(username) = 'lampizza';
  if s is null then raise notice 'Пользователь @skylo не найден — он должен сначала зарегистрироваться'; return; end if;
  if o is null then raise notice 'Владелец @lampizza не найден'; return; end if;
  insert into public.app_admins(user_id, role, gold, locked_by, granted_by) values (s, 3, true, o, o)
    on conflict (user_id) do update set role = 3, gold = true, locked_by = o, granted_by = o;
  if not exists (select 1 from public.titles where user_id = s and name = 'Золотой админ') then
    insert into public.titles(user_id, name, icon, color, note, main, granted_by)
    values (s, 'Золотой админ', 'i-crown', '#f5b52b', 'Особый статус администрации', not exists (select 1 from public.titles t where t.user_id = s and t.main), o);
  end if;
end $$;

select 'v11 ok' as result,
  (select string_agg(p.username || ':' || a.role || case when a.gold then ':gold' else '' end || case when a.locked_by is not null then ':locked' else '' end, ', ')
   from public.app_admins a join public.profiles p on p.id = a.user_id) as admins;
