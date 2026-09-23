import { describe, expect, it } from 'vitest'
import {
  describeNewsSync,
  filterNews,
  formatNewsDate,
  groupNewsByDate,
  groupNewsByTopic,
  topicColor,
  topicShortTitle,
  topicTitle,
  unreadNewsCount,
} from './news'
import type { NewsItem, NewsSource } from './types'

const TODAY = '2026-09-24'
const NOW = new Date(2026, 8, 24, 13, 0)

function makeItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: 'n1',
    sourceId: 'src-1',
    topic: 'cars',
    title: 'Chery привезла новый кроссовер',
    url: 'https://kolesa.ru/news/chery',
    summary: 'Подробности о новинке',
    publishedAt: new Date(2026, 8, 24, 12, 30).toISOString(),
    readAt: null,
    ...overrides,
  }
}

function makeSource(overrides: Partial<NewsSource> = {}): NewsSource {
  return {
    id: 'src-1',
    key: 'kolesa',
    topic: 'cars',
    title: 'Kolesa.ru',
    enabled: true,
    lastFetchAt: new Date(2026, 8, 24, 12, 40).toISOString(),
    lastStatus: 'ok',
    lastError: null,
    ...overrides,
  }
}

describe('темы новостей', () => {
  it('знает полные и короткие названия', () => {
    expect(topicTitle('ozon')).toBe('Ozon для продавца')
    expect(topicShortTitle('print3d')).toBe('3D-печать')
    expect(topicTitle('неизвестная')).toBe('неизвестная')
  })

  it('даёт соседним темам разные цвета', () => {
    expect(topicColor('ozon')).not.toBe(topicColor('cars'))
    expect(topicColor('cars')).not.toBe(topicColor('gadgets'))
  })
})

describe('фильтры и счётчики', () => {
  const items = [
    makeItem({ id: 'a' }),
    makeItem({ id: 'b', readAt: new Date(2026, 8, 24, 12, 45).toISOString(), publishedAt: new Date(2026, 8, 24, 11, 0).toISOString() }),
    makeItem({ id: 'c', topic: 'ai', publishedAt: new Date(2026, 8, 23, 10, 0).toISOString() }),
  ]

  it('«Непрочитанные» оставляет только без отметки', () => {
    expect(filterNews(items, 'unread').map((item) => item.id)).toEqual(['a', 'c'])
  })

  it('фильтрует по теме и сортирует по дате', () => {
    expect(filterNews(items, 'all', 'cars').map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('считает непрочитанные всего и в теме', () => {
    expect(unreadNewsCount(items)).toBe(2)
    expect(unreadNewsCount(items, 'ai')).toBe(1)
  })
})

describe('группировка', () => {
  it('по темам — в фиксированном порядке и без пустых тем', () => {
    const groups = groupNewsByTopic([makeItem({ topic: 'ai' }), makeItem({ topic: 'ozon' }), makeItem({ topic: 'cars' })])
    expect(groups.map((group) => group.title)).toEqual(['Ozon для продавца', 'Китайские автомобили', 'ИИ и технологии'])
  })

  it('по дате — «Сегодня», «Вчера», затем дата', () => {
    const groups = groupNewsByDate(
      [
        makeItem({ id: 'today' }),
        makeItem({ id: 'yesterday', publishedAt: new Date(2026, 8, 23, 9, 0).toISOString() }),
        makeItem({ id: 'older', publishedAt: new Date(2026, 8, 15, 9, 0).toISOString() }),
      ],
      TODAY,
    )
    expect(groups.map((group) => group.title)).toEqual(['Сегодня', 'Вчера', '15 сентября'])
  })

  it('время у сегодняшних, дата у остальных', () => {
    expect(formatNewsDate(makeItem().publishedAt, TODAY)).toBe('12:30')
    expect(formatNewsDate(new Date(2026, 8, 23, 9, 0).toISOString(), TODAY)).toBe('Вчера')
  })
})

describe('статус сбора новостей', () => {
  it('говорит, что сбор ещё не запускался', () => {
    expect(describeNewsSync([], 0, NOW, TODAY).tone).toBe('warn')
    expect(describeNewsSync([makeSource({ lastFetchAt: null })], 0, NOW, TODAY).text).toContain('ни разу')
  })

  it('называет сломанную ленту', () => {
    const status = describeNewsSync(
      [makeSource(), makeSource({ id: 's2', title: '3DToday', lastStatus: 'error', lastError: 'лента не найдена (404)' })],
      1,
      NOW,
      TODAY,
    )
    expect(status.tone).toBe('warn')
    expect(status.text).toContain('3DToday')
  })

  it('предупреждает, что новости давно не обновлялись', () => {
    const status = describeNewsSync([makeSource({ lastFetchAt: new Date(2026, 8, 24, 3, 0).toISOString() })], 5, NOW, TODAY)
    expect(status.tone).toBe('warn')
    expect(status.text).toContain('не обновлялись 10 часов')
  })

  it('в норме показывает число непрочитанных и время обновления', () => {
    const status = describeNewsSync([makeSource()], 7, NOW, TODAY)
    expect(status).toMatchObject({ tone: 'ok' })
    expect(status.text).toBe('7 непрочитанных · обновлено сегодня в 12:40')
  })
})
