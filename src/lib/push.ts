import { urlBase64ToUint8Array } from './reminders'
import type { StoredSubscription } from '../data/pushRepo'

export type PushState = 'unsupported' | 'not-configured' | 'default' | 'denied' | 'granted'

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** Текущее состояние уведомлений на этом устройстве. */
export function readPushState(subscribed: boolean): PushState {
  if (!isPushSupported()) return 'unsupported'
  if (!VAPID_PUBLIC_KEY) return 'not-configured'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission === 'granted' && subscribed) return 'granted'
  return 'default'
}

function toStored(subscription: PushSubscription): StoredSubscription {
  const json = subscription.toJSON()
  const keys = json.keys ?? {}
  if (!json.endpoint || !keys.p256dh || !keys.auth) {
    throw new Error('Браузер вернул подписку без ключей')
  }
  return { endpoint: json.endpoint, p256dh: keys.p256dh, auth: keys.auth }
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const ready = await navigator.serviceWorker.getRegistration()
  if (ready) return ready
  return navigator.serviceWorker.ready
}

export async function currentSubscription(): Promise<StoredSubscription | null> {
  if (!isPushSupported()) return null
  const registered = await registration()
  const subscription = await registered.pushManager.getSubscription()
  return subscription ? toStored(subscription) : null
}

/** Запрашивает разрешение и оформляет подписку. Вернёт null, если разрешение не дали. */
export async function subscribeToPush(): Promise<StoredSubscription | null> {
  if (!isPushSupported()) throw new Error('Браузер не поддерживает push-уведомления')
  if (!VAPID_PUBLIC_KEY) throw new Error('Не задан публичный ключ VAPID')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  const registered = await registration()
  const existing = await registered.pushManager.getSubscription()
  if (existing) return toStored(existing)

  const subscription = await registered.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })
  return toStored(subscription)
}

/** Снимает подписку в браузере. Системное разрешение при этом не отзывается. */
export async function unsubscribeFromPush(): Promise<string | null> {
  if (!isPushSupported()) return null
  const registered = await registration()
  const subscription = await registered.pushManager.getSubscription()
  if (!subscription) return null
  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  return endpoint
}

export async function showTestNotification(): Promise<void> {
  const registered = await registration()
  await registered.showNotification('Органайзер', {
    body: 'Проверка уведомлений: так будет выглядеть напоминание.',
    tag: 'organizer-test',
    icon: './icons/icon-192.png',
  })
}
