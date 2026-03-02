import { encodeFunctionData, decodeFunctionResult, type Hex } from 'viem'
import namehash from 'eth-ens-namehash'

import provider from '../provider'
import state from '../store'

import interfaces from './artifacts/interfaces'
import registryAddresses from './artifacts/addresses'

const registryAbi = interfaces.registry
const resolverAbi = interfaces.resolver

export async function resolveName(name: string): Promise<string | null> {
  const resolverAddress = await getResolverAddress(name)
  if (!resolverAddress) return null

  const node = namehash.hash(name)
  const input = encodeFunctionData({ abi: resolverAbi, functionName: 'addr', args: [node as Hex] })

  const params = { to: resolverAddress, data: input }
  const output = await makeCall('eth_call', params)

  if (output === '0x') return null

  const address = decodeFunctionResult({ abi: resolverAbi, functionName: 'addr', data: output as Hex })
  return address as string
}

export async function resolveAddress(address: string): Promise<string | null> {
  const name = `${address.slice(2)}.addr.reverse`

  const resolverAddress = await getResolverAddress(name)
  if (!resolverAddress) return null

  const node = namehash.hash(name)
  const input = encodeFunctionData({ abi: resolverAbi, functionName: 'name', args: [node as Hex] })

  const params = { to: resolverAddress, data: input }
  const output = await makeCall('eth_call', params)

  if (output === '0x') return null

  const resolvedName = decodeFunctionResult({ abi: resolverAbi, functionName: 'name', data: output as Hex })
  return resolvedName as string
}

async function getResolverAddress(name: string): Promise<string | null> {
  const hash = namehash.hash(name)

  const networkId = (state.main as any).currentNetwork?.id as number
  const registryAddress = registryAddresses[networkId]

  const input = encodeFunctionData({ abi: registryAbi, functionName: 'resolver', args: [hash as Hex] })

  const params = { to: registryAddress, data: input }
  const output = await makeCall('eth_call', params)

  if (output === '0x') return null

  const resolverAddress = decodeFunctionResult({ abi: registryAbi, functionName: 'resolver', data: output as Hex })
  return resolverAddress as string
}

function makeCall(method: string, params: { to: string; data: string }): Promise<string> {
  return new Promise((resolve) => {
    const payload = { jsonrpc: '2.0' as const, id: 1, method, params: [params, 'latest'] } as any
    provider.send(payload, (({ result }: { result: string }) => resolve(result)) as any)
  })
}
