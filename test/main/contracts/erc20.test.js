import Erc20Contract from '../../../main/contracts/erc20'
import provider from '../../../main/provider'

jest.mock('valtio', () => ({
  subscribe: jest.fn((_state, cb) => jest.fn()),
  snapshot: jest.fn((s) => JSON.parse(JSON.stringify(s))),
  proxy: jest.fn((obj) => obj)
}))

jest.mock('../../../main/provider', () => ({
  __esModule: true,
  default: { sendAsync: jest.fn() }
}))

jest.mock('electron-log', () => ({
  __esModule: true,
  default: {
    transports: { console: { level: false } },
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}))

// Pre-computed calldata and results using viem's ERC-20 ABI encoding
const TOKEN_ADDRESS = '0x1234567890123456789012345678901234567890'
const SPENDER_ADDRESS = '0x1234567890123456789012345678901234567890'
const CHAIN_ID = 1

// ERC-20 calldata (function selector + ABI-encoded params)
const TRANSFER_CALLDATA =
  '0xa9059cbb00000000000000000000000012345678901234567890123456789012345678900000000000000000000000000000000000000000000000000de0b6b3a7640000'
const APPROVE_CALLDATA =
  '0x095ea7b3000000000000000000000000123456789012345678901234567890123456789000000000000000000000000000000000000000000000000006f05b59d3b20000'

// ABI-encoded return values from RPC
const DECIMALS_RESULT = '0x0000000000000000000000000000000000000000000000000000000000000012' // 18
const NAME_RESULT =
  '0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000954657374546f6b656e0000000000000000000000000000000000000000000000' // "TestToken"
const SYMBOL_RESULT =
  '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000025454000000000000000000000000000000000000000000000000000000000000' // "TT"
const TOTAL_SUPPLY_RESULT = '0x00000000000000000000000000000000000000000000d3c21bcecceda1000000' // 1e24

// Function selectors
const DECIMALS_SELECTOR = '0x313ce567'
const NAME_SELECTOR = '0x06fdde03'
const SYMBOL_SELECTOR = '0x95d89b41'
const TOTAL_SUPPLY_SELECTOR = '0x18160ddd'

function mockAllTokenDataCalls() {
  provider.sendAsync.mockImplementation((payload, cb) => {
    const data = payload.params[0].data
    if (data.startsWith(DECIMALS_SELECTOR)) {
      cb(null, { result: DECIMALS_RESULT })
    } else if (data.startsWith(NAME_SELECTOR)) {
      cb(null, { result: NAME_RESULT })
    } else if (data.startsWith(SYMBOL_SELECTOR)) {
      cb(null, { result: SYMBOL_RESULT })
    } else if (data.startsWith(TOTAL_SUPPLY_SELECTOR)) {
      cb(null, { result: TOTAL_SUPPLY_RESULT })
    }
  })
}

describe('Erc20Contract', () => {
  describe('isApproval', () => {
    it('returns true for approve function', () => {
      expect(Erc20Contract.isApproval({ functionName: 'approve', args: [] })).toBe(true)
    })

    it('returns false for non-approve function', () => {
      expect(Erc20Contract.isApproval({ functionName: 'transfer', args: [] })).toBe(false)
    })
  })

  describe('isTransfer', () => {
    it('returns true for transfer function', () => {
      expect(Erc20Contract.isTransfer({ functionName: 'transfer', args: [] })).toBe(true)
    })

    it('returns false for non-transfer function', () => {
      expect(Erc20Contract.isTransfer({ functionName: 'approve', args: [] })).toBe(false)
    })
  })

  describe('decodeCallData', () => {
    it('decodes valid ERC-20 transfer calldata', () => {
      const result = Erc20Contract.decodeCallData(TRANSFER_CALLDATA)
      expect(result).toBeDefined()
      expect(result.functionName).toBe('transfer')
      expect(result.args[0]).toBe(SPENDER_ADDRESS)
      expect(result.args[1]).toBe(BigInt('1000000000000000000'))
    })

    it('decodes valid ERC-20 approve calldata', () => {
      const result = Erc20Contract.decodeCallData(APPROVE_CALLDATA)
      expect(result).toBeDefined()
      expect(result.functionName).toBe('approve')
      expect(result.args[0]).toBe(SPENDER_ADDRESS)
      expect(result.args[1]).toBe(BigInt('500000000000000000'))
    })

    it('returns undefined for non-ERC-20 calldata', () => {
      const result = Erc20Contract.decodeCallData('0xdeadbeef')
      expect(result).toBeUndefined()
    })
  })

  describe('encodeCallData', () => {
    it('encodes transfer(address,uint256) correctly', () => {
      const result = Erc20Contract.encodeCallData('transfer', [
        SPENDER_ADDRESS,
        BigInt('1000000000000000000')
      ])
      expect(result).toBe(TRANSFER_CALLDATA)
    })

    it('encodes approve(address,uint256) correctly', () => {
      const result = Erc20Contract.encodeCallData('approve', [
        SPENDER_ADDRESS,
        BigInt('500000000000000000')
      ])
      expect(result).toBe(APPROVE_CALLDATA)
    })
  })

  describe('getTokenData', () => {
    it('returns token data from RPC on happy path', async () => {
      mockAllTokenDataCalls()

      const contract = new Erc20Contract(TOKEN_ADDRESS, CHAIN_ID)
      const result = await contract.getTokenData()

      expect(result).toEqual({
        decimals: 18,
        name: 'TestToken',
        symbol: 'TT',
        totalSupply: '1000000000000000000000000'
      })
    })

    it('returns defaults for failing calls while succeeding calls still return data', async () => {
      provider.sendAsync.mockImplementation((payload, cb) => {
        const data = payload.params[0].data
        if (data.startsWith(DECIMALS_SELECTOR)) {
          cb(new Error('RPC error')) // decimals fails
        } else if (data.startsWith(NAME_SELECTOR)) {
          cb(null, { result: NAME_RESULT }) // name succeeds
        } else if (data.startsWith(SYMBOL_SELECTOR)) {
          cb(null, { result: SYMBOL_RESULT }) // symbol succeeds
        } else if (data.startsWith(TOTAL_SUPPLY_SELECTOR)) {
          cb(new Error('RPC error')) // totalSupply fails
        }
      })

      const contract = new Erc20Contract(TOKEN_ADDRESS, CHAIN_ID)
      const result = await contract.getTokenData()

      expect(result).toEqual({
        decimals: 0,
        name: 'TestToken',
        symbol: 'TT',
        totalSupply: ''
      })
    })

    it('returns all defaults when all calls fail', async () => {
      provider.sendAsync.mockImplementation((payload, cb) => {
        cb(new Error('network error'))
      })

      const contract = new Erc20Contract(TOKEN_ADDRESS, CHAIN_ID)
      const result = await contract.getTokenData()

      expect(result).toEqual({
        decimals: 0,
        name: '',
        symbol: '',
        totalSupply: ''
      })
    })
  })

  describe('createRpcCaller', () => {
    it('sends correct JSON-RPC payload with hex chainId and _origin', async () => {
      mockAllTokenDataCalls()

      const contract = new Erc20Contract(TOKEN_ADDRESS, CHAIN_ID)
      await contract.getTokenData()

      // Verify payload structure of first sendAsync call
      const [firstPayload] = provider.sendAsync.mock.calls[0]
      expect(firstPayload._origin).toBe('frame-internal')
      expect(firstPayload.chainId).toBe('0x1')
      expect(firstPayload.method).toBe('eth_call')
      expect(firstPayload.jsonrpc).toBe('2.0')
      expect(firstPayload.id).toBe(1)
    })

    it('rejects on error callback', async () => {
      provider.sendAsync.mockImplementation((payload, cb) => {
        cb(new Error('network error'))
      })

      const contract = new Erc20Contract(TOKEN_ADDRESS, CHAIN_ID)
      // getTokenData catches individual rejections and returns defaults
      const result = await contract.getTokenData()

      expect(result.decimals).toBe(0)
      expect(result.name).toBe('')
    })

    it('rejects on response.error', async () => {
      provider.sendAsync.mockImplementation((payload, cb) => {
        cb(null, { error: { message: 'execution reverted' } })
      })

      const contract = new Erc20Contract(TOKEN_ADDRESS, CHAIN_ID)
      // getTokenData catches rejections from response.error and returns defaults
      const result = await contract.getTokenData()

      expect(result.decimals).toBe(0)
      expect(result.symbol).toBe('')
      expect(result.totalSupply).toBe('')
    })
  })
})
