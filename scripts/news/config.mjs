// Настройки сбора новостей: чистые функции без сети и файловой системы.

export const TOPICS = [
  { key: 'ozon', title: 'Ozon для продавца' },
  { key: 'cars', title: 'Китайские автомобили' },
  { key: 'gadgets', title: 'Смартфоны и гаджеты' },
  { key: 'print3d', title: '3D-печать' },
  { key: 'cinema', title: 'Кино и сериалы' },
  { key: 'ai', title: 'ИИ и технологии' },
  { key: 'finance', title: 'Экономика и финансы' },
  { key: 'world', title: 'Мир и политика' },
]

export const TOPIC_KEYS = TOPICS.map((topic) => topic.key)
export const DEFAULT_BACKFILL_DAYS = 7
export const DEFAULT_MAX_PER_SOURCE = 30

/** Источники из sources.json: проверка и сортировка по порядку тем. */
export function parseSources(config) {
  const errors = []
  const sources = []
  const seenKeys = new Set()
  const seenFeeds = new Set()

  const list = Array.isArray(config?.sources) ? config.sources : null
  if (!list) {
    return { sources: [], errors: ['sources.json: ожидается объект с массивом «sources»'] }
  }

  for (const [index, entry] of list.entries()) {
    const where = entry?.key ? `источник «${entry.key}»` : `источник №${index + 1}`

    if (!entry?.key) {
      errors.push(`${where}: не задан ключ key`)
      continue
    }
    if (seenKeys.has(entry.key)) {
      errors.push(`${where}: ключ повторяется`)
      continue
    }
    if (!TOPIC_KEYS.includes(entry.topic)) {
      errors.push(`${where}: неизвестная тема «${entry.topic ?? ''}», ожидается одна из: ${TOPIC_KEYS.join(', ')}`)
      continue
    }
    if (!entry.title || !String(entry.title).trim()) {
      errors.push(`${where}: не задано название title`)
      continue
    }
    if (!/^https?:\/\//i.test(entry.feedUrl ?? '')) {
      errors.push(`${where}: адрес ленты должен начинаться с http:// или https://`)
      continue
    }
    if (seenFeeds.has(entry.feedUrl)) {
      errors.push(`${where}: адрес ленты повторяется`)
      continue
    }

    seenKeys.add(entry.key)
    seenFeeds.add(entry.feedUrl)

    if (entry.enabled === false) continue

    sources.push({
      key: String(entry.key),
      topic: entry.topic,
      title: String(entry.title).trim(),
      feedUrl: String(entry.feedUrl),
      include: Array.isArray(entry.include) ? entry.include.map((word) => String(word).toLowerCase()) : [],
    })
  }

  sources.sort((a, b) => TOPIC_KEYS.indexOf(a.topic) - TOPIC_KEYS.indexOf(b.topic))
  return { sources, errors }
}

export function parseArgs(argv) {
  const options = { check: false, dryRun: false, source: null, topic: null, limit: null, verbose: false, errors: [] }

  for (const arg of argv) {
    if (arg === '--check') options.check = true
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--verbose') options.verbose = true
    else if (arg.startsWith('--source=')) {
      const value = arg.slice('--source='.length).trim()
      if (!value) options.errors.push('--source=: не указан ключ источника')
      else options.source = value
    } else if (arg.startsWith('--topic=')) {
      const value = arg.slice('--topic='.length).trim()
      if (!TOPIC_KEYS.includes(value)) options.errors.push(`--topic: неизвестная тема «${value}»`)
      else options.topic = value
    } else if (arg.startsWith('--limit=')) {
      const value = Number(arg.slice('--limit='.length))
      if (!Number.isFinite(value) || value <= 0) options.errors.push(`--limit: ожидается положительное число, получено «${arg}»`)
      else options.limit = Math.floor(value)
    } else {
      options.errors.push(`Неизвестный аргумент «${arg}»`)
    }
  }

  return options
}

export function readOptions(env) {
  const errors = []
  const supabaseUrl = (env.SUPABASE_URL ?? '').trim()
  const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  const ownerUserId = (env.OWNER_USER_ID ?? '').trim()

  if (!supabaseUrl) errors.push('SUPABASE_URL: не задан адрес проекта Supabase')
  if (!serviceRoleKey) errors.push('SUPABASE_SERVICE_ROLE_KEY: не задан сервисный ключ')
  if (!ownerUserId) errors.push('OWNER_USER_ID: не задан идентификатор владельца')

  return {
    supabaseUrl,
    serviceRoleKey,
    ownerUserId,
    backfillDays: positiveNumber(env.NEWS_BACKFILL_DAYS, DEFAULT_BACKFILL_DAYS),
    maxPerSource: positiveNumber(env.NEWS_MAX_PER_SOURCE, DEFAULT_MAX_PER_SOURCE),
    errors,
  }
}

function positiveNumber(raw, fallback) {
  const value = Number((raw ?? '').toString().trim())
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

export function topicTitle(key) {
  return TOPICS.find((topic) => topic.key === key)?.title ?? key
}
