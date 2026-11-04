-- ============================================================
-- Блокировки, удаление из друзей, реакции и ответы на сообщения.
-- Supabase → SQL Editor → Run. Можно запускать повторно.
-- ============================================================

-- 1. Блокировки
create table if not exists public.blocks(
  blocker uuid not null default auth.uid() references auth.users on delete cascade,
  blocked uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.blocks enable row level security;
-- Список своих блокировок видит только тот, кто блокировал
drop policy if exists "blocks read own" on public.blocks;
create policy "blocks read own" on public.blocks for select to authenticated using (blocker = auth.uid());
drop policy if exists "blocks add own" on public.blocks;
create policy "blocks add own" on public.blocks for insert to authenticated with check (blocker = auth.uid());
drop policy if exists "blocks remove own" on public.blocks;
create policy "blocks remove own" on public.blocks for delete to authenticated using (blocker = auth.uid());

-- Есть ли блокировка между двумя людьми в любую сторону
create or replace function public.is_blocked_between(x uuid, y uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists(select 1 from blocks where (blocker = x and blocked = y) or (blocker = y and blocked = x))
$$;

-- Нельзя писать в личку, если между вами блокировка
drop policy if exists "no messages when blocked" on public.messages;
create policy "no messages when blocked" on public.messages as restrictive for insert to authenticated
  with check (recipient is null or not public.is_blocked_between(auth.uid(), recipient));

-- Нельзя отправить заявку в друзья, если между вами блокировка
drop policy if exists "no friendship when blocked" on public.friendships;
create policy "no friendship when blocked" on public.friendships as restrictive for insert to authenticated
  with check (not public.is_blocked_between(a, b));

-- Удалить из друзей может любой из двоих
drop policy if exists "friendship remove by either" on public.friendships;
create policy "friendship remove by either" on public.friendships for delete to authenticated
  using (a = auth.uid() or b = auth.uid());

-- 2. Ответ на сообщение
alter table public.messages add column if not exists reply_to bigint;

-- 3. Реакции
create table if not exists public.reactions(
  message_id bigint not null,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  emoji text not null check (char_length(emoji) <= 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
-- Реакции удаляются вместе с сообщением (если тип id подходит)
do $$ begin
  alter table public.reactions add constraint reactions_message_fk
    foreign key (message_id) references public.messages(id) on delete cascade;
exception when others then null; end $$;
create index if not exists reactions_message_idx on public.reactions(message_id);

alter table public.reactions enable row level security;
-- Видит и ставит реакции тот, кто видит само сообщение
drop policy if exists "reactions read" on public.reactions;
create policy "reactions read" on public.reactions for select to authenticated
  using (exists(select 1 from public.messages m where m.id = message_id));
drop policy if exists "reactions add" on public.reactions;
create policy "reactions add" on public.reactions for insert to authenticated
  with check (user_id = auth.uid() and exists(select 1 from public.messages m where m.id = message_id));
drop policy if exists "reactions remove own" on public.reactions;
create policy "reactions remove own" on public.reactions for delete to authenticated
  using (user_id = auth.uid());

-- Мгновенные обновления реакций (full — чтобы при удалении приходил message_id)
alter table public.reactions replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.reactions;
exception when duplicate_object then null; end $$;
