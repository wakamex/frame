/**
 * @jest-environment jsdom
 */
import { screen, render, act, waitFor } from '../../../componentSetup'
import AddAccount from '../../../../app/views/Accounts/AddAccount'

// Mock the IPC actions module
const mockCreateFromAddress = jest.fn()
const mockResolveEnsName = jest.fn()

jest.mock('../../../../app/ipc', () => ({
  actions: {
    createFromPhrase: jest.fn(),
    createFromPrivateKey: jest.fn(),
    createFromKeystore: jest.fn(),
    createFromAddress: (...args) => mockCreateFromAddress(...args),
    locateKeystore: jest.fn(),
    resolveEnsName: (...args) => mockResolveEnsName(...args)
  }
}))

describe('AddAccount', () => {
  it('renders account type selection', () => {
    render(<AddAccount onClose={jest.fn()} />)
    expect(screen.getByText('Add Account')).toBeDefined()
    expect(screen.getByText('Watch Address')).toBeDefined()
    expect(screen.getByText('Seed Phrase')).toBeDefined()
  })

  it('calls onClose without address when Cancel is clicked', async () => {
    const onClose = jest.fn()
    const { user } = render(<AddAccount onClose={onClose} />)

    await user.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledWith()
  })

  it('navigates to Watch Address form when selected', async () => {
    const { user } = render(<AddAccount onClose={jest.fn()} />)

    await user.click(screen.getByText('Watch Address'))
    expect(screen.getByText('Watch Address', { selector: 'h3' })).toBeDefined()
    expect(screen.getByPlaceholderText('0x... or ENS name')).toBeDefined()
  })

  it('Back button does not submit the form', async () => {
    const onClose = jest.fn()
    const { user } = render(<AddAccount onClose={onClose} />)

    await user.click(screen.getByText('Watch Address'))
    // Click the Back button — should go back to type selection, not submit
    await user.click(screen.getByText(/Back/))
    expect(onClose).not.toHaveBeenCalled()
    // Should be back at type selection
    expect(screen.getByText('Add Account')).toBeDefined()
  })
})

describe('WatchAddressForm', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockCreateFromAddress.mockReset()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const navigateToWatchForm = async () => {
    const onClose = jest.fn()
    const result = render(<AddAccount onClose={onClose} />)
    await result.user.click(screen.getByText('Watch Address'))
    return { ...result, onClose }
  }

  it('calls onClose with the address after successful creation', async () => {
    mockCreateFromAddress.mockResolvedValue(undefined)
    const { user, onClose } = await navigateToWatchForm()

    await user.click(screen.getByPlaceholderText('0x... or ENS name'))
    await user.paste('0xd1074e0ae85610ddba0147e29ebe0d8e5873a000')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    // Flush the resolved promise
    await act(async () => {
      jest.runAllTimers()
    })

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledWith('0xd1074e0ae85610ddba0147e29ebe0d8e5873a000')
    })
  })

  it('does not call onClose when creation fails', async () => {
    mockCreateFromAddress.mockRejectedValue(new Error('Network error'))
    const { user, onClose } = await navigateToWatchForm()

    await user.click(screen.getByPlaceholderText('0x... or ENS name'))
    await user.paste('0xabc')

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Add' }))
      jest.runAllTimers()
    })

    expect(screen.getByText('Network error')).toBeDefined()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('pressing Enter submits the form, not the Back button', async () => {
    mockCreateFromAddress.mockResolvedValue(undefined)
    const { user, onClose } = await navigateToWatchForm()

    const input = screen.getByPlaceholderText('0x... or ENS name')
    await user.click(input)
    await user.paste('0xd1074e0ae85610ddba0147e29ebe0d8e5873a000')
    // Pressing Enter should submit, not trigger Back
    await user.keyboard('{Enter}')

    await act(async () => {
      jest.runAllTimers()
    })

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledWith('0xd1074e0ae85610ddba0147e29ebe0d8e5873a000')
    })
  })
})
