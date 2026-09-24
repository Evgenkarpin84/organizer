import { createContext, useContext } from 'react'
import type { Checklist, ChecklistItem, Habit, HabitDraft, HabitEntry } from '../lib/types'

export interface HabitsContextValue {
  habits: Habit[]
  entries: HabitEntry[]
  checklists: Checklist[]
  items: ChecklistItem[]
  loading: boolean
  error: string | null
  /** Ошибка действия живёт отдельно: список при ней не подменяется скелетоном. */
  actionError: string | null
  ensureLoaded: () => void
  reload: () => Promise<void>
  toggleEntry: (habitId: string, doneOn: string) => Promise<void>
  saveHabit: (draft: HabitDraft, id?: string) => Promise<void>
  setHabitArchived: (id: string, archived: boolean) => Promise<void>
  removeHabit: (id: string) => Promise<void>
  createChecklist: (title: string) => Promise<string | null>
  renameChecklist: (id: string, title: string) => Promise<void>
  removeChecklist: (id: string) => Promise<void>
  addChecklistItem: (checklistId: string, text: string) => Promise<void>
  renameChecklistItem: (id: string, text: string) => Promise<void>
  removeChecklistItem: (id: string) => Promise<void>
  toggleChecklistItem: (id: string) => Promise<void>
  finishChecklist: (id: string) => Promise<void>
  restartChecklist: (id: string) => Promise<void>
}

export const HabitsContext = createContext<HabitsContextValue | null>(null)

export function useHabitsContext(): HabitsContextValue {
  const value = useContext(HabitsContext)
  if (!value) throw new Error('useHabits вызван вне HabitsProvider')
  return value
}
