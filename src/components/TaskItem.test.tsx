import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { localStamp, makeList, makeTask } from '../test/factories'
import { TaskItem } from './TaskItem'

const TODAY = '2026-09-16'
const lists = [makeList({ id: 'list-work', name: 'Работа', color: 'blue' })]

describe('карточка задачи', () => {
  it('показывает название, срок, список и повтор', () => {
    const task = makeTask({
      title: 'Купить корм',
      dueDate: '2026-09-15',
      dueTime: '18:30',
      listId: 'list-work',
      repeatType: 'daily',
      repeatInterval: 1,
    })
    render(
      <ul>
        <TaskItem task={task} lists={lists} todayIso={TODAY} onOpen={() => {}} />
      </ul>,
    )

    expect(screen.getByText('Купить корм')).toBeInTheDocument()
    expect(screen.getByText('Вчера, 18:30')).toBeInTheDocument()
    expect(screen.getByText('Работа')).toBeInTheDocument()
    expect(screen.getByText('↻ каждый день')).toBeInTheDocument()
  })

  it('отдаёт задачу в обработчики отметки и открытия', async () => {
    const task = makeTask({ title: 'Отчёт', dueDate: TODAY })
    const onToggle = vi.fn()
    const onOpen = vi.fn()
    render(
      <ul>
        <TaskItem task={task} lists={lists} todayIso={TODAY} onToggle={onToggle} onOpen={onOpen} />
      </ul>,
    )

    await userEvent.click(screen.getByRole('checkbox', { name: /Отметить/ }))
    expect(onToggle).toHaveBeenCalledWith(task)

    await userEvent.click(screen.getByText('Отчёт'))
    expect(onOpen).toHaveBeenCalledWith(task)
  })

  it('показывает отметку напоминания у активной задачи и прячет у вхождения повтора', () => {
    const task = makeTask({
      title: 'Отчёт',
      dueDate: TODAY,
      dueTime: '18:00',
      remindAt: new Date(2026, 8, 16, 17, 0).toISOString(),
    })
    const { unmount } = render(
      <ul>
        <TaskItem task={task} lists={lists} todayIso={TODAY} onOpen={() => {}} />
      </ul>,
    )
    expect(screen.getByText('за час')).toBeInTheDocument()
    unmount()

    render(
      <ul>
        <TaskItem task={task} lists={lists} todayIso={TODAY} virtual onOpen={() => {}} />
      </ul>,
    )
    expect(screen.queryByText('за час')).not.toBeInTheDocument()
  })

  it('повторяющуюся задачу, отмеченную сегодня, нельзя отметить ещё раз', () => {
    const task = makeTask({
      title: 'Зарядка',
      dueDate: '2026-09-17',
      repeatType: 'daily',
      lastCompletedAt: localStamp(2026, 9, 16, 8),
    })
    render(
      <ul>
        <TaskItem task={task} lists={lists} todayIso={TODAY} onToggle={() => {}} onOpen={() => {}} />
      </ul>,
    )

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByText('Выполнено сегодня, срок перенесён')).toBeInTheDocument()
  })

  it('у вхождения повтора нет чекбокса, но есть подпись ближайшего срока', () => {
    const task = makeTask({ title: 'Зарядка', dueDate: TODAY, repeatType: 'daily' })
    render(
      <ul>
        <TaskItem task={task} lists={lists} todayIso={TODAY} virtual onOpen={() => {}} />
      </ul>,
    )

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByText('Ближайший срок: Сегодня')).toBeInTheDocument()
  })
})
