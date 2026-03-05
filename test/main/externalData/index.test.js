import { subscribe } from 'valtio'
import externalData from '../../../main/externalData'
import store from '../../../main/store'

jest.mock('valtio', () => ({
  subscribe: jest.fn((_state, _cb) => jest.fn()),
  snapshot: jest.fn((s) => JSON.parse(JSON.stringify(s)))
}))
jest.mock('../../../main/store')
jest.mock('../../../main/externalData/assets', () => jest.fn(() => ({ start: jest.fn(), stop: jest.fn(), updateSubscription: jest.fn() })))
jest.mock('../../../main/externalData/balances', () => jest.fn(() => mockBalances))

let dataManager, mockBalances, trayCallback, networkCallback, addressCallback

beforeEach(() => {
  subscribe.mockClear()

  store.set('tray.open', true)

  mockBalances = { start: jest.fn(), stop: jest.fn(), pause: jest.fn(), resume: jest.fn(), addNetworks: jest.fn(), setAddress: jest.fn(), addTokens: jest.fn() }
  dataManager = externalData()

  // Subscription order: networks, activeAddress, customTokens, balances, tray
  networkCallback = subscribe.mock.calls[0][1]
  addressCallback = subscribe.mock.calls[1][1]
  trayCallback = subscribe.mock.calls[4][1]
})

afterEach(() => {
  dataManager.close()
})

describe('hiding and showing the tray', () => {
  it('pauses the balances scanner if the tray is hidden for 1 minute', () => {
    setTrayShown(false)

    expect(mockBalances.pause).toHaveBeenCalled()
  })

  it('does not pause the balances scanner if the tray was already hidden', () => {
    setTrayShown(false)
    setTrayShown(false)

    expect(mockBalances.pause).toHaveBeenCalledTimes(1)
  })

  it('does not attempt to resume the balances scanner the first time the tray is shown', () => {
    setTrayShown(true)

    expect(mockBalances.resume).not.toHaveBeenCalled()
  })

  it('resumes the balances scanner when the tray is shown after previously being hidden', () => {
    setTrayShown(false)
    setTrayShown(true)

    expect(mockBalances.resume).toHaveBeenCalled()
  })
})

describe('background balance scanning', () => {
  it('scans active account immediately and staggers others on network connect', () => {
    store.main.accounts = {
      '0xAccount1': { id: '0xAccount1', name: 'Account 1' },
      '0xAccount2': { id: '0xAccount2', name: 'Account 2' },
      '0xAccount3': { id: '0xAccount3', name: 'Account 3' }
    }
    store.selected = { current: '0xAccount1' }

    // Let the orchestrator know about the active account first
    addressCallback()
    jest.advanceTimersByTime(800) // address debounce

    mockBalances.addNetworks.mockClear()

    store.main.networks = {
      ethereum: {
        1: {
          id: 1,
          connection: {
            primary: { connected: true },
            secondary: { connected: false }
          }
        }
      }
    }

    networkCallback()
    jest.advanceTimersByTime(500) // debounce

    // Active account scans immediately
    expect(mockBalances.addNetworks).toHaveBeenCalledWith('0xAccount1', [1])
    // Background accounts not yet scanned
    expect(mockBalances.addNetworks).toHaveBeenCalledTimes(1)

    // After 5s, first background account scans
    jest.advanceTimersByTime(5_000)
    expect(mockBalances.addNetworks).toHaveBeenCalledTimes(2)

    // After another 5s, second background account scans
    jest.advanceTimersByTime(5_000)
    expect(mockBalances.addNetworks).toHaveBeenCalledTimes(3)
  })

  it('scans all accounts even when no account is selected', () => {
    store.main.accounts = {
      '0xAccount1': { id: '0xAccount1', name: 'Account 1' }
    }
    store.selected = { current: '' }

    store.main.networks = {
      ethereum: {
        1: {
          id: 1,
          connection: {
            primary: { connected: true },
            secondary: { connected: false }
          }
        }
      }
    }

    networkCallback()
    jest.advanceTimersByTime(500) // debounce

    // No active account, so it goes through the staggered path
    // First background account after 5s
    jest.advanceTimersByTime(5_000)
    expect(mockBalances.addNetworks).toHaveBeenCalledWith('0xAccount1', [1])
  })
})

function setTrayShown(shown) {
  store.tray = { open: shown }
  trayCallback()

  jest.advanceTimersByTime(1000 * 60)
}
