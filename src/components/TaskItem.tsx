import { formatDueLabel } from '../lib/dates'
import { isDoneToday } from '../lib/grouping'
import { LIST_COLORS, PRIORITY_DOT, PRIORITY_LABELS } from '../lib/labels'
import { describeRepeat } from '../lib/recurrence'
import { formatReminderMoment, offsetFromRemindAt, shortReminderLabel } from '../lib/reminders'
import type { Task, TaskList } from '../lib/types'
import { Icon } from './Icon'
import { FOCUS_RING } from './states'

interface TaskItemProps {
  task: Task
  lists: TaskList[]
  todayIso: string
  /** Вхождение повтора, а не сам срок: отметить нельзя. */
  virtual?: boolean
  hideListChip?: boolean
  onToggle?: (task: Task) => void
  onOpen: (task: Task) => void
}

export function TaskItem({
  task,
  lists,
  todayIso,
  virtual = false,
  hideListChip = false,
  onToggle,
  onOpen,
}: TaskItemProps) {
  const list = task.listId ? (lists.find((item) => item.id === task.listId) ?? null) : null
  const done = Boolean(task.completedAt) || isDoneToday(task, todayIso)
  // Повторяющуюся задачу нельзя отметить дважды: следующий тап сдвинул бы срок ещё на период.
  const locked = done && task.repeatType !== 'none'
  const overdue = !done && task.dueDate !== null && task.dueDate < todayIso
  const dueLabel = formatDueLabel(task.dueDate, task.dueTime, todayIso)
  const repeatLabel = describeRepeat(task)
  // По выполненным и по вхождениям повтора уведомление не придёт — отметку не показываем.
  const reminderLabel =
    virtual || done ? null : shortReminderLabel(offsetFromRemindAt(task.dueDate, task.dueTime, task.remindAt))
  const dueClass = overdue ? 'font-medium text-rose-600' : task.dueDate === todayIso ? 'text-blue-700' : 'text-slate-500'

  return (
    <li
      className={`mb-2 flex items-start gap-3 rounded-xl border bg-white px-3 py-2.5 ${
        virtual ? 'border-dashed border-slate-300 bg-white/70' : 'border-slate-200 active:bg-slate-50'
      }`}
    >
      {virtual ? (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center text-slate-400">
          <Icon name="repeat" />
          <span className="sr-only">
            Повтор, отметить можно {formatDueLabel(task.dueDate, null, todayIso) ?? 'в день срока'}
          </span>
        </span>
      ) : locked ? (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-blue-600 bg-blue-600 text-white">
            <Icon name="check" className="h-4 w-4" />
          </span>
          <span className="sr-only">Выполнено сегодня, срок перенесён</span>
        </span>
      ) : (
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? `Снять отметку с «${task.title}»` : `Отметить «${task.title}» выполненной`}
          onClick={() => onToggle?.(task)}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${FOCUS_RING}`}
        >
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
              done ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
            }`}
          >
            {done ? <Icon name="check" className="h-4 w-4" /> : null}
          </span>
        </button>
      )}

      <button type="button" onClick={() => onOpen(task)} className={`min-w-0 flex-1 py-1 text-left ${FOCUS_RING}`}>
        <span className="flex items-start gap-2">
          <span
            className={`min-w-0 flex-1 text-[15px] leading-snug ${task.priority === 3 ? 'font-medium' : ''} ${
              done ? 'text-slate-400 line-through' : ''
            }`}
          >
            {task.title}
          </span>
          {task.priority > 0 ? (
            <>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} aria-hidden="true" />
              <span className="sr-only">Приоритет: {PRIORITY_LABELS[task.priority].toLowerCase()}</span>
            </>
          ) : null}
        </span>

        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {dueLabel ? <span className={dueClass}>{dueLabel}</span> : null}
          {list && !hideListChip ? (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${LIST_COLORS[list.color].chip}`}>
              {list.name}
            </span>
          ) : null}
          {repeatLabel ? <span className="text-slate-500">↻ {repeatLabel}</span> : null}
          {reminderLabel ? (
            <span className="inline-flex items-center gap-1 text-slate-500">
              <Icon name="bell" className="h-3.5 w-3.5" />
              {reminderLabel}
              <span className="sr-only">Напоминание: {formatReminderMoment(task.remindAt)}</span>
            </span>
          ) : null}
          {virtual ? (
            <span className="text-slate-400">Ближайший срок: {formatDueLabel(task.dueDate, null, todayIso)}</span>
          ) : null}
        </span>
      </button>
    </li>
  )
}
