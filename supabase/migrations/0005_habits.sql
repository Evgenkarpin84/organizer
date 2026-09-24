-- Привычки и чеклисты. Скрипты на ПК здесь не участвуют: данные создаёт сам владелец.
-- Скрипт идемпотентен и не трогает таблицы этапов 1–4.

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  note text,
  goal_type text not null default 'daily' check (goal_type in ('daily', 'times_per_week', 'weekdays')),
  goal_times smallint not null default 1 check (goal_times between 1 and 7),
  goal_weekdays smallint[] not null default '{}' check (goal_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  position integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Отметка хранится датой в местном поясе устройства, как due_date у задач.
create table if not exists public.habit_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  done_on date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, done_on)
);

create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  position integer not null default 0,
  started_at timestamptz,
  last_completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Пункт одновременно хранит состояние текущего прохождения: истории прохождений нет.
create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  checklist_id uuid not null references public.checklists (id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 120),
  position integer not null default 0,
  checked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists habits_user_position_idx on public.habits (user_id, position);
create index if not exists habit_entries_user_date_idx on public.habit_entries (user_id, done_on);
create index if not exists checklists_user_position_idx on public.checklists (user_id, position);
create index if not exists checklist_items_position_idx on public.checklist_items (checklist_id, position);

drop trigger if exists habits_set_updated_at on public.habits;
create trigger habits_set_updated_at
before update on public.habits
for each row execute function public.set_updated_at();

drop trigger if exists checklists_set_updated_at on public.checklists;
create trigger checklists_set_updated_at
before update on public.checklists
for each row execute function public.set_updated_at();

alter table public.habits enable row level security;
alter table public.habit_entries enable row level security;
alter table public.checklists enable row level security;
alter table public.checklist_items enable row level security;

drop policy if exists habits_select_own on public.habits;
drop policy if exists habits_insert_own on public.habits;
drop policy if exists habits_update_own on public.habits;
drop policy if exists habits_delete_own on public.habits;

create policy habits_select_own on public.habits for select using (user_id = auth.uid());
create policy habits_insert_own on public.habits for insert with check (user_id = auth.uid());
create policy habits_update_own on public.habits for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy habits_delete_own on public.habits for delete using (user_id = auth.uid());

drop policy if exists habit_entries_select_own on public.habit_entries;
drop policy if exists habit_entries_insert_own on public.habit_entries;
drop policy if exists habit_entries_update_own on public.habit_entries;
drop policy if exists habit_entries_delete_own on public.habit_entries;

create policy habit_entries_select_own on public.habit_entries for select using (user_id = auth.uid());
create policy habit_entries_insert_own on public.habit_entries for insert with check (user_id = auth.uid());
create policy habit_entries_update_own on public.habit_entries for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy habit_entries_delete_own on public.habit_entries for delete using (user_id = auth.uid());

drop policy if exists checklists_select_own on public.checklists;
drop policy if exists checklists_insert_own on public.checklists;
drop policy if exists checklists_update_own on public.checklists;
drop policy if exists checklists_delete_own on public.checklists;

create policy checklists_select_own on public.checklists for select using (user_id = auth.uid());
create policy checklists_insert_own on public.checklists for insert with check (user_id = auth.uid());
create policy checklists_update_own on public.checklists for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy checklists_delete_own on public.checklists for delete using (user_id = auth.uid());

drop policy if exists checklist_items_select_own on public.checklist_items;
drop policy if exists checklist_items_insert_own on public.checklist_items;
drop policy if exists checklist_items_update_own on public.checklist_items;
drop policy if exists checklist_items_delete_own on public.checklist_items;

create policy checklist_items_select_own on public.checklist_items for select using (user_id = auth.uid());
create policy checklist_items_insert_own on public.checklist_items for insert with check (user_id = auth.uid());
create policy checklist_items_update_own on public.checklist_items for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy checklist_items_delete_own on public.checklist_items for delete using (user_id = auth.uid());
