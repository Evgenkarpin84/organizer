import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { parseISODate } from '../lib/dates'
import { describeGoal, formatStreak, habitColor, habitStreak, habitWeek, weekProgress } from '../lib/habits'
import { LIST_COLORS } from '../lib/labels'
import type { Habit } from '../lib/types'
import { Icon } from './Icon'
import { FOCUS_RING } from './states'

interface HabitRowProps {
  habit: Habit
  index: number
  doneDates: string[]
  todayIso: string
  onToggleDay: (habit: Habit, iso: string) => void
  onOpen: (habit: Habit) => void
}

export function HabitRow({ habit, index, doneDates, todayIso, onToggleDay, onOpen }: HabitRowProps) {
  const week = habitWeek(habit, doneDates, todayIso)
  const streak = formatStreak(habitStreak(habit, doneDates, todayIso))
  const progress = weekProgress(habit, doneDates, todayIso)

  return (
    <li className="mb-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${LIST_COLORS[habitColor(index)].dot}`} aria-hidden="true" />
        <button type="button" onClick={() => onOpen(habit)} className={`min-w-0 flex-1 text-left ${FOCUS_RING}`}>
          <span className="block truncate text-[15px] leading-snug">{habit.title}</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            {describeGoal(habit)} · {progress.percent} % за неделю
          </span>
        </button>
        <span className="shrink-0 text-xs text-slate-500">{streak}</span>
      </div>

      <div role="group" aria-label={`Отметки: ${habit.title}`} className="mt-2 flex gap-1">
        {week.map((day) => {
          const label = `${format(parseISODate(day.iso), 'EEEE, d MMMM', { locale: ru })}: ${
            day.done ? 'отмечено' : day.scheduled ? 'не отмечено' : 'не запланировано'
          }`
          return (
            <button
              key={day.iso}
              type="button"
              aria-pressed={day.done}
              aria-label={label}
              onClick={() => onToggleDay(habit, day.iso)}
              className={`flex h-12 flex-1 items-center justify-center rounded-lg border text-xs ${FOCUS_RING} ${
                day.done
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : day.scheduled
                    ? 'border-slate-300 bg-white text-slate-500'
                    : 'border-transparent bg-slate-100 text-slate-400'
              } ${day.isToday ? 'ring-2 ring-blue-200' : ''}`}
            >
              {day.done ? <Icon name="check" className="h-4 w-4" /> : day.dayOfMonth}
            </button>
          )
        })}
      </div>

      <div className="mt-1 flex gap-1" aria-hidden="true">
        {week.map((day) => (
          <span key={day.iso} className="flex-1 text-center text-[11px] text-slate-500">
            {day.weekdayLabel}
          </span>
        ))}
      </div>
    </li>
  )
}
