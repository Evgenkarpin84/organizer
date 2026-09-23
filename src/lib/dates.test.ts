import { describe, expect, it } from 'vitest'
import {
  addDaysISO,
  diffDaysISO,
  formatDayTitle,
  formatDueLabel,
  formatTime,
  isOverdue,
  nextDaysISO,
  parseISODate,
  toISODate,
  weekdayOf,
} from './dates'

const TODAY = '2026-09-16'

describe('работа с датами', () => {
  it('переводит дату в строку и обратно без сдвига часового пояса', () => {
    expect(toISODate(parseISODate(TODAY))).toBe(TODAY)
    expect(parseISODate(TODAY).getDate()).toBe(16)
  })

  it('прибавляет дни через границу месяца и года', () => {
    expect(addDaysISO('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysISO('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('считает разницу в днях', () => {
    expect(diffDaysISO('2026-09-16', '2026-09-23')).toBe(7)
    expect(diffDaysISO('2026-09-23', '2026-09-16')).toBe(-7)
  })

  it('нумерует дни недели с понедельника', () => {
    expect(weekdayOf('2026-09-16')).toBe(3)
    expect(weekdayOf('2026-09-20')).toBe(7)
    expect(weekdayOf('2026-09-21')).toBe(1)
  })

  it('считает просроченным только срок строго раньше сегодняшнего дня', () => {
    expect(isOverdue('2026-09-15', TODAY)).toBe(true)
    expect(isOverdue(TODAY, TODAY)).toBe(false)
    expect(isOverdue('2026-09-17', TODAY)).toBe(false)
    expect(isOverdue(null, TODAY)).toBe(false)
  })

  it('строит список ближайших дней', () => {
    const days = nextDaysISO(TODAY, 7)
    expect(days).toHaveLength(7)
    expect(days[0]).toBe(TODAY)
    expect(days[6]).toBe('2026-09-22')
  })

  it('подписывает дни по-русски', () => {
    expect(formatDayTitle(TODAY, TODAY)).toBe('Сегодня, 16 сентября')
    expect(formatDayTitle('2026-09-17', TODAY)).toBe('Завтра, 17 сентября')
    expect(formatDayTitle('2026-09-18', TODAY)).toBe('Пт, 18 сентября')
  })

  it('подписывает срок задачи', () => {
    expect(formatDueLabel(TODAY, '18:30', TODAY)).toBe('Сегодня, 18:30')
    expect(formatDueLabel('2026-09-15', null, TODAY)).toBe('Вчера')
    expect(formatDueLabel('2026-09-17', null, TODAY)).toBe('Завтра')
    expect(formatDueLabel(null, '10:00', TODAY)).toBeNull()
  })

  it('обрезает секунды во времени', () => {
    expect(formatTime('18:30:00')).toBe('18:30')
    expect(formatTime(null)).toBeNull()
  })
})
