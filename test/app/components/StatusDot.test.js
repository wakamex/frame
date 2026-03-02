/**
 * @jest-environment jsdom
 */
import { render, screen } from '../../componentSetup'
import StatusDot from '../../../app/components/StatusDot'

describe('StatusDot', () => {
  it('renders with green indicator for status=ok', () => {
    render(<StatusDot status="ok" />)
    const dot = screen.getByTitle('ok')
    expect(dot.className).toContain('bg-green-400')
  })

  it('renders with green indicator for status=connected', () => {
    render(<StatusDot status="connected" />)
    const dot = screen.getByTitle('connected')
    expect(dot.className).toContain('bg-green-400')
  })

  it('renders with yellow indicator for status=locked', () => {
    render(<StatusDot status="locked" />)
    const dot = screen.getByTitle('locked')
    expect(dot.className).toContain('bg-yellow-400')
  })

  it('renders with red indicator for status=disconnected', () => {
    render(<StatusDot status="disconnected" />)
    const dot = screen.getByTitle('disconnected')
    expect(dot.className).toContain('bg-red-400')
  })

  it('renders with default/neutral indicator for unknown status', () => {
    render(<StatusDot status="unknown-xyz" />)
    const dot = screen.getByTitle('unknown-xyz')
    expect(dot.className).toContain('bg-gray-600')
  })

  it('renders as a small circle element with appropriate aria attributes', () => {
    render(<StatusDot status="ok" />)
    const dot = screen.getByTitle('ok')
    expect(dot.tagName.toLowerCase()).toBe('span')
    expect(dot.className).toContain('rounded-full')
    expect(dot.className).toContain('w-2')
    expect(dot.className).toContain('h-2')
    // title attribute serves as accessible label
    expect(dot.getAttribute('title')).toBe('ok')
  })
})
