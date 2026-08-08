-- Фото у каждого вкуса.
--
-- Фото товара до сих пор лежало в репозитории файлом `data/photos/<id>.jpg`: положить его
-- мог только тот, у кого есть доступ к коду, а менеджер, заводящий вкус в панели, не мог.
-- И фото было одно на всю модель, хотя вкусы выглядят по-разному.
--
-- Кладём картинки в Storage, а не в базу как data-URL (так сделан аватар в profiles): каталог
-- читают все покупатели, и восемь десятков картинок по сотне килобайт раздули бы каждый
-- ответ витрины до мегабайтов. В flavor_meta хранится только путь внутри корзины, адрес
-- витрина собирает сама. Полный URL хранить нельзя: он привязан к домену проекта.

alter table public.flavor_meta add column if not exists photo text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'flavor_meta_photo_path') then
    -- Путь, а не адрес: без схемы, без хоста, без выхода вверх по каталогам.
    alter table public.flavor_meta add constraint flavor_meta_photo_path
      check (photo is null or (photo ~ '^[a-z0-9][a-z0-9/_-]{0,120}\.jpg$' and photo !~ '\.\.'));
  end if;
end $$;

-- ---- корзина Storage ----
-- Публичная на чтение: фото товара и так видит любой, кто открыл витрину.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('flavors', 'flavors', true, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg'];

-- Загружает и удаляет только сотрудник панели. Público чтение идёт мимо этих политик,
-- его даёт сам признак public у корзины.
drop policy if exists flavors_read on storage.objects;
create policy flavors_read on storage.objects for select
  using (bucket_id = 'flavors');

drop policy if exists flavors_write on storage.objects;
create policy flavors_write on storage.objects for insert to authenticated
  with check (bucket_id = 'flavors' and public.is_admin());

drop policy if exists flavors_update on storage.objects;
create policy flavors_update on storage.objects for update to authenticated
  using (bucket_id = 'flavors' and public.is_admin())
  with check (bucket_id = 'flavors' and public.is_admin());

drop policy if exists flavors_delete on storage.objects;
create policy flavors_delete on storage.objects for delete to authenticated
  using (bucket_id = 'flavors' and public.is_admin());

notify pgrst, 'reload schema';
