import { addDaysISO, weekdayOf } from './dates'
import { LIST_COLOR_KEYS, WEEKDAY_LABELS } from './labels'
import type { Checklist, ChecklistItem, Habit, ListColor } from './types'

/** Дальше этого окна отметки на экран не грузятся и серия не считается. */
export const HABIT_WINDOW_DAYS = 180
export const WEEK_DAYS = 7

export interface HabitDay {
  iso: string
  weekdayLabel: string
  dayOfMonth: number
  done: boolean
  scheduled: boolean
  isToday: boolean
}

export interface HabitStreak {
  unit: 'day' | 'week'
  value: number
  atWindowEdge: boolean
}

export interface WeekProgress {
  done: number
  target: number
  percent: number
}

export interface ChecklistProgress {
  done: number
  total: number
  percent: number
  label: string
  complete: boolean
}

export function pluralRu(value: number, one: string, few: string, many: string): string {
  const last = Math.abs(value) % 10
  const tens = Math.abs(value) % 100
  if (tens >= 11 && tens <= 14) return many
  if (last === 1) return one
  if (last >= 2 && last <= 4) return few
  return many
}

export function habitColor(index: number): ListColor {
  return LIST_COLOR_KEYS[(index < 0 ? 0 : index) % LIST_COLOR_KEYS.length]
}

export function sortByPosition<T extends { position: number; title: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => (a.position === b.position ? a.title.localeCompare(b.title, 'ru') : a.position - b.position))
}

/** Запланирована ли привычка на этот день. Гибкая цель «N раз в неделю» — каждый день. */
export function isScheduledOn(habit: Habit, iso: string): boolean {
  if (habit.goalType === 'weekdays') return habit.goalWeekdays.includes(weekdayOf(iso))
  return true
}

export function describeGoal(habit: Habit): string {
  if (habit.goalType === 'daily') return 'каждый день'
  if (habit.goalType === 'times_per_week') {
    return `${habit.goalTimes} ${pluralRu(habit.goalTimes, 'раз', 'раза', 'раз')} в неделю`
  }
  if (habit.goalWeekdays.length === 0) return 'дни не выбраны'
  const names = [...habit.goalWeekdays].sort((a, b) => a - b).map((day) => WEEKDAY_LABELS[day - 1])
  return `по ${names.join(', ')}`
}

function toSet(doneDates: Iterable<string>): Set<string> {
  return doneDates instanceof Set ? doneDates : new Set(doneDates)
}

/** Последние семь дней, включая сегодня. Будущих дней в сетке нет. */
export function habitWeek(habit: Habit, doneDates: Iterable<string>, todayIso: string): HabitDay[] {
  const done = toSet(doneDates)
  return Array.from({ length: WEEK_DAYS }, (_, index) => {
    const iso = addDaysISO(todayIso, index - (WEEK_DAYS - 1))
    return {
      iso,
      weekdayLabel: WEEKDAY_LABELS[weekdayOf(iso) - 1],
      dayOfMonth: Number(iso.slice(8, 10)),
      done: done.has(iso),
      scheduled: isScheduledOn(habit, iso),
      isToday: iso === todayIso,
    }
  })
}

export function weekProgress(habit: Habit, doneDates: Iterable<string>, todayIso: string): WeekProgress {
  const week = habitWeek(habit, doneDates, todayIso)
  const done = week.filter((day) => day.done).length

  let target = WEEK_DAYS
  if (habit.goalType === 'weekdays') target = week.filter((day) => day.scheduled).length
  if (habit.goalType === 'times_per_week') target = habit.goalTimes

  if (target <= 0) return { done, target: 0, percent: 0 }
  return { done, target, percent: Math.min(100, Math.round((done / target) * 100)) }
}

function weekStartIso(iso: string): string {
  return addDaysISO(iso, -(weekdayOf(iso) - 1))
}

function countInWeek(done: Set<string>, startIso: string): number {
  let total = 0
  for (let index = 0; index < WEEK_DAYS; index += 1) {
    if (done.has(addDaysISO(startIso, index))) total += 1
  }
  return total
}

/**
 * Серия: дни подряд для «каждый день» и «по дням недели», календарные недели для «N раз в неделю».
 * Незакрытый сегодняшний день (и текущая неделя) серию не обнуляет.
 */
export function habitStreak(habit: Habit, doneDates: Iterable<string>, todayIso: string): HabitStreak {
  const done = toSet(doneDates)

  if (habit.goalType === 'times_per_week') {
    let cursor = weekStartIso(todayIso)
    if (countInWeek(done, cursor) < habit.goalTimes) cursor = addDaysISO(cursor, -WEEK_DAYS)

    let value = 0
    const limit = Math.floor(HABIT_WINDOW_DAYS / WEEK_DAYS)
    while (value < limit && countInWeek(done, cursor) >= habit.goalTimes) {
      value += 1
      cursor = addDaysISO(cursor, -WEEK_DAYS)
    }
    return { unit: 'week', value, atWindowEdge: value >= limit }
  }

  let cursor = todayIso
  if (isScheduledOn(habit, todayIso) && !done.has(todayIso)) cursor = addDaysISO(todayIso, -1)

  let value = 0
  let steps = 0
  while (steps < HABIT_WINDOW_DAYS) {
    if (isScheduledOn(habit, cursor)) {
      if (!done.has(cursor)) break
      value += 1
    }
    cursor = addDaysISO(cursor, -1)
    steps += 1
  }

  return { unit: 'day', value, atWindowEdge: steps >= HABIT_WINDOW_DAYS }
}

export function formatStreak(streak: HabitStreak): string {
  if (streak.value === 0) return 'нет серии'
  const word =
    streak.unit === 'day'
      ? pluralRu(streak.value, 'день', 'дня', 'дней')
      : pluralRu(streak.value, 'неделя', 'недели', 'недель')
  return `${streak.value}${streak.atWindowEdge ? '+' : ''} ${word} подряд`
}

export function checklistProgress(items: ChecklistItem[]): ChecklistProgress {
  const total = items.length
  const done = items.filter((item) => item.checkedAt !== null).length
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  return { done, total, percent, label: `${done} из ${total}`, complete: total > 0 && done === total }
}

/** Пункты, с которых надо снять отметку. Для чистого шаблона — пустой список. */
export function itemsToReset(items: ChecklistItem[]): string[] {
  return items.filter((item) => item.checkedAt !== null).map((item) => item.id)
}

export function checklistItemsOf(items: ChecklistItem[], checklistId: string): ChecklistItem[] {
  return items
    .filter((item) => item.checklistId === checklistId)
    .sort((a, b) => (a.position === b.position ? a.text.localeCompare(b.text, 'ru') : a.position - b.position))
}

export function activeHabits(habits: Habit[]): Habit[] {
  return sortByPosition(habits.filter((habit) => habit.archivedAt === null))
}

export function activeChecklists(checklists: Checklist[]): Checklist[] {
  return sortByPosition(checklists.filter((checklist) => checklist.archivedAt === null))
}
