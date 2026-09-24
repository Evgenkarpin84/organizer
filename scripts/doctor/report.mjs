// Отчёт «npm run doctor»: чистые функции без сети. Значения секретов в текст не попадают никогда.

export const MARKS = { ok: '✓', warn: '!', error: '✗' }

// Сбор почты идёт каждые 30 минут, новостей — каждые 2 часа: с запасом на сон компьютера.
export const MAIL_STALE_HOURS = 2
export const NEWS_STALE_HOURS = 6

// Коды Планировщика Windows, которые не означают ошибку.
const TASK_RUNNING = 267009
const TASK_NOT_RUN_YET = 267011

const REQUIRED_ENV = [
  ['VITE_SUPABASE_URL', 'адрес проекта для приложения'],
  ['VITE_SUPABASE_PUBLISHABLE_KEY', 'публичный ключ для приложения'],
  ['VITE_VAPID_PUBLIC_KEY', 'ключ push-уведомлений — npm run vapid'],
  ['SUPABASE_URL', 'адрес проекта для скриптов'],
  ['SUPABASE_SERVICE_ROLE_KEY', 'сервисный ключ — Project Settings → API Keys'],
  ['OWNER_USER_ID', 'ID владельца — Authentication → Users'],
]

/** Таблицы и миграции, которые их создают: по отсутствующей таблице видно, что не применено. */
export const TABLES = [
  ['lists', '0001'],
  ['tasks', '0001'],
  ['push_subscriptions', '0002'],
  ['mail_accounts', '0003'],
  ['mail_messages', '0003'],
  ['news_sources', '0004'],
  ['news_items', '0004'],
  ['habits', '0005'],
  ['habit_entries', '0005'],
  ['checklists', '0005'],
  ['checklist_items', '0005'],
]

const item = (level, text, hint = null) => ({ level, text, hint })

export function formatAge(iso, now = new Date()) {
  if (!iso) return 'никогда'
  const minutes = Math.round((now.getTime() - Date.parse(iso)) / 60_000)
  if (minutes < 1) return 'только что'
  if (minutes < 60) return `${minutes} мин назад`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} ч назад`
  return `${Math.round(hours / 24)} дн назад`
}

export function formatIn(iso, now = new Date()) {
  if (!iso) return 'не запланирован'
  const minutes = Math.round((Date.parse(iso) - now.getTime()) / 60_000)
  if (minutes < 1) return 'сейчас'
  if (minutes < 60) return `через ${minutes} мин`
  return `через ${Math.round(minutes / 60)} ч`
}

function hoursSince(iso, now) {
  return iso ? (now.getTime() - Date.parse(iso)) / 3_600_000 : Infinity
}

/** Переменные .env. Секретный ключ в переменной VITE_ опасен: такие переменные попадают в сайт. */
export function envChecks(env, { accountCount = 0, accountErrors = [] } = {}) {
  const items = []
  const value = (name) => String(env[name] ?? '').trim()

  const missing = REQUIRED_ENV.filter(([name]) => !value(name))
  if (missing.length === 0) items.push(item('ok', 'Все переменные на месте'))
  for (const [name, what] of missing) items.push(item('error', `Пустая переменная ${name}`, what))

  const service = value('SUPABASE_SERVICE_ROLE_KEY')
  if (service.startsWith('sb_publishable_')) {
    items.push(item('error', 'В SUPABASE_SERVICE_ROLE_KEY лежит публичный ключ', 'нужен секретный: sb_secret_… или service_role'))
  }

  const leaked = Object.keys(env).filter(
    (name) => name.startsWith('VITE_') && (value(name).startsWith('sb_secret_') || (service && value(name) === service)),
  )
  for (const name of leaked) {
    items.push(item('error', `Секретный ключ в ${name} — он попадёт в сайт`, 'убери его оттуда и перевыпусти ключ в Supabase'))
  }

  if (value('VITE_SUPABASE_URL') && value('SUPABASE_URL') && value('VITE_SUPABASE_URL') !== value('SUPABASE_URL')) {
    items.push(item('warn', 'Адреса проекта для приложения и для скриптов различаются', 'VITE_SUPABASE_URL и SUPABASE_URL должны совпадать'))
  }

  if (accountErrors.length > 0) {
    for (const message of accountErrors) items.push(item('error', message))
  } else if (accountCount === 0) {
    items.push(item('warn', 'Не настроено ни одного почтового ящика', 'MAIL_1_* … в .env'))
  } else {
    items.push(item('ok', `Почтовых ящиков: ${accountCount}`))
  }
  return items
}

/** results: [{ table, ok, count }] в порядке TABLES. */
export function tableChecks(results) {
  const failed = results.filter((result) => !result.ok)
  if (failed.length === 0) return [item('ok', `Таблицы: ${results.length} из ${results.length}`)]

  const migrations = [...new Set(failed.map((result) => TABLES.find(([table]) => table === result.table)?.[1]).filter(Boolean))]
  return [
    item(
      'error',
      `Нет таблиц: ${failed.map((result) => result.table).join(', ')}`,
      `примени миграции ${migrations.join(', ')} — ЗАПУСК.md, шаг 1`,
    ),
  ]
}

export function reminderChecks({ functionStatus, subscriptions, upcoming, lastSentAt, now = new Date() }) {
  const items = []
  if (functionStatus === 401) items.push(item('ok', 'Функция send-reminders отвечает'))
  else if (functionStatus === 404) items.push(item('error', 'Функция send-reminders не задеплоена', 'ЗАПУСК.md, шаг 2.5'))
  else items.push(item('warn', `Функция send-reminders ответила ${functionStatus || 'ошибкой сети'}`, 'Supabase → Edge Functions → send-reminders → Logs'))

  if (subscriptions > 0) items.push(item('ok', `Устройств с уведомлениями: ${subscriptions}`))
  else items.push(item('warn', 'Уведомления не включены ни на одном устройстве', 'на телефоне: шестерёнка → «Включить уведомления»'))

  items.push(item('ok', `Впереди напоминаний: ${upcoming}; последнее отправлено: ${formatAge(lastSentAt, now)}`))
  return items
}

/** accounts: [{ label, messages, missingText, lastSyncAt, lastError }]. */
export function mailChecks(accounts, now = new Date()) {
  if (accounts.length === 0) {
    return [item('warn', 'Ни один ящик ещё не собирался', 'npm run mail')]
  }
  return accounts.map((account) => {
    const base = `${account.label}: писем ${account.messages}, сбор ${formatAge(account.lastSyncAt, now)}`
    // Сюда попадают и письма совсем без текстовой части, поэтому это факт, а не ошибка.
    const noText = account.missingText > 0 ? `, без текста ${account.missingText}` : ''
    if (account.lastError) return item('error', `${base} — ${account.lastError}`, 'пароль приложения и IMAP в настройках ящика')
    if (hoursSince(account.lastSyncAt, now) > MAIL_STALE_HOURS) {
      return item('warn', base + noText, 'задание «Органайзер — почта» и logs\\mail.log')
    }
    return item('ok', base + noText)
  })
}

/** sources: [{ title, enabled, lastStatus, lastError, lastFetchAt }]. */
export function newsChecks({ sources, items: total, unread, now = new Date() }) {
  const enabled = sources.filter((source) => source.enabled !== false)
  if (enabled.length === 0) return [item('warn', 'Ни одна лента ещё не собиралась', 'npm run news')]

  const lastFetch = enabled.map((source) => source.lastFetchAt).filter(Boolean).sort().at(-1) ?? null
  const broken = enabled.filter((source) => source.lastStatus === 'error')
  const summary = `Лент ${enabled.length}, публикаций ${total}, непрочитанных ${unread}, сбор ${formatAge(lastFetch, now)}`

  const result = [
    hoursSince(lastFetch, now) > NEWS_STALE_HOURS
      ? item('warn', summary, 'задание «Органайзер — новости» и logs\\news.log')
      : item('ok', summary),
  ]
  for (const source of broken) {
    result.push(item('warn', `${source.title}: ${source.lastError ?? 'ошибка'}`, 'разовый сбой пройдёт сам; если держится — адрес ленты в scripts/news/sources.json'))
  }
  return result
}

export function habitChecks({ habits, checklists }) {
  return [item('ok', `Привычек ${habits}, чеклистов ${checklists}`)]
}

/** tasks: [{ name, found, lastRunAt, lastResult, nextRunAt }]; platform — process.platform. */
export function schedulerChecks(tasks, { platform = 'win32', now = new Date() } = {}) {
  if (platform !== 'win32') return [item('warn', 'Планировщик проверяется только в Windows')]

  return tasks.map((task) => {
    if (!task.found) {
      return item('error', `Нет задания «${task.name}»`, 'pwsh -File scripts\\register-tasks.ps1')
    }
    const next = formatIn(task.nextRunAt, now)
    if (task.lastResult === TASK_NOT_RUN_YET || !task.lastRunAt) {
      return item('ok', `«${task.name}»: ещё не запускалось, следующий запуск ${next}`)
    }
    const last = `последний запуск ${formatAge(task.lastRunAt, now)}`
    if (task.lastResult === 0 || task.lastResult === TASK_RUNNING) {
      const state = task.lastResult === TASK_RUNNING ? 'идёт сейчас' : 'успешно'
      return item('ok', `«${task.name}»: ${last}, ${state}; следующий ${next}`)
    }
    return item('warn', `«${task.name}»: ${last}, код ${task.lastResult}; следующий ${next}`, 'подробности в журнале в папке logs')
  })
}

/** sections: [{ title, items }]. */
export function renderReport(sections, now = new Date()) {
  const lines = [`Органайзер — проверка состояния, ${now.toLocaleString('ru-RU')}`]
  for (const section of sections) {
    lines.push('', section.title)
    for (const entry of section.items) {
      lines.push(`  ${MARKS[entry.level]} ${entry.text}`)
      if (entry.hint && entry.level !== 'ok') lines.push(`      → ${entry.hint}`)
    }
  }
  const counts = countLevels(sections)
  lines.push('', counts.error > 0 || counts.warn > 0 ? `Ошибок: ${counts.error}, предупреждений: ${counts.warn}` : 'Всё в порядке')
  return lines.join('\n')
}

export function countLevels(sections) {
  const counts = { ok: 0, warn: 0, error: 0 }
  for (const section of sections) for (const entry of section.items) counts[entry.level] += 1
  return counts
}
