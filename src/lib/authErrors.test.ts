import { describe, expect, it } from 'vitest'
import { authErrorText } from './authErrors'

describe('тексты ошибок входа', () => {
  it('объясняет неверный пароль', () => {
    expect(authErrorText('Invalid login credentials')).toBe('Неверная почта или пароль.')
  })

  it('объясняет неподтверждённую почту', () => {
    expect(authErrorText('Email not confirmed')).toContain('Почта не подтверждена')
  })

  it('не подсказывает про регистрацию чужим людям', () => {
    expect(authErrorText('Signups not allowed for otp')).toBe('Вход доступен только владельцу.')
  })

  it('различает лимит попыток и проблемы со связью', () => {
    expect(authErrorText('Email rate limit exceeded')).toContain('Слишком много попыток')
    expect(authErrorText('TypeError: Failed to fetch')).toContain('Нет связи с сервером')
  })

  it('на незнакомую ошибку отвечает нейтрально', () => {
    expect(authErrorText('unexpected_failure')).toBe('Не удалось войти. Попробуйте ещё раз.')
  })
})
