-- Органайзер: списки и задачи. Пользователь видит только свои строки.
create extension if not exists pgcrypto;

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  color text not null default 'slate' check (color in ('slate', 'blue', 'green', 'amber', 'rose', 'violet')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  list_id uuid references public.lists (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  note text,
  due_date date,
  due_time time,
  -- заполняется на этапе 2 (push-напоминания)
  remind_at timestamptz,
  priority smallint not null default 0 check (priority between 0 and 3),
  repeat_type text not null default 'none' check (repeat_type in ('none', 'daily', 'weekly', 'monthly')),
  repeat_interval smallint not null default 1 check (repeat_interval between 1 and 31),
  repeat_weekdays smallint[] not null default '{}' check (repeat_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  repeat_day_of_month smallint check (repeat_day_of_month between 1 and 31),
  completed_at timestamptz,
  last_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_due_idx on public.tasks (user_id, due_date);
create index if not exists tasks_user_completed_idx on public.tasks (user_id, completed_at);
create index if not exists tasks_user_list_idx on public.tasks (user_id, list_id);
create index if not exists lists_user_position_idx on public.lists (user_id, position);

create or replace function public.set_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

alter table public.lists enable row level security;
alter table public.tasks enable row level security;

drop policy if exists lists_select_own on public.lists;
drop policy if exists lists_insert_own on public.lists;
drop policy if exists lists_update_own on public.lists;
drop policy if exists lists_delete_own on public.lists;

create policy lists_select_own on public.lists for select using (user_id = auth.uid());
create policy lists_insert_own on public.lists for insert with check (user_id = auth.uid());
create policy lists_update_own on public.lists for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy lists_delete_own on public.lists for delete using (user_id = auth.uid());

drop policy if exists tasks_select_own on public.tasks;
drop policy if exists tasks_insert_own on public.tasks;
drop policy if exists tasks_update_own on public.tasks;
drop policy if exists tasks_delete_own on public.tasks;

create policy tasks_select_own on public.tasks for select using (user_id = auth.uid());
create policy tasks_insert_own on public.tasks for insert with check (user_id = auth.uid());
create policy tasks_update_own on public.tasks for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy tasks_delete_own on public.tasks for delete using (user_id = auth.uid());
