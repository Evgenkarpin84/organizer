import { describe, expect, it } from 'vitest'
import { localStamp, makeTask } from '../test/factories'
import { buildWeek, groupToday, isDoneToday } from './grouping'

const TODAY = '2026-09-16'

describe('группировка задач', () => {
  it('раскладывает задачи по разделам экрана «Сегодня»', () => {
    const overdue = makeTask({ dueDate: '2026-09-14', title: 'Просроченная' })
    const today = makeTask({ dueDate: TODAY, title: 'Сегодняшняя' })
    const later = makeTask({ dueDate: '2026-09-20', title: 'Будущая' })
    const done = makeTask({ dueDate: TODAY, title: 'Готовая', completedAt: localStamp(2026, 9, 16, 9) })

    const groups = groupToday([overdue, today, later, done], TODAY)

    expect(groups.overdue.map((task) => task.title)).toEqual(['Просроченная'])
    expect(groups.today.map((task) => task.title)).toEqual(['Сегодняшняя'])
    expect(groups.doneToday.map((task) => task.title)).toEqual(['Готовая'])
  })

  it('считает повторяющуюся задачу выполненной сегодня по отметке last_completed_at', () => {
    const task = makeTask({
      dueDate: '2026-09-17',
      repeatType: 'daily',
      lastCompletedAt: localStamp(2026, 9, 16, 8),
    })
    expect(isDoneToday(task, TODAY)).toBe(true)

    const groups = groupToday([task], TODAY)
    expect(groups.doneToday).toHaveLength(1)
    expect(groups.today).toHaveLength(0)
  })

  it('не считает выполненной сегодня отметку другого дня', () => {
    const task = makeTask({ dueDate: TODAY, lastCompletedAt: localStamp(2026, 9, 15, 8) })
    expect(isDoneToday(task, TODAY)).toBe(false)
  })

  it('сортирует задачи по времени, затем по приоритету', () => {
    const noon = makeTask({ dueDate: TODAY, dueTime: '12:00', title: 'Полдень' })
    const morning = makeTask({ dueDate: TODAY, dueTime: '09:00', title: 'Утро' })
    const anytime = makeTask({ dueDate: TODAY, title: 'Когда-нибудь' })
    const urgent = makeTask({ dueDate: TODAY, priority: 3, title: 'Срочное' })

    const groups = groupToday([anytime, noon, urgent, morning], TODAY)
    expect(groups.today.map((task) => task.title)).toEqual(['Утро', 'Полдень', 'Срочное', 'Когда-нибудь'])
  })

  it('строит неделю из семи дней, включая пустые', () => {
    const week = buildWeek([makeTask({ dueDate: '2026-09-18' })], TODAY)
    expect(week).toHaveLength(7)
    expect(week[0].date).toBe(TODAY)
    expect(week[0].tasks).toEqual([])
    expect(week[2].tasks).toHaveLength(1)
  })

  it('показывает повтор во всех подходящих днях, но отмечать разрешает только реальный срок', () => {
    const task = makeTask({ dueDate: TODAY, repeatType: 'daily', repeatInterval: 1 })
    const week = buildWeek([task], TODAY)

    expect(week.every((day) => day.tasks.length === 1)).toBe(true)
    expect(week[0].tasks[0].virtual).toBe(false)
    expect(week.slice(1).every((day) => day.tasks[0].virtual)).toBe(true)
  })

  it('не показывает выполненные задачи в неделе', () => {
    const task = makeTask({ dueDate: '2026-09-18', completedAt: localStamp(2026, 9, 16, 9) })
    const week = buildWeek([task], TODAY)
    expect(week.every((day) => day.tasks.length === 0)).toBe(true)
  })
})
