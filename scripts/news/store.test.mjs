import { describe, expect, it } from 'vitest'
import { loadSources, saveSourceState, upsertItems } from './store.mjs'

/** Подставной клиент: запоминает вызовы и отдаёт заданные ответы. */
function makeClient({ selectData = [], insertData = [] } = {}) {
  const calls = []

  function builder(table, response) {
    const chain = {
      select(columns) {
        calls.push({ method: 'select', table, columns })
        return chain
      },
      eq(column, value) {
        calls.push({ method: 'eq', table, column, value })
        return chain
      },
      insert(rows) {
        calls.push({ method: 'insert', table, rows })
        return builder(table, { data: insertData, error: null })
      },
      upsert(rows, options) {
        calls.push({ method: 'upsert', table, rows, options })
        return builder(table, { data: rows.map(() => ({ id: 'x' })), error: null })
      },
      update(patch) {
        calls.push({ method: 'update', table, patch })
        return builder(table, { data: null, error: null })
      },
      then(resolve) {
        return Promise.resolve(response).then(resolve)
      },
    }
    return chain
  }

  return {
    calls,
    from(table) {
      return builder(table, { data: selectData, error: null })
    },
  }
}

const SOURCES = [
  { key: '4pda', topic: 'gadgets', title: '4PDA', feedUrl: 'https://4pda.to/feed/' },
  { key: 'habr-ai', topic: 'ai', title: 'Habr', feedUrl: 'https://habr.com/rss' },
]

describe('источники в базе', () => {
  it('заводит недостающие источники', async () => {
    const client = makeClient({
      selectData: [{ id: '1', key: '4pda', topic: 'gadgets', title: '4PDA', feed_url: 'https://4pda.to/feed/' }],
      insertData: [{ id: '2', key: 'habr-ai', topic: 'ai', title: 'Habr', feed_url: 'https://habr.com/rss' }],
    })
    const known = await loadSources(client, { userId: 'owner', sources: SOURCES })
    expect(known.get('habr-ai')).toMatchObject({ id: '2' })
    expect(client.calls.some((call) => call.method === 'insert')).toBe(true)
  })

  it('подтягивает изменившееся название ленты из файла', async () => {
    const client = makeClient({
      selectData: [
        { id: '1', key: '4pda', topic: 'gadgets', title: 'Старое имя', feed_url: 'https://4pda.to/feed/' },
        { id: '2', key: 'habr-ai', topic: 'ai', title: 'Habr', feed_url: 'https://habr.com/rss' },
      ],
    })
    await loadSources(client, { userId: 'owner', sources: SOURCES })
    const update = client.calls.find((call) => call.method === 'update')
    expect(update.patch).toMatchObject({ title: '4PDA' })
  })

  it('гасит источник, убранный из файла, и стирает его ошибку', async () => {
    const client = makeClient({
      selectData: [
        { id: '1', key: '4pda', topic: 'gadgets', title: '4PDA', feed_url: 'https://4pda.to/feed/', enabled: true },
        { id: '2', key: 'habr-ai', topic: 'ai', title: 'Habr', feed_url: 'https://habr.com/rss', enabled: true },
        {
          id: '3',
          key: 'старый',
          topic: 'ai',
          title: 'Закрытая лента',
          feed_url: 'https://dead.ru/rss',
          enabled: true,
          last_error: 'лента не найдена (404)',
        },
      ],
    })
    await loadSources(client, { userId: 'owner', sources: SOURCES })
    const disable = client.calls.find((call) => call.method === 'update' && call.patch.enabled === false)
    expect(disable.patch).toMatchObject({ enabled: false, last_error: null, last_status: null })
  })

  it('в dry-run ничего не пишет', async () => {
    const client = makeClient({ selectData: [] })
    const known = await loadSources(client, { userId: 'owner', sources: SOURCES, dryRun: true })
    expect(known.get('4pda')).toMatchObject({ id: null })
    expect(client.calls.some((call) => ['insert', 'upsert', 'update'].includes(call.method))).toBe(false)
  })
})

describe('запись публикаций', () => {
  const rows = Array.from({ length: 120 }, (_, index) => ({
    user_id: 'owner',
    dedupe_key: `key-${index}`,
    url_hash: `hash-${index}`,
  }))

  it('в dry-run только считает', async () => {
    const client = makeClient()
    expect(await upsertItems(client, rows, { dryRun: true })).toEqual({ inserted: 0, skipped: 0, wouldInsert: 120 })
    expect(client.calls).toEqual([])
  })

  it('пишет партиями и не перезаписывает сохранённое', async () => {
    const client = makeClient()
    const result = await upsertItems(client, rows, { chunkSize: 50 })
    const upserts = client.calls.filter((call) => call.method === 'upsert')
    expect(upserts).toHaveLength(3)
    expect(upserts[0].options).toEqual({ onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
    expect(result.inserted).toBe(120)
  })

  it('конфликт по хэшу ссылки не роняет партию', async () => {
    const conflictClient = {
      from() {
        const chain = {
          select: () => chain,
          upsert(batch) {
            const conflict = batch.length > 1 || batch[0].url_hash === 'hash-2'
            return {
              select: () => ({
                then: (resolve) =>
                  Promise.resolve(
                    conflict
                      ? { data: null, error: { code: '23505', message: 'duplicate key value' } }
                      : { data: [{ id: 'x' }], error: null },
                  ).then(resolve),
              }),
            }
          },
        }
        return chain
      },
    }

    const result = await upsertItems(conflictClient, rows.slice(0, 5), { chunkSize: 5 })
    expect(result.inserted).toBe(4)
    expect(result.skipped).toBe(1)
  })
})

describe('состояние источника', () => {
  it('сохраняет успех вместе с условными заголовками', async () => {
    const client = makeClient()
    await saveSourceState(client, {
      sourceId: '1',
      status: 'ok',
      itemCount: 7,
      etag: 'W/"abc"',
      lastModified: 'Wed, 24 Sep 2026 09:00:00 GMT',
      nowIso: '2026-09-24T12:00:00.000Z',
    })
    expect(client.calls.find((call) => call.method === 'update').patch).toMatchObject({
      last_status: 'ok',
      last_item_count: 7,
      http_etag: 'W/"abc"',
      last_error: null,
    })
  })

  it('сохраняет ошибку источника', async () => {
    const client = makeClient()
    await saveSourceState(client, { sourceId: '1', status: 'error', error: 'Лента не найдена (404)', nowIso: 'now' })
    expect(client.calls.find((call) => call.method === 'update').patch.last_error).toContain('404')
  })

  it('в dry-run состояние не трогает', async () => {
    const client = makeClient()
    expect(await saveSourceState(client, { sourceId: '1', status: 'ok', nowIso: 'now', dryRun: true })).toBe(false)
    expect(client.calls).toEqual([])
  })
})
