import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { BottomSheet } from '../components/BottomSheet'
import { ListPicker } from '../components/ListChips'
import { FOCUS_RING, SplashScreen } from '../components/states'
import { useData } from '../data/dataContext'
import { addDaysISO, formatDueLabel, parseISODate, toISODate, todayISO, weekdayOf } from '../lib/dates'
import {
  computeRemindAt,
  describeReminderOffset,
  dueMoment,
  formatReminderMoment,
  isPresetOffset,
  MAX_OFFSET_MINUTES,
  offsetFromRemindAt,
  REMINDER_CHOICES,
  type ReminderChoice,
} from '../lib/reminders'
import { PRIORITY_DOT, PRIORITY_LABELS, WEEKDAY_LABELS } from '../lib/labels'
import { emptyDraft, type Priority, type RepeatType, type Task, type TaskDraft } from '../lib/types'

const REPEAT_OPTIONS: { value: RepeatType; label: string }[] = [
  { value: 'none', label: 'Нет' },
  { value: 'daily', label: 'Дни' },
  { value: 'weekly', label: 'Недели' },
  { value: 'monthly', label: 'Месяц' },
]

function draftFromTask(task: Task): TaskDraft {
  return {
    title: task.title,
    note: task.note,
    listId: task.listId,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    priority: task.priority,
    repeatType: task.repeatType,
    repeatInterval: task.repeatInterval,
    repeatWeekdays: task.repeatWeekdays,
    repeatDayOfMonth: task.repeatDayOfMonth,
    remindOffsetMinutes: offsetFromRemindAt(task.dueDate, task.dueTime, task.remindAt),
  }
}

export function TaskEditorScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { tasks, lists, loading, addTask, saveTask, removeTask } = useData()
  const todayIso = todayISO()

  const existing = useMemo(() => (id ? (tasks.find((task) => task.id === id) ?? null) : null), [id, tasks])
  // Черновик может прийти из другого экрана — например, «Создать задачу» из письма.
  const location = useLocation()
  const incomingDraft = (location.state as { draft?: TaskDraft } | null)?.draft ?? null
  const [draft, setDraft] = useState<TaskDraft | null>(() => (id ? null : (incomingDraft ?? emptyDraft())))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [customMode, setCustomMode] = useState(false)
  const [customError, setCustomError] = useState<string | null>(null)
  const dueDateRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (id && !draft && existing) setDraft(draftFromTask(existing))
  }, [id, draft, existing])

  useEffect(() => {
    const offset = draft?.remindOffsetMinutes ?? null
    if (offset !== null && !isPresetOffset(offset)) setCustomMode(true)
  }, [draft])

  if (!draft) {
    if (loading || existing) return <SplashScreen />
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-slate-600">Задача не найдена.</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className={`h-11 rounded-lg border border-slate-300 px-4 text-sm ${FOCUS_RING}`}
        >
          На главную
        </button>
      </div>
    )
  }

  const update = (patch: Partial<TaskDraft>) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev))

  const remindAt = computeRemindAt(draft.dueDate, draft.dueTime, draft.remindOffsetMinutes)
  const remindMoment = remindAt ? new Date(remindAt) : null
  const remindInPast = remindMoment ? remindMoment.getTime() < Date.now() : false
  const customDate = remindMoment ? toISODate(remindMoment) : ''
  const customTime = remindMoment
    ? `${String(remindMoment.getHours()).padStart(2, '0')}:${String(remindMoment.getMinutes()).padStart(2, '0')}`
    : ''
  const notificationsReady = typeof Notification !== 'undefined' && Notification.permission === 'granted'
  // Без выбранного напоминания режим «своё время» не активен: иначе после снятия срока
  // одновременно подсвечивались бы «Нет» и «Своё время», а пустые поля ничего не меняли.
  const customActive = customMode && draft.remindOffsetMinutes !== null

  const pickReminder = (choice: ReminderChoice) => {
    setCustomError(null)
    if (choice.kind === 'none') {
      setCustomMode(false)
      update({ remindOffsetMinutes: null })
      return
    }
    if (choice.kind === 'preset') {
      setCustomMode(false)
      update({ remindOffsetMinutes: choice.minutes })
      return
    }
    setCustomMode(true)
    update({ remindOffsetMinutes: draft.remindOffsetMinutes ?? 60 })
  }

  const applyCustomReminder = (dateValue: string, timeValue: string) => {
    const due = dueMoment(draft.dueDate, draft.dueTime)
    if (!due || !dateValue || !timeValue) return
    const [year, month, day] = dateValue.split('-').map(Number)
    const [hours, minutes] = timeValue.split(':').map(Number)
    const chosen = new Date(year, month - 1, day, hours, minutes, 0, 0)
    const offset = Math.round((due.getTime() - chosen.getTime()) / 60_000)
    if (Math.abs(offset) > MAX_OFFSET_MINUTES) {
      setCustomError('Напоминание должно быть в пределах 30 дней от срока')
      return
    }
    setCustomError(null)
    update({ remindOffsetMinutes: offset })
  }

  const setRepeat = (repeatType: RepeatType) => {
    const dueDate = draft.dueDate ?? (repeatType === 'none' ? null : todayIso)
    if (repeatType === 'none') {
      update({ repeatType, repeatWeekdays: [], repeatDayOfMonth: null, repeatInterval: 1 })
      return
    }
    if (repeatType === 'weekly') {
      update({
        repeatType,
        dueDate,
        repeatWeekdays: draft.repeatWeekdays.length > 0 ? draft.repeatWeekdays : [weekdayOf(dueDate ?? todayIso)],
        repeatDayOfMonth: null,
      })
      return
    }
    if (repeatType === 'monthly') {
      update({
        repeatType,
        dueDate,
        repeatDayOfMonth: parseISODate(dueDate ?? todayIso).getDate(),
        repeatWeekdays: [],
      })
      return
    }
    update({ repeatType, dueDate, repeatInterval: Math.max(1, draft.repeatInterval), repeatWeekdays: [], repeatDayOfMonth: null })
  }

  const toggleWeekday = (day: number) => {
    const next = draft.repeatWeekdays.includes(day)
      ? draft.repeatWeekdays.filter((item) => item !== day)
      : [...draft.repeatWeekdays, day]
    update({ repeatWeekdays: next.sort((a, b) => a - b) })
  }

  const save = async () => {
    if (!draft.title.trim()) return
    setBusy(true)
    setError(null)
    try {
      if (existing) await saveTask(existing.id, draft)
      else await addTask(draft)
      navigate(-1)
    } catch (cause) {
      console.error(cause)
      setError('Не удалось сохранить задачу. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!existing) return
    setBusy(true)
    setError(null)
    try {
      await removeTask(existing.id)
      navigate(-1)
    } catch (cause) {
      console.error(cause)
      setError('Не удалось удалить задачу. Попробуйте ещё раз.')
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
        <h1 className="text-base font-semibold">{existing ? 'Задача' : 'Новая задача'}</h1>
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
          <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="task-title">
            Название
          </label>
          <textarea
            id="task-title"
            rows={2}
            autoFocus={!existing}
            value={draft.title}
            onChange={(event) => update({ title: event.target.value.slice(0, 200) })}
            className="w-full resize-none rounded-xl border border-slate-300 bg-white p-3 text-lg outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="task-note">
            Заметка
          </label>
          <textarea
            id="task-note"
            rows={3}
            value={draft.note ?? ''}
            onChange={(event) => update({ note: event.target.value || null })}
            placeholder="Заметка"
            className="w-full resize-none rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">Список</p>
          <ListPicker lists={lists} value={draft.listId} onChange={(listId) => update({ listId })} />
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">Срок</p>
          <div className="mb-2 flex flex-wrap gap-2">
            {(
              [
                ['Сегодня', todayIso],
                ['Завтра', addDaysISO(todayIso, 1)],
                ['Через неделю', addDaysISO(todayIso, 7)],
                ['Без даты', null],
              ] as const
            ).map(([label, date]) => (
              <button
                key={label}
                type="button"
                onClick={() =>
                  update({
                    dueDate: date,
                    dueTime: date ? draft.dueTime : null,
                    // Без срока напоминание невозможно — снимаем его вместе с датой.
                    remindOffsetMinutes: date ? draft.remindOffsetMinutes : null,
                  })
                }
                className={`h-10 rounded-lg border px-3 text-sm ${FOCUS_RING} ${
                  draft.dueDate === date ? 'border-transparent bg-slate-900 text-white' : 'border-slate-300 bg-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            ref={dueDateRef}
            type="date"
            aria-label="Дата срока"
            value={draft.dueDate ?? ''}
            onChange={(event) =>
              update({
                dueDate: event.target.value || null,
                remindOffsetMinutes: event.target.value ? draft.remindOffsetMinutes : null,
              })
            }
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
          />
          {draft.dueDate ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="time"
                aria-label="Время срока"
                value={draft.dueTime ?? ''}
                onChange={(event) => update({ dueTime: event.target.value || null })}
                className="h-12 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-base"
              />
              {draft.dueTime ? (
                <button
                  type="button"
                  onClick={() => update({ dueTime: null })}
                  className={`h-12 rounded-xl px-3 text-sm text-slate-500 ${FOCUS_RING}`}
                >
                  Убрать время
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-slate-500" id="remind-label">
            Напоминание
          </p>

          {draft.dueDate ? (
            <>
              <div role="group" aria-labelledby="remind-label" className="flex flex-wrap gap-2">
                {REMINDER_CHOICES.map((choice) => {
                  const active =
                    choice.kind === 'none'
                      ? draft.remindOffsetMinutes === null
                      : choice.kind === 'custom'
                        ? customActive
                        : !customActive && draft.remindOffsetMinutes === choice.minutes
                  return (
                    <button
                      key={choice.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => pickReminder(choice)}
                      className={`inline-flex h-11 items-center gap-2 rounded-full border px-3 text-sm ${FOCUS_RING} ${
                        active
                          ? 'border-transparent bg-slate-900 text-white'
                          : 'border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      {choice.label}
                    </button>
                  )
                })}
              </div>

              {customActive ? (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="date"
                      aria-label="Дата напоминания"
                      value={customDate}
                      onChange={(event) => applyCustomReminder(event.target.value, customTime)}
                      className="h-12 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-base"
                    />
                    <input
                      type="time"
                      aria-label="Время напоминания"
                      value={customTime}
                      onChange={(event) => applyCustomReminder(customDate, event.target.value)}
                      className="h-12 w-28 rounded-xl border border-slate-300 bg-white px-3 text-base"
                    />
                  </div>
                  {customError ? <p className="mt-1 text-xs text-rose-600">{customError}</p> : null}
                </>
              ) : null}

              {draft.remindOffsetMinutes !== null && remindAt ? (
                remindInPast ? (
                  <p role="status" className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900">
                    Это время уже прошло — уведомление не придёт. Задача сохранится.
                  </p>
                ) : (
                  <p aria-live="polite" className="mt-2 text-xs text-slate-500">
                    Напомним {formatReminderMoment(remindAt)}
                    {customActive ? ` · ${describeReminderOffset(draft.remindOffsetMinutes)}` : ''}
                  </p>
                )
              ) : null}

              {draft.remindOffsetMinutes !== null && !draft.dueTime ? (
                <p className="mt-1 text-xs text-slate-500">Время срока не задано, считаем 09:00.</p>
              ) : null}

              {draft.remindOffsetMinutes !== null && !notificationsReady ? (
                <p className="mt-2 text-xs text-slate-500">
                  Напоминание сохранится, но уведомления на этом устройстве выключены.{' '}
                  <Link to="/settings" className={`font-medium text-blue-600 ${FOCUS_RING}`}>
                    Включить
                  </Link>
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Напоминание можно поставить, когда задан срок.{' '}
              <button
                type="button"
                onClick={() => dueDateRef.current?.focus()}
                className={`h-11 rounded-lg align-middle text-sm font-medium text-blue-600 ${FOCUS_RING}`}
              >
                Задать дату
              </button>
            </p>
          )}
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">Повтор</p>
          <div className="flex rounded-xl bg-slate-200 p-1">
            {REPEAT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={draft.repeatType === option.value}
                onClick={() => setRepeat(option.value)}
                className={`h-10 flex-1 rounded-lg text-sm font-medium ${FOCUS_RING} ${
                  draft.repeatType === option.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {draft.repeatType === 'daily' ? (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-slate-600">каждые</span>
              <button
                type="button"
                aria-label="Уменьшить интервал"
                onClick={() => update({ repeatInterval: Math.max(1, draft.repeatInterval - 1) })}
                className={`h-11 w-11 rounded-lg border border-slate-300 bg-white text-lg ${FOCUS_RING}`}
              >
                −
              </button>
              <input
                inputMode="numeric"
                aria-label="Интервал в днях"
                value={draft.repeatInterval}
                onChange={(event) => {
                  const next = Number(event.target.value.replace(/\D/g, ''))
                  update({ repeatInterval: Math.min(31, Math.max(1, next || 1)) })
                }}
                className="h-11 w-14 rounded-lg border border-slate-300 bg-white text-center text-base"
              />
              <button
                type="button"
                aria-label="Увеличить интервал"
                onClick={() => update({ repeatInterval: Math.min(31, draft.repeatInterval + 1) })}
                className={`h-11 w-11 rounded-lg border border-slate-300 bg-white text-lg ${FOCUS_RING}`}
              >
                +
              </button>
              <span className="text-sm text-slate-600">дн.</span>
            </div>
          ) : null}

          {draft.repeatType === 'weekly' ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAY_LABELS.map((label, index) => {
                const day = index + 1
                const selected = draft.repeatWeekdays.includes(day)
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

          {draft.repeatType === 'monthly' ? (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">каждое</span>
                <input
                  inputMode="numeric"
                  aria-label="Число месяца"
                  value={draft.repeatDayOfMonth ?? ''}
                  onChange={(event) => {
                    const next = Number(event.target.value.replace(/\D/g, ''))
                    update({ repeatDayOfMonth: next ? Math.min(31, Math.max(1, next)) : null })
                  }}
                  className="h-11 w-16 rounded-lg border border-slate-300 bg-white text-center text-base"
                />
                <span className="text-sm text-slate-600">число</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">31 число в коротком месяце переносится на последний день.</p>
            </div>
          ) : null}
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">Приоритет</p>
          <div className="flex flex-wrap gap-2">
            {([0, 1, 2, 3] as Priority[]).map((priority) => (
              <button
                key={priority}
                type="button"
                aria-pressed={draft.priority === priority}
                onClick={() => update({ priority })}
                className={`inline-flex h-11 items-center gap-2 rounded-full border px-3 text-sm ${FOCUS_RING} ${
                  draft.priority === priority
                    ? 'border-transparent bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-700'
                }`}
              >
                {priority > 0 ? (
                  <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[priority]}`} aria-hidden="true" />
                ) : null}
                {priority === 0 ? 'Нет' : PRIORITY_LABELS[priority]}
              </button>
            ))}
          </div>
        </div>

        {existing?.lastCompletedAt ? (
          <p className="text-xs text-slate-500">
            Последняя отметка: {formatDueLabel(existing.lastCompletedAt.slice(0, 10), null, todayIso)}
          </p>
        ) : null}

        {existing ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className={`h-12 w-full rounded-xl border border-rose-200 text-rose-600 ${FOCUS_RING}`}
          >
            Удалить задачу
          </button>
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
        <BottomSheet title="Удалить задачу?" onClose={() => setConfirmDelete(false)}>
          <p className="mb-3 text-sm text-slate-600">Отменить удаление будет нельзя.</p>
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
