import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Checklist, ChecklistItem, Habit, HabitDraft, HabitEntry } from '../lib/types'
import { HabitsContext, type HabitsContextValue } from './habitsContext'
import * as repo from './habitsRepo'

export function HabitsProvider({ children }: { children: ReactNode }) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [entries, setEntries] = useState<HabitEntry[]>([])
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const started = useRef(false)
  // Зеркало состояния: откат оптимистичной отметки берёт данные отсюда, а не из апдейтера.
  const mirror = useRef<{ entries: HabitEntry[]; items: ChecklistItem[]; checklists: Checklist[] }>({
    entries: [],
    items: [],
    checklists: [],
  })

  const applyEntries = useCallback((next: HabitEntry[]) => {
    mirror.current.entries = next
    setEntries(next)
  }, [])

  const applyItems = useCallback((next: ChecklistItem[]) => {
    mirror.current.items = next
    setItems(next)
  }, [])

  const applyChecklists = useCallback((next: Checklist[]) => {
    mirror.current.checklists = next
    setChecklists(next)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextHabits, nextEntries, nextChecklists, nextItems] = await Promise.all([
        repo.fetchHabits(),
        repo.fetchHabitEntries(),
        repo.fetchChecklists(),
        repo.fetchChecklistItems(),
      ])
      setHabits(nextHabits)
      applyChecklists(nextChecklists)
      applyEntries(nextEntries)
      applyItems(nextItems)
    } catch (cause) {
      console.error(cause)
      setError('Не удалось загрузить привычки. Проверьте связь и попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }, [applyChecklists, applyEntries, applyItems])

  const ensureLoaded = useCallback(() => {
    if (started.current) return
    started.current = true
    void load()
  }, [load])

  const reload = useCallback(async () => {
    started.current = true
    await load()
  }, [load])

  const runAction = useCallback(async (action: () => Promise<void>, failure: string) => {
    setActionError(null)
    try {
      await action()
    } catch (cause) {
      console.error(cause)
      setActionError(failure)
    }
  }, [])

  const toggleEntry = useCallback(
    async (habitId: string, doneOn: string) => {
      const matches = (entry: HabitEntry) => entry.habitId === habitId && entry.doneOn === doneOn
      const done = mirror.current.entries.some(matches)
      const withChange = done
        ? mirror.current.entries.filter((entry) => !matches(entry))
        : [...mirror.current.entries, { habitId, doneOn }]

      applyEntries(withChange)
      setActionError(null)
      try {
        if (done) await repo.removeEntry(habitId, doneOn)
        else await repo.addEntry(habitId, doneOn)
      } catch (cause) {
        console.error(cause)
        // Откатываем только эту отметку: соседние нажатия могли уже сохраниться.
        applyEntries(
          done
            ? [...mirror.current.entries, { habitId, doneOn }]
            : mirror.current.entries.filter((entry) => !matches(entry)),
        )
        setActionError('Не удалось сохранить отметку. Попробуйте ещё раз.')
      }
    },
    [applyEntries],
  )

  const saveHabit = useCallback(
    async (draft: HabitDraft, id?: string) => {
      if (id) {
        const updated = await repo.updateHabit(id, draft)
        setHabits((current) => current.map((habit) => (habit.id === id ? updated : habit)))
        return
      }
      const created = await repo.insertHabit(draft, habits.length)
      setHabits((current) => [...current, created])
    },
    [habits.length],
  )

  const setHabitArchived = useCallback(
    async (id: string, archived: boolean) => {
      await runAction(async () => {
        const updated = await repo.updateHabit(id, { archivedAt: archived ? new Date().toISOString() : null })
        setHabits((current) => current.map((habit) => (habit.id === id ? updated : habit)))
      }, 'Не удалось изменить привычку. Попробуйте ещё раз.')
    },
    [runAction],
  )

  const removeHabit = useCallback(async (id: string) => {
    await repo.deleteHabit(id)
    setHabits((current) => current.filter((habit) => habit.id !== id))
    applyEntries(mirror.current.entries.filter((entry) => entry.habitId !== id))
  }, [applyEntries])

  const createChecklist = useCallback(
    async (title: string) => {
      const created = await repo.insertChecklist(title, mirror.current.checklists.length)
      applyChecklists([...mirror.current.checklists, created])
      return created.id
    },
    [applyChecklists],
  )

  const renameChecklist = useCallback(
    async (id: string, title: string) => {
      await runAction(async () => {
        await repo.updateChecklist(id, { title })
        applyChecklists(mirror.current.checklists.map((item) => (item.id === id ? { ...item, title: title.trim() } : item)))
      }, 'Не удалось переименовать чеклист.')
    },
    [applyChecklists, runAction],
  )

  const removeChecklist = useCallback(
    async (id: string) => {
      await repo.deleteChecklist(id)
      applyChecklists(mirror.current.checklists.filter((item) => item.id !== id))
      applyItems(mirror.current.items.filter((item) => item.checklistId !== id))
    },
    [applyChecklists, applyItems],
  )

  const addChecklistItem = useCallback(
    async (checklistId: string, text: string) => {
      await runAction(async () => {
        const position = mirror.current.items.filter((item) => item.checklistId === checklistId).length
        const created = await repo.insertChecklistItem(checklistId, text, position)
        applyItems([...mirror.current.items, created])
      }, 'Не удалось добавить пункт.')
    },
    [applyItems, runAction],
  )

  const renameChecklistItem = useCallback(
    async (id: string, text: string) => {
      const trimmed = text.trim()
      const target = mirror.current.items.find((item) => item.id === id)
      // Пустое название база не примет, а пользователь просто стирает текст перед вводом нового.
      if (!target || !trimmed || trimmed === target.text) return

      applyItems(mirror.current.items.map((item) => (item.id === id ? { ...item, text: trimmed } : item)))
      setActionError(null)
      try {
        await repo.updateChecklistItem(id, { text: trimmed })
      } catch (cause) {
        console.error(cause)
        applyItems(mirror.current.items.map((item) => (item.id === id ? { ...item, text: target.text } : item)))
        setActionError('Не удалось переименовать пункт.')
      }
    },
    [applyItems],
  )

  const removeChecklistItem = useCallback(
    async (id: string) => {
      await runAction(async () => {
        await repo.deleteChecklistItem(id)
        applyItems(mirror.current.items.filter((item) => item.id !== id))
      }, 'Не удалось удалить пункт.')
    },
    [applyItems, runAction],
  )

  const toggleChecklistItem = useCallback(
    async (id: string) => {
      const target = mirror.current.items.find((item) => item.id === id)
      if (!target) return

      const checkedAt = target.checkedAt ? null : new Date().toISOString()
      applyItems(mirror.current.items.map((item) => (item.id === id ? { ...item, checkedAt } : item)))
      setActionError(null)

      try {
        await repo.updateChecklistItem(id, { checkedAt })
      } catch (cause) {
        console.error(cause)
        // Откатываем только этот пункт: соседние отметки могли уже сохраниться.
        applyItems(
          mirror.current.items.map((item) => (item.id === id ? { ...item, checkedAt: target.checkedAt } : item)),
        )
        setActionError('Не удалось сохранить отметку. Попробуйте ещё раз.')
        return
      }

      // Прохождение начинается само, первой отметкой пункта.
      if (!checkedAt) return
      const checklist = mirror.current.checklists.find((item) => item.id === target.checklistId)
      if (!checklist || checklist.startedAt) return

      try {
        await repo.updateChecklist(checklist.id, { startedAt: checkedAt })
        applyChecklists(
          mirror.current.checklists.map((item) => (item.id === checklist.id ? { ...item, startedAt: checkedAt } : item)),
        )
      } catch (cause) {
        console.error(cause)
        // Сама отметка уже в базе, откатывать её нельзя — только сообщаем.
        setActionError('Отметка сохранена, но не удалось записать начало прохождения.')
      }
    },
    [applyChecklists, applyItems],
  )

  const resetItems = useCallback(
    async (id: string, completedAt: string | null) => {
      const beforeItems = mirror.current.items
      const beforeChecklists = mirror.current.checklists

      applyItems(beforeItems.map((item) => (item.checklistId === id ? { ...item, checkedAt: null } : item)))
      applyChecklists(
        beforeChecklists.map((item) =>
          item.id === id ? { ...item, startedAt: null, lastCompletedAt: completedAt ?? item.lastCompletedAt } : item,
        ),
      )
      setActionError(null)

      try {
        // Сначала шаблон, потом пункты: тогда ошибка второго запроса не оставит
        // отметки снятыми в базе и проставленными на экране.
        await repo.updateChecklist(id, { startedAt: null, ...(completedAt ? { lastCompletedAt: completedAt } : {}) })
        await repo.resetChecklistItems(id)
      } catch (cause) {
        console.error(cause)
        applyItems(beforeItems)
        applyChecklists(beforeChecklists)
        setActionError('Не удалось обновить чеклист. Данные перечитаны с сервера.')
        await load()
      }
    },
    [applyChecklists, applyItems, load],
  )

  const finishChecklist = useCallback(async (id: string) => resetItems(id, new Date().toISOString()), [resetItems])
  const restartChecklist = useCallback(async (id: string) => resetItems(id, null), [resetItems])

  const value = useMemo<HabitsContextValue>(
    () => ({
      habits,
      entries,
      checklists,
      items,
      loading,
      error,
      actionError,
      ensureLoaded,
      reload,
      toggleEntry,
      saveHabit,
      setHabitArchived,
      removeHabit,
      createChecklist,
      renameChecklist,
      removeChecklist,
      addChecklistItem,
      renameChecklistItem,
      removeChecklistItem,
      toggleChecklistItem,
      finishChecklist,
      restartChecklist,
    }),
    [
      habits,
      entries,
      checklists,
      items,
      loading,
      error,
      actionError,
      ensureLoaded,
      reload,
      toggleEntry,
      saveHabit,
      setHabitArchived,
      removeHabit,
      createChecklist,
      renameChecklist,
      removeChecklist,
      addChecklistItem,
      renameChecklistItem,
      removeChecklistItem,
      toggleChecklistItem,
      finishChecklist,
      restartChecklist,
    ],
  )

  return <HabitsContext.Provider value={value}>{children}</HabitsContext.Provider>
}
