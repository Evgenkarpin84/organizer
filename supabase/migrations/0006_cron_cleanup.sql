-- Чистка журнала pg_cron. Выполнять после включения расписания рассылки (ЗАПУСК.md, шаг 2.6).
--
-- cron.job_run_details сам не чистится: при запуске send-reminders раз в минуту это около 1 МБ
-- в сутки, за год — больше половины бесплатных 500 МБ, и первыми от переполнения пострадали бы
-- задачи. Раз в сутки удаляем записи старше 7 дней — недели хватает, чтобы разобрать сбой.
--
-- Отключить: select cron.unschedule('cleanup-cron-history');

select cron.schedule(
  'cleanup-cron-history',
  '30 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);
