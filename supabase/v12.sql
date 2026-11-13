-- ============================================================
-- Обновление v6.0: БЕЗОПАСНОСТЬ. Выполнить один раз: Supabase → SQL Editor → Run. Можно запускать повторно.
-- Что закрывает (итоги аудита базы):
--  1. дружба: получатель заявки мог менять любые колонки (подставить чужой аккаунт) — теперь меняется только статус pending → accepted;
--  2. сообщения: нельзя писать личное сообщение «через группу» чужому человеку, нельзя подделать время/правку/удаление,
--     файл можно прикрепить только свой или из доступной вам переписки; защита от спама (частота отправки);
--  3. защита от спама и накрутки: группы, участники, истории, друзья, стикеры (лимиты по частоте и количеству);
--  4. функции базы закрыты для невошедших пользователей (остались только username_free и login_alias — они нужны на экране входа);
--     служебная alog (запись в журнал админов) больше не вызывается с телефона — раньше любой мог подделать строку журнала;
--  5. двухфакторная защита (TOTP): если у человека включена, база сама требует подтверждённый вход для переписки, друзей, групп, историй,
--     файлов, узелков, подарков и всех админ-действий; админ уровня 4 может сбросить 2FA человеку, потерявшему телефон.
-- Старые файлы v8/v10/v11 не перезапускайте после этого файла — при необходимости запустите v12 ещё раз.
-- ============================================================

-- ---------- 0. двухфакторная проверка ----------
create or replace function public.mfa_ok() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists(select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
$$;
grant execute on function public.mfa_ok() to authenticated;

create or replace function public.mfa_require() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.mfa_ok() then raise exception 'Подтвердите вход кодом двухфакторной защиты'; end if;
end $$;
grant execute on function public.mfa_require() to authenticated;

-- ---------- 1. дружба: участников менять нельзя ----------
create or replace function public.friendships_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  if tg_op = 'UPDATE' then
    if new.a is distinct from old.a or new.b is distinct from old.b then raise exception 'Нельзя менять участников дружбы'; end if;
    if old.status = 'accepted' and new.status <> 'accepted' then raise exception 'Дружбу можно только удалить'; end if;
    new.created_at := old.created_at;
  else
    new.created_at := now();
    select count(*) into c from friendships where a = new.a and created_at > now() - interval '1 hour';
    if c >= 30 then raise exception 'Слишком много заявок за час. Попробуйте позже'; end if;
    select count(*) into c from friendships where a = new.a and status = 'pending';
    if c >= 100 then raise exception 'Слишком много неотвеченных заявок'; end if;
  end if;
  return new;
end $$;
drop trigger if exists friendships_guard on public.friendships;
create trigger friendships_guard before insert or update on public.friendships for each row execute function public.friendships_guard();
create index if not exists friendships_a_created_idx on public.friendships(a, created_at desc);

-- ---------- 2. сообщения ----------
create or replace function public.messages_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  new.created_at := now(); new.edited_at := null; new.deleted_at := null;
  if new.recipient is not null and new.group_id is not null then
    raise exception 'Сообщение бывает либо личным, либо в группу';
  end if;
  if public.admin_role(new.sender) < 4 then
    select count(*) into c from messages where sender = new.sender and created_at > now() - interval '10 seconds';
    if c >= 25 then raise exception 'Слишком часто. Подождите несколько секунд'; end if;
    select count(*) into c from messages where sender = new.sender and created_at > now() - interval '10 minutes';
    if c >= 400 then raise exception 'Слишком много сообщений. Подождите немного'; end if;
  end if;
  -- файл: свой (папка = ваш id) или из переписки, которую вы видите (пересылка)
  if new.image_path is not null and new.image_path not like new.sender::text || '/%' and not exists(
       select 1 from messages m where m.image_path = new.image_path and (
         m.sender = new.sender or m.recipient = new.sender
         or (m.group_id is not null and exists(select 1 from group_members gm where gm.group_id = m.group_id and gm.user_id = new.sender)))) then
    raise exception 'Недопустимый файл';
  end if;
  return new;
end $$;
drop trigger if exists messages_guard on public.messages;
create trigger messages_guard before insert on public.messages for each row execute function public.messages_guard();
create index if not exists messages_sender_created_idx on public.messages(sender, created_at desc);

-- ---------- 3. группы, участники, истории, стикеры ----------
create or replace function public.groups_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  new.created_at := now();
  select count(*) into c from groups where owner = new.owner;
  if c >= 30 then raise exception 'Можно создать не больше 30 групп'; end if;
  select count(*) into c from groups where owner = new.owner and created_at > now() - interval '1 hour';
  if c >= 5 then raise exception 'Слишком много новых групп за час'; end if;
  return new;
end $$;
drop trigger if exists groups_limit on public.groups;
create trigger groups_limit before insert on public.groups for each row execute function public.groups_limit();

create or replace function public.group_members_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  new.created_at := now();
  if auth.uid() is not null then new.added_by := auth.uid(); end if;
  select count(*) into c from group_members where group_id = new.group_id;
  if c >= 256 then raise exception 'В группе не больше 256 участников'; end if;
  return new;
end $$;
drop trigger if exists group_members_guard on public.group_members;
create trigger group_members_guard before insert on public.group_members for each row execute function public.group_members_guard();

create or replace function public.stories_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  new.created_at := now();
  if new.media_path is null or new.media_path not like new.owner::text || '/%' then raise exception 'Недопустимый файл истории'; end if;
  if new.expires_at is null or new.expires_at > now() + interval '25 hours' then new.expires_at := now() + interval '24 hours'; end if;
  select count(*) into c from stories where owner = new.owner and created_at > now() - interval '1 day';
  if c >= 40 then raise exception 'Слишком много историй за сутки'; end if;
  return new;
end $$;
drop trigger if exists stories_guard on public.stories;
create trigger stories_guard before insert on public.stories for each row execute function public.stories_guard();
create index if not exists stories_owner_created_idx on public.stories(owner, created_at desc);

create or replace function public.stickers_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from custom_stickers where owner = new.owner) >= 300 then raise exception 'Не больше 300 своих стикеров'; end if;
  return new;
end $$;
drop trigger if exists stickers_limit on public.custom_stickers;
create trigger stickers_limit before insert on public.custom_stickers for each row execute function public.stickers_limit();

-- ---------- 4. закрываем функции от невошедших и служебные от телефона ----------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function public.username_free(text) to anon;
grant execute on function public.login_alias(text) to anon;
revoke execute on function public.alog(text, uuid, text) from authenticated;
revoke execute on function public.nit_cleanup(integer) from authenticated;
revoke execute on function public.friendships_guard() from authenticated;
revoke execute on function public.messages_guard() from authenticated;
revoke execute on function public.groups_limit() from authenticated;
revoke execute on function public.group_members_guard() from authenticated;
revoke execute on function public.stories_guard() from authenticated;
revoke execute on function public.stickers_limit() from authenticated;
revoke execute on function public.profiles_banner_guard() from authenticated;
revoke execute on function public.groups_guard() from authenticated;
revoke execute on function public.group_owner_left() from authenticated;
revoke execute on function public.add_group_owner() from authenticated;
revoke execute on function public.nit_premium_check() from authenticated;
revoke execute on function public.nit_streak() from authenticated;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.nit_new_user() from authenticated;
alter default privileges in schema public revoke execute on functions from anon, public;

-- ---------- 5. двухфакторная защита на уровне базы ----------
do $$
declare t text;
begin
  foreach t in array array['messages','friendships','groups','group_members','stories','wallets','gifts','message_hides','blocks'] loop
    execute format('drop policy if exists "mfa required" on public.%I', t);
    execute format('create policy "mfa required" on public.%I as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t);
  end loop;
end $$;
drop policy if exists "mfa required update" on public.profiles;
create policy "mfa required update" on public.profiles as restrictive for update to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()));
drop policy if exists "mfa required files" on storage.objects;
create policy "mfa required files" on storage.objects as restrictive for all to authenticated
  using (bucket_id not in ('photos', 'stories', 'avatars', 'banners', 'stickers') or (select public.mfa_ok()))
  with check (bucket_id not in ('photos', 'stories', 'avatars', 'banners', 'stickers') or (select public.mfa_ok()));

-- Сброс 2FA человеку, потерявшему телефон (только Главный админ; действие пишется в журнал)
create or replace function public.admin_reset_mfa(target uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if public.admin_role(auth.uid()) < 4 then raise exception 'Только Главный админ'; end if;
  perform public.mfa_require();
  delete from auth.mfa_factors where user_id = target;
  perform public.alog('reset_mfa', target, null);
end $$;
grant execute on function public.admin_reset_mfa(uuid) to authenticated;

-- ---------- 6. опасные функции теперь тоже требуют подтверждённый вход (2FA) ----------

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); g record;
begin
  perform public.mfa_require();
  if u is null then raise exception 'not signed in'; end if;
  if public.admin_role(u) = 4 then raise exception 'Главного админа удалить нельзя — сначала снимите уровень в SQL'; end if;
  -- группы: последний участник — удаляем группу, иначе просто выходим (создатель передаётся по триггеру)
  for g in select gm.group_id from group_members gm where gm.user_id = u loop
    if (select count(*) from group_members where group_id = g.group_id) <= 1 then
      delete from groups where id = g.group_id;
    else
      delete from group_members where group_id = g.group_id and user_id = u;
    end if;
  end loop;
  begin
    delete from auth.users where id = u;
  exception when foreign_key_violation then
    delete from messages where sender = u or recipient = u;
    delete from auth.users where id = u;
  end;
end $$;
grant execute on function public.delete_my_account() to authenticated;

create or replace function public.admin_unrestrict(target uuid, k text) returns void
language plpgsql security definer set search_path = public as $$
declare r int := public.admin_role(auth.uid());
begin
  perform public.mfa_require();
  if r < 1 then raise exception 'Нет прав'; end if;
  if r = 1 and not exists(select 1 from user_restrictions where user_id = target and kind = k and not revoked and by_admin = auth.uid()) then
    raise exception 'Помощник снимает только свои ограничения'; end if;
  update user_restrictions set revoked = true where user_id = target and kind = k and not revoked;
  perform public.alog('un' || k, target, null);
end $$;
grant execute on function public.admin_unrestrict(uuid, text) to authenticated;

create or replace function public.admin_give(target uuid, amount int, why text) returns int
language plpgsql security definer set search_path = public as $$
declare r int := public.admin_role(auth.uid()); nb int;
begin
  perform public.mfa_require();
  if r < 3 then raise exception 'Нужен уровень «Администратор»'; end if;
  if r = 3 and abs(amount) > 1000 then raise exception 'Не больше 1000 за раз'; end if;
  insert into wallets(user_id, balance) values (target, 0) on conflict do nothing;
  update wallets set balance = greatest(0, balance + amount) where user_id = target returning balance into nb;
  perform public.alog('give', target, amount::text || ' ' || coalesce(left(why, 100), ''));
  return nb;
end $$;
grant execute on function public.admin_give(uuid, int, text) to authenticated;

create or replace function public.send_gift(to_user uuid, gtype text, gnote text, is_anon boolean) returns public.gifts
language plpgsql security definer set search_path = public as $$
declare cat public.gift_catalog; w public.wallets; ser int; roll float; rar text; bgi int; g public.gifts; boss boolean := public.admin_role(auth.uid()) = 4; today int;
begin
  perform public.mfa_require();
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

create or replace function public.sell_gift(gid bigint) returns int
language plpgsql security definer set search_path = public as $$
declare g public.gifts; p int; nb int; w public.wallets; d date := (now() at time zone 'Europe/Moscow')::date; got int;
begin
  perform public.mfa_require();
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

create or replace function public.buy_helper() returns void
language plpgsql security definer set search_path = public as $$
declare w public.wallets;
begin
  perform public.mfa_require();
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

create or replace function public.admin_set_role(target uuid, newrole int) returns void
language plpgsql security definer set search_path = public as $$
declare tr int := public.admin_role(target); lk uuid;
begin
  perform public.mfa_require();
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

create or replace function public.admin_restrict(target uuid, k text, minutes int, why text) returns void
language plpgsql security definer set search_path = public as $$
declare r int := public.admin_role(auth.uid()); tr int := public.admin_role(target); lim int; u timestamptz; lk uuid;
begin
  perform public.mfa_require();
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

-- ---------- 7. повторно закрываем функции, созданные выше (новые функции получают открытый доступ по умолчанию) ----------
revoke execute on all functions in schema public from public, anon;
grant execute on function public.username_free(text) to anon;
grant execute on function public.login_alias(text) to anon;
do $$ begin
  begin alter default privileges for role postgres in schema public revoke execute on functions from anon, public; exception when others then null; end;
  begin alter default privileges for role supabase_admin in schema public revoke execute on functions from anon, public; exception when others then null; end;
end $$;

select 'v12 ok' as result,
  (select count(*) from pg_policies where policyname in ('mfa required', 'mfa required update', 'mfa required files')) as mfa_policies,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')) as anon_functions;
