import { useEffect } from 'react'
import { useMailContext, type MailContextValue } from './mailContext'

/** Подписка на общее состояние почты. Первый вызов запускает загрузку. */
export function useMail(): MailContextValue {
  const mail = useMailContext()
  const { ensureLoaded } = mail

  useEffect(() => {
    ensureLoaded()
  }, [ensureLoaded])

  return mail
}
