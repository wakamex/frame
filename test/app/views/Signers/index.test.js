/**
 * @jest-environment jsdom
 */
import { render, screen, act, waitFor, within } from '../../../componentSetup'
import SignerList from '../../../../app/views/Signers/SignerList'
import SignerDetail from '../../../../app/views/Signers/SignerDetail'

const hotSigner = { id: 'hot-1', type: 'ring', status: 'locked', name: 'My Hot Wallet', addresses: ['0xabc', '0xdef'] }
const ledgerSigner = { id: 'ledger-1', type: 'ledger', status: 'ok', name: 'Nano X', model: 'Nano X', addresses: ['0x111'] }

// Store mocks
const mockUseSigners = jest.fn()
const mockUseSavedSigners = jest.fn()

jest.mock('../../../../app/store', () => ({
  useSigners: () => mockUseSigners(),
  useSavedSigners: () => mockUseSavedSigners()
}))

// IPC action mocks
const mockUnlockSigner = jest.fn()
const mockLockSigner = jest.fn()
const mockRemoveSigner = jest.fn()
const mockReloadSigner = jest.fn()
const mockVerifyAddress = jest.fn()

jest.mock('../../../../app/ipc', () => ({
  actions: {
    unlockSigner: (...args) => mockUnlockSigner(...args),
    lockSigner: (...args) => mockLockSigner(...args),
    removeSigner: (...args) => mockRemoveSigner(...args),
    reloadSigner: (...args) => mockReloadSigner(...args),
    verifyAddress: (...args) => mockVerifyAddress(...args)
  }
}))

// Domain/signer mocks
const mockGetSignerDisplayType = jest.fn()
const mockIsHardwareSigner = jest.fn()

jest.mock('../../../../resources/domain/signer', () => ({
  getSignerDisplayType: (...args) => mockGetSignerDisplayType(...args),
  isHardwareSigner: (...args) => mockIsHardwareSigner(...args)
}))

// Component mocks
jest.mock('../../../../app/components/StatusDot', () => ({
  __esModule: true,
  default: ({ status }) => <span data-testid="status-dot">{status}</span>
}))

jest.mock('../../../../app/components/Address', () => ({
  __esModule: true,
  default: ({ address }) => <span data-testid="address">{address}</span>
}))

jest.mock('../../../../app/components/Modal', () => ({
  __esModule: true,
  default: ({ open, children, title }) =>
    open ? (
      <div data-testid="modal">
        {title && <div>{title}</div>}
        {children}
      </div>
    ) : null
}))

beforeEach(() => {
  mockUseSigners.mockReturnValue({})
  mockUseSavedSigners.mockReturnValue({})
  mockGetSignerDisplayType.mockImplementation((type) =>
    ['ring', 'seed'].includes(type) ? 'hot' : type
  )
  mockIsHardwareSigner.mockImplementation((type) =>
    ['ledger', 'trezor', 'lattice'].includes(type)
  )
  mockUnlockSigner.mockResolvedValue(undefined)
  mockLockSigner.mockResolvedValue(undefined)
})

// ==================== SignerList ====================

describe('SignerList', () => {
  test('1. renders Signers heading', () => {
    render(<SignerList selectedSigner={null} onSelect={jest.fn()} />)
    expect(screen.getByText('Signers')).toBeDefined()
  })

  test('2. shows signer type and name for each signer', () => {
    mockUseSigners.mockReturnValue({ 'hot-1': hotSigner })
    render(<SignerList selectedSigner={null} onSelect={jest.fn()} />)
    const button = screen.getByRole('button', { name: /My Hot Wallet/ })
    expect(button.textContent).toContain('hot')
    expect(button.textContent).toContain('My Hot Wallet')
  })

  test('3. shows address count per signer', () => {
    mockUseSigners.mockReturnValue({ 'hot-1': hotSigner })
    render(<SignerList selectedSigner={null} onSelect={jest.fn()} />)
    const button = screen.getByRole('button', { name: /My Hot Wallet/ })
    expect(button.textContent).toContain('2 addresses')
  })

  test('4. shows status for each signer', () => {
    mockUseSigners.mockReturnValue({ 'hot-1': hotSigner })
    render(<SignerList selectedSigner={null} onSelect={jest.fn()} />)
    expect(screen.getByTestId('status-dot').textContent).toBe('locked')
  })

  test('5. shows empty state when no signers', () => {
    render(<SignerList selectedSigner={null} onSelect={jest.fn()} />)
    expect(screen.getByText('No signers detected')).toBeDefined()
  })

  test('6. clicking signer calls onSelect with signer id', async () => {
    mockUseSigners.mockReturnValue({ 'hot-1': hotSigner })
    const onSelect = jest.fn()
    const { user } = render(<SignerList selectedSigner={null} onSelect={onSelect} />)
    await user.click(screen.getByRole('button', { name: /My Hot Wallet/ }))
    expect(onSelect).toHaveBeenCalledWith('hot-1')
  })

  test('7. selected signer has highlighted styling', () => {
    mockUseSigners.mockReturnValue({ 'hot-1': hotSigner })
    render(<SignerList selectedSigner="hot-1" onSelect={jest.fn()} />)
    const button = screen.getByRole('button', { name: /My Hot Wallet/ })
    expect(button.className).toContain('border-gray-700')
  })

  test('8. live signers override saved signers with same id', () => {
    const savedVersion = { ...hotSigner, status: 'disconnected' }
    const liveVersion = { ...hotSigner, status: 'ok' }
    mockUseSigners.mockReturnValue({ 'hot-1': liveVersion })
    mockUseSavedSigners.mockReturnValue({ 'hot-1': savedVersion })
    render(<SignerList selectedSigner={null} onSelect={jest.fn()} />)
    const button = screen.getByRole('button', { name: /My Hot Wallet/ })
    expect(button.textContent).toContain('ok')
    expect(button.textContent).not.toContain('disconnected')
  })

  test('9. merges live and saved signers with different ids', () => {
    mockUseSigners.mockReturnValue({ 'hot-1': hotSigner })
    mockUseSavedSigners.mockReturnValue({ 'ledger-1': ledgerSigner })
    render(<SignerList selectedSigner={null} onSelect={jest.fn()} />)
    expect(screen.getByRole('button', { name: /My Hot Wallet/ })).toBeDefined()
    expect(screen.getByRole('button', { name: /Nano X/ })).toBeDefined()
  })
})

// ==================== SignerDetail ====================

describe('SignerDetail', () => {
  test('10. null signerId shows select a signer message', () => {
    render(<SignerDetail signerId={null} />)
    expect(screen.getByText('Select a signer to view details')).toBeDefined()
  })

  test('11. unknown signerId shows signer not found', () => {
    render(<SignerDetail signerId="unknown-id" />)
    expect(screen.getByText('Signer not found')).toBeDefined()
  })

  test('12. shows signer type, status, and name', () => {
    mockUseSigners.mockReturnValue({ 'hot-1': hotSigner })
    render(<SignerDetail signerId="hot-1" />)
    expect(screen.getByRole('heading', { name: 'hot' })).toBeDefined()
    expect(screen.getByText('My Hot Wallet')).toBeDefined()
    expect(screen.getAllByText('locked').length).toBeGreaterThan(0)
  })

  test('13. shows model when available', () => {
    mockUseSigners.mockReturnValue({ 'ledger-1': ledgerSigner })
    render(<SignerDetail signerId="ledger-1" />)
    // Both name and model are 'Nano X' — both should be rendered
    expect(screen.getAllByText('Nano X').length).toBeGreaterThanOrEqual(2)
  })

  test('14. shows numbered addresses', () => {
    mockUseSigners.mockReturnValue({ 'hot-1': hotSigner })
    render(<SignerDetail signerId="hot-1" />)
    const addresses = screen.getAllByTestId('address')
    expect(addresses[0].textContent).toBe('0xabc')
    expect(addresses[1].textContent).toBe('0xdef')
  })

  test('15. empty addresses shows no addresses message', () => {
    mockUseSigners.mockReturnValue({ 'hot-1': { ...hotSigner, addresses: [] } })
    render(<SignerDetail signerId="hot-1" />)
    expect(screen.getByText('No addresses available')).toBeDefined()
  })

  test('16. hot locked signer shows password form', () => {
    mockUseSigners.mockReturnValue({ 'hot-1': hotSigner })
    render(<SignerDetail signerId="hot-1" />)
    expect(screen.getByPlaceholderText('Enter password')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeDefined()
  })

  test('17. submitting unlock form calls actions.unlockSigner', async () => {
    mockUseSigners.mockReturnValue({ 'hot-1': hotSigner })
    const { user } = render(<SignerDetail signerId="hot-1" />)

    const input = screen.getByPlaceholderText('Enter password')
    await user.click(input)
    await user.paste('mypassword')
    // Submit via Enter key — tests that form onSubmit (not a stray button) handles submission
    await user.keyboard('{Enter}')

    await act(async () => {
      jest.runAllTimers()
    })

    await waitFor(() => {
      expect(mockUnlockSigner).toHaveBeenCalledWith('hot-1', 'mypassword')
    })
  })

  test('18. failed unlock shows error message', async () => {
    mockUnlockSigner.mockRejectedValue(new Error('Wrong password'))
    mockUseSigners.mockReturnValue({ 'hot-1': hotSigner })
    const { user } = render(<SignerDetail signerId="hot-1" />)

    await user.click(screen.getByPlaceholderText('Enter password'))
    await user.paste('wrongpassword')
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Unlock' }))
      jest.runAllTimers()
    })

    await waitFor(() => {
      expect(screen.getByText('Wrong password')).toBeDefined()
    })
  })

  test('19. hot signer ready shows Lock button, clicking calls lockSigner', async () => {
    mockUseSigners.mockReturnValue({ 'hot-1': { ...hotSigner, status: 'ok' } })
    const { user } = render(<SignerDetail signerId="hot-1" />)

    const lockBtn = screen.getByRole('button', { name: 'Lock' })
    expect(lockBtn).toBeDefined()

    await act(async () => {
      await user.click(lockBtn)
    })

    await act(async () => {
      jest.runAllTimers()
    })

    await waitFor(() => {
      expect(mockLockSigner).toHaveBeenCalledWith('hot-1')
    })
  })

  test('20. hardware signer shows Reload button, clicking calls reloadSigner', async () => {
    mockUseSigners.mockReturnValue({ 'ledger-1': ledgerSigner })
    const { user } = render(<SignerDetail signerId="ledger-1" />)

    const reloadBtn = screen.getByRole('button', { name: 'Reload' })
    expect(reloadBtn).toBeDefined()

    await user.click(reloadBtn)
    expect(mockReloadSigner).toHaveBeenCalledWith('ledger-1')
  })

  test('21. hardware signer ready shows Verify Address button', () => {
    mockUseSigners.mockReturnValue({ 'ledger-1': ledgerSigner })
    render(<SignerDetail signerId="ledger-1" />)
    expect(screen.getByRole('button', { name: 'Verify Address' })).toBeDefined()
  })

  test('22. Remove button is always visible', () => {
    mockUseSigners.mockReturnValue({ 'hot-1': hotSigner })
    render(<SignerDetail signerId="hot-1" />)
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDefined()
  })

  test('23. clicking Remove opens confirmation modal', async () => {
    mockUseSigners.mockReturnValue({ 'hot-1': hotSigner })
    const { user } = render(<SignerDetail signerId="hot-1" />)

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByTestId('modal')).toBeDefined()
  })

  test('24. Remove modal Cancel closes modal', async () => {
    mockUseSigners.mockReturnValue({ 'hot-1': hotSigner })
    const { user } = render(<SignerDetail signerId="hot-1" />)

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByTestId('modal')).toBeDefined()

    await user.click(within(screen.getByTestId('modal')).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByTestId('modal')).toBeNull()
  })

  test('25. Remove modal Remove button calls actions.removeSigner', async () => {
    mockUseSigners.mockReturnValue({ 'hot-1': hotSigner })
    const { user } = render(<SignerDetail signerId="hot-1" />)

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await user.click(within(screen.getByTestId('modal')).getByRole('button', { name: 'Remove' }))
    expect(mockRemoveSigner).toHaveBeenCalledWith('hot-1')
  })
})
