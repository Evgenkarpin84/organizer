import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

const MS_IN_DAY = 86_400_000

export function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Полночь по местному времени — чтобы дата не съезжала из-за часового пояса. */
export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function todayISO(now: Date = new Date()): string {
  return toISODate(now)
}

export function addDaysISO(iso: string, days: number): string {
  const date = parseISODate(iso)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

export function diffDaysISO(fromIso: string, toIso: string): number {
  const diff = parseISODate(toIso).getTime() - parseISODate(fromIso).getTime()
  return Math.round(diff / MS_IN_DAY)
}

/** 1 — понедельник, 7 — воскресенье. */
export function weekdayOf(iso: string): number {
  const day = parseISODate(iso).getDay()
  return day === 0 ? 7 : day
}

export function isOverdue(dueDate: string | null, todayIso: string): boolean {
  return dueDate !== null && dueDate < todayIso
}

export function nextDaysISO(todayIso: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDaysISO(todayIso, index))
}

export function capitalize(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1)
}

/** «Сегодня, 16 сентября» / «Завтра, 17 сентября» / «Пт, 18 сентября». */
export function formatDayTitle(iso: string, todayIso: string): string {
  const date = parseISODate(iso)
  const dayAndMonth = format(date, 'd MMMM', { locale: ru })
  if (iso === todayIso) return `Сегодня, ${dayAndMonth}`
  if (iso === addDaysISO(todayIso, 1)) return `Завтра, ${dayAndMonth}`
  return `${capitalize(format(date, 'EEEEEE', { locale: ru }))}, ${dayAndMonth}`
}

export function formatTime(time: string | null): string | null {
  if (!time) return null
  return time.slice(0, 5)
}

/** Подпись срока в карточке задачи: «Сегодня, 18:30», «Вчера», «18 сент.». */
export function formatDueLabel(dueDate: string | null, dueTime: string | null, todayIso: string): string | null {
  if (!dueDate) return null
  let base: string
  if (dueDate === todayIso) base = 'Сегодня'
  else if (dueDate === addDaysISO(todayIso, 1)) base = 'Завтра'
  else if (dueDate === addDaysISO(todayIso, -1)) base = 'Вчера'
  else {
    const sameYear = dueDate.slice(0, 4) === todayIso.slice(0, 4)
    base = format(parseISODate(dueDate), sameYear ? 'd MMM' : 'd MMM yyyy', { locale: ru })
  }
  const time = formatTime(dueTime)
  return time ? `${base}, ${time}` : base
}
