import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Checklist, ChecklistItem } from '../lib/types'
import { ChecklistView } from './ChecklistScreen'

const CHECKLIST: Checklist = {
  id: 'c1',
  title: 'Сборы в поездку',
  position: 0,
  startedAt: null,
  lastCompletedAt: null,
  archivedAt: null,
}

const ITEMS: ChecklistItem[] = [
  { id: 'i1', checklistId: 'c1', text: 'Паспорт', position: 0, checkedAt: '2026-09-24T09:00:00.000Z' },
  { id: 'i2', checklistId: 'c1', text: 'Зарядка для телефона', position: 1, checkedAt: null },
]

function renderView(overrides: Partial<Parameters<typeof ChecklistView>[0]> = {}) {
  const props = {
    checklist: CHECKLIST,
    items: ITEMS,
    actionError: null,
    onBack: vi.fn(),
    onToggleItem: vi.fn(),
    onAddItem: vi.fn(),
    onRenameItem: vi.fn(),
    onRemoveItem: vi.fn(),
    onFinish: vi.fn(),
    onRestart: vi.fn(),
    ...overrides,
  }
  render(<ChecklistView {...props} />)
  return props
}

describe('экран чеклиста', () => {
  it('показывает прогресс и пункты', () => {
    renderView()
    expect(screen.getByText('1 из 2')).toBeInTheDocument()
    expect(screen.getByText('Паспорт')).toBeInTheDocument()
  })

  it('отмечает пункт одним вызовом', async () => {
    const props = renderView()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Отметить «Зарядка для телефона»' }))
    expect(props.onToggleItem).toHaveBeenCalledTimes(1)
    expect(props.onToggleItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'i2' }))
  })

  it('завершение доступно только при отмеченных пунктах', async () => {
    const props = renderView()
    await userEvent.click(screen.getByRole('button', { name: /Завершить/ }))
    expect(props.onFinish).toHaveBeenCalled()

    renderView({ items: [{ ...ITEMS[0], checkedAt: null }, ITEMS[1]] })
    expect(screen.getAllByRole('button', { name: /Завершить/ })[1]).toBeDisabled()
  })

  it('«Начать заново» спрашивает подтверждение, когда есть отметки', async () => {
    const props = renderView()
    await userEvent.click(screen.getByRole('button', { name: 'Начать заново' }))
    expect(props.onRestart).not.toHaveBeenCalled()

    await userEvent.click(screen.getAllByRole('button', { name: 'Начать заново' })[1])
    expect(props.onRestart).toHaveBeenCalled()
  })

  it('в режиме правки можно добавить, переименовать и удалить пункт', async () => {
    const props = renderView()
    await userEvent.click(screen.getByRole('button', { name: 'Правка' }))

    await userEvent.type(screen.getByLabelText('Новый пункт'), 'Зубная щётка')
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }))
    expect(props.onAddItem).toHaveBeenCalledWith('Зубная щётка')

    // Переименование уходит в базу один раз — по уходу с поля, а не на каждый символ.
    const field = screen.getByLabelText('Название пункта «Паспорт»')
    await userEvent.clear(field)
    await userEvent.type(field, 'Загранпаспорт')
    expect(props.onRenameItem).not.toHaveBeenCalled()
    await userEvent.tab()
    expect(props.onRenameItem).toHaveBeenCalledTimes(1)
    expect(props.onRenameItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1' }), 'Загранпаспорт')

    // Удаление спрашивает подтверждение.
    await userEvent.click(screen.getByRole('button', { name: 'Удалить пункт «Паспорт»' }))
    expect(props.onRemoveItem).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }))
    expect(props.onRemoveItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1' }))
  })

  it('пустой чеклист объясняет, что делать', () => {
    renderView({ items: [] })
    expect(screen.getByText(/нет пунктов/)).toBeInTheDocument()
  })

  it('показывает ошибку действия', () => {
    renderView({ actionError: 'Не удалось сохранить отметку. Попробуйте ещё раз.' })
    expect(screen.getByText(/Не удалось сохранить отметку/)).toBeInTheDocument()
  })
})
