/**
 * @jest-environment jsdom
 */
import { render, screen, act, waitFor } from '../../../componentSetup'
import OnboardView from '../../../../app/views/Onboard/index'

// Mock AddAccount component used in the 'create' step
jest.mock('../../../../app/views/Accounts/AddAccount', () => {
  const { useState } = require('react')
  return function MockAddAccount({ onClose }) {
    return (
      <div>
        <div>Add Account</div>
        <button onClick={() => onClose()}>Complete Account Creation</button>
      </div>
    )
  }
})

describe('OnboardView', () => {
  it('renders welcome/intro screen on first load', () => {
    render(<OnboardView onComplete={jest.fn()} />)
    expect(screen.getByText('Welcome to Frame')).toBeDefined()
    expect(screen.getByText(/privacy-focused Ethereum wallet/)).toBeDefined()
  })

  it('shows account creation options (Get Started and Skip)', () => {
    render(<OnboardView onComplete={jest.fn()} />)
    expect(screen.getByText('Get Started')).toBeDefined()
    expect(screen.getByText('Skip')).toBeDefined()
  })

  it('navigates to account creation step when Get Started is clicked', async () => {
    const { user } = render(<OnboardView onComplete={jest.fn()} />)
    await user.click(screen.getByText('Get Started'))
    expect(screen.getByText('Add Account')).toBeDefined()
  })

  it('completing onboarding triggers onComplete callback via Skip', async () => {
    const onComplete = jest.fn()
    const { user } = render(<OnboardView onComplete={onComplete} />)
    await user.click(screen.getByText('Skip'))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('completing account creation shows done screen', async () => {
    const { user } = render(<OnboardView onComplete={jest.fn()} />)
    await user.click(screen.getByText('Get Started'))
    await user.click(screen.getByText('Complete Account Creation'))
    expect(screen.getByText("You're all set")).toBeDefined()
    expect(screen.getByText('Open Frame')).toBeDefined()
  })

  it('Open Frame button on done screen triggers onComplete', async () => {
    const onComplete = jest.fn()
    const { user } = render(<OnboardView onComplete={onComplete} />)
    await user.click(screen.getByText('Get Started'))
    await user.click(screen.getByText('Complete Account Creation'))
    await user.click(screen.getByText('Open Frame'))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
