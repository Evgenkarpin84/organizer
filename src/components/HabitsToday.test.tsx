import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { Habit } from '../lib/types'
import { HabitsTodayView } from './HabitsToday'

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

function renderBlock(overrides: Partial<Parameters<typeof HabitsTodayView>[0]> = {}) {
  const props = {
    habits: [makeHabit(), makeHabit({ id: 'h2', title: 'Чтение' })],
    doneToday: new Set(['h1']),
    error: null,
    onToggle: vi.fn(),
    ...overrides,
  }
  render(
    <MemoryRouter>
      <HabitsTodayView {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('блок привычек на «Сегодня»', () => {
  it('показывает счётчик выполненных за сегодня', () => {
    renderBlock()
    expect(screen.getByText('1 из 2')).toBeInTheDocument()
  })

  it('отмечает привычку одним нажатием', async () => {
    const props = renderBlock()
    await userEvent.click(screen.getByRole('button', { name: 'Отметить «Чтение» на сегодня' }))
    expect(props.onToggle).toHaveBeenCalledTimes(1)
    expect(props.onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'h2' }))
  })

  it('отмеченная привычка помечена нажатой', () => {
    renderBlock()
    expect(screen.getByRole('button', { name: /Зарядка/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Чтение/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('без подходящих привычек блок не рендерится', () => {
    const { container } = render(
      <MemoryRouter>
        <HabitsTodayView habits={[]} doneToday={new Set()} error={null} onToggle={vi.fn()} />
      </MemoryRouter>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('ошибка видна, даже когда привычки не загрузились', () => {
    render(
      <MemoryRouter>
        <HabitsTodayView habits={[]} doneToday={new Set()} error="Не удалось загрузить привычки." onToggle={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Не удалось загрузить привычки.')).toBeInTheDocument()
  })

  it('ошибка показывается строкой внутри блока', () => {
    renderBlock({ error: 'Не удалось сохранить отметку.' })
    expect(screen.getByText('Не удалось сохранить отметку.')).toBeInTheDocument()
    expect(screen.getByText('Зарядка')).toBeInTheDocument()
  })
})
