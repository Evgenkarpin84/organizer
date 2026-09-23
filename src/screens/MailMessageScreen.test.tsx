import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { MailAccount, MailMessage } from '../lib/types'
import { MailMessageView } from './MailMessageScreen'

const ACCOUNT: MailAccount = {
  id: 'acc-1',
  key: 'mail1',
  label: 'Личная',
  email: 'a@bk.ru',
  provider: 'mailru',
  lastSyncAt: null,
  lastError: null,
}

function makeMessage(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    id: 'm1',
    accountId: 'acc-1',
    subject: 'Счёт за сентябрь',
    fromName: 'Бухгалтерия',
    fromEmail: 'buh@mail.ru',
    sentAt: null,
    receivedAt: new Date(2026, 8, 25, 12, 30).toISOString(),
    preview: 'Добрый день!',
    bodyText: 'Добрый день! Счёт во вложении.',
    bodyTruncated: false,
    hasAttachments: false,
    attachmentNames: [],
    isBulk: false,
    readAt: null,
    archivedAt: null,
    ...overrides,
  }
}

function renderView(message: MailMessage, overrides: Partial<Parameters<typeof MailMessageView>[0]> = {}) {
  const props = {
    message,
    account: ACCOUNT,
    accountIndex: 0,
    online: true,
    error: null,
    onBack: vi.fn(),
    onToggleRead: vi.fn(),
    onToggleArchive: vi.fn(),
    onCreateTask: vi.fn(),
    ...overrides,
  }
  render(<MailMessageView {...props} />)
  return props
}

describe('экран письма', () => {
  it('показывает тему, отправителя, ящик и текст', () => {
    renderView(makeMessage())
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Счёт за сентябрь')
    expect(screen.getByText('Бухгалтерия')).toBeInTheDocument()
    expect(screen.getByText('buh@mail.ru')).toBeInTheDocument()
    expect(screen.getByText('Личная')).toBeInTheDocument()
    expect(screen.getByText('Добрый день! Счёт во вложении.')).toBeInTheDocument()
  })

  it('предупреждает об обрезанном тексте', () => {
    renderView(makeMessage({ bodyTruncated: true }))
    expect(screen.getByRole('status')).toHaveTextContent('сохранён не полностью')
  })

  it('объясняет пустое тело письма вместо пустой карточки', () => {
    renderView(makeMessage({ bodyText: '', bodyTruncated: true }))
    expect(screen.getByText(/Текст письма не сохранён/)).toBeInTheDocument()
  })

  it('показывает имена вложений и что файлы не скачиваются', () => {
    renderView(makeMessage({ hasAttachments: true, attachmentNames: ['счёт.pdf'] }))
    expect(screen.getByText('счёт.pdf')).toBeInTheDocument()
    expect(screen.getByText(/Файлы не скачиваются/)).toBeInTheDocument()
  })

  it('переключает прочитано и архив по одному вызову', async () => {
    const props = renderView(makeMessage())
    await userEvent.click(screen.getByRole('button', { name: 'Отметить письмо прочитанным' }))
    expect(props.onToggleRead).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: /В архив/ }))
    expect(props.onToggleArchive).toHaveBeenCalledTimes(1)
  })

  it('у прочитанного и архивного письма подписи кнопок обратные', () => {
    renderView(makeMessage({ readAt: new Date().toISOString(), archivedAt: new Date().toISOString() }))
    expect(screen.getByRole('button', { name: 'Отметить письмо непрочитанным' })).toHaveTextContent('Непрочитано')
    expect(screen.getByRole('button', { name: /Из архива/ })).toBeInTheDocument()
  })

  it('создаёт задачу и умеет вернуться назад', async () => {
    const props = renderView(makeMessage())
    await userEvent.click(screen.getByRole('button', { name: 'Создать задачу' }))
    expect(props.onCreateTask).toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
    expect(props.onBack).toHaveBeenCalled()
  })

  it('без сети действия недоступны', () => {
    renderView(makeMessage(), { online: false })
    expect(screen.getByRole('button', { name: /Отметить письмо/ })).toBeDisabled()
    expect(screen.getByText('Нет сети — попробуйте позже')).toBeInTheDocument()
  })

  it('показывает ошибку действия', () => {
    renderView(makeMessage(), { error: 'Не удалось изменить письмо. Попробуйте ещё раз.' })
    expect(screen.getByText(/Не удалось изменить письмо/)).toBeInTheDocument()
  })
})
