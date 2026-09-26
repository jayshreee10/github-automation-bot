import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Unmount rendered trees between tests so DOM queries never see a previous test's output.
afterEach(() => cleanup())
