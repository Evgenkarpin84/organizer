import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NewsItem } from '../lib/types'

const ITEM: NewsItem = {
  id: 'n1',
  sourceId: 'src-1',
  topic: 'cars',
  title: 'Chery привезла новый кроссовер',
  url: 'https://kolesa.ru/news/chery',
  summary: null,
  publishedAt: '2026-09-24T09:00:00.000Z',
  readAt: null,
}

vi.mock('./newsRepo', () => ({
  NEWS_LIMIT: 200,
  fetchNewsSources: vi.fn(async () => []),
  fetchNewsItems: vi.fn(async () => [ITEM]),
  setItemRead: vi.fn(async () => {}),
}))

const repo = await import('./newsRepo')
const { NewsProvider } = await import('./NewsProvider')
const { useNews } = await import('./useNews')

function Probe() {
  const { items, markRead } = useNews()
  const item = items[0]
  if (!item) return <p>загрузка</p>
  return (
    <button type="button" onClick={() => void markRead(item)}>
      {item.readAt ? 'прочитано' : 'не прочитано'}
    </button>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('провайдер новостей', () => {
  it('отметка «прочитано» доходит до базы и не повторяется', async () => {
    render(
      <NewsProvider>
        <Probe />
      </NewsProvider>,
    )

    const button = await screen.findByRole('button', { name: 'не прочитано' })
    await userEvent.click(button)

    expect(repo.setItemRead).toHaveBeenCalledTimes(1)
    expect(repo.setItemRead).toHaveBeenCalledWith('n1', expect.any(String))
    expect(await screen.findByRole('button', { name: 'прочитано' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'прочитано' }))
    expect(repo.setItemRead).toHaveBeenCalledTimes(1)
  })

  it('при ошибке записи отметка откатывается', async () => {
    vi.mocked(repo.setItemRead).mockRejectedValueOnce(new Error('нет сети'))

    render(
      <NewsProvider>
        <Probe />
      </NewsProvider>,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'не прочитано' }))
    expect(await screen.findByRole('button', { name: 'не прочитано' })).toBeInTheDocument()
  })
})
