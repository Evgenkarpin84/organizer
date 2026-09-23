import { useState, type FormEvent } from 'react'
import { FOCUS_RING } from '../components/states'
import { authErrorText } from '../lib/authErrors'
import { requireSupabase } from '../lib/supabase'

export function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim() || !password || busy) return
    setBusy(true)
    setError(null)
    try {
      const { error: authError } = await requireSupabase().auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (authError) setError(authErrorText(authError.message))
    } catch (cause) {
      console.error(cause)
      setError('Нет связи с сервером. Проверьте интернет и попробуйте снова.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-3">
        <h1 className="text-2xl font-semibold">Органайзер</h1>
        <p className="mb-3 text-sm text-slate-500">Вход только для владельца</p>

        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Почта"
          aria-label="Адрес почты"
          className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
        />

        <div className="flex items-center gap-2">
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Пароль"
            aria-label="Пароль"
            className="h-12 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-base"
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-pressed={showPassword}
            className={`h-12 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-600 ${FOCUS_RING}`}
          >
            {showPassword ? 'Скрыть' : 'Показать'}
          </button>
        </div>

        <button
          type="submit"
          disabled={busy || !email.trim() || !password}
          className={`h-12 w-full rounded-xl bg-blue-600 text-base font-medium text-white disabled:bg-slate-300 ${FOCUS_RING}`}
        >
          {busy ? 'Входим…' : 'Войти'}
        </button>

        {error ? (
          <p role="alert" className="text-sm text-rose-600">
            {error}
          </p>
        ) : null}

        <p className="pt-2 text-xs text-slate-500">
          Пароль задаётся в Supabase: Authentication → Users → ваш пользователь. Там же его можно сменить.
        </p>
      </form>
    </div>
  )
}
