import { useEffect } from 'react'
import { useNewsContext, type NewsContextValue } from './newsContext'

/** Подписка на состояние новостей: первый вызов запускает загрузку. */
export function useNews(): NewsContextValue {
  const news = useNewsContext()
  const { ensureLoaded } = news

  useEffect(() => {
    ensureLoaded()
  }, [ensureLoaded])

  return news
}
