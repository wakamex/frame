/**
 * @jest-environment jsdom
 */
import { render, screen, act, waitFor } from '../../../componentSetup'
import TokensView from '../../../../app/views/Tokens/index'

// Mock the store
jest.mock('../../../../app/store', () => ({
  useTokens: jest.fn(),
  useNetworks: jest.fn()
}))

// Mock the IPC actions
jest.mock('../../../../app/ipc', () => ({
  actions: {
    removeToken: jest.fn(),
    addToken: jest.fn(),
    getTokenDetails: jest.fn(),
    clipboardData: jest.fn()
  }
}))

// Mock Address component to just render the address text
jest.mock('../../../../app/components/Address', () => {
  return function MockAddress({ address, className }) {
    return <span className={className}>{address}</span>
  }
})

const { useTokens, useNetworks } = require('../../../../app/store')
const { actions } = require('../../../../app/ipc')

const MOCK_TOKENS = [
  { name: 'USDC', symbol: 'USDC', decimals: 6, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chainId: 1 },
  { name: 'DAI', symbol: 'DAI', decimals: 18, address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', chainId: 1 }
]

const MOCK_NETWORKS = {
  '1': { id: 1, name: 'Ethereum', on: true },
  '10': { id: 10, name: 'Optimism', on: true }
}

beforeEach(() => {
  useTokens.mockReturnValue({ custom: MOCK_TOKENS })
  useNetworks.mockReturnValue(MOCK_NETWORKS)
  actions.removeToken.mockReset()
  actions.addToken.mockReset()
  actions.getTokenDetails.mockReset()
})

describe('TokensView', () => {
  it('renders Custom Tokens heading and + Add Token button', () => {
    render(<TokensView />)
    expect(screen.getByText('Custom Tokens')).toBeDefined()
    expect(screen.getByText('+ Add Token')).toBeDefined()
  })

  it('renders token list with name, symbol, and chain for each custom token', () => {
    render(<TokensView />)
    // USDC appears as both name and symbol - use getAllByText
    const usdcElements = screen.getAllByText('USDC')
    expect(usdcElements.length).toBeGreaterThanOrEqual(1)
    // DAI also appears as both name and symbol
    const daiElements = screen.getAllByText('DAI')
    expect(daiElements.length).toBeGreaterThanOrEqual(1)
    // chain names appear in the list
    const ethChains = screen.getAllByText('Ethereum')
    expect(ethChains.length).toBeGreaterThanOrEqual(1)
  })

  it('shows No custom tokens added when custom is empty', () => {
    useTokens.mockReturnValue({ custom: [] })
    render(<TokensView />)
    expect(screen.getByText('No custom tokens added')).toBeDefined()
  })

  it('does not show filter input when there are 5 or fewer tokens', () => {
    render(<TokensView />)
    expect(screen.queryByPlaceholderText('Filter tokens...')).toBeNull()
  })

  it('shows filter input only when there are more than 5 tokens', () => {
    const manyTokens = Array.from({ length: 6 }, (_, i) => ({
      name: `Token${i}`,
      symbol: `TK${i}`,
      decimals: 18,
      address: `0x${i.toString().padStart(40, '0')}`,
      chainId: 1
    }))
    useTokens.mockReturnValue({ custom: manyTokens })
    render(<TokensView />)
    expect(screen.getByPlaceholderText('Filter tokens...')).toBeDefined()
  })

  it('filters tokens by name', async () => {
    const manyTokens = Array.from({ length: 6 }, (_, i) => ({
      name: `Token${i}`,
      symbol: `TK${i}`,
      decimals: 18,
      address: `0x${i.toString().padStart(40, '0')}`,
      chainId: 1
    }))
    useTokens.mockReturnValue({ custom: manyTokens })
    const { user } = render(<TokensView />)
    const filterInput = screen.getByPlaceholderText('Filter tokens...')
    await user.type(filterInput, 'Token0')
    expect(screen.getByText('Token0')).toBeDefined()
    expect(screen.queryByText('Token1')).toBeNull()
  })

  it('filters tokens by symbol', async () => {
    const manyTokens = Array.from({ length: 6 }, (_, i) => ({
      name: `Token${i}`,
      symbol: `TK${i}`,
      decimals: 18,
      address: `0x${i.toString().padStart(40, '0')}`,
      chainId: 1
    }))
    useTokens.mockReturnValue({ custom: manyTokens })
    const { user } = render(<TokensView />)
    const filterInput = screen.getByPlaceholderText('Filter tokens...')
    await user.type(filterInput, 'TK3')
    expect(screen.getByText('Token3')).toBeDefined()
    expect(screen.queryByText('Token0')).toBeNull()
  })

  it('shows No tokens match filter when no tokens match', async () => {
    const manyTokens = Array.from({ length: 6 }, (_, i) => ({
      name: `Token${i}`,
      symbol: `TK${i}`,
      decimals: 18,
      address: `0x${i.toString().padStart(40, '0')}`,
      chainId: 1
    }))
    useTokens.mockReturnValue({ custom: manyTokens })
    const { user } = render(<TokensView />)
    const filterInput = screen.getByPlaceholderText('Filter tokens...')
    await user.type(filterInput, 'ZZZNOMATCH')
    expect(screen.getByText('No tokens match filter')).toBeDefined()
  })

  it('clicking Remove button opens confirmation modal', async () => {
    const { user } = render(<TokensView />)
    const removeButtons = screen.getAllByText('Remove')
    // Initially no modal title present
    await user.click(removeButtons[0])
    // Modal should appear with token name
    expect(screen.getByText('Remove Token')).toBeDefined()
  })

  it('Remove modal Cancel closes modal without calling removeToken', async () => {
    const { user } = render(<TokensView />)
    const removeButtons = screen.getAllByText('Remove')
    await user.click(removeButtons[0])
    // Now there are two "Cancel" buttons - click the one in the modal
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    await user.click(cancelBtn)
    expect(actions.removeToken).not.toHaveBeenCalled()
    // Modal should be gone
    expect(screen.queryByText('Remove Token')).toBeNull()
  })

  it('Remove modal Remove button calls actions.removeToken with token data', async () => {
    const { user } = render(<TokensView />)
    const removeButtons = screen.getAllByText('Remove')
    await user.click(removeButtons[0])
    // There should be a Remove button inside the modal now
    const modalRemoveBtn = screen.getAllByText('Remove').find(el => {
      return el.closest('[class*="bg-red"]') || el.tagName === 'BUTTON'
    })
    // Get the modal's Remove button specifically (the one after Cancel)
    const allRemoveBtns = screen.getAllByRole('button', { name: 'Remove' })
    // Last "Remove" button is in the modal
    await user.click(allRemoveBtns[allRemoveBtns.length - 1])
    expect(actions.removeToken).toHaveBeenCalledWith(MOCK_TOKENS[0])
  })

  it('Add Token button opens AddTokenForm modal', async () => {
    const { user } = render(<TokensView />)
    await user.click(screen.getByText('+ Add Token'))
    expect(screen.getByText('Add Token')).toBeDefined()
    expect(screen.getByText('Network')).toBeDefined()
    expect(screen.getByPlaceholderText('0x...')).toBeDefined()
  })
})

describe('AddTokenForm', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const openAddForm = async () => {
    const result = render(<TokensView />)
    await result.user.click(screen.getByText('+ Add Token'))
    return result
  }

  it('renders chain selector with active networks sorted by name', async () => {
    await openAddForm()
    // Find the select (combobox) for networks
    const selects = screen.getAllByRole('combobox')
    const networkSelect = selects[0]
    const options = Array.from(networkSelect.querySelectorAll('option')).map(o => o.textContent)
    expect(options).toContain('Ethereum')
    expect(options).toContain('Optimism')
    // Should be sorted by name - Ethereum before Optimism
    expect(options.indexOf('Ethereum')).toBeLessThan(options.indexOf('Optimism'))
  })

  it('typing valid address triggers 500ms debounced fetch', async () => {
    actions.getTokenDetails.mockResolvedValue({ name: 'Test Token', symbol: 'TEST', decimals: 18 })
    const { user } = await openAddForm()

    const addressInput = screen.getByPlaceholderText('0x...')
    await user.type(addressInput, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')

    // Should not have fetched yet (debounced)
    expect(actions.getTokenDetails).not.toHaveBeenCalled()

    // Advance timers by 500ms to trigger debounce
    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    await waitFor(() => {
      expect(actions.getTokenDetails).toHaveBeenCalledWith(
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        1
      )
    })
  })

  it('rapid typing only triggers one fetch', async () => {
    actions.getTokenDetails.mockResolvedValue({ name: 'Test Token', symbol: 'TEST', decimals: 18 })
    const { user } = await openAddForm()

    const addressInput = screen.getByPlaceholderText('0x...')

    // Type a partial address first
    await user.type(addressInput, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB4')
    // Advance less than debounce time
    act(() => { jest.advanceTimersByTime(200) })

    // Now type more to complete the address
    await user.type(addressInput, '8')

    // Advance full debounce
    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    await waitFor(() => {
      expect(actions.getTokenDetails).toHaveBeenCalledTimes(1)
    })
  })

  it('successful fetch populates name, symbol, and decimals fields', async () => {
    actions.getTokenDetails.mockResolvedValue({ name: 'USD Coin', symbol: 'USDC', decimals: 6 })
    const { user } = await openAddForm()

    const addressInput = screen.getByPlaceholderText('0x...')
    await user.type(addressInput, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')

    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    await waitFor(() => {
      expect(screen.getByDisplayValue('USD Coin')).toBeDefined()
      expect(screen.getByDisplayValue('USDC')).toBeDefined()
      expect(screen.getByDisplayValue('6')).toBeDefined()
    })
  })

  it('failed fetch shows error message', async () => {
    actions.getTokenDetails.mockRejectedValue(new Error('Token not found'))
    const { user } = await openAddForm()

    const addressInput = screen.getByPlaceholderText('0x...')
    await user.type(addressInput, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')

    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    await waitFor(() => {
      expect(screen.getByText('Token not found')).toBeDefined()
    })
  })

  it('fetch with no name shows error message', async () => {
    actions.getTokenDetails.mockResolvedValue(null)
    const { user } = await openAddForm()

    const addressInput = screen.getByPlaceholderText('0x...')
    await user.type(addressInput, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')

    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    await waitFor(() => {
      expect(screen.getByText('Could not find token at this address')).toBeDefined()
    })
  })

  it('Add button is disabled until all fields filled', async () => {
    actions.getTokenDetails.mockResolvedValue({ name: 'USD Coin', symbol: 'USDC', decimals: 6 })
    const { user } = await openAddForm()

    const addressInput = screen.getByPlaceholderText('0x...')
    await user.type(addressInput, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')

    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    await waitFor(() => {
      expect(screen.getByDisplayValue('USD Coin')).toBeDefined()
    })

    // Clear the name field
    const nameInput = screen.getByDisplayValue('USD Coin')
    await user.clear(nameInput)

    const addBtn = screen.getByRole('button', { name: 'Add Token' })
    expect(addBtn.disabled).toBe(true)
  })

  it('Add button is enabled when all fields are filled', async () => {
    actions.getTokenDetails.mockResolvedValue({ name: 'USD Coin', symbol: 'USDC', decimals: 6 })
    const { user } = await openAddForm()

    const addressInput = screen.getByPlaceholderText('0x...')
    await user.type(addressInput, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')

    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    await waitFor(() => {
      const addBtn = screen.getByRole('button', { name: 'Add Token' })
      expect(addBtn.disabled).toBe(false)
    })
  })

  it('clicking Add calls actions.addToken with correct data', async () => {
    actions.getTokenDetails.mockResolvedValue({ name: 'USD Coin', symbol: 'USDC', decimals: 6 })
    const { user } = await openAddForm()

    const addressInput = screen.getByPlaceholderText('0x...')
    await user.type(addressInput, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')

    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add Token' })).toBeDefined()
    })

    const addBtn = screen.getByRole('button', { name: 'Add Token' })
    await user.click(addBtn)

    expect(actions.addToken).toHaveBeenCalledWith({
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      chainId: 1
    })
  })

  it('decimals input rejects non-numeric characters', async () => {
    actions.getTokenDetails.mockResolvedValue({ name: 'USD Coin', symbol: 'USDC', decimals: 6 })
    const { user } = await openAddForm()

    const addressInput = screen.getByPlaceholderText('0x...')
    await user.type(addressInput, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')

    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    await waitFor(() => {
      expect(screen.getByDisplayValue('6')).toBeDefined()
    })

    const decimalsInput = screen.getByDisplayValue('6')
    await user.clear(decimalsInput)
    await user.type(decimalsInput, 'abc18xyz')

    // Should only contain digits
    expect(decimalsInput.value).toBe('18')
  })

  it('changing chain resets token fields', async () => {
    actions.getTokenDetails.mockResolvedValue({ name: 'USD Coin', symbol: 'USDC', decimals: 6 })
    const { user } = await openAddForm()

    const addressInput = screen.getByPlaceholderText('0x...')
    await user.type(addressInput, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')

    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    await waitFor(() => {
      expect(screen.getByDisplayValue('USD Coin')).toBeDefined()
    })

    // Change chain
    const selects = screen.getAllByRole('combobox')
    const select = selects[0]
    await user.selectOptions(select, '10')

    // Fields should be reset (Name field should be gone or empty since fetched is false)
    expect(screen.queryByDisplayValue('USD Coin')).toBeNull()
  })

  it('rejects short addresses (below 42 chars) - does not trigger fetch', async () => {
    actions.getTokenDetails.mockResolvedValue({ name: 'USD Coin', symbol: 'USDC', decimals: 6 })
    const { user } = await openAddForm()

    const addressInput = screen.getByPlaceholderText('0x...')
    await user.type(addressInput, '0xA0b86991') // too short

    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    expect(actions.getTokenDetails).not.toHaveBeenCalled()
  })

  it('rejects non-hex addresses - does not trigger fetch', async () => {
    actions.getTokenDetails.mockResolvedValue({ name: 'USD Coin', symbol: 'USDC', decimals: 6 })
    const { user } = await openAddForm()

    const addressInput = screen.getByPlaceholderText('0x...')
    // 40 chars but with invalid hex chars (G)
    await user.type(addressInput, '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG')

    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    expect(actions.getTokenDetails).not.toHaveBeenCalled()
  })
})
