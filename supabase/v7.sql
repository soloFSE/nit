-- ============================================================
-- Обновление v4.5: Подарки и узелки. Выполнить один раз: Supabase → SQL Editor → Run. Можно запускать повторно.
--  • узелки — внутренняя валюта «Нити» (за реальные деньги не покупается): ежедневный бонус, растёт с нитью (×2 у Премиума);
--  • подарки дарят друзьям; у каждого — номер из тиража (у лимитированных) и случайная редкость/фон;
--  • подарок можно обменять обратно на 50% узелков или скрыть из профиля.
-- Все действия — только через функции ниже (баланс и подарки с телефона напрямую изменить нельзя).
-- ============================================================

create table if not exists public.wallets(
  user_id uuid primary key references auth.users on delete cascade,
  balance int not null default 0 check (balance >= 0),
  last_claim date
);
create table if not exists public.gift_catalog(
  id text primary key,
  name text not null,
  price int not null check (price > 0),
  supply int,                        -- null = без ограничения тиража
  sold int not null default 0,
  active boolean not null default true
);
create table if not exists public.gifts(
  id bigserial primary key,
  type text not null references public.gift_catalog(id),
  owner uuid not null references auth.users on delete cascade,
  sender uuid references auth.users on delete set null,
  anon boolean not null default false,
  note text,
  bg int not null default 0,         -- номер фона 0..8
  pat int not null default 0,        -- номер узора 0..4
  rarity text not null default 'common',
  serial int not null default 1,
  shown boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists gifts_owner_idx on public.gifts(owner, created_at desc);

alter table public.wallets enable row level security;
alter table public.gift_catalog enable row level security;
alter table public.gifts enable row level security;
drop policy if exists "wallet own" on public.wallets;
create policy "wallet own" on public.wallets for select to authenticated using (user_id = auth.uid());
drop policy if exists "catalog read" on public.gift_catalog;
create policy "catalog read" on public.gift_catalog for select to authenticated using (true);
drop policy if exists "gifts read" on public.gifts;
create policy "gifts read" on public.gifts for select to authenticated using (shown or owner = auth.uid() or sender = auth.uid());

-- Каталог (цены в узелках; supply — тираж)
insert into public.gift_catalog(id, name, price, supply) values
  ('yarn1','Моток',5,null),('yarn2','Клубок',10,null),('heart','Сердце',20,null),('flame','Огонёк',30,null),
  ('bug','Жучок-тестер',25,null),('star','Звезда',40,null),('shield','Щит',50,null),('rocket','Ракета',60,null),
  ('gold','Золотой клубок',120,500),('crown','Корона',200,300),('diamond','Алмаз',300,150),('legend','Легендарный клубок',500,50)
on conflict (id) do update set name = excluded.name, price = excluded.price, supply = excluded.supply;

-- Ежедневный бонус: 10 + серия (до 30), у Премиума ×2; первый раз +50 приветственных
create or replace function public.claim_daily() returns int
language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Europe/Moscow')::date; w public.wallets; st int := 0; amt int; prem boolean;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into wallets(user_id, balance) values (auth.uid(), 0) on conflict do nothing;
  select * into w from wallets where user_id = auth.uid() for update;
  if w.last_claim = d then raise exception 'Бонус уже получен сегодня'; end if;
  begin
    select case when last_day >= d - 1 then streak else 0 end into st from user_streaks where user_id = auth.uid();
  exception when others then st := 0; end;
  begin
    select exists(select 1 from premium_users where user_id = auth.uid() and (until is null or until > now())) into prem;
  exception when others then prem := false; end;
  amt := (10 + least(coalesce(st, 0), 30)) * case when prem then 2 else 1 end;
  if w.last_claim is null then amt := amt + 50; end if;
  update wallets set balance = balance + amt, last_claim = d where user_id = auth.uid();
  return amt;
end $$;
grant execute on function public.claim_daily() to authenticated;

-- Подарить другу (только друзьям)
create or replace function public.send_gift(to_user uuid, gtype text, gnote text, is_anon boolean) returns public.gifts
language plpgsql security definer set search_path = public as $$
declare cat public.gift_catalog; w public.wallets; ser int; roll float; rar text; bgi int; g public.gifts;
begin
  if to_user is null or to_user = auth.uid() then raise exception 'Нельзя подарить самому себе'; end if;
  if not public.are_friends(auth.uid(), to_user) then raise exception 'Дарить можно только друзьям'; end if;
  select * into cat from gift_catalog where id = gtype and active;
  if not found then raise exception 'Такого подарка нет'; end if;
  select * into w from wallets where user_id = auth.uid() for update;
  if not found or w.balance < cat.price then raise exception 'Недостаточно узелков'; end if;
  update gift_catalog set sold = sold + 1 where id = gtype and (supply is null or sold < supply) returning sold into ser;
  if ser is null then raise exception 'Тираж этого подарка закончился'; end if;
  update wallets set balance = balance - cat.price where user_id = auth.uid();
  roll := random() * case when cat.supply is not null then 0.7 else 1 end; -- у лимитированных шансы выше
  if roll < 0.03 then rar := 'legendary'; bgi := 8;
  elsif roll < 0.12 then rar := 'epic'; bgi := 6 + floor(random() * 2)::int;
  elsif roll < 0.32 then rar := 'rare'; bgi := 4 + floor(random() * 2)::int;
  else rar := 'common'; bgi := floor(random() * 4)::int; end if;
  insert into gifts(type, owner, sender, anon, note, bg, pat, rarity, serial)
  values (gtype, to_user, auth.uid(), coalesce(is_anon, false), left(nullif(trim(gnote), ''), 100), bgi, floor(random() * 5)::int, rar, ser)
  returning * into g;
  return g;
end $$;
grant execute on function public.send_gift(uuid, text, text, boolean) to authenticated;

-- Обменять подарок на узелки (50% цены). Подарок исчезает, номер тиража не освобождается
create or replace function public.sell_gift(gid bigint) returns int
language plpgsql security definer set search_path = public as $$
declare g public.gifts; p int; nb int;
begin
  select * into g from gifts where id = gid and owner = auth.uid() for update;
  if not found then raise exception 'Подарок не найден'; end if;
  select price into p from gift_catalog where id = g.type;
  delete from gifts where id = gid;
  insert into wallets(user_id, balance) values (auth.uid(), 0) on conflict do nothing;
  update wallets set balance = balance + (p / 2) where user_id = auth.uid() returning balance into nb;
  return nb;
end $$;
grant execute on function public.sell_gift(bigint) to authenticated;

create or replace function public.set_gift_shown(gid bigint, v boolean) returns void
language sql security definer set search_path = public as $$
  update gifts set shown = v where id = gid and owner = auth.uid()
$$;
grant execute on function public.set_gift_shown(bigint, boolean) to authenticated;

do $$ begin alter publication supabase_realtime add table public.wallets; exception when duplicate_object then null; end $$;
select 'v7 ok' as result;
