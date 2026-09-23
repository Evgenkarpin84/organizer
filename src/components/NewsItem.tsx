import { LIST_COLORS } from '../lib/labels'
import { formatNewsDate, isUnreadNews, topicColor, topicShortTitle } from '../lib/news'
import type { NewsItem as NewsItemType, NewsSource } from '../lib/types'
import { FOCUS_RING } from './states'

interface NewsItemProps {
  item: NewsItemType
  source: NewsSource | null
  todayIso: string
  hideTopicChip?: boolean
  onOpen: (item: NewsItemType) => void
}

export function NewsItem({ item, source, todayIso, hideTopicChip = false, onOpen }: NewsItemProps) {
  const unread = isUnreadNews(item)

  return (
    <li className="mb-2">
      {/* Статья открывается во внешнем браузере: полного текста в базе нет. */}
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onOpen(item)}
        className={`flex min-h-[4.5rem] w-full items-start gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 text-left active:bg-slate-50 ${FOCUS_RING} ${
          unread ? 'bg-white' : 'bg-white/70'
        }`}
      >
        {unread ? (
          <>
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
            <span className="sr-only">Не прочитано.</span>
          </>
        ) : (
          <span className="mt-2 h-2 w-2 shrink-0" aria-hidden="true" />
        )}

        <span className="min-w-0 flex-1">
          <span
            className={`line-clamp-2 text-[15px] leading-snug ${unread ? 'font-semibold text-slate-900' : 'text-slate-700'}`}
          >
            {item.title}
          </span>

          {item.summary ? (
            <span className="mt-0.5 line-clamp-2 text-xs text-slate-500 [overflow-wrap:anywhere]">{item.summary}</span>
          ) : null}

          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            {hideTopicChip ? null : (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${LIST_COLORS[topicColor(item.topic)].chip}`}>
                {topicShortTitle(item.topic)}
              </span>
            )}
            {source ? <span>{source.title}</span> : null}
            <span>{formatNewsDate(item.publishedAt, todayIso)}</span>
          </span>
        </span>
      </a>
    </li>
  )
}
