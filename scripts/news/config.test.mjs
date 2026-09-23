import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseArgs, parseSources, readOptions, TOPIC_KEYS, topicTitle } from './config.mjs'

// Путь от корня репозитория: тесты запускаются оттуда, а import.meta.url под Vitest не файловый.
const REAL_SOURCES = JSON.parse(readFileSync('scripts/news/sources.json', 'utf8'))

describe('конфигурация источников', () => {
  it('в файле восемь тем и хотя бы два источника в каждой', () => {
    const { sources, errors } = parseSources(REAL_SOURCES)
    expect(errors).toEqual([])
    for (const topic of TOPIC_KEYS) {
      expect(sources.filter((source) => source.topic === topic).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('сортирует источники в порядке тем', () => {
    const { sources } = parseSources(REAL_SOURCES)
    const order = sources.map((source) => TOPIC_KEYS.indexOf(source.topic))
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('пропускает отключённые источники', () => {
    const { sources } = parseSources({
      sources: [
        { key: 'a', topic: 'ai', title: 'A', feedUrl: 'https://a.ru/rss', enabled: false },
        { key: 'b', topic: 'ai', title: 'B', feedUrl: 'https://b.ru/rss', enabled: true },
      ],
    })
    expect(sources.map((source) => source.key)).toEqual(['b'])
  })

  it('ругается на повтор ключа, повтор ленты, неизвестную тему, пустое название и не-http адрес', () => {
    const { errors } = parseSources({
      sources: [
        { key: 'a', topic: 'ai', title: 'A', feedUrl: 'https://a.ru/rss' },
        { key: 'a', topic: 'ai', title: 'Дубль', feedUrl: 'https://c.ru/rss' },
        { key: 'b', topic: 'ai', title: 'B', feedUrl: 'https://a.ru/rss' },
        { key: 'c', topic: 'спорт', title: 'C', feedUrl: 'https://d.ru/rss' },
        { key: 'd', topic: 'ai', title: '  ', feedUrl: 'https://e.ru/rss' },
        { key: 'e', topic: 'ai', title: 'E', feedUrl: 'ftp://f.ru/rss' },
      ],
    })
    expect(errors).toHaveLength(5)
    expect(errors[0]).toContain('ключ повторяется')
    expect(errors[1]).toContain('адрес ленты повторяется')
    expect(errors[2]).toContain('неизвестная тема')
    expect(errors[3]).toContain('название')
    expect(errors[4]).toContain('http')
  })

  it('сообщает о неправильном формате файла', () => {
    expect(parseSources({}).errors[0]).toContain('массивом')
  })

  it('знает русские названия тем', () => {
    expect(topicTitle('print3d')).toBe('3D-печать')
    expect(topicTitle('неизвестная')).toBe('неизвестная')
  })
})

describe('аргументы и настройки запуска', () => {
  it('разбирает режимы и фильтры', () => {
    const options = parseArgs(['--check', '--dry-run', '--source=4pda', '--topic=ai', '--limit=5'])
    expect(options).toMatchObject({ check: true, dryRun: true, source: '4pda', topic: 'ai', limit: 5 })
    expect(options.errors).toEqual([])
  })

  it('ругается на неизвестную тему и мусорный аргумент', () => {
    expect(parseArgs(['--topic=спорт']).errors[0]).toContain('неизвестная тема')
    expect(parseArgs(['--что-то']).errors[0]).toContain('Неизвестный аргумент')
  })

  it('требует доступ к базе и подставляет пределы по умолчанию', () => {
    expect(readOptions({}).errors).toHaveLength(3)
    const base = { SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k', OWNER_USER_ID: 'o' }
    expect(readOptions(base)).toMatchObject({ backfillDays: 7, maxPerSource: 30, errors: [] })
    expect(readOptions({ ...base, NEWS_BACKFILL_DAYS: '3', NEWS_MAX_PER_SOURCE: '10' })).toMatchObject({
      backfillDays: 3,
      maxPerSource: 10,
    })
  })
})
