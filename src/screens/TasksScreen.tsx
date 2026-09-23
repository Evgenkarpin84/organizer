import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ListFilterChips, type ListFilter } from '../components/ListChips'
import { ListsSheet } from '../components/ListsSheet'
import { Section } from '../components/Section'
import { TaskItem } from '../components/TaskItem'
import { EmptyState, ErrorState, FOCUS_RING, SkeletonList } from '../components/states'
import { useData } from '../data/dataContext'
import { formatDayTitle, todayISO } from '../lib/dates'
import { activeTasks, buildWeek } from '../lib/grouping'
import type { Task } from '../lib/types'

type View = 'upcoming' | 'all'

function matchesFilter(task: Task, filter: ListFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'none') return task.listId === null
  return task.listId === filter
}

export function TasksScreen() {
  const { tasks, lists, loading, error, errorDetails, reload, toggleTask } = useData()
  const navigate = useNavigate()
  const todayIso = todayISO()
  const [view, setView] = useState<View>('upcoming')
  const [filter, setFilter] = useState<ListFilter>('all')
  const [listsOpen, setListsOpen] = useState(false)

  const filtered = useMemo(() => tasks.filter((task) => matchesFilter(task, filter)), [tasks, filter])
  const week = useMemo(() => buildWeek(filtered, todayIso), [filtered, todayIso])
  const all = useMemo(() => activeTasks(filtered, todayIso), [filtered, todayIso])
  const withDate = all.filter((task) => task.dueDate !== null)
  const withoutDate = all.filter((task) => task.dueDate === null)

  const openTask = (task: Task) => navigate(`/task/${task.id}`)
  const hideListChip = filter !== 'all' && filter !== 'none'
  // Ошибка загрузки не должна выглядеть как «задач нет»: показываем только ErrorState.
  const blocked = Boolean(error) && tasks.length === 0

  return (
    <>
      <div className="mb-2 flex items-center gap-2">
        <div role="tablist" aria-label="Вид списка задач" className="flex flex-1 rounded-xl bg-slate-200 p-1">
          {(
            [
              ['upcoming', 'Предстоящие'],
              ['all', 'Все'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={`h-10 flex-1 rounded-lg text-sm font-medium ${FOCUS_RING} ${
                view === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setListsOpen(true)}
          aria-label="Управление списками"
          className={`flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 ${FOCUS_RING}`}
        >
          <Icon name="lists" />
        </button>
        <button
          type="button"
          onClick={() => navigate('/task/new')}
          aria-label="Новая задача"
          className={`flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600 text-white ${FOCUS_RING}`}
        >
          <Icon name="plus" />
        </button>
      </div>

      <ListFilterChips lists={lists} value={filter} onChange={setFilter} />

      {error ? <ErrorState message={error} details={errorDetails} onRetry={() => void reload()} /> : null}
      {loading ? <SkeletonList /> : null}

      {!loading && !blocked && view === 'upcoming'
        ? week.map((day) => (
            <Section key={day.date} title={formatDayTitle(day.date, todayIso)} count={day.tasks.length || undefined}>
              {day.tasks.length === 0 ? (
                <p className="py-1 pl-1 text-sm text-slate-400">Свободно</p>
              ) : (
                <ul>
                  {day.tasks.map(({ task, virtual }) => (
                    <TaskItem
                      key={`${day.date}-${task.id}`}
                      task={task}
                      lists={lists}
                      todayIso={todayIso}
                      virtual={virtual}
                      hideListChip={hideListChip}
                      onToggle={(item) => void toggleTask(item)}
                      onOpen={openTask}
                    />
                  ))}
                </ul>
              )}
            </Section>
          ))
        : null}

      {!loading && !blocked && view === 'all' ? (
        <>
          {all.length === 0 ? (
            <div className="mt-6">
              <EmptyState icon="tasks" title="Задач нет" hint="Добавьте задачу кнопкой вверху" />
            </div>
          ) : null}
          {withDate.length > 0 ? (
            <Section title="Со сроком" count={withDate.length}>
              <ul>
                {withDate.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    lists={lists}
                    todayIso={todayIso}
                    hideListChip={hideListChip}
                    onToggle={(item) => void toggleTask(item)}
                    onOpen={openTask}
                  />
                ))}
              </ul>
            </Section>
          ) : null}
          {withoutDate.length > 0 ? (
            <Section title="Без даты" count={withoutDate.length}>
              <ul>
                {withoutDate.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    lists={lists}
                    todayIso={todayIso}
                    hideListChip={hideListChip}
                    onToggle={(item) => void toggleTask(item)}
                    onOpen={openTask}
                  />
                ))}
              </ul>
            </Section>
          ) : null}
        </>
      ) : null}

      {listsOpen ? <ListsSheet onClose={() => setListsOpen(false)} /> : null}
    </>
  )
}
