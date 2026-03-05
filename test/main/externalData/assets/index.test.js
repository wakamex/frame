import rates from '../../../../main/externalData/assets'
import { setNativeCurrencyData, setRates } from '../../../../main/store/actions'
import { NATIVE_CURRENCY } from '../../../../resources/constants'

jest.mock('electron-log', () => ({
  verbose: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}))

jest.mock('../../../../main/store/actions', () => ({
  setNativeCurrencyData: jest.fn(),
  setRates: jest.fn()
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

// Helpers to create mock state
function createState({ knownTokens = [], customTokens = [], balances = {} } = {}) {
  return {
    main: {
      tokens: {
        known: knownTokens.reduce((acc, token) => {
          const addr = token.ownerAddress || '0xowner'
          if (!acc[addr]) acc[addr] = []
          acc[addr].push(token)
          return acc
        }, {}),
        custom: customTokens
      },
      balances
    }
  }
}

// Build a successful fetch response
function mockResponse(data) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data)
  })
}

function mockErrorResponse(status = 500) {
  return Promise.resolve({
    ok: false,
    status
  })
}

beforeEach(() => {
  mockFetch.mockReset()
  setNativeCurrencyData.mockReset()
  setRates.mockReset()
})

// ---- buildCoinId tests ----
// buildCoinId is internal, but we can test its behavior through fetchRates

describe('buildCoinId behavior (via fetchRates)', () => {
  it('maps chainId 1 to ethereum:NATIVE_CURRENCY', async () => {
    const state = createState()
    const service = rates(state)
    service.updateSubscription([1])

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ coins: { [`ethereum:${NATIVE_CURRENCY}`]: { price: 3000 } } }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ coins: {} }) })

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining(`ethereum:${NATIVE_CURRENCY}`))
  })

  it('skips fetch when chainId is unknown', async () => {
    const state = createState()
    const service = rates(state)
    service.updateSubscription([9999])

    await Promise.resolve()

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('includes token address in coinId when token is provided', async () => {
    const tokenAddress = '0xabcdef1234567890abcdef1234567890abcdef12'
    const state = createState({
      customTokens: [{ chainId: 1, address: tokenAddress }]
    })
    const service = rates(state)
    service.updateSubscription([1])

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ coins: {} }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ coins: {} }) })

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining(`ethereum:${tokenAddress}`))
  })
})

// ---- start / stop tests ----

describe('start()', () => {
  it('begins 30s polling interval', () => {
    const state = createState()
    const service = rates(state)

    mockFetch
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ coins: {} }) })

    service.updateSubscription([1]) // needed so allCoinIds.length > 0
    service.start()

    const callsBefore = mockFetch.mock.calls.length
    jest.advanceTimersByTime(30_000)
    // After 30s, the interval should fire fetchRates again
    // fetchRates calls fetch twice (prices + change)
    expect(mockFetch.mock.calls.length).toBeGreaterThan(callsBefore)

    service.stop()
  })

  it('uses all configured chains on first poll when updateSubscription has not been called', async () => {
    const state = {
      main: {
        tokens: { known: {}, custom: [] },
        balances: {},
        networks: {
          ethereum: {
            1: { id: 1 },
            10: { id: 10 }
          }
        }
      }
    }
    const service = rates(state)

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          coins: {
            [`ethereum:${NATIVE_CURRENCY}`]: { price: 3000 },
            [`optimism:${NATIVE_CURRENCY}`]: { price: 3001 }
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ coins: {} })
      })

    service.start()

    // No eager fetch on start — wait for the 30s poll
    expect(mockFetch).not.toHaveBeenCalled()

    jest.advanceTimersByTime(30_000)

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    // Poll should use all configured chains as fallback
    expect(mockFetch).toHaveBeenCalled()
    const url = mockFetch.mock.calls[0]?.[0] || ''
    expect(url).toContain(`ethereum:${NATIVE_CURRENCY}`)
    expect(url).toContain(`optimism:${NATIVE_CURRENCY}`)

    service.stop()
  })
})

describe('stop()', () => {
  it('clears the polling interval', () => {
    const state = createState()
    const service = rates(state)

    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ coins: {} }) })

    service.updateSubscription([1])
    service.start()

    service.stop()

    const callsAfterStop = mockFetch.mock.calls.length
    jest.advanceTimersByTime(30_000)

    // No additional calls after stop
    expect(mockFetch.mock.calls.length).toBe(callsAfterStop)
  })
})

// ---- updateSubscription tests ----

describe('updateSubscription()', () => {
  it('triggers an immediate fetchRates when called', async () => {
    const state = createState()
    const service = rates(state)

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ coins: {} }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ coins: {} }) })

    service.updateSubscription([1])

    // fetch is called synchronously (promise-wise) after updateSubscription
    await Promise.resolve()
    await Promise.resolve()

    expect(mockFetch).toHaveBeenCalled()
  })
})

// ---- fetchRates happy path ----

describe('fetchRates happy path', () => {
  it('fetches prices and change data and calls setNativeCurrencyData', async () => {
    const state = createState()
    const service = rates(state)

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ coins: { [`ethereum:${NATIVE_CURRENCY}`]: { price: 2500 } } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ coins: { [`ethereum:${NATIVE_CURRENCY}`]: 1.5 } })
      })

    service.updateSubscription([1])

    // Flush promises
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(setNativeCurrencyData).toHaveBeenCalledWith(
      'ethereum',
      1,
      expect.objectContaining({ usd: expect.objectContaining({ price: 2500 }) })
    )
  })

  it('fetches token rates and calls setRates', async () => {
    const tokenAddress = '0xtoken000000000000000000000000000000000001'
    const state = createState({
      customTokens: [{ chainId: 1, address: tokenAddress }]
    })
    const service = rates(state)

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ coins: { [`ethereum:${tokenAddress}`]: { price: 1.0 } } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ coins: { [`ethereum:${tokenAddress}`]: 0.5 } })
      })

    service.updateSubscription([1])

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(setRates).toHaveBeenCalledWith(
      expect.objectContaining({
        [tokenAddress]: expect.objectContaining({
          usd: expect.objectContaining({ price: 1.0 })
        })
      })
    )
  })
})

// ---- fetchRates edge cases ----

describe('fetchRates with no valid coinIds', () => {
  it('skips fetch when all chains are unknown', async () => {
    const state = createState()
    const service = rates(state)

    service.updateSubscription([99999, 12345])

    await Promise.resolve()

    expect(mockFetch).not.toHaveBeenCalled()
    expect(setNativeCurrencyData).not.toHaveBeenCalled()
  })
})

describe('fetchRates API error handling', () => {
  it('logs warning and does not throw on fetch network error', async () => {
    const log = require('electron-log')
    const state = createState()
    const service = rates(state)

    mockFetch.mockRejectedValue(new Error('network failure'))

    service.updateSubscription([1])

    // Should not throw
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(log.warn).toHaveBeenCalled()
    expect(setNativeCurrencyData).not.toHaveBeenCalled()
  })

  it('logs warning when response is not ok', async () => {
    const log = require('electron-log')
    const state = createState()
    const service = rates(state)

    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ coins: {} }) })

    service.updateSubscription([1])

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(log.warn).toHaveBeenCalledWith(
      'DefiLlama rate fetch failed',
      expect.objectContaining({ prices: 503 })
    )
    expect(setNativeCurrencyData).not.toHaveBeenCalled()
  })
})

// ---- Token deduplication ----

describe('token deduplication', () => {
  it('excludes custom token with same address+chainId as known token', async () => {
    const tokenAddress = '0xduplicate0000000000000000000000000000001'
    const ownerAddress = '0xowner'

    const knownToken = { chainId: 1, address: tokenAddress, ownerAddress }
    const customToken = { chainId: 1, address: tokenAddress }

    // Known tokens are keyed by owner address
    const state = {
      main: {
        tokens: {
          known: { [ownerAddress]: [knownToken] },
          custom: [customToken]
        }
      }
    }

    const service = rates(state)

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ coins: {} }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ coins: {} }) })

    service.updateSubscription([1], ownerAddress)

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    // There should only be ONE entry for that token address in the request
    const url = mockFetch.mock.calls[0]?.[0] || ''
    const coinOccurrences = (url.match(new RegExp(`ethereum:${tokenAddress}`, 'g')) || []).length
    expect(coinOccurrences).toBe(1)
  })
})

// ---- fetchRates with custom tokens ----

describe('fetchRates with custom tokens', () => {
  it('includes custom tokens not in knownTokens', async () => {
    const customAddress = '0xcustom00000000000000000000000000000000001'
    const state = createState({
      customTokens: [{ chainId: 1, address: customAddress }]
    })
    const service = rates(state)

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ coins: {} }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ coins: {} }) })

    service.updateSubscription([1])

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining(`ethereum:${customAddress}`))
  })
})

// ---- Balance-derived token rates ----

describe('balance-derived token rates', () => {
  it('fetches rates for tokens found in balances but not in known/custom lists', async () => {
    const eulAddress = '0xd9fcd98c322942075a5c3860693e9f4f03aae07b'
    const state = createState({
      balances: {
        '0xowner': [
          { address: eulAddress, chainId: 1, symbol: 'EUL', name: 'Euler', displayBalance: '100' },
          { address: NATIVE_CURRENCY, chainId: 1, symbol: 'ETH', name: 'Ether', displayBalance: '1' }
        ]
      }
    })
    const service = rates(state)

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ coins: { [`ethereum:${eulAddress}`]: { price: 5.0 } } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ coins: { [`ethereum:${eulAddress}`]: 2.0 } })
      })

    service.updateSubscription([1])

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining(`ethereum:${eulAddress}`))
    expect(setRates).toHaveBeenCalledWith(
      expect.objectContaining({
        [eulAddress]: expect.objectContaining({
          usd: expect.objectContaining({ price: 5.0 })
        })
      })
    )
  })

  it('does not duplicate balance tokens already in known tokens', async () => {
    const tokenAddress = '0xtoken000000000000000000000000000000000001'
    const ownerAddress = '0xowner'
    const state = createState({
      knownTokens: [{ chainId: 1, address: tokenAddress, ownerAddress }],
      balances: {
        [ownerAddress]: [
          { address: tokenAddress, chainId: 1, symbol: 'TKN', name: 'Token', displayBalance: '50' }
        ]
      }
    })
    const service = rates(state)

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ coins: {} }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ coins: {} }) })

    service.updateSubscription([1], ownerAddress)

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    const url = mockFetch.mock.calls[0]?.[0] || ''
    const occurrences = (url.match(new RegExp(`ethereum:${tokenAddress}`, 'g')) || []).length
    expect(occurrences).toBe(1)
  })

  it('skips native currency balances (only fetches ERC-20s)', async () => {
    const state = createState({
      balances: {
        '0xowner': [
          { address: NATIVE_CURRENCY, chainId: 1, symbol: 'ETH', name: 'Ether', displayBalance: '10' }
        ]
      }
    })
    const service = rates(state)

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ coins: {} }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ coins: {} }) })

    service.updateSubscription([1])

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    // Only the native coin ID should be in the URL, not a duplicate
    const url = mockFetch.mock.calls[0]?.[0] || ''
    const nativeOccurrences = (url.match(new RegExp(`ethereum:${NATIVE_CURRENCY}`, 'g')) || []).length
    expect(nativeOccurrences).toBe(1)
  })
})

// ---- Multiple chains ----

describe('multiple chains', () => {
  it('fetches rates for multiple chains and updates each native currency', async () => {
    const state = createState()
    const service = rates(state)

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            coins: {
              [`ethereum:${NATIVE_CURRENCY}`]: { price: 3000 },
              [`optimism:${NATIVE_CURRENCY}`]: { price: 3001 }
            }
          })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            coins: {
              [`ethereum:${NATIVE_CURRENCY}`]: 1.0,
              [`optimism:${NATIVE_CURRENCY}`]: 1.1
            }
          })
      })

    service.updateSubscription([1, 10])

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(setNativeCurrencyData).toHaveBeenCalledWith('ethereum', 1, expect.objectContaining({ usd: expect.objectContaining({ price: 3000 }) }))
    expect(setNativeCurrencyData).toHaveBeenCalledWith('ethereum', 10, expect.objectContaining({ usd: expect.objectContaining({ price: 3001 }) }))
  })

  it('handles partial API response (some coins missing) without errors', async () => {
    const state = createState()
    const service = rates(state)

    // Only ethereum price returned, optimism missing
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            coins: {
              [`ethereum:${NATIVE_CURRENCY}`]: { price: 3000 }
            }
          })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ coins: {} })
      })

    service.updateSubscription([1, 10])

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    // Only ethereum should be updated
    expect(setNativeCurrencyData).toHaveBeenCalledTimes(1)
    expect(setNativeCurrencyData).toHaveBeenCalledWith('ethereum', 1, expect.anything())
  })
})

// ---- Exhaustive price availability ----

describe('exhaustive price availability', () => {
  it('fetches rates for balance tokens across multiple accounts', async () => {
    const eulAddress = '0xd9fcd98c322942075a5c3860693e9f4f03aae07b'
    const usdcAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'

    const state = createState({
      balances: {
        '0xaccount1': [
          { address: eulAddress, chainId: 1, symbol: 'EUL', name: 'Euler', displayBalance: '100' },
          { address: NATIVE_CURRENCY, chainId: 1, symbol: 'ETH', name: 'Ether', displayBalance: '1' }
        ],
        '0xaccount2': [
          { address: usdcAddress, chainId: 1, symbol: 'USDC', name: 'USD Coin', displayBalance: '5000' },
          { address: eulAddress, chainId: 1, symbol: 'EUL', name: 'Euler', displayBalance: '50' }
        ]
      }
    })
    const service = rates(state)

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          coins: {
            [`ethereum:${NATIVE_CURRENCY}`]: { price: 3000 },
            [`ethereum:${eulAddress}`]: { price: 5.0 },
            [`ethereum:${usdcAddress}`]: { price: 1.0 }
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          coins: {
            [`ethereum:${NATIVE_CURRENCY}`]: 1.0,
            [`ethereum:${eulAddress}`]: 2.0,
            [`ethereum:${usdcAddress}`]: 0.01
          }
        })
      })

    service.updateSubscription([1])

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    // Both ERC-20 tokens should have rates set
    expect(setRates).toHaveBeenCalledWith(
      expect.objectContaining({
        [eulAddress]: expect.objectContaining({ usd: expect.objectContaining({ price: 5.0, change24hr: 2.0 }) }),
        [usdcAddress]: expect.objectContaining({ usd: expect.objectContaining({ price: 1.0, change24hr: 0.01 }) })
      })
    )

    // Native currency should be updated
    expect(setNativeCurrencyData).toHaveBeenCalledWith('ethereum', 1, expect.objectContaining({ usd: expect.objectContaining({ price: 3000 }) }))
  })

  it('deduplicates balance tokens appearing in multiple accounts', async () => {
    const eulAddress = '0xd9fcd98c322942075a5c3860693e9f4f03aae07b'

    const state = createState({
      balances: {
        '0xaccount1': [
          { address: eulAddress, chainId: 1, symbol: 'EUL', name: 'Euler', displayBalance: '100' }
        ],
        '0xaccount2': [
          { address: eulAddress, chainId: 1, symbol: 'EUL', name: 'Euler', displayBalance: '50' }
        ]
      }
    })
    const service = rates(state)

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ coins: {} }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ coins: {} }) })

    service.updateSubscription([1])

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    // EUL should only appear once in the URL
    const url = mockFetch.mock.calls[0]?.[0] || ''
    const occurrences = (url.match(new RegExp(`ethereum:${eulAddress}`, 'g')) || []).length
    expect(occurrences).toBe(1)
  })

  it('fetches rates for balance tokens on multiple chains', async () => {
    const usdcMainnet = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    const usdcOptimism = '0x7f5c764cbc14f9669b88837ca1490cca17c31607'

    const state = createState({
      balances: {
        '0xaccount1': [
          { address: usdcMainnet, chainId: 1, symbol: 'USDC', name: 'USD Coin', displayBalance: '1000' },
          { address: usdcOptimism, chainId: 10, symbol: 'USDC', name: 'USD Coin', displayBalance: '500' }
        ]
      }
    })
    const service = rates(state)

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          coins: {
            [`ethereum:${usdcMainnet}`]: { price: 1.0 },
            [`optimism:${usdcOptimism}`]: { price: 1.0 }
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ coins: {} })
      })

    service.updateSubscription([1, 10])

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(setRates).toHaveBeenCalledWith(
      expect.objectContaining({
        [usdcMainnet]: expect.objectContaining({ usd: expect.objectContaining({ price: 1.0 }) }),
        [usdcOptimism]: expect.objectContaining({ usd: expect.objectContaining({ price: 1.0 }) })
      })
    )
  })

  it('filters balance tokens to only subscribed chains', async () => {
    const eulAddress = '0xd9fcd98c322942075a5c3860693e9f4f03aae07b'
    const polygonToken = '0xpolygontoken0000000000000000000000000001'

    const state = createState({
      balances: {
        '0xaccount1': [
          { address: eulAddress, chainId: 1, symbol: 'EUL', name: 'Euler', displayBalance: '100' },
          { address: polygonToken, chainId: 137, symbol: 'POLY', name: 'Polygon Token', displayBalance: '500' }
        ]
      }
    })
    const service = rates(state)

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ coins: {} }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ coins: {} }) })

    // Only subscribe to chain 1, not 137
    service.updateSubscription([1])

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    const url = mockFetch.mock.calls[0]?.[0] || ''
    expect(url).toContain(`ethereum:${eulAddress}`)
    expect(url).not.toContain(`polygon:${polygonToken}`)
  })

  it('includes balance tokens with known + custom + balance sources combined', async () => {
    const knownToken = '0xknown00000000000000000000000000000000001'
    const customToken = '0xcustom0000000000000000000000000000000001'
    const balanceOnlyToken = '0xbalance000000000000000000000000000000001'
    const ownerAddress = '0xowner'

    const state = createState({
      knownTokens: [{ chainId: 1, address: knownToken, ownerAddress }],
      customTokens: [{ chainId: 1, address: customToken }],
      balances: {
        '0xaccount1': [
          { address: balanceOnlyToken, chainId: 1, symbol: 'BAL', name: 'Balance Token', displayBalance: '100' }
        ]
      }
    })
    const service = rates(state)

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ coins: {} }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ coins: {} }) })

    service.updateSubscription([1], ownerAddress)

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    const url = mockFetch.mock.calls[0]?.[0] || ''
    // All three token sources should be in the URL
    expect(url).toContain(`ethereum:${knownToken}`)
    expect(url).toContain(`ethereum:${customToken}`)
    expect(url).toContain(`ethereum:${balanceOnlyToken}`)
  })

  it('polling picks up balance tokens added after initial subscription', async () => {
    const state = createState({ balances: {} })
    const service = rates(state)

    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ coins: {} }) })

    service.updateSubscription([1])
    service.start()

    await Promise.resolve()
    await Promise.resolve()

    mockFetch.mockClear()

    // Simulate balance scanner discovering a new token
    const eulAddress = '0xd9fcd98c322942075a5c3860693e9f4f03aae07b'
    state.main.balances = {
      '0xaccount1': [
        { address: eulAddress, chainId: 1, symbol: 'EUL', name: 'Euler', displayBalance: '100' }
      ]
    }

    // Advance to next poll
    jest.advanceTimersByTime(30_000)

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    const url = mockFetch.mock.calls[0]?.[0] || ''
    expect(url).toContain(`ethereum:${eulAddress}`)

    service.stop()
  })
})
