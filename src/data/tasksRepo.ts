import { computeRemindAt } from '../lib/reminders'
import { requireSupabase } from '../lib/supabase'
import type { ListColor, Priority, RepeatType, Task, TaskDraft, TaskList } from '../lib/types'

interface TaskRow {
  id: string
  list_id: string | null
  title: string
  note: string | null
  due_date: string | null
  due_time: string | null
  remind_at: string | null
  priority: number
  repeat_type: RepeatType
  repeat_interval: number
  repeat_weekdays: number[] | null
  repeat_day_of_month: number | null
  completed_at: string | null
  last_completed_at: string | null
  created_at: string
}

interface ListRow {
  id: string
  name: string
  color: ListColor
  position: number
}

export interface TaskPatch {
  title?: string
  note?: string | null
  listId?: string | null
  dueDate?: string | null
  dueTime?: string | null
  remindAt?: string | null
  priority?: Priority
  repeatType?: RepeatType
  repeatInterval?: number
  repeatWeekdays?: number[]
  repeatDayOfMonth?: number | null
  completedAt?: string | null
  lastCompletedAt?: string | null
}

const TASK_COLUMNS =
  'id, list_id, title, note, due_date, due_time, remind_at, priority, repeat_type, repeat_interval, repeat_weekdays, repeat_day_of_month, completed_at, last_completed_at, created_at'

export function taskFromRow(row: TaskRow): Task {
  return {
    id: row.id,
    listId: row.list_id,
    title: row.title,
    note: row.note,
    dueDate: row.due_date,
    dueTime: row.due_time ? row.due_time.slice(0, 5) : null,
    remindAt: row.remind_at,
    priority: (row.priority ?? 0) as Priority,
    repeatType: row.repeat_type,
    repeatInterval: row.repeat_interval ?? 1,
    repeatWeekdays: row.repeat_weekdays ?? [],
    repeatDayOfMonth: row.repeat_day_of_month,
    completedAt: row.completed_at,
    lastCompletedAt: row.last_completed_at,
    createdAt: row.created_at,
  }
}

function listFromRow(row: ListRow): TaskList {
  return { id: row.id, name: row.name, color: row.color, position: row.position }
}

function patchToRow(patch: TaskPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if ('title' in patch) row.title = patch.title
  if ('note' in patch) row.note = patch.note
  if ('listId' in patch) row.list_id = patch.listId
  if ('dueDate' in patch) row.due_date = patch.dueDate
  if ('dueTime' in patch) row.due_time = patch.dueTime
  if ('remindAt' in patch) row.remind_at = patch.remindAt
  if ('priority' in patch) row.priority = patch.priority
  if ('repeatType' in patch) row.repeat_type = patch.repeatType
  if ('repeatInterval' in patch) row.repeat_interval = patch.repeatInterval
  if ('repeatWeekdays' in patch) row.repeat_weekdays = patch.repeatWeekdays
  if ('repeatDayOfMonth' in patch) row.repeat_day_of_month = patch.repeatDayOfMonth
  if ('completedAt' in patch) row.completed_at = patch.completedAt
  if ('lastCompletedAt' in patch) row.last_completed_at = patch.lastCompletedAt
  return row
}

function draftToPatch(draft: TaskDraft): TaskPatch {
  return {
    title: draft.title.trim(),
    note: draft.note,
    listId: draft.listId,
    dueDate: draft.dueDate,
    dueTime: draft.dueTime,
    priority: draft.priority,
    repeatType: draft.repeatType,
    repeatInterval: draft.repeatInterval,
    repeatWeekdays: draft.repeatWeekdays,
    repeatDayOfMonth: draft.repeatDayOfMonth,
    // Момент напоминания считается из срока и смещения: отдельной колонки под смещение нет.
    remindAt: computeRemindAt(draft.dueDate, draft.dueTime, draft.remindOffsetMinutes),
  }
}

/** Выполненные задачи старше недели не загружаем: экран «Сегодня» их не показывает. */
function completedSince(): string {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  return weekAgo.toISOString()
}

export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await requireSupabase()
    .from('tasks')
    .select(TASK_COLUMNS)
    .or(`completed_at.is.null,completed_at.gte.${completedSince()}`)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('due_time', { ascending: true, nullsFirst: false })
  if (error) throw new Error(error.message)
  return (data as TaskRow[]).map(taskFromRow)
}

export async function insertTask(draft: TaskDraft): Promise<Task> {
  const { data, error } = await requireSupabase()
    .from('tasks')
    .insert(patchToRow(draftToPatch(draft)))
    .select(TASK_COLUMNS)
    .single()
  if (error) throw new Error(error.message)
  return taskFromRow(data as TaskRow)
}

export async function updateTask(id: string, patch: TaskPatch): Promise<Task> {
  const { data, error } = await requireSupabase()
    .from('tasks')
    .update(patchToRow(patch))
    .eq('id', id)
    .select(TASK_COLUMNS)
    .single()
  if (error) throw new Error(error.message)
  return taskFromRow(data as TaskRow)
}

export async function saveTask(id: string, draft: TaskDraft): Promise<Task> {
  return updateTask(id, draftToPatch(draft))
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await requireSupabase().from('tasks').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function fetchLists(): Promise<TaskList[]> {
  const { data, error } = await requireSupabase()
    .from('lists')
    .select('id, name, color, position')
    .order('position', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as ListRow[]).map(listFromRow)
}

export async function insertList(name: string, color: ListColor, position: number): Promise<TaskList> {
  const { data, error } = await requireSupabase()
    .from('lists')
    .insert({ name: name.trim(), color, position })
    .select('id, name, color, position')
    .single()
  if (error) throw new Error(error.message)
  return listFromRow(data as ListRow)
}

export async function renameList(id: string, name: string): Promise<TaskList> {
  const { data, error } = await requireSupabase()
    .from('lists')
    .update({ name: name.trim() })
    .eq('id', id)
    .select('id, name, color, position')
    .single()
  if (error) throw new Error(error.message)
  return listFromRow(data as ListRow)
}

export async function deleteList(id: string): Promise<void> {
  const { error } = await requireSupabase().from('lists').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
