import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { addDaysISO, capitalize, toISODate } from './dates'
import { LIST_COLOR_KEYS } from './labels'
import type { ListColor, NewsItem, NewsSource } from './types'

export const NEWS_TOPICS = [
  { key: 'ozon', title: 'Ozon для продавца', short: 'Ozon' },
  { key: 'cars', title: 'Китайские автомобили', short: 'Авто' },
  { key: 'gadgets', title: 'Смартфоны и гаджеты', short: 'Гаджеты' },
  { key: 'print3d', title: '3D-печать', short: '3D-печать' },
  { key: 'cinema', title: 'Кино и сериалы', short: 'Кино' },
  { key: 'ai', title: 'ИИ и технологии', short: 'ИИ' },
  { key: 'finance', title: 'Экономика и финансы', short: 'Финансы' },
  { key: 'world', title: 'Мир и политика', short: 'Мир' },
] as const

export type NewsFilter = 'all' | 'unread'
export type NewsGrouping = 'topic' | 'date'

export interface NewsGroup {
  key: string
  title: string
  items: NewsItem[]
}

export interface NewsSyncStatus {
  tone: 'ok' | 'warn'
  text: string
}

const TOPIC_KEYS: string[] = NEWS_TOPICS.map((topic) => topic.key)
const SYNC_STALE_HOURS = 6

export function topicTitle(key: string): string {
  return NEWS_TOPICS.find((topic) => topic.key === key)?.title ?? key
}

export function topicShortTitle(key: string): string {
  return NEWS_TOPICS.find((topic) => topic.key === key)?.short ?? key
}

/** Цвет темы — из общей палитры по порядку, как у ящиков почты. */
export function topicColor(key: string): ListColor {
  const index = TOPIC_KEYS.indexOf(key)
  return LIST_COLOR_KEYS[(index < 0 ? 0 : index) % LIST_COLOR_KEYS.length]
}

export function isUnreadNews(item: NewsItem): boolean {
  return item.readAt === null
}

export function unreadNewsCount(items: NewsItem[], topic: string | null = null): number {
  return items.filter((item) => (topic ? item.topic === topic : true) && isUnreadNews(item)).length
}

export function filterNews(items: NewsItem[], filter: NewsFilter, topic: string | null = null): NewsItem[] {
  return items
    .filter((item) => (topic ? item.topic === topic : true))
    .filter((item) => (filter === 'unread' ? isUnreadNews(item) : true))
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
}

export function formatNewsDate(publishedAt: string, todayIso: string): string {
  const moment = new Date(publishedAt)
  if (Number.isNaN(moment.getTime())) return ''
  const day = toISODate(moment)
  if (day === todayIso) return format(moment, 'HH:mm')
  if (day === addDaysISO(todayIso, -1)) return 'Вчера'
  const sameYear = day.slice(0, 4) === todayIso.slice(0, 4)
  return format(moment, sameYear ? 'd MMM' : 'd MMM yyyy', { locale: ru })
}

/** Темы идут в заданном порядке, а не в порядке появления публикаций. */
export function groupNewsByTopic(items: NewsItem[]): NewsGroup[] {
  return NEWS_TOPICS.map((topic) => ({
    key: topic.key,
    title: topic.title,
    items: items.filter((item) => item.topic === topic.key),
  })).filter((group) => group.items.length > 0)
}

export function groupNewsByDate(items: NewsItem[], todayIso: string): NewsGroup[] {
  const groups = new Map<string, NewsItem[]>()
  for (const item of items) {
    const moment = new Date(item.publishedAt)
    const key = Number.isNaN(moment.getTime()) ? 'unknown' : toISODate(moment)
    const list = groups.get(key)
    if (list) list.push(item)
    else groups.set(key, [item])
  }

  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, list]) => ({ key, title: dayTitle(key, todayIso), items: list }))
}

function dayTitle(dayIso: string, todayIso: string): string {
  if (dayIso === 'unknown') return 'Без даты'
  if (dayIso === todayIso) return 'Сегодня'
  if (dayIso === addDaysISO(todayIso, -1)) return 'Вчера'
  const moment = new Date(`${dayIso}T12:00:00`)
  const sameYear = dayIso.slice(0, 4) === todayIso.slice(0, 4)
  return capitalize(format(moment, sameYear ? 'd MMMM' : 'd MMMM yyyy', { locale: ru }))
}

function hoursWord(value: number): string {
  const last = value % 10
  const tens = value % 100
  if (tens >= 11 && tens <= 14) return 'часов'
  if (last === 1) return 'час'
  if (last >= 2 && last <= 4) return 'часа'
  return 'часов'
}

/** Честная строка о том, когда скрипт на ПК последний раз приносил новости. */
export function describeNewsSync(
  sources: NewsSource[],
  unread: number,
  now: Date,
  todayIso: string,
): NewsSyncStatus {
  if (sources.length === 0) {
    return { tone: 'warn', text: 'Сбор новостей ещё ни разу не запускался на компьютере: npm run news' }
  }

  const broken = sources.find((source) => source.lastStatus === 'error' && source.lastError)
  if (broken) {
    return { tone: 'warn', text: `Лента «${broken.title}» не обновляется: ${broken.lastError}. Остальные в порядке.` }
  }

  const stamps = sources
    .map((source) => (source.lastFetchAt ? new Date(source.lastFetchAt).getTime() : null))
    .filter((value): value is number => value !== null && !Number.isNaN(value))

  if (stamps.length === 0) {
    return { tone: 'warn', text: 'Сбор новостей ещё ни разу не запускался на компьютере: npm run news' }
  }

  const latest = new Date(Math.max(...stamps))
  const hours = Math.floor((now.getTime() - latest.getTime()) / 3_600_000)
  if (hours >= SYNC_STALE_HOURS) {
    return {
      tone: 'warn',
      text: `Новости не обновлялись ${hours} ${hoursWord(hours)}. Их собирает скрипт на компьютере — при выключенном ПК ленты не читаются.`,
    }
  }

  const when =
    toISODate(latest) === todayIso ? `сегодня в ${format(latest, 'HH:mm')}` : formatNewsDate(latest.toISOString(), todayIso)
  const unreadText = unread > 0 ? `${unread} непрочитанных · ` : ''
  return { tone: 'ok', text: `${unreadText}обновлено ${when}` }
}
