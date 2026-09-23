import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MailItem } from '../components/MailItem'
import { Section } from '../components/Section'
import { EmptyState, ErrorState, FOCUS_RING, SkeletonList } from '../components/states'
import { useMail } from '../data/useMail'
import { useStoredState } from '../data/useStoredState'
import { todayISO } from '../lib/dates'
import { LIST_COLORS } from '../lib/labels'
import {
  accountColor,
  describeSync,
  filterMessages,
  groupByAccount,
  groupByDate,
  unreadCount,
  type MailFilter,
  type MailGrouping,
} from '../lib/mail'
import type { MailAccount, MailMessage } from '../lib/types'

const FILTERS: [MailFilter, string][] = [
  ['all', 'Все'],
  ['unread', 'Непрочитанные'],
  ['archived', 'Архив'],
]

export interface MailViewProps {
  accounts: MailAccount[]
  messages: MailMessage[]
  loading: boolean
  error: string | null
  todayIso: string
  now?: Date
  onOpen: (message: MailMessage) => void
  onRetry: () => void
}

export function MailView({ accounts, messages, loading, error, todayIso, now = new Date(), onOpen, onRetry }: MailViewProps) {
  const [filter, setFilter] = useStoredState<MailFilter>('mail.filter', 'all')
  const [grouping, setGrouping] = useStoredState<MailGrouping>('mail.group', 'date')
  const [accountId, setAccountId] = useStoredState<string | null>('mail.account', null)

  const knownAccountId = accountId && accounts.some((account) => account.id === accountId) ? accountId : null
  const unread = unreadCount(messages)
  const visible = useMemo(
    () => filterMessages(messages, filter, knownAccountId),
    [messages, filter, knownAccountId],
  )
  const groups = useMemo(
    () => (grouping === 'date' ? groupByDate(visible, todayIso) : groupByAccount(visible, accounts)),
    [grouping, visible, todayIso, accounts],
  )

  const status = describeSync(accounts, unread, now, todayIso)
  const accountIndex = new Map(accounts.map((account, index) => [account.id, index]))
  const filtersTouched = filter !== 'all' || knownAccountId !== null
  const blocked = Boolean(error) && messages.length === 0

  const resetFilters = () => {
    setFilter('all')
    setAccountId(null)
  }

  return (
    <>
      <div role="tablist" aria-label="Фильтр писем" className="mb-2 flex rounded-xl bg-slate-200 p-1">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium ${FOCUS_RING} ${
              filter === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            <span className="truncate">{label}</span>
            {key === 'unread' && unread > 0 ? (
              <span className="shrink-0 rounded-full bg-blue-100 px-1.5 text-xs font-normal text-blue-800">{unread}</span>
            ) : null}
          </button>
        ))}
      </div>

      {accounts.length > 1 ? (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => setAccountId(null)}
            className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-sm ${FOCUS_RING} ${
              knownAccountId === null ? 'border-transparent bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'
            }`}
          >
            Все ящики
          </button>
          {accounts.map((account, index) => {
            const selected = knownAccountId === account.id
            const accountUnread = messages.filter(
              (message) => message.accountId === account.id && message.archivedAt === null && message.readAt === null,
            ).length
            return (
              <button
                key={account.id}
                type="button"
                onClick={() => setAccountId(account.id)}
                className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-sm ${FOCUS_RING} ${
                  selected ? 'border-transparent bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${LIST_COLORS[accountColor(index)].dot}`} aria-hidden="true" />
                {account.label}
                {accountUnread > 0 ? (
                  <span className={`text-xs ${selected ? 'text-slate-300' : 'text-slate-500'}`}>{accountUnread}</span>
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}

      {status.tone === 'warn' ? (
        <p role="status" className="mb-2 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900">
          {status.text}
        </p>
      ) : null}

      <div className="mb-1 flex items-center gap-2">
        <p className="min-w-0 flex-1 text-xs text-slate-500">{status.tone === 'ok' ? status.text : ''}</p>
        <div role="group" aria-label="Группировка" className="flex shrink-0 rounded-lg bg-slate-200 p-0.5">
          {(
            [
              ['date', 'Дата'],
              ['account', 'Ящик'],
            ] as [MailGrouping, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={grouping === key}
              onClick={() => setGrouping(key)}
              className={`h-9 rounded-md px-3 text-xs font-medium ${FOCUS_RING} ${
                grouping === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={onRetry} /> : null}
      {loading ? <SkeletonList count={4} /> : null}

      {!loading && !blocked && visible.length === 0 ? (
        <div className="mt-4">
          {filter === 'archived' && knownAccountId === null ? (
            <EmptyState icon="archive" title="В архиве пусто" hint="Сюда попадают письма, убранные кнопкой «В архив»" />
          ) : filtersTouched ? (
            <EmptyState
              icon="mail"
              title="Ничего не найдено"
              hint="Нет писем с такими фильтрами"
              action={
                <button
                  type="button"
                  onClick={resetFilters}
                  className={`mt-2 h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium ${FOCUS_RING}`}
                >
                  Сбросить фильтры
                </button>
              }
            />
          ) : (
            <EmptyState
              icon="mail"
              title="Писем пока нет"
              hint={
                accounts.length === 0
                  ? 'Настройте ящики в .env и запустите сбор почты на компьютере: npm run mail'
                  : 'Новых писем не было'
              }
            />
          )}
        </div>
      ) : null}

      {!loading && !blocked
        ? groups.map((group) => (
            <Section key={group.key} title={group.title} count={group.messages.length}>
              <ul>
                {group.messages.map((message) => (
                  <MailItem
                    key={message.id}
                    message={message}
                    account={accounts.find((account) => account.id === message.accountId) ?? null}
                    accountIndex={accountIndex.get(message.accountId) ?? 0}
                    todayIso={todayIso}
                    hideAccountChip={grouping === 'account' || knownAccountId !== null}
                    onOpen={onOpen}
                  />
                ))}
              </ul>
            </Section>
          ))
        : null}
    </>
  )
}

export function MailScreen() {
  const { accounts, messages, loading, error, reload } = useMail()
  const navigate = useNavigate()

  return (
    <MailView
      accounts={accounts}
      messages={messages}
      loading={loading}
      error={error}
      todayIso={todayISO()}
      onOpen={(message) => navigate(`/mail/${message.id}`)}
      onRetry={() => void reload()}
    />
  )
}
