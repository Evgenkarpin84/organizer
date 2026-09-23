import { useMemo, useState, type FormEvent } from 'react'
import { parseQuickAdd } from '../lib/quickAdd'
import type { TaskDraft, TaskList } from '../lib/types'
import { Icon } from './Icon'
import { FOCUS_RING } from './states'

const EXAMPLES = [
  'Позвонить маме завтра в 12:30',
  'Отчёт в пятницу !3 #Работа',
  'Зарядка каждый день',
  'Оплатить квартиру каждый месяц 25.09',
]

export function QuickAdd({
  lists,
  todayIso,
  onAdd,
  disabled = false,
}: {
  lists: TaskList[]
  todayIso: string
  onAdd: (draft: TaskDraft) => Promise<void>
  disabled?: boolean
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const parsed = useMemo(() => parseQuickAdd(value, lists, todayIso), [value, lists, todayIso])
  const hasInput = value.trim().length > 0

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!hasInput || disabled) return
    if (!parsed.title) {
      setError('Не осталось названия — допишите, что нужно сделать')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onAdd({
        title: parsed.title,
        note: null,
        listId: parsed.listId,
        dueDate: parsed.dueDate,
        dueTime: parsed.dueTime,
        priority: parsed.priority,
        repeatType: parsed.repeatType,
        repeatInterval: parsed.repeatInterval,
        repeatWeekdays: parsed.repeatWeekdays,
        repeatDayOfMonth: parsed.repeatDayOfMonth,
        remindOffsetMinutes: null,
      })
      setValue('')
    } catch (cause) {
      console.error(cause)
      setError('Не удалось добавить задачу. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="-mx-4 bg-slate-50 px-4 pb-2">
      <div
        className={`flex items-center gap-2 rounded-xl border bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 ${
          error ? 'border-rose-400' : 'border-slate-300'
        }`}
      >
        <input
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            if (error) setError(null)
          }}
          disabled={disabled || busy}
          enterKeyHint="done"
          aria-label="Новая задача"
          placeholder="Новая задача…"
          className="h-12 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400"
        />
        <button
          type="button"
          onClick={() => setHelpOpen((open) => !open)}
          aria-label="Подсказка по быстрому вводу"
          aria-expanded={helpOpen}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 ${FOCUS_RING}`}
        >
          <Icon name="help" />
        </button>
        <button
          type="submit"
          disabled={!hasInput || disabled || busy}
          aria-label="Добавить задачу"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-blue-600 disabled:text-slate-300 ${FOCUS_RING}`}
        >
          <Icon name="plus" className="h-6 w-6" />
        </button>
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1.5" aria-live="polite">
        {hasInput && parsed.title ? (
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{parsed.title}</span>
        ) : null}
        {hasInput
          ? parsed.hints.map((hint) => (
              <span key={hint} className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
                {hint}
              </span>
            ))
          : null}
      </div>

      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}

      {helpOpen ? (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
          <p className="mb-1 font-medium text-slate-700">Что понимает быстрый ввод</p>
          <ul className="list-inside list-disc space-y-0.5">
            {EXAMPLES.map((example) => (
              <li key={example}>{example}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  )
}
