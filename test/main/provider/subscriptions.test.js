import { v5 as uuid } from 'uuid'

jest.mock('valtio', () => ({
  subscribe: jest.fn((_state, cb) => jest.fn()),
  snapshot: jest.fn((s) => JSON.parse(JSON.stringify(s))),
  proxy: jest.fn((obj) => obj)
}))

jest.mock('../../../main/store')

import { hasSubscriptionPermission, SubscriptionType } from '../../../main/provider/subscriptions'
import state from '../../../main/store'

// Precomputed UUIDv5 values for trusted origins (uuid.DNS namespace)
const FRAME_EXTENSION_ID = uuid('frame-extension', uuid.DNS)
const FRAME_INTERNAL_ID = uuid('frame-internal', uuid.DNS)

const testAddress = '0xabcdef1234567890abcdef1234567890abcdef12'
const untrustedOrigin = 'some-dapp.example.com'
const untrustedOriginId = uuid(untrustedOrigin, uuid.DNS)

beforeEach(() => {
  state.__clear()
})

describe('SubscriptionType enum', () => {
  it('has the correct values', () => {
    expect(SubscriptionType.ACCOUNTS).toBe('accountsChanged')
    expect(SubscriptionType.ASSETS).toBe('assetsChanged')
    expect(SubscriptionType.CHAIN).toBe('chainChanged')
    expect(SubscriptionType.CHAINS).toBe('chainsChanged')
    expect(SubscriptionType.NETWORK).toBe('networkChanged')
  })
})

describe('hasSubscriptionPermission', () => {
  describe('trusted origin (frame-internal)', () => {
    it('returns true for CHAINS subscription without address', () => {
      const result = hasSubscriptionPermission(SubscriptionType.CHAINS, '', FRAME_INTERNAL_ID)
      expect(result).toBe(true)
    })

    it('returns true for CHAINS subscription with address', () => {
      const result = hasSubscriptionPermission(SubscriptionType.CHAINS, testAddress, FRAME_INTERNAL_ID)
      expect(result).toBe(true)
    })

    it('returns false for ACCOUNTS subscription with no address', () => {
      const result = hasSubscriptionPermission(SubscriptionType.ACCOUNTS, '', FRAME_INTERNAL_ID)
      expect(result).toBe(false)
    })

    it('returns true for ACCOUNTS subscription with valid address and permission', () => {
      state.main.permissions[testAddress] = {
        'perm-1': { origin: 'frame-internal', provider: true }
      }
      const result = hasSubscriptionPermission(SubscriptionType.ACCOUNTS, testAddress, FRAME_INTERNAL_ID)
      expect(result).toBe(true)
    })

    it('returns false for ACCOUNTS subscription with valid address but provider=false', () => {
      state.main.permissions[testAddress] = {
        'perm-1': { origin: 'frame-internal', provider: false }
      }
      const result = hasSubscriptionPermission(SubscriptionType.ACCOUNTS, testAddress, FRAME_INTERNAL_ID)
      expect(result).toBe(false)
    })
  })

  describe('trusted origin (frame-extension)', () => {
    it('returns true for CHAINS subscription without address', () => {
      const result = hasSubscriptionPermission(SubscriptionType.CHAINS, '', FRAME_EXTENSION_ID)
      expect(result).toBe(true)
    })

    it('returns false for non-CHAINS subscription with no address', () => {
      const result = hasSubscriptionPermission(SubscriptionType.NETWORK, '', FRAME_EXTENSION_ID)
      expect(result).toBe(false)
    })
  })

  describe('non-trusted origin', () => {
    it('returns false for CHAINS subscription with no address', () => {
      const result = hasSubscriptionPermission(SubscriptionType.CHAINS, '', untrustedOriginId)
      expect(result).toBe(false)
    })

    it('returns true for valid address with matching permission with provider=true', () => {
      state.main.permissions[testAddress] = {
        'perm-1': { origin: untrustedOrigin, provider: true }
      }
      const result = hasSubscriptionPermission(SubscriptionType.ACCOUNTS, testAddress, untrustedOriginId)
      expect(result).toBe(true)
    })

    it('returns false for valid address with matching permission with provider=false', () => {
      state.main.permissions[testAddress] = {
        'perm-1': { origin: untrustedOrigin, provider: false }
      }
      const result = hasSubscriptionPermission(SubscriptionType.ACCOUNTS, testAddress, untrustedOriginId)
      expect(result).toBe(false)
    })

    it('returns false for valid address with no matching permission', () => {
      state.main.permissions[testAddress] = {
        'perm-1': { origin: 'different-origin.com', provider: true }
      }
      const result = hasSubscriptionPermission(SubscriptionType.ACCOUNTS, testAddress, untrustedOriginId)
      expect(result).toBe(false)
    })

    it('returns false when no address is provided', () => {
      const result = hasSubscriptionPermission(SubscriptionType.ACCOUNTS, '', untrustedOriginId)
      expect(result).toBe(false)
    })

    it('returns false when address has no permissions entry', () => {
      const result = hasSubscriptionPermission(SubscriptionType.ACCOUNTS, testAddress, untrustedOriginId)
      expect(result).toBe(false)
    })

    it('grants access only to the matching origin when multiple permissions exist', () => {
      const otherOrigin = 'other-dapp.example.com'
      const otherOriginId = uuid(otherOrigin, uuid.DNS)

      state.main.permissions[testAddress] = {
        'perm-1': { origin: otherOrigin, provider: true },
        'perm-2': { origin: untrustedOrigin, provider: true }
      }

      // Only the matching origin gets access
      expect(hasSubscriptionPermission(SubscriptionType.ACCOUNTS, testAddress, untrustedOriginId)).toBe(true)
      expect(hasSubscriptionPermission(SubscriptionType.ACCOUNTS, testAddress, otherOriginId)).toBe(true)

      // An origin not in permissions gets rejected
      const unknownOriginId = uuid('unknown.com', uuid.DNS)
      expect(hasSubscriptionPermission(SubscriptionType.ACCOUNTS, testAddress, unknownOriginId)).toBe(false)
    })

    it('denies access when permission exists for address but provider is false for this origin', () => {
      const otherOrigin = 'other-dapp.example.com'
      state.main.permissions[testAddress] = {
        'perm-1': { origin: otherOrigin, provider: true },
        'perm-2': { origin: untrustedOrigin, provider: false }
      }

      expect(hasSubscriptionPermission(SubscriptionType.ACCOUNTS, testAddress, untrustedOriginId)).toBe(false)
    })
  })

  describe('UUID-based origin matching security boundary', () => {
    it('frame-internal gets trusted status', () => {
      expect(hasSubscriptionPermission(SubscriptionType.CHAINS, '', FRAME_INTERNAL_ID)).toBe(true)
    })

    it('frame-extension gets trusted status', () => {
      expect(hasSubscriptionPermission(SubscriptionType.CHAINS, '', FRAME_EXTENSION_ID)).toBe(true)
    })

    it('arbitrary origin does not get trusted status for CHAINS without address', () => {
      const arbitraryId = uuid('frame-internal-fake', uuid.DNS)
      expect(hasSubscriptionPermission(SubscriptionType.CHAINS, '', arbitraryId)).toBe(false)
    })

    it('raw string "frame-internal" (not UUIDv5) does not get trusted status', () => {
      expect(hasSubscriptionPermission(SubscriptionType.CHAINS, '', 'frame-internal')).toBe(false)
    })

    it('permission lookup matches by computing UUID from stored origin string', () => {
      const originString = 'my-dapp.io'
      const computedOriginId = uuid(originString, uuid.DNS)

      state.main.permissions[testAddress] = {
        'perm-1': { origin: originString, provider: true }
      }

      // Passing the computed UUID should match
      expect(hasSubscriptionPermission(SubscriptionType.ACCOUNTS, testAddress, computedOriginId)).toBe(true)

      // Passing the raw string instead of UUID should NOT match
      expect(hasSubscriptionPermission(SubscriptionType.ACCOUNTS, testAddress, originString)).toBe(false)
    })
  })
})
