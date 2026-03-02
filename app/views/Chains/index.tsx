import { useState, useMemo } from 'react'
import type { Chain, ChainMetadata } from '../../types'
import { useNetworks, useNetworksMeta } from '../../store'
import { actions, sendAction } from '../../ipc'
import { useCompact } from '../../hooks/useCompact'
import { isNetworkConnected } from '../../../resources/utils/chains'
import { weiToGwei, hexToInt, roundGwei } from '../../../resources/utils'
import StatusDot from '../../components/StatusDot'
import ChainDiscovery from './ChainDiscovery'

export default function ChainsView() {
  const networks = useNetworks()
  const networksMeta = useNetworksMeta()
  const [selectedChain, setSelectedChain] = useState<string | null>(null)
  const [discoveryOpen, setDiscoveryOpen] = useState(false)
  const compact = useCompact()

  const chains = useMemo(() => {
    return Object.entries(networks).sort(([, a], [, b]) => {
      // Mainnets first, then testnets
      if (a.isTestnet !== b.isTestnet) return a.isTestnet ? 1 : -1
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [networks])

  const selectedNetwork = selectedChain ? networks[selectedChain] : null
  const selectedMeta = selectedChain ? networksMeta[selectedChain] : null

  // Compact: show chain list or detail, not both
  const chainListContent = (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Networks</h2>
        <button
          onClick={() => setDiscoveryOpen(true)}
          className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded transition-colors"
        >
          Discover Chains
        </button>
      </div>
        <div className="flex flex-col gap-1">
          {chains.map(([id, chain]) => {
            const meta = networksMeta[id]
            const connected = isNetworkConnected(chain)
            const gasLevel = meta?.gas?.price?.levels?.fast
            const gasDisplay = gasLevel ? roundGwei(weiToGwei(hexToInt(gasLevel))) : null
            const isSelected = selectedChain === id
            const chainColor = meta?.primaryColor || null

            return (
              <button
                key={id}
                onClick={() => setSelectedChain(id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-gray-800 border border-gray-700'
                    : 'hover:bg-gray-800/50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  {chainColor && (
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: chainColor }} />
                  )}
                  <StatusDot status={connected ? 'connected' : chain.on ? 'loading' : 'off'} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-100 truncate">{chain.name}</span>
                      {chain.isTestnet && <span className="text-xs text-gray-600">test</span>}
                    </div>
                    <div className="text-xs text-gray-500">
                      {chain.on ? (connected ? 'Connected' : 'Connecting...') : 'Off'}
                      {gasDisplay ? ` · ${gasDisplay} gwei` : ''}
                    </div>
                  </div>
                  {/* Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      sendAction('activateNetwork', 'ethereum', parseInt(id), !chain.on)
                    }}
                    className={`w-8 h-4 rounded-full transition-colors ${
                      chain.on ? 'bg-green-600/40' : 'bg-gray-700'
                    }`}
                  >
                    <span
                      className={`block w-3 h-3 rounded-full transition-transform ${
                        chain.on ? 'translate-x-4 bg-green-400' : 'translate-x-0.5 bg-gray-500'
                      }`}
                    />
                  </button>
                </div>
              </button>
            )
          })}
        </div>
    </>
  )

  const discoveryModal = (
    <ChainDiscovery open={discoveryOpen} onClose={() => setDiscoveryOpen(false)} />
  )

  if (compact) {
    if (selectedChain && selectedNetwork) {
      return (
        <div className="h-full overflow-y-auto">
          <button
            onClick={() => setSelectedChain(null)}
            className="text-xs text-gray-500 hover:text-gray-300 mb-3"
          >
            &larr; All Networks
          </button>
          <ChainDetail chain={selectedNetwork} meta={selectedMeta} chainId={selectedChain} />
          {discoveryModal}
        </div>
      )
    }
    return (
      <div className="h-full overflow-y-auto">
        {chainListContent}
        {discoveryModal}
      </div>
    )
  }

  return (
    <div className="flex gap-6 h-full">
      <div className="w-72 shrink-0 overflow-y-auto">{chainListContent}</div>
      <div className="flex-1 overflow-y-auto">
        {selectedNetwork ? (
          <ChainDetail chain={selectedNetwork} meta={selectedMeta} chainId={selectedChain!} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Select a network to view details
          </div>
        )}
      </div>
      {discoveryModal}
    </div>
  )
}

function ChainDetail({ chain, meta, chainId }: { chain: Chain; meta: ChainMetadata | null; chainId: string }) {
  const connected = isNetworkConnected(chain)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">{chain.name}</h2>
        <div className="text-xs text-gray-500">Chain ID: {chainId}</div>
      </div>

      {/* Connection status */}
      <section>
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Connections</h3>
        <div className="space-y-2">
          <ConnectionRow label="Primary" connection={chain.connection?.primary} />
          <ConnectionRow label="Secondary" connection={chain.connection?.secondary} />
        </div>
      </section>

      {/* Gas */}
      {meta?.gas && (
        <section>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Gas</h3>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex gap-4">
              {['slow', 'standard', 'fast', 'asap'].map((level) => {
                const value = meta.gas.price?.levels?.[level]
                const display = value ? roundGwei(weiToGwei(hexToInt(value))) : '—'
                const isSelected = meta.gas.price?.selected === level
                return (
                  <div key={level} className={`text-center ${isSelected ? 'text-gray-100' : 'text-gray-500'}`}>
                    <div className="text-sm font-medium">{display}</div>
                    <div className="text-xs capitalize">{level}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Native currency */}
      {meta?.nativeCurrency && (
        <section>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Native Currency</h3>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-sm text-gray-200">
              {meta.nativeCurrency.name} ({meta.nativeCurrency.symbol})
            </div>
            {meta.nativeCurrency.usd?.price > 0 && (
              <div className="text-xs text-gray-400 mt-1">${meta.nativeCurrency.usd.price.toFixed(2)}</div>
            )}
          </div>
        </section>
      )}

      {/* Block height */}
      {meta?.blockHeight > 0 && (
        <div className="text-xs text-gray-500">
          Block height: {meta.blockHeight.toLocaleString()}
        </div>
      )}

      {/* Explorer */}
      {chain.explorer && (
        <button
          onClick={() => actions.openExplorer({ type: 'ethereum', id: parseInt(chainId) })}
          className="text-xs text-gray-400 hover:text-gray-200 underline"
        >
          Open Explorer
        </button>
      )}
    </div>
  )
}

function ConnectionRow({ label, connection }: { label: string; connection: Chain['connection']['primary'] | undefined }) {
  if (!connection) return null
  return (
    <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2">
      <div className="flex items-center gap-2">
        <StatusDot status={connection.connected ? 'connected' : connection.on ? 'loading' : 'off'} />
        <span className="text-sm text-gray-300">{label}</span>
      </div>
      <span className="text-xs text-gray-500 capitalize">
        {connection.current}{connection.custom ? ` (${connection.custom})` : ''}
      </span>
    </div>
  )
}
