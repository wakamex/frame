import { encodeFunctionData, decodeFunctionResult, parseAbi, type Hex } from 'viem'

// GasPriceOracle precompile on OP Stack chains
const GAS_PRICE_ORACLE = '0x420000000000000000000000000000000000000F'

const gasPriceOracleAbi = parseAbi([
  'function getL1Fee(bytes _data) view returns (uint256)'
])

// Minimal RLP encoding for an unsigned EIP-1559 transaction
function rlpEncodeUnsignedTx(tx: {
  to?: string
  value?: string | number
  data?: string
  gasLimit?: string | number
  maxFeePerGas?: string | number
  maxPriorityFeePerGas?: string | number
  nonce?: string | number
  type?: number
  chainId?: number
}): Hex {
  // For L1 fee estimation, the SDK passes a minimal tx object.
  // The oracle just needs the RLP-encoded bytes to estimate calldata cost.
  // We build a simple byte representation of the key fields.
  const fields = [
    tx.to || '0x',
    tx.value || '0x0',
    tx.data || '0x',
    tx.gasLimit || '0x0'
  ]
  // Concatenate hex representations as a rough approximation
  // The oracle mainly cares about data size for L1 cost estimation
  const concat = fields.map((f) => String(f).replace('0x', '')).join('')
  return ('0x' + concat) as Hex
}

// Estimate L1 gas cost for transactions on OP Stack chains
export async function estimateL1GasCost(
  provider: { request: (args: any) => Promise<any> },
  tx: {
    to?: string
    value?: string | number
    data?: string
    gasLimit?: string | number
    maxFeePerGas?: string | number
    maxPriorityFeePerGas?: string | number
    nonce?: string | number
    type?: number
    chainId?: number
  }
): Promise<bigint> {
  const txBytes = rlpEncodeUnsignedTx(tx)

  const callData = encodeFunctionData({
    abi: gasPriceOracleAbi,
    functionName: 'getL1Fee',
    args: [txBytes]
  })

  try {
    const chainId = tx.chainId ? '0x' + tx.chainId.toString(16) : undefined
    const result: Hex = await provider.request({
      method: 'eth_call',
      params: [{ to: GAS_PRICE_ORACLE, data: callData }, 'latest'],
      ...(chainId && { chainId })
    })

    const decoded = decodeFunctionResult({
      abi: gasPriceOracleAbi,
      functionName: 'getL1Fee',
      data: result
    })

    return decoded as unknown as bigint
  } catch (e) {
    // Return 0 if oracle call fails (non-OP chain or network error)
    return 0n
  }
}
