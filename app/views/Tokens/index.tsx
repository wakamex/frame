import { useState } from 'react'
import { useTokens, useNetworks } from '../../store'
import { actions } from '../../ipc'
import Address from '../../components/Address'
import Modal from '../../components/Modal'

export default function TokensView() {
  const tokens = useTokens()
  const networks = useNetworks()
  const [showAdd, setShowAdd] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<any>(null)
  const [filter, setFilter] = useState('')

  const customTokens = tokens.custom || []
  const filtered = filter
    ? customTokens.filter((t: any) =>
        (t.name || '').toLowerCase().includes(filter.toLowerCase()) ||
        (t.symbol || '').toLowerCase().includes(filter.toLowerCase()) ||
        (t.address || '').toLowerCase().includes(filter.toLowerCase())
      )
    : customTokens

  const handleRemove = (token: any) => {
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
          {filtered.map((token: any, i: number) => {
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

function AddTokenForm({ onDone }: { onDone: () => void }) {
  const [contractAddress, setContractAddress] = useState('')
  const [chainId, setChainId] = useState('1')
  const [tokenData, setTokenData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleFetch = async () => {
    setError('')
    setLoading(true)
    try {
      const data = await actions.getTokenDetails(contractAddress, parseInt(chainId))
      if (data && data.name) {
        setTokenData(data)
      } else {
        setError('Could not find token at this address')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch token details')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    if (!tokenData) return
    actions.addToken({
      ...tokenData,
      address: contractAddress,
      chainId: parseInt(chainId)
    })
    onDone()
  }

  return (
    <div className="space-y-3">
      <input
        value={contractAddress}
        onChange={(e) => { setContractAddress(e.target.value); setTokenData(null) }}
        placeholder="Token contract address"
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-600 font-mono"
      />
      <select
        value={chainId}
        onChange={(e) => { setChainId(e.target.value); setTokenData(null) }}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none"
      >
        <option value="1">Ethereum Mainnet</option>
        <option value="10">Optimism</option>
        <option value="137">Polygon</option>
        <option value="8453">Base</option>
        <option value="42161">Arbitrum</option>
      </select>

      {!tokenData && (
        <button
          onClick={handleFetch}
          disabled={loading || !contractAddress}
          className="w-full py-2 rounded-lg text-sm font-medium bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Fetching...' : 'Fetch Token Info'}
        </button>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {tokenData && (
        <>
          <div className="bg-gray-800/50 rounded-lg p-3 space-y-1">
            <div className="text-sm text-gray-200">{tokenData.name}</div>
            <div className="text-xs text-gray-400">{tokenData.symbol} &middot; {tokenData.decimals} decimals</div>
          </div>
          <button
            onClick={handleAdd}
            className="w-full py-2 rounded-lg text-sm font-medium bg-green-600/20 text-green-400 border border-green-600/30 hover:bg-green-600/30 transition-colors"
          >
            Add Token
          </button>
        </>
      )}
    </div>
  )
}
