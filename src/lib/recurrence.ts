import { addDaysISO, diffDaysISO, parseISODate, toISODate, weekdayOf } from './dates'
import type { RepeatRule, Task } from './types'

const WEEKDAY_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']
const MAX_OCCURRENCES = 400

function clampDayOfMonth(year: number, monthIndex: number, day: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  return new Date(year, monthIndex, Math.min(day, lastDay))
}

function laterOf(a: string, b: string): string {
  return a > b ? a : b
}

/**
 * Ближайшее вхождение правила: строго позже afterIso и не раньше anchorIso.
 * anchorIso — дата, от которой отсчитывается правило (текущий срок задачи).
 */
export function nextOccurrence(rule: RepeatRule, anchorIso: string, afterIso: string): string | null {
  switch (rule.repeatType) {
    case 'none':
      return null
    case 'daily': {
      const step = Math.max(1, Math.trunc(rule.repeatInterval) || 1)
      if (anchorIso > afterIso) return anchorIso
      const steps = Math.floor(diffDaysISO(anchorIso, afterIso) / step) + 1
      return addDaysISO(anchorIso, steps * step)
    }
    case 'weekly': {
      const weekdays = rule.repeatWeekdays.length > 0 ? rule.repeatWeekdays : [weekdayOf(anchorIso)]
      const allowed = new Set(weekdays)
      let cursor = laterOf(addDaysISO(afterIso, 1), anchorIso)
      for (let step = 0; step < 8; step += 1) {
        if (allowed.has(weekdayOf(cursor))) return cursor
        cursor = addDaysISO(cursor, 1)
      }
      return null
    }
    case 'monthly': {
      const day = rule.repeatDayOfMonth ?? parseISODate(anchorIso).getDate()
      const startIso = laterOf(addDaysISO(afterIso, 1), anchorIso)
      const start = parseISODate(startIso)
      let candidate = clampDayOfMonth(start.getFullYear(), start.getMonth(), day)
      let guard = 0
      while (toISODate(candidate) < startIso && guard < 24) {
        candidate = clampDayOfMonth(candidate.getFullYear(), candidate.getMonth() + 1, day)
        guard += 1
      }
      return toISODate(candidate)
    }
  }
}

/**
 * Новый срок повторяющейся задачи после отметки выполнения.
 * Всегда строго позже сегодняшнего дня и позже текущего срока.
 */
export function nextDueDateAfterCompletion(task: Task, todayIso: string): string | null {
  if (task.repeatType === 'none') return null
  const anchor = task.dueDate ?? todayIso
  const after = laterOf(todayIso, anchor === todayIso ? todayIso : anchor > todayIso ? anchor : todayIso)
  return nextOccurrence(task, anchor, after)
}

/** Все вхождения задачи в интервале дат включительно: реальные и виртуальные. */
export function occurrencesInRange(task: Task, fromIso: string, toIso: string): string[] {
  if (!task.dueDate || fromIso > toIso) return []
  if (task.repeatType === 'none') {
    return task.dueDate >= fromIso && task.dueDate <= toIso ? [task.dueDate] : []
  }

  const dates: string[] = []
  if (task.dueDate >= fromIso && task.dueDate <= toIso) dates.push(task.dueDate)

  let cursor = task.dueDate > fromIso ? task.dueDate : addDaysISO(fromIso, -1)
  for (let step = 0; step < MAX_OCCURRENCES; step += 1) {
    const next = nextOccurrence(task, task.dueDate, cursor)
    if (!next || next > toIso) break
    if (next >= fromIso) dates.push(next)
    cursor = next
  }

  return [...new Set(dates)].sort()
}

export function describeRepeat(rule: RepeatRule): string | null {
  switch (rule.repeatType) {
    case 'none':
      return null
    case 'daily':
      return rule.repeatInterval > 1 ? `каждые ${rule.repeatInterval} дн.` : 'каждый день'
    case 'weekly': {
      if (rule.repeatWeekdays.length === 0) return 'каждую неделю'
      const names = [...rule.repeatWeekdays]
        .sort((a, b) => a - b)
        .map((day) => WEEKDAY_SHORT[day - 1])
        .join(', ')
      return `по ${names}`
    }
    case 'monthly':
      return rule.repeatDayOfMonth ? `${rule.repeatDayOfMonth} числа` : 'каждый месяц'
  }
}
