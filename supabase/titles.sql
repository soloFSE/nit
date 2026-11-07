-- ============================================================
-- Звания: особые значки, которые выдаёт администрация «Нити» (например «Главный тестировщик»).
-- Видны всем: в профиле, у имени в группах. Выдают и забирают только админы приложения (app_admins).
-- Человек сам выбирает, какое из своих званий показывать главным.
-- Выполнить один раз: Supabase → SQL Editor → Run. Можно запускать повторно.
-- ============================================================

-- 1. Админы приложения
create table if not exists public.app_admins(
  user_id uuid primary key references auth.users on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
drop policy if exists "app admins read" on public.app_admins;
create policy "app admins read" on public.app_admins for select to authenticated using (true);
-- менять список админов можно только здесь, в SQL-редакторе

create or replace function public.is_app_admin(u uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists(select 1 from app_admins where user_id = u)
$$;
grant execute on function public.is_app_admin(uuid) to authenticated;

-- 2. Звания
create table if not exists public.titles(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  icon text not null default 'i-star',
  color text not null default '#8b5cf6',
  note text,
  main boolean not null default false,
  granted_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now()
);
do $$ begin
  alter table public.titles add constraint titles_name_len check (char_length(name) between 1 and 32);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.titles add constraint titles_note_len check (note is null or char_length(note) <= 120);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.titles add constraint titles_icon_ok check (icon ~ '^i-[a-z0-9-]{1,20}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.titles add constraint titles_color_ok check (color ~ '^#[0-9a-fA-F]{6}$');
exception when duplicate_object then null; end $$;
create index if not exists titles_user_idx on public.titles(user_id, created_at);

alter table public.titles enable row level security;
drop policy if exists "titles read" on public.titles;
create policy "titles read" on public.titles for select to authenticated using (true);
drop policy if exists "titles grant" on public.titles;
create policy "titles grant" on public.titles for insert to authenticated
  with check (public.is_app_admin(auth.uid()) and granted_by = auth.uid());
drop policy if exists "titles revoke" on public.titles;
create policy "titles revoke" on public.titles for delete to authenticated using (public.is_app_admin(auth.uid()));
-- обновлять напрямую нельзя никому; главное звание выбирается функцией ниже

-- 3. Выбрать главное звание (только своё)
create or replace function public.set_main_title(tid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from titles where id = tid and user_id = auth.uid()) then
    raise exception 'not your title';
  end if;
  update titles set main = (id = tid) where user_id = auth.uid();
end $$;
grant execute on function public.set_main_title(uuid) to authenticated;

-- 4. Мгновенное появление
do $$ begin alter publication supabase_realtime add table public.titles; exception when duplicate_object then null; end $$;

-- 5. Админ приложения — @lampizza. Добавить ещё кого-то: поменять ник и запустить эту строку.
insert into public.app_admins(user_id)
select id from public.profiles where username = 'lampizza'
on conflict do nothing;

select 'titles ok' as result,
  (select string_agg(coalesce(p.username, a.user_id::text), ', ') from app_admins a left join profiles p on p.id = a.user_id) as admins;
