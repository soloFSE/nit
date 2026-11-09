-- ============================================================
-- Обновление v5.0: Админ-панель, уровни админов, ограничения пользователей, защита узелков, коллекция «Кавказ».
-- Выполнить один раз: Supabase → SQL Editor → Run. Можно запускать повторно.
--  • уровни админа: 1 Помощник (можно купить за 2500 узелков), 2 Модератор, 3 Администратор, 4 Главный админ (выдают только разработчики, в SQL);
--  • ограничения как в Discord: «мьют» (нельзя писать) и «бан» (аккаунт закрыт) — на срок или навсегда, с причиной;
--  • у Главного админа узелки бесконечные; админы 3 уровня могут начислять узелки (с лимитом);
--  • защита от «фарма» узелков с помощью многих аккаунтов (см. ниже);
--  • журнал действий админов.
-- Все изменения — только через функции ниже (с телефона напрямую ничего не поменять).
-- Нужны уже запущенные titles.sql (app_admins) и v7.sql (подарки).
-- ============================================================

-- 1. Уровни админов
alter table public.app_admins add column if not exists role int not null default 4;
alter table public.app_admins add column if not exists bought boolean not null default false;
alter table public.app_admins add column if not exists granted_by uuid references auth.users on delete set null;
do $$ begin
  alter table public.app_admins add constraint app_admins_role_chk check (role between 1 and 4);
exception when duplicate_object then null; end $$;
-- Все, кто уже был админом приложения (разработчики), остаются Главными админами (role по умолчанию = 4).

create or replace function public.admin_role(u uuid) returns int
language sql security definer stable set search_path = public as $$
  select coalesce((select role from app_admins where user_id = u), 0)
$$;
grant execute on function public.admin_role(uuid) to authenticated;

-- 2. Ограничения
create table if not exists public.user_restrictions(
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('mute','ban')),
  reason text,
  until timestamptz,                         -- null = навсегда
  by_admin uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  revoked boolean not null default false
);
create index if not exists user_restrictions_user_idx on public.user_restrictions(user_id, revoked);
alter table public.user_restrictions enable row level security;
drop policy if exists "restr read" on public.user_restrictions;
create policy "restr read" on public.user_restrictions for select to authenticated
  using (user_id = auth.uid() or public.admin_role(auth.uid()) >= 1);

create or replace function public.is_restricted(u uuid, k text) returns boolean
language sql security definer stable set search_path = public as $$
  select exists(select 1 from user_restrictions r where r.user_id = u and not r.revoked
    and (r.until is null or r.until > now()) and (r.kind = k or (k = 'mute' and r.kind = 'ban')))
$$;
grant execute on function public.is_restricted(uuid, text) to authenticated;

-- Нельзя писать сообщения под мьютом/баном
drop policy if exists "no messages when restricted" on public.messages;
create policy "no messages when restricted" on public.messages as restrictive for insert to authenticated
  with check (not public.is_restricted(auth.uid(), 'mute'));

-- 3. Журнал админов
create table if not exists public.admin_log(
  id bigserial primary key,
  admin_id uuid references auth.users on delete set null,
  action text not null,
  target uuid references auth.users on delete set null,
  details text,
  created_at timestamptz not null default now()
);
alter table public.admin_log enable row level security;
drop policy if exists "log read" on public.admin_log;
create policy "log read" on public.admin_log for select to authenticated using (public.admin_role(auth.uid()) >= 2);
create or replace function public.alog(a text, t uuid, d text) returns void
language sql security definer set search_path = public as $$
  insert into admin_log(admin_id, action, target, details) values (auth.uid(), a, t, d)
$$;

-- 4. Защита от фарма узелков аккаунтами-двойниками
alter table public.gifts add column if not exists locked_until timestamptz;   -- до этой даты подарок нельзя обменять
alter table public.gifts add column if not exists farm boolean not null default false; -- прислан «молодым» аккаунтом: не обменивается
alter table public.wallets add column if not exists claims int not null default 0;
alter table public.wallets add column if not exists sold_day date;
alter table public.wallets add column if not exists sold_today int not null default 0;
alter table public.gift_catalog add column if not exists coll text;           -- коллекция («caucasus» и т.д.)

create or replace function public.acc_age_days(u uuid) returns int
language sql security definer stable set search_path = public as $$
  select coalesce(extract(day from now() - (select created_at from auth.users where id = u))::int, 0)
$$;

-- 5. Каталог: старые подарки + коллекция «Кавказ»
insert into public.gift_catalog(id, name, price, supply, coll) values
  ('ch_papakha','Папаха',80,null,'caucasus'),
  ('cz_dagger','Кинжал',90,null,'caucasus'),
  ('in_sun','Солярный знак',100,null,'caucasus'),
  ('os_pie','Осетинские пироги',60,null,'caucasus'),
  ('ch_tower','Башня Нохчийчоь',150,400,'caucasus'),
  ('in_tower','Башня Ингушетии',150,400,'caucasus'),
  ('dg_eagle','Орёл Дагестана',180,300,'caucasus'),
  ('kb_elbrus','Эльбрус',200,250,'caucasus'),
  ('ch_wolf','Горный волк',220,250,'caucasus')
on conflict (id) do update set name = excluded.name, price = excluded.price, supply = excluded.supply, coll = excluded.coll;

-- 6. Ежедневный бонус: аккаунт должен прожить сутки; приветственные +50 — только после 3 дней
create or replace function public.claim_daily() returns int
language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Europe/Moscow')::date; w public.wallets; st int := 0; amt int; prem boolean; age int := public.acc_age_days(auth.uid());
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if public.is_restricted(auth.uid(), 'ban') then raise exception 'Аккаунт ограничен'; end if;
  if age < 1 then raise exception 'Бонус откроется через сутки после регистрации'; end if;
  insert into wallets(user_id, balance) values (auth.uid(), 0) on conflict do nothing;
  select * into w from wallets where user_id = auth.uid() for update;
  if w.last_claim = d then raise exception 'Бонус уже получен сегодня'; end if;
  begin
    select case when last_day >= d - 1 then streak else 0 end into st from user_streaks where user_id = auth.uid();
  exception when others then st := 0; end;
  begin
    select exists(select 1 from premium_users where user_id = auth.uid() and (until is null or until > now())) into prem;
  exception when others then prem := false; end;
  amt := (10 + least(coalesce(st, 0), 30)) * case when prem then 2 else 1 end;
  if w.last_claim is null and age >= 3 then amt := amt + 50; end if;
  update wallets set balance = balance + amt, last_claim = d, claims = claims + 1 where user_id = auth.uid();
  return amt;
end $$;
grant execute on function public.claim_daily() to authenticated;

-- 7. Подарить другу. Главный админ дарит бесплатно. Подарки от аккаунтов младше 14 дней нельзя обменять на узелки.
create or replace function public.send_gift(to_user uuid, gtype text, gnote text, is_anon boolean) returns public.gifts
language plpgsql security definer set search_path = public as $$
declare cat public.gift_catalog; w public.wallets; ser int; roll float; rar text; bgi int; g public.gifts; boss boolean := public.admin_role(auth.uid()) = 4; today int;
begin
  if to_user is null or to_user = auth.uid() then raise exception 'Нельзя подарить самому себе'; end if;
  if public.is_restricted(auth.uid(), 'ban') then raise exception 'Аккаунт ограничен'; end if;
  if not public.are_friends(auth.uid(), to_user) then raise exception 'Дарить можно только друзьям'; end if;
  select count(*) into today from gifts where sender = auth.uid() and owner = to_user and created_at > now() - interval '1 day';
  if today >= 5 and not boss then raise exception 'Сегодня этому другу уже подарили много — попробуйте завтра'; end if;
  select * into cat from gift_catalog where id = gtype and active;
  if not found then raise exception 'Такого подарка нет'; end if;
  if not boss then
    select * into w from wallets where user_id = auth.uid() for update;
    if not found or w.balance < cat.price then raise exception 'Недостаточно узелков'; end if;
  end if;
  update gift_catalog set sold = sold + 1 where id = gtype and (supply is null or sold < supply) returning sold into ser;
  if ser is null then raise exception 'Тираж этого подарка закончился'; end if;
  if not boss then update wallets set balance = balance - cat.price where user_id = auth.uid(); end if;
  roll := random() * case when cat.supply is not null then 0.7 else 1 end;
  if roll < 0.03 then rar := 'legendary'; bgi := 8;
  elsif roll < 0.12 then rar := 'epic'; bgi := 6 + floor(random() * 2)::int;
  elsif roll < 0.32 then rar := 'rare'; bgi := 4 + floor(random() * 2)::int;
  else rar := 'common'; bgi := floor(random() * 4)::int; end if;
  insert into gifts(type, owner, sender, anon, note, bg, pat, rarity, serial, locked_until, farm)
  values (gtype, to_user, auth.uid(), coalesce(is_anon, false), left(nullif(trim(gnote), ''), 100), bgi, floor(random() * 5)::int, rar, ser,
          now() + interval '3 days', (not boss) and public.acc_age_days(auth.uid()) < 14)
  returning * into g;
  return g;
end $$;
grant execute on function public.send_gift(uuid, text, text, boolean) to authenticated;

-- 8. Обмен подарка: после 3 дней, не от «молодых» аккаунтов, не больше 500 узелков в сутки
create or replace function public.sell_gift(gid bigint) returns int
language plpgsql security definer set search_path = public as $$
declare g public.gifts; p int; nb int; w public.wallets; d date := (now() at time zone 'Europe/Moscow')::date; got int;
begin
  select * into g from gifts where id = gid and owner = auth.uid() for update;
  if not found then raise exception 'Подарок не найден'; end if;
  if g.sender is not null and g.sender <> auth.uid() then
    if g.farm then raise exception 'Подарок от нового аккаунта нельзя обменять на узелки (его можно оставить в коллекции)'; end if;
    if g.locked_until is not null and g.locked_until > now() then raise exception 'Подарок можно обменять через 3 дня после получения'; end if;
  end if;
  select price into p from gift_catalog where id = g.type;
  got := p / 2;
  insert into wallets(user_id, balance) values (auth.uid(), 0) on conflict do nothing;
  select * into w from wallets where user_id = auth.uid() for update;
  if public.admin_role(auth.uid()) < 4 then
    if w.sold_day is distinct from d then w.sold_today := 0; end if;
    if w.sold_today + got > 500 then raise exception 'Можно обменять не больше 500 узелков в сутки'; end if;
    update wallets set sold_day = d, sold_today = w.sold_today + got where user_id = auth.uid();
  end if;
  delete from gifts where id = gid;
  update wallets set balance = balance + got where user_id = auth.uid() returning balance into nb;
  return nb;
end $$;
grant execute on function public.sell_gift(bigint) to authenticated;

-- 9. Купить уровень «Помощник» за 2500 узелков (аккаунту не меньше 14 дней, бонус забран не меньше 7 раз)
create or replace function public.buy_helper() returns void
language plpgsql security definer set search_path = public as $$
declare w public.wallets;
begin
  if public.admin_role(auth.uid()) > 0 then raise exception 'Вы уже в команде администрации'; end if;
  if public.is_restricted(auth.uid(), 'ban') then raise exception 'Аккаунт ограничен'; end if;
  if public.acc_age_days(auth.uid()) < 14 then raise exception 'Купить можно, когда аккаунту 14 дней'; end if;
  select * into w from wallets where user_id = auth.uid() for update;
  if not found or w.claims < 7 then raise exception 'Нужно хотя бы 7 раз забрать ежедневный бонус'; end if;
  if w.balance < 2500 then raise exception 'Нужно 2500 узелков'; end if;
  update wallets set balance = balance - 2500 where user_id = auth.uid();
  insert into app_admins(user_id, role, bought) values (auth.uid(), 1, true) on conflict (user_id) do nothing;
  perform public.alog('buy_helper', auth.uid(), '2500');
end $$;
grant execute on function public.buy_helper() to authenticated;

-- 10. Действия админов
-- Ограничить пользователя. Пределы по уровню: Помощник — мьют до 1 часа; Модератор — мьют до 7 дней, бан до 3 дней;
-- Администратор — до 30 дней; Главный — любой срок и навсегда (minutes = 0). Админа выше или равного себе ограничить нельзя.
create or replace function public.admin_restrict(target uuid, k text, minutes int, why text) returns void
language plpgsql security definer set search_path = public as $$
declare r int := public.admin_role(auth.uid()); tr int := public.admin_role(target); lim int; u timestamptz;
begin
  if r < 1 then raise exception 'Нет прав'; end if;
  if target = auth.uid() then raise exception 'Себя ограничить нельзя'; end if;
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

create or replace function public.admin_unrestrict(target uuid, k text) returns void
language plpgsql security definer set search_path = public as $$
declare r int := public.admin_role(auth.uid());
begin
  if r < 1 then raise exception 'Нет прав'; end if;
  if r = 1 and not exists(select 1 from user_restrictions where user_id = target and kind = k and not revoked and by_admin = auth.uid()) then
    raise exception 'Помощник снимает только свои ограничения'; end if;
  update user_restrictions set revoked = true where user_id = target and kind = k and not revoked;
  perform public.alog('un' || k, target, null);
end $$;
grant execute on function public.admin_unrestrict(uuid, text) to authenticated;

-- Начислить или списать узелки: Администратор — до 1000 за раз; Главный — без лимита
create or replace function public.admin_give(target uuid, amount int, why text) returns int
language plpgsql security definer set search_path = public as $$
declare r int := public.admin_role(auth.uid()); nb int;
begin
  if r < 3 then raise exception 'Нужен уровень «Администратор»'; end if;
  if r = 3 and abs(amount) > 1000 then raise exception 'Не больше 1000 за раз'; end if;
  insert into wallets(user_id, balance) values (target, 0) on conflict do nothing;
  update wallets set balance = greatest(0, balance + amount) where user_id = target returning balance into nb;
  perform public.alog('give', target, amount::text || ' ' || coalesce(left(why, 100), ''));
  return nb;
end $$;
grant execute on function public.admin_give(uuid, int, text) to authenticated;

-- Назначить / снять уровень (1–3). Главный админ (4) выдаётся только вручную в SQL.
create or replace function public.admin_set_role(target uuid, newrole int) returns void
language plpgsql security definer set search_path = public as $$
declare tr int := public.admin_role(target);
begin
  if public.admin_role(auth.uid()) < 4 then raise exception 'Только Главный админ меняет уровни'; end if;
  if tr = 4 then raise exception 'Главного админа менять нельзя'; end if;
  if newrole not between 0 and 3 then raise exception 'Уровень от 1 до 3 (0 — снять)'; end if;
  if newrole = 0 then delete from app_admins where user_id = target;
  else insert into app_admins(user_id, role, granted_by) values (target, newrole, auth.uid())
       on conflict (user_id) do update set role = excluded.role, granted_by = excluded.granted_by, bought = false; end if;
  perform public.alog('role', target, newrole::text);
end $$;
grant execute on function public.admin_set_role(uuid, int) to authenticated;

-- Поиск человека для панели
create or replace function public.admin_find(q text) returns table(
  id uuid, username text, display_name text, created timestamptz, role int, balance int, muted boolean, banned boolean, gifts int, farm_gifts int)
language plpgsql security definer set search_path = public as $$
begin
  if public.admin_role(auth.uid()) < 1 then raise exception 'Нет прав'; end if;
  return query
  select p.id, p.username::text, p.display_name::text, (select u.created_at from auth.users u where u.id = p.id),
         public.admin_role(p.id), coalesce((select w.balance from wallets w where w.user_id = p.id), 0),
         public.is_restricted(p.id, 'mute') and not public.is_restricted(p.id, 'ban'), public.is_restricted(p.id, 'ban'),
         (select count(*)::int from gifts g where g.owner = p.id), (select count(*)::int from gifts g where g.owner = p.id and g.farm)
  from profiles p
  where p.username ilike '%' || replace(trim(q), '@', '') || '%' or p.display_name ilike '%' || trim(q) || '%'
  order by p.username limit 20;
end $$;
grant execute on function public.admin_find(text) to authenticated;

-- Список текущих ограничений и команды админов (для панели)
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
    'team', coalesce((select json_agg(x) from (select a.user_id, a.role, a.bought from app_admins a order by a.role desc, a.added_at) x), '[]'::json));
end $$;
grant execute on function public.admin_overview() to authenticated;

-- Журнал и «подозрительные» получатели подарков (много подарков от молодых аккаунтов)
create or replace function public.admin_audit() returns json
language plpgsql security definer set search_path = public as $$
begin
  if public.admin_role(auth.uid()) < 2 then raise exception 'Нужен уровень «Модератор»'; end if;
  return json_build_object(
    'log', coalesce((select json_agg(x) from (select id, admin_id, action, target, details, created_at from admin_log order by id desc limit 60) x), '[]'::json),
    'farm', coalesce((select json_agg(x) from (select owner as user_id, count(*)::int as n from gifts where farm group by owner having count(*) >= 3 order by count(*) desc limit 20) x), '[]'::json));
end $$;
grant execute on function public.admin_audit() to authenticated;

-- Звания и Премиум выдают только Администратор (3) и Главный (4); Помощник и Модератор — нет
create or replace function public.is_app_admin(u uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists(select 1 from app_admins where user_id = u and role >= 3)
$$;
grant execute on function public.is_app_admin(uuid) to authenticated;

select 'v8 ok' as result;
