// Разбор лент: чистые функции без сети. Полный текст статей и картинки не берём.
import { createHash } from 'node:crypto'

export const MAX_TITLE_CHARS = 200
export const MAX_SUMMARY_CHARS = 400

/** Тело ответа в текст: кодировка из заголовка, иначе из XML-декларации. */
export function decodeBody(buffer, contentType = '') {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType)?.[1]
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 200))
  const fromXml = /encoding=["']([\w-]+)["']/i.exec(head)?.[1]
  const charset = (fromHeader ?? fromXml ?? 'utf-8').toLowerCase()

  try {
    return new TextDecoder(charset === 'cp1251' ? 'windows-1251' : charset).decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

const ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&laquo;': '«',
  '&raquo;': '»',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
}

function decodeEntities(text) {
  let result = String(text)
  for (const [entity, value] of Object.entries(ENTITIES)) result = result.split(entity).join(value)
  return result.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
}

export function stripHtml(html) {
  if (!html) return ''
  let text = String(html)
  text = text.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  text = text.replace(/<[^>]+>/g, ' ')
  text = decodeEntities(text)
  return text.replace(/[^\S\n]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim()
}

/** Обрезка по границе слова с многоточием. */
export function clampText(text, limit) {
  const value = String(text ?? '').trim()
  if (value.length <= limit) return value
  const cut = value.slice(0, limit - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

function unwrap(raw) {
  if (raw === null || raw === undefined) return null
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(raw)
  return decodeEntities(cdata ? cdata[1] : raw).trim()
}

function tagContent(block, name) {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i').exec(block)
  return match ? unwrap(match[1]) : null
}

function atomLink(block) {
  const alternate = /<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*>/i.exec(block)
  if (alternate) return decodeEntities(alternate[1])
  const first = /<link[^>]*href=["']([^"']+)["'][^>]*>/i.exec(block)
  return first ? decodeEntities(first[1]) : null
}

/** В базу и в href попадают только http(s)-ссылки; относительные достраиваются от ленты. */
export function resolveArticleUrl(raw, feedUrl = null) {
  const value = String(raw ?? '').trim()
  if (!value) return null
  try {
    const parsed = feedUrl ? new URL(value, feedUrl) : new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

/** RSS 2.0 и Atom. На битом ответе возвращает пустой список и текст ошибки. */
/**
 * Пустой ответ на условный запрос — это «без изменений»: часть серверов (например, Oborot.ru)
 * на совпавший ETag отвечает 200 без тела вместо 304.
 */
export function isEmptyConditionalReply(bytes, conditional) {
  if (!conditional) return false
  return new TextDecoder('utf-8').decode(bytes).trim() === ''
}

export function parseFeed(xml, { now = new Date(), feedUrl = null } = {}) {
  const text = String(xml ?? '')
  if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(text) && !/<(item|entry)[\s>]/i.test(text)) {
    return { items: [], error: 'Ответ не похож на ленту RSS или Atom' }
  }

  const blocks = [
    ...text.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi),
    ...text.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi),
  ].map((match) => match[1])

  // Пустая, но валидная лента — не ошибка: источник просто ничего не опубликовал.
  if (blocks.length === 0) return { items: [], error: null }

  const items = []
  for (const block of blocks) {
    const title = tagContent(block, 'title')
    const url = resolveArticleUrl(tagContent(block, 'link') || atomLink(block), feedUrl)
    if (!title || !url) continue

    const rawDate =
      tagContent(block, 'pubDate') ??
      tagContent(block, 'published') ??
      tagContent(block, 'updated') ??
      tagContent(block, 'dc:date')
    const parsed = rawDate ? new Date(rawDate) : null
    const publishedAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed : now

    const summarySource =
      tagContent(block, 'description') ?? tagContent(block, 'summary') ?? tagContent(block, 'content')

    items.push({
      guid: tagContent(block, 'guid') ?? tagContent(block, 'id') ?? null,
      title: clampText(stripHtml(title), MAX_TITLE_CHARS),
      url: String(url).trim(),
      summary: summarySource ? clampText(stripHtml(summarySource), MAX_SUMMARY_CHARS) : null,
      publishedAt: publishedAt.toISOString(),
    })
  }

  return { items, error: null }
}

const TRACKING_PARAMS = /^(utm_|yclid|gclid|fbclid|ysclid|_openstat)/i

export function normalizeUrl(url) {
  const raw = String(url ?? '').trim()
  try {
    const parsed = new URL(raw)
    parsed.protocol = parsed.protocol.toLowerCase()
    parsed.hostname = parsed.hostname.toLowerCase()
    parsed.hash = ''
    for (const name of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(name)) parsed.searchParams.delete(name)
    }
    // Хвостовой слеш убираем в самом пути: иначе ссылка с параметрами его сохраняет.
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1)
    }
    return parsed.toString()
  } catch {
    return raw
  }
}

export function urlHash(url) {
  return createHash('sha256').update(normalizeUrl(url)).digest('hex')
}

export function dedupeKey({ guid, url }) {
  const normalized = String(guid ?? '').trim()
  return normalized ? normalized.slice(0, 500) : `sha256:${urlHash(url)}`
}

/** Источник с include собирает узкую тему из общей ленты. */
export function matchesKeywords(item, include = []) {
  if (!include || include.length === 0) return true
  const haystack = `${item.title ?? ''} ${item.summary ?? ''}`.toLowerCase()
  return include.some((word) => haystack.includes(String(word).toLowerCase()))
}

export function selectItems(items, { now = new Date(), backfillDays = 7, maxPerSource = 30 } = {}) {
  const oldest = now.getTime() - backfillDays * 86_400_000
  const future = now.getTime() + 86_400_000
  const seen = new Set()
  const selected = []

  for (const item of items) {
    const stamp = Date.parse(item.publishedAt)
    if (Number.isNaN(stamp) || stamp < oldest || stamp > future) continue
    const key = urlHash(item.url)
    if (seen.has(key)) continue
    seen.add(key)
    selected.push(item)
  }

  return selected.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, maxPerSource)
}

export function buildItemRow({ userId, sourceId, topic, item, nowIso = new Date().toISOString() }) {
  return {
    user_id: userId,
    source_id: sourceId,
    topic,
    dedupe_key: dedupeKey(item),
    guid: item.guid ? String(item.guid).slice(0, 500) : null,
    title: clampText(item.title, MAX_TITLE_CHARS),
    url: String(item.url).slice(0, 1000),
    url_hash: urlHash(item.url),
    summary: item.summary ? clampText(item.summary, MAX_SUMMARY_CHARS) : null,
    published_at: item.publishedAt,
    fetched_at: nowIso,
  }
}
