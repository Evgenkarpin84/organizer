import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MailAccount, MailMessage } from '../lib/types'
import { MailView } from './MailScreen'

const TODAY = '2026-09-25'
const NOW = new Date(2026, 8, 25, 13, 0)

const ACCOUNTS: MailAccount[] = [
  {
    id: 'acc-1',
    key: 'mail1',
    label: 'Личная',
    email: 'a@bk.ru',
    provider: 'mailru',
    lastSyncAt: new Date(2026, 8, 25, 12, 40).toISOString(),
    lastError: null,
  },
  {
    id: 'acc-2',
    key: 'mail4',
    label: 'Яндекс',
    email: 'b@ya.ru',
    provider: 'yandex',
    lastSyncAt: new Date(2026, 8, 25, 12, 40).toISOString(),
    lastError: null,
  },
]

function makeMessage(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    id: 'm1',
    accountId: 'acc-1',
    subject: 'Счёт за сентябрь',
    fromName: 'Бухгалтерия',
    fromEmail: 'buh@mail.ru',
    sentAt: null,
    receivedAt: new Date(2026, 8, 25, 12, 30).toISOString(),
    preview: 'Добрый день! Счёт во вложении.',
    bodyText: 'Добрый день!',
    bodyTruncated: false,
    hasAttachments: false,
    attachmentNames: [],
    isBulk: false,
    readAt: null,
    archivedAt: null,
    ...overrides,
  }
}

const MESSAGES = [
  makeMessage({ id: 'unread', hasAttachments: true, attachmentNames: ['счёт.pdf'] }),
  makeMessage({
    id: 'read',
    subject: null,
    readAt: new Date(2026, 8, 25, 12, 35).toISOString(),
    receivedAt: new Date(2026, 8, 24, 18, 0).toISOString(),
    accountId: 'acc-2',
    fromName: 'Ozon',
  }),
  makeMessage({
    id: 'archived',
    subject: 'Старое письмо',
    archivedAt: new Date(2026, 8, 24, 10, 0).toISOString(),
    receivedAt: new Date(2026, 8, 20, 10, 0).toISOString(),
  }),
]

function renderView(overrides: Partial<Parameters<typeof MailView>[0]> = {}) {
  const props = {
    accounts: ACCOUNTS,
    messages: MESSAGES,
    loading: false,
    error: null,
    todayIso: TODAY,
    now: NOW,
    onOpen: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  }
  render(<MailView {...props} />)
  return props
}

beforeEach(() => {
  localStorage.clear()
})

describe('экран «Почта»', () => {
  it('группирует по дате и показывает отправителя, тему и превью', () => {
    renderView()
    expect(screen.getByRole('heading', { name: /Сегодня/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Вчера/ })).toBeInTheDocument()
    expect(screen.getByText('Бухгалтерия')).toBeInTheDocument()
    expect(screen.getByText('Счёт за сентябрь')).toBeInTheDocument()
    expect(screen.getByText('Письмо без темы')).toBeInTheDocument()
    expect(screen.getAllByText('Добрый день! Счёт во вложении.').length).toBeGreaterThan(0)
  })

  it('не показывает архивные письма в «Все» и показывает их в «Архиве»', async () => {
    renderView()
    expect(screen.queryByText('Старое письмо')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: /Архив/ }))
    expect(screen.getByText('Старое письмо')).toBeInTheDocument()
    expect(screen.queryByText('Счёт за сентябрь')).not.toBeInTheDocument()
  })

  it('фильтр «Непрочитанные» и счётчик показывают одно и то же число', async () => {
    renderView()
    // Архивное письмо тоже без отметки о прочтении, но в счётчик не идёт.
    expect(screen.getByRole('tab', { name: /Непрочитанные/ })).toHaveTextContent('1')

    await userEvent.click(screen.getByRole('tab', { name: /Непрочитанные/ }))
    expect(screen.getByText('Счёт за сентябрь')).toBeInTheDocument()
    expect(screen.queryByText('Письмо без темы')).not.toBeInTheDocument()
  })

  it('фильтрует по ящику и умеет сбрасывать фильтры', async () => {
    renderView()
    await userEvent.click(screen.getByRole('button', { name: /^Яндекс/ }))
    expect(screen.queryByText('Счёт за сентябрь')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: /Архив/ }))
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }))
    expect(screen.getByText('Счёт за сентябрь')).toBeInTheDocument()
  })

  it('переключает группировку на ящики', async () => {
    renderView()
    await userEvent.click(screen.getByRole('button', { name: 'Ящик' }))
    expect(screen.getByRole('heading', { name: /Личная/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Яндекс/ })).toBeInTheDocument()
  })

  it('показывает вложение и непрочитанность', () => {
    renderView()
    expect(screen.getAllByText('Есть вложения.').length).toBe(1)
    expect(screen.getAllByText('Не прочитано.').length).toBe(1)
  })

  it('честно предупреждает, что письма давно не обновлялись', () => {
    renderView({ now: new Date(2026, 8, 25, 20, 0) })
    expect(screen.getByRole('status')).toHaveTextContent('Письма не обновлялись')
  })

  it('объясняет, что ящики ещё не настроены', () => {
    renderView({ accounts: [], messages: [] })
    expect(screen.getByRole('status')).toHaveTextContent('Ящики ещё не настроены')
    expect(screen.getByText('Писем пока нет')).toBeInTheDocument()
  })

  it('при ошибке загрузки не выдаёт пустой ящик за отсутствие писем', () => {
    renderView({ messages: [], error: 'Не удалось загрузить письма. Проверьте связь и попробуйте ещё раз.' })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Писем пока нет')).not.toBeInTheDocument()
  })

  it('открывает письмо по тапу', async () => {
    const props = renderView()
    await userEvent.click(screen.getByText('Счёт за сентябрь'))
    expect(props.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'unread' }))
  })
})
