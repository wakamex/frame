/**
 * @jest-environment jsdom
 */

// Mock the link module (required by store's transitive deps)
jest.mock('../../../resources/link', () => ({
  rpc: jest.fn(),
  send: jest.fn(),
  on: jest.fn(),
  invoke: jest.fn()
}))

const { setSelectedAccount, setAccountSelectedCallback, state } = require('../../../app/store')

afterEach(() => {
  jest.clearAllMocks()
  state.selectedAccount = null
  setAccountSelectedCallback(null)
})

describe('setSelectedAccount', () => {
  it('sets selectedAccount on state', () => {
    setSelectedAccount('0xabc')
    expect(state.selectedAccount).toBe('0xabc')
  })

  it('clears selectedAccount when called with null', () => {
    state.selectedAccount = '0xabc'
    setSelectedAccount(null)
    expect(state.selectedAccount).toBeNull()
  })

  it('does not throw (no circular dependency or import crash)', () => {
    expect(() => setSelectedAccount('0xdef')).not.toThrow()
  })

  it('store module imports without errors', () => {
    expect(state).toBeDefined()
    expect(typeof setSelectedAccount).toBe('function')
  })

  it('calls the registered callback when id is provided', () => {
    const cb = jest.fn()
    setAccountSelectedCallback(cb)
    setSelectedAccount('0xabc')
    expect(cb).toHaveBeenCalledWith('0xabc')
  })

  it('does not call callback when id is null', () => {
    const cb = jest.fn()
    setAccountSelectedCallback(cb)
    setSelectedAccount(null)
    expect(cb).not.toHaveBeenCalled()
  })

  it('works without a callback registered', () => {
    expect(() => setSelectedAccount('0xabc')).not.toThrow()
  })
})
