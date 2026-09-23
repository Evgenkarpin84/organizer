-- Новости: источники и публикации. Скрипт на ПК пишет сюда под сервисным ключом,
-- приложение читает под своим пользователем через RLS. Скрипт идемпотентен.

create table if not exists public.news_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null,
  topic text not null check (topic in ('ozon', 'cars', 'gadgets', 'print3d', 'cinema', 'ai', 'finance', 'world')),
  title text not null,
  feed_url text not null,
  enabled boolean not null default true,
  http_etag text,
  http_last_modified text,
  last_fetch_at timestamptz,
  last_status text check (last_status in ('ok', 'error')),
  last_error text,
  last_item_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, key)
);

create table if not exists public.news_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source_id uuid not null references public.news_sources (id) on delete cascade,
  topic text not null check (topic in ('ozon', 'cars', 'gadgets', 'print3d', 'cinema', 'ai', 'finance', 'world')),
  dedupe_key text not null,
  url_hash text not null,
  guid text,
  -- Храним только то, что отдаёт лента: полного текста статей и картинок здесь нет.
  title text not null check (char_length(title) <= 300),
  url text not null check (char_length(url) <= 1000),
  summary text check (summary is null or char_length(summary) <= 600),
  published_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key),
  unique (user_id, url_hash)
);

create index if not exists news_items_recent_idx on public.news_items (user_id, published_at desc);
create index if not exists news_items_topic_idx on public.news_items (user_id, topic, published_at desc);
create index if not exists news_sources_user_idx on public.news_sources (user_id, key);

alter table public.news_sources enable row level security;
alter table public.news_items enable row level security;

drop policy if exists news_sources_select_own on public.news_sources;
drop policy if exists news_sources_insert_own on public.news_sources;
drop policy if exists news_sources_update_own on public.news_sources;
drop policy if exists news_sources_delete_own on public.news_sources;

create policy news_sources_select_own on public.news_sources for select using (user_id = auth.uid());
create policy news_sources_insert_own on public.news_sources for insert with check (user_id = auth.uid());
create policy news_sources_update_own on public.news_sources for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy news_sources_delete_own on public.news_sources for delete using (user_id = auth.uid());

drop policy if exists news_items_select_own on public.news_items;
drop policy if exists news_items_insert_own on public.news_items;
drop policy if exists news_items_update_own on public.news_items;
drop policy if exists news_items_delete_own on public.news_items;

create policy news_items_select_own on public.news_items for select using (user_id = auth.uid());
create policy news_items_insert_own on public.news_items for insert with check (user_id = auth.uid());
create policy news_items_update_own on public.news_items for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy news_items_delete_own on public.news_items for delete using (user_id = auth.uid());
