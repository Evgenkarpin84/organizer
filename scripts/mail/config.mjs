// Разбор настроек сбора почты: чистые функции без сети и файловой системы.

const PROVIDERS = {
  mailru: { host: 'imap.mail.ru', port: 993, secure: true, title: 'Mail.ru' },
  yandex: { host: 'imap.yandex.ru', port: 993, secure: true, title: 'Яндекс' },
}

export const MAX_ACCOUNTS = 8
export const DEFAULT_BACKFILL_DAYS = 30
export const DEFAULT_MAX_PER_RUN = 200

export function providerTitle(provider) {
  return PROVIDERS[provider]?.title ?? provider
}

/** Ящики из переменных MAIL_1_*…MAIL_8_*. Пароли в текст ошибок не попадают. */
export function parseAccounts(env) {
  const accounts = []
  const errors = []

  for (let index = 1; index <= MAX_ACCOUNTS; index += 1) {
    const prefix = `MAIL_${index}_`
    const email = (env[`${prefix}EMAIL`] ?? '').trim()
    const provider = (env[`${prefix}PROVIDER`] ?? '').trim().toLowerCase()
    const password = env[`${prefix}PASSWORD`] ?? ''

    // Блок без адреса и пароля — неиспользуемый, даже если провайдер заполнен заранее, как в .env.example.
    if (!email && !password) continue

    if (!email) {
      errors.push(`${prefix}EMAIL: не задан адрес ящика`)
      continue
    }
    if (!provider) {
      errors.push(`${prefix}PROVIDER: не задан провайдер, ожидается mailru или yandex`)
      continue
    }
    if (!PROVIDERS[provider]) {
      errors.push(`${prefix}PROVIDER: неизвестный провайдер «${provider}», ожидается mailru или yandex`)
      continue
    }
    if (!password) {
      errors.push(`${prefix}PASSWORD: не задан пароль приложения`)
      continue
    }

    const settings = PROVIDERS[provider]
    accounts.push({
      key: `mail${index}`,
      label: (env[`${prefix}LABEL`] ?? '').trim() || email,
      email,
      provider,
      password,
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      folder: (env[`${prefix}FOLDER`] ?? '').trim() || 'INBOX',
    })
  }

  if (accounts.length === 0 && errors.length === 0) {
    errors.push('Не задан ни один ящик: заполните MAIL_1_EMAIL, MAIL_1_PROVIDER и MAIL_1_PASSWORD в .env')
  }

  return { accounts, errors }
}

export function parseArgs(argv) {
  const options = { check: false, dryRun: false, account: null, limit: null, verbose: false, errors: [] }

  for (const arg of argv) {
    if (arg === '--check') options.check = true
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--verbose') options.verbose = true
    else if (arg.startsWith('--account=')) {
      const value = arg.slice('--account='.length).trim()
      if (!value) options.errors.push('--account=: не указан ключ ящика, например --account=mail1')
      else options.account = value
    } else if (arg.startsWith('--limit=')) {
      const value = Number(arg.slice('--limit='.length))
      if (!Number.isFinite(value) || value <= 0) options.errors.push(`--limit: ожидается положительное число, получено «${arg}»`)
      else options.limit = Math.floor(value)
    } else {
      options.errors.push(`Неизвестный аргумент «${arg}»`)
    }
  }

  return options
}

/** Общие настройки запуска: подключение к базе и пределы выборки. */
export function readOptions(env) {
  const errors = []
  const supabaseUrl = (env.SUPABASE_URL ?? '').trim()
  const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  const ownerUserId = (env.OWNER_USER_ID ?? '').trim()

  if (!supabaseUrl) errors.push('SUPABASE_URL: не задан адрес проекта Supabase')
  if (!serviceRoleKey) errors.push('SUPABASE_SERVICE_ROLE_KEY: не задан сервисный ключ')
  if (!ownerUserId) errors.push('OWNER_USER_ID: не задан идентификатор владельца (Authentication → Users)')

  const backfillDays = positiveNumber(env.MAIL_BACKFILL_DAYS, DEFAULT_BACKFILL_DAYS)
  const maxPerRun = positiveNumber(env.MAIL_MAX_PER_RUN, DEFAULT_MAX_PER_RUN)

  return { supabaseUrl, serviceRoleKey, ownerUserId, backfillDays, maxPerRun, errors }
}

function positiveNumber(raw, fallback) {
  const value = Number((raw ?? '').toString().trim())
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

/** Убирает из текста значения паролей: такой текст можно писать в логи и в базу. */
export function maskSecrets(text, secrets) {
  let safe = String(text ?? '')
  for (const secret of secrets) {
    if (secret && secret.length >= 4) safe = safe.split(secret).join('***')
  }
  return safe
}
