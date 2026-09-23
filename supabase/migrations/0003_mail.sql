-- Почта: подключённые ящики и письма. Скрипт на ПК пишет сюда под сервисным ключом,
-- приложение читает под своим пользователем через RLS. Скрипт идемпотентен.

create table if not exists public.mail_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null,
  label text not null,
  email text not null,
  provider text not null check (provider in ('mailru', 'yandex')),
  folder text not null default 'INBOX',
  uid_validity bigint,
  last_uid bigint not null default 0,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (user_id, key)
);

create table if not exists public.mail_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null references public.mail_accounts (id) on delete cascade,
  uid bigint not null,
  dedupe_key text not null,
  message_id text,
  subject text check (subject is null or char_length(subject) <= 500),
  from_name text,
  from_email text,
  to_emails text[] not null default '{}',
  sent_at timestamptz,
  received_at timestamptz not null,
  -- Хранится только текст и только обрезанный: письмо целиком всегда остаётся в ящике.
  preview text check (preview is null or char_length(preview) <= 400),
  body_text text check (body_text is null or char_length(body_text) <= 4000),
  body_truncated boolean not null default false,
  has_attachments boolean not null default false,
  attachment_names text[] not null default '{}',
  is_bulk boolean not null default false,
  size_bytes integer,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key),
  unique (account_id, uid)
);

create index if not exists mail_messages_inbox_idx on public.mail_messages (user_id, archived_at, received_at desc);
create index if not exists mail_messages_account_idx on public.mail_messages (user_id, account_id, received_at desc);
create index if not exists mail_accounts_user_idx on public.mail_accounts (user_id, key);

alter table public.mail_accounts enable row level security;
alter table public.mail_messages enable row level security;

drop policy if exists mail_accounts_select_own on public.mail_accounts;
drop policy if exists mail_accounts_insert_own on public.mail_accounts;
drop policy if exists mail_accounts_update_own on public.mail_accounts;
drop policy if exists mail_accounts_delete_own on public.mail_accounts;

create policy mail_accounts_select_own on public.mail_accounts for select using (user_id = auth.uid());
create policy mail_accounts_insert_own on public.mail_accounts for insert with check (user_id = auth.uid());
create policy mail_accounts_update_own on public.mail_accounts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy mail_accounts_delete_own on public.mail_accounts for delete using (user_id = auth.uid());

drop policy if exists mail_messages_select_own on public.mail_messages;
drop policy if exists mail_messages_insert_own on public.mail_messages;
drop policy if exists mail_messages_update_own on public.mail_messages;
drop policy if exists mail_messages_delete_own on public.mail_messages;

create policy mail_messages_select_own on public.mail_messages for select using (user_id = auth.uid());
create policy mail_messages_insert_own on public.mail_messages for insert with check (user_id = auth.uid());
create policy mail_messages_update_own on public.mail_messages for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy mail_messages_delete_own on public.mail_messages for delete using (user_id = auth.uid());
