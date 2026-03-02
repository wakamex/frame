import { encodeAbiParameters, parseAbiParameters } from 'viem'
import { estimateL1GasCost } from '../../../main/provider/l1Gas'

const GAS_PRICE_ORACLE = '0x420000000000000000000000000000000000000F'

function encodeUint256(value) {
  return encodeAbiParameters(parseAbiParameters('uint256'), [value])
}

describe('estimateL1GasCost', () => {
  let mockProvider

  beforeEach(() => {
    mockProvider = { request: jest.fn() }
  })

  it('returns bigint on happy path with valid encoded uint256', async () => {
    const expected = 123456789n
    mockProvider.request.mockResolvedValue(encodeUint256(expected))

    const result = await estimateL1GasCost(mockProvider, {
      to: '0xabcdef1234567890abcdef1234567890abcdef12',
      value: '0x1',
      data: '0xdeadbeef',
      gasLimit: '0x5208'
    })

    expect(result).toBe(expected)
  })

  it('returns 0n when provider.request throws', async () => {
    mockProvider.request.mockRejectedValue(new Error('network error'))

    const result = await estimateL1GasCost(mockProvider, { to: '0x1234' })

    expect(result).toBe(0n)
  })

  it('returns 0n when provider.request returns invalid data', async () => {
    mockProvider.request.mockResolvedValue('0xinvaliddata')

    const result = await estimateL1GasCost(mockProvider, { to: '0x1234' })

    expect(result).toBe(0n)
  })

  it('targets GasPriceOracle address in eth_call', async () => {
    mockProvider.request.mockResolvedValue(encodeUint256(1n))

    await estimateL1GasCost(mockProvider, { to: '0x1234', data: '0xaabbcc' })

    expect(mockProvider.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'eth_call',
        params: expect.arrayContaining([
          expect.objectContaining({ to: GAS_PRICE_ORACLE })
        ])
      })
    )
  })

  it('includes hex chainId in request when tx.chainId is set', async () => {
    mockProvider.request.mockResolvedValue(encodeUint256(1n))

    await estimateL1GasCost(mockProvider, { to: '0x1234', chainId: 10 })

    expect(mockProvider.request).toHaveBeenCalledWith(
      expect.objectContaining({ chainId: '0xa' })
    )
  })

  it('does not include chainId in request when tx.chainId is undefined', async () => {
    mockProvider.request.mockResolvedValue(encodeUint256(1n))

    await estimateL1GasCost(mockProvider, { to: '0x1234' })

    const callArgs = mockProvider.request.mock.calls[0][0]
    expect(callArgs).not.toHaveProperty('chainId')
  })

  it('handles empty tx object (all defaults)', async () => {
    mockProvider.request.mockResolvedValue(encodeUint256(0n))

    const result = await estimateL1GasCost(mockProvider, {})

    expect(result).toBe(0n)
    expect(mockProvider.request).toHaveBeenCalledTimes(1)
  })

  it('produces larger encoded bytes for data-heavy tx', async () => {
    mockProvider.request.mockResolvedValue(encodeUint256(999n))

    const largeData = '0x' + 'ab'.repeat(200)
    await estimateL1GasCost(mockProvider, { data: largeData })

    const callArgs = mockProvider.request.mock.calls[0][0]
    // The calldata for a data-heavy tx should be larger than for an empty tx
    const calldataHeavy = callArgs.params[0].data

    mockProvider.request.mockResolvedValue(encodeUint256(999n))
    await estimateL1GasCost(mockProvider, {})
    const calldataEmpty = mockProvider.request.mock.calls[1][0].params[0].data

    expect(calldataHeavy.length).toBeGreaterThan(calldataEmpty.length)
  })
})

describe('rlpEncodeUnsignedTx (via estimateL1GasCost calldata)', () => {
  let mockProvider

  beforeEach(() => {
    mockProvider = { request: jest.fn().mockResolvedValue(encodeUint256(1n)) }
  })

  it('basic tx fields produce calldata starting with 0x', async () => {
    await estimateL1GasCost(mockProvider, {
      to: '0xabcdef1234567890abcdef1234567890abcdef12',
      value: '0x1',
      data: '0xdeadbeef',
      gasLimit: '0x5208'
    })

    const callArgs = mockProvider.request.mock.calls[0][0]
    expect(callArgs.params[0].data).toMatch(/^0x/)
  })

  it('missing optional fields use defaults without throwing', async () => {
    await expect(
      estimateL1GasCost(mockProvider, {})
    ).resolves.not.toThrow()

    expect(mockProvider.request).toHaveBeenCalledTimes(1)
  })
})
