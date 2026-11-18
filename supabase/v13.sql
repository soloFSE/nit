-- v13: личные баннеры профиля 'p:chess' и 'p:wt' — ставить их может только пользователь @ne95gr (подписка для этого не нужна).
-- Остальные баннеры, как и раньше, — по подписке «Нить Премиум».
create or replace function public.profiles_banner_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.banner is distinct from old.banner and new.banner is not null then
    if new.banner in ('p:chess', 'p:wt') then
      if lower(coalesce(new.username::text, '')) <> 'ne95gr' then
        raise exception 'Этот баннер — личный, он выдан другому пользователю';
      end if;
    else
      if not (exists(select 1 from premium_users where user_id = new.id and (until is null or until > now()))
              or public.admin_role(auth.uid()) >= 3) then
        raise exception 'Баннеры доступны только с подпиской «Нить Премиум»';
      end if;
      if not (new.banner like 'p:%' or new.banner like new.id::text || '/%') then
        raise exception 'Недопустимый баннер';
      end if;
    end if;
  end if;
  return new;
end $$;
select 'v13 ok';
