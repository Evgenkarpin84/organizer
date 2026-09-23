-- Push-напоминания: подписки устройств и учёт отправленных уведомлений.
-- Скрипт идемпотентен, повторный запуск ничего не ломает.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;

create policy push_subscriptions_select_own on public.push_subscriptions for select using (user_id = auth.uid());
create policy push_subscriptions_insert_own on public.push_subscriptions for insert with check (user_id = auth.uid());
create policy push_subscriptions_update_own on public.push_subscriptions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_subscriptions_delete_own on public.push_subscriptions for delete using (user_id = auth.uid());

-- Защита от повторной отправки: remind_sent_for хранит то значение remind_at,
-- для которого уведомление уже ушло. Перенос срока меняет remind_at — и напоминание снова актуально.
alter table public.tasks add column if not exists remind_sent_at timestamptz;
alter table public.tasks add column if not exists remind_sent_for timestamptz;

create index if not exists tasks_reminders_idx
  on public.tasks (remind_at)
  where remind_at is not null and completed_at is null;

-- --------------------------------------------------------------------------
-- Расписание рассылки. Выполнять ОТДЕЛЬНО и только после деплоя функции:
-- подставьте вместо __PROJECT_REF__ идентификатор проекта, а вместо
-- __CRON_SECRET__ — значение секрета REMINDERS_CRON_SECRET из настроек функции.
-- --------------------------------------------------------------------------

-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.schedule(
--   'send-reminders',
--   '* * * * *',
--   $$
--     select net.http_post(
--       url := 'https://__PROJECT_REF__.supabase.co/functions/v1/send-reminders',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'x-cron-secret', '__CRON_SECRET__'
--       ),
--       body := '{}'::jsonb,
--       timeout_milliseconds := 20000
--     );
--   $$
-- );
--
-- Отключить рассылку:
-- select cron.unschedule('send-reminders');
--
-- Посмотреть последние запуски:
-- select * from cron.job_run_details order by start_time desc limit 20;
