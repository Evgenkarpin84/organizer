import { useEffect } from 'react'
import { useHabitsContext, type HabitsContextValue } from './habitsContext'

/** Подписка на привычки и чеклисты: первый вызов запускает загрузку. */
export function useHabits(): HabitsContextValue {
  const habits = useHabitsContext()
  const { ensureLoaded } = habits

  useEffect(() => {
    ensureLoaded()
  }, [ensureLoaded])

  return habits
}
