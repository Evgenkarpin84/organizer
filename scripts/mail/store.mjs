// Запись в Supabase через переданный клиент: так слой тестируется без сети.

const ACCOUNT_COLUMNS = 'id, key, label, email, provider, folder, uid_validity, last_uid, last_sync_at, last_error'
export const CHUNK_SIZE = 50

/** Строки ящиков: недостающие заводятся, в dry-run ничего не пишется. */
export async function loadAccounts(client, { userId, accounts, dryRun = false }) {
  const { data, error } = await client.from('mail_accounts').select(ACCOUNT_COLUMNS).eq('user_id', userId)
  if (error) throw new Error(`Не удалось прочитать список ящиков: ${error.message}`)

  const known = new Map((data ?? []).map((row) => [row.key, row]))
  const missing = accounts.filter((account) => !known.has(account.key))

  if (missing.length === 0 || dryRun) {
    for (const account of missing) {
      known.set(account.key, { id: null, key: account.key, uid_validity: null, last_uid: 0 })
    }
    return known
  }

  const { data: inserted, error: insertError } = await client
    .from('mail_accounts')
    .insert(
      missing.map((account) => ({
        user_id: userId,
        key: account.key,
        label: account.label,
        email: account.email,
        provider: account.provider,
        folder: account.folder,
      })),
    )
    .select(ACCOUNT_COLUMNS)
  if (insertError) throw new Error(`Не удалось завести ящик в базе: ${insertError.message}`)

  for (const row of inserted ?? []) known.set(row.key, row)
  return known
}

/**
 * Письма пишутся партиями. ignoreDuplicates не даёт затереть уже сохранённое письмо,
 * поэтому повторный запуск не сбрасывает «прочитано» и «в архиве».
 */
export async function upsertMessages(client, rows, { dryRun = false, chunkSize = CHUNK_SIZE } = {}) {
  if (rows.length === 0) return { inserted: 0, skipped: 0, wouldInsert: 0 }
  if (dryRun) return { inserted: 0, skipped: 0, wouldInsert: rows.length }

  let inserted = 0
  let skipped = 0

  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize)
    const { data, error } = await client
      .from('mail_messages')
      .upsert(chunk, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
      .select('id')

    if (!error) {
      inserted += Array.isArray(data) ? data.length : chunk.length
      continue
    }

    // Конфликт по второму уникальному ключу (account_id, uid) — так бывает после
    // перенумерации UID в ящике. Одно письмо не должно ронять всю партию.
    if (!isUniqueViolation(error)) throw new Error(`Не удалось сохранить письма: ${error.message}`)

    for (const row of chunk) {
      const single = await client
        .from('mail_messages')
        .upsert([row], { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
        .select('id')
      if (!single.error) {
        inserted += Array.isArray(single.data) ? single.data.length : 1
        continue
      }
      if (!isUniqueViolation(single.error)) throw new Error(`Не удалось сохранить письмо: ${single.error.message}`)
      skipped += 1
    }
  }

  return { inserted, skipped, wouldInsert: rows.length }
}

function isUniqueViolation(error) {
  return error?.code === '23505' || /duplicate key value/i.test(error?.message ?? '')
}

export async function saveAccountState(client, { accountId, uidValidity, lastUid, lastError = null, nowIso, dryRun = false }) {
  if (dryRun || !accountId) return false
  const { error } = await client
    .from('mail_accounts')
    .update({
      uid_validity: uidValidity ?? null,
      last_uid: Number(lastUid ?? 0),
      last_sync_at: nowIso,
      last_error: lastError,
    })
    .eq('id', accountId)
  if (error) throw new Error(`Не удалось сохранить состояние ящика: ${error.message}`)
  return true
}

/** Ошибка подключения к ящику: пишется в last_error, поэтому чистится от паролей. */
export async function saveAccountError(client, { accountId, message, nowIso, dryRun = false }) {
  if (dryRun || !accountId) return false
  const { error } = await client
    .from('mail_accounts')
    .update({ last_error: message, last_sync_at: nowIso })
    .eq('id', accountId)
  if (error) throw new Error(`Не удалось записать ошибку ящика: ${error.message}`)
  return true
}
