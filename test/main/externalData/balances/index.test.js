import BalancesScanner from '../../../../main/externalData/balances'
import * as balancesController from '../../../../main/externalData/balances/controller'
import * as actions from '../../../../main/store/actions'
import store from '../../../../main/store'
import log from 'electron-log'

jest.mock('../../../../main/store')
jest.mock('../../../../main/externalData/balances/controller')
jest.mock('../../../../main/store/actions', () => ({
  setBalance: jest.fn(),
  setBalances: jest.fn(),
  addKnownTokens: jest.fn(),
  removeKnownTokens: jest.fn(),
  removeBalances: jest.fn(),
  accountTokensUpdated: jest.fn()
}))

const NATIVE_CURRENCY = '0x0000000000000000000000000000000000000000'
const address = '0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5'

const knownTokens = [
  {
    chainId: 10,
    address: '0x4200000000000000000000000000000000000042',
    symbol: 'OP'
  }
]

let balances

beforeAll(() => {
  log.transports.console.level = false
})

beforeEach(() => {
  jest.clearAllMocks()

  store.set('main.tokens.known', address, knownTokens)
  store.set('main.networks.ethereum.10', { id: 10, connection: { primary: { connected: true } } })
  store.set('main.accounts', address, { id: address, balances: {} })

  balances = BalancesScanner(store)
  balances.start()
})

afterEach(() => {
  balances.stop()
})

describe('scan lifecycle', () => {
  it('scans for balances when setting an address if the controller is ready', () => {
    balancesController.isRunning.mockReturnValue(true)
    balances.setAddress(address)

    jest.advanceTimersByTime(0)

    expect(balancesController.updateKnownTokenBalances).toHaveBeenCalled()
  })

  it('scans for balances as soon as the controller is ready', () => {
    balancesController.isRunning.mockReturnValue(false)
    balances.setAddress(address)

    expect(balancesController.updateKnownTokenBalances).not.toHaveBeenCalled()

    balancesController.emit('ready')
    jest.advanceTimersByTime(0)

    expect(balancesController.updateKnownTokenBalances).toHaveBeenCalled()
  })

  it('scans for balances every 10 minutes when paused', () => {
    balancesController.isRunning.mockReturnValue(true)
    balances.setAddress(address)

    balances.pause()

    jest.advanceTimersByTime(10 * 60 * 1000)

    expect(balancesController.updateKnownTokenBalances).toHaveBeenCalledTimes(1)
  })

  it('does not scan at 20s interval when paused', () => {
    balancesController.isRunning.mockReturnValue(true)
    balances.setAddress(address)
    jest.advanceTimersByTime(0)

    jest.clearAllMocks()
    balancesController.isRunning.mockReturnValue(true)
    balances.pause()

    jest.advanceTimersByTime(20_000)
    jest.advanceTimersByTime(0)

    expect(balancesController.updateChainBalances).not.toHaveBeenCalled()
  })

  it('rescans every 20 seconds when active', () => {
    balancesController.isRunning.mockReturnValue(true)
    balances.setAddress(address)
    jest.advanceTimersByTime(0)

    jest.clearAllMocks()
    balancesController.isRunning.mockReturnValue(true)

    // resetScan uses setTimeout(interval) → setTimeout(fn, 0) nested
    jest.advanceTimersByTime(20_000)
    jest.runAllTicks()
    jest.advanceTimersByTime(1)

    expect(balancesController.updateChainBalances).toHaveBeenCalledTimes(1)
  })

  it('stops scanning when address is cleared', () => {
    balancesController.isRunning.mockReturnValue(true)
    balances.setAddress(address)
    jest.advanceTimersByTime(0)

    jest.clearAllMocks()
    balancesController.isRunning.mockReturnValue(true)
    balances.setAddress('')

    jest.advanceTimersByTime(20_000)
    jest.advanceTimersByTime(0)

    expect(balancesController.updateChainBalances).not.toHaveBeenCalled()
  })

  it('resume restarts active scanning after pause', () => {
    balancesController.isRunning.mockReturnValue(true)
    // pause() reads the active address from state, so it must be set
    store.selected.current = address
    balances.setAddress(address)
    jest.advanceTimersByTime(0)

    // Clear call counts but keep mock implementations
    balancesController.updateChainBalances.mockClear()
    balancesController.scanForTokenBalances.mockClear()
    balancesController.updateKnownTokenBalances.mockClear()

    balances.pause()
    balances.resume()

    // resume → onResume → startScan → runWhenReady(isRunning=true) → initiateScan → setTimeout(fn, 0)
    jest.advanceTimersByTime(1)

    expect(balancesController.updateChainBalances).toHaveBeenCalled()
  })
})

describe('updateBalances', () => {
  it('only scans connected chains', () => {
    store.set('main.networks.ethereum.1', { id: 1, connection: { primary: { connected: true } } })
    store.set('main.networks.ethereum.137', { id: 137, connection: { primary: { connected: false }, secondary: { connected: false } } })

    balancesController.isRunning.mockReturnValue(true)
    balances.setAddress(address)
    jest.advanceTimersByTime(0)

    const chains = balancesController.updateChainBalances.mock.calls[0][1]
    expect(chains).toContain(1)
    expect(chains).toContain(10) // from beforeEach
    expect(chains).not.toContain(137)
  })

  it('includes secondary-connected chains', () => {
    store.set('main.networks.ethereum.42161', { id: 42161, connection: { primary: { connected: false }, secondary: { connected: true } } })

    balancesController.isRunning.mockReturnValue(true)
    balances.setAddress(address)
    jest.advanceTimersByTime(0)

    const chains = balancesController.updateChainBalances.mock.calls[0][1]
    expect(chains).toContain(42161)
  })

  it('does not call updateKnownTokenBalances when no tracked tokens on connected chains', () => {
    // Clear known tokens so there are none on connected chains
    store.set('main.tokens.known', {})
    store.set('main.tokens.custom', [])

    balancesController.isRunning.mockReturnValue(true)
    balances.setAddress(address)
    jest.advanceTimersByTime(0)

    expect(balancesController.updateKnownTokenBalances).not.toHaveBeenCalled()
  })

  it('deduplicates custom tokens from known tokens', () => {
    const token = { address: '0xDUPE', chainId: 10, symbol: 'DUPE', decimals: 18 }
    store.set('main.tokens.custom', [token])
    store.set('main.tokens.known', address, [token])

    balancesController.isRunning.mockReturnValue(true)
    balances.setAddress(address)
    jest.advanceTimersByTime(0)

    // Should only include the token once
    const tokens = balancesController.updateKnownTokenBalances.mock.calls[0][2] ||
      balancesController.updateKnownTokenBalances.mock.calls[0][1]
    // Count occurrences of the token
    const dupeCount = (Array.isArray(tokens) ? tokens : []).filter(t => t.address === '0xDUPE').length
    expect(dupeCount).toBeLessThanOrEqual(1)
  })

  it('filters tokens to only connected chains', () => {
    const connectedToken = { address: '0xCONN', chainId: 10, symbol: 'CONN', decimals: 18 }
    const disconnectedToken = { address: '0xDISC', chainId: 137, symbol: 'DISC', decimals: 18 }
    store.set('main.tokens.custom', [connectedToken, disconnectedToken])
    store.set('main.networks.ethereum.137', { id: 137, connection: { primary: { connected: false }, secondary: { connected: false } } })

    balancesController.isRunning.mockReturnValue(true)
    balances.setAddress(address)
    jest.advanceTimersByTime(0)

    const tokens = balancesController.updateKnownTokenBalances.mock.calls[0][1]
    expect(tokens.some(t => t.address === '0xCONN')).toBe(true)
    expect(tokens.some(t => t.address === '0xDISC')).toBe(false)
  })
})

describe('handleChainBalanceUpdate', () => {
  beforeEach(() => {
    balancesController.isRunning.mockReturnValue(true)
  })

  it('calls setBalance for new chain balances', () => {
    const chainBalances = [{ chainId: 10, balance: '0x1000', displayBalance: '0.000004096' }]
    balancesController.emit('chainBalances', address, chainBalances)

    expect(actions.setBalance).toHaveBeenCalledWith(address, {
      chainId: 10,
      balance: '0x1000',
      displayBalance: '0.000004096',
      symbol: undefined, // no networksMeta for chain 10
      address: NATIVE_CURRENCY
    })
  })

  it('uses correct native currency symbol from networksMeta', () => {
    store.set('main.networksMeta.ethereum.10', { nativeCurrency: { symbol: 'ETH' } })

    const chainBalances = [{ chainId: 10, balance: '0x1000', displayBalance: '0.000004096' }]
    balancesController.emit('chainBalances', address, chainBalances)

    expect(actions.setBalance).toHaveBeenCalledWith(address, expect.objectContaining({
      symbol: 'ETH'
    }))
  })

  it('skips unchanged chain balances', () => {
    store.set('main.balances', address, [
      { address: NATIVE_CURRENCY, chainId: 10, balance: '0x1000' }
    ])

    balancesController.emit('chainBalances', address, [
      { chainId: 10, balance: '0x1000', displayBalance: '0.000004096' }
    ])

    expect(actions.setBalance).not.toHaveBeenCalled()
  })

  it('updates when chain balance changes', () => {
    store.set('main.balances', address, [
      { address: NATIVE_CURRENCY, chainId: 10, balance: '0x1000' }
    ])

    balancesController.emit('chainBalances', address, [
      { chainId: 10, balance: '0x2000', displayBalance: '0.000008192' }
    ])

    expect(actions.setBalance).toHaveBeenCalledWith(address, expect.objectContaining({
      balance: '0x2000'
    }))
  })

  it('ignores updates for removed accounts', () => {
    delete store.main.accounts[address]

    balancesController.emit('chainBalances', address, [
      { chainId: 10, balance: '0x1000', displayBalance: '0.000004096' }
    ])

    expect(actions.setBalance).not.toHaveBeenCalled()
  })
})

describe('handleTokenBalanceUpdate', () => {
  beforeEach(() => {
    balancesController.isRunning.mockReturnValue(true)
  })

  it('calls setBalances for new non-zero token balances', () => {
    const tokenBalances = [
      { address: '0xTOKEN', chainId: 10, symbol: 'TKN', decimals: 18, balance: '0x100', displayBalance: '0.000256' }
    ]
    balancesController.emit('tokenBalances', address, tokenBalances)

    expect(actions.setBalances).toHaveBeenCalledWith(address, tokenBalances)
    expect(actions.addKnownTokens).toHaveBeenCalledWith(address, tokenBalances)
    expect(actions.accountTokensUpdated).toHaveBeenCalledWith(address)
  })

  it('skips new tokens with zero balance', () => {
    const tokenBalances = [
      { address: '0xTOKEN', chainId: 10, symbol: 'TKN', decimals: 18, balance: '0x0', displayBalance: '0' }
    ]
    balancesController.emit('tokenBalances', address, tokenBalances)

    expect(actions.setBalances).not.toHaveBeenCalled()
    expect(actions.accountTokensUpdated).toHaveBeenCalledWith(address)
  })

  it('updates existing token when balance changes', () => {
    store.set('main.balances', address, [
      { address: '0xTOKEN', chainId: 10, balance: '0x100' }
    ])

    const tokenBalances = [
      { address: '0xTOKEN', chainId: 10, symbol: 'TKN', decimals: 18, balance: '0x200', displayBalance: '0.000512' }
    ]
    balancesController.emit('tokenBalances', address, tokenBalances)

    expect(actions.setBalances).toHaveBeenCalledWith(address, tokenBalances)
  })

  it('does not update unchanged token balances', () => {
    store.set('main.balances', address, [
      { address: '0xTOKEN', chainId: 10, balance: '0x100' }
    ])

    const tokenBalances = [
      { address: '0xTOKEN', chainId: 10, symbol: 'TKN', decimals: 18, balance: '0x100', displayBalance: '0.000256' }
    ]
    balancesController.emit('tokenBalances', address, tokenBalances)

    expect(actions.setBalances).not.toHaveBeenCalled()
  })

  it('removes known tokens that drop to zero balance', () => {
    const token = { address: '0xTOKEN', chainId: 10, symbol: 'TKN', decimals: 18 }
    store.set('main.tokens.known', address, [token])
    store.set('main.balances', address, [{ ...token, balance: '0x100' }])

    balancesController.emit('tokenBalances', address, [
      { ...token, balance: '0x0', displayBalance: '0' }
    ])

    expect(actions.setBalances).toHaveBeenCalled()
    expect(actions.removeKnownTokens).toHaveBeenCalledWith(address, expect.any(Set))
  })

  it('ignores updates for removed accounts', () => {
    delete store.main.accounts[address]

    balancesController.emit('tokenBalances', address, [
      { address: '0xTOKEN', chainId: 10, balance: '0x100', displayBalance: '0.000256' }
    ])

    expect(actions.setBalances).not.toHaveBeenCalled()
  })
})

describe('handleTokenBlacklistUpdate', () => {
  it('removes blacklisted tokens from balances and known tokens', () => {
    const token = { address: '0xBAD', chainId: 10, symbol: 'BAD', decimals: 18 }
    store.set('main.balances', address, [{ ...token, balance: '0x100' }])
    store.set('main.tokens.known', address, [token])

    const blacklist = new Set(['10:0xbad'])
    balancesController.emit('tokenBlacklist', address, blacklist)

    expect(actions.removeBalances).toHaveBeenCalledWith(address, blacklist)
    expect(actions.removeKnownTokens).toHaveBeenCalledWith(address, blacklist)
  })

  it('does not remove non-blacklisted tokens', () => {
    const token = { address: '0xGOOD', chainId: 10, symbol: 'GOOD', decimals: 18 }
    store.set('main.balances', address, [{ ...token, balance: '0x100' }])

    const blacklist = new Set(['10:0xbad'])
    balancesController.emit('tokenBlacklist', address, blacklist)

    expect(actions.removeBalances).not.toHaveBeenCalled()
  })
})

describe('addNetworks', () => {
  it('triggers balance update for new chains', () => {
    balancesController.isRunning.mockReturnValue(true)
    balances.addNetworks(address, [42161])

    expect(balancesController.updateChainBalances).toHaveBeenCalledWith(address, [42161])
    expect(balancesController.scanForTokenBalances).toHaveBeenCalledWith(address, expect.any(Array), [42161])
  })
})

describe('addTokens', () => {
  it('triggers known token balance update', () => {
    balancesController.isRunning.mockReturnValue(true)
    const tokens = [{ address: '0xNEW', chainId: 10, symbol: 'NEW', decimals: 18 }]
    balances.addTokens(address, tokens)

    expect(balancesController.updateKnownTokenBalances).toHaveBeenCalledWith(address, tokens)
  })
})
