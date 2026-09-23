import { addDaysISO, isOverdue, nextDaysISO, toISODate } from './dates'
import { occurrencesInRange } from './recurrence'
import type { Task } from './types'

export interface TodayGroups {
  overdue: Task[]
  today: Task[]
  doneToday: Task[]
}

export interface DayTask {
  task: Task
  /** Вхождение повтора, а не сам срок задачи: отметить нельзя. */
  virtual: boolean
}

export interface DayBucket {
  date: string
  tasks: DayTask[]
}

export function isDoneToday(task: Task, todayIso: string): boolean {
  const stamp = task.completedAt ?? task.lastCompletedAt
  if (!stamp) return false
  const date = new Date(stamp)
  if (Number.isNaN(date.getTime())) return false
  return toISODate(date) === todayIso
}

function compareTasks(a: Task, b: Task): number {
  if (a.dueTime !== b.dueTime) {
    if (!a.dueTime) return 1
    if (!b.dueTime) return -1
    return a.dueTime < b.dueTime ? -1 : 1
  }
  if (a.priority !== b.priority) return b.priority - a.priority
  return a.title.localeCompare(b.title, 'ru')
}

export function groupToday(tasks: Task[], todayIso: string): TodayGroups {
  const doneToday = tasks.filter((task) => isDoneToday(task, todayIso))
  const doneIds = new Set(doneToday.map((task) => task.id))
  const active = tasks.filter((task) => !task.completedAt && !doneIds.has(task.id))

  return {
    overdue: active.filter((task) => isOverdue(task.dueDate, todayIso)).sort(compareTasks),
    today: active.filter((task) => task.dueDate === todayIso).sort(compareTasks),
    doneToday: [...doneToday].sort(compareTasks),
  }
}

/** Неделя вперёд, начиная с сегодняшнего дня: повторы развёрнуты по дням. */
export function buildWeek(tasks: Task[], todayIso: string, days = 7): DayBucket[] {
  const dates = nextDaysISO(todayIso, days)
  const lastDate = addDaysISO(todayIso, days - 1)
  const buckets = new Map<string, DayTask[]>(dates.map((date) => [date, []]))

  for (const task of tasks) {
    if (task.completedAt) continue
    for (const date of occurrencesInRange(task, todayIso, lastDate)) {
      const bucket = buckets.get(date)
      if (!bucket) continue
      bucket.push({ task, virtual: date !== task.dueDate })
    }
  }

  return dates.map((date) => ({
    date,
    tasks: (buckets.get(date) ?? []).sort((a, b) => compareTasks(a.task, b.task)),
  }))
}

export function activeTasks(tasks: Task[], todayIso: string): Task[] {
  return tasks.filter((task) => !task.completedAt && !isDoneToday(task, todayIso)).sort(compareTasks)
}
