import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import type { MailMessage } from '../lib/types'
import { MailContext, type MailContextValue } from './mailContext'
import {
  fetchMailAccounts,
  fetchMailArchive,
  fetchMailInbox,
  fetchMailMessage,
  setMessageArchived,
  setMessageRead,
} from './mailRepo'

/**
 * Почта живёт в одном состоянии на список и карточку письма: иначе открытие письма
 * перекачивало бы весь список заново.
 */
export function MailProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<MailContextValue['accounts']>([])
  const [messages, setMessages] = useState<MailMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextAccounts, inbox, archive] = await Promise.all([
        fetchMailAccounts(),
        fetchMailInbox(),
        fetchMailArchive(),
      ])
      setAccounts(nextAccounts)
      setMessages([...inbox, ...archive])
    } catch (cause) {
      console.error(cause)
      setError('Не удалось загрузить письма. Проверьте связь и попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }, [])

  const ensureLoaded = useCallback(() => {
    if (started.current) return
    started.current = true
    void load()
  }, [load])

  const reload = useCallback(async () => {
    started.current = true
    await load()
  }, [load])

  /** Письмо по прямой ссылке: один запрос вместо перезагрузки всего списка. */
  const loadMessage = useCallback(async (id: string) => {
    try {
      const message = await fetchMailMessage(id)
      if (!message) return
      setMessages((current) => (current.some((item) => item.id === id) ? current : [...current, message]))
    } catch (cause) {
      console.error(cause)
    }
  }, [])

  const patchMessage = useCallback(
    async (id: string, patch: Partial<MailMessage>, save: () => Promise<void>, failure: string) => {
      let previous: MailMessage | null = null
      setMessages((current) => {
        previous = current.find((message) => message.id === id) ?? null
        return current.map((message) => (message.id === id ? { ...message, ...patch } : message))
      })
      setError(null)
      try {
        await save()
      } catch (cause) {
        console.error(cause)
        const restore = previous
        if (restore) setMessages((current) => current.map((message) => (message.id === id ? restore : message)))
        setError(failure)
      }
    },
    [],
  )

  const markRead = useCallback(
    async (id: string, read: boolean) => {
      const readAt = read ? new Date().toISOString() : null
      await patchMessage(id, { readAt }, () => setMessageRead(id, readAt), 'Не удалось изменить отметку о прочтении.')
    },
    [patchMessage],
  )

  const archive = useCallback(
    async (id: string, archived: boolean) => {
      const archivedAt = archived ? new Date().toISOString() : null
      await patchMessage(
        id,
        { archivedAt },
        () => setMessageArchived(id, archivedAt),
        archived ? 'Не удалось убрать письмо в архив.' : 'Не удалось вернуть письмо из архива.',
      )
    },
    [patchMessage],
  )

  const value = useMemo<MailContextValue>(
    () => ({ accounts, messages, loading, error, ensureLoaded, reload, loadMessage, markRead, archive }),
    [accounts, messages, loading, error, ensureLoaded, reload, loadMessage, markRead, archive],
  )

  return <MailContext.Provider value={value}>{children}</MailContext.Provider>
}
