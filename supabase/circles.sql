-- Кружочки: разрешаем хранилищу 'photos' принимать видео.
-- Supabase → SQL Editor → Run. Можно запускать повторно.
update storage.buckets
set allowed_mime_types = array['image/*', 'audio/*', 'video/*']
where id = 'photos';
