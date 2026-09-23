// Рассылка напоминаний. Вызывается pg_cron раз в минуту, доступ закрыт секретом в заголовке.
import * as webpush from '@negrel/webpush'
import { createClient } from '@supabase/supabase-js'
import {
  buildPushPayload,
  groupSubscriptionsByUser,
  selectDueReminders,
  sentPatch,
  shouldDropSubscription,
  vapidJwkFromRaw,
  type PushSubscriptionRow,
  type ReminderTask,
} from './reminders.ts'

const TASK_COLUMNS = 'id, user_id, title, due_date, due_time, remind_at, remind_sent_for, completed_at'

// Нижняя граница выборки: без неё старые неотправленные напоминания навсегда занимают лимит,
// и новые перестают попадать в запрос. Берётся с запасом к окну доставки.
const QUERY_WINDOW_MINUTES = 60

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Отметка «напоминание отправлено». Ошибку логируем: молчаливый сбой привёл бы к повторам. */
async function markSent(
  supabase: ReturnType<typeof createClient>,
  task: ReminderTask,
  nowIso: string,
): Promise<boolean> {
  try {
    const { error } = await supabase.from('tasks').update(sentPatch(task, nowIso)).eq('id', task.id)
    if (error) {
      console.error('не удалось отметить напоминание отправленным', task.id, error.message)
      return false
    }
    return true
  } catch (cause) {
    console.error('сбой отметки напоминания', task.id, cause)
    return false
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Поддерживается только POST' }, 405)

  const cronSecret = Deno.env.get('REMINDERS_CRON_SECRET')
  if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) {
    return json({ error: 'Нет доступа' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidSubject = Deno.env.get('VAPID_SUBJECT')
  if (!supabaseUrl || !serviceRoleKey || !vapidPublic || !vapidPrivate || !vapidSubject) {
    return json({ error: 'Не заданы переменные окружения функции' }, 500)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const nowIso = new Date().toISOString()

  const windowStartIso = new Date(Date.parse(nowIso) - QUERY_WINDOW_MINUTES * 60_000).toISOString()

  const { data: taskRows, error: tasksError } = await supabase
    .from('tasks')
    .select(TASK_COLUMNS)
    .not('remind_at', 'is', null)
    .is('completed_at', null)
    .gte('remind_at', windowStartIso)
    .lte('remind_at', nowIso)
    .order('remind_at', { ascending: true })
    .limit(100)

  if (tasksError) return json({ error: tasksError.message }, 500)

  const { due, stale } = selectDueReminders((taskRows ?? []) as ReminderTask[], Date.parse(nowIso))

  // Просроченные сильнее окна доставки закрываем молча, чтобы не копить старые уведомления.
  for (const task of stale) {
    await markSent(supabase, task, nowIso)
  }

  if (due.length === 0) {
    return json({ checked: taskRows?.length ?? 0, sent: 0, failed: 0, removed: 0, skipped: stale.length })
  }

  const userIds = [...new Set(due.map((task) => task.user_id))]
  const { data: subscriptionRows, error: subscriptionsError } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', userIds)

  if (subscriptionsError) return json({ error: subscriptionsError.message }, 500)

  const subscriptionsByUser = groupSubscriptionsByUser((subscriptionRows ?? []) as PushSubscriptionRow[])

  const vapidKeys = await webpush.importVapidKeys(vapidJwkFromRaw(vapidPublic, vapidPrivate), { extractable: false })
  const appServer = await webpush.ApplicationServer.new({ contactInformation: vapidSubject, vapidKeys })

  let sent = 0
  let failed = 0
  let removed = 0

  for (const task of due) {
    // Сбой одной задачи не должен срывать остальные: каждая обрабатывается отдельно.
    try {
      const subscriptions = subscriptionsByUser.get(task.user_id) ?? []
      const payload = JSON.stringify(buildPushPayload(task))
      let delivered = 0
      let droppedForTask = 0

      for (const subscription of subscriptions) {
        try {
          const subscriber = appServer.subscribe({
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          })
          await subscriber.pushTextMessage(payload, {})
          delivered += 1
          sent += 1
        } catch (cause) {
          failed += 1
          const status = cause instanceof webpush.PushMessageError ? cause.response.status : 0
          console.error('push не доставлен', subscription.endpoint, status, cause)
          if (shouldDropSubscription(status)) {
            const { error: deleteError } = await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', subscription.endpoint)
            if (deleteError) console.error('не удалось удалить подписку', subscription.endpoint, deleteError.message)
            else {
              removed += 1
              droppedForTask += 1
            }
          }
        }
      }

      // Помечаем отправленным, если дошло хотя бы до одного устройства либо живых подписок
      // у пользователя не осталось. Временная ошибка доставки отметку не ставит — повторим позже.
      if (delivered > 0 || subscriptions.length === 0 || subscriptions.length === droppedForTask) {
        await markSent(supabase, task, nowIso)
      }
    } catch (cause) {
      failed += 1
      console.error('задача не обработана', task.id, cause)
    }
  }

  return json({ checked: taskRows?.length ?? 0, sent, failed, removed, skipped: stale.length })
})
