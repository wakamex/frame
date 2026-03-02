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
function createState({ knownTokens = [], customTokens = [] } = {}) {
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
      }
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
