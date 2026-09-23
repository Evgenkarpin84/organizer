import { Icon } from '../components/Icon'

export function SupabaseMissingScreen() {
  const missing = [
    !import.meta.env.VITE_SUPABASE_URL ? 'VITE_SUPABASE_URL' : null,
    !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY && !import.meta.env.VITE_SUPABASE_ANON_KEY
      ? 'VITE_SUPABASE_PUBLISHABLE_KEY'
      : null,
  ].filter((name): name is string => name !== null)

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <Icon name="alert" className="h-10 w-10 text-amber-500" />
      <h1 className="text-lg font-semibold">Supabase не настроен</h1>
      <p className="max-w-sm text-sm text-slate-600">
        Создайте файл <code>.env</code> по образцу <code>.env.example</code> и перезапустите <code>npm run dev</code>.
      </p>
      <pre className="w-full max-w-sm overflow-x-auto rounded-lg bg-slate-900 p-3 text-left text-xs text-slate-100">
        VITE_SUPABASE_URL=https://ваш-проект.supabase.co{'\n'}
        VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
      </pre>
      {missing.length > 0 ? (
        <p className="text-xs text-rose-600">Не хватает: {missing.join(', ')}</p>
      ) : null}
      <p className="text-xs text-slate-500">Подробности — в README проекта.</p>
    </div>
  )
}
