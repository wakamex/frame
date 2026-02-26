import { encodeFunctionData, decodeFunctionResult, parseAbi, type Abi, type Hex } from 'viem'
import { addHexPrefix } from '@ethereumjs/util'
import log from 'electron-log'

import type EthereumProvider from 'ethereum-provider'

import {
  abi,
  Call,
  CallResult,
  functionSignatureMatcher,
  multicallAddresses,
  MulticallConfig,
  MulticallVersion
} from './constants'

export { Call }

const multicallAbi = parseAbi(abi)
const memoizedAbis: Record<string, Abi> = {}

function chainConfig(chainId: number, eth: EthereumProvider): MulticallConfig {
  return {
    address: multicallAddresses[chainId].address,
    version: multicallAddresses[chainId].version,
    chainId,
    provider: eth
  }
}

async function makeCall(functionName: string, params: any[], config: MulticallConfig) {
  const data = encodeFunctionData({ abi: multicallAbi, functionName, args: params })

  const response: Hex = await config.provider.request({
    method: 'eth_call',
    params: [{ to: config.address, data }, 'latest'],
    chainId: addHexPrefix(config.chainId.toString(16))
  })

  return decodeFunctionResult({ abi: multicallAbi, functionName, data: response })
}

function buildCallData<R, T>(calls: Call<R, T>[]) {
  return calls.map(({ target, call }) => {
    const [fnSignature, ...params] = call
    const fnName = getFunctionNameFromSignature(fnSignature)

    const callAbi = getAbi(fnSignature)
    const calldata = encodeFunctionData({ abi: callAbi, functionName: fnName, args: params })

    return [target, calldata]
  })
}

function getResultData(results: any, call: string[], target: string) {
  const [fnSignature] = call
  const callAbi = memoizedAbis[fnSignature]
  const fnName = getFunctionNameFromSignature(fnSignature)
  try {
    const decoded = decodeFunctionResult({ abi: callAbi, functionName: fnName, data: results })
    return Array.isArray(decoded) ? decoded : [decoded]
  } catch (e) {
    log.warn(`Failed to decode ${fnName},`, { target, results })
    // Return nulls for each expected output
    const abiEntry = callAbi.find(
      (entry) => 'name' in entry && entry.name === fnName && entry.type === 'function'
    )
    const outputs = abiEntry && 'outputs' in abiEntry ? abiEntry.outputs || [] : []
    return outputs.map(() => null)
  }
}

function getFunctionNameFromSignature(signature: string) {
  const m = signature.match(functionSignatureMatcher)

  if (!m) {
    throw new Error(`could not parse function name from signature: ${signature}`)
  }

  return (m.groups || {}).signature
}

function getAbi(functionSignature: string) {
  if (!(functionSignature in memoizedAbis)) {
    memoizedAbis[functionSignature] = parseAbi([functionSignature])
  }

  return memoizedAbis[functionSignature]
}

async function aggregate<R, T>(calls: Call<R, T>[], config: MulticallConfig): Promise<CallResult<T>[]> {
  const aggData = buildCallData(calls)
  const response = await makeCall('aggregate', [aggData], config) as any
  const returndata = response[1] as string[]

  return calls.map(({ call, returns, target }, i) => {
    const resultData = getResultData(returndata[i], call, target)

    return { success: true, returnValues: returns.map((handler, j) => handler(resultData[j])) }
  })
}

async function tryAggregate<R, T>(calls: Call<R, T>[], config: MulticallConfig) {
  const aggData = buildCallData(calls)
  const response = await makeCall('tryAggregate', [false, aggData], config) as any

  return calls.map(({ call, returns, target }, i) => {
    const result = response[i]

    if (!result.success) {
      return { success: false, returnValues: [] }
    }

    const resultData = getResultData(result.returndata, call, target)

    return { success: true, returnValues: returns.map((handler, j) => handler(resultData[j])) }
  })
}

// public functions
export function supportsChain(chainId: number) {
  return chainId in multicallAddresses
}

export default function (chainId: number, eth: EthereumProvider) {
  const config = chainConfig(chainId, eth)

  async function call<R, T>(calls: Call<R, T>[]): Promise<CallResult<T>[]> {
    return config.version === MulticallVersion.V2 ? tryAggregate(calls, config) : aggregate(calls, config)
  }

  return {
    call,
    batchCall: async function <R, T>(calls: Call<R, T>[], batchSize = 2000) {
      const numBatches = Math.ceil(calls.length / batchSize)

      const fetches = [...Array(numBatches).keys()].map(async (_, batchIndex) => {
        const batchStart = batchIndex * batchSize
        const batchEnd = batchStart + batchSize
        const batchCalls = calls.slice(batchStart, batchEnd)

        try {
          const results = await call(batchCalls)

          return results
        } catch (e) {
          log.error(
            `multicall error (batch ${batchStart}-${batchEnd}), chainId: ${chainId}, first call: ${JSON.stringify(
              calls[batchStart]
            )}`,
            e
          )
          return [...Array(batchCalls.length).keys()].map(() => ({ success: false, returnValues: [] }))
        }
      })

      const fetchResults = await Promise.all(fetches)
      const callResults = ([] as CallResult<T>[]).concat(...fetchResults)

      return callResults
    }
  }
}
