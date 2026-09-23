import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { parseISODate } from './dates'
import type { Task } from './types'

/** Срок без времени считается назначенным на это время. */
export const DEFAULT_DUE_TIME = '09:00'

/** Ограничение на «своё время»: 30 суток в обе стороны. */
export const MAX_OFFSET_MINUTES = 30 * 24 * 60

export interface ReminderPreset {
  minutes: number
  label: string
}

export const REMINDER_PRESETS: ReminderPreset[] = [
  { minutes: 0, label: 'В момент срока' },
  { minutes: 10, label: 'За 10 минут' },
  { minutes: 60, label: 'За час' },
  { minutes: 1440, label: 'За день' },
]

const MINUTE = 60_000

/** Момент срока задачи в локальном поясе устройства. */
export function dueMoment(dueDate: string | null, dueTime: string | null): Date | null {
  if (!dueDate) return null
  const [hours, minutes] = (dueTime ?? DEFAULT_DUE_TIME).split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  const moment = parseISODate(dueDate)
  moment.setHours(hours, minutes, 0, 0)
  return moment
}

/** Момент напоминания: срок минус смещение. Без срока или без смещения — null. */
export function computeRemindAt(
  dueDate: string | null,
  dueTime: string | null,
  offsetMinutes: number | null,
): string | null {
  if (offsetMinutes === null) return null
  const moment = dueMoment(dueDate, dueTime)
  if (!moment) return null
  const clamped = Math.max(-MAX_OFFSET_MINUTES, Math.min(MAX_OFFSET_MINUTES, Math.round(offsetMinutes)))
  return new Date(moment.getTime() - clamped * MINUTE).toISOString()
}

/** Обратная операция: какое смещение стоит за сохранённым напоминанием. */
export function offsetFromRemindAt(
  dueDate: string | null,
  dueTime: string | null,
  remindAt: string | null,
): number | null {
  if (!remindAt) return null
  const moment = dueMoment(dueDate, dueTime)
  if (!moment) return null
  const remind = new Date(remindAt)
  if (Number.isNaN(remind.getTime())) return null
  return Math.round((moment.getTime() - remind.getTime()) / MINUTE)
}

/** Перенос срока повторяющейся задачи: то же смещение от новой даты. */
export function recomputeRemindAt(task: Task, nextDueDate: string | null): string | null {
  if (!task.remindAt) return null
  const offset = offsetFromRemindAt(task.dueDate, task.dueTime, task.remindAt)
  if (offset === null) return null
  return computeRemindAt(nextDueDate, task.dueTime, offset)
}

export function isPresetOffset(offsetMinutes: number | null): boolean {
  return offsetMinutes !== null && REMINDER_PRESETS.some((preset) => preset.minutes === offsetMinutes)
}

function pluralMinutes(value: number): string {
  const last = value % 10
  const tens = value % 100
  if (tens >= 11 && tens <= 14) return 'минут'
  if (last === 1) return 'минуту'
  if (last >= 2 && last <= 4) return 'минуты'
  return 'минут'
}

function pluralHours(value: number): string {
  const last = value % 10
  const tens = value % 100
  if (tens >= 11 && tens <= 14) return 'часов'
  if (last === 1) return 'час'
  if (last >= 2 && last <= 4) return 'часа'
  return 'часов'
}

function pluralDays(value: number): string {
  const last = value % 10
  const tens = value % 100
  if (tens >= 11 && tens <= 14) return 'дней'
  if (last === 1) return 'день'
  if (last >= 2 && last <= 4) return 'дня'
  return 'дней'
}

function describeDistance(minutes: number): string {
  if (minutes % 1440 === 0) {
    const days = minutes / 1440
    return `${days} ${pluralDays(days)}`
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60
    return `${hours} ${pluralHours(hours)}`
  }
  if (minutes > 60) {
    const hours = Math.floor(minutes / 60)
    return `${hours} ч ${minutes % 60} мин`
  }
  return `${minutes} ${pluralMinutes(minutes)}`
}

/** Человекочитаемое смещение: «за 10 минут», «в момент срока», «через 15 минут после срока». */
export function describeReminderOffset(offsetMinutes: number | null): string | null {
  if (offsetMinutes === null) return null
  if (offsetMinutes === 0) return 'в момент срока'
  if (offsetMinutes > 0) return `за ${describeDistance(offsetMinutes)}`
  return `через ${describeDistance(Math.abs(offsetMinutes))} после срока`
}

export interface ReminderChoice {
  key: string
  label: string
  kind: 'none' | 'preset' | 'custom'
  minutes: number | null
}

export const REMINDER_CHOICES: ReminderChoice[] = [
  { key: 'none', label: 'Нет', kind: 'none', minutes: null },
  { key: 'at-due', label: 'В момент срока', kind: 'preset', minutes: 0 },
  { key: 'm10', label: 'За 10 минут', kind: 'preset', minutes: 10 },
  { key: 'h1', label: 'За час', kind: 'preset', minutes: 60 },
  { key: 'd1', label: 'За день', kind: 'preset', minutes: 1440 },
  { key: 'custom', label: 'Своё время', kind: 'custom', minutes: null },
]

/** Короткая подпись для карточки задачи. */
export function shortReminderLabel(offsetMinutes: number | null): string | null {
  if (offsetMinutes === null) return null
  switch (offsetMinutes) {
    case 0:
      return 'в срок'
    case 10:
      return 'за 10 мин'
    case 60:
      return 'за час'
    case 1440:
      return 'за день'
    default:
      return 'своё время'
  }
}

/** «25 сентября в 17:00» — момент напоминания в местном времени. */
export function formatReminderMoment(remindAt: string | null): string | null {
  if (!remindAt) return null
  const moment = new Date(remindAt)
  if (Number.isNaN(moment.getTime())) return null
  return format(moment, "d MMMM 'в' HH:mm", { locale: ru })
}

/** Публичный ключ VAPID из base64url в формат, который принимает браузер. */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index)
  }
  return output
}
