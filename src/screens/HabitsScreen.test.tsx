import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Checklist, ChecklistItem, Habit, HabitEntry } from '../lib/types'
import { HabitsView } from './HabitsScreen'

const TODAY = '2026-09-24'

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    title: 'Зарядка',
    note: null,
    goalType: 'daily',
    goalTimes: 3,
    goalWeekdays: [],
    position: 0,
    archivedAt: null,
    ...overrides,
  }
}

const HABITS = [makeHabit(), makeHabit({ id: 'h2', title: 'Старая привычка', position: 1, archivedAt: 'now' })]
const ENTRIES: HabitEntry[] = [
  { habitId: 'h1', doneOn: TODAY },
  { habitId: 'h1', doneOn: '2026-09-23' },
]
const CHECKLISTS: Checklist[] = [
  { id: 'c1', title: 'Сборы в поездку', position: 0, startedAt: null, lastCompletedAt: null, archivedAt: null },
]
const ITEMS: ChecklistItem[] = [
  { id: 'i1', checklistId: 'c1', text: 'Паспорт', position: 0, checkedAt: 'now' },
  { id: 'i2', checklistId: 'c1', text: 'Зарядка для телефона', position: 1, checkedAt: null },
]

function renderView(overrides: Partial<Parameters<typeof HabitsView>[0]> = {}) {
  const props = {
    habits: HABITS,
    entries: ENTRIES,
    checklists: CHECKLISTS,
    items: ITEMS,
    loading: false,
    error: null,
    actionError: null,
    todayIso: TODAY,
    onToggleDay: vi.fn(),
    onOpenHabit: vi.fn(),
    onOpenChecklist: vi.fn(),
    onCreateHabit: vi.fn(),
    onCreateChecklist: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  }
  render(<HabitsView {...props} />)
  return props
}

beforeEach(() => {
  localStorage.clear()
})

describe('вкладка «Привычки»', () => {
  it('показывает привычку с целью, серией и процентом', () => {
    renderView()
    expect(screen.getByText('Зарядка')).toBeInTheDocument()
    expect(screen.getByText(/каждый день/)).toBeInTheDocument()
    expect(screen.getByText('2 дня подряд')).toBeInTheDocument()
  })

  it('рисует сетку из семи дней и отмечает выбранный день', async () => {
    const props = renderView()
    const cells = screen.getAllByRole('button', { name: /отмечено|не отмечено|не запланировано/ })
    expect(cells).toHaveLength(7)

    await userEvent.click(cells[5]) // вчерашний день
    expect(props.onToggleDay).toHaveBeenCalledTimes(1)
    expect(props.onToggleDay).toHaveBeenCalledWith(expect.objectContaining({ id: 'h1' }), '2026-09-23')
  })

  it('показывает чеклист с прогрессом', () => {
    renderView()
    expect(screen.getByText('Сборы в поездку')).toBeInTheDocument()
    expect(screen.getByText('1 из 2')).toBeInTheDocument()
  })

  it('переключает набор на архив и запоминает выбор', async () => {
    renderView()
    await userEvent.click(screen.getByRole('tab', { name: 'Архив' }))
    expect(screen.getByText('Старая привычка')).toBeInTheDocument()
    expect(screen.queryByText('Зарядка')).not.toBeInTheDocument()
    expect(localStorage.getItem('habits.view')).toBe('"archived"')
  })

  it('пустые состояния привычек и чеклистов различаются', () => {
    renderView({ habits: [], checklists: [], items: [] })
    expect(screen.getByText('Привычек пока нет')).toBeInTheDocument()
    expect(screen.getByText('Чеклистов пока нет')).toBeInTheDocument()
  })

  it('создание открывается из одной кнопки', async () => {
    const props = renderView()
    await userEvent.click(screen.getByRole('button', { name: 'Создать' }))
    await userEvent.click(screen.getByRole('button', { name: 'Новый чеклист' }))
    expect(props.onCreateChecklist).toHaveBeenCalled()
  })

  it('открывает привычку и чеклист', async () => {
    const props = renderView()
    await userEvent.click(screen.getByText('Зарядка'))
    expect(props.onOpenHabit).toHaveBeenCalledWith(expect.objectContaining({ id: 'h1' }))

    await userEvent.click(screen.getByText('Сборы в поездку'))
    expect(props.onOpenChecklist).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }))
  })

  it('при ошибке загрузки показывает ErrorState, а не пустое состояние', () => {
    renderView({ habits: [], checklists: [], items: [], error: 'Не удалось загрузить привычки.' })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Привычек пока нет')).not.toBeInTheDocument()
  })

  it('ошибку отметки показывает отдельной строкой и не прячет список', () => {
    renderView({ actionError: 'Не удалось сохранить отметку. Попробуйте ещё раз.' })
    expect(screen.getByRole('status')).toHaveTextContent('Не удалось сохранить отметку')
    expect(screen.getByText('Зарядка')).toBeInTheDocument()
  })
})
