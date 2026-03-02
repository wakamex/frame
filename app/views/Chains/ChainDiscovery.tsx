import { useState, useEffect, useMemo } from 'react'
import Modal from '../../components/Modal'
import { actions } from '../../ipc'
import { useNetworks } from '../../store'

interface ChainlistEntry {
  chainId: number
  name: string
  nativeCurrency?: { name: string; symbol: string; decimals: number }
  rpc: string[]
  explorers?: Array<{ name: string; url: string }>
  testnet?: boolean
}

interface ChainDiscoveryProps {
  open: boolean
  onClose: () => void
}

export default function ChainDiscovery({ open, onClose }: ChainDiscoveryProps) {
  const networks = useNetworks()
  const [chainlist, setChainlist] = useState<ChainlistEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    actions
      .fetchChainlist()
      .then((data) => setChainlist(data || []))
      .catch(() => setError('Failed to fetch chain list'))
      .finally(() => setLoading(false))
  }, [open])

  const existingChainIds = useMemo(() => {
    return new Set(Object.keys(networks).map(Number))
  }, [networks])

  const trimmedSearch = search.trim()

  const filtered = useMemo(() => {
    if (!trimmedSearch) return chainlist.slice(0, 50)
    const term = trimmedSearch.toLowerCase()
    const numericTerm = Number(term)
    const isNumeric = !isNaN(numericTerm) && term.length > 0
    return chainlist
      .filter((c) => {
        if (isNumeric) {
          return String(c.chainId).startsWith(term)
        }
        return c.name.toLowerCase().includes(term)
      })
      .slice(0, 50)
  }, [chainlist, trimmedSearch])

  function handleAdd(chain: ChainlistEntry) {
    const rpcUrls = (chain.rpc || []).filter((url) => !url.includes('${'))
    actions.addChain({
      id: chain.chainId,
      type: 'ethereum',
      name: chain.name,
      explorer: chain.explorers?.[0]?.url || '',
      symbol: chain.nativeCurrency?.symbol || 'ETH',
      primaryRpc: rpcUrls[0] || '',
      secondaryRpc: rpcUrls[1] || '',
      isTestnet: chain.testnet || false
    })
    setAddedIds((prev) => new Set(prev).add(chain.chainId))
  }

  return (
    <Modal open={open} onClose={onClose} title="Discover Chains">
      <input
        type="text"
        placeholder="Search by name or chain ID..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-gray-600 mb-4"
        autoFocus
      />

      {loading && (
        <div className="text-sm text-gray-500 text-center py-8">Loading chains...</div>
      )}

      {error && (
        <div className="text-sm text-red-400 text-center py-8">{error}</div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-sm text-gray-500 text-center py-8">
          {trimmedSearch ? 'No chains found' : 'No chain data available'}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
          {filtered.map((chain) => {
            const isExisting = existingChainIds.has(chain.chainId)
            const justAdded = addedIds.has(chain.chainId)
            const isAdded = isExisting || justAdded

            return (
              <div
                key={chain.chainId}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-800/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-100 truncate">{chain.name}</div>
                  <div className="text-xs text-gray-500">
                    ID: {chain.chainId}
                    {chain.nativeCurrency?.symbol ? ` \u00b7 ${chain.nativeCurrency.symbol}` : ''}
                  </div>
                </div>
                {isAdded ? (
                  <span className="text-xs text-gray-500 px-2 py-1 bg-gray-800 rounded">
                    Added
                  </span>
                ) : (
                  <button
                    onClick={() => handleAdd(chain)}
                    className="text-xs text-gray-100 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                  >
                    Add
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
