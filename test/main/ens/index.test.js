import { encodeFunctionResult } from 'viem'

// Must mock valtio before importing anything that uses it
jest.mock('valtio', () => ({
  subscribe: jest.fn((_state, cb) => jest.fn()),
  snapshot: jest.fn((s) => JSON.parse(JSON.stringify(s))),
  proxy: jest.fn((obj) => obj),
  unstable_enableOp: jest.fn()
}))

jest.mock('../../../main/provider', () => ({ send: jest.fn() }))
jest.mock('../../../main/store')
jest.mock('electron-log', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

import provider from '../../../main/provider'
import state from '../../../main/store'
import { resolveName, resolveAddress } from '../../../main/ens/index'

// Minimal ABIs for encoding results (must match what the source uses)
const registryAbi = [
  {
    name: 'resolver',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  }
]

const resolverAbi = [
  {
    name: 'addr',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  }
]

// Helper: ABI-encode a resolver address result
function encodeResolverAddress(address) {
  return encodeFunctionResult({ abi: registryAbi, functionName: 'resolver', result: address })
}

// Helper: ABI-encode an addr() result
function encodeAddr(address) {
  return encodeFunctionResult({ abi: resolverAbi, functionName: 'addr', result: address })
}

// Helper: ABI-encode a name() result
function encodeName(name) {
  return encodeFunctionResult({ abi: resolverAbi, functionName: 'name', result: name })
}

const RESOLVER_ADDRESS = '0xabcdef1234567890abcdef1234567890abcdef12'
const RESOLVED_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678'
const ENS_NAME = 'test.eth'

beforeEach(() => {
  // Set up default state: mainnet (chainId 1 has a registry address)
  state.main.currentNetwork = { id: 1 }
})

describe('resolveName', () => {
  it('returns the resolved address for a valid ENS name', async () => {
    // First call: getResolverAddress → returns resolver address
    provider.send.mockImplementationOnce((_payload, cb) =>
      cb({ result: encodeResolverAddress(RESOLVER_ADDRESS) })
    )
    // Second call: resolver.addr() → returns the target address
    provider.send.mockImplementationOnce((_payload, cb) =>
      cb({ result: encodeAddr(RESOLVED_ADDRESS) })
    )

    const result = await resolveName(ENS_NAME)

    expect(result.toLowerCase()).toBe(RESOLVED_ADDRESS.toLowerCase())
    expect(provider.send).toHaveBeenCalledTimes(2)
  })

  it('returns null when no resolver is set for the name (empty output from registry)', async () => {
    // getResolverAddress returns '0x' → no resolver registered
    provider.send.mockImplementationOnce((_payload, cb) => cb({ result: '0x' }))

    const result = await resolveName(ENS_NAME)

    expect(result).toBeNull()
    expect(provider.send).toHaveBeenCalledTimes(1)
  })

  it('returns null when resolver returns empty output (no address mapped)', async () => {
    provider.send.mockImplementationOnce((_payload, cb) =>
      cb({ result: encodeResolverAddress(RESOLVER_ADDRESS) })
    )
    // addr() returns '0x' → no address set
    provider.send.mockImplementationOnce((_payload, cb) => cb({ result: '0x' }))

    const result = await resolveName(ENS_NAME)

    expect(result).toBeNull()
  })

  it('rejects when provider returns an error (no result)', async () => {
    // First call: resolver lookup succeeds
    provider.send.mockImplementationOnce((_payload, cb) =>
      cb({ result: encodeResolverAddress(RESOLVER_ADDRESS) })
    )
    // Second call: RPC error — no result field
    provider.send.mockImplementationOnce((_payload, cb) =>
      cb({ error: { code: -32603, message: 'internal error' } })
    )

    await expect(resolveName(ENS_NAME)).rejects.toThrow()
  })
})

describe('resolveAddress', () => {
  it('returns the ENS name for a valid address', async () => {
    // getResolverAddress for the reverse record
    provider.send.mockImplementationOnce((_payload, cb) =>
      cb({ result: encodeResolverAddress(RESOLVER_ADDRESS) })
    )
    // name() call
    provider.send.mockImplementationOnce((_payload, cb) =>
      cb({ result: encodeName(ENS_NAME) })
    )

    const result = await resolveAddress(RESOLVED_ADDRESS)

    expect(result).toBe(ENS_NAME)
    expect(provider.send).toHaveBeenCalledTimes(2)
  })

  it('returns null when no reverse record exists (empty output from registry)', async () => {
    provider.send.mockImplementationOnce((_payload, cb) => cb({ result: '0x' }))

    const result = await resolveAddress(RESOLVED_ADDRESS)

    expect(result).toBeNull()
    expect(provider.send).toHaveBeenCalledTimes(1)
  })

  it('returns null when reverse resolver returns empty name', async () => {
    provider.send.mockImplementationOnce((_payload, cb) =>
      cb({ result: encodeResolverAddress(RESOLVER_ADDRESS) })
    )
    provider.send.mockImplementationOnce((_payload, cb) => cb({ result: '0x' }))

    const result = await resolveAddress(RESOLVED_ADDRESS)

    expect(result).toBeNull()
  })

  it('rejects when provider returns an error on the resolver name() call', async () => {
    provider.send.mockImplementationOnce((_payload, cb) =>
      cb({ result: encodeResolverAddress(RESOLVER_ADDRESS) })
    )
    provider.send.mockImplementationOnce((_payload, cb) =>
      cb({ error: { code: -32603, message: 'internal error' } })
    )

    await expect(resolveAddress(RESOLVED_ADDRESS)).rejects.toThrow()
  })
})

describe('network-specific behavior', () => {
  it('uses the correct registry address for mainnet (chainId 1)', async () => {
    state.main.currentNetwork = { id: 1 }

    provider.send.mockImplementationOnce((payload, cb) => {
      // Mainnet registry address
      expect(payload.params[0].to).toBe('0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e')
      cb({ result: '0x' })
    })

    await resolveName(ENS_NAME)
  })

  it('returns null when there is no registry for an unknown chainId', async () => {
    // chainId 5 is not in registryAddresses, so registryAddress will be undefined
    state.main.currentNetwork = { id: 5 }

    provider.send.mockImplementationOnce((payload, cb) => {
      // to will be undefined since there's no registry for chainId 5
      expect(payload.params[0].to).toBeUndefined()
      cb({ result: '0x' })
    })

    const result = await resolveName(ENS_NAME)

    expect(result).toBeNull()
  })
})
