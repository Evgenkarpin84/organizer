import type { Task, TaskList } from '../lib/types'

let counter = 0

export function makeTask(overrides: Partial<Task> = {}): Task {
  counter += 1
  return {
    id: `task-${counter}`,
    listId: null,
    title: `Задача ${counter}`,
    note: null,
    dueDate: null,
    dueTime: null,
    remindAt: null,
    priority: 0,
    repeatType: 'none',
    repeatInterval: 1,
    repeatWeekdays: [],
    repeatDayOfMonth: null,
    completedAt: null,
    lastCompletedAt: null,
    createdAt: '2026-09-01T09:00:00.000Z',
    ...overrides,
  }
}

export function makeList(overrides: Partial<TaskList> = {}): TaskList {
  counter += 1
  return {
    id: `list-${counter}`,
    name: `Список ${counter}`,
    color: 'slate',
    position: 0,
    ...overrides,
  }
}

/** Локальная временная метка: тесты не должны зависеть от часового пояса машины. */
export function localStamp(year: number, month: number, day: number, hours = 10): string {
  return new Date(year, month - 1, day, hours).toISOString()
}
