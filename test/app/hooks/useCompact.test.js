/**
 * @jest-environment jsdom
 */
import { render as rtlRender } from '@testing-library/react'
import { render, screen, act } from '../../componentSetup'
import { useCompact } from '../../../app/hooks/useCompact'

// Helper component to expose the hook's return value
const TestComponent = () => {
  const compact = useCompact()
  return <div data-testid='result'>{compact ? 'compact' : 'full'}</div>
}

// Helper to set up matchMedia mock
function mockMatchMedia(matches) {
  const listeners = []
  const mql = {
    matches,
    addEventListener: jest.fn((event, handler) => {
      listeners.push(handler)
    }),
    removeEventListener: jest.fn((event, handler) => {
      const index = listeners.indexOf(handler)
      if (index !== -1) listeners.splice(index, 1)
    }),
    dispatchChange: (newMatches) => {
      listeners.forEach((handler) => handler({ matches: newMatches }))
    }
  }
  window.matchMedia = jest.fn(() => mql)
  return mql
}

beforeEach(() => {
  // Reset matchMedia mock before each test
  delete window.matchMedia
})

it('returns a boolean', () => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })
  mockMatchMedia(false)
  render(<TestComponent />)
  const text = screen.getByTestId('result').textContent
  expect(text === 'compact' || text === 'full').toBe(true)
})

it('returns false (full layout) when window.innerWidth is above the breakpoint', () => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })
  mockMatchMedia(false)

  render(<TestComponent />)

  expect(screen.getByTestId('result').textContent).toBe('full')
})

it('returns true (compact layout) when window.innerWidth is below the breakpoint', () => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 })
  mockMatchMedia(true)

  render(<TestComponent />)

  expect(screen.getByTestId('result').textContent).toBe('compact')
})

it('updates to compact when window resizes below the breakpoint', () => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })
  const mql = mockMatchMedia(false)

  render(<TestComponent />)
  expect(screen.getByTestId('result').textContent).toBe('full')

  act(() => {
    mql.dispatchChange(true)
  })

  expect(screen.getByTestId('result').textContent).toBe('compact')
})

it('updates to full when window resizes above the breakpoint', () => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 })
  const mql = mockMatchMedia(true)

  render(<TestComponent />)
  expect(screen.getByTestId('result').textContent).toBe('compact')

  act(() => {
    mql.dispatchChange(false)
  })

  expect(screen.getByTestId('result').textContent).toBe('full')
})

it('removes the event listener on unmount (cleanup)', () => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })
  const mql = mockMatchMedia(false)

  const { unmount } = rtlRender(<TestComponent />)
  expect(mql.addEventListener).toHaveBeenCalledTimes(1)

  unmount()

  expect(mql.removeEventListener).toHaveBeenCalledTimes(1)
  // Verify the same handler was added and removed
  const addedHandler = mql.addEventListener.mock.calls[0][1]
  const removedHandler = mql.removeEventListener.mock.calls[0][1]
  expect(addedHandler).toBe(removedHandler)
})
