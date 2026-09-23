import { useCallback, useEffect, useState } from 'react'
import {
  currentSubscription,
  isPushSupported,
  readPushState,
  showTestNotification,
  subscribeToPush,
  unsubscribeFromPush,
  VAPID_PUBLIC_KEY,
  type PushState,
} from '../lib/push'
import { removeSubscription, saveSubscription } from './pushRepo'

export interface PushStatus {
  state: PushState
  busy: boolean
  error: string | null
  notice: string | null
  enable: () => Promise<void>
  disable: () => Promise<void>
  refresh: () => Promise<void>
  sendTest: () => Promise<void>
}

export function usePush(): PushStatus {
  const [subscribed, setSubscribed] = useState(false)
  const [state, setState] = useState<PushState>(() => (VAPID_PUBLIC_KEY ? 'default' : 'not-configured'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!isPushSupported() || !VAPID_PUBLIC_KEY) {
      setState(readPushState(false))
      return
    }
    try {
      const subscription = await currentSubscription()
      setSubscribed(Boolean(subscription))
      setState(readPushState(Boolean(subscription)))
      // Подписка есть в браузере — обновляем отметку последнего входа, чтобы строка не терялась.
      if (subscription) await saveSubscription(subscription)
    } catch (cause) {
      console.error(cause)
      setState(readPushState(false))
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const enable = useCallback(async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const subscription = await subscribeToPush()
      if (!subscription) {
        setState(readPushState(false))
        return
      }
      await saveSubscription(subscription)
      setSubscribed(true)
      setState(readPushState(true))
    } catch (cause) {
      console.error(cause)
      setError('Не удалось включить уведомления. Попробуйте ещё раз.')
      setState(readPushState(false))
    } finally {
      setBusy(false)
    }
  }, [])

  const disable = useCallback(async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const endpoint = await unsubscribeFromPush()
      if (endpoint) await removeSubscription(endpoint)
      setSubscribed(false)
      setState(readPushState(false))
      setNotice('Уведомления отключены на этом устройстве')
    } catch (cause) {
      console.error(cause)
      setError('Не удалось отключить уведомления. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  }, [])

  const sendTest = useCallback(async () => {
    setError(null)
    try {
      await showTestNotification()
      setNotice('Уведомление отправлено. Если его не видно, проверьте режим «Не беспокоить».')
    } catch (cause) {
      console.error(cause)
      setError('Не удалось показать уведомление. Попробуйте ещё раз.')
    }
  }, [])

  return { state: subscribed ? state : readPushStateSafe(state), busy, error, notice, enable, disable, refresh, sendTest }
}

/** Без подписки состояние «включено» показывать нельзя — там та же кнопка включения. */
function readPushStateSafe(state: PushState): PushState {
  return state === 'granted' ? 'default' : state
}
