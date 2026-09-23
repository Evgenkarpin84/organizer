import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import type { NewsItem, NewsSource } from '../lib/types'
import { NewsContext, type NewsContextValue } from './newsContext'
import { fetchNewsItems, fetchNewsSources, setItemRead } from './newsRepo'

export function NewsProvider({ children }: { children: ReactNode }) {
  const [sources, setSources] = useState<NewsSource[]>([])
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextSources, nextItems] = await Promise.all([fetchNewsSources(), fetchNewsItems()])
      setSources(nextSources)
      setItems(nextItems)
    } catch (cause) {
      console.error(cause)
      setError('Не удалось загрузить новости. Проверьте связь и попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }, [])

  const ensureLoaded = useCallback(() => {
    if (started.current) return
    started.current = true
    void load()
  }, [load])

  const reload = useCallback(async () => {
    started.current = true
    await load()
  }, [load])

  /**
   * Отметка ставится в момент перехода по ссылке. Решение о записи принимается по
   * переданной публикации, а не по состоянию внутри setItems: там значение ещё не видно.
   */
  const markRead = useCallback(async (item: NewsItem) => {
    if (item.readAt) return
    const readAt = new Date().toISOString()
    setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, readAt } : entry)))

    try {
      await setItemRead(item.id, readAt)
    } catch (cause) {
      console.error(cause)
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, readAt: null } : entry)))
      setError('Не удалось отметить новость прочитанной.')
    }
  }, [])

  const value = useMemo<NewsContextValue>(
    () => ({ sources, items, loading, error, ensureLoaded, reload, markRead }),
    [sources, items, loading, error, ensureLoaded, reload, markRead],
  )

  return <NewsContext.Provider value={value}>{children}</NewsContext.Provider>
}
