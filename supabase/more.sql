-- ============================================================
-- Большое обновление: прочитано, редактирование, пересылка, закреп,
-- исчезающие сообщения, файлы, опросы, крестики-нолики, свои стикеры,
-- статус, информация о группе и передача прав.
-- Supabase → SQL Editor → Run. Можно запускать повторно.
-- Нужны уже запущенные groups.sql, profile.sql и social.sql.
-- ============================================================

-- ---------- Новые поля сообщений ----------
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists forwarded_from uuid;
alter table public.messages add column if not exists expires_at timestamptz;

-- Исчезающие сообщения: после expires_at база перестаёт отдавать их всем
drop policy if exists "hide expired" on public.messages;
create policy "hide expired" on public.messages as restrictive for select to authenticated
  using (expires_at is null or expires_at > now());

-- ---------- Редактирование (только свой обычный текст) ----------
create or replace function public.edit_message(mid bigint, new_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if new_body is null or char_length(new_body) = 0 or char_length(new_body) > 4000 then
    raise exception 'Текст пустой или слишком длинный';
  end if;
  update messages set body = new_body, edited_at = now()
   where id = mid and sender = auth.uid() and deleted_at is null and body not like '::%';
  if not found then raise exception 'Это сообщение нельзя изменить'; end if;
end $$;
grant execute on function public.edit_message(bigint, text) to authenticated;

-- ---------- Кто может видеть чат ----------
-- Ключ чата: 'dm:<id1>:<id2>' (id по алфавиту) или 'g:<id группы>'
create or replace function public.can_see_chat(c text) returns boolean
language sql security definer stable set search_path = public as $$
  select case
    when c like 'g:%' then public.is_group_member(substring(c from 3)::uuid)
    when c like 'dm:%' then position(auth.uid()::text in c) > 0
    else false end
$$;

-- ---------- Прочитано ----------
create table if not exists public.reads(
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  chat text not null,
  last_id bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, chat)
);
alter table public.reads enable row level security;
drop policy if exists "reads see" on public.reads;
create policy "reads see" on public.reads for select to authenticated using (public.can_see_chat(chat));
drop policy if exists "reads add" on public.reads;
create policy "reads add" on public.reads for insert to authenticated with check (user_id = auth.uid() and public.can_see_chat(chat));
drop policy if exists "reads change" on public.reads;
create policy "reads change" on public.reads for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.can_see_chat(chat));

-- Сколько непрочитанных в каждом чате
create or replace function public.unread_counts() returns table(chat text, n bigint)
language sql security definer stable set search_path = public as $$
  with dm as (
    select 'dm:' || least(m.sender::text, m.recipient::text) || ':' || greatest(m.sender::text, m.recipient::text) as c, m.id
    from messages m
    where m.recipient = auth.uid() and m.deleted_at is null and (m.expires_at is null or m.expires_at > now())
  ), gr as (
    select 'g:' || m.group_id as c, m.id
    from messages m join group_members g on g.group_id = m.group_id and g.user_id = auth.uid()
    where m.sender <> auth.uid() and m.deleted_at is null and (m.expires_at is null or m.expires_at > now())
  ), allm as (select * from dm union all select * from gr)
  select a.c, count(*) from allm a
  left join reads r on r.user_id = auth.uid() and r.chat = a.c
  where a.id > coalesce(r.last_id, 0)
  group by a.c
$$;
grant execute on function public.unread_counts() to authenticated;

-- ---------- Закреплённые сообщения ----------
create table if not exists public.pins(
  chat text primary key,
  message_id bigint not null,
  pinned_by uuid default auth.uid(),
  pinned_at timestamptz not null default now()
);
alter table public.pins enable row level security;
drop policy if exists "pins all" on public.pins;
create policy "pins all" on public.pins for all to authenticated
  using (public.can_see_chat(chat)) with check (public.can_see_chat(chat));

-- ---------- Опросы: голоса ----------
create table if not exists public.poll_votes(
  message_id bigint not null,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  option smallint not null check (option between 0 and 9),
  primary key (message_id, user_id, option)
);
alter table public.poll_votes enable row level security;
drop policy if exists "votes read" on public.poll_votes;
create policy "votes read" on public.poll_votes for select to authenticated
  using (exists(select 1 from public.messages m where m.id = message_id));
drop policy if exists "votes add" on public.poll_votes;
create policy "votes add" on public.poll_votes for insert to authenticated
  with check (user_id = auth.uid() and exists(select 1 from public.messages m where m.id = message_id and m.body like '::poll::%'));
drop policy if exists "votes remove" on public.poll_votes;
create policy "votes remove" on public.poll_votes for delete to authenticated using (user_id = auth.uid());

-- ---------- Крестики-нолики: ход проверяет база ----------
create or replace function public.ttt_move(mid bigint, cell int) returns text
language plpgsql security definer set search_path = public as $$
declare
  m messages; st jsonb; b text; turn text; px uuid; po uuid; w text; i int;
  L int[] := array[0,1,2, 3,4,5, 6,7,8, 0,3,6, 1,4,7, 2,5,8, 0,4,8, 2,4,6];
begin
  select * into m from messages where id = mid for update;
  if not found or m.body not like '::ttt::%' then raise exception 'Игра не найдена'; end if;
  if not (m.sender = auth.uid() or m.recipient = auth.uid() or (m.group_id is not null and is_group_member(m.group_id))) then
    raise exception 'Нет доступа';
  end if;
  st := substring(m.body from 8)::jsonb;
  if coalesce(st->>'w', '') <> '' then raise exception 'Игра окончена'; end if;
  b := st->>'b'; turn := st->>'t'; px := (st->>'x')::uuid; po := nullif(st->>'o', '')::uuid;
  if turn = 'x' and auth.uid() <> px then raise exception 'Сейчас не ваш ход'; end if;
  if turn = 'o' then
    if po is null then
      if auth.uid() = px then raise exception 'Сейчас не ваш ход'; end if;
      po := auth.uid();
    elsif auth.uid() <> po then raise exception 'Сейчас не ваш ход'; end if;
  end if;
  if cell < 0 or cell > 8 or substr(b, cell + 1, 1) <> '-' then raise exception 'Клетка занята'; end if;
  b := overlay(b placing turn from cell + 1 for 1);
  w := '';
  for i in 0..7 loop
    if substr(b, L[i*3+1]+1, 1) = turn and substr(b, L[i*3+2]+1, 1) = turn and substr(b, L[i*3+3]+1, 1) = turn then w := turn; end if;
  end loop;
  if w = '' and position('-' in b) = 0 then w := 'd'; end if;
  st := jsonb_build_object('b', b, 't', case when turn = 'x' then 'o' else 'x' end, 'x', px, 'o', coalesce(po::text, ''), 'w', w);
  update messages set body = '::ttt::' || st::text where id = mid;
  return st::text;
end $$;
grant execute on function public.ttt_move(bigint, int) to authenticated;

-- ---------- Свои стикеры ----------
create table if not exists public.custom_stickers(
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  path text not null,
  created_at timestamptz not null default now()
);
alter table public.custom_stickers enable row level security;
drop policy if exists "stickers read" on public.custom_stickers;
create policy "stickers read" on public.custom_stickers for select to authenticated using (true);
drop policy if exists "stickers add" on public.custom_stickers;
create policy "stickers add" on public.custom_stickers for insert to authenticated with check (owner = auth.uid());
drop policy if exists "stickers remove" on public.custom_stickers;
create policy "stickers remove" on public.custom_stickers for delete to authenticated using (owner = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stickers', 'stickers', true, 1048576, array['image/png', 'image/webp', 'image/gif', 'image/jpeg'])
on conflict (id) do update set public = true;
drop policy if exists "stickers upload own" on storage.objects;
create policy "stickers upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'stickers' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "stickers delete own" on storage.objects;
create policy "stickers delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'stickers' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Файлы любого типа в чатах ----------
update storage.buckets set allowed_mime_types = null, file_size_limit = 52428800 where id = 'photos';

-- ---------- Статус под ником ----------
alter table public.profiles add column if not exists status text;
do $$ begin
  alter table public.profiles add constraint profiles_status_len check (status is null or char_length(status) <= 40);
exception when duplicate_object then null; end $$;
grant update (display_name, bio, avatar_path, status) on public.profiles to authenticated;

-- ---------- Информация о группе и передача прав ----------
alter table public.groups add column if not exists avatar_path text;
alter table public.groups add column if not exists description text;
do $$ begin
  alter table public.groups add constraint groups_description_len check (description is null or char_length(description) <= 200);
exception when duplicate_object then null; end $$;

create or replace function public.transfer_group(gid uuid, uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from groups where id = gid and owner = auth.uid()) then raise exception 'Вы не создатель группы'; end if;
  if not exists(select 1 from group_members where group_id = gid and user_id = uid) then raise exception 'Он не участник группы'; end if;
  update groups set owner = uid where id = gid;
end $$;
grant execute on function public.transfer_group(uuid, uuid) to authenticated;

-- ---------- Мгновенные обновления ----------
alter table public.poll_votes replica identity full;
alter table public.pins replica identity full;
do $$ begin alter publication supabase_realtime add table public.reads; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.pins; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.poll_votes; exception when duplicate_object then null; end $$;
