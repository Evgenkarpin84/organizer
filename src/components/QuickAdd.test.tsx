import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { makeList } from '../test/factories'
import { QuickAdd } from './QuickAdd'

const TODAY = '2026-09-16'
const lists = [makeList({ id: 'list-work', name: 'Работа' })]

describe('быстрый ввод', () => {
  it('показывает разбор строки и передаёт черновик задачи', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(<QuickAdd lists={lists} todayIso={TODAY} onAdd={onAdd} />)

    await userEvent.type(screen.getByLabelText('Новая задача'), 'Позвонить маме завтра в 12:30')
    expect(screen.getByText('Завтра, 12:30')).toBeInTheDocument()
    expect(screen.getByText('Позвонить маме')).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText('Добавить задачу'))
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Позвонить маме', dueDate: '2026-09-17', dueTime: '12:30' }),
    )
  })

  it('не сохраняет задачу без названия и не стирает введённое', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(<QuickAdd lists={lists} todayIso={TODAY} onAdd={onAdd} />)

    const input = screen.getByLabelText('Новая задача')
    await userEvent.type(input, 'завтра')
    await userEvent.click(screen.getByLabelText('Добавить задачу'))

    expect(onAdd).not.toHaveBeenCalled()
    expect(screen.getByText(/Не осталось названия/)).toBeInTheDocument()
    expect(input).toHaveValue('завтра')
  })
})
