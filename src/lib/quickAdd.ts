import { addDaysISO, formatDueLabel, parseISODate, toISODate, weekdayOf } from './dates'
import { PRIORITY_LABELS } from './labels'
import { describeRepeat } from './recurrence'
import type { Priority, RepeatType, TaskList } from './types'

export interface QuickAddResult {
  title: string
  dueDate: string | null
  dueTime: string | null
  priority: Priority
  listId: string | null
  repeatType: RepeatType
  repeatInterval: number
  repeatWeekdays: number[]
  repeatDayOfMonth: number | null
  /** Человекочитаемые подсказки для предпросмотра перед сохранением. */
  hints: string[]
}

interface ParseState {
  dueDate: string | null
  dueTime: string | null
  priority: Priority
  listId: string | null
  repeatType: RepeatType
  repeatInterval: number
  repeatWeekdays: number[]
  repeatDayOfMonth: number | null
}

const WEEKDAY_BY_NAME: Record<string, number> = {
  понедельник: 1,
  вторник: 2,
  среда: 3,
  среду: 3,
  четверг: 4,
  пятница: 5,
  пятницу: 5,
  суббота: 6,
  субботу: 6,
  воскресенье: 7,
  пн: 1,
  вт: 2,
  ср: 3,
  чт: 4,
  пт: 5,
  сб: 6,
  вс: 7,
}

const WEEKDAY_PATTERN = 'понедельник|вторник|среду|среда|четверг|пятницу|пятница|субботу|суббота|воскресенье'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function nextWeekday(todayIso: string, weekday: number, includeToday: boolean): string {
  let cursor = includeToday ? todayIso : addDaysISO(todayIso, 1)
  for (let step = 0; step < 7; step += 1) {
    if (weekdayOf(cursor) === weekday) return cursor
    cursor = addDaysISO(cursor, 1)
  }
  return cursor
}

/**
 * Разбор строки быстрого ввода на русском.
 * Возвращает поля задачи и название без распознанных фрагментов.
 */
export function parseQuickAdd(input: string, lists: TaskList[], todayIso: string): QuickAddResult {
  let rest = ` ${input.replace(/\s+/g, ' ').trim()} `
  const state: ParseState = {
    dueDate: null,
    dueTime: null,
    priority: 0,
    listId: null,
    repeatType: 'none',
    repeatInterval: 1,
    repeatWeekdays: [],
    repeatDayOfMonth: null,
  }

  const take = (pattern: RegExp, handle: (match: RegExpMatchArray) => boolean): void => {
    const match = rest.match(pattern)
    if (!match || match.index === undefined) return
    if (!handle(match)) return
    rest = `${rest.slice(0, match.index)} ${rest.slice(match.index + match[0].length)}`
  }

  take(/(?<=\s)кажд(?:ый|ые)\s+(?:(\d{1,2})\s+)?(?:день|дня|дней)(?=\s)/iu, (match) => {
    state.repeatType = 'daily'
    state.repeatInterval = match[1] ? Math.min(31, Math.max(1, Number(match[1]))) : 1
    return true
  })
  take(new RegExp(`(?<=\\s)кажд(?:ый|ую)\\s+(${WEEKDAY_PATTERN})(?=\\s)`, 'iu'), (match) => {
    if (state.repeatType !== 'none') return false
    state.repeatType = 'weekly'
    state.repeatWeekdays = [WEEKDAY_BY_NAME[match[1].toLowerCase()]]
    return true
  })
  take(/(?<=\s)кажд(?:ую|ые)\s+недел(?:ю|и)(?=\s)/iu, () => {
    if (state.repeatType !== 'none') return false
    state.repeatType = 'weekly'
    return true
  })
  take(/(?<=\s)кажд(?:ый|ые)\s+месяц(?:а)?(?=\s)/iu, () => {
    if (state.repeatType !== 'none') return false
    state.repeatType = 'monthly'
    return true
  })

  take(/(?<=\s)(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?(?=\s)/u, (match) => {
    const day = Number(match[1])
    const month = Number(match[2])
    if (day < 1 || day > 31 || month < 1 || month > 12) return false
    let year = match[3] ? Number(match[3]) : Number(todayIso.slice(0, 4))
    if (match[3] && year < 100) year += 2000
    const candidate = new Date(year, month - 1, day)
    if (candidate.getDate() !== day || candidate.getMonth() !== month - 1) return false
    const iso = toISODate(candidate)
    state.dueDate = !match[3] && iso < todayIso ? toISODate(new Date(year + 1, month - 1, day)) : iso
    return true
  })
  take(/(?<=\s)послезавтра(?=\s)/iu, () => {
    if (state.dueDate) return false
    state.dueDate = addDaysISO(todayIso, 2)
    return true
  })
  take(/(?<=\s)завтра(?=\s)/iu, () => {
    if (state.dueDate) return false
    state.dueDate = addDaysISO(todayIso, 1)
    return true
  })
  take(/(?<=\s)сегодня(?=\s)/iu, () => {
    if (state.dueDate) return false
    state.dueDate = todayIso
    return true
  })
  take(/(?<=\s)через\s+недел(?:ю|и)(?=\s)/iu, () => {
    if (state.dueDate) return false
    state.dueDate = addDaysISO(todayIso, 7)
    return true
  })
  take(/(?<=\s)через\s+(\d{1,3})\s+(?:день|дня|дней)(?=\s)/iu, (match) => {
    if (state.dueDate) return false
    state.dueDate = addDaysISO(todayIso, Number(match[1]))
    return true
  })
  take(new RegExp(`(?<=\\s)(?:в|во)\\s+(${WEEKDAY_PATTERN})(?=\\s)`, 'iu'), (match) => {
    if (state.dueDate) return false
    state.dueDate = nextWeekday(todayIso, WEEKDAY_BY_NAME[match[1].toLowerCase()], false)
    return true
  })
  take(/(?<=\s)(пн|вт|ср|чт|пт|сб|вс)(?=\s)/iu, (match) => {
    if (state.dueDate) return false
    state.dueDate = nextWeekday(todayIso, WEEKDAY_BY_NAME[match[1].toLowerCase()], false)
    return true
  })

  take(/(?<=\s)(?:в|во)\s+(\d{1,2})(?::(\d{2}))?(?=\s)/iu, (match) => {
    const hours = Number(match[1])
    const minutes = match[2] ? Number(match[2]) : 0
    if (hours > 23 || minutes > 59) return false
    state.dueTime = `${pad(hours)}:${pad(minutes)}`
    return true
  })
  take(/(?<=\s)(\d{1,2}):(\d{2})(?=\s)/u, (match) => {
    if (state.dueTime) return false
    const hours = Number(match[1])
    const minutes = Number(match[2])
    if (hours > 23 || minutes > 59) return false
    state.dueTime = `${pad(hours)}:${pad(minutes)}`
    return true
  })

  take(/(?<=\s)!([1-3])(?=\s)/u, (match) => {
    state.priority = Number(match[1]) as Priority
    return true
  })
  take(/(?<=\s)#(\S+)(?=\s)/u, (match) => {
    const name = match[1].toLowerCase()
    const list = lists.find((item) => item.name.toLowerCase() === name)
    if (!list) return false
    state.listId = list.id
    return true
  })

  if (state.repeatType !== 'none' && !state.dueDate) {
    state.dueDate =
      state.repeatType === 'weekly' && state.repeatWeekdays.length > 0
        ? nextWeekday(todayIso, state.repeatWeekdays[0], true)
        : todayIso
  }
  if (state.repeatType === 'weekly' && state.repeatWeekdays.length === 0 && state.dueDate) {
    state.repeatWeekdays = [weekdayOf(state.dueDate)]
  }
  if (state.repeatType === 'monthly') {
    state.repeatDayOfMonth = parseISODate(state.dueDate ?? todayIso).getDate()
  }

  const hints: string[] = []
  const repeatHint = describeRepeat(state)
  if (repeatHint) hints.push(repeatHint)
  const dueHint = formatDueLabel(state.dueDate, state.dueTime, todayIso)
  if (dueHint) hints.push(dueHint)
  if (state.priority > 0) hints.push(`приоритет: ${PRIORITY_LABELS[state.priority].toLowerCase()}`)
  if (state.listId) {
    const list = lists.find((item) => item.id === state.listId)
    if (list) hints.push(`список: ${list.name}`)
  }

  return {
    title: rest.replace(/\s+/g, ' ').trim(),
    ...state,
    hints,
  }
}
