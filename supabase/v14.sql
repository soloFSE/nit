-- v14: личный набор эмодзи «Шахматные фигуры» (:chs0: … :chs11:) — пользоваться им (в сообщениях и как статус рядом с ником) может только @ne95gr.
-- Остальные премиум-эмодзи — по подписке, как раньше. Подписка для личного набора не нужна.

-- 1. Сообщения: личные эмодзи — только @ne95gr; всё остальное — по правилам Премиума
create or replace function public.nit_premium_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare rest text;
begin
  if new.body ~ ':chs[0-9]{1,3}:' and not exists(select 1 from profiles where id = new.sender and lower(username::text) = 'ne95gr') then
    raise exception 'Эти эмодзи — личные, они выданы другому пользователю';
  end if;
  rest := regexp_replace(new.body, '(^|\s):chs[0-9]{1,3}:(\s|$)', ' ', 'g');
  if rest ~ '(^|\s):[a-z]{2,6}[0-9]{1,3}:(\s|$)'
     and not exists(select 1 from premium_users where user_id = new.sender and (until is null or until > now()))
     and not public.is_app_admin(new.sender) then
    raise exception 'Премиум-эмодзи доступны только с Премиум';
  end if;
  return new;
end $$;

-- 2. Статус-эмодзи и цвет: личный статус :chs…: ставит только @ne95gr (без подписки — для него заводится «пустая» запись с истёкшим сроком)
create or replace function public.set_premium_prefs(e text, c text) returns void
language plpgsql security definer set search_path = public as $$
declare own boolean;
begin
  own := exists(select 1 from profiles where id = auth.uid() and lower(username::text) = 'ne95gr');
  if coalesce(e, '') ~ '^:chs[0-9]{1,3}:$' and not own then
    raise exception 'Этот статус — личный, он выдан другому пользователю';
  end if;
  if not exists(select 1 from premium_users where user_id = auth.uid() and (until is null or until > now())) then
    if own and (coalesce(e, '') = '' or e ~ '^:chs[0-9]{1,3}:$') and coalesce(c, '') = '' then
      insert into premium_users(user_id, until, emoji_status) values (auth.uid(), now() - interval '1 day', nullif(e, ''))
      on conflict (user_id) do update set emoji_status = nullif(e, '');
      return;
    end if;
    raise exception 'Премиум не подключён';
  end if;
  update premium_users set emoji_status = nullif(e, ''), color = nullif(c, '') where user_id = auth.uid();
end $$;
select 'v14 ok';
