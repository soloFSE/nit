-- ============================================================
-- Автоудаление старых сообщений — чтобы база не засорялась.
-- ВНИМАНИЕ: удаляет сообщения НАВСЕГДА у всех. Срок задаётся в последней строке (сейчас 7 дней).
-- Выполнить один раз: Supabase → SQL Editor → Run. Повторный запуск просто обновит расписание.
-- ============================================================

-- Чистка: сообщения старше N дней, а также давно удалённые («Удалить у всех») и истёкшие исчезающие.
-- Закреплённые сообщения не трогаем. Файлы в хранилище остаются (их можно почистить отдельно).
create or replace function public.nit_cleanup(days int) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from messages m
   where (m.created_at < now() - make_interval(days => days)
          or (m.deleted_at is not null and m.deleted_at < now() - interval '7 days')
          or (m.expires_at is not null and m.expires_at < now() - interval '1 day'))
     and not exists(select 1 from pins p where p.message_id = m.id);
  get diagnostics n = row_count;
  delete from stories where expires_at < now() - interval '2 days';
  return n;
end $$;
revoke all on function public.nit_cleanup(int) from public, anon, authenticated;

-- Расписание: каждую ночь в 04:00 по UTC (нужно расширение pg_cron: Database → Extensions → pg_cron)
create extension if not exists pg_cron;
select cron.unschedule('nit-cleanup') where exists(select 1 from cron.job where jobname = 'nit-cleanup');
select cron.schedule('nit-cleanup', '0 4 * * *', $$select public.nit_cleanup(7)$$);

select 'autoclean ok' as result;
