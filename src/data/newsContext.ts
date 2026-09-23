import { createContext, useContext } from 'react'
import type { NewsItem, NewsSource } from '../lib/types'

export interface NewsContextValue {
  sources: NewsSource[]
  items: NewsItem[]
  loading: boolean
  error: string | null
  /** Загрузка стартует при первом открытии вкладки, а не на старте приложения. */
  ensureLoaded: () => void
  reload: () => Promise<void>
  markRead: (item: NewsItem) => Promise<void>
}

export const NewsContext = createContext<NewsContextValue | null>(null)

export function useNewsContext(): NewsContextValue {
  const value = useContext(NewsContext)
  if (!value) throw new Error('useNews вызван вне NewsProvider')
  return value
}
