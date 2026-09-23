import { useMemo } from 'react'
import { NewsItem } from '../components/NewsItem'
import { Section } from '../components/Section'
import { EmptyState, ErrorState, FOCUS_RING, SkeletonList } from '../components/states'
import { useNews } from '../data/useNews'
import { useStoredState } from '../data/useStoredState'
import { todayISO } from '../lib/dates'
import { LIST_COLORS } from '../lib/labels'
import {
  describeNewsSync,
  filterNews,
  groupNewsByDate,
  groupNewsByTopic,
  NEWS_TOPICS,
  topicColor,
  topicShortTitle,
  unreadNewsCount,
  type NewsFilter,
  type NewsGrouping,
} from '../lib/news'
import type { NewsItem as NewsItemType, NewsSource } from '../lib/types'

const FILTERS: [NewsFilter, string][] = [
  ['all', 'Все'],
  ['unread', 'Непрочитанные'],
]

export interface NewsViewProps {
  sources: NewsSource[]
  items: NewsItemType[]
  loading: boolean
  error: string | null
  todayIso: string
  now?: Date
  onOpen: (item: NewsItemType) => void
  onRetry: () => void
}

export function NewsView({ sources, items, loading, error, todayIso, now = new Date(), onOpen, onRetry }: NewsViewProps) {
  const [filter, setFilter] = useStoredState<NewsFilter>('news.filter', 'all')
  const [grouping, setGrouping] = useStoredState<NewsGrouping>('news.group', 'topic')
  const [topic, setTopic] = useStoredState<string | null>('news.topic', null)

  const unread = unreadNewsCount(items)
  const visible = useMemo(() => filterNews(items, filter, topic), [items, filter, topic])
  const groups = useMemo(
    () => (grouping === 'topic' ? groupNewsByTopic(visible) : groupNewsByDate(visible, todayIso)),
    [grouping, visible, todayIso],
  )

  const status = describeNewsSync(sources, unread, now, todayIso)
  const filtersTouched = filter !== 'all' || topic !== null
  const blocked = Boolean(error) && items.length === 0
  const sourceById = new Map(sources.map((source) => [source.id, source]))

  const resetFilters = () => {
    setFilter('all')
    setTopic(null)
  }

  return (
    <>
      <div role="tablist" aria-label="Фильтр новостей" className="mb-2 flex rounded-xl bg-slate-200 p-1">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium ${FOCUS_RING} ${
              filter === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            <span className="truncate">{label}</span>
            {key === 'unread' && unread > 0 ? (
              <span className="shrink-0 rounded-full bg-blue-100 px-1.5 text-xs font-normal text-blue-800">{unread}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        <button
          type="button"
          onClick={() => setTopic(null)}
          className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-sm ${FOCUS_RING} ${
            topic === null ? 'border-transparent bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'
          }`}
        >
          Все темы
        </button>
        {NEWS_TOPICS.map((entry) => {
          const selected = topic === entry.key
          const topicUnread = unreadNewsCount(items, entry.key)
          return (
            <button
              key={entry.key}
              type="button"
              aria-label={entry.title}
              onClick={() => setTopic(entry.key)}
              className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-sm ${FOCUS_RING} ${
                selected ? 'border-transparent bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${LIST_COLORS[topicColor(entry.key)].dot}`} aria-hidden="true" />
              {topicShortTitle(entry.key)}
              {topicUnread > 0 ? (
                <span className={`text-xs ${selected ? 'text-slate-300' : 'text-slate-500'}`}>{topicUnread}</span>
              ) : null}
            </button>
          )
        })}
      </div>

      {status.tone === 'warn' ? (
        <p role="status" className="mb-2 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900">
          {status.text}
        </p>
      ) : null}

      <div className="mb-1 flex items-center gap-2">
        <p className="min-w-0 flex-1 text-xs text-slate-500">{status.tone === 'ok' ? status.text : ''}</p>
        <div role="group" aria-label="Группировка" className="flex shrink-0 rounded-lg bg-slate-200 p-0.5">
          {(
            [
              ['topic', 'Тема'],
              ['date', 'Дата'],
            ] as [NewsGrouping, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={grouping === key}
              onClick={() => setGrouping(key)}
              className={`h-9 rounded-md px-3 text-xs font-medium ${FOCUS_RING} ${
                grouping === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={onRetry} /> : null}
      {loading ? <SkeletonList count={4} /> : null}

      {!loading && !blocked && visible.length === 0 ? (
        <div className="mt-4">
          {filtersTouched ? (
            <EmptyState
              icon="news"
              title="Ничего не найдено"
              hint="Нет новостей с такими фильтрами"
              action={
                <button
                  type="button"
                  onClick={resetFilters}
                  className={`mt-2 h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium ${FOCUS_RING}`}
                >
                  Сбросить фильтры
                </button>
              }
            />
          ) : (
            <EmptyState
              icon="news"
              title="Новостей пока нет"
              hint={
                sources.length === 0
                  ? 'Запустите сбор новостей на компьютере: npm run news'
                  : 'Свежих публикаций не было'
              }
            />
          )}
        </div>
      ) : null}

      {!loading && !blocked
        ? groups.map((group) => (
            <Section key={group.key} title={group.title} count={group.items.length}>
              <ul>
                {group.items.map((item) => (
                  <NewsItem
                    key={item.id}
                    item={item}
                    source={sourceById.get(item.sourceId) ?? null}
                    todayIso={todayIso}
                    hideTopicChip={grouping === 'topic' || topic !== null}
                    onOpen={onOpen}
                  />
                ))}
              </ul>
            </Section>
          ))
        : null}
    </>
  )
}

export function NewsScreen() {
  const { sources, items, loading, error, reload, markRead } = useNews()

  return (
    <NewsView
      sources={sources}
      items={items}
      loading={loading}
      error={error}
      todayIso={todayISO()}
      onOpen={(item) => void markRead(item)}
      onRetry={() => void reload()}
    />
  )
}
