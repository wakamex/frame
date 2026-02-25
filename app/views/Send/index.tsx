import { useState, useEffect, useMemo } from 'react'
import type { Chain } from '../../types'
import { useStore, useAccounts, useBalances, useNetworks } from '../../store'
import { rpc } from '../../ipc'

export default function SendView() {
  const accounts = useAccounts()
  const selectedAccount = useStore((s) => s.selectedAccount)
  const networks = useNetworks()

  // Use selected account or first available
  const accountId = selectedAccount || Object.keys(accounts)[0]
  const account = accountId ? accounts[accountId] : null

  if (!account) {
    return (
      <div className="text-gray-500 text-sm">
        Select an account to send from.
      </div>
    )
  }

  return <SendForm accountId={accountId} account={account} networks={networks} />
}

function SendForm({
  accountId,
  account,
  networks
}: {
  accountId: string
  account: Record<string, unknown>
  networks: Record<string, Chain>
}) {
  const balances = useBalances(accountId)

  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [chainId, setChainId] = useState('1')
  const [tokenAddress, setTokenAddress] = useState('native')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [resolvedAddress, setResolvedAddress] = useState('')
  const [resolving, setResolving] = useState(false)

  // Build token list from balances for the selected chain
  const tokens = useMemo(() => {
    const chain = networks[chainId]
    const nativeSymbol = chain?.symbol || 'ETH'
    const items: Array<{ address: string; symbol: string; name: string; decimals: number; balance: string }> = [
      { address: 'native', symbol: nativeSymbol, name: nativeSymbol, decimals: 18, balance: '' }
    ]

    if (balances) {
      for (const bal of balances) {
        if (String(bal.chainId) === chainId && bal.address !== '0x0000000000000000000000000000000000000000') {
          items.push({
            address: bal.address,
            symbol: bal.symbol || '???',
            name: bal.name || bal.symbol || 'Unknown',
            decimals: bal.decimals || 18,
            balance: bal.balance || '0'
          })
        }
      }
    }

    return items
  }, [balances, chainId, networks])

  // Active chains for the chain selector
  const activeChains = useMemo(() => {
    return Object.entries(networks)
      .filter(([, chain]) => chain.on)
      .sort(([a], [b]) => {
        if (a === '1') return -1
        if (b === '1') return 1
        return Number(a) - Number(b)
      })
  }, [networks])

  const isEns = recipient.includes('.') && !recipient.startsWith('0x')

  const handleResolveEns = async () => {
    if (!isEns) return
    setResolving(true)
    setError('')
    try {
      const resolved = await rpc('resolveEnsName', recipient)
      if (resolved) {
        setResolvedAddress(resolved)
      } else {
        setError('Could not resolve ENS name')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'ENS resolution failed')
    } finally {
      setResolving(false)
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const to = resolvedAddress || recipient
    if (!to || !to.startsWith('0x')) {
      setError('Invalid recipient address')
      return
    }

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Invalid amount')
      return
    }

    setSending(true)
    try {
      const selectedToken = tokens.find((t) => t.address === tokenAddress)
      const decimals = selectedToken?.decimals ?? 18

      // Convert amount to wei/smallest unit
      const amountInSmallest = toSmallestUnit(amount, decimals)

      let tx: Record<string, string>

      if (tokenAddress === 'native') {
        // Native ETH transfer
        tx = {
          from: accountId,
          to,
          value: '0x' + BigInt(amountInSmallest).toString(16),
          chainId: '0x' + Number(chainId).toString(16)
        }
      } else {
        // ERC-20 transfer — encode transfer(address,uint256)
        const transferSig = '0xa9059cbb'
        const paddedTo = to.slice(2).padStart(64, '0')
        const paddedAmount = BigInt(amountInSmallest).toString(16).padStart(64, '0')
        const data = transferSig + paddedTo + paddedAmount

        tx = {
          from: accountId,
          to: tokenAddress,
          value: '0x0',
          data,
          chainId: '0x' + Number(chainId).toString(16)
        }
      }

      // Send via the provider — this will create a request that shows in the approval flow
      const payload = {
        method: 'eth_sendTransaction',
        params: [tx],
        jsonrpc: '2.0' as const,
        id: 1
      }

      await rpc('providerSend', payload)

      // Clear form on success (request was created)
      setRecipient('')
      setAmount('')
      setResolvedAddress('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send transaction')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-lg font-semibold text-gray-100 mb-4">Send</h1>

      <form onSubmit={handleSend} className="space-y-4">
        {/* Chain selector */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Network</label>
          <select
            value={chainId}
            onChange={(e) => { setChainId(e.target.value); setTokenAddress('native') }}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-600"
          >
            {activeChains.map(([id, chain]) => (
              <option key={id} value={id}>{chain.name} ({id})</option>
            ))}
          </select>
        </div>

        {/* Recipient */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Recipient</label>
          <div className="flex gap-2">
            <input
              value={recipient}
              onChange={(e) => { setRecipient(e.target.value); setResolvedAddress('') }}
              placeholder="0x... or ENS name"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-600 font-mono"
            />
            {isEns && !resolvedAddress && (
              <button
                type="button"
                onClick={handleResolveEns}
                disabled={resolving}
                className="px-3 py-2 text-sm bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-40"
              >
                {resolving ? '...' : 'Resolve'}
              </button>
            )}
          </div>
          {resolvedAddress && (
            <div className="text-xs text-gray-400 font-mono mt-1 truncate">
              {resolvedAddress}
            </div>
          )}
        </div>

        {/* Token selector */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Token</label>
          <select
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-600"
          >
            {tokens.map((token) => (
              <option key={token.address} value={token.address}>
                {token.symbol}
              </option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Amount</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            type="text"
            inputMode="decimal"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-600 font-mono"
          />
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          type="submit"
          disabled={sending || !recipient || !amount}
          className="w-full py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-900 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? 'Submitting...' : 'Review Transaction'}
        </button>

        <p className="text-xs text-gray-600 text-center">
          You'll review the transaction details before confirming.
        </p>
      </form>
    </div>
  )
}

function toSmallestUnit(amount: string, decimals: number): string {
  const parts = amount.split('.')
  const whole = parts[0] || '0'
  let fraction = parts[1] || ''

  // Pad or truncate fraction to match decimals
  if (fraction.length > decimals) {
    fraction = fraction.slice(0, decimals)
  } else {
    fraction = fraction.padEnd(decimals, '0')
  }

  // Remove leading zeros from combined string, but keep at least '0'
  const combined = (whole + fraction).replace(/^0+/, '') || '0'
  return combined
}
