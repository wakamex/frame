import log from 'electron-log'

jest.mock('valtio', () => ({
  subscribe: jest.fn((_state, cb) => jest.fn()),
  snapshot: jest.fn((s) => JSON.parse(JSON.stringify(s))),
  proxy: jest.fn((obj) => obj)
}))

jest.mock('../../../main/ens', () => ({
  resolveAddress: jest.fn()
}))

jest.mock('../../../main/contracts', () => ({
  decodeCallData: jest.fn(),
  fetchContract: jest.fn()
}))

jest.mock('../../../main/contracts/erc20', () => {
  const MockErc20Contract = jest.fn().mockImplementation(() => ({
    getTokenData: jest.fn().mockResolvedValue({ decimals: 18, name: 'Test Token', symbol: 'TTK' })
  }))
  MockErc20Contract.decodeCallData = jest.fn()
  MockErc20Contract.isApproval = jest.fn()
  MockErc20Contract.isTransfer = jest.fn()
  MockErc20Contract.encodeCallData = jest.fn()
  return { __esModule: true, default: MockErc20Contract }
})

jest.mock('../../../main/contracts/deployments/ens', () => ({ __esModule: true, default: [] }))

jest.mock('../../../main/provider/proxy', () => {
  const { EventEmitter } = require('stream')
  const emitter = new EventEmitter()
  emitter.send = jest.fn()
  return { default: emitter }
})

jest.mock('electron-log', () => ({
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    verbose: jest.fn(),
    info: jest.fn()
  },
  error: jest.fn(),
  warn: jest.fn(),
  verbose: jest.fn(),
  info: jest.fn()
}))

// Mock EthereumProvider before importing surface
jest.mock('ethereum-provider', () => {
  return jest.fn().mockImplementation(() => ({
    setChain: jest.fn(),
    request: jest.fn()
  }))
})

import { resolveAddress } from '../../../main/ens'
import { decodeCallData, fetchContract } from '../../../main/contracts'
import Erc20Contract from '../../../main/contracts/erc20'
import surface from '../../../main/reveal'

// Get the mock provider instance
let mockProvider
beforeAll(() => {
  log.transports = { console: { level: false } }
  // Grab the provider instance created by the module
  const EthereumProvider = require('ethereum-provider')
  mockProvider = EthereumProvider.mock.results[0].value
})

afterAll(() => {
  if (log.transports) log.transports.console.level = 'debug'
})

beforeEach(() => {
  jest.clearAllMocks()
  if (mockProvider) {
    mockProvider.request = jest.fn()
  }
})

describe('surface.resolveEntityType', () => {
  it('returns "contract" when code exists at address', async () => {
    mockProvider.request.mockResolvedValue('0x6001')

    const result = await surface.resolveEntityType('0xabc123', 1)
    expect(result).toBe('contract')
  })

  it('returns "external" for an EOA (no code)', async () => {
    mockProvider.request.mockResolvedValue('0x')

    const result = await surface.resolveEntityType('0xabc123', 1)
    expect(result).toBe('external')
  })

  it('returns "unknown" when address is missing', async () => {
    const result = await surface.resolveEntityType('', 1)
    expect(result).toBe('unknown')
  })

  it('returns "unknown" when chainId is missing', async () => {
    const result = await surface.resolveEntityType('0xabc123', 0)
    expect(result).toBe('unknown')
  })
})

describe('surface.identity', () => {
  it('resolves contract entity type with ENS name', async () => {
    mockProvider.request.mockResolvedValue('0x6001')
    resolveAddress.mockResolvedValue('vitalik.eth')

    const result = await surface.identity('0xd8da6bf26964af9d7eed9e03e53415d37aa96045', 1)

    expect(result).toEqual({ type: 'contract', ens: 'vitalik.eth' })
  })

  it('resolves external (EOA) entity type with no ENS', async () => {
    mockProvider.request.mockResolvedValue('0x')
    resolveAddress.mockResolvedValue(null)

    const result = await surface.identity('0xd8da6bf26964af9d7eed9e03e53415d37aa96045', 1)

    expect(result).toEqual({ type: 'external', ens: '' })
  })

  it('falls back gracefully when ENS resolution throws', async () => {
    mockProvider.request.mockResolvedValue('0x6001')
    resolveAddress.mockRejectedValue(new Error('ENS error'))

    const result = await surface.identity('0xd8da6bf26964af9d7eed9e03e53415d37aa96045', 1)

    expect(result).toEqual({ type: 'contract', ens: '' })
  })

  it('returns empty type when no chainId provided', async () => {
    resolveAddress.mockResolvedValue('test.eth')

    const result = await surface.identity('0xd8da6bf26964af9d7eed9e03e53415d37aa96045')

    expect(result).toEqual({ type: '', ens: 'test.eth' })
    expect(mockProvider.request).not.toHaveBeenCalled()
  })
})

describe('surface.decode', () => {
  it('decodes calldata for a known contract', async () => {
    const mockAbi = JSON.stringify([{ name: 'transfer', type: 'function', inputs: [] }])
    fetchContract.mockResolvedValue({ name: 'My Token', source: 'sourcify', abi: mockAbi })
    decodeCallData.mockReturnValue({ functionName: 'transfer', args: [] })

    const result = await surface.decode('0xTokenAddress', 1, '0xdeadbeef')

    expect(result).toMatchObject({
      contractAddress: '0xtokenaddress',
      contractName: 'My Token',
      source: 'sourcify',
      functionName: 'transfer'
    })
  })

  it('returns undefined when calldata cannot be decoded', async () => {
    fetchContract.mockResolvedValue(undefined)
    decodeCallData.mockReturnValue(undefined)

    const result = await surface.decode('0xUnknownContract', 1, '0xdeadbeef')

    expect(result).toBeUndefined()
  })
})

describe('surface.recog', () => {
  const contractAddress = '0xTokenContract'
  const chainId = 1
  const calldata = '0xdeadbeef'
  const context = { contractAddress, chainId }

  beforeEach(() => {
    // By default, Erc20Contract.decodeCallData returns undefined (not an ERC-20 call)
    Erc20Contract.decodeCallData.mockReturnValue(undefined)
    Erc20Contract.isApproval.mockReturnValue(false)
    Erc20Contract.isTransfer.mockReturnValue(false)
  })

  it('recognizes ERC-20 approval (id: erc20:approve)', async () => {
    const spenderAddress = '0xspender000000000000000000000000000000000'
    const amount = '0x' + BigInt('1000000000000000000').toString(16)

    Erc20Contract.decodeCallData.mockReturnValue({
      functionName: 'approve',
      args: [spenderAddress, BigInt('1000000000000000000')]
    })
    Erc20Contract.isApproval.mockReturnValue(true)
    Erc20Contract.isTransfer.mockReturnValue(false)

    // identity calls will use provider and resolveAddress
    mockProvider.request.mockResolvedValue('0x')
    resolveAddress.mockResolvedValue(null)

    const actions = await surface.recog(calldata, context)

    expect(actions).toHaveLength(1)
    expect(actions[0].id).toBe('erc20:approve')
    expect(actions[0].data.amount).toBe(amount)
    expect(actions[0].data.symbol).toBe('TTK')
    expect(actions[0].data.decimals).toBe(18)
    expect(actions[0].data.spender.address).toBe(spenderAddress)
    expect(typeof actions[0].update).toBe('function')
  })

  it('recognizes ERC-20 transfer (id: erc20:transfer)', async () => {
    const recipient = '0xrecipient0000000000000000000000000000000'
    const amount = '0x' + BigInt('500000000000000000').toString(16)

    Erc20Contract.decodeCallData.mockReturnValue({
      functionName: 'transfer',
      args: [recipient, BigInt('500000000000000000')]
    })
    Erc20Contract.isApproval.mockReturnValue(false)
    Erc20Contract.isTransfer.mockReturnValue(true)

    mockProvider.request.mockResolvedValue('0x')
    resolveAddress.mockResolvedValue(null)

    const actions = await surface.recog(calldata, context)

    expect(actions).toHaveLength(1)
    expect(actions[0].id).toBe('erc20:transfer')
    expect(actions[0].data.amount).toBe(amount)
    expect(actions[0].data.symbol).toBe('TTK')
    expect(actions[0].data.recipient.address).toBe(recipient)
  })

  it('returns empty actions for unknown/unrecognized contract', async () => {
    Erc20Contract.decodeCallData.mockReturnValue(undefined)

    const actions = await surface.recog(calldata, { contractAddress: '0xUnknown', chainId: 99 })

    expect(actions).toHaveLength(0)
  })

  it('erc20:approve .update() callback correctly mutates request state', async () => {
    const spenderAddress = '0xspender000000000000000000000000000000000'
    const initialAmount = '0x' + BigInt('1000000000000000000').toString(16)
    const newAmount = '0x' + BigInt('2000000000000000000').toString(16)
    const encodedCalldata = '0xencodedapprove'

    Erc20Contract.decodeCallData.mockReturnValue({
      functionName: 'approve',
      args: [spenderAddress, BigInt('1000000000000000000')]
    })
    Erc20Contract.isApproval.mockReturnValue(true)
    Erc20Contract.isTransfer.mockReturnValue(false)
    Erc20Contract.encodeCallData.mockReturnValue(encodedCalldata)

    mockProvider.request.mockResolvedValue('0x')
    resolveAddress.mockResolvedValue(null)

    const actions = await surface.recog(calldata, context)
    expect(actions).toHaveLength(1)
    const approveAction = actions[0]
    expect(approveAction.id).toBe('erc20:approve')

    // Simulate a request object
    const mockRequest = {
      data: { data: initialAmount },
      decodedData: { args: [{ value: spenderAddress }, { value: '1000000000000000000' }] }
    }

    // Call the update callback with the new amount
    approveAction.update(mockRequest, { amount: newAmount })

    // Verify the request state was mutated correctly
    expect(mockRequest.data.data).toBe(encodedCalldata)
    expect(Erc20Contract.encodeCallData).toHaveBeenCalledWith('approve', [spenderAddress, newAmount])
    // decodedData should be updated with the new amount
    expect(mockRequest.decodedData.args[1].value).toBe('2000000000000000000')
  })
})
