import { describe, expect, it } from 'vitest'
import { maskSecrets, parseAccounts, parseArgs, readOptions } from './config.mjs'

const BASE_ENV = {
  MAIL_1_PROVIDER: 'mailru',
  MAIL_1_EMAIL: 'first@bk.ru',
  MAIL_1_PASSWORD: 'app-password-1',
  MAIL_2_PROVIDER: 'mailru',
  MAIL_2_EMAIL: 'second@mail.ru',
  MAIL_2_PASSWORD: 'app-password-2',
  MAIL_2_LABEL: 'Рабочая',
  MAIL_3_PROVIDER: 'mailru',
  MAIL_3_EMAIL: 'third@inbox.ru',
  MAIL_3_PASSWORD: 'app-password-3',
  MAIL_4_PROVIDER: 'yandex',
  MAIL_4_EMAIL: 'fourth@ya.ru',
  MAIL_4_PASSWORD: 'app-password-4',
}

describe('настройки ящиков', () => {
  it('собирает четыре ящика с хостами провайдеров', () => {
    const { accounts, errors } = parseAccounts(BASE_ENV)
    expect(errors).toEqual([])
    expect(accounts).toHaveLength(4)
    expect(accounts[0]).toMatchObject({ key: 'mail1', host: 'imap.mail.ru', port: 993, secure: true, folder: 'INBOX' })
    expect(accounts[3]).toMatchObject({ key: 'mail4', host: 'imap.yandex.ru', provider: 'yandex' })
  })

  it('берёт метку из настройки, иначе из адреса', () => {
    const { accounts } = parseAccounts(BASE_ENV)
    expect(accounts[1].label).toBe('Рабочая')
    expect(accounts[0].label).toBe('first@bk.ru')
  })

  it('сообщает о пропущенном пароле и не печатает его значение', () => {
    const { accounts, errors } = parseAccounts({ MAIL_1_PROVIDER: 'mailru', MAIL_1_EMAIL: 'a@bk.ru' })
    expect(accounts).toEqual([])
    expect(errors[0]).toContain('MAIL_1_PASSWORD')
    expect(errors.join(' ')).not.toContain('app-password')
  })

  it('сообщает о неизвестном провайдере', () => {
    const { errors } = parseAccounts({ MAIL_1_PROVIDER: 'gmail', MAIL_1_EMAIL: 'a@gmail.com', MAIL_1_PASSWORD: 'x' })
    expect(errors[0]).toContain('неизвестный провайдер')
  })

  it('сообщает, когда не задан ни один ящик', () => {
    const { errors } = parseAccounts({})
    expect(errors[0]).toContain('Не задан ни один ящик')
  })
})

describe('аргументы командной строки', () => {
  it('распознаёт режимы и параметры', () => {
    const options = parseArgs(['--check', '--dry-run', '--account=mail2', '--limit=50', '--verbose'])
    expect(options).toMatchObject({ check: true, dryRun: true, account: 'mail2', limit: 50, verbose: true })
    expect(options.errors).toEqual([])
  })

  it('ругается на непонятные значения', () => {
    expect(parseArgs(['--limit=abc']).errors[0]).toContain('--limit')
    expect(parseArgs(['--что-то']).errors[0]).toContain('Неизвестный аргумент')
  })
})

describe('общие настройки запуска', () => {
  it('требует адрес проекта, сервисный ключ и владельца', () => {
    const { errors } = readOptions({})
    expect(errors).toHaveLength(3)
    expect(errors.join(' ')).toContain('OWNER_USER_ID')
  })

  it('подставляет пределы по умолчанию и читает заданные', () => {
    const base = { SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k', OWNER_USER_ID: 'o' }
    expect(readOptions(base)).toMatchObject({ backfillDays: 30, maxPerRun: 200, errors: [] })
    expect(readOptions({ ...base, MAIL_BACKFILL_DAYS: '7', MAIL_MAX_PER_RUN: '50' })).toMatchObject({
      backfillDays: 7,
      maxPerRun: 50,
    })
    expect(readOptions({ ...base, MAIL_BACKFILL_DAYS: '-5' }).backfillDays).toBe(30)
  })
})

describe('чистка секретов', () => {
  it('прячет пароли в тексте ошибки', () => {
    const text = maskSecrets('Ошибка входа для app-password-1', ['app-password-1', ''])
    expect(text).toBe('Ошибка входа для ***')
  })
})
