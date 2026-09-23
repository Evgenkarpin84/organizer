import { createContext, useContext } from 'react'
import type { ListColor, Task, TaskDraft, TaskList } from '../lib/types'

export interface DataContextValue {
  tasks: Task[]
  lists: TaskList[]
  loading: boolean
  error: string | null
  /** Техническая причина — показывается мелким текстом под сообщением. */
  errorDetails: string | null
  dismissError: () => void
  reload: () => Promise<void>
  addTask: (draft: TaskDraft) => Promise<void>
  saveTask: (id: string, draft: TaskDraft) => Promise<void>
  removeTask: (id: string) => Promise<void>
  toggleTask: (task: Task) => Promise<void>
  addList: (name: string, color: ListColor) => Promise<void>
  renameList: (id: string, name: string) => Promise<void>
  removeList: (id: string) => Promise<void>
}

export const DataContext = createContext<DataContextValue | null>(null)

export function useData(): DataContextValue {
  const value = useContext(DataContext)
  if (!value) throw new Error('useData вызван вне DataProvider')
  return value
}
