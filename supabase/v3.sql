-- ============================================================
-- Обновление v3. Выполнить один раз: Supabase → SQL Editor → Run. Можно запускать повторно.
-- ============================================================

-- 1. Блокировка: человек узнаёт, что его заблокировали (чтобы вместо непонятной ошибки была понятная плашка).
--    Возвращает только id тех, кто заблокировал МЕНЯ.
create or replace function public.who_blocked_me() returns setof uuid
language sql security definer stable set search_path = public as $$
  select blocker from blocks where blocked = auth.uid()
$$;
grant execute on function public.who_blocked_me() to authenticated;

-- 2. Истории: лайк — один раз, автор видит, кто лайкнул
alter table public.story_views add column if not exists liked_at timestamptz;
-- like_story: отмечает просмотр и лайк; true — лайк поставлен сейчас, false — уже был
create or replace function public.like_story(sid uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare was timestamptz;
begin
  if not exists(select 1 from stories s where s.id = sid and s.expires_at > now() and public.are_friends(auth.uid(), s.owner)) then
    raise exception 'story not available';
  end if;
  insert into story_views(story_id, viewer) values (sid, auth.uid()) on conflict do nothing;
  select liked_at into was from story_views where story_id = sid and viewer = auth.uid();
  if was is not null then return false; end if;
  update story_views set liked_at = now() where story_id = sid and viewer = auth.uid();
  return true;
end $$;
grant execute on function public.like_story(uuid) to authenticated;

-- 3. Сведения о сообщении: кто открыл фото/файл, прослушал голосовое, посмотрел кружок
create table if not exists public.message_events(
  message_id bigint not null references public.messages on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('open','listen')),
  at timestamptz not null default now(),
  primary key (message_id, user_id, kind)
);
alter table public.message_events enable row level security;
drop policy if exists "msg events add" on public.message_events;
create policy "msg events add" on public.message_events for insert to authenticated
  with check (user_id = auth.uid() and exists(select 1 from public.messages m where m.id = message_id));
drop policy if exists "msg events read" on public.message_events;
create policy "msg events read" on public.message_events for select to authenticated
  using (user_id = auth.uid() or exists(select 1 from public.messages m where m.id = message_id and m.sender = auth.uid()));

-- 4. Смена ника — не чаще раза в 7 дней
alter table public.profiles add column if not exists username_changed_at timestamptz;
create or replace function public.change_username(u text) returns void
language plpgsql security definer set search_path = public as $$
declare v text := public.nit_clean_nick(u); last timestamptz;
begin
  if v <> lower(u) or char_length(v) < 3 then raise exception 'Ник: 3–20 символов, латиница, цифры, _'; end if;
  if exists(select 1 from profiles where username = v and id <> auth.uid()) then raise exception 'Такой ник уже занят'; end if;
  select username_changed_at into last from profiles where id = auth.uid();
  if last is not null and last > now() - interval '7 days' then
    raise exception 'Ник можно менять раз в неделю. Следующая смена — %', to_char(last + interval '7 days', 'DD.MM HH24:MI');
  end if;
  update profiles set username = v, username_set = true, username_changed_at = now() where id = auth.uid();
end $$;
grant execute on function public.change_username(text) to authenticated;

-- 5. Вход по нику после смены ника. Аккаунты «без почты» живут на служебном адресе <старый ник>@nit-chat.com;
--    функция по текущему нику отдаёт этот служебный адрес. Настоящие почты НЕ отдаёт никогда.
create or replace function public.login_alias(u text) returns text
language sql security definer stable set search_path = public, auth as $$
  select au.email from auth.users au join public.profiles p on p.id = au.id
   where p.username = lower(u) and au.email like '%@nit-chat.com'
$$;
grant execute on function public.login_alias(text) to anon, authenticated;
