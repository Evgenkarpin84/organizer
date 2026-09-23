import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Загрузка задач">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="mb-2 h-14 animate-pulse rounded-xl bg-slate-200" />
      ))}
    </div>
  )
}

export function SplashScreen() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-slate-500">
      <Icon name="today" className="h-10 w-10 text-slate-300" />
      <p className="text-sm">Загрузка…</p>
    </div>
  )
}

export function EmptyState({
  icon = 'today',
  title,
  hint,
  action,
}: {
  icon?: IconName
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center">
      <Icon name={icon} className="h-10 w-10 text-slate-300" />
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {action}
    </div>
  )
}

export function ErrorState({
  message,
  details,
  onRetry,
}: {
  message: string
  details?: string | null
  onRetry?: () => void
}) {
  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4">
      <p className="text-sm text-rose-700">{message}</p>
      {details ? <p className="mt-1 text-xs break-words text-rose-500">Причина: {details}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={`mt-3 h-11 rounded-lg border border-rose-300 px-4 text-sm font-medium text-rose-700 ${FOCUS_RING}`}
        >
          Повторить
        </button>
      ) : null}
    </div>
  )
}

export function OfflineBanner() {
  return (
    <p role="status" className="bg-amber-100 px-4 py-2 text-xs text-amber-900">
      Нет сети. Показаны последние загруженные данные.
    </p>
  )
}
