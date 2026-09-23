import { describe, expect, it } from 'vitest'
import { makeTask } from '../test/factories'
import {
  computeRemindAt,
  describeReminderOffset,
  dueMoment,
  isPresetOffset,
  offsetFromRemindAt,
  recomputeRemindAt,
  urlBase64ToUint8Array,
} from './reminders'

function localIso(year: number, month: number, day: number, hours: number, minutes: number): string {
  return new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString()
}

describe('время напоминания', () => {
  it('берёт момент срока из даты и времени', () => {
    const moment = dueMoment('2026-09-25', '18:30')
    expect(moment?.getHours()).toBe(18)
    expect(moment?.getMinutes()).toBe(30)
  })

  it('для срока без времени берёт 09:00 местного времени', () => {
    const moment = dueMoment('2026-09-25', null)
    expect(moment?.getHours()).toBe(9)
    expect(moment?.getMinutes()).toBe(0)
  })

  it('считает напоминание для всех пресетов', () => {
    const due = { date: '2026-09-25', time: '18:00' }
    expect(computeRemindAt(due.date, due.time, 0)).toBe(localIso(2026, 9, 25, 18, 0))
    expect(computeRemindAt(due.date, due.time, 10)).toBe(localIso(2026, 9, 25, 17, 50))
    expect(computeRemindAt(due.date, due.time, 60)).toBe(localIso(2026, 9, 25, 17, 0))
    expect(computeRemindAt(due.date, due.time, 1440)).toBe(localIso(2026, 9, 24, 18, 0))
  })

  it('считает произвольное смещение, в том числе после срока', () => {
    expect(computeRemindAt('2026-09-25', '18:00', 90)).toBe(localIso(2026, 9, 25, 16, 30))
    expect(computeRemindAt('2026-09-25', '18:00', -15)).toBe(localIso(2026, 9, 25, 18, 15))
  })

  it('без срока и без смещения напоминания нет', () => {
    expect(computeRemindAt(null, null, 10)).toBeNull()
    expect(computeRemindAt('2026-09-25', '18:00', null)).toBeNull()
  })

  it('возвращает то же смещение обратно', () => {
    for (const offset of [0, 10, 60, 1440, 37, -25]) {
      const remindAt = computeRemindAt('2026-09-25', '18:00', offset)
      expect(offsetFromRemindAt('2026-09-25', '18:00', remindAt)).toBe(offset)
    }
  })

  it('пересчитывает напоминание при переносе срока повтора', () => {
    const task = makeTask({
      dueDate: '2026-09-25',
      dueTime: '18:00',
      repeatType: 'daily',
      remindAt: computeRemindAt('2026-09-25', '18:00', 60),
    })
    expect(recomputeRemindAt(task, '2026-09-26')).toBe(localIso(2026, 9, 26, 17, 0))
  })

  it('не включает напоминание у задачи, где его не было', () => {
    const task = makeTask({ dueDate: '2026-09-25', dueTime: '18:00', repeatType: 'daily' })
    expect(recomputeRemindAt(task, '2026-09-26')).toBeNull()
  })

  it('отличает пресет от произвольного смещения', () => {
    expect(isPresetOffset(60)).toBe(true)
    expect(isPresetOffset(37)).toBe(false)
    expect(isPresetOffset(null)).toBe(false)
  })

  it('описывает смещение по-русски', () => {
    expect(describeReminderOffset(0)).toBe('в момент срока')
    expect(describeReminderOffset(10)).toBe('за 10 минут')
    expect(describeReminderOffset(60)).toBe('за 1 час')
    expect(describeReminderOffset(1440)).toBe('за 1 день')
    expect(describeReminderOffset(2880)).toBe('за 2 дня')
    expect(describeReminderOffset(90)).toBe('за 1 ч 30 мин')
    expect(describeReminderOffset(-15)).toBe('через 15 минут после срока')
    expect(describeReminderOffset(null)).toBeNull()
  })

  it('разбирает ключ VAPID из base64url', () => {
    const bytes = urlBase64ToUint8Array('BApc-_8')
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(0)
  })
})
