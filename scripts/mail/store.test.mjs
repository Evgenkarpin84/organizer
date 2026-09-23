import { describe, expect, it } from 'vitest'
import { loadAccounts, saveAccountError, saveAccountState, upsertMessages } from './store.mjs'

/** Подставной клиент Supabase: записывает вызовы и отдаёт заранее заданные ответы. */
function makeClient({ selectData = [], insertData = [], upsertData = null } = {}) {
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
        return builder(table, { data: upsertData ?? rows.map(() => ({ id: 'x' })), error: null })
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

const ACCOUNTS = [
  { key: 'mail1', label: 'Личная', email: 'a@bk.ru', provider: 'mailru', folder: 'INBOX' },
  { key: 'mail2', label: 'Рабочая', email: 'b@ya.ru', provider: 'yandex', folder: 'INBOX' },
]

describe('ящики в базе', () => {
  it('заводит недостающие ящики', async () => {
    const client = makeClient({
      selectData: [{ id: '1', key: 'mail1', uid_validity: '10', last_uid: 5 }],
      insertData: [{ id: '2', key: 'mail2', uid_validity: null, last_uid: 0 }],
    })
    const known = await loadAccounts(client, { userId: 'owner', accounts: ACCOUNTS })
    expect(known.get('mail2')).toMatchObject({ id: '2' })
    expect(client.calls.some((call) => call.method === 'insert')).toBe(true)
  })

  it('в режиме проверки ничего не пишет', async () => {
    const client = makeClient({ selectData: [] })
    const known = await loadAccounts(client, { userId: 'owner', accounts: ACCOUNTS, dryRun: true })
    expect(known.get('mail1')).toMatchObject({ id: null, last_uid: 0 })
    expect(client.calls.some((call) => ['insert', 'upsert', 'update'].includes(call.method))).toBe(false)
  })
})

describe('запись писем', () => {
  const rows = Array.from({ length: 120 }, (_, index) => ({
    user_id: 'owner',
    dedupe_key: `key-${index}`,
    uid: index,
  }))

  it('в dry-run считает письма и не трогает базу', async () => {
    const client = makeClient()
    const result = await upsertMessages(client, rows, { dryRun: true })
    expect(result).toEqual({ inserted: 0, skipped: 0, wouldInsert: 120 })
    expect(client.calls).toEqual([])
  })

  it('пишет партиями и не перезаписывает уже сохранённые письма', async () => {
    const client = makeClient()
    const result = await upsertMessages(client, rows, { chunkSize: 50 })
    const upserts = client.calls.filter((call) => call.method === 'upsert')
    expect(upserts).toHaveLength(3)
    expect(upserts[0].options).toEqual({ onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
    expect(upserts[0].rows).toHaveLength(50)
    expect(result.inserted).toBe(120)
  })

  it('при конфликте по второму ключу досылает письма по одному и не теряет партию', async () => {
    // Такое бывает после перенумерации UID в ящике: (account_id, uid) уже занят.
    const conflictClient = {
      from() {
        const chain = {
          select: () => chain,
          upsert(batch) {
            const conflict = batch.length > 1 || batch[0].uid === 2
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

    const result = await upsertMessages(conflictClient, rows.slice(0, 5), { chunkSize: 5 })
    expect(result.inserted).toBe(4)
    expect(result.skipped).toBe(1)
  })

  it('пустой список не вызывает базу', async () => {
    const client = makeClient()
    expect(await upsertMessages(client, [])).toEqual({ inserted: 0, skipped: 0, wouldInsert: 0 })
    expect(client.calls).toEqual([])
  })
})

describe('состояние ящика', () => {
  it('сохраняет точку догрузки', async () => {
    const client = makeClient()
    await saveAccountState(client, {
      accountId: '1',
      uidValidity: '77',
      lastUid: 120,
      nowIso: '2026-09-25T12:00:00.000Z',
    })
    const update = client.calls.find((call) => call.method === 'update')
    expect(update.patch).toMatchObject({ uid_validity: '77', last_uid: 120, last_error: null })
  })

  it('в dry-run состояние не трогает', async () => {
    const client = makeClient()
    expect(await saveAccountState(client, { accountId: '1', lastUid: 1, nowIso: 'now', dryRun: true })).toBe(false)
    expect(client.calls).toEqual([])
  })

  it('пишет ошибку подключения', async () => {
    const client = makeClient()
    await saveAccountError(client, { accountId: '1', message: 'Неверный пароль приложения', nowIso: 'now' })
    expect(client.calls.find((call) => call.method === 'update').patch.last_error).toContain('Неверный пароль')
  })
})
