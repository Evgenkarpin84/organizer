import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { HabitsToday } from '../components/HabitsToday'
import { QuickAdd } from '../components/QuickAdd'
import { Section } from '../components/Section'
import { TaskItem } from '../components/TaskItem'
import { EmptyState, ErrorState, FOCUS_RING, SkeletonList } from '../components/states'
import { useData } from '../data/dataContext'
import { todayISO } from '../lib/dates'
import { groupToday } from '../lib/grouping'
import type { Task } from '../lib/types'

export function TodayScreen() {
  const { tasks, lists, loading, error, errorDetails, reload, addTask, toggleTask } = useData()
  const navigate = useNavigate()
  const todayIso = todayISO()
  const groups = useMemo(() => groupToday(tasks, todayIso), [tasks, todayIso])

  const openTask = (task: Task) => navigate(`/task/${task.id}`)
  const nothingToday = groups.overdue.length === 0 && groups.today.length === 0 && groups.doneToday.length === 0
  // Данные не загрузились: пустые списки — это не «задач нет», а «мы их не получили».
  const blocked = Boolean(error) && tasks.length === 0

  return (
    <>
      <QuickAdd lists={lists} todayIso={todayIso} onAdd={addTask} disabled={loading || blocked} />
      {blocked ? <p className="mb-2 text-xs text-slate-500">Нет данных с сервера — добавление недоступно.</p> : null}

      <HabitsToday todayIso={todayIso} />

      {error ? (
        <div className="mt-2">
          <ErrorState message={error} details={errorDetails} onRetry={() => void reload()} />
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4">
          <SkeletonList />
        </div>
      ) : null}

      {!loading && !blocked && nothingToday ? (
        <div className="mt-6">
          {tasks.length === 0 ? (
            <EmptyState title="Задач пока нет" hint="Добавьте первую в поле вверху" />
          ) : (
            <EmptyState
              title="На сегодня всё чисто"
              hint="Ближайшие дела — на вкладке «Задачи»"
              action={
                <button
                  type="button"
                  onClick={() => navigate('/tasks')}
                  className={`mt-2 h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium ${FOCUS_RING}`}
                >
                  Посмотреть предстоящие
                </button>
              }
            />
          )}
        </div>
      ) : null}

      {!loading && groups.overdue.length > 0 ? (
        <Section title="Просрочено" count={groups.overdue.length} tone="danger">
          <ul>
            {groups.overdue.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                lists={lists}
                todayIso={todayIso}
                onToggle={(item) => void toggleTask(item)}
                onOpen={openTask}
              />
            ))}
          </ul>
        </Section>
      ) : null}

      {!loading && groups.today.length > 0 ? (
        <Section title="Сегодня" count={groups.today.length}>
          <ul>
            {groups.today.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                lists={lists}
                todayIso={todayIso}
                onToggle={(item) => void toggleTask(item)}
                onOpen={openTask}
              />
            ))}
          </ul>
        </Section>
      ) : null}

      {!loading && groups.doneToday.length > 0 ? (
        <Section title="Выполнено сегодня" count={groups.doneToday.length}>
          <details open={groups.doneToday.length <= 3}>
            <summary className="mb-2 cursor-pointer text-xs text-slate-500">Показать</summary>
            <ul>
              {groups.doneToday.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  lists={lists}
                  todayIso={todayIso}
                  onToggle={(item) => void toggleTask(item)}
                  onOpen={openTask}
                />
              ))}
            </ul>
          </details>
        </Section>
      ) : null}
    </>
  )
}
