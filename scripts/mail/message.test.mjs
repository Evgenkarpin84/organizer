import { describe, expect, it } from 'vitest'
import {
  attachmentNames,
  buildMessageRow,
  dedupeKey,
  fetchRange,
  htmlToPlainText,
  isBulk,
  parseHeaderLines,
  pickTextPart,
  selectUids,
  textPartStatus,
} from './message.mjs'

describe('ключ дедупликации', () => {
  it('берёт Message-ID без скобок и в нижнем регистре', () => {
    expect(dedupeKey({ messageId: '<ABC@Mail.RU>', accountKey: 'mail1', uid: 5 })).toBe('abc@mail.ru')
  })

  it('без Message-ID считает отпечаток и он устойчив', () => {
    const input = { accountKey: 'mail1', uid: 7, receivedAt: '2026-09-20T10:00:00.000Z', subject: 'Счёт' }
    const first = dedupeKey(input)
    expect(first).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(dedupeKey(input)).toBe(first)
    expect(dedupeKey({ ...input, uid: 8 })).not.toBe(first)
  })
})

describe('диапазон выборки', () => {
  const now = new Date('2026-09-25T12:00:00.000Z')

  it('продолжает с последнего UID, когда ящик тот же', () => {
    const range = fetchRange({ uidValidity: '100', lastUid: 42 }, { mailboxUidValidity: 100, now })
    expect(range).toMatchObject({ mode: 'uid', range: '43:*', reset: false })
  })

  it('на первом запуске берёт окно в 30 дней', () => {
    const range = fetchRange(null, { mailboxUidValidity: 100, backfillDays: 30, now })
    expect(range.mode).toBe('since')
    expect(range.since.toISOString()).toBe('2026-08-26T12:00:00.000Z')
  })

  it('сбрасывает состояние при смене uid_validity', () => {
    const range = fetchRange({ uidValidity: '100', lastUid: 42 }, { mailboxUidValidity: 777, backfillDays: 7, now })
    expect(range).toMatchObject({ mode: 'since', reset: true })
  })
})

describe('выбор текстовой части', () => {
  const structure = {
    type: 'multipart/mixed',
    childNodes: [
      {
        type: 'multipart/alternative',
        childNodes: [
          { part: '1.1', type: 'text/plain', size: 1200, encoding: 'quoted-printable' },
          { part: '1.2', type: 'text/html', size: 4000, encoding: 'base64' },
        ],
      },
      { part: '2', type: 'application/pdf', size: 90000, disposition: 'attachment', dispositionParameters: { filename: 'счёт.pdf' } },
    ],
  }

  it('предпочитает text/plain', () => {
    expect(pickTextPart(structure)).toMatchObject({ part: '1.1', type: 'text/plain' })
  })

  it('берёт html, когда plain нет', () => {
    const htmlOnly = { type: 'multipart/mixed', childNodes: [{ part: '1', type: 'text/html', size: 500 }] }
    expect(pickTextPart(htmlOnly)).toMatchObject({ part: '1', type: 'text/html' })
  })

  it('пропускает вложения и слишком большие части', () => {
    const huge = { type: 'multipart/mixed', childNodes: [{ part: '1', type: 'text/plain', size: 300 * 1024 }] }
    expect(pickTextPart(huge)).toBeNull()
    expect(textPartStatus(huge).reason).toBe('too-large')

    const onlyAttachment = {
      type: 'multipart/mixed',
      childNodes: [{ part: '1', type: 'text/plain', size: 10, disposition: 'attachment', dispositionParameters: { filename: 'a.txt' } }],
    }
    expect(textPartStatus(onlyAttachment).reason).toBe('none')
  })

  it('собирает имена вложений, не больше десяти', () => {
    expect(attachmentNames(structure)).toEqual(['счёт.pdf'])
    const many = {
      childNodes: Array.from({ length: 15 }, (_, index) => ({
        part: String(index),
        type: 'application/pdf',
        disposition: 'attachment',
        dispositionParameters: { filename: `file-${index}.pdf` },
      })),
    }
    expect(attachmentNames(many)).toHaveLength(10)
  })
})

describe('html в текст', () => {
  it('вырезает скрипты, стили и теги', () => {
    const html = '<style>b{}</style><script>alert(1)</script><p>Привет,&nbsp;мир</p><br><div>Вторая строка</div>'
    expect(htmlToPlainText(html)).toBe('Привет, мир\nВторая строка')
  })

  it('разворачивает сущности', () => {
    expect(htmlToPlainText('<p>&laquo;Тест&raquo; &amp; ещё</p>')).toBe('«Тест» & ещё')
  })
})

describe('рассылки и заголовки', () => {
  it('узнаёт рассылку по заголовкам', () => {
    expect(isBulk({ 'List-Unsubscribe': '<mailto:a@b.c>' })).toBe(true)
    expect(isBulk({ 'list-id': 'news' })).toBe(true)
    expect(isBulk({ Precedence: 'bulk' })).toBe(true)
    expect(isBulk({ Subject: 'Привет' })).toBe(false)
  })

  it('разбирает сырые строки заголовков со склейкой', () => {
    const raw = 'List-Id: новости\r\nSubject: Длинная\r\n тема письма\r\n'
    expect(parseHeaderLines(raw)).toMatchObject({ 'list-id': 'новости', subject: 'Длинная тема письма' })
  })
})

describe('строка письма для базы', () => {
  const base = {
    userId: 'user-1',
    accountId: 'account-1',
    accountKey: 'mail1',
    uid: 12,
    envelope: {
      messageId: '<letter-1@mail.ru>',
      subject: 'Счёт за сентябрь',
      from: [{ name: 'Бухгалтерия', address: 'Buh@Mail.ru' }],
      to: [{ address: 'me@bk.ru' }],
      date: new Date('2026-09-20T09:00:00.000Z'),
    },
    internalDate: new Date('2026-09-20T09:00:05.000Z'),
    flags: ['\\Seen'],
    size: 4096,
    headers: {},
    text: 'Добрый день! Счёт во вложении.',
    bodyStructure: {
      childNodes: [
        { part: '1', type: 'text/plain', size: 100 },
        { part: '2', type: 'application/pdf', disposition: 'attachment', dispositionParameters: { filename: 'счёт.pdf' } },
      ],
    },
    nowIso: '2026-09-25T12:00:00.000Z',
  }

  it('собирает поля письма', () => {
    const row = buildMessageRow(base)
    expect(row).toMatchObject({
      user_id: 'user-1',
      account_id: 'account-1',
      uid: 12,
      dedupe_key: 'letter-1@mail.ru',
      subject: 'Счёт за сентябрь',
      from_name: 'Бухгалтерия',
      from_email: 'buh@mail.ru',
      to_emails: ['me@bk.ru'],
      has_attachments: true,
      attachment_names: ['счёт.pdf'],
      is_bulk: false,
      body_truncated: false,
      read_at: '2026-09-25T12:00:00.000Z',
    })
    expect(row.received_at).toBe('2026-09-20T09:00:05.000Z')
    expect(row.preview).toContain('Счёт во вложении')
  })

  it('обрезает обычное письмо до 2000 символов, рассылку — до 500', () => {
    const long = 'а'.repeat(5000)
    const normal = buildMessageRow({ ...base, text: long })
    expect(normal.body_text).toHaveLength(2000)
    expect(normal.body_truncated).toBe(true)

    const bulk = buildMessageRow({ ...base, text: long, headers: { 'List-Id': 'news' } })
    expect(bulk.body_text).toHaveLength(500)
    expect(bulk.is_bulk).toBe(true)
  })

  it('не хранит текст слишком большой части и объясняет это в превью', () => {
    const row = buildMessageRow({ ...base, text: '', textReason: 'too-large' })
    expect(row.body_text).toBe('')
    expect(row.preview).toContain('слишком большой')
    expect(row.body_truncated).toBe(true)
  })

  it('непрочитанное письмо приходит без отметки о прочтении', () => {
    expect(buildMessageRow({ ...base, flags: [] }).read_at).toBeNull()
  })
})

describe('отбор писем из найденных', () => {
  it('берёт старые первыми и не больше предела', () => {
    expect(selectUids([30, 10, 20, 40], { mode: 'since', limit: 2 })).toEqual([10, 20])
  })

  it('в режиме по UID отсекает уже забранное, даже если сервер вернул последнее письмо', () => {
    expect(selectUids([42], { mode: 'uid', lastUid: 42, limit: 200 })).toEqual([])
    expect(selectUids([42, 43, 44], { mode: 'uid', lastUid: 42, limit: 200 })).toEqual([43, 44])
  })

  it('убирает повторы и переживает пустой ответ поиска', () => {
    expect(selectUids([5, 5, '6'], { mode: 'since', limit: 10 })).toEqual([5, 6])
    expect(selectUids(false, { mode: 'since', limit: 10 })).toEqual([])
  })
})
