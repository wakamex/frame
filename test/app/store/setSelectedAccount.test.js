/**
 * @jest-environment jsdom
 */

// Mock the link module before any imports
jest.mock('../../../resources/link', () => ({
  rpc: jest.fn(),
  send: jest.fn(),
  on: jest.fn(),
  invoke: jest.fn()
}))

const link = require('../../../resources/link')
const { setSelectedAccount, state } = require('../../../app/store')

afterEach(() => {
  jest.clearAllMocks()
  state.selectedAccount = null
})

describe('setSelectedAccount', () => {
  it('sets selectedAccount on state', () => {
    setSelectedAccount('0xabc')
    expect(state.selectedAccount).toBe('0xabc')
  })

  it('calls link.rpc setSigner when id is provided', () => {
    setSelectedAccount('0xabc')
    expect(link.rpc).toHaveBeenCalledWith('setSigner', '0xabc', expect.any(Function))
  })

  it('does not call link.rpc when id is null', () => {
    setSelectedAccount(null)
    expect(link.rpc).not.toHaveBeenCalled()
  })

  it('clears selectedAccount when called with null', () => {
    state.selectedAccount = '0xabc'
    setSelectedAccount(null)
    expect(state.selectedAccount).toBeNull()
  })

  it('does not throw (no circular dependency crash)', () => {
    expect(() => setSelectedAccount('0xdef')).not.toThrow()
  })
})
