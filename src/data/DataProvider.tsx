import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { buildCompletionPatch } from '../lib/completion'
import { todayISO } from '../lib/dates'
import type { ListColor, Task, TaskDraft, TaskList } from '../lib/types'
import { DataContext, type DataContextValue } from './dataContext'
import * as repo from './tasksRepo'

export function DataProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [lists, setLists] = useState<TaskList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    setErrorDetails(null)
    try {
      const [nextLists, nextTasks] = await Promise.all([repo.fetchLists(), repo.fetchTasks()])
      setLists(nextLists)
      setTasks(nextTasks)
    } catch (cause) {
      console.error(cause)
      setError('Не удалось загрузить данные. Проверьте связь и попробуйте ещё раз.')
      setErrorDetails(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const value = useMemo<DataContextValue>(() => {
    const replaceTask = (task: Task) => {
      setTasks((prev) => prev.map((item) => (item.id === task.id ? task : item)))
    }

    return {
      tasks,
      lists,
      loading,
      error,
      errorDetails,
      dismissError: () => {
        setError(null)
        setErrorDetails(null)
      },
      reload,
      addTask: async (draft: TaskDraft) => {
        const created = await repo.insertTask(draft)
        setTasks((prev) => [...prev, created])
      },
      saveTask: async (id: string, draft: TaskDraft) => {
        replaceTask(await repo.saveTask(id, draft))
      },
      removeTask: async (id: string) => {
        await repo.deleteTask(id)
        setTasks((prev) => prev.filter((item) => item.id !== id))
      },
      toggleTask: async (task: Task) => {
        try {
          // Патч считает чистая функция: перенос срока повтора вместе с напоминанием и защита
          // от повторной отметки живут там же и покрыты тестами.
          const patch = buildCompletionPatch(task, todayISO(), new Date().toISOString())
          if (!patch) return
          replaceTask(await repo.updateTask(task.id, patch))
        } catch (cause) {
          console.error(cause)
          setError('Не удалось отметить задачу. Попробуйте ещё раз.')
          setErrorDetails(cause instanceof Error ? cause.message : String(cause))
        }
      },
      addList: async (name: string, color: ListColor) => {
        const created = await repo.insertList(name, color, lists.length)
        setLists((prev) => [...prev, created])
      },
      renameList: async (id: string, name: string) => {
        const updated = await repo.renameList(id, name)
        setLists((prev) => prev.map((item) => (item.id === id ? updated : item)))
      },
      removeList: async (id: string) => {
        await repo.deleteList(id)
        setLists((prev) => prev.filter((item) => item.id !== id))
        setTasks((prev) => prev.map((item) => (item.listId === id ? { ...item, listId: null } : item)))
      },
    }
  }, [tasks, lists, loading, error, errorDetails, reload])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
