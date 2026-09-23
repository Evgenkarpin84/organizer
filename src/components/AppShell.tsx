import { Outlet, useLocation } from 'react-router-dom'
import { useOnline } from '../data/useOnline'
import { supabase } from '../lib/supabase'
import { BottomNav } from './BottomNav'
import { Icon } from './Icon'
import { FOCUS_RING, OfflineBanner } from './states'

const TITLES: Record<string, string> = {
  '/': 'Сегодня',
  '/tasks': 'Задачи',
  '/mail': 'Почта',
  '/news': 'Новости',
  '/habits': 'Привычки',
}

export function AppShell() {
  const location = useLocation()
  const online = useOnline()
  const title = TITLES[location.pathname] ?? 'Органайзер'

  return (
    <div className="flex min-h-full flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-2 border-b border-slate-200 bg-white/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
        <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>
        <button
          type="button"
          onClick={() => void supabase?.auth.signOut()}
          aria-label="Выйти из аккаунта"
          className={`flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 ${FOCUS_RING}`}
        >
          <Icon name="logout" />
        </button>
      </header>

      {online ? null : <OfflineBanner />}

      <main className="flex-1 px-4 pt-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}
