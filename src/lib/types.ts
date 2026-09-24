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

export interface MailAccount {
  id: string
  key: string
  label: string
  email: string
  provider: 'mailru' | 'yandex'
  lastSyncAt: string | null
  lastError: string | null
}

export interface MailMessage {
  id: string
  accountId: string
  subject: string | null
  fromName: string | null
  fromEmail: string | null
  sentAt: string | null
  receivedAt: string
  preview: string | null
  bodyText: string | null
  bodyTruncated: boolean
  hasAttachments: boolean
  attachmentNames: string[]
  isBulk: boolean
  readAt: string | null
  archivedAt: string | null
}

export type HabitGoalType = 'daily' | 'times_per_week' | 'weekdays'

export interface Habit {
  id: string
  title: string
  note: string | null
  goalType: HabitGoalType
  goalTimes: number
  goalWeekdays: number[]
  position: number
  archivedAt: string | null
}

/** Отметки приходят плоским списком за окно HABIT_WINDOW_DAYS. */
export interface HabitEntry {
  habitId: string
  doneOn: string
}

export interface HabitDraft {
  title: string
  note: string | null
  goalType: HabitGoalType
  goalTimes: number
  goalWeekdays: number[]
}

export function emptyHabitDraft(): HabitDraft {
  return { title: '', note: null, goalType: 'daily', goalTimes: 3, goalWeekdays: [] }
}

export interface Checklist {
  id: string
  title: string
  position: number
  startedAt: string | null
  lastCompletedAt: string | null
  archivedAt: string | null
}

export interface ChecklistItem {
  id: string
  checklistId: string
  text: string
  position: number
  checkedAt: string | null
}

export interface NewsSource {
  id: string
  key: string
  topic: string
  title: string
  enabled: boolean
  lastFetchAt: string | null
  lastStatus: 'ok' | 'error' | null
  lastError: string | null
}

export interface NewsItem {
  id: string
  sourceId: string
  topic: string
  title: string
  url: string
  summary: string | null
  publishedAt: string
  readAt: string | null
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
  /** Смещение напоминания в минутах до срока; null — напоминания нет. */
  remindOffsetMinutes: number | null
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
    remindOffsetMinutes: null,
  }
}
