import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NewsItem, NewsSource } from '../lib/types'
import { NewsView } from './NewsScreen'

const TODAY = '2026-09-24'
const NOW = new Date(2026, 8, 24, 13, 0)

const SOURCES: NewsSource[] = [
  {
    id: 'src-cars',
    key: 'kolesa',
    topic: 'cars',
    title: 'Kolesa.ru',
    enabled: true,
    lastFetchAt: new Date(2026, 8, 24, 12, 40).toISOString(),
    lastStatus: 'ok',
    lastError: null,
  },
  {
    id: 'src-ai',
    key: 'habr-ai',
    topic: 'ai',
    title: 'Habr',
    enabled: true,
    lastFetchAt: new Date(2026, 8, 24, 12, 40).toISOString(),
    lastStatus: 'ok',
    lastError: null,
  },
]

function makeItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: 'n1',
    sourceId: 'src-cars',
    topic: 'cars',
    title: 'Chery привезла новый кроссовер',
    url: 'https://kolesa.ru/news/chery',
    summary: 'Подробности о новинке',
    publishedAt: new Date(2026, 8, 24, 12, 30).toISOString(),
    readAt: null,
    ...overrides,
  }
}

const ITEMS = [
  makeItem(),
  makeItem({
    id: 'n2',
    sourceId: 'src-ai',
    topic: 'ai',
    title: 'Как устроены трансформеры',
    url: 'https://habr.com/ru/post/1/',
    readAt: new Date(2026, 8, 24, 12, 45).toISOString(),
    publishedAt: new Date(2026, 8, 23, 18, 0).toISOString(),
  }),
]

function renderView(overrides: Partial<Parameters<typeof NewsView>[0]> = {}) {
  const props = {
    sources: SOURCES,
    items: ITEMS,
    loading: false,
    error: null,
    todayIso: TODAY,
    now: NOW,
    onOpen: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  }
  render(<NewsView {...props} />)
  return props
}

beforeEach(() => {
  localStorage.clear()
})

describe('экран «Новости»', () => {
  it('группирует по темам в заданном порядке', () => {
    renderView()
    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
    expect(headings[0]).toContain('Китайские автомобили')
    expect(headings[1]).toContain('ИИ и технологии')
  })

  it('переключает группировку на дату', async () => {
    renderView()
    await userEvent.click(screen.getByRole('button', { name: 'Дата' }))
    expect(screen.getByRole('heading', { name: /Сегодня/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Вчера/ })).toBeInTheDocument()
  })

  it('строка публикации — внешняя ссылка с безопасными атрибутами', () => {
    renderView()
    const link = screen.getByRole('link', { name: /Chery привезла новый кроссовер/ })
    expect(link).toHaveAttribute('href', 'https://kolesa.ru/news/chery')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('по переходу отмечает новость прочитанной один раз', async () => {
    const props = renderView()
    await userEvent.click(screen.getByRole('link', { name: /Chery привезла/ }))
    expect(props.onOpen).toHaveBeenCalledTimes(1)
    expect(props.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1' }))
  })

  it('фильтр «Непрочитанные» и счётчик показывают одно число', async () => {
    renderView()
    expect(screen.getByRole('tab', { name: /Непрочитанные/ })).toHaveTextContent('1')
    await userEvent.click(screen.getByRole('tab', { name: /Непрочитанные/ }))
    expect(screen.queryByText('Как устроены трансформеры')).not.toBeInTheDocument()
  })

  it('фильтрует по теме и сбрасывает фильтры', async () => {
    renderView()
    await userEvent.click(screen.getByRole('button', { name: 'ИИ и технологии' }))
    expect(screen.queryByText('Chery привезла новый кроссовер')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: /Непрочитанные/ }))
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }))
    expect(screen.getByText('Chery привезла новый кроссовер')).toBeInTheDocument()
  })

  it('показывает разные тексты для пустого списка и пустого фильтра', () => {
    renderView({ items: [], sources: [] })
    expect(screen.getByText('Новостей пока нет')).toBeInTheDocument()
    expect(screen.getByText('Запустите сбор новостей на компьютере: npm run news')).toBeInTheDocument()
  })

  it('честно предупреждает, что новости давно не обновлялись', () => {
    renderView({ now: new Date(2026, 8, 24, 22, 0) })
    expect(screen.getByRole('status')).toHaveTextContent('не обновлялись')
  })

  it('при ошибке загрузки не выдаёт пустую базу за отсутствие новостей', () => {
    renderView({ items: [], error: 'Не удалось загрузить новости. Проверьте связь и попробуйте ещё раз.' })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Новостей пока нет')).not.toBeInTheDocument()
  })
})
