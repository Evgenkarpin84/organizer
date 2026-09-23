export type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly'

export type Priority = 0 | 1 | 2 | 3

export type ListColor = 'slate' | 'blue' | 'green' | 'amber' | 'rose' | 'violet'

export interface TaskList {
  id: string
  name: string
  color: ListColor
  position: number
}

/** Правило повтора — отдельный тип, чтобы чистые функции не зависели от всей задачи. */
export interface RepeatRule {
  repeatType: RepeatType
  repeatInterval: number
  repeatWeekdays: number[]
  repeatDayOfMonth: number | null
}

export interface Task extends RepeatRule {
  id: string
  listId: string | null
  title: string
  note: string | null
  /** Срок, дата в формате YYYY-MM-DD в локальном часовом поясе. */
  dueDate: string | null
  /** Время срока, HH:MM. */
  dueTime: string | null
  /** Момент напоминания, заполняется на этапе 2. */
  remindAt: string | null
  priority: Priority
  completedAt: string | null
  lastCompletedAt: string | null
  createdAt: string
}

export interface TaskDraft {
  title: string
  note: string | null
  listId: string | null
  dueDate: string | null
  dueTime: string | null
  priority: Priority
  repeatType: RepeatType
  repeatInterval: number
  repeatWeekdays: number[]
  repeatDayOfMonth: number | null
}

export function emptyDraft(): TaskDraft {
  return {
    title: '',
    note: null,
    listId: null,
    dueDate: null,
    dueTime: null,
    priority: 0,
    repeatType: 'none',
    repeatInterval: 1,
    repeatWeekdays: [],
    repeatDayOfMonth: null,
  }
}
