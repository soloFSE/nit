-- ============================================================
-- Обновление v5.1: каталог подарков «Кавказ». Выполнить один раз: Supabase → SQL Editor → Run. Можно запускать повторно.
--  • убрали «Осетинские пироги» (если их уже кому-то подарили — просто снимаются с продажи, у владельцев остаются);
--  • добавили номерные знаки «95» (Чечня) и «06» (Ингушетия) — самые дорогие подарки, тираж 95 и 60 штук;
--  • всё, что связано с Чечнёй и Ингушетией, теперь дороже остальных подарков.
-- ============================================================
delete from public.gift_catalog where id = 'os_pie' and not exists (select 1 from public.gifts where type = 'os_pie');
update public.gift_catalog set active = false where id = 'os_pie';

insert into public.gift_catalog(id, name, price, supply, coll) values
  ('cz_dagger','Кинжал',90,null,'caucasus'),
  ('dg_eagle','Орёл Дагестана',180,300,'caucasus'),
  ('kb_elbrus','Эльбрус',200,250,'caucasus'),
  ('ch_papakha','Папаха',550,500,'caucasus'),
  ('in_sun','Солярный знак',550,500,'caucasus'),
  ('ch_tower','Башня Нохчийчоь',700,300,'caucasus'),
  ('in_tower','Башня Ингушетии',700,300,'caucasus'),
  ('ch_wolf','Горный волк',900,150,'caucasus'),
  ('plate95','Номер 95',1500,95,'caucasus'),
  ('plate06','Номер 06',1500,60,'caucasus')
on conflict (id) do update set name = excluded.name, price = excluded.price, supply = excluded.supply, coll = excluded.coll;

select 'v9 ok' as result;
