import { describe, expect, it } from 'vitest'
import {
  checklistProgress,
  describeGoal,
  formatStreak,
  habitStreak,
  habitWeek,
  isScheduledOn,
  itemsToReset,
  pluralRu,
  weekProgress,
} from './habits'
import type { Checklist, ChecklistItem, Habit } from './types'

// 2026-09-24 — четверг.
const TODAY = '2026-09-24'

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    title: 'Зарядка',
    note: null,
    goalType: 'daily',
    goalTimes: 3,
    goalWeekdays: [],
    position: 0,
    archivedAt: null,
    ...overrides,
  }
}

function makeItem(overrides: Partial<ChecklistItem> = {}): ChecklistItem {
  return { id: 'i1', checklistId: 'c1', text: 'Паспорт', position: 0, checkedAt: null, ...overrides }
}

function daysBack(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(2026, 8, 24)
    date.setDate(date.getDate() - index)
    return `2026-09-${String(date.getDate()).padStart(2, '0')}`
  })
}

describe('расписание привычки', () => {
  it('«каждый день» и «N раз в неделю» запланированы всегда', () => {
    expect(isScheduledOn(makeHabit(), TODAY)).toBe(true)
    expect(isScheduledOn(makeHabit({ goalType: 'times_per_week', goalTimes: 3 }), TODAY)).toBe(true)
  })

  it('«по дням недели» — только в выбранные дни', () => {
    const habit = makeHabit({ goalType: 'weekdays', goalWeekdays: [1, 3, 5] })
    expect(isScheduledOn(habit, '2026-09-21')).toBe(true) // понедельник
    expect(isScheduledOn(habit, TODAY)).toBe(false) // четверг
  })

  it('описывает цель по-русски', () => {
    expect(describeGoal(makeHabit())).toBe('каждый день')
    expect(describeGoal(makeHabit({ goalType: 'times_per_week', goalTimes: 3 }))).toBe('3 раза в неделю')
    expect(describeGoal(makeHabit({ goalType: 'times_per_week', goalTimes: 1 }))).toBe('1 раз в неделю')
    expect(describeGoal(makeHabit({ goalType: 'weekdays', goalWeekdays: [5, 1, 3] }))).toBe('по пн, ср, пт')
    expect(describeGoal(makeHabit({ goalType: 'weekdays', goalWeekdays: [] }))).toBe('дни не выбраны')
  })
})

describe('сетка последних семи дней', () => {
  it('семь дней, последний — сегодня, будущего нет', () => {
    const week = habitWeek(makeHabit(), ['2026-09-24'], TODAY)
    expect(week).toHaveLength(7)
    expect(week[6]).toMatchObject({ iso: TODAY, isToday: true, done: true })
    expect(week[0].iso).toBe('2026-09-18')
    expect(week.every((day) => day.iso <= TODAY)).toBe(true)
  })

  it('отмечает запланированные дни', () => {
    const week = habitWeek(makeHabit({ goalType: 'weekdays', goalWeekdays: [1] }), [], TODAY)
    expect(week.filter((day) => day.scheduled).map((day) => day.iso)).toEqual(['2026-09-21'])
  })
})

describe('процент за неделю', () => {
  it('для «каждый день» цель — семь дней', () => {
    expect(weekProgress(makeHabit(), daysBack(5), TODAY)).toMatchObject({ done: 5, target: 7, percent: 71 })
  })

  it('для «по дням недели» цель — запланированные дни окна', () => {
    const habit = makeHabit({ goalType: 'weekdays', goalWeekdays: [1, 4] })
    expect(weekProgress(habit, ['2026-09-21'], TODAY)).toMatchObject({ target: 2, done: 1, percent: 50 })
  })

  it('для «N раз в неделю» цель — норма, процент не больше 100', () => {
    const habit = makeHabit({ goalType: 'times_per_week', goalTimes: 3 })
    expect(weekProgress(habit, daysBack(5), TODAY)).toMatchObject({ target: 3, percent: 100 })
  })
})

describe('серия', () => {
  it('считает дни подряд и включает сегодня', () => {
    expect(habitStreak(makeHabit(), daysBack(5), TODAY)).toMatchObject({ unit: 'day', value: 5 })
  })

  it('незакрытый сегодняшний день серию не обнуляет', () => {
    const withoutToday = daysBack(4).slice(1) // вчера и раньше
    expect(habitStreak(makeHabit(), withoutToday, TODAY).value).toBe(3)
  })

  it('два пропущенных дня подряд обнуляют серию', () => {
    expect(habitStreak(makeHabit(), ['2026-09-20', '2026-09-19'], TODAY).value).toBe(0)
  })

  it('незапланированные дни не разрывают серию у цели «по дням недели»', () => {
    const habit = makeHabit({ goalType: 'weekdays', goalWeekdays: [1, 3] }) // пн и ср
    expect(habitStreak(habit, ['2026-09-23', '2026-09-21', '2026-09-16'], TODAY).value).toBe(3)
  })

  it('для «N раз в неделю» считает недели', () => {
    const habit = makeHabit({ goalType: 'times_per_week', goalTimes: 2 })
    const dates = ['2026-09-21', '2026-09-22', '2026-09-15', '2026-09-16']
    expect(habitStreak(habit, dates, TODAY)).toMatchObject({ unit: 'week', value: 2 })
  })

  it('незакрытая текущая неделя серию не обнуляет', () => {
    const habit = makeHabit({ goalType: 'times_per_week', goalTimes: 3 })
    const lastWeekOnly = ['2026-09-15', '2026-09-16', '2026-09-17']
    expect(habitStreak(habit, lastWeekOnly, TODAY).value).toBe(1)
  })

  it('подписывает серию по-русски', () => {
    expect(formatStreak({ unit: 'day', value: 0, atWindowEdge: false })).toBe('нет серии')
    expect(formatStreak({ unit: 'day', value: 1, atWindowEdge: false })).toBe('1 день подряд')
    expect(formatStreak({ unit: 'day', value: 5, atWindowEdge: false })).toBe('5 дней подряд')
    expect(formatStreak({ unit: 'week', value: 3, atWindowEdge: false })).toBe('3 недели подряд')
    expect(formatStreak({ unit: 'day', value: 180, atWindowEdge: true })).toBe('180+ дней подряд')
  })

  it('знает русские формы числительных', () => {
    expect(pluralRu(1, 'день', 'дня', 'дней')).toBe('день')
    expect(pluralRu(3, 'день', 'дня', 'дней')).toBe('дня')
    expect(pluralRu(11, 'день', 'дня', 'дней')).toBe('дней')
    expect(pluralRu(21, 'день', 'дня', 'дней')).toBe('день')
  })
})

describe('прогресс чеклиста', () => {
  it('считает отмеченные пункты', () => {
    const items = [makeItem({ id: 'a', checkedAt: '2026-09-24T09:00:00.000Z' }), makeItem({ id: 'b' })]
    expect(checklistProgress(items)).toMatchObject({ done: 1, total: 2, percent: 50, label: '1 из 2', complete: false })
  })

  it('пустой шаблон не делит на ноль', () => {
    expect(checklistProgress([])).toMatchObject({ label: '0 из 0', percent: 0, complete: false })
  })

  it('полностью пройденный шаблон помечается завершённым', () => {
    const items = [makeItem({ id: 'a', checkedAt: 'now' }), makeItem({ id: 'b', checkedAt: 'now' })]
    expect(checklistProgress(items)).toMatchObject({ percent: 100, complete: true })
  })

  it('к сбросу берёт только отмеченные пункты', () => {
    const items = [makeItem({ id: 'a', checkedAt: 'now' }), makeItem({ id: 'b' })]
    expect(itemsToReset(items)).toEqual(['a'])
    expect(itemsToReset([makeItem({ id: 'b' })])).toEqual([])
  })
})

describe('вспомогательное', () => {
  it('чеклисты без архива идут по позиции', () => {
    const checklists: Checklist[] = [
      { id: 'b', title: 'Уборка', position: 1, startedAt: null, lastCompletedAt: null, archivedAt: null },
      { id: 'a', title: 'Поездка', position: 0, startedAt: null, lastCompletedAt: null, archivedAt: null },
      { id: 'c', title: 'Старый', position: 2, startedAt: null, lastCompletedAt: null, archivedAt: 'now' },
    ]
    expect(checklists.filter((item) => item.archivedAt === null)).toHaveLength(2)
  })
})
