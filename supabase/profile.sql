-- ============================================================
-- Профиль: имя, описание, аватарка. Supabase → SQL Editor → Run.
-- Можно запускать повторно.
-- ============================================================

-- 1. Новые поля профиля
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists avatar_path text;

do $$ begin
  alter table public.profiles add constraint profiles_display_name_len check (display_name is null or char_length(display_name) <= 30);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_bio_len check (bio is null or char_length(bio) <= 160);
exception when duplicate_object then null; end $$;

-- 2. Менять можно только свой профиль и только эти три поля.
--    Ник (username) менять нельзя: по нему происходит вход.
alter table public.profiles enable row level security;
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (display_name, bio, avatar_path) on public.profiles to authenticated;

-- 3. Хранилище аватарок: публичное чтение, запись только в свою папку <id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true;

drop policy if exists "avatars upload own" on storage.objects;
create policy "avatars upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars update own" on storage.objects;
create policy "avatars update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars delete own" on storage.objects;
create policy "avatars delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
