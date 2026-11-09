-- ============================================================
-- Обновление v5.3: удаление аккаунта, очистка переписки, очистка группы.
-- Выполнить один раз: Supabase → SQL Editor → Run. Можно запускать повторно.
--  • delete_my_account(): человек удаляет свой аккаунт целиком (профиль, друзья, подарки, узелки, сообщения). Главного админа так удалить нельзя;
--    группы, где он создатель, переходят другому участнику (или удаляются, если он был последним);
--  • clear_my_messages(peer): «удалить мои сообщения у всех» в личной переписке;
--  • clear_group(gid): админ группы очищает всю переписку группы у всех.
-- «Очистить у меня» работает без SQL (скрывает сообщения только у вас).
-- ============================================================

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); g record;
begin
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

create or replace function public.clear_my_messages(peer uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update messages set body = '', image_path = null, deleted_at = now()
  where sender = auth.uid() and recipient = peer and group_id is null and deleted_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.clear_my_messages(uuid) to authenticated;

create or replace function public.clear_group(gid uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_group_admin(gid) then raise exception 'Очистить группу могут только её админы'; end if;
  update messages set body = '', image_path = null, deleted_at = now() where group_id = gid and deleted_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.clear_group(uuid) to authenticated;

select 'v10 ok' as result;
