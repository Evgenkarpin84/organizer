import { LIST_COLORS } from '../lib/labels'
import type { TaskList } from '../lib/types'
import { FOCUS_RING } from './states'

export type ListFilter = 'all' | 'none' | string

const CHIP_BASE = `inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-sm ${FOCUS_RING}`

function chipClass(selected: boolean): string {
  return `${CHIP_BASE} ${selected ? 'border-transparent bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'}`
}

/** Фильтр на экране «Задачи»: «Все», списки, «Без списка». */
export function ListFilterChips({
  lists,
  value,
  onChange,
}: {
  lists: TaskList[]
  value: ListFilter
  onChange: (value: ListFilter) => void
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
      <button type="button" onClick={() => onChange('all')} className={chipClass(value === 'all')}>
        Все
      </button>
      {lists.map((list) => (
        <button key={list.id} type="button" onClick={() => onChange(list.id)} className={chipClass(value === list.id)}>
          <span className={`h-2 w-2 rounded-full ${LIST_COLORS[list.color].dot}`} aria-hidden="true" />
          {list.name}
        </button>
      ))}
      <button type="button" onClick={() => onChange('none')} className={chipClass(value === 'none')}>
        Без списка
      </button>
    </div>
  )
}

/** Выбор списка в редакторе задачи. */
export function ListPicker({
  lists,
  value,
  onChange,
}: {
  lists: TaskList[]
  value: string | null
  onChange: (value: string | null) => void
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      <button type="button" onClick={() => onChange(null)} className={chipClass(value === null)}>
        Без списка
      </button>
      {lists.map((list) => (
        <button key={list.id} type="button" onClick={() => onChange(list.id)} className={chipClass(value === list.id)}>
          <span className={`h-2 w-2 rounded-full ${LIST_COLORS[list.color].dot}`} aria-hidden="true" />
          {list.name}
        </button>
      ))}
    </div>
  )
}
