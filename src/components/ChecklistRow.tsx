import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { checklistProgress } from '../lib/habits'
import type { Checklist, ChecklistItem } from '../lib/types'
import { FOCUS_RING } from './states'

interface ChecklistRowProps {
  checklist: Checklist
  items: ChecklistItem[]
  onOpen: (checklist: Checklist) => void
}

export function ChecklistRow({ checklist, items, onOpen }: ChecklistRowProps) {
  const progress = checklistProgress(items)
  const started = checklist.startedAt !== null || progress.done > 0

  let hint = 'Не начат'
  if (started) hint = 'Идёт прохождение'
  else if (checklist.lastCompletedAt) {
    hint = `Пройден ${format(new Date(checklist.lastCompletedAt), 'd MMMM', { locale: ru })}`
  }

  return (
    <li className="mb-2">
      <button
        type="button"
        onClick={() => onOpen(checklist)}
        className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left ${FOCUS_RING}`}
      >
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[15px] leading-snug">{checklist.title}</span>
          <span className="shrink-0 text-xs text-slate-500">{progress.label}</span>
        </span>
        <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <span className="block h-full rounded-full bg-blue-600" style={{ width: `${progress.percent}%` }} />
        </span>
        <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      </button>
    </li>
  )
}
