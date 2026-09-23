import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { addDaysISO, capitalize, toISODate } from './dates'
import { LIST_COLOR_KEYS } from './labels'
import { emptyDraft, type ListColor, type MailAccount, type MailMessage, type TaskDraft } from './types'

/** Цвет ящика берётся из общей палитры по порядку: отдельного поля в базе нет. */
export function accountColor(index: number): ListColor {
  return LIST_COLOR_KEYS[index % LIST_COLOR_KEYS.length]
}

export type MailFilter = 'all' | 'unread' | 'archived'
export type MailGrouping = 'date' | 'account'

export interface MailGroup {
  key: string
  title: string
  messages: MailMessage[]
}

export function senderLabel(message: MailMessage): string {
  return message.fromName?.trim() || message.fromEmail || 'Отправитель неизвестен'
}

export function subjectOrFallback(message: MailMessage): string {
  return message.subject?.trim() || 'Письмо без темы'
}

export function isUnread(message: MailMessage): boolean {
  return message.readAt === null
}

export function unreadCount(messages: MailMessage[]): number {
  return messages.filter((message) => message.archivedAt === null && isUnread(message)).length
}

/** «Все» и «Непрочитанные» не показывают архив: архив — отдельный фильтр. */
export function filterMessages(
  messages: MailMessage[],
  filter: MailFilter,
  accountId: string | null = null,
): MailMessage[] {
  return messages
    .filter((message) => (accountId ? message.accountId === accountId : true))
    .filter((message) => {
      if (filter === 'archived') return message.archivedAt !== null
      if (message.archivedAt !== null) return false
      return filter === 'unread' ? isUnread(message) : true
    })
    .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1))
}

/** Время для сегодняшних писем, «Вчера» для вчерашних, иначе дата. */
export function formatMailDate(receivedAt: string, todayIso: string): string {
  const moment = new Date(receivedAt)
  if (Number.isNaN(moment.getTime())) return ''
  const day = toISODate(moment)
  if (day === todayIso) return format(moment, 'HH:mm')
  if (day === addDaysISO(todayIso, -1)) return 'Вчера'
  const sameYear = day.slice(0, 4) === todayIso.slice(0, 4)
  return format(moment, sameYear ? 'd MMM' : 'd MMM yyyy', { locale: ru })
}

/** «15 сентября, 12:40» — полная дата на экране письма. */
export function formatMailFullDate(receivedAt: string): string {
  const moment = new Date(receivedAt)
  if (Number.isNaN(moment.getTime())) return ''
  const sameYear = moment.getFullYear() === new Date().getFullYear()
  return format(moment, sameYear ? "d MMMM, HH:mm" : "d MMMM yyyy, HH:mm", { locale: ru })
}

export function formatMailGroupTitle(dayIso: string, todayIso: string): string {
  return dayTitle(dayIso, todayIso)
}

function dayTitle(dayIso: string, todayIso: string): string {
  if (dayIso === todayIso) return 'Сегодня'
  if (dayIso === addDaysISO(todayIso, -1)) return 'Вчера'
  const moment = new Date(`${dayIso}T12:00:00`)
  const sameYear = dayIso.slice(0, 4) === todayIso.slice(0, 4)
  return capitalize(format(moment, sameYear ? 'd MMMM' : 'd MMMM yyyy', { locale: ru }))
}

export function groupByDate(messages: MailMessage[], todayIso: string): MailGroup[] {
  const groups = new Map<string, MailMessage[]>()
  for (const message of messages) {
    const moment = new Date(message.receivedAt)
    const key = Number.isNaN(moment.getTime()) ? 'unknown' : toISODate(moment)
    const list = groups.get(key)
    if (list) list.push(message)
    else groups.set(key, [message])
  }

  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, list]) => ({
      key,
      title: key === 'unknown' ? 'Без даты' : dayTitle(key, todayIso),
      messages: list,
    }))
}

export function groupByAccount(messages: MailMessage[], accounts: MailAccount[]): MailGroup[] {
  const titles = new Map(accounts.map((account) => [account.id, account.label]))
  const groups = new Map<string, MailMessage[]>()
  for (const message of messages) {
    const list = groups.get(message.accountId)
    if (list) list.push(message)
    else groups.set(message.accountId, [message])
  }

  return [...groups.entries()].map(([key, list]) => ({
    key,
    title: titles.get(key) ?? 'Другой ящик',
    messages: list,
  }))
}

export interface SyncStatus {
  tone: 'ok' | 'warn'
  text: string
}

const SYNC_STALE_HOURS = 3

function hoursWord(value: number): string {
  const last = value % 10
  const tens = value % 100
  if (tens >= 11 && tens <= 14) return 'часов'
  if (last === 1) return 'час'
  if (last >= 2 && last <= 4) return 'часа'
  return 'часов'
}

/** Честная строка о том, когда скрипт на ПК последний раз приносил письма. */
export function describeSync(accounts: MailAccount[], unread: number, now: Date, todayIso: string): SyncStatus {
  if (accounts.length === 0) {
    return { tone: 'warn', text: 'Ящики ещё не настроены. Запустите сбор почты на компьютере: npm run mail' }
  }

  const broken = accounts.find((account) => account.lastError)
  if (broken) {
    return {
      tone: 'warn',
      text: `Ящик «${broken.label}» не обновляется: ${broken.lastError}. Остальные ящики в порядке.`,
    }
  }

  const stamps = accounts
    .map((account) => (account.lastSyncAt ? new Date(account.lastSyncAt).getTime() : null))
    .filter((value): value is number => value !== null && !Number.isNaN(value))

  if (stamps.length === 0) {
    return { tone: 'warn', text: 'Сбор писем ещё ни разу не запускался на компьютере.' }
  }

  const latest = new Date(Math.max(...stamps))
  const hours = Math.floor((now.getTime() - latest.getTime()) / 3_600_000)
  if (hours >= SYNC_STALE_HOURS) {
    return {
      tone: 'warn',
      text: `Письма не обновлялись ${hours} ${hoursWord(hours)}. Почту собирает скрипт на компьютере — при выключенном ПК новые письма не приходят.`,
    }
  }

  const when = toISODate(latest) === todayIso ? `сегодня в ${format(latest, 'HH:mm')}` : formatMailDate(latest.toISOString(), todayIso)
  const unreadText = unread > 0 ? `${unread} непрочитанных · ` : ''
  return { tone: 'ok', text: `${unreadText}обновлено ${when}` }
}

export function accountLabel(accounts: MailAccount[], accountId: string): string {
  return accounts.find((account) => account.id === accountId)?.label ?? 'Ящик'
}

/** Черновик задачи из письма: тема в названии, отправитель и начало текста в заметке. */
export function draftFromMail(message: MailMessage): TaskDraft {
  const sender = senderLabel(message)
  const title = message.subject?.trim() || `Письмо от ${sender}`
  const noteLines = [
    message.fromEmail ? `От: ${sender} <${message.fromEmail}>` : `От: ${sender}`,
    '',
    (message.bodyText ?? message.preview ?? '').slice(0, 500),
  ]

  return {
    ...emptyDraft(),
    title: title.slice(0, 200),
    note: noteLines.join('\n').trim() || null,
  }
}
