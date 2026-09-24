import { addDaysISO, todayISO } from '../lib/dates'
import { requireSupabase } from '../lib/supabase'
import type { Checklist, ChecklistItem, Habit, HabitDraft, HabitEntry } from '../lib/types'

/** Отметки грузятся окном: истории за годы на экране нет. */
export const HABIT_WINDOW_DAYS = 180
const ENTRY_LIMIT = 2000
const ITEM_LIMIT = 500

interface HabitRow {
  id: string
  title: string
  note: string | null
  goal_type: Habit['goalType']
  goal_times: number
  goal_weekdays: number[] | null
  position: number
  archived_at: string | null
}

interface EntryRow {
  habit_id: string
  done_on: string
}

interface ChecklistRow {
  id: string
  title: string
  position: number
  started_at: string | null
  last_completed_at: string | null
  archived_at: string | null
}

interface ItemRow {
  id: string
  checklist_id: string
  text: string
  position: number
  checked_at: string | null
}

const HABIT_COLUMNS = 'id, title, note, goal_type, goal_times, goal_weekdays, position, archived_at'
const CHECKLIST_COLUMNS = 'id, title, position, started_at, last_completed_at, archived_at'
const ITEM_COLUMNS = 'id, checklist_id, text, position, checked_at'

function habitFromRow(row: HabitRow): Habit {
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    goalType: row.goal_type,
    goalTimes: row.goal_times,
    goalWeekdays: row.goal_weekdays ?? [],
    position: row.position,
    archivedAt: row.archived_at,
  }
}

function draftToRow(draft: HabitDraft): Record<string, unknown> {
  return {
    title: draft.title.trim(),
    note: draft.note,
    goal_type: draft.goalType,
    goal_times: draft.goalTimes,
    goal_weekdays: draft.goalType === 'weekdays' ? draft.goalWeekdays : [],
  }
}

export async function fetchHabits(): Promise<Habit[]> {
  const { data, error } = await requireSupabase()
    .from('habits')
    .select(HABIT_COLUMNS)
    .order('position', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as HabitRow[]).map(habitFromRow)
}

export async function fetchHabitEntries(): Promise<HabitEntry[]> {
  const since = addDaysISO(todayISO(), -HABIT_WINDOW_DAYS)
  const { data, error } = await requireSupabase()
    .from('habit_entries')
    .select('habit_id, done_on')
    .gte('done_on', since)
    .order('done_on', { ascending: false })
    .limit(ENTRY_LIMIT)
  if (error) throw new Error(error.message)
  return (data as EntryRow[]).map((row) => ({ habitId: row.habit_id, doneOn: row.done_on }))
}

export async function insertHabit(draft: HabitDraft, position: number): Promise<Habit> {
  const { data, error } = await requireSupabase()
    .from('habits')
    .insert({ ...draftToRow(draft), position })
    .select(HABIT_COLUMNS)
    .single()
  if (error) throw new Error(error.message)
  return habitFromRow(data as HabitRow)
}

export async function updateHabit(id: string, patch: Partial<HabitDraft> & { archivedAt?: string | null }): Promise<Habit> {
  const row: Record<string, unknown> = {}
  if ('title' in patch) row.title = patch.title?.trim()
  if ('note' in patch) row.note = patch.note
  if ('goalType' in patch) row.goal_type = patch.goalType
  if ('goalTimes' in patch) row.goal_times = patch.goalTimes
  if ('goalWeekdays' in patch) row.goal_weekdays = patch.goalWeekdays
  if ('archivedAt' in patch) row.archived_at = patch.archivedAt

  const { data, error } = await requireSupabase().from('habits').update(row).eq('id', id).select(HABIT_COLUMNS).single()
  if (error) throw new Error(error.message)
  return habitFromRow(data as HabitRow)
}

export async function deleteHabit(id: string): Promise<void> {
  const { error } = await requireSupabase().from('habits').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Повторная отметка того же дня не создаёт вторую строку: ключ (habit_id, done_on). */
export async function addEntry(habitId: string, doneOn: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('habit_entries')
    .upsert({ habit_id: habitId, done_on: doneOn }, { onConflict: 'habit_id,done_on', ignoreDuplicates: true })
  if (error) throw new Error(error.message)
}

export async function removeEntry(habitId: string, doneOn: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('habit_entries')
    .delete()
    .eq('habit_id', habitId)
    .eq('done_on', doneOn)
  if (error) throw new Error(error.message)
}

export async function fetchChecklists(): Promise<Checklist[]> {
  const { data, error } = await requireSupabase()
    .from('checklists')
    .select(CHECKLIST_COLUMNS)
    .order('position', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as ChecklistRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    position: row.position,
    startedAt: row.started_at,
    lastCompletedAt: row.last_completed_at,
    archivedAt: row.archived_at,
  }))
}

export async function fetchChecklistItems(): Promise<ChecklistItem[]> {
  const { data, error } = await requireSupabase()
    .from('checklist_items')
    .select(ITEM_COLUMNS)
    .order('position', { ascending: true })
    .limit(ITEM_LIMIT)
  if (error) throw new Error(error.message)
  return (data as ItemRow[]).map((row) => ({
    id: row.id,
    checklistId: row.checklist_id,
    text: row.text,
    position: row.position,
    checkedAt: row.checked_at,
  }))
}

export async function insertChecklist(title: string, position: number): Promise<Checklist> {
  const { data, error } = await requireSupabase()
    .from('checklists')
    .insert({ title: title.trim(), position })
    .select(CHECKLIST_COLUMNS)
    .single()
  if (error) throw new Error(error.message)
  const row = data as ChecklistRow
  return {
    id: row.id,
    title: row.title,
    position: row.position,
    startedAt: row.started_at,
    lastCompletedAt: row.last_completed_at,
    archivedAt: row.archived_at,
  }
}

export async function updateChecklist(
  id: string,
  patch: { title?: string; startedAt?: string | null; lastCompletedAt?: string | null; archivedAt?: string | null },
): Promise<void> {
  const row: Record<string, unknown> = {}
  if ('title' in patch) row.title = patch.title?.trim()
  if ('startedAt' in patch) row.started_at = patch.startedAt
  if ('lastCompletedAt' in patch) row.last_completed_at = patch.lastCompletedAt
  if ('archivedAt' in patch) row.archived_at = patch.archivedAt

  const { error } = await requireSupabase().from('checklists').update(row).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteChecklist(id: string): Promise<void> {
  const { error } = await requireSupabase().from('checklists').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function insertChecklistItem(checklistId: string, text: string, position: number): Promise<ChecklistItem> {
  const { data, error } = await requireSupabase()
    .from('checklist_items')
    .insert({ checklist_id: checklistId, text: text.trim(), position })
    .select(ITEM_COLUMNS)
    .single()
  if (error) throw new Error(error.message)
  const row = data as ItemRow
  return {
    id: row.id,
    checklistId: row.checklist_id,
    text: row.text,
    position: row.position,
    checkedAt: row.checked_at,
  }
}

export async function updateChecklistItem(id: string, patch: { text?: string; checkedAt?: string | null }): Promise<void> {
  const row: Record<string, unknown> = {}
  if ('text' in patch) row.text = patch.text?.trim()
  if ('checkedAt' in patch) row.checked_at = patch.checkedAt

  const { error } = await requireSupabase().from('checklist_items').update(row).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteChecklistItem(id: string): Promise<void> {
  const { error } = await requireSupabase().from('checklist_items').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Сброс отметок всего шаблона одним запросом. */
export async function resetChecklistItems(checklistId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('checklist_items')
    .update({ checked_at: null })
    .eq('checklist_id', checklistId)
    .not('checked_at', 'is', null)
  if (error) throw new Error(error.message)
}
