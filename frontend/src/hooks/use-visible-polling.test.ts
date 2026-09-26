import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useVisiblePolling } from './use-visible-polling'

const INTERVAL = 1_000

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
}

// Advances fake time and flushes the awaited load() promises inside act.
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

describe('useVisiblePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setHidden(false)
  })
  afterEach(() => {
    vi.useRealTimers()
    setHidden(false)
  })

  it('loads on mount and again every interval while visible', async () => {
    let n = 0
    const load = vi.fn(async () => ++n)
    const { result } = renderHook(() => useVisiblePolling(load, INTERVAL, 'err'))
    await advance(0)
    expect(result.current.data).toBe(1)

    await advance(INTERVAL)
    await advance(INTERVAL)
    expect(load).toHaveBeenCalledTimes(3)
    expect(result.current.data).toBe(3)
  })

  it('loads on mount even when the tab starts hidden', async () => {
    setHidden(true)
    const load = vi.fn(async () => 'x')
    renderHook(() => useVisiblePolling(load, INTERVAL, 'err'))
    await advance(0)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('skips polls while hidden and reloads as soon as the tab is shown', async () => {
    const load = vi.fn(async () => 'x')
    renderHook(() => useVisiblePolling(load, INTERVAL, 'err'))
    await advance(0)

    setHidden(true)
    await advance(INTERVAL * 3)
    expect(load).toHaveBeenCalledTimes(1)

    setHidden(false)
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await advance(0)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('sets the error message on failure and clears it on the next success', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('500')).mockResolvedValue('ok')
    const { result } = renderHook(() => useVisiblePolling(load, INTERVAL, 'Could not load.'))
    await advance(0)
    expect(result.current.error).toBe('Could not load.')

    await advance(INTERVAL)
    expect(result.current.error).toBeNull()
    expect(result.current.data).toBe('ok')
  })

  it('stops polling after unmount', async () => {
    const load = vi.fn(async () => 'x')
    const { unmount } = renderHook(() => useVisiblePolling(load, INTERVAL, 'err'))
    await advance(0)
    unmount()
    await advance(INTERVAL * 5)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(load).toHaveBeenCalledTimes(1)
  })
})
