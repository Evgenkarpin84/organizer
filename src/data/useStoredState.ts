import { useCallback, useState } from 'react'

/** Мелкие настройки вида: localStorage может быть недоступен, это не ошибка. */
export function useStoredState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })

  const update = useCallback(
    (next: T) => {
      setValue(next)
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // приватный режим или отключённое хранилище — просто не запоминаем
      }
    },
    [key],
  )

  return [value, update]
}
