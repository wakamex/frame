/**
 * @jest-environment jsdom
 */
import React, { useState } from 'react'
import { render, screen, act } from '../../componentSetup'
import Modal from '../../../app/components/Modal'

function ToggleModal({ onClose, title, children }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <button onClick={() => setOpen(false)}>close-wrapper</button>
      <Modal open={open} onClose={onClose} title={title}>{children}</Modal>
    </>
  )
}

describe('Modal', () => {
  it('renders nothing when open=false', () => {
    render(<Modal open={false} onClose={jest.fn()}><p>content</p></Modal>)
    expect(screen.queryByText('content')).toBeNull()
  })

  it('renders overlay and children when open=true', () => {
    render(<Modal open={true} onClose={jest.fn()}><p>modal content</p></Modal>)
    expect(screen.getByText('modal content')).toBeDefined()
  })

  it('shows title in header when title prop is provided', () => {
    render(<Modal open={true} onClose={jest.fn()} title="My Title"><p>body</p></Modal>)
    expect(screen.getByText('My Title')).toBeDefined()
  })

  it('does not render header when no title prop', () => {
    render(<Modal open={true} onClose={jest.fn()}><p>body</p></Modal>)
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('calls onClose when close button (×) is clicked', async () => {
    const onClose = jest.fn()
    const { user } = render(
      <Modal open={true} onClose={onClose} title="Test">
        <p>body</p>
      </Modal>
    )
    await user.click(screen.getByRole('button'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape key is pressed', async () => {
    const onClose = jest.fn()
    const { user } = render(
      <Modal open={true} onClose={onClose}>
        <p>body</p>
      </Modal>
    )
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when clicking the overlay background directly', () => {
    const onClose = jest.fn()
    render(
      <Modal open={true} onClose={onClose}>
        <p>body</p>
      </Modal>
    )
    // Find the overlay div (the outermost fixed div)
    const overlay = document.querySelector('.fixed.inset-0')
    expect(overlay).not.toBeNull()

    // Simulate a click event where target === overlay itself
    const event = new MouseEvent('click', { bubbles: true })
    Object.defineProperty(event, 'target', { value: overlay, writable: false })
    act(() => overlay.dispatchEvent(event))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onClose when clicking inside the dialog content', async () => {
    const onClose = jest.fn()
    const { user } = render(
      <Modal open={true} onClose={onClose}>
        <p>inner content</p>
      </Modal>
    )
    await user.click(screen.getByText('inner content'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('removes from DOM when open transitions true→false', async () => {
    const onClose = jest.fn()
    const { user } = render(
      <ToggleModal onClose={onClose}>
        <p>content</p>
      </ToggleModal>
    )
    expect(screen.getByText('content')).toBeDefined()

    await user.click(screen.getByText('close-wrapper'))
    expect(screen.queryByText('content')).toBeNull()
  })

  it('cleans up keyboard listener when modal is closed', async () => {
    const addSpy = jest.spyOn(window, 'addEventListener')
    const removeSpy = jest.spyOn(window, 'removeEventListener')

    const onClose = jest.fn()
    const { user } = render(
      <ToggleModal onClose={onClose}>
        <p>content</p>
      </ToggleModal>
    )

    // Listener should have been added
    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function))

    await user.click(screen.getByText('close-wrapper'))

    // Listener should have been removed
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
