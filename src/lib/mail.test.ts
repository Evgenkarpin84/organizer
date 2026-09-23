import { describe, expect, it } from 'vitest'
import {
  draftFromMail,
  filterMessages,
  formatMailDate,
  groupByAccount,
  groupByDate,
  senderLabel,
  subjectOrFallback,
  unreadCount,
} from './mail'
import type { MailAccount, MailMessage } from './types'

const TODAY = '2026-09-25'

function makeMessage(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    id: 'm1',
    accountId: 'acc-1',
    subject: 'Счёт за сентябрь',
    fromName: 'Бухгалтерия',
    fromEmail: 'buh@mail.ru',
    sentAt: '2026-09-25T09:00:00.000Z',
    receivedAt: new Date(2026, 8, 25, 12, 30).toISOString(),
    preview: 'Добрый день! Счёт во вложении.',
    bodyText: 'Добрый день! Счёт во вложении.',
    bodyTruncated: false,
    hasAttachments: true,
    attachmentNames: ['счёт.pdf'],
    isBulk: false,
    readAt: null,
    archivedAt: null,
    ...overrides,
  }
}

const ACCOUNTS: MailAccount[] = [
  { id: 'acc-1', key: 'mail1', label: 'Личная', email: 'a@bk.ru', provider: 'mailru', lastSyncAt: null, lastError: null },
  { id: 'acc-2', key: 'mail4', label: 'Яндекс', email: 'b@ya.ru', provider: 'yandex', lastSyncAt: null, lastError: null },
]

describe('подписи письма', () => {
  it('берёт имя отправителя, иначе адрес', () => {
    expect(senderLabel(makeMessage())).toBe('Бухгалтерия')
    expect(senderLabel(makeMessage({ fromName: null }))).toBe('buh@mail.ru')
    expect(senderLabel(makeMessage({ fromName: null, fromEmail: null }))).toBe('Отправитель неизвестен')
  })

  it('подставляет заглушку вместо пустой темы', () => {
    expect(subjectOrFallback(makeMessage({ subject: '   ' }))).toBe('Письмо без темы')
  })

  it('показывает время у сегодняшних писем и дату у остальных', () => {
    expect(formatMailDate(makeMessage().receivedAt, TODAY)).toBe('12:30')
    expect(formatMailDate(new Date(2026, 8, 24, 10, 0).toISOString(), TODAY)).toBe('Вчера')
    expect(formatMailDate(new Date(2026, 8, 15, 10, 0).toISOString(), TODAY)).toContain('15')
  })
})

describe('фильтры списка', () => {
  // Порядок в списке — по времени получения, поэтому у писем разное время.
  const messages = [
    makeMessage({ id: 'unread', receivedAt: new Date(2026, 8, 25, 12, 30).toISOString() }),
    makeMessage({ id: 'read', readAt: '2026-09-25T10:00:00.000Z', receivedAt: new Date(2026, 8, 25, 11, 0).toISOString() }),
    makeMessage({ id: 'archived', archivedAt: '2026-09-25T10:00:00.000Z', receivedAt: new Date(2026, 8, 25, 10, 0).toISOString() }),
    makeMessage({ id: 'other-account', accountId: 'acc-2', receivedAt: new Date(2026, 8, 25, 9, 0).toISOString() }),
  ]

  it('«Все» не показывает архив', () => {
    expect(filterMessages(messages, 'all').map((message) => message.id)).toEqual(['unread', 'read', 'other-account'])
  })

  it('«Непрочитанные» оставляет только без отметки', () => {
    expect(filterMessages(messages, 'unread').map((message) => message.id)).toEqual(['unread', 'other-account'])
  })

  it('«Архив» показывает только архивные', () => {
    expect(filterMessages(messages, 'archived').map((message) => message.id)).toEqual(['archived'])
  })

  it('фильтрует по ящику', () => {
    expect(filterMessages(messages, 'all', 'acc-2').map((message) => message.id)).toEqual(['other-account'])
  })

  it('считает непрочитанные без архива', () => {
    expect(unreadCount(messages)).toBe(2)
  })
})

describe('группировка', () => {
  it('по дате: сегодня, вчера, затем дата', () => {
    const groups = groupByDate(
      [
        makeMessage({ id: 'today' }),
        makeMessage({ id: 'yesterday', receivedAt: new Date(2026, 8, 24, 9, 0).toISOString() }),
        makeMessage({ id: 'older', receivedAt: new Date(2026, 8, 15, 9, 0).toISOString() }),
      ],
      TODAY,
    )
    expect(groups.map((group) => group.title)).toEqual(['Сегодня', 'Вчера', '15 сентября'])
    expect(groups[0].messages[0].id).toBe('today')
  })

  it('по ящику: заголовок — метка ящика', () => {
    const groups = groupByAccount([makeMessage(), makeMessage({ id: 'm2', accountId: 'acc-2' })], ACCOUNTS)
    expect(groups.map((group) => group.title)).toEqual(['Личная', 'Яндекс'])
  })
})

describe('задача из письма', () => {
  it('переносит тему в название, отправителя и текст в заметку', () => {
    const draft = draftFromMail(makeMessage())
    expect(draft.title).toBe('Счёт за сентябрь')
    expect(draft.note).toContain('buh@mail.ru')
    expect(draft.note).toContain('Счёт во вложении')
    expect(draft.dueDate).toBeNull()
    expect(draft.remindOffsetMinutes).toBeNull()
  })

  it('для письма без темы подставляет отправителя', () => {
    expect(draftFromMail(makeMessage({ subject: null })).title).toBe('Письмо от Бухгалтерия')
  })

  it('обрезает длинный текст письма', () => {
    const draft = draftFromMail(makeMessage({ bodyText: 'я'.repeat(2000) }))
    expect(draft.note?.length).toBeLessThan(600)
  })
})
