import type { ReactNode } from 'react'

export function Section({
  title,
  count,
  tone = 'normal',
  children,
}: {
  title: string
  count?: number
  tone?: 'normal' | 'danger'
  children: ReactNode
}) {
  return (
    <section>
      <h2
        className={`mt-5 mb-2 flex items-center gap-2 text-sm font-semibold ${
          tone === 'danger' ? 'text-rose-600' : 'text-slate-600'
        }`}
      >
        {title}
        {typeof count === 'number' ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-normal ${
              tone === 'danger' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {count}
          </span>
        ) : null}
      </h2>
      {children}
    </section>
  )
}
