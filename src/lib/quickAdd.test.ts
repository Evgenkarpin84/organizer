import { describe, expect, it } from 'vitest'
import { makeList } from '../test/factories'
import { parseQuickAdd } from './quickAdd'

const TODAY = '2026-09-16'
const LISTS = [makeList({ id: 'list-work', name: 'Работа' }), makeList({ id: 'list-home', name: 'Дом' })]

function parse(input: string) {
  return parseQuickAdd(input, LISTS, TODAY)
}

describe('быстрый ввод', () => {
  it('разбирает дату и время', () => {
    const result = parse('Позвонить маме завтра в 12:30')
    expect(result.title).toBe('Позвонить маме')
    expect(result.dueDate).toBe('2026-09-17')
    expect(result.dueTime).toBe('12:30')
  })

  it('разбирает день недели, приоритет и список', () => {
    const result = parse('Отчёт в пятницу !3 #Работа')
    expect(result.title).toBe('Отчёт')
    expect(result.dueDate).toBe('2026-09-18')
    expect(result.priority).toBe(3)
    expect(result.listId).toBe('list-work')
  })

  it('понимает время без минут', () => {
    const result = parse('Встреча в 9')
    expect(result.title).toBe('Встреча')
    expect(result.dueTime).toBe('09:00')
  })

  it('понимает «через N дней»', () => {
    expect(parse('Позвонить в сервис через 3 дня').dueDate).toBe('2026-09-19')
    expect(parse('Отпуск через неделю').dueDate).toBe('2026-09-23')
  })

  it('разбирает явную дату и переносит прошедшую на следующий год', () => {
    expect(parse('Оплатить 25.09').dueDate).toBe('2026-09-25')
    expect(parse('Созвон 15.09').dueDate).toBe('2027-09-15')
    expect(parse('Годовщина 05.10.2027').dueDate).toBe('2027-10-05')
  })

  it('разбирает ежедневный повтор и ставит срок на сегодня', () => {
    const result = parse('Зарядка каждый день')
    expect(result.title).toBe('Зарядка')
    expect(result.repeatType).toBe('daily')
    expect(result.dueDate).toBe(TODAY)
  })

  it('разбирает повтор по дню недели', () => {
    const result = parse('Тренировка каждый вторник')
    expect(result.repeatType).toBe('weekly')
    expect(result.repeatWeekdays).toEqual([2])
    expect(result.dueDate).toBe('2026-09-22')
  })

  it('разбирает ежемесячный повтор вместе с датой', () => {
    const result = parse('Оплатить квартиру каждый месяц 25.09')
    expect(result.repeatType).toBe('monthly')
    expect(result.dueDate).toBe('2026-09-25')
    expect(result.repeatDayOfMonth).toBe(25)
  })

  it('разбирает интервал в днях', () => {
    const result = parse('Полить цветы каждые 3 дня')
    expect(result.repeatType).toBe('daily')
    expect(result.repeatInterval).toBe(3)
    expect(result.title).toBe('Полить цветы')
  })

  it('не создаёт список, которого нет: текст остаётся в названии', () => {
    const result = parse('Купить молоко #Магазин')
    expect(result.listId).toBeNull()
    expect(result.title).toBe('Купить молоко #Магазин')
  })

  it('оставляет название пустым, если распознано всё', () => {
    expect(parse('завтра').title).toBe('')
  })

  it('возвращает подсказки для предпросмотра', () => {
    const result = parse('Отчёт завтра в 10:00 !2 #Работа')
    expect(result.hints).toContain('Завтра, 10:00')
    expect(result.hints).toContain('приоритет: средний')
    expect(result.hints).toContain('список: Работа')
  })

  it('не трогает обычный текст', () => {
    const result = parse('Прочитать книгу')
    expect(result.title).toBe('Прочитать книгу')
    expect(result.dueDate).toBeNull()
    expect(result.dueTime).toBeNull()
    expect(result.repeatType).toBe('none')
  })
})
