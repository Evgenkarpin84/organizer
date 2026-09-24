// Сбор писем по IMAP в Supabase. Запуск: npm run mail [-- --check | --dry-run | --account=mail1 | --limit=50]
import { createClient } from '@supabase/supabase-js'
import { ImapFlow } from 'imapflow'
import { maskSecrets, parseAccounts, parseArgs, providerTitle, readOptions } from './mail/config.mjs'
import {
  TOO_LARGE_PREVIEW,
  buildMessageRow,
  fetchRange,
  htmlToPlainText,
  messageText,
  parseHeaderLines,
  planSave,
  selectUids,
  textPartStatus,
} from './mail/message.mjs'
import {
  loadAccounts,
  loadEmptyBodies,
  saveAccountError,
  saveAccountState,
  saveMessageText,
  upsertMessages,
} from './mail/store.mjs'

const HEADER_FIELDS = ['list-unsubscribe', 'list-id', 'precedence']
const SOCKET_TIMEOUT_MS = 30_000
const MAX_DOWNLOAD_BYTES = 256 * 1024
// Столько сбоев скачивания подряд — значит, сервер ограничил доступ, и остальное лучше забрать позже.
const MAX_FAILED_IN_ROW = 3
const REFILL_PER_RUN = 50

function fail(message) {
  console.error(message)
  process.exitCode = 1
}

/** Технические ошибки IMAP переводятся в понятные фразы. */
function describeImapError(error, secrets) {
  const raw = maskSecrets(error?.message ?? String(error), secrets)
  const text = raw.toLowerCase()
  if (text.includes('authenticationfailed') || text.includes('invalid credentials') || text.includes('login failure')) {
    return 'не подошёл пароль приложения или IMAP выключен в настройках ящика'
  }
  if (text.includes('enotfound') || text.includes('eai_again')) return 'не удалось найти почтовый сервер, проверьте интернет'
  if (text.includes('timeout') || text.includes('etimedout')) return 'сервер не ответил вовремя'
  if (text.includes('econnrefused')) return 'сервер отказал в подключении'
  if (text.includes('certificate') || text.includes('tls')) return 'проблема с защищённым соединением'
  return raw
}

async function readStream(stream) {
  const chunks = []
  let total = 0
  for await (const chunk of stream) {
    total += chunk.length
    if (total > MAX_DOWNLOAD_BYTES) break
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** Текст одной части письма. Ошибка не бросается: что делать со сбоем, решает вызывающий. */
async function downloadText(imap, uid, part) {
  try {
    const { content } = await imap.download(uid, part.part, { uid: true, maxBytes: MAX_DOWNLOAD_BYTES })
    const raw = await readStream(content)
    return { text: part.type === 'text/html' ? htmlToPlainText(raw) : raw, error: null }
  } catch (cause) {
    return { text: '', error: cause }
  }
}

/** Дописывает текст письмам, у которых он не скачался в прошлые запуски. Возвращает число дописанных. */
async function refillEmptyBodies({ imap, client, accountRow, mailbox, options, runtime, nowIso }) {
  // Номера писем действительны, только пока у папки та же uid_validity.
  if (!accountRow?.id || String(accountRow.uid_validity ?? '') !== String(mailbox.uidValidity)) return 0

  const sinceIso = new Date(new Date(nowIso).getTime() - runtime.backfillDays * 86_400_000).toISOString()
  const empties = await loadEmptyBodies(client, {
    accountId: accountRow.id,
    sinceIso,
    limit: REFILL_PER_RUN,
    tooLargePreview: TOO_LARGE_PREVIEW,
  })
  if (empties.length === 0) return 0

  const structures = await imap.fetchAll(empties.map((row) => row.uid).join(','), { uid: true, bodyStructure: true }, { uid: true })
  const byUid = new Map(structures.map((message) => [Number(message.uid), message]))

  let refilled = 0
  for (const row of empties) {
    const status = textPartStatus(byUid.get(Number(row.uid))?.bodyStructure)
    if (!status.part) continue

    const got = await downloadText(imap, row.uid, status.part)
    if (got.error) {
      if (!imap.usable) break
      continue
    }

    const fields = messageText({ text: got.text, textReason: 'ok', bulk: row.is_bulk })
    if (!fields.body_text) continue
    await saveMessageText(client, { id: row.id, fields, dryRun: options.dryRun })
    refilled += 1
  }
  return refilled
}

async function syncAccount({ client, account, accountRow, options, runtime, nowIso }) {
  const imap = new ImapFlow({
    host: account.host,
    port: account.port,
    secure: account.secure,
    auth: { user: account.email, pass: account.password },
    logger: false,
    socketTimeout: SOCKET_TIMEOUT_MS,
  })

  await imap.connect()
  try {
    const mailbox = await imap.mailboxOpen(account.folder, { readOnly: true })
    const plan = fetchRange(
      { uidValidity: accountRow?.uid_validity, lastUid: accountRow?.last_uid },
      { mailboxUidValidity: mailbox.uidValidity, backfillDays: runtime.backfillDays },
    )

    const limit = options.limit ?? runtime.maxPerRun
    const search = plan.mode === 'uid' ? { uid: plan.range } : { since: plan.since }
    const uids = selectUids(await imap.search(search, { uid: true }), {
      mode: plan.mode,
      lastUid: accountRow?.last_uid,
      limit,
    })
    const query = {
      uid: true,
      flags: true,
      envelope: true,
      bodyStructure: true,
      internalDate: true,
      size: true,
      headers: HEADER_FIELDS,
    }

    // imapflow выполняет команды по очереди: download внутри цикла fetch ждал бы конца FETCH,
    // а FETCH — следующего шага цикла, и процесс молча завершался. Поэтому сначала заголовки, потом тексты.
    const messages = uids.length > 0 ? await imap.fetchAll(uids.join(','), query, { uid: true }) : []
    messages.sort((a, b) => Number(a.uid) - Number(b.uid))

    const results = []
    let failedInRow = 0
    let stopped = false

    for (const message of messages) {
      const status = textPartStatus(message.bodyStructure)
      const got = status.part ? await downloadText(imap, message.uid, status.part) : { text: '', error: null }
      if (got.error && options.verbose) {
        console.error(`  письмо ${message.uid}: не удалось получить текст — ${got.error?.message ?? got.error}`)
      }

      results.push({
        failed: Boolean(got.error),
        row: buildMessageRow({
          userId: runtime.ownerUserId,
          accountId: accountRow?.id ?? null,
          accountKey: account.key,
          uid: message.uid,
          envelope: message.envelope ?? {},
          internalDate: message.internalDate,
          flags: message.flags,
          size: message.size ?? null,
          headers: parseHeaderLines(message.headers?.toString?.('utf8') ?? ''),
          text: got.text,
          textReason: status.reason,
          bodyStructure: message.bodyStructure,
          nowIso,
        }),
      })

      // Несколько сбоев подряд или оборванное соединение: дальше качать бессмысленно.
      failedInRow = got.error ? failedInRow + 1 : 0
      if (failedInRow >= MAX_FAILED_IN_ROW || (got.error && !imap.usable)) {
        stopped = true
        break
      }
    }

    // Сбои в хвосте не сохраняются и не сдвигают last_uid: следующий запуск заберёт эти письма заново.
    const { rows, deferred } = planSave(results)
    const startUid = plan.reset || plan.mode === 'since' ? 0 : Number(accountRow?.last_uid ?? 0)
    const maxUid = rows.reduce((max, row) => Math.max(max, row.uid), startUid)

    const result = await upsertMessages(client, rows, { dryRun: options.dryRun })
    await saveAccountState(client, {
      accountId: accountRow?.id ?? null,
      uidValidity: String(mailbox.uidValidity),
      lastUid: maxUid,
      nowIso,
      dryRun: options.dryRun,
    })

    const refilled = stopped ? 0 : await refillEmptyBodies({ imap, client, accountRow, mailbox, options, runtime, nowIso })

    return { found: rows.length, deferred: deferred + (messages.length - results.length), refilled, ...result }
  } finally {
    await imap.logout().catch(() => imap.close())
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.errors.length > 0) {
    options.errors.forEach(fail)
    return
  }

  try {
    process.loadEnvFile()
  } catch {
    fail('Не найден файл .env — скопируйте .env.example и заполните переменные.')
    return
  }

  const { accounts, errors } = parseAccounts(process.env)
  if (errors.length > 0) {
    console.error('Проблемы в настройках ящиков:')
    errors.forEach((message) => console.error(`  ${message}`))
    process.exitCode = 1
    return
  }

  const selected = options.account ? accounts.filter((account) => account.key === options.account) : accounts
  if (selected.length === 0) {
    fail(`Ящик «${options.account}» не найден в .env`)
    return
  }

  if (options.check) {
    console.log('Настроенные ящики:')
    for (const account of selected) {
      console.log(`  ${account.key}  ${account.label}  ${account.email}  ${providerTitle(account.provider)}  ${account.host}:${account.port}  ${account.folder}`)
    }
    console.log('Настройки прочитаны, обращений к сети не было.')
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
  const secrets = selected.map((account) => account.password).concat(runtime.serviceRoleKey)

  let accountRows
  try {
    accountRows = await loadAccounts(client, { userId: runtime.ownerUserId, accounts: selected, dryRun: options.dryRun })
  } catch (cause) {
    fail(maskSecrets(cause?.message ?? String(cause), secrets))
    return
  }

  let failures = 0
  let total = 0

  for (const account of selected) {
    const accountRow = accountRows.get(account.key)
    try {
      const result = await syncAccount({ client, account, accountRow, options, runtime, nowIso })
      total += options.dryRun ? result.wouldInsert : result.inserted
      const verb = options.dryRun ? 'будет добавлено' : 'добавлено'
      const extras = []
      if (result.refilled > 0) extras.push(`${options.dryRun ? 'будет дописан' : 'дописан'} текст у ${result.refilled}`)
      if (result.deferred > 0) extras.push(`отложено ${result.deferred} — сервер не отдал текст, заберу в следующий раз`)
      const tail = extras.length > 0 ? `, ${extras.join(', ')}` : ''
      console.log(`${account.label}: получено ${result.found}, ${verb} ${options.dryRun ? result.wouldInsert : result.inserted}${tail}`)
    } catch (cause) {
      failures += 1
      const reason = describeImapError(cause, secrets)
      console.error(`${account.label} (${account.host}): ${reason}`)
      try {
        await saveAccountError(client, {
          accountId: accountRow?.id ?? null,
          message: reason,
          nowIso,
          dryRun: options.dryRun,
        })
      } catch (saveCause) {
        console.error(`  не удалось записать ошибку в базу: ${maskSecrets(saveCause?.message ?? String(saveCause), secrets)}`)
      }
    }
  }

  console.log(options.dryRun ? `Итого к добавлению: ${total}` : `Итого добавлено писем: ${total}`)
  if (failures > 0) {
    console.error(`Ящиков с ошибками: ${failures}`)
    process.exitCode = 1
  }
}

main().catch((cause) => {
  console.error(`Непредвиденная ошибка: ${cause?.message ?? cause}`)
  process.exitCode = 1
})
