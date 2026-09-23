import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PushState } from '../lib/push'
import { NotificationsView } from './NotificationsScreen'

function renderView(state: PushState, overrides: Partial<Parameters<typeof NotificationsView>[0]> = {}) {
  const props = {
    state,
    busy: false,
    error: null,
    notice: null,
    online: true,
    onEnable: vi.fn(),
    onDisable: vi.fn(),
    onRefresh: vi.fn(),
    onTest: vi.fn(),
    ...overrides,
  }
  render(<NotificationsView {...props} />)
  return props
}

describe('экран уведомлений', () => {
  it('состояние «не настроено»: без кнопок, с подсказкой про переменную', () => {
    renderView('not-configured')
    expect(screen.getByText('Push не настроен')).toBeInTheDocument()
    expect(screen.getByText(/VITE_VAPID_PUBLIC_KEY/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('состояние «не поддерживается»: объясняет и не показывает кнопок', () => {
    renderView('unsupported')
    expect(screen.getByText('Браузер не поддерживает уведомления')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('состояние «разрешение не запрошено»: одна кнопка включения', async () => {
    const props = renderView('default')
    const button = screen.getByRole('button', { name: 'Включить уведомления' })
    await userEvent.click(button)
    expect(props.onEnable).toHaveBeenCalled()
  })

  it('без сети кнопка включения недоступна', () => {
    renderView('default', { online: false })
    expect(screen.getByRole('button', { name: 'Включить уведомления' })).toBeDisabled()
    expect(screen.getByText('Нет сети — попробуйте позже')).toBeInTheDocument()
  })

  it('состояние «запрещено»: инструкция и проверка, без кнопки включения', async () => {
    const props = renderView('denied')
    expect(screen.getByText('Уведомления запрещены')).toBeInTheDocument()
    expect(screen.getByText(/Настройки сайтов/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Включить уведомления' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Проверить снова' }))
    expect(props.onRefresh).toHaveBeenCalled()
  })

  it('состояние «включено»: проверка уведомления и отключение', async () => {
    const props = renderView('granted')
    expect(screen.getByText('Уведомления включены на этом устройстве')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Проверить уведомление' }))
    expect(props.onTest).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Отключить на этом устройстве' }))
    expect(props.onDisable).toHaveBeenCalled()
  })

  it('показывает ошибку и сообщение о результате', () => {
    renderView('granted', { error: 'Не удалось отключить уведомления. Попробуйте ещё раз.', notice: 'Уведомление отправлено.' })
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось отключить')
    expect(screen.getByRole('status')).toHaveTextContent('Уведомление отправлено.')
  })
})
