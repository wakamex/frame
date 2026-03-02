/**
 * @jest-environment jsdom
 */
import { render, screen, act } from '../../../componentSetup'
import HistoryView from '../../../../app/views/History/index'

const mockClearTxHistory = jest.fn()
const mockOpenExplorer = jest.fn()

jest.mock('../../../../app/store', () => ({
  useTxHistory: jest.fn(),
  useAccounts: jest.fn(),
  useNetworks: jest.fn()
}))

jest.mock('../../../../app/ipc', () => ({
  actions: {
    clearTxHistory: (...args) => mockClearTxHistory(...args),
    openExplorer: (...args) => mockOpenExplorer(...args)
  }
}))

const { useTxHistory, useAccounts, useNetworks } = require('../../../../app/store')

const defaultTxs = [
  {
    hash: '0x1234567890abcdef1234567890abcdef',
    status: 'confirmed',
    submittedAt: 1700000000000,
    chainId: 1,
    decodedName: 'Transfer'
  },
  {
    hash: '0xfedcba0987654321fedcba0987654321',
    status: 'pending',
    submittedAt: 1700001000000,
    chainId: 10
  }
]

const defaultNetworks = {
  '1': { id: 1, name: 'Ethereum' },
  '10': { id: 10, name: 'Optimism' }
}

beforeEach(() => {
  mockClearTxHistory.mockReset()
  mockOpenExplorer.mockReset()

  useAccounts.mockReturnValue({
    '0xabc': { name: 'Alice' },
    '0xdef': { name: 'Bob' }
  })
  useTxHistory.mockReturnValue(defaultTxs)
  useNetworks.mockReturnValue(defaultNetworks)
})

describe('HistoryView', () => {
  it('renders Transaction History heading', () => {
    render(<HistoryView />)
    expect(screen.getByText('Transaction History')).toBeDefined()
  })

  describe('empty state', () => {
    beforeEach(() => {
      useTxHistory.mockReturnValue([])
    })

    it('shows "No transactions yet" when no txs', () => {
      render(<HistoryView />)
      expect(screen.getByText('No transactions yet')).toBeDefined()
    })

    it('does not show Clear button when no transactions', () => {
      render(<HistoryView />)
      expect(screen.queryByText('Clear')).toBeNull()
    })
  })

  describe('transaction list', () => {
    it('sorts transactions by submittedAt descending (newest first)', () => {
      render(<HistoryView />)
      const hashes = screen.getAllByText(/0x[a-f0-9]+\.\.\./)
      // The pending tx (submittedAt: 1700001000000) should appear before confirmed (submittedAt: 1700000000000)
      // pending tx hash truncated: 0xfedc...4321
      // confirmed tx hash truncated: 0x1234...cdef
      expect(hashes[0].textContent).toBe('0xfedc...4321')
      expect(hashes[1].textContent).toBe('0x1234...cdef')
    })

    it('shows truncated hash for each transaction', () => {
      render(<HistoryView />)
      expect(screen.getByText('0x1234...cdef')).toBeDefined()
      expect(screen.getByText('0xfedc...4321')).toBeDefined()
    })

    it('shows StatusBadge with correct status', () => {
      render(<HistoryView />)
      expect(screen.getByText('confirmed')).toBeDefined()
      expect(screen.getByText('pending')).toBeDefined()
    })

    it('shows decodedName when available', () => {
      render(<HistoryView />)
      expect(screen.getByText('Transfer')).toBeDefined()
    })

    it('shows chain name for each transaction', () => {
      render(<HistoryView />)
      expect(screen.getByText('Ethereum')).toBeDefined()
      expect(screen.getByText('Optimism')).toBeDefined()
    })

    it('shows formatted time for each transaction', () => {
      render(<HistoryView />)
      // Both txs have submittedAt timestamps; we just verify there are time strings
      // formatTime returns 'Mon DD HH:MM' - verify at least one time string exists
      const timeEls = screen.getAllByText(/\d{2}:\d{2}/)
      expect(timeEls.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Explorer button', () => {
    it('calls actions.openExplorer with chain and hash when clicked', async () => {
      const { user } = render(<HistoryView />)
      const explorerButtons = screen.getAllByText('Explorer')
      await user.click(explorerButtons[0])
      expect(mockOpenExplorer).toHaveBeenCalledTimes(1)
      expect(mockOpenExplorer).toHaveBeenCalledWith(
        { type: 'ethereum', id: expect.any(Number) },
        expect.any(String)
      )
    })
  })

  describe('account selector', () => {
    it('is shown when there are more than 1 account', () => {
      render(<HistoryView />)
      expect(screen.getByRole('combobox')).toBeDefined()
    })

    it('is not shown when there is only 1 account', () => {
      useAccounts.mockReturnValue({ '0xabc': { name: 'Alice' } })
      render(<HistoryView />)
      expect(screen.queryByRole('combobox')).toBeNull()
    })

    it('changing account updates displayed transactions (calls useTxHistory with new address)', async () => {
      useTxHistory.mockImplementation((address) => {
        if (address === '0xabc') return defaultTxs
        return []
      })

      const { user } = render(<HistoryView />)
      // Initially showing transactions for 0xabc
      expect(screen.queryByText('No transactions yet')).toBeNull()

      // Change to 0xdef which has no transactions
      const select = screen.getByRole('combobox')
      await user.selectOptions(select, '0xdef')

      expect(screen.getByText('No transactions yet')).toBeDefined()
      expect(useTxHistory).toHaveBeenCalledWith('0xdef')
    })
  })

  describe('Clear button', () => {
    it('is shown when transactions exist', () => {
      render(<HistoryView />)
      expect(screen.getByText('Clear')).toBeDefined()
    })

    it('clicking Clear opens confirmation modal', async () => {
      const { user } = render(<HistoryView />)
      await user.click(screen.getByText('Clear'))
      expect(screen.getByText('Clear History')).toBeDefined()
      expect(screen.getByText('Remove all transaction history for this account?')).toBeDefined()
    })
  })

  describe('Clear confirmation modal', () => {
    const openModal = async () => {
      const result = render(<HistoryView />)
      await result.user.click(screen.getByText('Clear'))
      return result
    }

    it('Cancel button closes the modal', async () => {
      const { user } = await openModal()
      const cancelBtn = screen.getByText('Cancel')
      await user.click(cancelBtn)
      expect(screen.queryByText('Remove all transaction history for this account?')).toBeNull()
    })

    it('Clear button calls actions.clearTxHistory with selectedAddress', async () => {
      const { user } = await openModal()
      // Click the red Clear button in the modal (there are multiple "Clear" texts now)
      const clearButtons = screen.getAllByText('Clear')
      // The modal Clear button is inside the modal
      const modalClearBtn = clearButtons.find(
        (btn) => btn.tagName === 'BUTTON' && btn.closest('[class*="fixed"]')
      ) || clearButtons[clearButtons.length - 1]
      await user.click(modalClearBtn)
      expect(mockClearTxHistory).toHaveBeenCalledTimes(1)
      expect(mockClearTxHistory).toHaveBeenCalledWith('0xabc')
    })
  })
})

describe('truncateHash', () => {
  // We test truncateHash indirectly through rendered output
  it('truncates a long hash to first 6 + "..." + last 4 chars', () => {
    useTxHistory.mockReturnValue([
      {
        hash: '0x1234567890abcdef',
        status: 'confirmed',
        submittedAt: 1700000000000,
        chainId: 1
      }
    ])
    render(<HistoryView />)
    expect(screen.getByText('0x1234...cdef')).toBeDefined()
  })

  it('returns short hash (<12 chars) as-is', () => {
    useTxHistory.mockReturnValue([
      {
        hash: '0xabc',
        status: 'confirmed',
        submittedAt: 1700000000000,
        chainId: 1
      }
    ])
    render(<HistoryView />)
    expect(screen.getByText('0xabc')).toBeDefined()
  })
})
