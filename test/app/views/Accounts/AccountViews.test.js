/**
 * @jest-environment jsdom
 */
import { render, screen, act, waitFor } from '../../../componentSetup'
import AccountList from '../../../../app/views/Accounts/AccountList'
import AccountDetail from '../../../../app/views/Accounts/AccountDetail'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const mockAccount = { id: '0xabc123', name: 'Test Account', signer: 'signer-1' }
const mockSigner = { type: 'ring', status: 'ok' }
const mockRawBalance = {
  chainId: 1,
  symbol: 'ETH',
  address: '0x0',
  balance: '1500000000000000000',
  decimals: 18
}
const mockDisplayedBalance = {
  ...mockRawBalance,
  displayBalance: '1.50',
  displayValue: '3,000',
  totalValue: { toNumber: () => 3000 }
}

// ---------------------------------------------------------------------------
// Mutable shared state (referenced inside jest.mock factories below)
// ---------------------------------------------------------------------------
// mockSnapState is accessed lazily via mockUseSnapshot to avoid TDZ issues
// with jest.mock hoisting of const declarations.
const mockSnapState = { selectedAccount: null }
const mockUseSnapshot = jest.fn(() => mockSnapState)
const mockSetSelectedAccount = jest.fn()
const mockUseAccounts = jest.fn()
const mockUseSigners = jest.fn()
const mockUseAccountsMeta = jest.fn()
const mockUseNetworksMeta = jest.fn()
const mockUseSelectedAccount = jest.fn()
const mockUseBalances = jest.fn()
const mockUsePermissions = jest.fn()
const mockUseOrigins = jest.fn()
const mockAccountSort = jest.fn(() => 0)
const mockGetSignerDisplayType = jest.fn()
const mockIsHardwareSigner = jest.fn()
const mockCreateBalance = jest.fn()
const mockSortByTotalValue = jest.fn(() => 0)
const mockRenameAccount = jest.fn()
const mockRemoveAccount = jest.fn()
const mockVerifyAddress = jest.fn()
const mockRemoveOrigin = jest.fn()

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
jest.mock('valtio', () => ({
  useSnapshot: (...args) => mockUseSnapshot(...args),
  proxy: jest.fn((obj) => obj)
}))

jest.mock('../../../../app/store', () => ({
  state: {},  // placeholder — useSnapshot is fully mocked above
  setSelectedAccount: (...args) => mockSetSelectedAccount(...args),
  useAccounts: (...args) => mockUseAccounts(...args),
  useSigners: (...args) => mockUseSigners(...args),
  useAccountsMeta: (...args) => mockUseAccountsMeta(...args),
  useNetworksMeta: (...args) => mockUseNetworksMeta(...args),
  useSelectedAccount: (...args) => mockUseSelectedAccount(...args),
  useBalances: (...args) => mockUseBalances(...args),
  usePermissions: (...args) => mockUsePermissions(...args),
  useOrigins: (...args) => mockUseOrigins(...args)
}))

jest.mock('../../../../app/ipc', () => ({
  actions: {
    renameAccount: (...args) => mockRenameAccount(...args),
    removeAccount: (...args) => mockRemoveAccount(...args),
    verifyAddress: (...args) => mockVerifyAddress(...args),
    removeOrigin: (...args) => mockRemoveOrigin(...args),
    openExternal: jest.fn(),
    clipboardData: jest.fn()
  }
}))

jest.mock('../../../../resources/domain/account', () => ({
  accountSort: (...args) => mockAccountSort(...args)
}))

jest.mock('../../../../resources/domain/signer', () => ({
  getSignerDisplayType: (...args) => mockGetSignerDisplayType(...args),
  isHardwareSigner: (...args) => mockIsHardwareSigner(...args)
}))

jest.mock('../../../../resources/domain/balance', () => ({
  createBalance: (...args) => mockCreateBalance(...args),
  sortByTotalValue: (...args) => mockSortByTotalValue(...args)
}))

jest.mock('../../../../app/components/Address', () => {
  return function MockAddress({ address }) {
    return <span data-testid="mock-address">{address}</span>
  }
})

jest.mock('../../../../app/components/StatusDot', () => {
  return function MockStatusDot({ status }) {
    return <span data-testid="mock-status-dot" data-status={status}>{status}</span>
  }
})

jest.mock('../../../../app/components/Balance', () => {
  return function MockBalance({ symbol, displayBalance }) {
    return (
      <span data-testid="mock-balance">
        {symbol}: {displayBalance}
      </span>
    )
  }
})

jest.mock('../../../../app/components/ChainBadge', () => {
  return function MockChainBadge({ name }) {
    return <span data-testid="mock-chain-badge">{name}</span>
  }
})

jest.mock('../../../../app/components/BuyButton', () => {
  return function MockBuyButton() {
    return null
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setupDefaultMocks() {
  mockSnapState.selectedAccount = null
  mockUseAccounts.mockReturnValue({})
  mockUseSigners.mockReturnValue({})
  mockUseAccountsMeta.mockReturnValue({})
  mockUseNetworksMeta.mockReturnValue({})
  mockUseSelectedAccount.mockReturnValue(null)
  mockUseBalances.mockReturnValue([])
  mockUsePermissions.mockReturnValue({})
  mockUseOrigins.mockReturnValue({})
  mockGetSignerDisplayType.mockReturnValue('hot')
  mockIsHardwareSigner.mockReturnValue(false)
  mockCreateBalance.mockReturnValue(mockDisplayedBalance)
  mockSortByTotalValue.mockReturnValue(0)
}

// ---------------------------------------------------------------------------
// AccountList tests
// ---------------------------------------------------------------------------
describe('AccountList', () => {
  beforeEach(() => {
    setupDefaultMocks()
  })

  // 1. Renders heading and Add button
  it('renders Accounts heading and + Add button', () => {
    render(<AccountList onAdd={jest.fn()} />)
    expect(screen.getByText('Accounts')).toBeDefined()
    expect(screen.getByText('+ Add')).toBeDefined()
  })

  // 2. Shows account name and signer type
  it('shows account name and signer type for each account', () => {
    mockUseAccounts.mockReturnValue({ '0xabc123': mockAccount })
    mockUseSigners.mockReturnValue({ 'signer-1': mockSigner })
    mockGetSignerDisplayType.mockReturnValue('hot')

    render(<AccountList onAdd={jest.fn()} />)

    expect(screen.getByText('Test Account')).toBeDefined()
    expect(screen.getByText('hot')).toBeDefined()
  })

  // 3. Empty state
  it('shows empty state when no accounts exist', () => {
    mockUseAccounts.mockReturnValue({})

    render(<AccountList onAdd={jest.fn()} />)

    expect(screen.getByText('No accounts yet')).toBeDefined()
  })

  // 4. Clicking account calls setSelectedAccount
  it('clicking an account calls setSelectedAccount with account id', async () => {
    mockUseAccounts.mockReturnValue({ '0xabc123': mockAccount })
    mockUseSigners.mockReturnValue({ 'signer-1': mockSigner })

    const { user } = render(<AccountList onAdd={jest.fn()} />)

    await user.click(screen.getByText('Test Account'))
    expect(mockSetSelectedAccount).toHaveBeenCalledWith('0xabc123')
  })

  // 5. Selected account has highlighted border styling
  it('selected account has highlighted border styling', () => {
    mockUseAccounts.mockReturnValue({ '0xabc123': mockAccount })
    mockUseSigners.mockReturnValue({ 'signer-1': mockSigner })
    mockSnapState.selectedAccount = '0xabc123'

    render(<AccountList onAdd={jest.fn()} />)

    const button = screen.getByText('Test Account').closest('button')
    expect(button.className).toContain('border-gray-700')
  })

  // 6. Accounts are sorted using accountSort
  it('renders accounts sorted using accountSort', () => {
    const acc1 = { id: '0xacc1', name: 'Alpha', signer: null }
    const acc2 = { id: '0xacc2', name: 'Beta', signer: null }
    mockUseAccounts.mockReturnValue({ '0xacc1': acc1, '0xacc2': acc2 })
    // accountSort sorts acc2 before acc1
    mockAccountSort.mockImplementation((a, b) => (a.name > b.name ? 1 : -1))

    render(<AccountList onAdd={jest.fn()} />)

    const names = screen.getAllByText(/Alpha|Beta/)
    expect(names[0].textContent).toBe('Alpha')
    expect(names[1].textContent).toBe('Beta')
    expect(mockAccountSort).toHaveBeenCalled()
  })

  // 7. + Add button calls onAdd
  it('+ Add button calls onAdd callback', async () => {
    const onAdd = jest.fn()
    const { user } = render(<AccountList onAdd={onAdd} />)

    await user.click(screen.getByText('+ Add'))
    expect(onAdd).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// AccountDetail tests
// ---------------------------------------------------------------------------
describe('AccountDetail', () => {
  beforeEach(() => {
    setupDefaultMocks()
    mockSnapState.selectedAccount = '0xabc123'
  })

  // 8. No selected account
  it('shows placeholder when no account is selected', () => {
    mockUseSelectedAccount.mockReturnValue(null)
    mockSnapState.selectedAccount = null

    render(<AccountDetail />)

    expect(screen.getByText('Select an account to view details')).toBeDefined()
  })

  // 9. Shows account name, signer type, signer status
  it('shows account name, signer type and status', () => {
    mockUseSelectedAccount.mockReturnValue(mockAccount)
    mockUseSigners.mockReturnValue({ 'signer-1': mockSigner })
    mockGetSignerDisplayType.mockReturnValue('hot')

    render(<AccountDetail />)

    expect(screen.getByText('Test Account')).toBeDefined()
    expect(screen.getByText('hot')).toBeDefined()
    expect(screen.getAllByText('ok').length).toBeGreaterThan(0)
  })

  // 10. Rename — clicking rename shows input form
  it('clicking rename shows input form with Save and Cancel', async () => {
    mockUseSelectedAccount.mockReturnValue(mockAccount)
    mockUseSigners.mockReturnValue({ 'signer-1': mockSigner })

    const { user } = render(<AccountDetail />)

    await user.click(screen.getByText('rename'))
    expect(screen.getByRole('textbox')).toBeDefined()
    expect(screen.getByText('Save')).toBeDefined()
    expect(screen.getByText('Cancel')).toBeDefined()
  })

  // 11. Rename — typing and submitting calls actions.renameAccount
  it('typing a new name and clicking Save calls renameAccount', async () => {
    mockUseSelectedAccount.mockReturnValue(mockAccount)
    mockUseSigners.mockReturnValue({ 'signer-1': mockSigner })

    const { user } = render(<AccountDetail />)

    await user.click(screen.getByText('rename'))
    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'New Name')
    await user.click(screen.getByText('Save'))

    expect(mockRenameAccount).toHaveBeenCalledWith('0xabc123', 'New Name')
  })

  // 12. Rename — Cancel hides form without saving
  it('Cancel button hides rename form without calling renameAccount', async () => {
    mockUseSelectedAccount.mockReturnValue(mockAccount)
    mockUseSigners.mockReturnValue({ 'signer-1': mockSigner })

    const { user } = render(<AccountDetail />)

    await user.click(screen.getByText('rename'))
    expect(screen.getByRole('textbox')).toBeDefined()

    await user.click(screen.getByText('Cancel'))
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(mockRenameAccount).not.toHaveBeenCalled()
  })

  // 13. Rename — Enter key submits the form (catches Enter-key-triggers-wrong-button bug)
  it('pressing Enter in rename input submits rename, not Back/other buttons', async () => {
    mockUseSelectedAccount.mockReturnValue(mockAccount)
    mockUseSigners.mockReturnValue({ 'signer-1': mockSigner })

    const { user } = render(<AccountDetail />)

    await user.click(screen.getByText('rename'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Entered Name')
    await user.keyboard('{Enter}')

    expect(mockRenameAccount).toHaveBeenCalledWith('0xabc123', 'Entered Name')
    // Form should be hidden after submit
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  // 14. Signer — hardware signer with ok status shows Verify on device
  it('shows Verify on device button for hardware signer with ok status', () => {
    const hardwareSigner = { type: 'ledger', status: 'ok' }
    mockUseSelectedAccount.mockReturnValue(mockAccount)
    mockUseSigners.mockReturnValue({ 'signer-1': hardwareSigner })
    mockGetSignerDisplayType.mockReturnValue('ledger')
    mockIsHardwareSigner.mockReturnValue(true)

    render(<AccountDetail />)

    expect(screen.getByText('Verify on device')).toBeDefined()
  })

  // 15. Signer — hot signer does NOT show Verify on device
  it('does NOT show Verify on device for hot signer', () => {
    mockUseSelectedAccount.mockReturnValue(mockAccount)
    mockUseSigners.mockReturnValue({ 'signer-1': mockSigner })
    mockGetSignerDisplayType.mockReturnValue('hot')
    mockIsHardwareSigner.mockReturnValue(false)

    render(<AccountDetail />)

    expect(screen.queryByText('Verify on device')).toBeNull()
  })

  // 16. Balances — renders balance list sorted by USD value
  it('renders balance list when balances are present', () => {
    mockUseSelectedAccount.mockReturnValue(mockAccount)
    mockUseSigners.mockReturnValue({ 'signer-1': mockSigner })
    mockUseBalances.mockReturnValue([mockRawBalance])
    mockCreateBalance.mockReturnValue(mockDisplayedBalance)

    render(<AccountDetail />)

    expect(screen.getAllByText(/ETH/).length).toBeGreaterThan(0)
    expect(mockCreateBalance).toHaveBeenCalled()
  })

  // 17. Balances — empty balances shows No balances
  it('shows No balances when balances array is empty', () => {
    mockUseSelectedAccount.mockReturnValue(mockAccount)
    mockUseSigners.mockReturnValue({ 'signer-1': mockSigner })
    mockUseBalances.mockReturnValue([])

    render(<AccountDetail />)

    expect(screen.getByText('No balances')).toBeDefined()
  })

  // 18. Permissions — renders connected origins with Revoke buttons
  it('renders connected origins with Revoke buttons', () => {
    const mockPerms = {
      'handler-1': { handlerId: 'handler-1', origin: 'https://app.example.com' }
    }
    const mockOriginsData = {
      'handler-1': { name: 'Example App' }
    }
    mockUseSelectedAccount.mockReturnValue(mockAccount)
    mockUseSigners.mockReturnValue({ 'signer-1': mockSigner })
    mockUsePermissions.mockReturnValue(mockPerms)
    mockUseOrigins.mockReturnValue(mockOriginsData)

    render(<AccountDetail />)

    expect(screen.getByText('Example App')).toBeDefined()
    expect(screen.getByText('Revoke')).toBeDefined()
  })

  // 19. Permissions — clicking Revoke calls actions.removeOrigin
  it('clicking Revoke calls removeOrigin with handlerId', async () => {
    const mockPerms = {
      'handler-1': { handlerId: 'handler-1', origin: 'https://app.example.com' }
    }
    mockUseSelectedAccount.mockReturnValue(mockAccount)
    mockUseSigners.mockReturnValue({ 'signer-1': mockSigner })
    mockUsePermissions.mockReturnValue(mockPerms)
    mockUseOrigins.mockReturnValue({})

    const { user } = render(<AccountDetail />)

    await user.click(screen.getByText('Revoke'))
    expect(mockRemoveOrigin).toHaveBeenCalledWith('handler-1')
  })

  // 20. Remove Account — button opens confirmation modal
  it('Remove Account button opens confirmation modal', async () => {
    mockUseSelectedAccount.mockReturnValue(mockAccount)
    mockUseSigners.mockReturnValue({ 'signer-1': mockSigner })

    const { user } = render(<AccountDetail />)

    await user.click(screen.getByText('Remove Account'))
    expect(screen.getByText('Are you sure you want to remove this account?', { exact: false })).toBeDefined()
  })

  // 21. Remove modal Cancel — closes modal
  it('Remove modal Cancel closes the modal without removing', async () => {
    mockUseSelectedAccount.mockReturnValue(mockAccount)
    mockUseSigners.mockReturnValue({ 'signer-1': mockSigner })

    const { user } = render(<AccountDetail />)

    await user.click(screen.getByText('Remove Account'))
    expect(screen.getByText('Are you sure you want to remove this account?', { exact: false })).toBeDefined()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Are you sure you want to remove this account?', { exact: false })).toBeNull()
    expect(mockRemoveAccount).not.toHaveBeenCalled()
  })

  // 22. Remove modal Remove — calls removeAccount and clears selection
  it('Remove modal Remove button calls removeAccount and setSelectedAccount(null)', async () => {
    mockUseSelectedAccount.mockReturnValue(mockAccount)
    mockUseSigners.mockReturnValue({ 'signer-1': mockSigner })

    const { user } = render(<AccountDetail />)

    await user.click(screen.getByText('Remove Account'))
    await user.click(screen.getByRole('button', { name: 'Remove' }))

    expect(mockRemoveAccount).toHaveBeenCalledWith('0xabc123')
    expect(mockSetSelectedAccount).toHaveBeenCalledWith(null)
  })
})
