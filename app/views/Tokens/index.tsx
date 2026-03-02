import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { Token } from '../../types'
import { useTokens, useNetworks } from '../../store'
import { actions } from '../../ipc'
import Address from '../../components/Address'
import Modal from '../../components/Modal'

export default function TokensView() {
  const tokens = useTokens()
  const networks = useNetworks()
  const [showAdd, setShowAdd] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<Token | null>(null)
  const [filter, setFilter] = useState('')

  const customTokens = tokens.custom || []
  const filtered = filter
    ? customTokens.filter((t) =>
        (t.name || '').toLowerCase().includes(filter.toLowerCase()) ||
        (t.symbol || '').toLowerCase().includes(filter.toLowerCase()) ||
        (t.address || '').toLowerCase().includes(filter.toLowerCase())
      )
    : customTokens

  const handleRemove = (token: Token) => {
    actions.removeToken(token)
    setConfirmRemove(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Custom Tokens</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors px-2 py-1 rounded hover:bg-gray-800"
        >
          + Add Token
        </button>
      </div>

      {/* Search */}
      {customTokens.length > 5 && (
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter tokens..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-600"
        />
      )}

      {/* Token list */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          {customTokens.length === 0 ? 'No custom tokens added' : 'No tokens match filter'}
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((token, i) => {
            const chain = networks[token.chainId]
            return (
              <div
                key={`${token.chainId}-${token.address}-${i}`}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-800/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-100">{token.name || 'Unknown'}</span>
                    <span className="text-xs text-gray-500">{token.symbol}</span>
                    {chain && <span className="text-xs text-gray-600">{chain.name}</span>}
                  </div>
                  <Address address={token.address} className="text-xs text-gray-500" />
                </div>
                <button
                  onClick={() => setConfirmRemove(token)}
                  className="text-xs text-red-400/70 hover:text-red-400 ml-2"
                >
                  Remove
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add token modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Token">
        <AddTokenForm onDone={() => setShowAdd(false)} />
      </Modal>

      {/* Confirm remove */}
      <Modal open={!!confirmRemove} onClose={() => setConfirmRemove(null)} title="Remove Token">
        <p className="text-sm text-gray-300 mb-4">
          Remove <span className="text-gray-100">{confirmRemove?.name}</span> ({confirmRemove?.symbol})?
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setConfirmRemove(null)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 rounded">Cancel</button>
          <button onClick={() => handleRemove(confirmRemove)} className="px-3 py-1.5 text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded">Remove</button>
        </div>
      </Modal>
    </div>
  )
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

function AddTokenForm({ onDone }: { onDone: () => void }) {
  const networks = useNetworks()
  const activeChains = useMemo(
    () => Object.values(networks).filter((c) => c.on).sort((a, b) => a.name.localeCompare(b.name)),
    [networks]
  )

  const [contractAddress, setContractAddress] = useState('')
  const [chainId, setChainId] = useState(() =>
    activeChains.length > 0 ? String(activeChains[0].id) : ''
  )
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [decimals, setDecimals] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fetched, setFetched] = useState(false)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchDetails = useCallback(async (address: string, chain: string) => {
    setError('')
    setLoading(true)
    try {
      const data = await actions.getTokenDetails(address, parseInt(chain))
      if (data && data.name) {
        setName(data.name)
        setSymbol(data.symbol)
        setDecimals(String(data.decimals))
        setFetched(true)
      } else {
        setError('Could not find token at this address')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch token details')
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-fetch with 500ms debounce when address is valid and chain is set
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (ADDRESS_RE.test(contractAddress) && chainId) {
      timerRef.current = setTimeout(() => fetchDetails(contractAddress, chainId), 500)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [contractAddress, chainId, fetchDetails])

  const resetFields = () => {
    setName('')
    setSymbol('')
    setDecimals('')
    setError('')
    setFetched(false)
  }

  const canAdd = contractAddress && chainId && name && symbol && decimals

  const handleAdd = () => {
    if (!canAdd) return
    actions.addToken({
      name,
      symbol,
      decimals: parseInt(decimals),
      address: contractAddress,
      chainId: parseInt(chainId)
    })
    onDone()
  }

  const inputClass =
    'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-600'

  return (
    <div className="space-y-3">
      {/* Chain selector */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Network</label>
        <select
          value={chainId}
          onChange={(e) => { setChainId(e.target.value); resetFields() }}
          className={inputClass}
        >
          {activeChains.length === 0 && <option value="">No active networks</option>}
          {activeChains.map((c) => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Contract address */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Contract Address</label>
        <input
          value={contractAddress}
          onChange={(e) => { setContractAddress(e.target.value); resetFields() }}
          placeholder="0x..."
          className={`${inputClass} font-mono`}
        />
      </div>

      {/* Loading indicator */}
      {loading && (
        <p className="text-xs text-gray-400 animate-pulse">Fetching token details...</p>
      )}

      {/* Error */}
      {error && <p className="text-red-400 text-xs">{error}</p>}

      {/* Editable token fields -- shown once we have a valid address or fetched data */}
      {(fetched || error) && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Token Name"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Symbol</label>
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="TKN"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Decimals</label>
              <input
                value={decimals}
                onChange={(e) => setDecimals(e.target.value.replace(/\D/g, ''))}
                placeholder="18"
                className={inputClass}
              />
            </div>
          </div>
        </div>
      )}

      {/* Add button */}
      {(fetched || error) && (
        <button
          onClick={handleAdd}
          disabled={!canAdd}
          className="w-full py-2 rounded-lg text-sm font-medium bg-green-600/20 text-green-400 border border-green-600/30 hover:bg-green-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Add Token
        </button>
      )}
    </div>
  )
}
