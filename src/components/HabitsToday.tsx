import { Link } from 'react-router-dom'
import { useHabits } from '../data/useHabits'
import { activeHabits, isScheduledOn } from '../lib/habits'
import type { Habit } from '../lib/types'
import { Icon } from './Icon'
import { FOCUS_RING } from './states'

export interface HabitsTodayViewProps {
  habits: Habit[]
  doneToday: Set<string>
  error: string | null
  onToggle: (habit: Habit) => void
}

/** Блок на «Сегодня»: только привычки, запланированные на сегодня. */
export function HabitsTodayView({ habits, doneToday, error, onToggle }: HabitsTodayViewProps) {
  // Без привычек блок не нужен, но ошибку загрузки показать обязаны.
  if (habits.length === 0 && !error) return null
  const done = habits.filter((habit) => doneToday.has(habit.id)).length

  return (
    <section className="mt-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-600">
        Привычки
        {habits.length > 0 ? (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-normal text-slate-700">
            {done} из {habits.length}
          </span>
        ) : null}
        <Link to="/habits" aria-label="Открыть привычки" className={`ml-auto text-slate-400 ${FOCUS_RING}`}>
          <Icon name="habits" className="h-5 w-5" />
        </Link>
      </h2>

      {error ? <p className="mb-2 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900">{error}</p> : null}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {habits.map((habit) => {
          const checked = doneToday.has(habit.id)
          return (
            <button
              key={habit.id}
              type="button"
              aria-pressed={checked}
              aria-label={`Отметить «${habit.title}» на сегодня`}
              onClick={() => onToggle(habit)}
              className={`flex w-20 shrink-0 flex-col items-center gap-1 ${FOCUS_RING}`}
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full border-2 ${
                  checked ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-400'
                }`}
              >
                <Icon name="check" className="h-5 w-5" />
              </span>
              <span className="w-full truncate text-center text-xs text-slate-600">{habit.title}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function HabitsToday({ todayIso }: { todayIso: string }) {
  const { habits, entries, error, actionError, toggleEntry } = useHabits()

  const scheduled = activeHabits(habits).filter((habit) => isScheduledOn(habit, todayIso))
  const doneToday = new Set(entries.filter((entry) => entry.doneOn === todayIso).map((entry) => entry.habitId))

  return (
    <HabitsTodayView
      habits={scheduled}
      doneToday={doneToday}
      error={actionError ?? error}
      onToggle={(habit) => void toggleEntry(habit.id, todayIso)}
    />
  )
}
