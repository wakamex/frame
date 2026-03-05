import { useMemo } from 'react'
import type { Chain, ChainMetadata, GasSample } from '../../types'
import { useNetworks, useNetworksMeta } from '../../store'
import { isNetworkConnected } from '../../../resources/utils/chains'
import { weiToGwei, hexToInt, roundGwei } from '../../../resources/utils'

function gweiFromHex(hex?: string): number | null {
  if (!hex) return null
  const val = weiToGwei(hexToInt(hex))
  return val > 0 ? val : null
}

function formatGwei(gwei: number | null): string {
  if (gwei === null) return '—'
  return String(roundGwei(gwei))
}

function formatUsd(usd: number | null | undefined): string {
  if (usd === null || usd === undefined) return '—'
  if (usd < 0.01) return '<$0.01'
  if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}

interface ChainGasData {
  id: string
  name: string
  symbol: string
  color: string | null
  connected: boolean
  gasPrice: number | null
  baseFee: number | null
  priorityFee: number | null
  samples: GasSample[]
}

function useChainGasData(): ChainGasData[] {
  const networks = useNetworks()
  const networksMeta = useNetworksMeta()

  return useMemo(() => {
    return Object.entries(networks)
      .filter(([, chain]) => (chain as Chain).on && !chain.isTestnet)
      .map(([id, chain]) => {
        const meta = networksMeta[id] as ChainMetadata | undefined
        const gas = meta?.gas
        const connected = isNetworkConnected(chain as Chain)

        // Use the best available gas price: fast level, or fall back to any level
        const levels = gas?.price?.levels
        const gasPrice = gweiFromHex(levels?.fast) ?? gweiFromHex(levels?.standard) ?? gweiFromHex(levels?.slow)

        return {
          id,
          name: (chain as Chain).name,
          symbol: meta?.nativeCurrency?.symbol || 'ETH',
          color: meta?.primaryColor || null,
          connected,
          gasPrice,
          baseFee: gweiFromHex(gas?.price?.fees?.nextBaseFee),
          priorityFee: gweiFromHex(gas?.price?.fees?.maxPriorityFeePerGas),
          samples: gas?.samples || []
        }
      })
      .sort((a, b) => {
        if (a.connected !== b.connected) return a.connected ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }, [networks, networksMeta])
}

export default function GasView() {
  const chains = useChainGasData()
  const connectedChains = chains.filter((c) => c.connected)
  const hasData = connectedChains.some((c) => c.gasPrice !== null)

  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Gas Tracker</h2>

      {connectedChains.length > 0 ? (
        <GasOverview chains={connectedChains} />
      ) : (
        <div className="text-sm text-gray-500 py-8 text-center">
          No connected chains. Enable chains in the Chains view to track gas.
        </div>
      )}

      {hasData && connectedChains.length > 0 && (
        <TxCostTable chains={connectedChains} />
      )}
    </div>
  )
}

function GasOverview({ chains }: { chains: ChainGasData[] }) {
  return (
    <div className="bg-gray-800/50 rounded-lg overflow-hidden">
      <div className="grid grid-cols-[1fr_80px_80px_80px] gap-2 px-4 py-2.5 border-b border-gray-700/50 text-xs font-medium text-gray-500 uppercase tracking-wide">
        <div>Chain</div>
        <div className="text-right">Gas Price</div>
        <div className="text-right">Base</div>
        <div className="text-right">Priority</div>
      </div>

      {chains.map((chain) => (
        <div
          key={chain.id}
          className="grid grid-cols-[1fr_80px_80px_80px] gap-2 px-4 py-3 border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: chain.color || undefined }}
            />
            <span className="text-sm text-gray-200 truncate">{chain.name}</span>
          </div>

          {chain.gasPrice !== null ? (
            <>
              <div className="text-right">
                <span className="text-sm text-gray-100 tabular-nums">{formatGwei(chain.gasPrice)}</span>
                <span className="text-xs text-gray-600 ml-0.5">g</span>
              </div>
              <div className="text-right">
                <span className="text-sm text-gray-400 tabular-nums">{formatGwei(chain.baseFee)}</span>
                {chain.baseFee !== null && <span className="text-xs text-gray-600 ml-0.5">g</span>}
              </div>
              <div className="text-right">
                <span className="text-sm text-gray-400 tabular-nums">{formatGwei(chain.priorityFee)}</span>
                {chain.priorityFee !== null && <span className="text-xs text-gray-600 ml-0.5">g</span>}
              </div>
            </>
          ) : (
            <>
              <div className="text-right text-sm text-gray-600">—</div>
              <div className="text-right text-sm text-gray-600">—</div>
              <div className="text-right text-sm text-gray-600">—</div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

function TxCostTable({ chains }: { chains: ChainGasData[] }) {
  const sampleLabels = useMemo(() => {
    const labels = new Set<string>()
    for (const chain of chains) {
      for (const sample of chain.samples) {
        labels.add(sample.label)
      }
    }
    return Array.from(labels)
  }, [chains])

  if (sampleLabels.length === 0) return null

  return (
    <div>
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
        Estimated Transaction Costs
      </h3>
      <div className="bg-gray-800/50 rounded-lg overflow-hidden">
        <div
          className="grid gap-2 px-4 py-2.5 border-b border-gray-700/50 text-xs font-medium text-gray-500 uppercase tracking-wide"
          style={{ gridTemplateColumns: `1fr repeat(${sampleLabels.length}, minmax(100px, 1fr))` }}
        >
          <div>Chain</div>
          {sampleLabels.map((label) => (
            <div key={label} className="text-right">{label}</div>
          ))}
        </div>

        {chains.map((chain) => (
          <div
            key={chain.id}
            className="grid gap-2 px-4 py-3 border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30 transition-colors"
            style={{ gridTemplateColumns: `1fr repeat(${sampleLabels.length}, minmax(100px, 1fr))` }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: chain.color || undefined }}
              />
              <span className="text-sm text-gray-200 truncate">{chain.name}</span>
            </div>
            {sampleLabels.map((label) => {
              const sample = chain.samples.find((s) => s.label === label)
              const cost = sample?.estimates?.low?.cost?.usd ?? sample?.estimates?.high?.cost?.usd
              const gasEstimateHex = sample?.estimates?.low?.gasEstimate || sample?.estimates?.high?.gasEstimate
              const gasGwei = gasEstimateHex ? gweiFromHex(gasEstimateHex) : null

              return (
                <div key={label} className="text-right">
                  {sample ? (
                    <>
                      <span className="text-sm text-gray-200 tabular-nums">{formatUsd(cost)}</span>
                      {gasGwei !== null && (
                        <div className="text-xs text-gray-600 tabular-nums">{formatGwei(gasGwei)}g</div>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-gray-600">—</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
