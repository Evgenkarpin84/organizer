import { useState } from 'react'
import { useData } from '../data/dataContext'
import { LIST_COLORS, LIST_COLOR_KEYS } from '../lib/labels'
import type { ListColor } from '../lib/types'
import { BottomSheet } from './BottomSheet'
import { Icon } from './Icon'
import { FOCUS_RING } from './states'

const NAME_LIMIT = 40

export function ListsSheet({ onClose }: { onClose: () => void }) {
  const { lists, addList, renameList, removeList } = useData()
  const [name, setName] = useState('')
  const [color, setColor] = useState<ListColor>('slate')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: () => Promise<void>, message: string) => {
    setError(null)
    try {
      await action()
    } catch (cause) {
      console.error(cause)
      setError(message)
    }
  }

  return (
    <BottomSheet title="Списки" onClose={onClose}>
      {error ? <p className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      <ul className="mb-4 space-y-1">
        {lists.map((list) => (
          <li key={list.id} className="rounded-lg">
            {editingId === list.id ? (
              <div className="flex items-center gap-2 py-1">
                <input
                  value={editingName}
                  onChange={(event) => setEditingName(event.target.value.slice(0, NAME_LIMIT))}
                  aria-label={`Новое название списка «${list.name}»`}
                  className="h-11 flex-1 rounded-lg border border-slate-300 px-3 text-base"
                />
                <button
                  type="button"
                  onClick={() =>
                    void run(async () => {
                      if (editingName.trim()) await renameList(list.id, editingName.trim())
                      setEditingId(null)
                    }, 'Не удалось переименовать список.')
                  }
                  className={`h-11 rounded-lg px-3 text-sm font-medium text-blue-600 ${FOCUS_RING}`}
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className={`h-11 rounded-lg px-3 text-sm text-slate-500 ${FOCUS_RING}`}
                >
                  Отмена
                </button>
              </div>
            ) : confirmId === list.id ? (
              <div className="rounded-lg bg-rose-50 p-3">
                <p className="text-sm text-rose-700">Удалить «{list.name}»? Задачи останутся без списка.</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className={`h-11 flex-1 rounded-lg border border-slate-300 text-sm ${FOCUS_RING}`}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void run(async () => {
                        await removeList(list.id)
                        setConfirmId(null)
                      }, 'Не удалось удалить список.')
                    }
                    className={`h-11 flex-1 rounded-lg bg-rose-600 text-sm font-medium text-white ${FOCUS_RING}`}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 shrink-0 rounded-full ${LIST_COLORS[list.color].dot}`} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm">{list.name}</span>
                <button
                  type="button"
                  aria-label={`Переименовать «${list.name}»`}
                  onClick={() => {
                    setEditingId(list.id)
                    setEditingName(list.name)
                  }}
                  className={`flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 ${FOCUS_RING}`}
                >
                  <Icon name="pencil" />
                </button>
                <button
                  type="button"
                  aria-label={`Удалить «${list.name}»`}
                  onClick={() => setConfirmId(list.id)}
                  className={`flex h-11 w-11 items-center justify-center rounded-lg text-rose-600 ${FOCUS_RING}`}
                >
                  <Icon name="trash" />
                </button>
              </div>
            )}
          </li>
        ))}
        {lists.length === 0 ? <li className="py-2 text-sm text-slate-500">Списков пока нет.</li> : null}
      </ul>

      <div className="border-t border-slate-200 pt-3">
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value.slice(0, NAME_LIMIT))}
            placeholder="Новый список"
            aria-label="Название нового списка"
            className="h-11 flex-1 rounded-lg border border-slate-300 px-3 text-base"
          />
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() =>
              void run(async () => {
                await addList(name.trim(), color)
                setName('')
                setColor('slate')
              }, 'Не удалось создать список.')
            }
            className={`h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:bg-slate-300 ${FOCUS_RING}`}
          >
            Создать
          </button>
        </div>
        {name.length >= 30 ? <p className="mt-1 text-xs text-slate-500">{name.length} из {NAME_LIMIT}</p> : null}
        <div className="mt-2 flex gap-2">
          {LIST_COLOR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              aria-label={`Цвет ${key}`}
              aria-pressed={color === key}
              onClick={() => setColor(key)}
              className={`h-10 w-10 rounded-full ${LIST_COLORS[key].dot} ${
                color === key ? 'ring-2 ring-slate-900 ring-offset-2' : ''
              } ${FOCUS_RING}`}
            />
          ))}
        </div>
      </div>
    </BottomSheet>
  )
}
