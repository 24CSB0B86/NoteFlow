// vitest.setup.js
// Runs before each test file in the client test suite.
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// JSDOM does not implement scrollIntoView — mock it globally
window.Element.prototype.scrollIntoView = vi.fn()

// JSDOM does not implement window.confirm — mock it to return true
window.confirm = vi.fn(() => true)

// JSDOM does not implement navigator.clipboard — mock it
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  writable: true,
})
