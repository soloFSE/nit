-- ============================================================
-- Истории (сторис): фото/видео на 24 часа, видят только друзья; кто посмотрел — видит автор.
-- Выполнить один раз: Supabase → SQL Editor → Run. Можно запускать повторно.
-- ============================================================

-- 1. Друзья ли двое (для правил доступа)
create or replace function public.are_friends(x uuid, y uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists(select 1 from friendships where status = 'accepted' and ((a = x and b = y) or (a = y and b = x)))
$$;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- 2. Таблицы
create table if not exists public.stories(
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  media_path text not null,
  kind text not null default 'photo',
  caption text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
do $$ begin
  alter table public.stories add constraint stories_kind_chk check (kind in ('photo','video'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.stories add constraint stories_caption_len check (caption is null or char_length(caption) <= 300);
exception when duplicate_object then null; end $$;
create index if not exists stories_owner_idx on public.stories(owner, created_at desc);

create table if not exists public.story_views(
  story_id uuid not null references public.stories on delete cascade,
  viewer uuid not null default auth.uid() references auth.users on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer)
);

-- 3. Правила доступа
alter table public.stories enable row level security;
alter table public.story_views enable row level security;

drop policy if exists "stories read" on public.stories;
create policy "stories read" on public.stories for select to authenticated
  using (owner = auth.uid() or (expires_at > now() and public.are_friends(auth.uid(), owner)));
drop policy if exists "stories add" on public.stories;
create policy "stories add" on public.stories for insert to authenticated with check (owner = auth.uid());
drop policy if exists "stories remove" on public.stories;
create policy "stories remove" on public.stories for delete to authenticated using (owner = auth.uid());

drop policy if exists "story views add" on public.story_views;
create policy "story views add" on public.story_views for insert to authenticated
  with check (viewer = auth.uid() and exists(
    select 1 from public.stories s where s.id = story_id and s.expires_at > now() and public.are_friends(auth.uid(), s.owner)));
drop policy if exists "story views read" on public.story_views;
create policy "story views read" on public.story_views for select to authenticated
  using (viewer = auth.uid() or exists(select 1 from public.stories s where s.id = story_id and s.owner = auth.uid()));

-- 4. Хранилище: приватное, файл кладёт только автор в свою папку, читают автор и его друзья
insert into storage.buckets (id, name, public, file_size_limit)
values ('stories', 'stories', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists "stories upload own" on storage.objects;
create policy "stories upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'stories' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "stories delete own" on storage.objects;
create policy "stories delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'stories' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "stories read friends" on storage.objects;
create policy "stories read friends" on storage.objects for select to authenticated
  using (bucket_id = 'stories' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.are_friends(auth.uid(), ((storage.foldername(name))[1])::uuid)));

-- 5. Мгновенное появление новых историй
do $$ begin alter publication supabase_realtime add table public.stories; exception when duplicate_object then null; end $$;

select 'stories ok' as result;
