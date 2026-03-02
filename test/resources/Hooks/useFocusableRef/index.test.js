/**
 * @jest-environment jsdom
 */
import { render as rtlRender, act } from '@testing-library/react'
import { render, screen } from '../../../componentSetup'
import useFocusableRef from '../../../../resources/Hooks/useFocusableRef'

const TestComponent = ({ focus, delay }) => {
  const ref = useFocusableRef(focus, delay)
  return <input data-testid='input' ref={ref} />
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

it('returns a ref object', () => {
  let capturedRef
  const Capture = () => {
    capturedRef = useFocusableRef()
    return null
  }
  render(<Capture />)
  expect(capturedRef).toBeDefined()
  expect(typeof capturedRef).toBe('object')
  expect('current' in capturedRef).toBe(true)
})

it('calls element.focus() after the default 900ms delay when focus=true', () => {
  render(<TestComponent focus={true} />)
  const input = screen.getByTestId('input')
  const focusSpy = jest.spyOn(input, 'focus')

  act(() => {
    jest.advanceTimersByTime(899)
  })
  expect(focusSpy).not.toHaveBeenCalled()

  act(() => {
    jest.advanceTimersByTime(1)
  })
  expect(focusSpy).toHaveBeenCalledTimes(1)
})

it('does NOT call element.focus() when focus=false', () => {
  render(<TestComponent focus={false} />)
  const input = screen.getByTestId('input')
  const focusSpy = jest.spyOn(input, 'focus')

  act(() => {
    jest.advanceTimersByTime(2000)
  })
  expect(focusSpy).not.toHaveBeenCalled()
})

it('does NOT call element.focus() when focus=undefined', () => {
  render(<TestComponent />)
  const input = screen.getByTestId('input')
  const focusSpy = jest.spyOn(input, 'focus')

  act(() => {
    jest.advanceTimersByTime(2000)
  })
  expect(focusSpy).not.toHaveBeenCalled()
})

it('calls focus() after the specified custom delay, not the default', () => {
  render(<TestComponent focus={true} delay={200} />)
  const input = screen.getByTestId('input')
  const focusSpy = jest.spyOn(input, 'focus')

  act(() => {
    jest.advanceTimersByTime(199)
  })
  expect(focusSpy).not.toHaveBeenCalled()

  act(() => {
    jest.advanceTimersByTime(1)
  })
  expect(focusSpy).toHaveBeenCalledTimes(1)
})

it('calls clearTimeout on unmount (cleanup)', () => {
  const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
  const { unmount } = rtlRender(<TestComponent focus={true} />)

  unmount()

  expect(clearTimeoutSpy).toHaveBeenCalled()
  clearTimeoutSpy.mockRestore()
})

it('does not throw when ref.current is null (ref not attached to element)', () => {
  const NoElementComponent = () => {
    useFocusableRef(true)
    return null
  }
  expect(() => {
    render(<NoElementComponent />)
    act(() => {
      jest.advanceTimersByTime(900)
    })
  }).not.toThrow()
})

it('does not call focus after switching focus from true to false via re-render', () => {
  const { rerender } = rtlRender(<TestComponent focus={true} />)
  const input = document.querySelector('[data-testid="input"]')
  const focusSpy = jest.spyOn(input, 'focus')

  rerender(<TestComponent focus={false} />)

  act(() => {
    jest.advanceTimersByTime(900)
  })
  expect(focusSpy).not.toHaveBeenCalled()
})
