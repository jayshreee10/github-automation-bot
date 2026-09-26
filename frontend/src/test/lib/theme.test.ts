import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { applyInitialTheme, setTheme, useTheme } from '@/lib/theme'

afterEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

describe('theme', () => {
  it('restores the saved choice before render', () => {
    localStorage.setItem('theme', 'dark')
    applyInitialTheme()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('falls back to light when nothing is saved and the OS has no preference', () => {
    applyInitialTheme()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('toggles, persists and re-renders subscribers', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
    act(() => result.current.toggle())
    expect(result.current.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    act(() => setTheme('light'))
    expect(result.current.theme).toBe('light')
  })
})
