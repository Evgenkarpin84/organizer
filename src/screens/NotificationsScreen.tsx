import { Icon, type IconName } from '../components/Icon'
import { ErrorState, FOCUS_RING } from '../components/states'
import { useOnline } from '../data/useOnline'
import { usePush } from '../data/usePush'
import type { PushState } from '../lib/push'

const PRIMARY = 'h-12 w-full rounded-xl bg-blue-600 text-base font-medium text-white disabled:bg-slate-300'
const SECONDARY = 'h-12 w-full rounded-xl border border-slate-300 bg-white text-sm'
const DESTRUCTIVE = 'h-12 w-full rounded-xl border border-rose-200 text-rose-600'

const STATUS: Record<PushState, { icon: IconName; title: string; text: string }> = {
  'not-configured': {
    icon: 'alert',
    title: 'Push не настроен',
    text: 'В сборке нет публичного ключа VAPID. Задайте VITE_VAPID_PUBLIC_KEY в файле .env и пересоберите приложение — раздел про push есть в README.',
  },
  unsupported: {
    icon: 'alert',
    title: 'Браузер не поддерживает уведомления',
    text: 'Этот браузер не умеет получать push. Откройте приложение в Chrome на Android — напоминания заработают там. Задачи и сроки работают как обычно.',
  },
  default: {
    icon: 'bell',
    title: 'Уведомления выключены',
    text: 'Включите, чтобы напоминания приходили на телефон даже при выключенном компьютере. Браузер спросит разрешение один раз.',
  },
  denied: {
    icon: 'alert',
    title: 'Уведомления запрещены',
    text: 'Разрешение выключено в настройках браузера — из приложения его вернуть нельзя. Как включить:',
  },
  granted: {
    icon: 'bell',
    title: 'Уведомления включены на этом устройстве',
    text: 'Напоминания придут, даже когда компьютер выключен. Приходят только по задачам со сроком и выбранным напоминанием.',
  },
}

export interface NotificationsViewProps {
  state: PushState
  busy: boolean
  error: string | null
  notice: string | null
  online: boolean
  onEnable: () => void
  onDisable: () => void
  onRefresh: () => void
  onTest: () => void
}

export function NotificationsView({
  state,
  busy,
  error,
  notice,
  online,
  onEnable,
  onDisable,
  onRefresh,
  onTest,
}: NotificationsViewProps) {
  const status = STATUS[state]

  return (
    <section className="space-y-4">
      <div aria-live="polite" className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <Icon name={status.icon} className="h-6 w-6 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">{status.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{status.text}</p>
          </div>
        </div>

        {state === 'denied' ? (
          <div className="mt-3 text-sm text-slate-600">
            <p className="font-medium text-slate-700">Если приложение установлено на телефон</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>Нажмите и удерживайте значок «Органайзер» на рабочем столе.</li>
              <li>Откройте «О приложении».</li>
              <li>Выберите «Уведомления» и включите их.</li>
            </ol>
            <p className="mt-3 font-medium text-slate-700">Если открыли сайт в Chrome</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>Нажмите значок слева от адреса сайта.</li>
              <li>Откройте «Настройки сайтов».</li>
              <li>Для пункта «Уведомления» выберите «Разрешить» и обновите страницу.</li>
            </ol>
            <p className="mt-2 text-xs text-slate-500">Названия пунктов зависят от версии Android и Chrome.</p>
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          {state === 'default' ? (
            <>
              <button type="button" onClick={onEnable} disabled={busy || !online} className={`${PRIMARY} ${FOCUS_RING}`}>
                {busy ? 'Включаем…' : 'Включить уведомления'}
              </button>
              {!online ? <p className="text-xs text-slate-500">Нет сети — попробуйте позже</p> : null}
            </>
          ) : null}

          {state === 'denied' ? (
            <button type="button" onClick={onRefresh} className={`${SECONDARY} ${FOCUS_RING}`}>
              Проверить снова
            </button>
          ) : null}

          {state === 'granted' ? (
            <>
              <button type="button" onClick={onTest} className={`${SECONDARY} ${FOCUS_RING}`}>
                Проверить уведомление
              </button>
              <button
                type="button"
                onClick={onDisable}
                disabled={busy}
                className={`${DESTRUCTIVE} ${FOCUS_RING} disabled:text-slate-400`}
              >
                {busy ? 'Отключаем…' : 'Отключить на этом устройстве'}
              </button>
            </>
          ) : null}
        </div>

        {notice ? (
          <p role="status" className="mt-3 text-xs text-slate-500">
            {notice}
          </p>
        ) : null}
      </div>

      {error ? <ErrorState message={error} onRetry={onRefresh} /> : null}

      <p className="text-xs text-slate-500">
        Напоминания приходят только у задач со сроком и выбранным напоминанием.
      </p>
    </section>
  )
}

export function NotificationsScreen() {
  const push = usePush()
  const online = useOnline()

  return (
    <NotificationsView
      state={push.state}
      busy={push.busy}
      error={push.error}
      notice={push.notice}
      online={online}
      onEnable={() => void push.enable()}
      onDisable={() => void push.disable()}
      onRefresh={() => void push.refresh()}
      onTest={() => void push.sendTest()}
    />
  )
}
