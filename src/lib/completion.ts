import { isDoneToday } from './grouping'
import { nextDueDateAfterCompletion } from './recurrence'
import { recomputeRemindAt } from './reminders'
import type { Task } from './types'

export interface CompletionPatch {
  dueDate?: string | null
  lastCompletedAt?: string
  remindAt?: string | null
  completedAt?: string | null
}

/**
 * Что записать в задачу при отметке выполнения.
 * null — отмечать нечего: повторяющуюся задачу уже отметили сегодня.
 */
export function buildCompletionPatch(task: Task, todayIso: string, nowIso: string): CompletionPatch | null {
  if (task.repeatType !== 'none') {
    if (isDoneToday(task, todayIso)) return null
    const dueDate = nextDueDateAfterCompletion(task, todayIso)
    return {
      dueDate,
      lastCompletedAt: nowIso,
      // Напоминание переезжает вместе со сроком, с тем же смещением.
      remindAt: recomputeRemindAt(task, dueDate),
    }
  }

  return { completedAt: task.completedAt ? null : nowIso }
}
