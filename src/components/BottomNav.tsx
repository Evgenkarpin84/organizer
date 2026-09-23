import { NavLink } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import { FOCUS_RING } from './states'

const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Сегодня', icon: 'today', end: true },
  { to: '/tasks', label: 'Задачи', icon: 'tasks' },
  { to: '/mail', label: 'Почта', icon: 'mail' },
  { to: '/news', label: 'Новости', icon: 'news' },
  { to: '/habits', label: 'Привычки', icon: 'habits' },
]

export function BottomNav() {
  return (
    <nav
      aria-label="Разделы"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex h-16 flex-col items-center justify-center gap-1 text-[11px] leading-none ${FOCUS_RING} ${
                  isActive ? 'font-medium text-blue-600' : 'text-slate-500'
                }`
              }
            >
              <Icon name={tab.icon} className="h-6 w-6" />
              <span className="max-w-full truncate px-1">{tab.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
