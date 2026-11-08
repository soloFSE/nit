-- ============================================================
-- Обновление v4.3: «Нить» — серия дней общения (нить → клубок → золотой → алмазный).
-- Выполнить один раз: Supabase → SQL Editor → Run. Можно запускать повторно.
--  • user_streaks — ваша серия: день засчитывается, если вы отправили хоть одно сообщение (в личку или группу);
--  • pair_streaks — серия с каждым другом: день засчитывается, если ОБА написали друг другу в этот день.
-- Дни считаются по московскому времени. Счётчики ведёт триггер на сервере — подкрутить с телефона нельзя.
-- Триггер никогда не мешает отправке сообщений (любая его ошибка глушится).
-- ============================================================

create table if not exists public.user_streaks(
  user_id uuid primary key references auth.users on delete cascade,
  streak int not null default 0,
  best int not null default 0,
  last_day date
);
create table if not exists public.pair_streaks(
  a uuid not null references auth.users on delete cascade,
  b uuid not null references auth.users on delete cascade,
  last_a date,
  last_b date,
  streak int not null default 0,
  best int not null default 0,
  last_day date,
  primary key (a, b),
  check (a < b)
);
alter table public.user_streaks enable row level security;
alter table public.pair_streaks enable row level security;
drop policy if exists "user streaks own" on public.user_streaks;
create policy "user streaks own" on public.user_streaks for select to authenticated using (user_id = auth.uid());
drop policy if exists "pair streaks own" on public.pair_streaks;
create policy "pair streaks own" on public.pair_streaks for select to authenticated using (a = auth.uid() or b = auth.uid());
-- Записывать в таблицы с клиента нельзя: только триггер ниже.

create or replace function public.nit_streak() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d date := (now() at time zone 'Europe/Moscow')::date;
  us record; ps record; pa uuid; pb uuid; ns int;
begin
  begin
    if coalesce(new.body, '') ~ '^::(gev|ttl):' then return new; end if;
    -- моя серия
    select * into us from user_streaks where user_id = new.sender;
    if not found then
      insert into user_streaks(user_id, streak, best, last_day) values (new.sender, 1, 1, d);
    elsif us.last_day is distinct from d then
      ns := case when us.last_day = d - 1 then us.streak + 1 else 1 end;
      update user_streaks set streak = ns, best = greatest(best, ns), last_day = d where user_id = new.sender;
    end if;
    -- серия пары (только личные сообщения)
    if new.recipient is not null and new.recipient <> new.sender then
      pa := least(new.sender, new.recipient); pb := greatest(new.sender, new.recipient);
      insert into pair_streaks(a, b) values (pa, pb) on conflict do nothing;
      if new.sender = pa then update pair_streaks set last_a = d where a = pa and b = pb;
      else update pair_streaks set last_b = d where a = pa and b = pb; end if;
      select * into ps from pair_streaks where a = pa and b = pb;
      if ps.last_a = d and ps.last_b = d and ps.last_day is distinct from d then
        ns := case when ps.last_day = d - 1 then ps.streak + 1 else 1 end;
        update pair_streaks set streak = ns, best = greatest(best, ns), last_day = d where a = pa and b = pb;
      end if;
    end if;
  exception when others then
    null; -- счётчики не должны ломать отправку сообщений
  end;
  return new;
end $$;
drop trigger if exists nit_streak on public.messages;
create trigger nit_streak after insert on public.messages for each row execute function public.nit_streak();

do $$ begin alter publication supabase_realtime add table public.pair_streaks; exception when duplicate_object then null; end $$;
select 'v6 ok' as result;
