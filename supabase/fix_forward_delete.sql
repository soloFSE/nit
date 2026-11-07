-- ============================================================
-- «Удалить у всех» не ломает пересланные копии фото/файлов.
-- Выполнить один раз: Supabase → SQL Editor → Run. Можно запускать повторно.
--
-- Пересланное сообщение ссылается на тот же файл в хранилище 'photos'.
-- Раньше при «Удалить у всех» файл стирался, и у копий вместо фото было пусто.
-- Теперь приложение сначала спрашивает file_in_use(): если на файл ещё ссылается
-- хоть одно не удалённое сообщение (в любом чате, даже невидимом вам), файл остаётся.
-- ============================================================
create or replace function public.file_in_use(p text, except_id bigint) returns boolean
language sql security definer stable set search_path = public as $$
  select p like auth.uid()::text || '/%'          -- спрашивать можно только про свои файлы
     and exists(select 1 from messages where image_path = p and id <> except_id and deleted_at is null)
     or p not like auth.uid()::text || '/%'      -- про чужие всегда «занят»: удалять их вы и не можете
$$;
grant execute on function public.file_in_use(text, bigint) to authenticated;
