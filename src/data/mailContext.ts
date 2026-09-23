import { createContext, useContext } from 'react'
import type { MailAccount, MailMessage } from '../lib/types'

export interface MailContextValue {
  accounts: MailAccount[]
  messages: MailMessage[]
  loading: boolean
  error: string | null
  /** Загружает почту при первом обращении: вкладка «Сегодня» её не ждёт. */
  ensureLoaded: () => void
  reload: () => Promise<void>
  loadMessage: (id: string) => Promise<void>
  markRead: (id: string, read: boolean) => Promise<void>
  archive: (id: string, archived: boolean) => Promise<void>
}

export const MailContext = createContext<MailContextValue | null>(null)

export function useMailContext(): MailContextValue {
  const value = useContext(MailContext)
  if (!value) throw new Error('useMail вызван вне MailProvider')
  return value
}
