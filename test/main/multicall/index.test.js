import ethProvider from 'eth-provider'
import log from 'electron-log'

import multicall from '../../../main/multicall'

jest.mock('eth-provider', () => () => ({ request: jest.fn() }))

let eth

beforeAll(() => {
  log.transports.console.level = false
})

afterAll(() => {
  log.transports.console.level = 'debug'
})

beforeEach(() => {
  eth = ethProvider()
  eth.request = jest.fn()
})

it('encodes aggregated calls correctly', async () => {
  eth.request.mockImplementationOnce(async (payload) => {
    expect(payload.method).toBe('eth_call')
    expect(payload.chainId).toBe('0x89')
    expect(payload.params[0].to).toBe('0x11ce4b23bd875d7f5c6a31084f55fde1e9a87507')
    expect(payload.params[0].data).toBe(
      '0x252dba4200000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000b3f868e0be5597d5db7feb59e1cadbb0fdda50a0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000002470a082310000000000000000000000001ad91ee08f21be3de0ba2ba6918e714da6b4583600000000000000000000000000000000000000000000000000000000000000000000000000000000e94d89243a7aeaf88857461ce555caeb344765fc0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000002470a082310000000000000000000000001ad91ee08f21be3de0ba2ba6918e714da6b4583600000000000000000000000000000000000000000000000000000000'
    )

    return '0x000000000000000000000000000000000000000000000000000000000181013800000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000017c7aa0a3000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000feca4525'
  })

  // Polygon uses Multicall1 and aggregate
  const caller = multicall(137, eth)

  const calls = [
    {
      target: '0x0b3F868E0BE5597D5DB7fEB59E1CADBb0fdDa50a',
      call: [
        'function balanceOf(address account) returns (uint256 value)',
        '0x1ad91ee08f21be3de0ba2ba6918e714da6b45836'
      ],
      returns: [(bn) => '0x' + bn.toString(16)]
    },
    {
      target: '0xe94D89243a7Aeaf88857461ce555caEB344765Fc',
      call: [
        'function balanceOf(address account) returns (uint256 value)',
        '0x1ad91ee08f21be3de0ba2ba6918e714da6b45836'
      ],
      returns: [(bn) => '0x' + bn.toString(16)]
    }
  ]

  const result = await caller.batchCall(calls)

  expect(result).toEqual([
    { success: true, returnValues: ['0x17c7aa0a3'] },
    { success: true, returnValues: ['0xfeca4525'] }
  ])
})

it('handles an error when using tryAggregate', async () => {
  eth.request.mockImplementationOnce(async (payload) => {
    expect(payload.method).toBe('eth_call')
    expect(payload.chainId).toBe('0x1')
    expect(payload.params[0].to).toBe('0x5ba1e12693dc8f9c48aad8770482f4739beed696')
    expect(payload.params[0].data).toBe(
      '0xbce38bd7000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000bcca60bb61934080951369a648fb03df4f96263c0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000002470a082310000000000000000000000001ad91ee08f21be3de0ba2ba6918e714da6b4583600000000000000000000000000000000000000000000000000000000000000000000000000000000089a502032166e07ae83eb434c16790ca2fa46610000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000002470a082310000000000000000000000001ad91ee08f21be3de0ba2ba6918e714da6b4583600000000000000000000000000000000000000000000000000000000'
    )

    return '0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000017c7aa4bb000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000'
  })

  // mainnet uses Multicall2 and tryAggregate
  const caller = multicall(1, eth)

  const calls = [
    {
      target: '0xBcca60bB61934080951369a648Fb03DF4F96263C',
      call: [
        'function balanceOf(address account) returns (uint256 value)',
        '0x1aD91ee08f21bE3dE0BA2ba6918E714dA6B45836'
      ],
      returns: [(bn) => '0x' + bn.toString(16)]
    },
    {
      target: '0x089a502032166e07ae83eb434c16790ca2fa4661',
      call: [
        'function balanceOf(address account) returns (uint256 value)',
        '0x1aD91ee08f21bE3dE0BA2ba6918E714dA6B45836'
      ],
      returns: [(bn) => '0x' + bn.toString(16)]
    }
  ]

  const result = await caller.batchCall(calls)

  expect(result).toEqual([
    { success: true, returnValues: ['0x17c7aa4bb'] },
    { success: false, returnValues: [] }
  ])
})

it('returns one batch if another errors', async () => {
  eth.request
    .mockRejectedValueOnce('multicall failed!')
    .mockResolvedValueOnce(
      '0x00000000000000000000000000000000000000000000000000000000018100e8000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000feca4525'
    )

  // Polygon uses Multicall1 and aggregate
  const caller = multicall(137, eth)

  const calls = [
    {
      target: '0xBcca60bB61934080951369a648Fb03DF4F96263C',
      call: [
        'function balanceOf(address account) returns (uint256 value)',
        '0x1aD91ee08f21bE3dE0BA2ba6918E714dA6B45836'
      ],
      returns: [(bn) => '0x' + bn.toString(16)]
    },
    {
      target: '0xe94D89243a7Aeaf88857461ce555caEB344765Fc',
      call: [
        'function balanceOf(address account) returns (uint256 value)',
        '0x1aD91ee08f21bE3dE0BA2ba6918E714dA6B45836'
      ],
      returns: [(bn) => '0x' + bn.toString(16)]
    }
  ]

  const result = await caller.batchCall(calls, 1)

  expect(result).toEqual([
    { success: false, returnValues: [] },
    { success: true, returnValues: ['0xfeca4525'] }
  ])
})

// ABI-encoded aggregate(calls) response for 2 balanceOf calls
// returns (uint256 blockNumber=0x1810138, bytes[] returndata=[abi(0x17c7aa0a3), abi(0xfeca4525)])
const AGGREGATE_2_CALLS_RESPONSE =
  '0x000000000000000000000000000000000000000000000000000000000181013800000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000017c7aa0a3000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000feca4525'

// ABI-encoded aggregate(calls) response for 1 balanceOf call
// returns (uint256 blockNumber=0x18100e8, bytes[] returndata=[abi(0xfeca4525)])
const AGGREGATE_1_CALL_RESPONSE =
  '0x00000000000000000000000000000000000000000000000000000000018100e8000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000feca4525'

// ABI-encoded tryAggregate response for 1 call: success=true, returndata=abi(uint256(0x17c7aa4bb))
const TRY_AGGREGATE_1_SUCCESS_RESPONSE =
  '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000017c7aa4bb'

// ABI-encoded tryAggregate response for 1 call: success=false, returndata=0x
const TRY_AGGREGATE_1_FAILURE_RESPONSE =
  '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000'

const BALANCE_OF_CALL = {
  target: '0xe94D89243a7Aeaf88857461ce555caEB344765Fc',
  call: [
    'function balanceOf(address account) returns (uint256 value)',
    '0x1aD91ee08f21bE3dE0BA2ba6918E714dA6B45836'
  ],
  returns: [(bn) => '0x' + bn.toString(16)]
}

describe('chainConfig', () => {
  it('uses Multicall2 address for mainnet (chain 1)', async () => {
    eth.request.mockResolvedValueOnce(TRY_AGGREGATE_1_SUCCESS_RESPONSE)

    const caller = multicall(1, eth)
    await caller.batchCall([BALANCE_OF_CALL])

    const payload = eth.request.mock.calls[0][0]
    expect(payload.chainId).toBe('0x1')
    expect(payload.params[0].to).toBe('0x5ba1e12693dc8f9c48aad8770482f4739beed696')
  })

  it('uses Multicall1 address for Polygon (chain 137)', async () => {
    eth.request.mockResolvedValueOnce(AGGREGATE_1_CALL_RESPONSE)

    const caller = multicall(137, eth)
    await caller.batchCall([BALANCE_OF_CALL])

    const payload = eth.request.mock.calls[0][0]
    expect(payload.chainId).toBe('0x89')
    expect(payload.params[0].to).toBe('0x11ce4b23bd875d7f5c6a31084f55fde1e9a87507')
  })

  it('throws for an unsupported chainId', () => {
    expect(() => multicall(99999, eth)).toThrow()
  })
})

describe('batchCall', () => {
  it('returns an empty array for empty calls input', async () => {
    const caller = multicall(137, eth)
    const result = await caller.batchCall([])

    expect(result).toEqual([])
    expect(eth.request).not.toHaveBeenCalled()
  })

  it('handles a single call in one batch', async () => {
    eth.request.mockResolvedValueOnce(AGGREGATE_1_CALL_RESPONSE)

    const caller = multicall(137, eth)
    const result = await caller.batchCall([BALANCE_OF_CALL])

    expect(result).toHaveLength(1)
    expect(result[0].success).toBe(true)
    expect(eth.request).toHaveBeenCalledTimes(1)
  })

  it('splits 3 calls with batchSize=2 into 2 provider requests', async () => {
    eth.request
      .mockResolvedValueOnce(AGGREGATE_2_CALLS_RESPONSE)
      .mockResolvedValueOnce(AGGREGATE_1_CALL_RESPONSE)

    const calls = [
      {
        target: '0x0b3F868E0BE5597D5DB7fEB59E1CADBb0fdDa50a',
        call: [
          'function balanceOf(address account) returns (uint256 value)',
          '0x1ad91ee08f21be3de0ba2ba6918e714da6b45836'
        ],
        returns: [(bn) => '0x' + bn.toString(16)]
      },
      {
        target: '0xe94D89243a7Aeaf88857461ce555caEB344765Fc',
        call: [
          'function balanceOf(address account) returns (uint256 value)',
          '0x1ad91ee08f21be3de0ba2ba6918e714da6b45836'
        ],
        returns: [(bn) => '0x' + bn.toString(16)]
      },
      {
        target: '0xBcca60bB61934080951369a648Fb03DF4F96263C',
        call: [
          'function balanceOf(address account) returns (uint256 value)',
          '0x1ad91ee08f21be3de0ba2ba6918e714da6b45836'
        ],
        returns: [(bn) => '0x' + bn.toString(16)]
      }
    ]

    const caller = multicall(137, eth)
    const result = await caller.batchCall(calls, 2)

    expect(eth.request).toHaveBeenCalledTimes(2)
    expect(result).toHaveLength(3)
  })

  it('concatenates results from multiple batches in the correct order', async () => {
    eth.request
      .mockResolvedValueOnce(AGGREGATE_2_CALLS_RESPONSE) // batch 1: calls[0,1] → [0x17c7aa0a3, 0xfeca4525]
      .mockResolvedValueOnce(AGGREGATE_1_CALL_RESPONSE) // batch 2: calls[2] → [0xfeca4525]

    const calls = [
      {
        target: '0x0b3F868E0BE5597D5DB7fEB59E1CADBb0fdDa50a',
        call: [
          'function balanceOf(address account) returns (uint256 value)',
          '0x1ad91ee08f21be3de0ba2ba6918e714da6b45836'
        ],
        returns: [(bn) => '0x' + bn.toString(16)]
      },
      {
        target: '0xe94D89243a7Aeaf88857461ce555caEB344765Fc',
        call: [
          'function balanceOf(address account) returns (uint256 value)',
          '0x1ad91ee08f21be3de0ba2ba6918e714da6b45836'
        ],
        returns: [(bn) => '0x' + bn.toString(16)]
      },
      {
        target: '0xBcca60bB61934080951369a648Fb03DF4F96263C',
        call: [
          'function balanceOf(address account) returns (uint256 value)',
          '0x1ad91ee08f21be3de0ba2ba6918e714da6b45836'
        ],
        returns: [(bn) => '0x' + bn.toString(16)]
      }
    ]

    const caller = multicall(137, eth)
    const result = await caller.batchCall(calls, 2)

    expect(result).toEqual([
      { success: true, returnValues: ['0x17c7aa0a3'] },
      { success: true, returnValues: ['0xfeca4525'] },
      { success: true, returnValues: ['0xfeca4525'] }
    ])
  })

  it('returns failed results for every call in a batch when the provider throws', async () => {
    eth.request.mockRejectedValueOnce(new Error('provider error'))

    const caller = multicall(137, eth)
    const result = await caller.batchCall([BALANCE_OF_CALL])

    expect(result).toEqual([{ success: false, returnValues: [] }])
  })

  it('keeps all calls in a single batch when count is within the default batchSize', async () => {
    eth.request.mockResolvedValueOnce(AGGREGATE_2_CALLS_RESPONSE)

    const calls = [
      {
        target: '0x0b3F868E0BE5597D5DB7fEB59E1CADBb0fdDa50a',
        call: [
          'function balanceOf(address account) returns (uint256 value)',
          '0x1ad91ee08f21be3de0ba2ba6918e714da6b45836'
        ],
        returns: [(bn) => '0x' + bn.toString(16)]
      },
      {
        target: '0xe94D89243a7Aeaf88857461ce555caEB344765Fc',
        call: [
          'function balanceOf(address account) returns (uint256 value)',
          '0x1ad91ee08f21be3de0ba2ba6918e714da6b45836'
        ],
        returns: [(bn) => '0x' + bn.toString(16)]
      }
    ]

    const caller = multicall(137, eth)
    await caller.batchCall(calls) // default batchSize=2000 → 1 batch

    expect(eth.request).toHaveBeenCalledTimes(1)
  })
})

describe('tryAggregate (Multicall2/V2)', () => {
  it('returns success=true for all calls when all succeed', async () => {
    eth.request.mockResolvedValueOnce(TRY_AGGREGATE_1_SUCCESS_RESPONSE)

    const caller = multicall(1, eth)
    const result = await caller.batchCall([BALANCE_OF_CALL])

    expect(result).toEqual([{ success: true, returnValues: ['0x17c7aa4bb'] }])
  })

  it('returns success=false for all calls when all fail', async () => {
    eth.request.mockResolvedValueOnce(TRY_AGGREGATE_1_FAILURE_RESPONSE)

    const caller = multicall(1, eth)
    const result = await caller.batchCall([BALANCE_OF_CALL])

    expect(result).toEqual([{ success: false, returnValues: [] }])
  })
})
