import type { ListColor, Priority } from './types'

export const PRIORITY_LABELS: Record<Priority, string> = {
  0: 'Без приоритета',
  1: 'Низкий',
  2: 'Средний',
  3: 'Высокий',
}

export const PRIORITY_DOT: Record<Priority, string> = {
  0: '',
  1: 'bg-slate-400',
  2: 'bg-amber-500',
  3: 'bg-rose-500',
}

export const LIST_COLORS: Record<ListColor, { dot: string; chip: string }> = {
  slate: { dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-700' },
  blue: { dot: 'bg-blue-500', chip: 'bg-blue-100 text-blue-800' },
  green: { dot: 'bg-green-500', chip: 'bg-green-100 text-green-800' },
  amber: { dot: 'bg-amber-500', chip: 'bg-amber-100 text-amber-900' },
  rose: { dot: 'bg-rose-500', chip: 'bg-rose-100 text-rose-800' },
  violet: { dot: 'bg-violet-500', chip: 'bg-violet-100 text-violet-800' },
}

export const LIST_COLOR_KEYS: ListColor[] = ['slate', 'blue', 'green', 'amber', 'rose', 'violet']

export const WEEKDAY_LABELS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']
