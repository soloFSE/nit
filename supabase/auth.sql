-- ============================================================
-- Серьёзная регистрация: почта, вход через Google и GitHub.
-- Выполнить один раз: Supabase → SQL Editor → Run. Можно запускать повторно.
-- Нужен уже запущенный profile.sql.
--
-- Что делает:
--  • новый обработчик регистрации: профиль создаётся для любого способа входа
--    (ник + пароль, почта, Google, GitHub). Если ника нет (Google/GitHub) —
--    придумывает его из имени/почты, а человек потом выбирает свой;
--  • аватарка и имя из Google/GitHub подставляются сами;
--  • проверка «свободен ли ник» до регистрации;
--  • сменить ник можно один раз — тем, кому его придумали автоматически.
-- ============================================================

-- 1. Отметка «ник выбран человеком» (у старых аккаунтов — да)
alter table public.profiles add column if not exists username_set boolean not null default true;

-- 2. Убираем старый обработчик регистрации (его создавали раньше, и он падал, если ника нет)
do $$
declare t record;
begin
  for t in
    select tg.tgname
    from pg_trigger tg join pg_proc p on p.oid = tg.tgfoid
    where tg.tgrelid = 'auth.users'::regclass and not tg.tgisinternal
      and p.prosrc ilike '%profiles%' and p.proname <> 'nit_new_user'
  loop
    execute format('drop trigger if exists %I on auth.users', t.tgname);
  end loop;
end $$;

-- 3. Новый обработчик
create or replace function public.nit_clean_nick(raw text) returns text
language sql immutable as $$
  select left(regexp_replace(lower(coalesce(raw, '')), '[^a-z0-9_]', '', 'g'), 20)
$$;

create or replace function public.nit_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  asked text := public.nit_clean_nick(meta->>'username');
  base text;
  nick text;
  n int := 0;
  pic text := coalesce(meta->>'avatar_url', meta->>'picture');
begin
  if asked <> '' then
    -- Ник ввели при регистрации: он должен быть свободен
    if char_length(asked) < 3 then raise exception 'Ник слишком короткий'; end if;
    if exists(select 1 from profiles where username = asked) then raise exception 'username taken'; end if;
    nick := asked;
  else
    -- Google / GitHub: придумываем ник из логина GitHub, имени или почты
    base := public.nit_clean_nick(coalesce(meta->>'user_name', meta->>'preferred_username', split_part(new.email, '@', 1), 'user'));
    if char_length(base) < 3 then base := base || 'user'; end if;
    base := left(base, 16);
    nick := base;
    while exists(select 1 from profiles where username = nick) loop
      n := n + 1; nick := base || n;
    end loop;
  end if;

  insert into profiles(id, username, display_name, avatar_path, username_set)
  values (
    new.id, nick,
    nullif(left(coalesce(meta->>'display_name', meta->>'full_name', meta->>'name', ''), 30), ''),
    case when pic like 'https://%' then pic end,
    asked <> ''
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists nit_on_auth_user_created on auth.users;
create trigger nit_on_auth_user_created after insert on auth.users
  for each row execute function public.nit_new_user();

-- 4. Свободен ли ник (для подсказки при регистрации)
create or replace function public.username_free(u text) returns boolean
language sql security definer stable set search_path = public as $$
  select char_length(public.nit_clean_nick(u)) >= 3
     and public.nit_clean_nick(u) = lower(u)
     and not exists(select 1 from profiles where username = lower(u))
$$;
grant execute on function public.username_free(text) to anon, authenticated;

-- 5. Выбрать свой ник (один раз, если его придумали автоматически)
create or replace function public.set_username(u text) returns void
language plpgsql security definer set search_path = public as $$
declare v text := public.nit_clean_nick(u);
begin
  if v <> lower(u) or char_length(v) < 3 then raise exception 'Ник: 3–20 символов, латиница, цифры, _'; end if;
  if not exists(select 1 from profiles where id = auth.uid() and not username_set) then raise exception 'Ник уже выбран'; end if;
  if exists(select 1 from profiles where username = v and id <> auth.uid()) then raise exception 'Такой ник уже занят'; end if;
  update profiles set username = v, username_set = true where id = auth.uid();
end $$;
grant execute on function public.set_username(text) to authenticated;
