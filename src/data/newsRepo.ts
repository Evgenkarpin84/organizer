import { requireSupabase } from '../lib/supabase'
import type { NewsItem, NewsSource } from '../lib/types'

interface SourceRow {
  id: string
  key: string
  topic: string
  title: string
  enabled: boolean
  last_fetch_at: string | null
  last_status: 'ok' | 'error' | null
  last_error: string | null
}

interface ItemRow {
  id: string
  source_id: string
  topic: string
  title: string
  url: string
  summary: string | null
  published_at: string
  read_at: string | null
}

const ITEM_COLUMNS = 'id, source_id, topic, title, url, summary, published_at, read_at'

/** Экран показывает последние публикации: подгрузки старых на этом этапе нет. */
export const NEWS_LIMIT = 200

function sourceFromRow(row: SourceRow): NewsSource {
  return {
    id: row.id,
    key: row.key,
    topic: row.topic,
    title: row.title,
    enabled: row.enabled,
    lastFetchAt: row.last_fetch_at,
    lastStatus: row.last_status,
    lastError: row.last_error,
  }
}

function itemFromRow(row: ItemRow): NewsItem {
  return {
    id: row.id,
    sourceId: row.source_id,
    topic: row.topic,
    title: row.title,
    url: row.url,
    summary: row.summary,
    publishedAt: row.published_at,
    readAt: row.read_at,
  }
}

export async function fetchNewsSources(): Promise<NewsSource[]> {
  const { data, error } = await requireSupabase()
    .from('news_sources')
    .select('id, key, topic, title, enabled, last_fetch_at, last_status, last_error')
    // Выключенные ленты в статусе не участвуют: их ошибки уже не актуальны.
    .eq('enabled', true)
    .order('key', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as SourceRow[]).map(sourceFromRow)
}

export async function fetchNewsItems(limit: number = NEWS_LIMIT): Promise<NewsItem[]> {
  const { data, error } = await requireSupabase()
    .from('news_items')
    .select(ITEM_COLUMNS)
    .order('published_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data as ItemRow[]).map(itemFromRow)
}

export async function setItemRead(id: string, readAt: string | null): Promise<void> {
  const { error } = await requireSupabase().from('news_items').update({ read_at: readAt }).eq('id', id)
  if (error) throw new Error(error.message)
}
