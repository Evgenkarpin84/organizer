import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { FOCUS_RING, SplashScreen } from '../components/states'
import { useMail } from '../data/useMail'
import { useOnline } from '../data/useOnline'
import { LIST_COLORS } from '../lib/labels'
import { accountColor, draftFromMail, formatMailFullDate, senderLabel, subjectOrFallback } from '../lib/mail'
import type { MailAccount, MailMessage } from '../lib/types'

export interface MailMessageViewProps {
  message: MailMessage
  account: MailAccount | null
  accountIndex: number
  online: boolean
  error: string | null
  onBack: () => void
  onToggleRead: () => void
  onToggleArchive: () => void
  onCreateTask: () => void
}

export function MailMessageView({
  message,
  account,
  accountIndex,
  online,
  error,
  onBack,
  onToggleRead,
  onToggleArchive,
  onCreateTask,
}: MailMessageViewProps) {
  const read = message.readAt !== null
  const archived = message.archivedAt !== null

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <header className="sticky top-0 z-20 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between gap-2 border-b border-slate-200 bg-white px-2 pt-[env(safe-area-inset-top)]">
        <button type="button" onClick={onBack} className={`h-11 rounded-lg px-3 text-sm text-slate-600 ${FOCUS_RING}`}>
          Назад
        </button>
        <h1 className="text-base font-semibold">Письмо</h1>
        <span className="h-11 w-16" aria-hidden="true" />
      </header>

      <div className="flex-1 space-y-3 px-4 py-4">
        <h2
          className={`text-lg leading-snug font-semibold [overflow-wrap:anywhere] ${
            message.subject ? 'text-slate-900' : 'text-slate-500'
          }`}
        >
          {subjectOrFallback(message)}
        </h2>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-sm font-medium text-slate-900 [overflow-wrap:anywhere]">{senderLabel(message)}</p>
          {message.fromEmail ? <p className="mt-0.5 text-xs break-all text-slate-500">{message.fromEmail}</p> : null}
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{formatMailFullDate(message.receivedAt)}</span>
            {account ? (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${LIST_COLORS[accountColor(accountIndex)].chip}`}>
                {account.label}
              </span>
            ) : null}
            {message.isBulk ? <span className="text-slate-400">Рассылка</span> : null}
          </p>

          {message.hasAttachments ? (
            <ul className="mt-2 space-y-1">
              {message.attachmentNames.map((name) => (
                <li key={name} className="flex items-start gap-1.5 text-xs text-slate-600">
                  <Icon name="clip" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{name}</span>
                </li>
              ))}
              <li className="text-xs text-slate-400">Файлы не скачиваются — откройте письмо в почтовом клиенте.</li>
            </ul>
          ) : null}
        </div>

        {message.bodyText ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{message.bodyText}</p>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            Текст письма не сохранён: он слишком большой или письмо состоит только из вложений. Откройте письмо в
            почтовом клиенте.
          </p>
        )}

        {message.bodyTruncated && message.bodyText ? (
          <p role="status" className="rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900">
            Текст письма сохранён не полностью. Полное письмо — в почтовом клиенте.
            {message.isBulk ? ' У рассылок сохраняются первые 500 символов.' : ''}
          </p>
        ) : null}
      </div>

      {error ? <p className="mx-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      <div className="sticky bottom-0 space-y-2 border-t border-slate-200 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onCreateTask}
          className={`h-12 w-full rounded-xl bg-blue-600 text-base font-medium text-white ${FOCUS_RING}`}
        >
          Создать задачу
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onToggleRead}
            disabled={!online}
            aria-label={read ? 'Отметить письмо непрочитанным' : 'Отметить письмо прочитанным'}
            className={`h-12 flex-1 rounded-xl border border-slate-300 text-sm disabled:text-slate-400 ${FOCUS_RING}`}
          >
            {read ? 'Непрочитано' : 'Прочитано'}
          </button>
          <button
            type="button"
            onClick={onToggleArchive}
            disabled={!online}
            className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 text-sm disabled:text-slate-400 ${FOCUS_RING}`}
          >
            <Icon name="archive" className="h-4 w-4 text-slate-500" />
            {archived ? 'Из архива' : 'В архив'}
          </button>
        </div>
        {!online ? <p className="text-xs text-slate-500">Нет сети — попробуйте позже</p> : null}
      </div>
    </div>
  )
}

export function MailMessageScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const online = useOnline()
  const { accounts, messages, loading, error, markRead, archive, loadMessage } = useMail()

  const message = messages.find((item) => item.id === id) ?? null
  const autoReadFor = useRef<string | null>(null)
  const requestedFor = useRef<string | null>(null)

  // Письмо по прямой ссылке может не попасть в загруженный список — добираем его отдельно.
  useEffect(() => {
    if (!id || message || loading || requestedFor.current === id) return
    requestedFor.current = id
    void loadMessage(id)
  }, [id, message, loading, loadMessage])

  // Отмечаем прочитанным один раз за открытие: иначе кнопка «Непрочитано» тут же отменялась бы.
  useEffect(() => {
    if (!message || !online) return
    if (autoReadFor.current === message.id) return
    autoReadFor.current = message.id
    if (message.readAt === null) void markRead(message.id, true)
  }, [message, markRead, online])

  if (!message) {
    if (loading) return <SplashScreen />
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-slate-600">Письмо не найдено.</p>
        <button
          type="button"
          onClick={() => navigate('/mail')}
          className={`h-11 rounded-lg border border-slate-300 px-4 text-sm ${FOCUS_RING}`}
        >
          К списку писем
        </button>
      </div>
    )
  }

  const accountIndex = accounts.findIndex((account) => account.id === message.accountId)

  return (
    <MailMessageView
      message={message}
      account={accounts[accountIndex] ?? null}
      accountIndex={accountIndex < 0 ? 0 : accountIndex}
      online={online}
      error={error}
      onBack={() => navigate(-1)}
      onToggleRead={() => void markRead(message.id, message.readAt === null)}
      onToggleArchive={() => void archive(message.id, message.archivedAt === null)}
      onCreateTask={() => navigate('/task/new', { state: { draft: draftFromMail(message) } })}
    />
  )
}
