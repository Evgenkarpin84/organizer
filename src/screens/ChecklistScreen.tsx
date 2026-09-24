import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BottomSheet } from '../components/BottomSheet'
import { Icon } from '../components/Icon'
import { FOCUS_RING, SplashScreen } from '../components/states'
import { useHabits } from '../data/useHabits'
import { checklistItemsOf, checklistProgress } from '../lib/habits'
import type { Checklist, ChecklistItem } from '../lib/types'

export interface ChecklistViewProps {
  checklist: Checklist
  items: ChecklistItem[]
  actionError: string | null
  onBack: () => void
  onToggleItem: (item: ChecklistItem) => void
  onAddItem: (text: string) => void
  onRenameItem: (item: ChecklistItem, text: string) => void
  onRemoveItem: (item: ChecklistItem) => void
  onFinish: () => void
  onRestart: () => void
}

export function ChecklistView({
  checklist,
  items,
  actionError,
  onBack,
  onToggleItem,
  onAddItem,
  onRenameItem,
  onRemoveItem,
  onFinish,
  onRestart,
}: ChecklistViewProps) {
  const [editing, setEditing] = useState(false)
  const [newItem, setNewItem] = useState('')
  const [confirmRestart, setConfirmRestart] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<ChecklistItem | null>(null)
  // Текст пункта правится локально и уходит в базу один раз — по уходу с поля или по Enter.
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const draftText = (item: ChecklistItem) => drafts[item.id] ?? item.text

  const commitText = (item: ChecklistItem) => {
    const next = (drafts[item.id] ?? item.text).trim()
    setDrafts((current) => {
      const rest = { ...current }
      delete rest[item.id]
      return rest
    })
    if (next && next !== item.text) onRenameItem(item, next)
  }
  const progress = checklistProgress(items)

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <header className="sticky top-0 z-20 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between gap-2 border-b border-slate-200 bg-white px-2 pt-[env(safe-area-inset-top)]">
        <button type="button" onClick={onBack} className={`h-11 rounded-lg px-3 text-sm text-slate-600 ${FOCUS_RING}`}>
          Назад
        </button>
        <h1 className="min-w-0 truncate text-base font-semibold">{checklist.title}</h1>
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          className={`h-11 rounded-lg px-3 text-sm text-blue-600 ${FOCUS_RING}`}
        >
          {editing ? 'Готово' : 'Правка'}
        </button>
      </header>

      <div className="flex-1 space-y-3 px-4 py-4">
        <div>
          <p className="text-sm text-slate-600">{progress.label}</p>
          <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <span className="block h-full rounded-full bg-blue-600" style={{ width: `${progress.percent}%` }} />
          </span>
        </div>

        {actionError ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{actionError}</p> : null}

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            В чеклисте пока нет пунктов. Нажмите «Правка» и добавьте первый.
          </p>
        ) : (
          <ul>
            {items.map((item) =>
              editing ? (
                <li key={item.id} className="mb-2 flex items-center gap-2">
                  <input
                    value={draftText(item)}
                    aria-label={`Название пункта «${item.text}»`}
                    onChange={(event) =>
                      setDrafts((current) => ({ ...current, [item.id]: event.target.value.slice(0, 120) }))
                    }
                    onBlur={() => commitText(item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur()
                    }}
                    className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-base"
                  />
                  <button
                    type="button"
                    aria-label={`Удалить пункт «${item.text}»`}
                    onClick={() => setConfirmDelete(item)}
                    className={`flex h-11 w-11 items-center justify-center rounded-lg text-rose-600 ${FOCUS_RING}`}
                  >
                    <Icon name="trash" />
                  </button>
                </li>
              ) : (
                <li key={item.id} className="mb-2 flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={item.checkedAt !== null}
                    aria-label={`Отметить «${item.text}»`}
                    onClick={() => onToggleItem(item)}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${FOCUS_RING}`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                        item.checkedAt ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                      }`}
                    >
                      {item.checkedAt ? <Icon name="check" className="h-4 w-4" /> : null}
                    </span>
                  </button>
                  <span
                    className={`min-w-0 flex-1 py-1 text-[15px] leading-snug ${
                      item.checkedAt ? 'text-slate-400 line-through' : ''
                    }`}
                  >
                    {item.text}
                  </span>
                </li>
              ),
            )}
          </ul>
        )}

        {editing ? (
          <div className="flex items-center gap-2">
            <input
              value={newItem}
              onChange={(event) => setNewItem(event.target.value.slice(0, 120))}
              placeholder="Новый пункт"
              aria-label="Новый пункт"
              className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-base"
            />
            <button
              type="button"
              disabled={!newItem.trim()}
              onClick={() => {
                onAddItem(newItem.trim())
                setNewItem('')
              }}
              className={`h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:bg-slate-300 ${FOCUS_RING}`}
            >
              Добавить
            </button>
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 space-y-2 border-t border-slate-200 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onFinish}
          disabled={progress.done === 0}
          className={`h-12 w-full rounded-xl bg-blue-600 text-base font-medium text-white disabled:bg-slate-300 ${FOCUS_RING}`}
        >
          Завершить{progress.done > 0 ? ` (${progress.label})` : ''}
        </button>
        <button
          type="button"
          onClick={() => (progress.done > 0 ? setConfirmRestart(true) : onRestart())}
          className={`h-12 w-full rounded-xl border border-slate-300 text-sm ${FOCUS_RING}`}
        >
          Начать заново
        </button>
      </div>

      {confirmDelete ? (
        <BottomSheet title="Удалить пункт?" onClose={() => setConfirmDelete(null)}>
          <p className="mb-3 text-sm text-slate-600">«{confirmDelete.text}» исчезнет из чеклиста.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className={`h-12 flex-1 rounded-xl border border-slate-300 text-sm ${FOCUS_RING}`}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => {
                const target = confirmDelete
                setConfirmDelete(null)
                onRemoveItem(target)
              }}
              className={`h-12 flex-1 rounded-xl bg-rose-600 text-sm font-medium text-white ${FOCUS_RING}`}
            >
              Удалить
            </button>
          </div>
        </BottomSheet>
      ) : null}

      {confirmRestart ? (
        <BottomSheet title="Начать заново?" onClose={() => setConfirmRestart(false)}>
          <p className="mb-3 text-sm text-slate-600">Отметки со всех пунктов снимутся.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmRestart(false)}
              className={`h-12 flex-1 rounded-xl border border-slate-300 text-sm ${FOCUS_RING}`}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmRestart(false)
                onRestart()
              }}
              className={`h-12 flex-1 rounded-xl bg-blue-600 text-sm font-medium text-white ${FOCUS_RING}`}
            >
              Начать заново
            </button>
          </div>
        </BottomSheet>
      ) : null}
    </div>
  )
}

export function ChecklistScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    checklists,
    items,
    loading,
    actionError,
    createChecklist,
    addChecklistItem,
    renameChecklistItem,
    removeChecklistItem,
    toggleChecklistItem,
    finishChecklist,
    restartChecklist,
  } = useHabits()

  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const checklist = id ? (checklists.find((item) => item.id === id) ?? null) : null

  if (!id) {
    return (
      <div className="flex min-h-full flex-col bg-slate-50">
        <header className="sticky top-0 z-20 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between gap-2 border-b border-slate-200 bg-white px-2 pt-[env(safe-area-inset-top)]">
          <button type="button" onClick={() => navigate(-1)} className={`h-11 rounded-lg px-3 text-sm text-slate-600 ${FOCUS_RING}`}>
            Отмена
          </button>
          <h1 className="text-base font-semibold">Новый чеклист</h1>
          <span className="h-11 w-16" aria-hidden="true" />
        </header>

        <div className="flex-1 space-y-3 px-4 py-4">
          <label className="block text-xs font-medium text-slate-500" htmlFor="checklist-title">
            Название
          </label>
          <input
            id="checklist-title"
            value={title}
            autoFocus
            onChange={(event) => setTitle(event.target.value.slice(0, 80))}
            placeholder="Например: сборы в поездку"
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
          />
          <p className="text-xs text-slate-500">Пункты добавите на следующем шаге.</p>
        </div>

        <div className="sticky bottom-0 border-t border-slate-200 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={!title.trim() || busy}
            onClick={() => {
              setBusy(true)
              void createChecklist(title.trim())
                .then((createdId) => {
                  if (createdId) navigate(`/checklist/${createdId}`, { replace: true })
                })
                .finally(() => setBusy(false))
            }}
            className={`h-12 w-full rounded-xl bg-blue-600 text-base font-medium text-white disabled:bg-slate-300 ${FOCUS_RING}`}
          >
            {busy ? 'Создаём…' : 'Создать'}
          </button>
        </div>
      </div>
    )
  }

  if (!checklist) {
    if (loading) return <SplashScreen />
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-slate-600">Чеклист не найден.</p>
        <button
          type="button"
          onClick={() => navigate('/habits')}
          className={`h-11 rounded-lg border border-slate-300 px-4 text-sm ${FOCUS_RING}`}
        >
          К чеклистам
        </button>
      </div>
    )
  }

  return (
    <ChecklistView
      checklist={checklist}
      items={checklistItemsOf(items, checklist.id)}
      actionError={actionError}
      onBack={() => navigate(-1)}
      onToggleItem={(item) => void toggleChecklistItem(item.id)}
      onAddItem={(text) => void addChecklistItem(checklist.id, text)}
      onRenameItem={(item, text) => void renameChecklistItem(item.id, text)}
      onRemoveItem={(item) => void removeChecklistItem(item.id)}
      onFinish={() => void finishChecklist(checklist.id)}
      onRestart={() => void restartChecklist(checklist.id)}
    />
  )
}
