import { describe, expect, it } from 'vitest'
import { makeTask } from '../test/factories'
import { describeRepeat, nextDueDateAfterCompletion, nextOccurrence, occurrencesInRange } from './recurrence'

const TODAY = '2026-09-16'

describe('повторения', () => {
  it('переносит просроченную ежедневную задачу на завтра, а не на прошедший день', () => {
    const task = makeTask({ dueDate: '2026-09-10', repeatType: 'daily', repeatInterval: 1 })
    expect(nextDueDateAfterCompletion(task, TODAY)).toBe('2026-09-17')
  })

  it('учитывает интервал в днях', () => {
    const task = makeTask({ dueDate: '2026-09-10', repeatType: 'daily', repeatInterval: 3 })
    expect(nextDueDateAfterCompletion(task, TODAY)).toBe('2026-09-19')
  })

  it('переносит недельную задачу на ближайший выбранный день недели', () => {
    const task = makeTask({ dueDate: TODAY, repeatType: 'weekly', repeatWeekdays: [1, 4] })
    expect(nextDueDateAfterCompletion(task, TODAY)).toBe('2026-09-17')
  })

  it('переносит месячную задачу с 31 числа на последний день короткого месяца', () => {
    const task = makeTask({ dueDate: '2026-01-31', repeatType: 'monthly', repeatDayOfMonth: 31 })
    expect(nextDueDateAfterCompletion(task, '2026-01-31')).toBe('2026-02-28')
  })

  it('возвращает исходное число месяца после короткого месяца', () => {
    const task = makeTask({ dueDate: '2026-02-28', repeatType: 'monthly', repeatDayOfMonth: 31 })
    expect(nextDueDateAfterCompletion(task, '2026-02-28')).toBe('2026-03-31')
  })

  it('не переносит задачу без повтора', () => {
    const task = makeTask({ dueDate: TODAY })
    expect(nextDueDateAfterCompletion(task, TODAY)).toBeNull()
    expect(nextOccurrence(task, TODAY, TODAY)).toBeNull()
  })

  it('разворачивает ежедневную задачу на всю неделю', () => {
    const task = makeTask({ dueDate: TODAY, repeatType: 'daily', repeatInterval: 1 })
    expect(occurrencesInRange(task, TODAY, '2026-09-22')).toHaveLength(7)
  })

  it('разворачивает недельную задачу только на выбранные дни', () => {
    const task = makeTask({ dueDate: TODAY, repeatType: 'weekly', repeatWeekdays: [3, 6] })
    expect(occurrencesInRange(task, TODAY, '2026-09-22')).toEqual(['2026-09-16', '2026-09-19'])
  })

  it('не выдаёт вхождений раньше срока задачи', () => {
    const task = makeTask({ dueDate: '2026-09-20', repeatType: 'daily', repeatInterval: 1 })
    expect(occurrencesInRange(task, TODAY, '2026-09-22')).toEqual(['2026-09-20', '2026-09-21', '2026-09-22'])
  })

  it('для задачи без повтора возвращает только её срок', () => {
    const task = makeTask({ dueDate: '2026-09-18' })
    expect(occurrencesInRange(task, TODAY, '2026-09-22')).toEqual(['2026-09-18'])
    expect(occurrencesInRange(task, '2026-09-19', '2026-09-22')).toEqual([])
  })

  it('описывает правило повтора по-русски', () => {
    expect(describeRepeat({ repeatType: 'daily', repeatInterval: 1, repeatWeekdays: [], repeatDayOfMonth: null })).toBe(
      'каждый день',
    )
    expect(describeRepeat({ repeatType: 'daily', repeatInterval: 3, repeatWeekdays: [], repeatDayOfMonth: null })).toBe(
      'каждые 3 дн.',
    )
    expect(
      describeRepeat({ repeatType: 'weekly', repeatInterval: 1, repeatWeekdays: [3, 1], repeatDayOfMonth: null }),
    ).toBe('по пн, ср')
    expect(describeRepeat({ repeatType: 'monthly', repeatInterval: 1, repeatWeekdays: [], repeatDayOfMonth: 25 })).toBe(
      '25 числа',
    )
    expect(describeRepeat({ repeatType: 'none', repeatInterval: 1, repeatWeekdays: [], repeatDayOfMonth: null })).toBeNull()
  })
})
