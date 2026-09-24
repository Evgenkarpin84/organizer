// Проверка состояния органайзера: .env, база, напоминания, почта, новости, Планировщик. Запуск: npm run doctor
// Только чтение: ничего не пишет ни в базу, ни в почту. Значения секретов не печатаются.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import { parseAccounts, readOptions } from './mail/config.mjs'
import { TOO_LARGE_PREVIEW } from './mail/message.mjs'
import {
  TABLES,
  countLevels,
  envChecks,
  habitChecks,
  mailChecks,
  newsChecks,
  reminderChecks,
  renderReport,
  schedulerChecks,
  tableChecks,
} from './doctor/report.mjs'

const run = promisify(execFile)
const TASK_NAMES = ['Органайзер — почта', 'Органайзер — новости']
const REQUEST_TIMEOUT_MS = 15_000

async function count(query) {
  const { count: total, error } = await query
  if (error) throw new Error(error.message)
  return total ?? 0
}

function head(client, table) {
  return client.from(table).select('*', { count: 'exact', head: true })
}

async function checkTables(client, owner) {
  const results = []
  for (const [table] of TABLES) {
    try {
      results.push({ table, ok: true, count: await count(head(client, table).eq('user_id', owner)) })
    } catch {
      results.push({ table, ok: false, count: 0 })
    }
  }
  return results
}

/** Без пароля расписания функция отвечает 401 — значит, она задеплоена и жива. */
async function functionStatus(supabaseUrl) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    await response.body?.cancel()
    return response.status
  } catch {
    return 0
  }
}

async function reminderData(client, owner, supabaseUrl) {
  const nowIso = new Date().toISOString()
  const [status, subscriptions, upcoming, last] = await Promise.all([
    functionStatus(supabaseUrl),
    count(head(client, 'push_subscriptions').eq('user_id', owner)),
    count(head(client, 'tasks').eq('user_id', owner).is('completed_at', null).gt('remind_at', nowIso)),
    client
      .from('tasks')
      .select('remind_sent_at')
      .eq('user_id', owner)
      .not('remind_sent_at', 'is', null)
      .order('remind_sent_at', { ascending: false })
      .limit(1),
  ])
  return { functionStatus: status, subscriptions, upcoming, lastSentAt: last.data?.[0]?.remind_sent_at ?? null }
}

async function mailData(client, owner) {
  const { data, error } = await client
    .from('mail_accounts')
    .select('id, label, last_sync_at, last_error')
    .eq('user_id', owner)
    .order('key')
  if (error) throw new Error(error.message)

  const accounts = []
  for (const row of data ?? []) {
    const [messages, missingText] = await Promise.all([
      count(head(client, 'mail_messages').eq('account_id', row.id)),
      count(head(client, 'mail_messages').eq('account_id', row.id).eq('body_text', '').neq('preview', TOO_LARGE_PREVIEW)),
    ])
    accounts.push({ label: row.label, messages, missingText, lastSyncAt: row.last_sync_at, lastError: row.last_error })
  }
  return accounts
}

async function newsData(client, owner) {
  const { data, error } = await client
    .from('news_sources')
    .select('title, enabled, last_fetch_at, last_status, last_error')
    .eq('user_id', owner)
  if (error) throw new Error(error.message)
  const [items, unread] = await Promise.all([
    count(head(client, 'news_items').eq('user_id', owner)),
    count(head(client, 'news_items').eq('user_id', owner).is('read_at', null)),
  ])
  const sources = (data ?? []).map((row) => ({
    title: row.title,
    enabled: row.enabled,
    lastStatus: row.last_status,
    lastError: row.last_error,
    lastFetchAt: row.last_fetch_at,
  }))
  return { sources, items, unread }
}

async function habitData(client, owner) {
  const [habits, checklists] = await Promise.all([
    count(head(client, 'habits').eq('user_id', owner).is('archived_at', null)),
    count(head(client, 'checklists').eq('user_id', owner).is('archived_at', null)),
  ])
  return { habits, checklists }
}

/**
 * Состояние заданий Планировщика. Скрипт PowerShell передаётся в base64 (-EncodedCommand):
 * так кириллица в именах заданий и кавычки не ломаются при передаче аргументов.
 */
async function schedulerData() {
  if (process.platform !== 'win32') return []
  const names = TASK_NAMES.map((name) => `'${name}'`).join(',')
  const script = [
    '$ErrorActionPreference = "SilentlyContinue"',
    `$result = foreach ($name in @(${names})) {`,
    '  $task = Get-ScheduledTask -TaskName $name',
    '  if (-not $task) { [pscustomobject]@{ found = $false }; continue }',
    '  $info = $task | Get-ScheduledTaskInfo',
    '  [pscustomobject]@{',
    '    found = $true',
    '    last = $(if ($info.LastRunTime -and $info.LastRunTime.Year -gt 2000) { $info.LastRunTime.ToUniversalTime().ToString("o") } else { $null })',
    '    result = $info.LastTaskResult',
    '    next = $(if ($info.NextRunTime) { $info.NextRunTime.ToUniversalTime().ToString("o") } else { $null })',
    '  }',
    '}',
    'ConvertTo-Json -InputObject @($result) -Compress',
  ].join('\n')

  try {
    const encoded = Buffer.from(script, 'utf16le').toString('base64')
    const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
      timeout: 30_000,
      windowsHide: true,
    })
    const parsed = JSON.parse(stdout.trim() || '[]')
    // Порядок ответов совпадает с TASK_NAMES: имена обратно не читаем, чтобы не зависеть от кодировки консоли.
    return TASK_NAMES.map((name, index) => {
      const row = parsed[index] ?? { found: false }
      return {
        name,
        found: Boolean(row.found),
        lastRunAt: row.last ?? null,
        lastResult: row.result ?? null,
        nextRunAt: row.next ?? null,
      }
    })
  } catch {
    return TASK_NAMES.map((name) => ({ name, found: false }))
  }
}

async function section(title, load, build) {
  try {
    return { title, items: build(await load()) }
  } catch (cause) {
    return { title, items: [{ level: 'error', text: `Не удалось проверить: ${cause?.message ?? cause}`, hint: null }] }
  }
}

async function main() {
  try {
    process.loadEnvFile()
  } catch {
    console.error('Не найден файл .env — скопируйте .env.example и заполните переменные.')
    process.exitCode = 1
    return
  }

  const env = process.env
  const now = new Date()
  const { accounts, errors: accountErrors } = parseAccounts(env)
  const sections = [{ title: 'Настройки (.env)', items: envChecks(env, { accountCount: accounts.length, accountErrors }) }]

  const runtime = readOptions(env)
  if (runtime.errors.length > 0) {
    sections.push({ title: 'База', items: [{ level: 'error', text: 'Проверка базы пропущена: не хватает переменных выше', hint: null }] })
  } else {
    const client = createClient(runtime.supabaseUrl, runtime.serviceRoleKey, { auth: { persistSession: false } })
    const owner = runtime.ownerUserId
    sections.push(
      await section('База', () => checkTables(client, owner), tableChecks),
      await section('Напоминания', () => reminderData(client, owner, runtime.supabaseUrl), (data) => reminderChecks({ ...data, now })),
      await section('Почта', () => mailData(client, owner), (data) => mailChecks(data, now)),
      await section('Новости', () => newsData(client, owner), (data) => newsChecks({ ...data, now })),
      await section('Привычки и чеклисты', () => habitData(client, owner), habitChecks),
    )
  }

  sections.push(await section('Планировщик Windows', schedulerData, (tasks) => schedulerChecks(tasks, { platform: process.platform, now })))

  console.log(renderReport(sections, now))
  if (countLevels(sections).error > 0) process.exitCode = 1
}

main().catch((cause) => {
  console.error(`Непредвиденная ошибка: ${cause?.message ?? cause}`)
  process.exitCode = 1
})
