import { describe, expect, it } from 'vitest'
import {
  buildItemRow,
  clampText,
  decodeBody,
  dedupeKey,
  matchesKeywords,
  normalizeUrl,
  parseFeed,
  selectItems,
  stripHtml,
  urlHash,
} from './feed.mjs'

const NOW = new Date('2026-09-24T12:00:00.000Z')

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Лента</title>
  <item>
    <title><![CDATA[Chery привезла новый кроссовер]]></title>
    <link>https://kolesa.ru/news/chery-new?utm_source=rss&amp;utm_medium=feed</link>
    <guid isPermaLink="false">kolesa-1</guid>
    <pubDate>Wed, 23 Sep 2026 09:30:00 +0300</pubDate>
    <description>&lt;p&gt;Подробности о &amp;laquo;новинке&amp;raquo;&lt;/p&gt;</description>
  </item>
  <item>
    <title>Новость без даты</title>
    <link>https://kolesa.ru/news/second</link>
    <description>Текст</description>
  </item>
</channel></rss>`

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>tag:habr.com,2026:post-1</id>
    <title>Как устроены трансформеры</title>
    <link rel="alternate" href="https://habr.com/ru/post/1/" />
    <published>2026-09-24T08:00:00Z</published>
    <summary>&lt;b&gt;Краткое&lt;/b&gt; описание</summary>
  </entry>
</feed>`

describe('разбор лент', () => {
  it('читает RSS 2.0 с CDATA и сущностями', () => {
    const { items, error } = parseFeed(RSS, { now: NOW })
    expect(error).toBeNull()
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      guid: 'kolesa-1',
      title: 'Chery привезла новый кроссовер',
      publishedAt: '2026-09-23T06:30:00.000Z',
    })
    expect(items[0].summary).toBe('Подробности о «новинке»')
  })

  it('подставляет время загрузки публикации без даты', () => {
    const { items } = parseFeed(RSS, { now: NOW })
    expect(items[1].publishedAt).toBe(NOW.toISOString())
  })

  it('читает Atom со ссылкой rel="alternate"', () => {
    const { items } = parseFeed(ATOM, { now: NOW })
    expect(items[0]).toMatchObject({
      guid: 'tag:habr.com,2026:post-1',
      url: 'https://habr.com/ru/post/1/',
      title: 'Как устроены трансформеры',
    })
    expect(items[0].summary).toBe('Краткое описание')
  })

  it('достраивает относительную ссылку и отбрасывает не-http', () => {
    const feed = `<rss><channel>
      <item><title>Относительная</title><link>/news/1</link></item>
      <item><title>Почта</title><link>mailto:a@b.ru</link></item>
      <item><title>Скрипт</title><link>javascript:alert(1)</link></item>
    </channel></rss>`
    const { items } = parseFeed(feed, { now: NOW, feedUrl: 'https://kolesa.ru/rss' })
    expect(items).toHaveLength(1)
    expect(items[0].url).toBe('https://kolesa.ru/news/1')
  })

  it('пустая, но валидная лента — не ошибка', () => {
    expect(parseFeed('<rss version="2.0"><channel><title>Пусто</title></channel></rss>')).toEqual({
      items: [],
      error: null,
    })
  })

  it('на не-XML отвечает ошибкой, а не исключением', () => {
    expect(parseFeed('<html><body>403 Forbidden</body></html>')).toEqual({
      items: [],
      error: 'Ответ не похож на ленту RSS или Atom',
    })
    expect(parseFeed('')).toMatchObject({ items: [] })
  })

  it('понимает windows-1251 из заголовка и из XML-декларации', () => {
    const bytes = new Uint8Array([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]) // «Привет» в cp1251
    expect(decodeBody(bytes, 'text/xml; charset=windows-1251')).toBe('Привет')

    const declaration = new TextEncoder().encode('<?xml version="1.0" encoding="utf-8"?><rss/>')
    expect(decodeBody(declaration, '')).toContain('<rss/>')
  })
})

describe('чистка и обрезка', () => {
  it('вырезает скрипты и стили вместе с содержимым', () => {
    expect(stripHtml('<style>a{}</style><script>x()</script><p>Текст&nbsp;новости</p>')).toBe('Текст новости')
  })

  it('обрезает по границе слова с многоточием', () => {
    const text = 'Очень длинный заголовок новости про важные события'
    const short = clampText(text, 20)
    expect(short.length).toBeLessThanOrEqual(20)
    expect(short.endsWith('…')).toBe(true)
    expect(clampText('Короткий', 20)).toBe('Короткий')
  })
})

describe('дедупликация', () => {
  it('нормализует ссылку: регистр, метки, якорь, хвостовой слеш', () => {
    expect(normalizeUrl('HTTPS://Kolesa.RU/news/Chery/?utm_source=rss&id=7#top')).toBe(
      'https://kolesa.ru/news/Chery?id=7',
    )
  })

  it('берёт guid, а без него — хэш ссылки', () => {
    expect(dedupeKey({ guid: 'kolesa-1', url: 'https://kolesa.ru/a' })).toBe('kolesa-1')
    expect(dedupeKey({ url: 'https://kolesa.ru/a' })).toBe(`sha256:${urlHash('https://kolesa.ru/a')}`)
  })

  it('одинаковые ссылки с разными метками дают один хэш', () => {
    expect(urlHash('https://a.ru/x?utm_source=rss')).toBe(urlHash('https://a.ru/x'))
  })
})

describe('отбор публикаций', () => {
  const item = (id, iso) => ({ guid: id, title: `Новость ${id}`, url: `https://a.ru/${id}`, summary: null, publishedAt: iso })

  it('отбрасывает старое и пришедшее из будущего', () => {
    const items = [
      item('fresh', '2026-09-24T10:00:00.000Z'),
      item('old', '2026-09-01T10:00:00.000Z'),
      item('future', '2026-09-30T10:00:00.000Z'),
    ]
    expect(selectItems(items, { now: NOW, backfillDays: 7 }).map((entry) => entry.guid)).toEqual(['fresh'])
  })

  it('оставляет самые свежие и не больше предела', () => {
    const items = Array.from({ length: 40 }, (_, index) =>
      item(String(index), new Date(NOW.getTime() - index * 3_600_000).toISOString()),
    )
    const selected = selectItems(items, { now: NOW, backfillDays: 7, maxPerSource: 10 })
    expect(selected).toHaveLength(10)
    expect(selected[0].guid).toBe('0')
  })

  it('убирает повторы внутри одной ленты', () => {
    const duplicate = [
      item('a', '2026-09-24T10:00:00.000Z'),
      { ...item('b', '2026-09-24T09:00:00.000Z'), url: 'https://a.ru/a?utm_source=x' },
    ]
    expect(selectItems(duplicate, { now: NOW })).toHaveLength(1)
  })

  it('фильтрует по ключевым словам источника', () => {
    const chery = item('a', '2026-09-24T10:00:00.000Z')
    chery.title = 'Chery показала новинку'
    const other = item('b', '2026-09-24T10:00:00.000Z')
    other.title = 'Lada обновила седан'
    expect(matchesKeywords(chery, ['chery', 'китайск'])).toBe(true)
    expect(matchesKeywords(other, ['chery', 'китайск'])).toBe(false)
    expect(matchesKeywords(other, [])).toBe(true)
  })
})

describe('строка публикации для базы', () => {
  it('содержит только разрешённые поля', () => {
    const row = buildItemRow({
      userId: 'owner',
      sourceId: 'src-1',
      topic: 'cars',
      item: {
        guid: 'kolesa-1',
        title: 'Chery привезла новый кроссовер',
        url: 'https://kolesa.ru/news/chery?utm_source=rss',
        summary: 'Подробности',
        publishedAt: '2026-09-23T06:30:00.000Z',
      },
      nowIso: '2026-09-24T12:00:00.000Z',
    })

    expect(Object.keys(row).sort()).toEqual(
      [
        'dedupe_key',
        'fetched_at',
        'guid',
        'published_at',
        'source_id',
        'summary',
        'title',
        'topic',
        'url',
        'url_hash',
        'user_id',
      ].sort(),
    )
    expect(row.url_hash).toBe(urlHash('https://kolesa.ru/news/chery'))
  })
})
