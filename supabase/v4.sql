-- ============================================================
-- Обновление v4. Выполнить один раз: Supabase → SQL Editor → Run. Можно запускать повторно.
-- ============================================================

-- Закреплённые и заархивированные чаты (у каждого человека свои)
create table if not exists public.chat_prefs(
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  chat text not null,
  pinned boolean not null default false,
  archived boolean not null default false,
  pin_at bigint,
  primary key (user_id, chat)
);
alter table public.chat_prefs enable row level security;
drop policy if exists "prefs own all" on public.chat_prefs;
create policy "prefs own all" on public.chat_prefs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

select 'v4 ok' as result;
