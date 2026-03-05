import { useMemo } from 'react'
import type { Chain, ChainMetadata, GasSample } from '../../types'
import { useNetworks, useNetworksMeta } from '../../store'
import { isNetworkConnected } from '../../../resources/utils/chains'
import { weiToGwei, hexToInt, roundGwei } from '../../../resources/utils'

type GasLevel = 'slow' | 'standard' | 'fast' | 'asap'

const LEVEL_LABELS: Record<GasLevel, string> = {
  slow: 'Slow',
  standard: 'Standard',
  fast: 'Fast',
  asap: 'ASAP'
}

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
  if (usd < 10) return `$${usd.toFixed(2)}`
  return `$${usd.toFixed(2)}`
}

interface ChainGasData {
  id: string
  name: string
  symbol: string
  color: string | null
  connected: boolean
  baseFee: number | null
  priorityFee: number | null
  levels: Record<GasLevel, number | null>
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

        const levels = {
          slow: gweiFromHex(gas?.price?.levels?.slow),
          standard: gweiFromHex(gas?.price?.levels?.standard),
          fast: gweiFromHex(gas?.price?.levels?.fast),
          asap: gweiFromHex(gas?.price?.levels?.asap)
        }

        return {
          id,
          name: (chain as Chain).name,
          symbol: meta?.nativeCurrency?.symbol || 'ETH',
          color: meta?.primaryColor || null,
          connected,
          baseFee: gweiFromHex(gas?.price?.fees?.nextBaseFee),
          priorityFee: gweiFromHex(gas?.price?.fees?.maxPriorityFeePerGas),
          levels,
          samples: gas?.samples || []
        }
      })
      .sort((a, b) => {
        // Connected chains first, then alphabetical
        if (a.connected !== b.connected) return a.connected ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }, [networks, networksMeta])
}

export default function GasView() {
  const chains = useChainGasData()
  const connectedChains = chains.filter((c) => c.connected)
  const hasData = connectedChains.some((c) => c.baseFee !== null || c.levels.fast !== null)

  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Gas Tracker</h2>

      {/* Overview table */}
      {connectedChains.length > 0 ? (
        <GasOverview chains={connectedChains} />
      ) : (
        <div className="text-sm text-gray-500 py-8 text-center">
          No connected chains. Enable chains in the Chains view to track gas.
        </div>
      )}

      {/* Transaction cost estimates */}
      {hasData && connectedChains.length > 0 && (
        <TxCostTable chains={connectedChains} />
      )}
    </div>
  )
}

function GasOverview({ chains }: { chains: ChainGasData[] }) {
  return (
    <div className="bg-gray-800/50 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_repeat(4,_minmax(60px,_80px))_80px] gap-2 px-4 py-2.5 border-b border-gray-700/50 text-xs font-medium text-gray-500 uppercase tracking-wide">
        <div>Chain</div>
        {(['slow', 'standard', 'fast', 'asap'] as GasLevel[]).map((level) => (
          <div key={level} className="text-right">{LEVEL_LABELS[level]}</div>
        ))}
        <div className="text-right">Base</div>
      </div>

      {/* Rows */}
      {chains.map((chain) => (
        <GasRow key={chain.id} chain={chain} />
      ))}
    </div>
  )
}

function GasRow({ chain }: { chain: ChainGasData }) {
  const hasData = chain.baseFee !== null || chain.levels.fast !== null

  return (
    <div className="grid grid-cols-[1fr_repeat(4,_minmax(60px,_80px))_80px] gap-2 px-4 py-3 border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30 transition-colors">
      {/* Chain name */}
      <div className="flex items-center gap-2 min-w-0">
        {chain.color ? (
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: chain.color }} />
        ) : (
          <span className="w-2 h-2 rounded-full shrink-0 bg-gray-600" />
        )}
        <span className="text-sm text-gray-200 truncate">{chain.name}</span>
      </div>

      {/* Gas levels */}
      {hasData ? (
        <>
          {(['slow', 'standard', 'fast', 'asap'] as GasLevel[]).map((level) => (
            <div key={level} className="text-right">
              <span className={`text-sm tabular-nums ${levelColor(level, chain.levels[level])}`}>
                {formatGwei(chain.levels[level])}
              </span>
              {chain.levels[level] !== null && (
                <span className="text-xs text-gray-600 ml-0.5">g</span>
              )}
            </div>
          ))}
          <div className="text-right">
            <span className="text-sm text-gray-400 tabular-nums">{formatGwei(chain.baseFee)}</span>
            {chain.baseFee !== null && (
              <span className="text-xs text-gray-600 ml-0.5">g</span>
            )}
          </div>
        </>
      ) : (
        <>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="text-right text-sm text-gray-600">—</div>
          ))}
        </>
      )}
    </div>
  )
}

function levelColor(level: GasLevel, gwei: number | null): string {
  if (gwei === null) return 'text-gray-600'
  switch (level) {
    case 'slow':
      return 'text-green-400/80'
    case 'standard':
      return 'text-gray-200'
    case 'fast':
      return 'text-yellow-400/80'
    case 'asap':
      return 'text-orange-400/80'
  }
}

function TxCostTable({ chains }: { chains: ChainGasData[] }) {
  // Collect all unique sample labels across chains
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
        {/* Header */}
        <div
          className="grid gap-2 px-4 py-2.5 border-b border-gray-700/50 text-xs font-medium text-gray-500 uppercase tracking-wide"
          style={{ gridTemplateColumns: `1fr repeat(${sampleLabels.length}, minmax(80px, 1fr))` }}
        >
          <div>Chain</div>
          {sampleLabels.map((label) => (
            <div key={label} className="text-right">{label}</div>
          ))}
        </div>

        {/* Rows */}
        {chains.map((chain) => (
          <div
            key={chain.id}
            className="grid gap-2 px-4 py-3 border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30 transition-colors"
            style={{ gridTemplateColumns: `1fr repeat(${sampleLabels.length}, minmax(80px, 1fr))` }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {chain.color ? (
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: chain.color }} />
              ) : (
                <span className="w-2 h-2 rounded-full shrink-0 bg-gray-600" />
              )}
              <span className="text-sm text-gray-200 truncate">{chain.name}</span>
            </div>
            {sampleLabels.map((label) => {
              const sample = chain.samples.find((s) => s.label === label)
              const lowCost = sample?.estimates?.low?.cost?.usd
              const highCost = sample?.estimates?.high?.cost?.usd

              return (
                <div key={label} className="text-right">
                  {sample ? (
                    <CostRange low={lowCost} high={highCost} />
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

function CostRange({ low, high }: { low?: number | null; high?: number | null }) {
  if (low == null && high == null) return <span className="text-sm text-gray-600">—</span>

  // If low and high are the same (or only one exists), show single value
  if (low != null && (high == null || Math.abs(low - high) < 0.005)) {
    return <span className="text-sm text-gray-200 tabular-nums">{formatUsd(low)}</span>
  }

  if (low == null) {
    return <span className="text-sm text-gray-200 tabular-nums">{formatUsd(high)}</span>
  }

  return (
    <span className="text-sm tabular-nums">
      <span className="text-gray-400">{formatUsd(low)}</span>
      <span className="text-gray-600"> – </span>
      <span className="text-gray-200">{formatUsd(high)}</span>
    </span>
  )
}
