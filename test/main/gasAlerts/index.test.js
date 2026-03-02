/**
 * Unit tests for main/gasAlerts/index.ts
 *
 * The module is a side-effect module: importing it subscribes to valtio state
 * and fires Electron Notifications when gas prices drop below user thresholds.
 * We capture the subscribe callback and invoke it directly to test checkGasAlerts.
 */

// subscribeCallbacks must be declared BEFORE jest.mock factories run,
// but gasAlerts must be required AFTER (in beforeAll) so the array is initialized.
const subscribeCallbacks = []

jest.mock('valtio', () => ({
  subscribe: jest.fn((_state, cb) => {
    subscribeCallbacks.push(cb)
    return jest.fn()
  }),
  snapshot: jest.fn(s => JSON.parse(JSON.stringify(s))),
  proxy: jest.fn(obj => obj)
}))

const mockShow = jest.fn()
const MockNotification = jest.fn().mockImplementation(() => ({ show: mockShow }))

jest.mock('electron', () => ({
  Notification: MockNotification
}))

jest.mock('electron-log', () => ({ info: jest.fn(), error: jest.fn() }))

// Use the __mocks__/index.ts automatic mock for the store
jest.mock('../../../main/store')

import state from '../../../main/store'
import log from 'electron-log'

// Import the module once (triggers the subscribe side-effect).
// Done in beforeAll so subscribeCallbacks is already initialized.
beforeAll(() => {
  require('../../../main/gasAlerts')
})

beforeEach(() => {
  // Reset store state to defaults between tests
  state.__clear()
})

// Invoke all captured subscribe callbacks to run checkGasAlerts
function triggerCheck() {
  subscribeCallbacks.forEach(cb => cb())
}

// Convert gwei number to wei hex string (as used in networksMeta)
function gweiToWeiHex(gwei) {
  return '0x' + Math.floor(gwei * 1e9).toString(16)
}

// ─── Test cases ────────────────────────────────────────────────────────────────

it('creates and shows a notification when gas price is below threshold', () => {
  state.main.gasAlerts = { '1': { threshold: 10, enabled: true, unit: 'gwei' } }
  state.main.networksMeta.ethereum['1'] = { gas: { price: { levels: { fast: gweiToWeiHex(5) } } } }
  state.main.networks.ethereum['1'] = { name: 'Mainnet' }

  triggerCheck()

  expect(MockNotification).toHaveBeenCalledWith({
    title: 'Low Gas Price on Mainnet',
    body: expect.stringContaining('5.0 gwei')
  })
  expect(mockShow).toHaveBeenCalledTimes(1)
})

it('does not notify when gas price is above threshold', () => {
  state.main.gasAlerts = { '2': { threshold: 10, enabled: true, unit: 'gwei' } }
  state.main.networksMeta.ethereum['2'] = { gas: { price: { levels: { fast: gweiToWeiHex(15) } } } }
  state.main.networks.ethereum['2'] = { name: 'Chain 2' }

  triggerCheck()

  expect(MockNotification).not.toHaveBeenCalled()
  expect(mockShow).not.toHaveBeenCalled()
})

it('does not notify when alert is disabled even if price is below threshold', () => {
  state.main.gasAlerts = { '3': { threshold: 10, enabled: false, unit: 'gwei' } }
  state.main.networksMeta.ethereum['3'] = { gas: { price: { levels: { fast: gweiToWeiHex(5) } } } }
  state.main.networks.ethereum['3'] = { name: 'Chain 3' }

  triggerCheck()

  expect(MockNotification).not.toHaveBeenCalled()
})

it('suppresses a second notification within the 5-minute cooldown window', () => {
  state.main.gasAlerts = { '4': { threshold: 10, enabled: true, unit: 'gwei' } }
  state.main.networksMeta.ethereum['4'] = { gas: { price: { levels: { fast: gweiToWeiHex(5) } } } }
  state.main.networks.ethereum['4'] = { name: 'Chain 4' }

  triggerCheck()
  expect(MockNotification).toHaveBeenCalledTimes(1)

  MockNotification.mockClear()
  mockShow.mockClear()

  // Second trigger immediately — still within cooldown
  triggerCheck()
  expect(MockNotification).not.toHaveBeenCalled()
})

it('allows a notification after the 5-minute cooldown expires', () => {
  state.main.gasAlerts = { '5': { threshold: 10, enabled: true, unit: 'gwei' } }
  state.main.networksMeta.ethereum['5'] = { gas: { price: { levels: { fast: gweiToWeiHex(5) } } } }
  state.main.networks.ethereum['5'] = { name: 'Chain 5' }

  triggerCheck()
  expect(MockNotification).toHaveBeenCalledTimes(1)

  MockNotification.mockClear()
  mockShow.mockClear()

  // Advance time past the 5-minute cooldown
  jest.advanceTimersByTime(5 * 60 * 1000 + 1)

  triggerCheck()
  expect(MockNotification).toHaveBeenCalledTimes(1)
  expect(mockShow).toHaveBeenCalledTimes(1)
})

it('only notifies for the chain whose price is below threshold', () => {
  state.main.gasAlerts = {
    '10': { threshold: 10, enabled: true, unit: 'gwei' }, // below → notify
    '11': { threshold: 10, enabled: true, unit: 'gwei' }  // above → skip
  }
  state.main.networksMeta.ethereum['10'] = { gas: { price: { levels: { fast: gweiToWeiHex(5) } } } }
  state.main.networksMeta.ethereum['11'] = { gas: { price: { levels: { fast: gweiToWeiHex(15) } } } }
  state.main.networks.ethereum['10'] = { name: 'Chain 10' }
  state.main.networks.ethereum['11'] = { name: 'Chain 11' }

  triggerCheck()

  expect(MockNotification).toHaveBeenCalledTimes(1)
  expect(MockNotification).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Low Gas Price on Chain 10' })
  )
})

it('does not crash or notify when network metadata is missing', () => {
  state.main.gasAlerts = { '7': { threshold: 10, enabled: true, unit: 'gwei' } }
  // networksMeta.ethereum has no entry for chain '7'

  expect(() => triggerCheck()).not.toThrow()
  expect(MockNotification).not.toHaveBeenCalled()
})

it('handles testnet chains with no metadata without crashing', () => {
  // Testnet (e.g. Sepolia) that has no gas metadata
  state.main.gasAlerts = { '11155111': { threshold: 10, enabled: true, unit: 'gwei' } }
  // networksMeta.ethereum is empty

  expect(() => triggerCheck()).not.toThrow()
  expect(MockNotification).not.toHaveBeenCalled()
})

it('logs an error and does not crash when the Notification constructor throws', () => {
  state.main.gasAlerts = { '9': { threshold: 10, enabled: true, unit: 'gwei' } }
  state.main.networksMeta.ethereum['9'] = { gas: { price: { levels: { fast: gweiToWeiHex(5) } } } }
  state.main.networks.ethereum['9'] = { name: 'Chain 9' }

  MockNotification.mockImplementationOnce(() => {
    throw new Error('Notification unavailable')
  })

  expect(() => triggerCheck()).not.toThrow()
  expect(log.error).toHaveBeenCalledWith('Gas alert notification error', expect.any(Error))
})
