import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BottomSheet } from '../components/BottomSheet'
import { ChecklistRow } from '../components/ChecklistRow'
import { HabitRow } from '../components/HabitRow'
import { Icon } from '../components/Icon'
import { Section } from '../components/Section'
import { EmptyState, ErrorState, FOCUS_RING, SkeletonList } from '../components/states'
import { useHabits } from '../data/useHabits'
import { useStoredState } from '../data/useStoredState'
import { todayISO } from '../lib/dates'
import { checklistItemsOf, sortByPosition } from '../lib/habits'
import type { Checklist, ChecklistItem, Habit, HabitEntry } from '../lib/types'

type HabitsView = 'active' | 'archived'

export interface HabitsViewProps {
  habits: Habit[]
  entries: HabitEntry[]
  checklists: Checklist[]
  items: ChecklistItem[]
  loading: boolean
  error: string | null
  actionError: string | null
  todayIso: string
  onToggleDay: (habit: Habit, iso: string) => void
  onOpenHabit: (habit: Habit) => void
  onOpenChecklist: (checklist: Checklist) => void
  onCreateHabit: () => void
  onCreateChecklist: () => void
  onRetry: () => void
}

export function HabitsView({
  habits,
  entries,
  checklists,
  items,
  loading,
  error,
  actionError,
  todayIso,
  onToggleDay,
  onOpenHabit,
  onOpenChecklist,
  onCreateHabit,
  onCreateChecklist,
  onRetry,
}: HabitsViewProps) {
  const [view, setView] = useStoredState<HabitsView>('habits.view', 'active')
  const [createOpen, setCreateOpen] = useState(false)

  const archived = view === 'archived'
  const visibleHabits = sortByPosition(habits.filter((habit) => (habit.archivedAt !== null) === archived))
  const visibleChecklists = sortByPosition(
    checklists.filter((checklist) => (checklist.archivedAt !== null) === archived),
  )
  const blocked = Boolean(error) && habits.length === 0 && checklists.length === 0
  const entriesByHabit = new Map<string, string[]>()
  for (const entry of entries) {
    const list = entriesByHabit.get(entry.habitId)
    if (list) list.push(entry.doneOn)
    else entriesByHabit.set(entry.habitId, [entry.doneOn])
  }

  return (
    <>
      <div className="mb-2 flex items-center gap-2">
        <div role="tablist" aria-label="Набор привычек" className="flex flex-1 rounded-xl bg-slate-200 p-1">
          {(
            [
              ['active', 'Активные'],
              ['archived', 'Архив'],
            ] as [HabitsView, string][]
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
          onClick={() => setCreateOpen(true)}
          aria-label="Создать"
          className={`flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600 text-white ${FOCUS_RING}`}
        >
          <Icon name="plus" />
        </button>
      </div>

      {actionError ? (
        <p role="status" className="mb-2 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900">
          {actionError}
        </p>
      ) : null}
      {error ? <ErrorState message={error} onRetry={onRetry} /> : null}
      {loading && habits.length === 0 && checklists.length === 0 ? <SkeletonList count={3} /> : null}

      {!blocked ? (
        <>
          <Section title="Привычки" count={visibleHabits.length || undefined}>
            {visibleHabits.length === 0 ? (
              <EmptyState
                icon="habits"
                title={archived ? 'В архиве пусто' : 'Привычек пока нет'}
                hint={archived ? 'Сюда попадают привычки, убранные в архив' : 'Например: зарядка, вода, чтение 20 минут'}
                action={
                  archived ? undefined : (
                    <button
                      type="button"
                      onClick={onCreateHabit}
                      className={`mt-2 h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium ${FOCUS_RING}`}
                    >
                      Новая привычка
                    </button>
                  )
                }
              />
            ) : (
              <ul>
                {visibleHabits.map((habit, index) => (
                  <HabitRow
                    key={habit.id}
                    habit={habit}
                    index={index}
                    doneDates={entriesByHabit.get(habit.id) ?? []}
                    todayIso={todayIso}
                    onToggleDay={onToggleDay}
                    onOpen={onOpenHabit}
                  />
                ))}
              </ul>
            )}
          </Section>

          <Section title="Чеклисты" count={visibleChecklists.length || undefined}>
            {visibleChecklists.length === 0 ? (
              <EmptyState
                icon="tasks"
                title={archived ? 'Архивных чеклистов нет' : 'Чеклистов пока нет'}
                hint={archived ? 'Сюда попадают чеклисты из архива' : 'Например: сборы в поездку'}
                action={
                  archived ? undefined : (
                    <button
                      type="button"
                      onClick={onCreateChecklist}
                      className={`mt-2 h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium ${FOCUS_RING}`}
                    >
                      Новый чеклист
                    </button>
                  )
                }
              />
            ) : (
              <ul>
                {visibleChecklists.map((checklist) => (
                  <ChecklistRow
                    key={checklist.id}
                    checklist={checklist}
                    items={checklistItemsOf(items, checklist.id)}
                    onOpen={onOpenChecklist}
                  />
                ))}
              </ul>
            )}
          </Section>
        </>
      ) : null}

      {createOpen ? (
        <BottomSheet title="Что создать" onClose={() => setCreateOpen(false)}>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                setCreateOpen(false)
                onCreateHabit()
              }}
              className={`h-12 w-full rounded-xl bg-blue-600 text-base font-medium text-white ${FOCUS_RING}`}
            >
              Новая привычка
            </button>
            <button
              type="button"
              onClick={() => {
                setCreateOpen(false)
                onCreateChecklist()
              }}
              className={`h-12 w-full rounded-xl border border-slate-300 text-sm ${FOCUS_RING}`}
            >
              Новый чеклист
            </button>
          </div>
        </BottomSheet>
      ) : null}
    </>
  )
}

export function HabitsScreen() {
  const navigate = useNavigate()
  const { habits, entries, checklists, items, loading, error, actionError, reload, toggleEntry } = useHabits()

  return (
    <HabitsView
      habits={habits}
      entries={entries}
      checklists={checklists}
      items={items}
      loading={loading}
      error={error}
      actionError={actionError}
      todayIso={todayISO()}
      onToggleDay={(habit, iso) => void toggleEntry(habit.id, iso)}
      onOpenHabit={(habit) => navigate(`/habit/${habit.id}`)}
      onOpenChecklist={(checklist) => navigate(`/checklist/${checklist.id}`)}
      onCreateHabit={() => navigate('/habit/new')}
      onCreateChecklist={() => navigate('/checklist/new')}
      onRetry={() => void reload()}
    />
  )
}
