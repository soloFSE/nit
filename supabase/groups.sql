-- ============================================================
-- Группы для «Нити». Выполнить один раз: Supabase → SQL Editor → Run.
-- Скрипт можно запускать повторно, он ничего не сломает.
-- ============================================================

-- 1. Таблицы
create table if not exists public.groups(
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members(
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  added_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- Сообщение в группу: group_id заполнен, recipient пустой
alter table public.messages add column if not exists group_id uuid references public.groups on delete cascade;
alter table public.messages alter column recipient drop not null;
create index if not exists messages_group_idx on public.messages(group_id, created_at desc);

-- 2. Проверка «я участник группы» (security definer, чтобы правила не зацикливались)
create or replace function public.is_group_member(gid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists(select 1 from group_members where group_id = gid and user_id = auth.uid())
$$;

-- Создатель группы автоматически становится участником
create or replace function public.add_group_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into group_members(group_id, user_id, added_by) values (new.id, new.owner, new.owner);
  return new;
end $$;
drop trigger if exists groups_owner_member on public.groups;
create trigger groups_owner_member after insert on public.groups
  for each row execute function public.add_group_owner();

-- 3. Правила доступа (RLS)
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

drop policy if exists "groups read" on public.groups;
create policy "groups read" on public.groups for select to authenticated
  using (owner = auth.uid() or public.is_group_member(id));
drop policy if exists "groups create" on public.groups;
create policy "groups create" on public.groups for insert to authenticated
  with check (owner = auth.uid());
drop policy if exists "groups rename" on public.groups;
create policy "groups rename" on public.groups for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "groups delete" on public.groups;
create policy "groups delete" on public.groups for delete to authenticated
  using (owner = auth.uid());

-- Видеть состав могут только участники
drop policy if exists "members read" on public.group_members;
create policy "members read" on public.group_members for select to authenticated
  using (public.is_group_member(group_id));
-- Добавлять может любой участник, и только своих друзей
drop policy if exists "members add" on public.group_members;
create policy "members add" on public.group_members for insert to authenticated
  with check (
    public.is_group_member(group_id)
    and exists(
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.a = auth.uid() and f.b = group_members.user_id)
          or (f.b = auth.uid() and f.a = group_members.user_id))
    )
  );
-- Выйти может каждый сам, убрать другого — только создатель
drop policy if exists "members remove" on public.group_members;
create policy "members remove" on public.group_members for delete to authenticated
  using (
    user_id = auth.uid()
    or exists(select 1 from public.groups g where g.id = group_id and g.owner = auth.uid())
  );

-- Сообщения группы: читать и писать могут только участники
drop policy if exists "group messages read" on public.messages;
create policy "group messages read" on public.messages for select to authenticated
  using (group_id is not null and public.is_group_member(group_id));
drop policy if exists "group messages send" on public.messages;
create policy "group messages send" on public.messages for insert to authenticated
  with check (group_id is not null and sender = auth.uid() and public.is_group_member(group_id));
-- Запрет писать в чужую группу, даже если старые правила что-то разрешают
drop policy if exists "group messages only members" on public.messages;
create policy "group messages only members" on public.messages as restrictive for insert to authenticated
  with check (group_id is null or public.is_group_member(group_id));

-- Фото и голосовые из группы видят все её участники
drop policy if exists "group files read" on storage.objects;
create policy "group files read" on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and exists(
      select 1 from public.messages m
      where m.image_path = storage.objects.name
        and m.group_id is not null
        and public.is_group_member(m.group_id)
    )
  );

-- 4. Мгновенные обновления состава групп
do $$ begin
  alter publication supabase_realtime add table public.group_members;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.groups;
exception when duplicate_object then null; end $$;
