// Разбор письма: чистые функции без сети. Вложения никогда не скачиваются.
import { createHash } from 'node:crypto'

export const MAX_TEXT_CHARS = 2000
export const MAX_BULK_TEXT_CHARS = 500
export const MAX_PREVIEW_CHARS = 200
export const MAX_PART_BYTES = 256 * 1024
export const MAX_ATTACHMENT_NAMES = 10
export const MAX_SUBJECT_CHARS = 500

/** Ключ дедупликации: Message-ID, а при его отсутствии — отпечаток письма. */
export function dedupeKey({ messageId, accountKey, uid, receivedAt, subject }) {
  const normalized = (messageId ?? '').trim().replace(/^<|>$/g, '').toLowerCase()
  if (normalized) return normalized
  const fingerprint = [accountKey, uid, receivedAt ?? '', subject ?? ''].join('|')
  return `sha256:${createHash('sha256').update(fingerprint).digest('hex')}`
}

/**
 * Что забирать из ящика: продолжение по UID или ограниченный первый проход.
 * При смене uid_validity состояние ящика сбрасывается.
 */
export function fetchRange(state, { mailboxUidValidity, backfillDays = 30, now = new Date() }) {
  const savedValidity = state?.uidValidity ?? null
  const lastUid = Number(state?.lastUid ?? 0)
  const sameMailbox = savedValidity !== null && String(savedValidity) === String(mailboxUidValidity)

  if (sameMailbox && lastUid > 0) {
    return { mode: 'uid', range: `${lastUid + 1}:*`, since: null, reset: false }
  }

  const since = new Date(now.getTime() - backfillDays * 86_400_000)
  return { mode: 'since', range: null, since, reset: savedValidity !== null && !sameMailbox }
}

/**
 * Какие письма забирать из найденных поиском: старые первыми, не больше limit.
 * Диапазон `43:*` по стандарту IMAP отдаёт последнее письмо, даже когда новых нет,
 * поэтому в режиме по UID уже забранное отсекается явно.
 */
export function selectUids(found, { mode, lastUid = 0, limit }) {
  const floor = mode === 'uid' ? Number(lastUid ?? 0) : 0
  const unique = [...new Set((Array.isArray(found) ? found : []).map(Number))].filter((uid) => Number.isInteger(uid) && uid > floor)
  unique.sort((a, b) => a - b)
  return unique.slice(0, limit)
}

function flattenParts(node, collected = []) {
  if (!node) return collected
  if (Array.isArray(node.childNodes) && node.childNodes.length > 0) {
    for (const child of node.childNodes) flattenParts(child, collected)
    return collected
  }
  collected.push(node)
  return collected
}

function isAttachment(node) {
  const disposition = (node.disposition ?? '').toLowerCase()
  if (disposition === 'attachment') return true
  const filename = node.dispositionParameters?.filename ?? node.parameters?.name
  return Boolean(filename) && disposition !== 'inline'
}

/** Статус текстовой части: что скачивать и почему не скачиваем. */
export function textPartStatus(bodyStructure) {
  const leaves = flattenParts(bodyStructure)
  const texts = leaves.filter((node) => !isAttachment(node) && String(node.type ?? '').startsWith('text/'))
  if (texts.length === 0) return { part: null, reason: 'none' }

  const byPreference = ['text/plain', 'text/html']
  for (const wanted of byPreference) {
    const candidates = texts.filter((node) => String(node.type).toLowerCase() === wanted)
    const fitting = candidates.find((node) => Number(node.size ?? 0) <= MAX_PART_BYTES)
    if (fitting) {
      return {
        part: { part: fitting.part || '1', type: wanted, size: Number(fitting.size ?? 0), encoding: fitting.encoding ?? null },
        reason: 'ok',
      }
    }
  }

  return { part: null, reason: 'too-large' }
}

export function pickTextPart(bodyStructure) {
  return textPartStatus(bodyStructure).part
}

export function attachmentNames(bodyStructure) {
  return flattenParts(bodyStructure)
    .filter(isAttachment)
    .map((node) => node.dispositionParameters?.filename ?? node.parameters?.name ?? 'файл')
    .map((name) => String(name).slice(0, 120))
    .slice(0, MAX_ATTACHMENT_NAMES)
}

const ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&laquo;': '«',
  '&raquo;': '»',
  '&mdash;': '—',
  '&ndash;': '–',
}

export function htmlToPlainText(html) {
  if (!html) return ''
  let text = String(html)
  text = text.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  text = text.replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<[^>]+>/g, ' ')
  for (const [entity, value] of Object.entries(ENTITIES)) text = text.split(entity).join(value)
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
  text = text.replace(/[^\S\n]+/g, ' ')
  text = text.replace(/\s*\n\s*/g, '\n')
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

/** Рассылка: по ней хранится меньше текста. */
export function isBulk(headers) {
  const lower = normalizeHeaders(headers)
  if (lower['list-unsubscribe'] || lower['list-id']) return true
  return String(lower.precedence ?? '').toLowerCase() === 'bulk'
}

export function normalizeHeaders(headers) {
  const result = {}
  if (!headers) return result
  const entries = headers instanceof Map ? [...headers.entries()] : Object.entries(headers)
  for (const [key, value] of entries) {
    result[String(key).toLowerCase()] = Array.isArray(value) ? value.join(' ') : String(value ?? '').trim()
  }
  return result
}

/** Разбор сырых строк заголовков (то, что IMAP отдаёт одним куском). */
export function parseHeaderLines(raw) {
  const result = {}
  if (!raw) return result
  const unfolded = String(raw).replace(/\r?\n[ \t]+/g, ' ')
  for (const line of unfolded.split(/\r?\n/)) {
    const index = line.indexOf(':')
    if (index <= 0) continue
    result[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim()
  }
  return result
}

function firstAddress(list) {
  const entry = Array.isArray(list) ? list[0] : null
  if (!entry) return { name: null, email: null }
  return { name: entry.name ? String(entry.name).slice(0, 200) : null, email: entry.address ? String(entry.address).toLowerCase() : null }
}

function toIso(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Строка для таблицы mail_messages. HTML и вложения сюда не попадают. */
export function buildMessageRow({
  userId,
  accountId,
  accountKey,
  uid,
  envelope = {},
  internalDate,
  flags = [],
  size = null,
  headers = {},
  text = '',
  textReason = 'ok',
  bodyStructure = null,
  nowIso = new Date().toISOString(),
}) {
  const bulk = isBulk(headers)
  const limit = bulk ? MAX_BULK_TEXT_CHARS : MAX_TEXT_CHARS
  const cleaned = String(text ?? '').replace(/\r\n/g, '\n').trim()
  const truncated = cleaned.length > limit
  const body = textReason === 'ok' ? cleaned.slice(0, limit) : ''
  const preview =
    textReason === 'too-large'
      ? 'Текст письма не сохранён (слишком большой)'
      : body.replace(/\s+/g, ' ').trim().slice(0, MAX_PREVIEW_CHARS)

  const from = firstAddress(envelope.from)
  const receivedAt = toIso(internalDate) ?? toIso(envelope.date) ?? nowIso
  const seen = Array.isArray(flags) ? flags.includes('\\Seen') : Boolean(flags?.has?.('\\Seen'))
  const names = attachmentNames(bodyStructure)

  return {
    user_id: userId,
    account_id: accountId,
    uid: Number(uid),
    dedupe_key: dedupeKey({
      messageId: envelope.messageId,
      accountKey,
      uid,
      receivedAt,
      subject: envelope.subject,
    }),
    message_id: envelope.messageId ? String(envelope.messageId).slice(0, 500) : null,
    subject: envelope.subject ? String(envelope.subject).slice(0, MAX_SUBJECT_CHARS) : null,
    from_name: from.name,
    from_email: from.email,
    to_emails: (Array.isArray(envelope.to) ? envelope.to : [])
      .map((entry) => (entry?.address ? String(entry.address).toLowerCase() : null))
      .filter(Boolean)
      .slice(0, 10),
    sent_at: toIso(envelope.date),
    received_at: receivedAt,
    preview,
    body_text: body,
    body_truncated: truncated || textReason !== 'ok',
    has_attachments: names.length > 0,
    attachment_names: names,
    is_bulk: bulk,
    size_bytes: size === null ? null : Number(size),
    read_at: seen ? nowIso : null,
  }
}
