// Запись новостей через переданный клиент: слой тестируется без сети.

const SOURCE_COLUMNS =
  'id, key, topic, title, feed_url, enabled, http_etag, http_last_modified, last_fetch_at, last_status, last_error, last_item_count'
export const CHUNK_SIZE = 50

/** Строки источников: недостающие заводятся, изменившиеся названия и адреса обновляются. */
export async function loadSources(client, { userId, sources, dryRun = false }) {
  const { data, error } = await client.from('news_sources').select(SOURCE_COLUMNS).eq('user_id', userId)
  if (error) throw new Error(`Не удалось прочитать источники: ${error.message}`)

  const known = new Map((data ?? []).map((row) => [row.key, row]))
  const missing = sources.filter((source) => !known.has(source.key))

  if (dryRun) {
    for (const source of missing) {
      known.set(source.key, { id: null, key: source.key, topic: source.topic, last_item_count: 0 })
    }
    return known
  }

  if (missing.length > 0) {
    const { data: inserted, error: insertError } = await client
      .from('news_sources')
      .insert(
        missing.map((source) => ({
          user_id: userId,
          key: source.key,
          topic: source.topic,
          title: source.title,
          feed_url: source.feedUrl,
        })),
      )
      .select(SOURCE_COLUMNS)
    if (insertError) throw new Error(`Не удалось завести источник: ${insertError.message}`)
    for (const row of inserted ?? []) known.set(row.key, row)
  }

  // Источник, убранный из sources.json, гасим: иначе его старая ошибка висит в приложении вечно.
  const fileKeys = new Set(sources.map((source) => source.key))
  const stale = (data ?? []).filter((row) => !fileKeys.has(row.key) && (row.enabled || row.last_error))
  for (const row of stale) {
    const { error: disableError } = await client
      .from('news_sources')
      .update({ enabled: false, last_error: null, last_status: null })
      .eq('id', row.id)
    if (disableError) throw new Error(`Не удалось отключить источник: ${disableError.message}`)
  }

  // Название или адрес ленты могли поменяться в sources.json — держим базу в согласии с файлом.
  for (const source of sources) {
    const row = known.get(source.key)
    if (!row?.id) continue
    if (row.title === source.title && row.feed_url === source.feedUrl && row.topic === source.topic && row.enabled) {
      continue
    }
    const { error: updateError } = await client
      .from('news_sources')
      .update({ title: source.title, feed_url: source.feedUrl, topic: source.topic, enabled: true })
      .eq('id', row.id)
    if (updateError) throw new Error(`Не удалось обновить источник: ${updateError.message}`)
  }

  return known
}

export async function upsertItems(client, rows, { dryRun = false, chunkSize = CHUNK_SIZE } = {}) {
  if (rows.length === 0) return { inserted: 0, skipped: 0, wouldInsert: 0 }
  if (dryRun) return { inserted: 0, skipped: 0, wouldInsert: rows.length }

  let inserted = 0
  let skipped = 0

  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize)
    const { data, error } = await client
      .from('news_items')
      .upsert(chunk, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
      .select('id')

    if (!error) {
      inserted += Array.isArray(data) ? data.length : chunk.length
      continue
    }

    // Вторая уникальность — по хэшу ссылки: та же статья пришла из другой ленты.
    if (!isUniqueViolation(error)) throw new Error(`Не удалось сохранить публикации: ${error.message}`)

    for (const row of chunk) {
      const single = await client
        .from('news_items')
        .upsert([row], { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
        .select('id')
      if (!single.error) {
        inserted += Array.isArray(single.data) ? single.data.length : 1
        continue
      }
      if (!isUniqueViolation(single.error)) throw new Error(`Не удалось сохранить публикацию: ${single.error.message}`)
      skipped += 1
    }
  }

  return { inserted, skipped, wouldInsert: rows.length }
}

function isUniqueViolation(error) {
  return error?.code === '23505' || /duplicate key value/i.test(error?.message ?? '')
}

export async function saveSourceState(client, { sourceId, status, error = null, itemCount = 0, etag = null, lastModified = null, nowIso, dryRun = false }) {
  if (dryRun || !sourceId) return false
  const { error: updateError } = await client
    .from('news_sources')
    .update({
      last_fetch_at: nowIso,
      last_status: status,
      last_error: error,
      last_item_count: itemCount,
      http_etag: etag,
      http_last_modified: lastModified,
    })
    .eq('id', sourceId)
  if (updateError) throw new Error(`Не удалось сохранить состояние источника: ${updateError.message}`)
  return true
}
