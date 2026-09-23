// Сбор новостей по лентам. Запуск: npm run news [-- --check | --dry-run | --topic=ai | --source=4pda]
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { parseArgs, parseSources, readOptions, topicTitle, TOPICS } from './news/config.mjs'
import { buildItemRow, decodeBody, matchesKeywords, parseFeed, selectItems } from './news/feed.mjs'
import { loadSources, saveSourceState, upsertItems } from './news/store.mjs'

const SOURCES_PATH = resolve(dirname(fileURLToPath(import.meta.url)), 'news', 'sources.json')
const REQUEST_TIMEOUT_MS = 15_000
const MAX_BODY_BYTES = 2 * 1024 * 1024

function fail(message) {
  console.error(message)
  process.exitCode = 1
}

function describeFetchError(error) {
  const text = String(error?.message ?? error).toLowerCase()
  if (text.includes('timeout') || text.includes('aborted')) return 'лента не ответила вовремя'
  if (text.includes('enotfound') || text.includes('getaddrinfo')) return 'сервер ленты не найден'
  if (text.includes('econnrefused')) return 'сервер отказал в подключении'
  if (text.includes('certificate')) return 'проблема с сертификатом сервера'
  return String(error?.message ?? error)
}

async function loadFeed(source, state) {
  const headers = {
    'User-Agent': 'organizer-news/1.0',
    Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8',
  }
  if (state?.http_etag) headers['If-None-Match'] = state.http_etag
  if (state?.http_last_modified) headers['If-Modified-Since'] = state.http_last_modified

  const response = await fetch(source.feedUrl, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })

  if (response.status === 304) {
    return { notModified: true, items: [], etag: state?.http_etag ?? null, lastModified: state?.http_last_modified ?? null }
  }
  if (!response.ok) {
    throw new Error(response.status === 404 ? 'лента не найдена (404)' : `сервер ответил ${response.status}`)
  }

  // Предел читаем до загрузки: сломанная лента не должна съесть память фонового задания.
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) {
    await response.body?.cancel()
    throw new Error('лента слишком большая')
  }

  const chunks = []
  let received = 0
  for await (const chunk of response.body) {
    received += chunk.length
    if (received > MAX_BODY_BYTES) {
      await response.body.cancel()
      throw new Error('лента слишком большая')
    }
    chunks.push(chunk)
  }

  const buffer = Buffer.concat(chunks)
  const text = decodeBody(buffer, response.headers.get('content-type') ?? '')
  const parsed = parseFeed(text, { feedUrl: source.feedUrl })
  if (parsed.error) throw new Error(parsed.error)

  return {
    notModified: false,
    items: parsed.items,
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
  }
}

async function syncSource({ client, source, sourceRow, options, runtime, nowIso }) {
  const feed = await loadFeed(source, sourceRow)
  const matched = feed.items.filter((item) => matchesKeywords(item, source.include))
  const selected = selectItems(matched, {
    now: new Date(nowIso),
    backfillDays: runtime.backfillDays,
    maxPerSource: options.limit ?? runtime.maxPerSource,
  })

  const rows = selected.map((item) =>
    buildItemRow({
      userId: runtime.ownerUserId,
      sourceId: sourceRow?.id ?? null,
      topic: source.topic,
      item,
      nowIso,
    }),
  )

  const result = await upsertItems(client, rows, { dryRun: options.dryRun })
  await saveSourceState(client, {
    sourceId: sourceRow?.id ?? null,
    status: 'ok',
    error: null,
    itemCount: rows.length,
    etag: feed.etag,
    lastModified: feed.lastModified,
    nowIso,
    dryRun: options.dryRun,
  })

  return { received: feed.items.length, selected: rows.length, notModified: feed.notModified, ...result }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.errors.length > 0) {
    options.errors.forEach(fail)
    return
  }

  let config
  try {
    config = JSON.parse(readFileSync(SOURCES_PATH, 'utf8'))
  } catch (cause) {
    fail(`Не удалось прочитать scripts/news/sources.json: ${cause?.message ?? cause}`)
    return
  }

  const { sources, errors } = parseSources(config)
  if (errors.length > 0) {
    console.error('Проблемы в списке источников:')
    errors.forEach((message) => console.error(`  ${message}`))
    process.exitCode = 1
    return
  }

  const selected = sources.filter(
    (source) =>
      (!options.source || source.key === options.source) && (!options.topic || source.topic === options.topic),
  )
  if (selected.length === 0) {
    fail('Под заданные условия не подошёл ни один источник')
    return
  }

  if (options.check) {
    console.log('Источники новостей:')
    for (const topic of TOPICS) {
      const list = selected.filter((source) => source.topic === topic.key)
      if (list.length === 0) continue
      console.log(`  ${topic.title}:`)
      for (const source of list) console.log(`    ${source.key}  ${source.title}  ${source.feedUrl}`)
    }
    console.log(`Всего источников: ${selected.length}, тем: ${new Set(selected.map((s) => s.topic)).size}.`)
    console.log('Настройки прочитаны, обращений к сети не было.')
    return
  }

  try {
    process.loadEnvFile()
  } catch {
    fail('Не найден файл .env — скопируйте .env.example и заполните переменные.')
    return
  }

  const runtime = readOptions(process.env)
  if (runtime.errors.length > 0) {
    console.error('Проблемы в настройках подключения к базе:')
    runtime.errors.forEach((message) => console.error(`  ${message}`))
    process.exitCode = 1
    return
  }

  const client = createClient(runtime.supabaseUrl, runtime.serviceRoleKey, { auth: { persistSession: false } })
  const nowIso = new Date().toISOString()

  let sourceRows
  try {
    // Сверяем с базой весь файл, а не только выбранные: убранные ленты надо погасить.
    sourceRows = await loadSources(client, { userId: runtime.ownerUserId, sources, dryRun: options.dryRun })
  } catch (cause) {
    fail(cause?.message ?? String(cause))
    return
  }

  let failures = 0
  let total = 0
  const byTopic = new Map()

  for (const source of selected) {
    const sourceRow = sourceRows.get(source.key)
    try {
      const result = await syncSource({ client, source, sourceRow, options, runtime, nowIso })
      const added = options.dryRun ? result.wouldInsert : result.inserted
      total += added
      byTopic.set(source.topic, (byTopic.get(source.topic) ?? 0) + added)
      const verb = options.dryRun ? 'будет добавлено' : 'добавлено'
      const tail = result.notModified ? ' (без изменений)' : ''
      console.log(`${source.title}: получено ${result.received}, отобрано ${result.selected}, ${verb} ${added}${tail}`)
    } catch (cause) {
      failures += 1
      const reason = describeFetchError(cause)
      console.error(`${source.title} (${source.feedUrl}): ${reason}`)
      try {
        await saveSourceState(client, {
          sourceId: sourceRow?.id ?? null,
          status: 'error',
          error: reason,
          nowIso,
          dryRun: options.dryRun,
        })
      } catch (saveCause) {
        console.error(`  не удалось записать ошибку источника: ${saveCause?.message ?? saveCause}`)
      }
    }
  }

  console.log('')
  for (const topic of TOPICS) {
    const count = byTopic.get(topic.key)
    if (count) console.log(`${topicTitle(topic.key)}: ${count}`)
  }
  console.log(options.dryRun ? `Итого к добавлению: ${total}` : `Итого добавлено публикаций: ${total}`)

  if (failures > 0) {
    console.error(`Источников с ошибками: ${failures}`)
    process.exitCode = 1
  }
}

main().catch((cause) => {
  console.error(`Непредвиденная ошибка: ${cause?.message ?? cause}`)
  process.exitCode = 1
})
