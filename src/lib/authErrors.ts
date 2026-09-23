/** Понятный текст вместо технических сообщений Supabase. */
export function authErrorText(message: string): string {
  const text = message.toLowerCase()
  if (text.includes('invalid login credentials') || text.includes('invalid credentials')) {
    return 'Неверная почта или пароль.'
  }
  if (text.includes('email not confirmed')) {
    return 'Почта не подтверждена. Откройте пользователя в Supabase и подтвердите адрес.'
  }
  if (text.includes('user not found') || text.includes('signups not allowed')) {
    return 'Вход доступен только владельцу.'
  }
  if (text.includes('rate limit') || text.includes('too many')) {
    return 'Слишком много попыток. Подождите минуту.'
  }
  if (text.includes('fetch') || text.includes('network') || text.includes('failed to fetch')) {
    return 'Нет связи с сервером. Проверьте интернет и попробуйте снова.'
  }
  return 'Не удалось войти. Попробуйте ещё раз.'
}
