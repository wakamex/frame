/**
 * @jest-environment jsdom
 */
import { render, screen, act, waitFor } from '../../../componentSetup'
import SendView from '../../../../app/views/Send/index'

const mockRpc = jest.fn()
const mockUseAccounts = jest.fn()
const mockUseBalances = jest.fn()
const mockUseNetworks = jest.fn()
const mockUseAddressBook = jest.fn()

jest.mock('../../../../app/ipc', () => ({
  rpc: (...args) => mockRpc(...args)
}))

jest.mock('../../../../app/store', () => ({
  state: { selectedAccount: null },
  useAccounts: (...args) => mockUseAccounts(...args),
  useBalances: (...args) => mockUseBalances(...args),
  useNetworks: (...args) => mockUseNetworks(...args),
  useAddressBook: (...args) => mockUseAddressBook(...args)
}))

jest.mock('valtio', () => ({
  useSnapshot: (obj) => obj,
  proxy: (obj) => obj
}))

const ACCOUNT_ID = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const RECIPIENT = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const TOKEN_ADDRESS = '0xcccccccccccccccccccccccccccccccccccccccc'

const defaultNetworks = {
  '1': { name: 'Mainnet', symbol: 'ETH', on: true },
  '137': { name: 'Polygon', symbol: 'MATIC', on: true }
}

const defaultBalances = [
  {
    address: TOKEN_ADDRESS,
    chainId: 1,
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    balance: '1000000000'
  }
]

const defaultAddressBook = {
  'contact-1': { address: '0xdddddddddddddddddddddddddddddddddddddddd', name: 'Alice' },
  'contact-2': { address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', name: 'Bob' }
}

describe('SendView', () => {
  beforeEach(() => {
    mockUseAccounts.mockReturnValue({ [ACCOUNT_ID]: { name: 'Test Account' } })
    mockUseNetworks.mockReturnValue(defaultNetworks)
    mockUseBalances.mockReturnValue(defaultBalances)
    mockUseAddressBook.mockReturnValue(defaultAddressBook)
  })

  // Test 1: No account selected
  it('shows message when no account is available', () => {
    mockUseAccounts.mockReturnValue({})
    render(<SendView />)
    expect(screen.getByText('Select an account to send from.')).toBeDefined()
  })

  // Test 2: Renders form fields
  it('renders form fields when an account is available', () => {
    render(<SendView />)
    expect(screen.getByText('Send')).toBeDefined()
    expect(screen.getByPlaceholderText('0x..., ENS name, or contact name')).toBeDefined()
    expect(screen.getByPlaceholderText('0.0')).toBeDefined()
    expect(screen.getByText('Review Transaction')).toBeDefined()
  })

  // Test 3: Valid 0x address enables submit (combined with amount)
  it('enables submit when valid 0x address and positive amount are provided', async () => {
    const { user } = render(<SendView />)
    await user.click(screen.getByPlaceholderText('0x..., ENS name, or contact name'))
    await user.paste(RECIPIENT)
    await user.click(screen.getByPlaceholderText('0.0'))
    await user.paste('1.0')
    expect(screen.getByText('Review Transaction').closest('button').disabled).toBe(false)
  })

  // Test 4: Contact autocomplete suggestions
  it('shows contact suggestions filtered by name prefix', async () => {
    const { user } = render(<SendView />)
    await user.click(screen.getByPlaceholderText('0x..., ENS name, or contact name'))
    await user.paste('Ali')
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.queryByText('Bob')).toBeNull()
  })

  // Test 4b: Contact suggestions filtered by address prefix
  it('shows up to 5 contact suggestions filtered by address', async () => {
    const { user } = render(<SendView />)
    await user.click(screen.getByPlaceholderText('0x..., ENS name, or contact name'))
    await user.paste('0xdd')
    expect(screen.getByText('Alice')).toBeDefined()
  })

  // Test 5: Selecting a contact fills in the address
  it('fills in address when a contact suggestion is selected', async () => {
    const { user } = render(<SendView />)
    const input = screen.getByPlaceholderText('0x..., ENS name, or contact name')
    await user.click(input)
    await user.paste('Ali')
    await user.click(screen.getByText('Alice').closest('button'))
    expect(input.value).toBe(defaultAddressBook['contact-1'].address)
  })

  // Test 6: ENS name shows resolve button
  it('shows resolve button when input contains a dot and does not start with 0x', async () => {
    const { user } = render(<SendView />)
    await user.click(screen.getByPlaceholderText('0x..., ENS name, or contact name'))
    await user.paste('vitalik.eth')
    expect(screen.getByText('Resolve')).toBeDefined()
  })

  // Test 7: ENS resolution calls rpc and fills resolved address
  it('resolves ENS name via rpc and displays resolved address', async () => {
    mockRpc.mockResolvedValue(RECIPIENT)
    const { user } = render(<SendView />)
    await user.click(screen.getByPlaceholderText('0x..., ENS name, or contact name'))
    await user.paste('vitalik.eth')

    await act(async () => {
      await user.click(screen.getByText('Resolve'))
      jest.runAllTimers()
    })

    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('resolveEnsName', 'vitalik.eth'))
    expect(screen.getByText(RECIPIENT)).toBeDefined()
  })

  // Test 8: Amount input with valid number enables submit
  it('enables submit when valid fractional amount is typed with recipient set', async () => {
    const { user } = render(<SendView />)
    await user.click(screen.getByPlaceholderText('0x..., ENS name, or contact name'))
    await user.paste(RECIPIENT)
    await user.click(screen.getByPlaceholderText('0.0'))
    await user.paste('0.5')
    expect(screen.getByText('Review Transaction').closest('button').disabled).toBe(false)
  })

  // Test 9: Non-numeric amount triggers error
  it('shows Invalid amount error when non-numeric amount is submitted', async () => {
    const { user } = render(<SendView />)
    await user.click(screen.getByPlaceholderText('0x..., ENS name, or contact name'))
    await user.paste(RECIPIENT)
    await user.click(screen.getByPlaceholderText('0.0'))
    await user.paste('abc')

    await act(async () => {
      await user.click(screen.getByText('Review Transaction'))
      jest.runAllTimers()
    })

    expect(screen.getByText('Invalid amount')).toBeDefined()
  })

  // Test 10: Changing chain updates available tokens
  it('updates native token symbol when chain is switched', async () => {
    const { user } = render(<SendView />)
    const [networkSelect] = screen.getAllByRole('combobox')
    await user.selectOptions(networkSelect, '137')

    // After switching to Polygon, the token select resets to native
    const [, tokenSelect] = screen.getAllByRole('combobox')
    expect(tokenSelect.value).toBe('native')
    const nativeOption = Array.from(tokenSelect.options).find((o) => o.value === 'native')
    expect(nativeOption.textContent).toBe('MATIC')
  })

  // Test 11: Selecting ERC-20 token updates token selection
  it('updates token selection when ERC-20 token is chosen', async () => {
    const { user } = render(<SendView />)
    const [, tokenSelect] = screen.getAllByRole('combobox')
    expect(tokenSelect.value).toBe('native')
    await user.selectOptions(tokenSelect, TOKEN_ADDRESS)
    expect(tokenSelect.value).toBe(TOKEN_ADDRESS)
  })

  // Test 12: Submit with native token sends value transfer
  it('sends native ETH transfer with correct value and chainId', async () => {
    mockRpc.mockResolvedValue(undefined)
    const { user } = render(<SendView />)
    await user.click(screen.getByPlaceholderText('0x..., ENS name, or contact name'))
    await user.paste(RECIPIENT)
    await user.click(screen.getByPlaceholderText('0.0'))
    await user.paste('1.0')

    await act(async () => {
      await user.click(screen.getByText('Review Transaction'))
      jest.runAllTimers()
    })

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith(
        'providerSend',
        expect.objectContaining({
          method: 'eth_sendTransaction',
          params: expect.arrayContaining([
            expect.objectContaining({
              from: ACCOUNT_ID,
              to: RECIPIENT,
              value: '0xde0b6b3a7640000',
              chainId: '0x1'
            })
          ])
        })
      )
    })
  })

  // Test 13: Submit with ERC-20 encodes transfer(address,uint256)
  it('encodes ERC-20 calldata with 0xa9059cbb signature for token transfer', async () => {
    mockRpc.mockResolvedValue(undefined)
    const { user } = render(<SendView />)

    const [, tokenSelect] = screen.getAllByRole('combobox')
    await user.selectOptions(tokenSelect, TOKEN_ADDRESS)
    await user.click(screen.getByPlaceholderText('0x..., ENS name, or contact name'))
    await user.paste(RECIPIENT)
    await user.click(screen.getByPlaceholderText('0.0'))
    await user.paste('1.0')

    await act(async () => {
      await user.click(screen.getByText('Review Transaction'))
      jest.runAllTimers()
    })

    await waitFor(() => {
      const call = mockRpc.mock.calls.find((c) => c[0] === 'providerSend')
      expect(call).toBeDefined()
      const tx = call[1].params[0]
      expect(tx.to).toBe(TOKEN_ADDRESS)
      expect(tx.value).toBe('0x0')
      // Transfer function signature
      expect(tx.data.startsWith('0xa9059cbb')).toBe(true)
      // Recipient address padded to 32 bytes in calldata
      expect(tx.data.toLowerCase()).toContain(RECIPIENT.slice(2).toLowerCase())
      // 1.0 USDC (decimals=6) = 1000000 = 0xf4240
      expect(tx.data.toLowerCase()).toContain('f4240')
    })
  })

  // Test 14: Submit disabled with missing recipient
  it('keeps submit button disabled when recipient is empty', () => {
    render(<SendView />)
    const submitBtn = screen.getByText('Review Transaction').closest('button')
    expect(submitBtn.disabled).toBe(true)
  })

  // Test 15: Submit with zero/negative amount shows error
  it('shows Invalid amount error when amount is zero', async () => {
    const { user } = render(<SendView />)
    await user.click(screen.getByPlaceholderText('0x..., ENS name, or contact name'))
    await user.paste(RECIPIENT)
    await user.click(screen.getByPlaceholderText('0.0'))
    await user.paste('0')

    await act(async () => {
      await user.click(screen.getByText('Review Transaction'))
      jest.runAllTimers()
    })

    expect(screen.getByText('Invalid amount')).toBeDefined()
  })

  // Bug-catching: Enter key in address input submits form, not wrong button
  it('pressing Enter in address input submits the form', async () => {
    mockRpc.mockResolvedValue(undefined)
    const { user } = render(<SendView />)
    await user.click(screen.getByPlaceholderText('0x..., ENS name, or contact name'))
    await user.paste(RECIPIENT)
    await user.click(screen.getByPlaceholderText('0.0'))
    await user.paste('1.0')

    const addressInput = screen.getByPlaceholderText('0x..., ENS name, or contact name')
    await user.click(addressInput)
    await user.keyboard('{Enter}')

    await act(async () => {
      jest.runAllTimers()
    })

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('providerSend', expect.anything())
    })
  })

  // Bug-catching: Enter in form with ENS+resolve button triggers submit, not resolve
  it('pressing Enter with ENS name triggers form submit error, not resolve', async () => {
    const { user } = render(<SendView />)
    await user.click(screen.getByPlaceholderText('0x..., ENS name, or contact name'))
    await user.paste('vitalik.eth')
    await user.click(screen.getByPlaceholderText('0.0'))
    await user.paste('1.0')

    // Resolve button is visible but Enter should submit the form
    expect(screen.getByText('Resolve')).toBeDefined()

    await act(async () => {
      await user.keyboard('{Enter}')
      jest.runAllTimers()
    })

    // Submit was triggered — unresolved ENS shows "Invalid recipient address"
    expect(screen.getByText('Invalid recipient address')).toBeDefined()
    // resolveEnsName was NOT called (no rpc call for resolve)
    expect(mockRpc).not.toHaveBeenCalledWith('resolveEnsName', expect.anything())
  })
})

describe('toSmallestUnit conversion (via submit)', () => {
  beforeEach(() => {
    mockUseAccounts.mockReturnValue({ [ACCOUNT_ID]: { name: 'Test Account' } })
    mockUseNetworks.mockReturnValue(defaultNetworks)
    mockUseBalances.mockReturnValue([])
    mockUseAddressBook.mockReturnValue({})
    mockRpc.mockResolvedValue(undefined)
  })

  const submitAndGetTx = async (amount) => {
    const { user } = render(<SendView />)
    await user.click(screen.getByPlaceholderText('0x..., ENS name, or contact name'))
    await user.paste(RECIPIENT)
    await user.click(screen.getByPlaceholderText('0.0'))
    await user.paste(amount)
    await act(async () => {
      await user.click(screen.getByText('Review Transaction'))
      jest.runAllTimers()
    })
    let capturedTx = null
    await waitFor(() => {
      const call = mockRpc.mock.calls.find((c) => c[0] === 'providerSend')
      expect(call).toBeDefined()
      capturedTx = call[1].params[0]
    })
    return capturedTx
  }

  it('converts 1.0 ETH to correct wei hex', async () => {
    const tx = await submitAndGetTx('1.0')
    // 1 ETH = 1e18 wei = 0xde0b6b3a7640000
    expect(tx.value).toBe('0xde0b6b3a7640000')
  })

  it('converts amount with trailing zeros identically to without', async () => {
    const tx = await submitAndGetTx('1.000')
    expect(tx.value).toBe('0xde0b6b3a7640000')
  })

  it('converts 0.100 ETH (leading fractional zero + trailing zero)', async () => {
    const tx = await submitAndGetTx('0.100')
    // 0.1 ETH = 1e17 wei = 0x16345785d8a0000
    expect(tx.value).toBe('0x16345785d8a0000')
  })

  it('converts very small amount 0.001 ETH', async () => {
    const tx = await submitAndGetTx('0.001')
    // 0.001 ETH = 1e15 wei = 0x38d7ea4c68000
    expect(tx.value).toBe('0x38d7ea4c68000')
  })
})

describe('chain sort order', () => {
  beforeEach(() => {
    mockUseAccounts.mockReturnValue({ [ACCOUNT_ID]: { name: 'Test Account' } })
    mockUseBalances.mockReturnValue([])
    mockUseAddressBook.mockReturnValue({})
  })

  it('lists mainnet (chainId 1) first regardless of object key order', () => {
    mockUseNetworks.mockReturnValue({
      '137': { name: 'Polygon', symbol: 'MATIC', on: true },
      '42161': { name: 'Arbitrum', symbol: 'ETH', on: true },
      '1': { name: 'Mainnet', symbol: 'ETH', on: true }
    })
    render(<SendView />)
    const [networkSelect] = screen.getAllByRole('combobox')
    expect(networkSelect.options[0].value).toBe('1')
    expect(networkSelect.options[1].value).toBe('137')
    expect(networkSelect.options[2].value).toBe('42161')
  })

  it('excludes chains where on is false', () => {
    mockUseNetworks.mockReturnValue({
      '1': { name: 'Mainnet', symbol: 'ETH', on: true },
      '5': { name: 'Goerli', symbol: 'ETH', on: false }
    })
    render(<SendView />)
    const [networkSelect] = screen.getAllByRole('combobox')
    expect(networkSelect.options.length).toBe(1)
    expect(networkSelect.options[0].value).toBe('1')
  })
})
