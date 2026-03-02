import { addHexPrefix } from '@ethereumjs/util'
import {
  encodeFunctionData,
  decodeFunctionData,
  decodeFunctionResult,
  type Abi,
  type Hex
} from 'viem'
import provider from '../provider'
import { erc20Abi } from '../../resources/contracts'

export interface TokenData {
  decimals?: number
  name: string
  symbol: string
  totalSupply?: string
}

interface DecodedCallData {
  functionName: string
  args: readonly unknown[]
}

function createRpcCaller(chainId: number) {
  return (method: string, params: any[]): Promise<any> => {
    return new Promise((resolve, reject) => {
      const payload = {
        method,
        params,
        id: 1,
        jsonrpc: '2.0' as const,
        _origin: 'frame-internal',
        chainId: addHexPrefix(chainId.toString(16))
      }

      provider.sendAsync(payload, (error: any, response: any) => {
        if (error) return reject(error)
        if (response?.error) return reject(new Error(response.error.message || 'RPC error'))
        resolve(response?.result)
      })
    })
  }
}

export default class Erc20Contract {
  private call: (method: string, params: any[]) => Promise<any>
  private address: Hex

  constructor(address: Address, chainId: number) {
    this.address = address as Hex
    this.call = createRpcCaller(chainId)
  }

  static isApproval(data: DecodedCallData) {
    return data.functionName === 'approve'
  }

  static isTransfer(data: DecodedCallData) {
    return data.functionName === 'transfer'
  }

  static decodeCallData(calldata: string) {
    try {
      return decodeFunctionData({ abi: erc20Abi as Abi, data: calldata as Hex })
    } catch (e) {
      // call does not match ERC-20 interface
    }
  }

  static encodeCallData(fn: string, params: any[]) {
    return encodeFunctionData({
      abi: erc20Abi as Abi,
      functionName: fn,
      args: params
    })
  }

  private async ethCall(data: Hex): Promise<Hex> {
    return this.call('eth_call', [{ to: this.address, data }, 'latest'])
  }

  async getTokenData(): Promise<TokenData> {
    const callDecimals = async () => {
      try {
        const data = encodeFunctionData({ abi: erc20Abi as Abi, functionName: 'decimals' })
        const result = await this.ethCall(data)
        const decimals = decodeFunctionResult({ abi: erc20Abi as Abi, functionName: 'decimals', data: result }) as unknown
        return Number(decimals)
      } catch {
        return 0
      }
    }

    const callName = async () => {
      try {
        const data = encodeFunctionData({ abi: erc20Abi as Abi, functionName: 'name' })
        const result = await this.ethCall(data)
        const name = decodeFunctionResult({ abi: erc20Abi as Abi, functionName: 'name', data: result }) as unknown
        return name as string
      } catch {
        return ''
      }
    }

    const callSymbol = async () => {
      try {
        const data = encodeFunctionData({ abi: erc20Abi as Abi, functionName: 'symbol' })
        const result = await this.ethCall(data)
        const symbol = decodeFunctionResult({ abi: erc20Abi as Abi, functionName: 'symbol', data: result }) as unknown
        return symbol as string
      } catch {
        return ''
      }
    }

    const callTotalSupply = async () => {
      try {
        const data = encodeFunctionData({ abi: erc20Abi as Abi, functionName: 'totalSupply' })
        const result = await this.ethCall(data)
        const supply = decodeFunctionResult({ abi: erc20Abi as Abi, functionName: 'totalSupply', data: result }) as unknown
        return (supply as bigint).toString()
      } catch {
        return ''
      }
    }

    const [decimals, name, symbol, totalSupply] = await Promise.all([
      callDecimals(),
      callName(),
      callSymbol(),
      callTotalSupply()
    ])

    return { decimals, name, symbol, totalSupply }
  }
}
