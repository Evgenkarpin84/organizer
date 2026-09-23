import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { BottomNav } from './BottomNav'

describe('нижняя навигация', () => {
  it('содержит пять вкладок в заданном порядке', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <BottomNav />
      </MemoryRouter>,
    )

    const labels = screen.getAllByRole('link').map((link) => link.textContent)
    expect(labels).toEqual(['Сегодня', 'Задачи', 'Почта', 'Новости', 'Привычки'])
  })

  it('помечает активную вкладку', () => {
    render(
      <MemoryRouter initialEntries={['/tasks']}>
        <BottomNav />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Задачи' })).toHaveAttribute('aria-current', 'page')
  })
})
