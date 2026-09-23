import { requireSupabase } from '../lib/supabase'

export interface StoredSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

/** Подписка устройства: один endpoint — одна строка, повторный вход просто обновляет её. */
export async function saveSubscription(subscription: StoredSubscription): Promise<void> {
  const { error } = await requireSupabase()
    .from('push_subscriptions')
    .upsert(
      {
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        user_agent: typeof navigator === 'undefined' ? null : navigator.userAgent.slice(0, 200),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    )
  if (error) throw new Error(error.message)
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const { error } = await requireSupabase().from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) throw new Error(error.message)
}

export async function countSubscriptions(): Promise<number> {
  const { count, error } = await requireSupabase()
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
  if (error) throw new Error(error.message)
  return count ?? 0
}
