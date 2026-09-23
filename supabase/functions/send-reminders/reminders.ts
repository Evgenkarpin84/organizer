// Чистая логика рассылки напоминаний: без Deno-API и без сети, чтобы её гонял обычный Vitest.

export interface ReminderTask {
  id: string
  user_id: string
  title: string
  due_date: string | null
  due_time: string | null
  remind_at: string | null
  remind_sent_for: string | null
  completed_at: string | null
}

export interface PushSubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushPayload {
  taskId: string
  title: string
  body: string
  tag: string
  url: string
}

/** Напоминание, опоздавшее больше чем на это время, не отправляется. */
export const DELIVERY_WINDOW_MINUTES = 15

export interface DueSelection {
  /** Отправить сейчас. */
  due: ReminderTask[]
  /** Просрочено сильнее окна доставки: пометить отправленным и промолчать. */
  stale: ReminderTask[]
}

export function selectDueReminders(
  tasks: ReminderTask[],
  nowMs: number,
  windowMinutes: number = DELIVERY_WINDOW_MINUTES,
): DueSelection {
  const due: ReminderTask[] = []
  const stale: ReminderTask[] = []

  for (const task of tasks) {
    if (!task.remind_at || task.completed_at) continue
    if (task.remind_sent_for === task.remind_at) continue

    const remindMs = Date.parse(task.remind_at)
    if (Number.isNaN(remindMs) || remindMs > nowMs) continue

    if (nowMs - remindMs > windowMinutes * 60_000) stale.push(task)
    else due.push(task)
  }

  const byRemindAt = (a: ReminderTask, b: ReminderTask) => Date.parse(a.remind_at!) - Date.parse(b.remind_at!)
  return { due: due.sort(byRemindAt), stale: stale.sort(byRemindAt) }
}

/** Подписку удаляем только когда её больше нет на стороне пуш-сервиса. */
export function shouldDropSubscription(status: number): boolean {
  return status === 404 || status === 410
}

export function buildPushPayload(task: ReminderTask): PushPayload {
  return {
    taskId: task.id,
    title: task.title,
    body: task.due_time ? `Напоминание о задаче · срок в ${task.due_time.slice(0, 5)}` : 'Напоминание о задаче',
    tag: `task-${task.id}`,
    url: `./#/task/${task.id}`,
  }
}

export function sentPatch(task: ReminderTask, nowIso: string): { remind_sent_at: string; remind_sent_for: string } {
  return { remind_sent_at: nowIso, remind_sent_for: task.remind_at as string }
}

export function groupSubscriptionsByUser(rows: PushSubscriptionRow[]): Map<string, PushSubscriptionRow[]> {
  const grouped = new Map<string, PushSubscriptionRow[]>()
  for (const row of rows) {
    const list = grouped.get(row.user_id)
    if (list) list.push(row)
    else grouped.set(row.user_id, [row])
  }
  return grouped
}

function base64UrlToBytes(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index)
  return bytes
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Ключи VAPID хранятся в секретах в формате base64url (как их ждёт браузер),
 * а библиотека подписи работает с JWK — здесь перевод между ними.
 */
export function vapidJwkFromRaw(
  publicKeyBase64Url: string,
  privateKeyBase64Url: string,
): { publicKey: JsonWebKey; privateKey: JsonWebKey } {
  const raw = base64UrlToBytes(publicKeyBase64Url)
  if (raw.length !== 65 || raw[0] !== 4) {
    throw new Error('Публичный ключ VAPID должен быть несжатой точкой P-256 длиной 65 байт')
  }
  const x = bytesToBase64Url(raw.slice(1, 33))
  const y = bytesToBase64Url(raw.slice(33, 65))

  return {
    publicKey: { kty: 'EC', crv: 'P-256', x, y, ext: true, key_ops: ['verify'] },
    privateKey: { kty: 'EC', crv: 'P-256', x, y, d: privateKeyBase64Url, ext: true, key_ops: ['sign'] },
  }
}
