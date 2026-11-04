-- ============================================================
-- Админы в группах «Нити». Выполнить один раз: Supabase → SQL Editor → Run.
-- Нужны уже запущенные groups.sql и more.sql. Скрипт можно запускать повторно.
--
-- Что даёт:
--  • роль участника: обычный / админ (создатель группы — всегда админ);
--  • настройки группы: кто меняет данные, кто пишет, кто добавляет участников;
--  • админы убирают участников, назначают и снимают админов, удаляют чужие сообщения;
--  • создатель вышел — права переходят админу (или самому давнему участнику).
-- ============================================================

-- 1. Колонки
alter table public.group_members add column if not exists role text not null default 'member';
do $$ begin
  alter table public.group_members add constraint group_members_role_chk check (role in ('member','admin'));
exception when duplicate_object then null; end $$;
alter table public.groups add column if not exists only_admins_edit boolean not null default false;
alter table public.groups add column if not exists only_admins_send boolean not null default false;
alter table public.groups add column if not exists only_admins_add  boolean not null default false;

-- 2. «Я админ этой группы» (создатель — тоже админ)
create or replace function public.is_group_admin(gid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists(select 1 from groups where id = gid and owner = auth.uid())
      or exists(select 1 from group_members where group_id = gid and user_id = auth.uid() and role = 'admin')
$$;
grant execute on function public.is_group_admin(uuid) to authenticated;

-- 3. Данные группы: меняют админы, а если разрешено — все участники.
--    Создателя и настройки обычный участник поменять не может (это проверяет триггер ниже).
drop policy if exists "groups rename" on public.groups;
create policy "groups rename" on public.groups for update to authenticated
  using (public.is_group_admin(id) or (public.is_group_member(id) and not only_admins_edit))
  with check (public.is_group_admin(id) or (public.is_group_member(id) and not only_admins_edit));

create or replace function public.groups_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.owner is distinct from old.owner and coalesce(current_setting('nit.transfer', true), '') <> '1' then
    raise exception 'Сменить создателя можно только передачей прав';
  end if;
  if (new.only_admins_edit, new.only_admins_send, new.only_admins_add)
     is distinct from (old.only_admins_edit, old.only_admins_send, old.only_admins_add)
     and coalesce(current_setting('nit.transfer', true), '') <> '1'
     and not public.is_group_admin(old.id) then
    raise exception 'Настройки группы меняют только админы';
  end if;
  return new;
end $$;
drop trigger if exists groups_guard on public.groups;
create trigger groups_guard before update on public.groups for each row execute function public.groups_guard();

-- 4. Участники
-- Добавлять: только своих друзей; если включено «только админы» — только админы. Админом сразу добавить нельзя.
drop policy if exists "members add" on public.group_members;
create policy "members add" on public.group_members for insert to authenticated
  with check (
    role = 'member'
    and public.is_group_member(group_id)
    and (public.is_group_admin(group_id)
         or not exists(select 1 from public.groups g where g.id = group_id and g.only_admins_add))
    and exists(
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.a = auth.uid() and f.b = group_members.user_id)
          or (f.b = auth.uid() and f.a = group_members.user_id))
    )
  );
-- Выйти может каждый сам; убрать другого — админ (но не создателя)
drop policy if exists "members remove" on public.group_members;
create policy "members remove" on public.group_members for delete to authenticated
  using (
    user_id = auth.uid()
    or (public.is_group_admin(group_id)
        and not exists(select 1 from public.groups g where g.id = group_id and g.owner = group_members.user_id))
  );
-- Менять роли напрямую нельзя — только через функцию set_group_role
drop policy if exists "members update" on public.group_members;

create or replace function public.set_group_role(gid uuid, uid uuid, new_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if new_role not in ('member','admin') then raise exception 'Неизвестная роль'; end if;
  if not public.is_group_admin(gid) then raise exception 'Это могут только админы'; end if;
  if exists(select 1 from groups where id = gid and owner = uid) then raise exception 'Создатель всегда админ'; end if;
  update group_members set role = new_role where group_id = gid and user_id = uid;
  if not found then raise exception 'Он не участник группы'; end if;
end $$;
grant execute on function public.set_group_role(uuid, uuid, text) to authenticated;

-- Передача прав создателя: бывший создатель остаётся админом
create or replace function public.transfer_group(gid uuid, uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from groups where id = gid and owner = auth.uid()) then raise exception 'Вы не создатель группы'; end if;
  if not exists(select 1 from group_members where group_id = gid and user_id = uid) then raise exception 'Он не участник группы'; end if;
  perform set_config('nit.transfer', '1', true);
  update groups set owner = uid where id = gid;
  update group_members set role = 'admin' where group_id = gid and user_id in (uid, auth.uid());
end $$;
grant execute on function public.transfer_group(uuid, uuid) to authenticated;

-- Создатель вышел из группы — права получает самый давний админ, а если админов нет — самый давний участник
create or replace function public.group_owner_left() returns trigger
language plpgsql security definer set search_path = public as $$
declare heir uuid;
begin
  if not exists(select 1 from groups where id = old.group_id and owner = old.user_id) then return old; end if;
  select user_id into heir from group_members where group_id = old.group_id
    order by (role = 'admin') desc, created_at asc limit 1;
  if heir is null then return old; end if;
  perform set_config('nit.transfer', '1', true);
  update groups set owner = heir where id = old.group_id;
  update group_members set role = 'admin' where group_id = old.group_id and user_id = heir;
  return old;
end $$;
drop trigger if exists group_owner_left on public.group_members;
create trigger group_owner_left after delete on public.group_members for each row execute function public.group_owner_left();

-- 5. «Писать могут только админы»
drop policy if exists "group messages admins only" on public.messages;
create policy "group messages admins only" on public.messages as restrictive for insert to authenticated
  with check (
    group_id is null
    or public.is_group_admin(group_id)
    or not exists(select 1 from public.groups g where g.id = group_id and g.only_admins_send)
  );

-- 6. Админ удаляет чужое сообщение в группе (у всех)
create or replace function public.admin_delete_message(mid bigint) returns void
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  select group_id into gid from messages where id = mid;
  if gid is null or not public.is_group_admin(gid) then raise exception 'Это могут только админы группы'; end if;
  update messages set body = '', image_path = null, deleted_at = now() where id = mid and deleted_at is null;
end $$;
grant execute on function public.admin_delete_message(bigint) to authenticated;

-- 7. Чтобы смена ролей сразу приходила всем
alter table public.group_members replica identity full;
