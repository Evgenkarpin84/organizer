import { describe, expect, it } from 'vitest'
import {
  buildPushPayload,
  groupSubscriptionsByUser,
  selectDueReminders,
  sentPatch,
  shouldDropSubscription,
  vapidJwkFromRaw,
  type PushSubscriptionRow,
  type ReminderTask,
} from './reminders'

const NOW = Date.parse('2026-09-25T15:00:00.000Z')

function makeReminderTask(overrides: Partial<ReminderTask> = {}): ReminderTask {
  return {
    id: 'task-1',
    user_id: 'user-1',
    title: 'Позвонить в сервис',
    due_date: '2026-09-25',
    due_time: '18:00:00',
    remind_at: '2026-09-25T14:55:00.000Z',
    remind_sent_for: null,
    completed_at: null,
    ...overrides,
  }
}

describe('отбор напоминаний', () => {
  it('берёт задачи, у которых время напоминания наступило', () => {
    const selection = selectDueReminders([makeReminderTask()], NOW)
    expect(selection.due.map((task) => task.id)).toEqual(['task-1'])
    expect(selection.stale).toEqual([])
  })

  it('не берёт будущие, выполненные и уже отправленные', () => {
    const tasks = [
      makeReminderTask({ id: 'future', remind_at: '2026-09-25T15:30:00.000Z' }),
      makeReminderTask({ id: 'done', completed_at: '2026-09-25T10:00:00.000Z' }),
      makeReminderTask({ id: 'sent', remind_sent_for: '2026-09-25T14:55:00.000Z' }),
      makeReminderTask({ id: 'no-remind', remind_at: null }),
    ]
    expect(selectDueReminders(tasks, NOW).due).toEqual([])
  })

  it('берёт задачу заново, когда напоминание перенесено на новый срок', () => {
    const task = makeReminderTask({
      remind_at: '2026-09-25T14:59:00.000Z',
      remind_sent_for: '2026-09-24T14:55:00.000Z',
    })
    expect(selectDueReminders([task], NOW).due).toHaveLength(1)
  })

  it('просроченное сильнее окна доставки не отправляет, но помечает', () => {
    const task = makeReminderTask({ remind_at: '2026-09-25T14:30:00.000Z' })
    const selection = selectDueReminders([task], NOW)
    expect(selection.due).toEqual([])
    expect(selection.stale.map((item) => item.id)).toEqual(['task-1'])
  })

  it('сортирует по времени напоминания', () => {
    const tasks = [
      makeReminderTask({ id: 'позже', remind_at: '2026-09-25T14:59:00.000Z' }),
      makeReminderTask({ id: 'раньше', remind_at: '2026-09-25T14:50:00.000Z' }),
    ]
    expect(selectDueReminders(tasks, NOW).due.map((task) => task.id)).toEqual(['раньше', 'позже'])
  })
})

describe('вспомогательная логика рассылки', () => {
  it('удаляет подписку только на 404 и 410', () => {
    expect(shouldDropSubscription(404)).toBe(true)
    expect(shouldDropSubscription(410)).toBe(true)
    expect(shouldDropSubscription(429)).toBe(false)
    expect(shouldDropSubscription(500)).toBe(false)
    expect(shouldDropSubscription(201)).toBe(false)
  })

  it('собирает содержимое уведомления', () => {
    const payload = buildPushPayload(makeReminderTask())
    expect(payload).toMatchObject({
      taskId: 'task-1',
      title: 'Позвонить в сервис',
      tag: 'task-task-1',
      url: './#/task/task-1',
    })
    expect(payload.body).toContain('18:00')
  })

  it('пишет ключ защиты от повторной отправки', () => {
    const task = makeReminderTask()
    expect(sentPatch(task, '2026-09-25T15:00:00.000Z')).toEqual({
      remind_sent_at: '2026-09-25T15:00:00.000Z',
      remind_sent_for: task.remind_at,
    })
  })

  it('раскладывает подписки по пользователям', () => {
    const rows: PushSubscriptionRow[] = [
      { id: '1', user_id: 'a', endpoint: 'e1', p256dh: 'p', auth: 'a' },
      { id: '2', user_id: 'a', endpoint: 'e2', p256dh: 'p', auth: 'a' },
      { id: '3', user_id: 'b', endpoint: 'e3', p256dh: 'p', auth: 'a' },
    ]
    const grouped = groupSubscriptionsByUser(rows)
    expect(grouped.get('a')).toHaveLength(2)
    expect(grouped.get('b')).toHaveLength(1)
  })

  it('переводит ключи VAPID из base64url в JWK', () => {
    const publicRaw = new Uint8Array(65)
    publicRaw[0] = 4
    publicRaw.fill(7, 1, 33)
    publicRaw.fill(9, 33, 65)
    let binary = ''
    for (const byte of publicRaw) binary += String.fromCharCode(byte)
    const publicKey = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    const keys = vapidJwkFromRaw(publicKey, 'privatekeyvalue')
    expect(keys.publicKey).toMatchObject({ kty: 'EC', crv: 'P-256' })
    expect(keys.privateKey.d).toBe('privatekeyvalue')
    expect(keys.privateKey.x).toBe(keys.publicKey.x)
  })

  it('отвергает неправильный публичный ключ', () => {
    expect(() => vapidJwkFromRaw('AAAA', 'd')).toThrow(/65 байт/)
  })
})
