-- ============================================================
-- Обновление v4.1: Премиум-аккаунты. Выполнить один раз: Supabase → SQL Editor → Run. Можно запускать повторно.
-- Выдаёт Премиум только админ приложения (app_admins из titles.sql).
-- ============================================================

create table if not exists public.premium_users(
  user_id uuid primary key references auth.users on delete cascade,
  until timestamptz,                 -- null = навсегда
  emoji_status text,                 -- например ':hc12:' — эмодзи рядом с именем вместо звезды
  color text,                        -- цвет профиля '#rrggbb'
  granted_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now()
);
do $$ begin alter table public.premium_users add constraint prem_color_ok check (color is null or color ~ '^#[0-9a-fA-F]{6}$');
exception when duplicate_object then null; end $$;
do $$ begin alter table public.premium_users add constraint prem_status_ok check (emoji_status is null or emoji_status ~ '^:[a-z]{2,6}[0-9]{1,3}:$');
exception when duplicate_object then null; end $$;
alter table public.premium_users enable row level security;
drop policy if exists "premium read" on public.premium_users;
create policy "premium read" on public.premium_users for select to authenticated using (true);
drop policy if exists "premium grant" on public.premium_users;
create policy "premium grant" on public.premium_users for insert to authenticated with check (public.is_app_admin(auth.uid()));
drop policy if exists "premium change" on public.premium_users;
create policy "premium change" on public.premium_users for update to authenticated using (public.is_app_admin(auth.uid())) with check (public.is_app_admin(auth.uid()));
drop policy if exists "premium revoke" on public.premium_users;
create policy "premium revoke" on public.premium_users for delete to authenticated using (public.is_app_admin(auth.uid()));

-- Свои настройки (статус-эмодзи и цвет) меняет сам владелец Премиума
create or replace function public.set_premium_prefs(e text, c text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from premium_users where user_id = auth.uid() and (until is null or until > now())) then
    raise exception 'Премиум не подключён';
  end if;
  update premium_users set emoji_status = nullif(e, ''), color = nullif(c, '') where user_id = auth.uid();
end $$;
grant execute on function public.set_premium_prefs(text, text) to authenticated;

-- Премиум-эмодзи (:код12:) в сообщениях — только с активным Премиумом (проверка на сервере)
create or replace function public.nit_premium_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.body ~ '(^|\s):[a-z]{2,6}[0-9]{1,3}:(\s|$)'
     and not exists(select 1 from premium_users where user_id = new.sender and (until is null or until > now()))
     and not public.is_app_admin(new.sender) then
    raise exception 'Премиум-эмодзи доступны только с Премиум';
  end if;
  return new;
end $$;
drop trigger if exists nit_premium_check on public.messages;
create trigger nit_premium_check before insert or update of body on public.messages
  for each row execute function public.nit_premium_check();

do $$ begin alter publication supabase_realtime add table public.premium_users; exception when duplicate_object then null; end $$;
select 'v5 ok' as result;
