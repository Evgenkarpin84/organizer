import { describe, expect, it } from 'vitest'
import { localStamp, makeTask } from '../test/factories'
import { buildCompletionPatch } from './completion'
import { computeRemindAt } from './reminders'

const TODAY = '2026-09-25'
const NOW = '2026-09-25T09:00:00.000Z'

describe('отметка выполнения', () => {
  it('обычную задачу закрывает и открывает обратно', () => {
    const task = makeTask({ dueDate: TODAY })
    expect(buildCompletionPatch(task, TODAY, NOW)).toEqual({ completedAt: NOW })

    const done = makeTask({ dueDate: TODAY, completedAt: NOW })
    expect(buildCompletionPatch(done, TODAY, NOW)).toEqual({ completedAt: null })
  })

  it('повторяющуюся переносит на следующий срок и двигает напоминание', () => {
    const task = makeTask({
      dueDate: TODAY,
      dueTime: '18:00',
      repeatType: 'daily',
      repeatInterval: 1,
      remindAt: computeRemindAt(TODAY, '18:00', 60),
    })

    const patch = buildCompletionPatch(task, TODAY, NOW)
    expect(patch).toMatchObject({ dueDate: '2026-09-26', lastCompletedAt: NOW })
    expect(patch?.remindAt).toBe(computeRemindAt('2026-09-26', '18:00', 60))
  })

  it('не включает напоминание там, где его не было', () => {
    const task = makeTask({ dueDate: TODAY, dueTime: '18:00', repeatType: 'daily' })
    expect(buildCompletionPatch(task, TODAY, NOW)?.remindAt).toBeNull()
  })

  it('повторяющуюся задачу, отмеченную сегодня, второй раз не трогает', () => {
    const task = makeTask({
      dueDate: '2026-09-26',
      repeatType: 'daily',
      lastCompletedAt: localStamp(2026, 9, 25, 8),
    })
    expect(buildCompletionPatch(task, TODAY, NOW)).toBeNull()
  })
})
