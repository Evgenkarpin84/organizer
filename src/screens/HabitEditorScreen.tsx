import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BottomSheet } from '../components/BottomSheet'
import { FOCUS_RING, SplashScreen } from '../components/states'
import { useHabits } from '../data/useHabits'
import { WEEKDAY_LABELS } from '../lib/labels'
import { emptyHabitDraft, type Habit, type HabitDraft, type HabitGoalType } from '../lib/types'

const GOALS: { value: HabitGoalType; label: string }[] = [
  { value: 'daily', label: 'Каждый день' },
  { value: 'times_per_week', label: 'Раз в неделю' },
  { value: 'weekdays', label: 'По дням' },
]

function draftFromHabit(habit: Habit): HabitDraft {
  return {
    title: habit.title,
    note: habit.note,
    goalType: habit.goalType,
    goalTimes: habit.goalTimes,
    goalWeekdays: habit.goalWeekdays,
  }
}

export function HabitEditorScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { habits, loading, saveHabit, setHabitArchived, removeHabit } = useHabits()

  const existing = id ? (habits.find((habit) => habit.id === id) ?? null) : null
  const [draft, setDraft] = useState<HabitDraft | null>(() => (id ? null : emptyHabitDraft()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (id && !draft && existing) setDraft(draftFromHabit(existing))
  }, [id, draft, existing])

  if (!draft) {
    if (loading || existing) return <SplashScreen />
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-slate-600">Привычка не найдена.</p>
        <button
          type="button"
          onClick={() => navigate('/habits')}
          className={`h-11 rounded-lg border border-slate-300 px-4 text-sm ${FOCUS_RING}`}
        >
          К привычкам
        </button>
      </div>
    )
  }

  const update = (patch: Partial<HabitDraft>) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev))

  const toggleWeekday = (day: number) => {
    const next = draft.goalWeekdays.includes(day)
      ? draft.goalWeekdays.filter((item) => item !== day)
      : [...draft.goalWeekdays, day]
    update({ goalWeekdays: next.sort((a, b) => a - b) })
  }

  const save = async () => {
    if (!draft.title.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await saveHabit(draft, existing?.id)
      navigate(-1)
    } catch (cause) {
      console.error(cause)
      setError('Не удалось сохранить привычку. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!existing) return
    setBusy(true)
    try {
      await removeHabit(existing.id)
      navigate('/habits')
    } catch (cause) {
      console.error(cause)
      setError('Не удалось удалить привычку. Попробуйте ещё раз.')
      setConfirmDelete(false)
    } finally {
      setBusy(false)
    }
  }

  const canSave = draft.title.trim().length > 0 && !busy

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <header className="sticky top-0 z-20 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between gap-2 border-b border-slate-200 bg-white px-2 pt-[env(safe-area-inset-top)]">
        <button type="button" onClick={() => navigate(-1)} className={`h-11 rounded-lg px-3 text-sm text-slate-600 ${FOCUS_RING}`}>
          Отмена
        </button>
        <h1 className="text-base font-semibold">{existing ? 'Привычка' : 'Новая привычка'}</h1>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!canSave}
          className={`h-11 rounded-lg px-3 text-sm font-semibold text-blue-600 disabled:text-slate-300 ${FOCUS_RING}`}
        >
          Сохранить
        </button>
      </header>

      <div className="flex-1 space-y-5 px-4 py-4">
        {error ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="habit-title">
            Название
          </label>
          <input
            id="habit-title"
            value={draft.title}
            autoFocus={!existing}
            onChange={(event) => update({ title: event.target.value.slice(0, 80) })}
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="habit-note">
            Заметка
          </label>
          <input
            id="habit-note"
            value={draft.note ?? ''}
            onChange={(event) => update({ note: event.target.value || null })}
            placeholder="Например: 20 минут, любая книга"
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
          />
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">Цель</p>
          <div className="flex rounded-xl bg-slate-200 p-1">
            {GOALS.map((goal) => (
              <button
                key={goal.value}
                type="button"
                aria-pressed={draft.goalType === goal.value}
                onClick={() => update({ goalType: goal.value })}
                className={`h-10 flex-1 rounded-lg text-sm font-medium ${FOCUS_RING} ${
                  draft.goalType === goal.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                {goal.label}
              </button>
            ))}
          </div>

          {draft.goalType === 'times_per_week' ? (
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                aria-label="Меньше раз в неделю"
                onClick={() => update({ goalTimes: Math.max(1, draft.goalTimes - 1) })}
                className={`h-11 w-11 rounded-lg border border-slate-300 bg-white text-lg ${FOCUS_RING}`}
              >
                −
              </button>
              <input
                inputMode="numeric"
                aria-label="Сколько раз в неделю"
                value={draft.goalTimes}
                onChange={(event) => {
                  const next = Number(event.target.value.replace(/\D/g, ''))
                  update({ goalTimes: Math.min(7, Math.max(1, next || 1)) })
                }}
                className="h-11 w-14 rounded-lg border border-slate-300 bg-white text-center text-base"
              />
              <button
                type="button"
                aria-label="Больше раз в неделю"
                onClick={() => update({ goalTimes: Math.min(7, draft.goalTimes + 1) })}
                className={`h-11 w-11 rounded-lg border border-slate-300 bg-white text-lg ${FOCUS_RING}`}
              >
                +
              </button>
              <span className="text-sm text-slate-600">раз в неделю</span>
            </div>
          ) : null}

          {draft.goalType === 'weekdays' ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAY_LABELS.map((label, index) => {
                const day = index + 1
                const selected = draft.goalWeekdays.includes(day)
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleWeekday(day)}
                    className={`h-11 w-11 rounded-full border text-sm ${FOCUS_RING} ${
                      selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>

        {existing ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void setHabitArchived(existing.id, existing.archivedAt === null)}
              className={`h-12 w-full rounded-xl border border-slate-300 bg-white text-sm ${FOCUS_RING}`}
            >
              {existing.archivedAt ? 'Вернуть из архива' : 'В архив'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className={`h-12 w-full rounded-xl border border-rose-200 text-rose-600 ${FOCUS_RING}`}
            >
              Удалить привычку
            </button>
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 border-t border-slate-200 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!canSave}
          className={`h-12 w-full rounded-xl bg-blue-600 text-base font-medium text-white disabled:bg-slate-300 ${FOCUS_RING}`}
        >
          {busy ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </div>

      {confirmDelete ? (
        <BottomSheet title="Удалить привычку?" onClose={() => setConfirmDelete(false)}>
          <p className="mb-3 text-sm text-slate-600">Отметки этой привычки тоже удалятся.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className={`h-12 flex-1 rounded-xl border border-slate-300 text-sm ${FOCUS_RING}`}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              className={`h-12 flex-1 rounded-xl bg-rose-600 text-sm font-medium text-white ${FOCUS_RING}`}
            >
              Удалить
            </button>
          </div>
        </BottomSheet>
      ) : null}
    </div>
  )
}
