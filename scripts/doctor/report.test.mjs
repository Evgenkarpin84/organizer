import { describe, expect, it } from 'vitest'
import {
  TABLES,
  countLevels,
  envChecks,
  formatAge,
  formatIn,
  mailChecks,
  newsChecks,
  reminderChecks,
  renderReport,
  schedulerChecks,
  tableChecks,
} from './report.mjs'

const NOW = new Date('2026-09-25T10:00:00.000Z')
const minutesAgo = (minutes) => new Date(NOW.getTime() - minutes * 60_000).toISOString()

const FULL_ENV = {
  VITE_SUPABASE_URL: 'https://demo.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_demo',
  VITE_VAPID_PUBLIC_KEY: 'BPublicKey',
  SUPABASE_URL: 'https://demo.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_very_secret_value',
  OWNER_USER_ID: '00000000-0000-0000-0000-000000000001',
}

describe('время в отчёте', () => {
  it('говорит, как давно', () => {
    expect(formatAge(null, NOW)).toBe('никогда')
    expect(formatAge(minutesAgo(0), NOW)).toBe('только что')
    expect(formatAge(minutesAgo(25), NOW)).toBe('25 мин назад')
    expect(formatAge(minutesAgo(180), NOW)).toBe('3 ч назад')
    expect(formatAge(minutesAgo(60 * 72), NOW)).toBe('3 дн назад')
  })

  it('говорит, когда следующий запуск', () => {
    expect(formatIn(null, NOW)).toBe('не запланирован')
    expect(formatIn(minutesAgo(-6), NOW)).toBe('через 6 мин')
    expect(formatIn(minutesAgo(-120), NOW)).toBe('через 2 ч')
  })
})

describe('проверка .env', () => {
  it('всё заполнено — одна строка «на месте»', () => {
    const items = envChecks(FULL_ENV, { accountCount: 4 })
    expect(items.map((entry) => entry.level)).toEqual(['ok', 'ok'])
  })

  it('называет пустую переменную и подсказывает, где её взять', () => {
    const items = envChecks({ ...FULL_ENV, OWNER_USER_ID: '' }, { accountCount: 1 })
    const missing = items.find((entry) => entry.level === 'error')
    expect(missing.text).toContain('OWNER_USER_ID')
    expect(missing.hint).toContain('Authentication')
  })

  it('ловит публичный ключ вместо сервисного', () => {
    const items = envChecks({ ...FULL_ENV, SUPABASE_SERVICE_ROLE_KEY: 'sb_publishable_demo' }, { accountCount: 1 })
    expect(items.some((entry) => entry.level === 'error' && entry.text.includes('публичный ключ'))).toBe(true)
  })

  it('ловит секретный ключ в переменной VITE_ и не печатает его значение', () => {
    const env = { ...FULL_ENV, VITE_EXTRA: FULL_ENV.SUPABASE_SERVICE_ROLE_KEY }
    const items = envChecks(env, { accountCount: 1 })
    expect(items.some((entry) => entry.level === 'error' && entry.text.includes('VITE_EXTRA'))).toBe(true)
    expect(JSON.stringify(items)).not.toContain('very_secret')
  })

  it('передаёт ошибки настроек ящиков', () => {
    const items = envChecks(FULL_ENV, { accountCount: 0, accountErrors: ['MAIL_2_EMAIL: не задан адрес ящика'] })
    expect(items).toContainEqual({ level: 'error', text: 'MAIL_2_EMAIL: не задан адрес ящика', hint: null })
  })
})

describe('таблицы', () => {
  it('все на месте', () => {
    const results = TABLES.map(([table]) => ({ table, ok: true, count: 0 }))
    expect(tableChecks(results)).toEqual([{ level: 'ok', text: 'Таблицы: 11 из 11', hint: null }])
  })

  it('по отсутствующим таблицам называет миграцию', () => {
    const results = TABLES.map(([table]) => ({ table, ok: !table.startsWith('news_'), count: 0 }))
    const [entry] = tableChecks(results)
    expect(entry.level).toBe('error')
    expect(entry.text).toContain('news_sources')
    expect(entry.hint).toContain('0004')
  })
})

describe('напоминания', () => {
  it('401 без пароля — функция жива', () => {
    const items = reminderChecks({ functionStatus: 401, subscriptions: 1, upcoming: 2, lastSentAt: null, now: NOW })
    expect(items.every((entry) => entry.level === 'ok')).toBe(true)
  })

  it('404 — функция не задеплоена', () => {
    const [entry] = reminderChecks({ functionStatus: 404, subscriptions: 1, upcoming: 0, lastSentAt: null, now: NOW })
    expect(entry.level).toBe('error')
  })

  it('без подписок подсказывает включить уведомления на телефоне', () => {
    const items = reminderChecks({ functionStatus: 401, subscriptions: 0, upcoming: 0, lastSentAt: null, now: NOW })
    expect(items[1]).toMatchObject({ level: 'warn' })
    expect(items[1].hint).toContain('Включить уведомления')
  })
})

describe('почта', () => {
  it('свежий сбор без ошибок — порядок', () => {
    const [entry] = mailChecks([{ label: 'bk.ru', messages: 64, missingText: 0, lastSyncAt: minutesAgo(20), lastError: null }], NOW)
    expect(entry).toMatchObject({ level: 'ok', text: 'bk.ru: писем 64, сбор 20 мин назад' })
  })

  it('давно не собиралась — предупреждение с подсказкой про Планировщик', () => {
    const [entry] = mailChecks([{ label: 'bk.ru', messages: 64, missingText: 0, lastSyncAt: minutesAgo(300), lastError: null }], NOW)
    expect(entry.level).toBe('warn')
    expect(entry.hint).toContain('Органайзер — почта')
  })

  it('ошибка ящика — ошибка отчёта', () => {
    const [entry] = mailChecks(
      [{ label: 'Яндекс', messages: 0, missingText: 0, lastSyncAt: minutesAgo(5), lastError: 'не подошёл пароль приложения' }],
      NOW,
    )
    expect(entry.level).toBe('error')
    expect(entry.text).toContain('не подошёл пароль')
  })
})

describe('новости', () => {
  const source = (overrides) => ({ title: 'Лента', enabled: true, lastStatus: 'ok', lastError: null, lastFetchAt: minutesAgo(30), ...overrides })

  it('сводка и отдельная строка на каждую сломанную ленту', () => {
    const items = newsChecks({
      sources: [source(), source({ title: 'Oborot.ru', lastStatus: 'error', lastError: 'fetch failed' })],
      items: 450,
      unread: 400,
      now: NOW,
    })
    expect(items[0]).toMatchObject({ level: 'ok' })
    expect(items[0].text).toContain('Лент 2, публикаций 450, непрочитанных 400')
    expect(items[1]).toMatchObject({ level: 'warn', text: 'Oborot.ru: fetch failed' })
  })

  it('выключенные ленты не считаются', () => {
    const items = newsChecks({ sources: [source(), source({ enabled: false })], items: 1, unread: 0, now: NOW })
    expect(items[0].text).toContain('Лент 1')
  })
})

describe('Планировщик', () => {
  it('успешный запуск и время следующего', () => {
    const [entry] = schedulerChecks(
      [{ name: 'Органайзер — почта', found: true, lastRunAt: minutesAgo(24), lastResult: 0, nextRunAt: minutesAgo(-6) }],
      { now: NOW },
    )
    expect(entry).toMatchObject({ level: 'ok', text: '«Органайзер — почта»: последний запуск 24 мин назад, успешно; следующий через 6 мин' })
  })

  it('нет задания — подсказка со скриптом регистрации', () => {
    const [entry] = schedulerChecks([{ name: 'Органайзер — новости', found: false }], { now: NOW })
    expect(entry.level).toBe('error')
    expect(entry.hint).toContain('register-tasks.ps1')
  })

  it('код «ещё не запускалось» и «идёт сейчас» — не ошибки, прочий код — предупреждение', () => {
    const base = { name: 'Органайзер — почта', found: true, nextRunAt: null }
    expect(schedulerChecks([{ ...base, lastRunAt: null, lastResult: 267011 }], { now: NOW })[0].level).toBe('ok')
    expect(schedulerChecks([{ ...base, lastRunAt: minutesAgo(1), lastResult: 267009 }], { now: NOW })[0].level).toBe('ok')
    expect(schedulerChecks([{ ...base, lastRunAt: minutesAgo(1), lastResult: 1 }], { now: NOW })[0].level).toBe('warn')
  })

  it('не в Windows не проверяется', () => {
    expect(schedulerChecks([], { platform: 'linux', now: NOW })[0].level).toBe('warn')
  })
})

describe('отчёт целиком', () => {
  it('подсказки показывает только у проблем и подводит итог', () => {
    const sections = [
      { title: 'Раздел', items: [{ level: 'ok', text: 'хорошо', hint: 'не показывать' }, { level: 'warn', text: 'плохо', hint: 'сделай так' }] },
    ]
    const text = renderReport(sections, NOW)
    expect(text).toContain('  ✓ хорошо')
    expect(text).toContain('  ! плохо')
    expect(text).toContain('→ сделай так')
    expect(text).not.toContain('не показывать')
    expect(text).toContain('Ошибок: 0, предупреждений: 1')
    expect(countLevels(sections)).toEqual({ ok: 1, warn: 1, error: 0 })
  })

  it('без проблем пишет «Всё в порядке»', () => {
    expect(renderReport([{ title: 'Раздел', items: [{ level: 'ok', text: 'хорошо', hint: null }] }], NOW)).toContain('Всё в порядке')
  })
})
