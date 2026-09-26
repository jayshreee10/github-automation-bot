import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Unmount rendered trees between tests so DOM queries never see a previous test's output.
afterEach(() => cleanup())

// jsdom has no matchMedia; the toast container reads the system colour scheme through it.
if (!window.matchMedia)
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList

// jsdom has no ResizeObserver; Radix checkbox and switch measure themselves with it.
if (!window.ResizeObserver)
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
