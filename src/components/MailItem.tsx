import { accountColor, formatMailDate, isUnread, senderLabel, subjectOrFallback } from '../lib/mail'
import { LIST_COLORS } from '../lib/labels'
import type { MailAccount, MailMessage } from '../lib/types'
import { Icon } from './Icon'
import { FOCUS_RING } from './states'

interface MailItemProps {
  message: MailMessage
  account: MailAccount | null
  accountIndex: number
  todayIso: string
  hideAccountChip?: boolean
  onOpen: (message: MailMessage) => void
}

export function MailItem({ message, account, accountIndex, todayIso, hideAccountChip = false, onOpen }: MailItemProps) {
  const unread = isUnread(message)

  return (
    <li className="mb-2">
      <button
        type="button"
        onClick={() => onOpen(message)}
        className={`flex min-h-[4.5rem] w-full items-start gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 text-left active:bg-slate-50 ${FOCUS_RING} ${
          unread ? 'bg-white' : 'bg-white/70'
        }`}
      >
        {unread ? (
          <>
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
            <span className="sr-only">Не прочитано.</span>
          </>
        ) : (
          <span className="mt-2 h-2 w-2 shrink-0" aria-hidden="true" />
        )}

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span
              className={`min-w-0 flex-1 truncate text-[15px] leading-snug ${
                unread ? 'font-semibold text-slate-900' : 'text-slate-700'
              }`}
            >
              {senderLabel(message)}
            </span>
            <span className="shrink-0 text-xs text-slate-500">{formatMailDate(message.receivedAt, todayIso)}</span>
          </span>

          <span className="mt-0.5 flex items-center gap-1.5">
            <span
              className={`min-w-0 flex-1 truncate text-sm ${
                message.subject ? (unread ? 'font-medium text-slate-900' : 'text-slate-600') : 'text-slate-500'
              }`}
            >
              {subjectOrFallback(message)}
            </span>
            {message.hasAttachments ? (
              <>
                <Icon name="clip" className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="sr-only">Есть вложения.</span>
              </>
            ) : null}
          </span>

          {message.preview ? (
            <span className="mt-0.5 line-clamp-1 text-xs text-slate-500 [overflow-wrap:anywhere]">
              {message.preview}
            </span>
          ) : null}

          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {account && !hideAccountChip ? (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${LIST_COLORS[accountColor(accountIndex)].chip}`}>
                {account.label}
              </span>
            ) : null}
            {message.isBulk ? <span className="text-slate-400">Рассылка</span> : null}
            {message.archivedAt ? <span className="text-slate-400">В архиве</span> : null}
          </span>
        </span>
      </button>
    </li>
  )
}
