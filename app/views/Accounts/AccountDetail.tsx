import { useState, useMemo } from 'react'
import { useSnapshot } from 'valtio'
import {
  state,
  setSelectedAccount,
  useSelectedAccount,
  useSigners,
  useBalances,
  usePermissions,
  useOrigins,
  useNetworksMeta
} from '../../store'
import { actions } from '../../ipc'
import { createBalance, sortByTotalValue } from '../../../resources/domain/balance'
import { getSignerDisplayType, isHardwareSigner } from '../../../resources/domain/signer'
import Address from '../../components/Address'
import Balance from '../../components/Balance'
import StatusDot from '../../components/StatusDot'
import ChainBadge from '../../components/ChainBadge'
import Modal from '../../components/Modal'
import BuyButton from '../../components/BuyButton'

export default function AccountDetail() {
  const account = useSelectedAccount()
  const signers = useSigners()
  const networksMeta = useNetworksMeta()
  const snap = useSnapshot(state)
  const selectedId = snap.selectedAccount
  const balances = useBalances(selectedId ?? '')
  const permissions = usePermissions(selectedId ?? '')
  const origins = useOrigins()
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)

  if (!account) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Select an account to view details
      </div>
    )
  }

  const signer = account.signer ? signers[account.signer] : null
  const signerType = signer ? getSignerDisplayType(signer.type) : 'watch'
  const signerStatus = signer?.status ?? 'disconnected'
  const isHardware = signer ? isHardwareSigner(signer.type) : false

  // Build displayed balances with USD values
  const displayedBalances = useMemo(() => {
    if (!balances || !Array.isArray(balances)) return []
    return balances
      .map((b) => {
        const chainMeta = networksMeta[b.chainId]
        const quote = chainMeta?.nativeCurrency?.usd
          ? { price: chainMeta.nativeCurrency.usd.price, change24hr: chainMeta.nativeCurrency.usd.change24hr }
          : undefined
        return createBalance(b, quote)
      })
      .sort((a, b) => sortByTotalValue(a, b))
  }, [balances, networksMeta])

  const totalUsd = useMemo(() => {
    return displayedBalances.reduce((sum, b) => sum + (b.totalValue?.toNumber?.() ?? 0), 0)
  }, [displayedBalances])

  const handleRename = () => {
    if (newName.trim()) {
      actions.renameAccount(account.id, newName.trim())
      setRenaming(false)
      setNewName('')
    }
  }

  const handleRemove = () => {
    actions.removeAccount(account.id)
    setSelectedAccount(null)
    setConfirmRemove(false)
  }

  const handleVerify = () => {
    actions.verifyAddress()
  }

  const permissionEntries = Object.values(permissions)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <StatusDot status={signerStatus} />
          {renaming ? (
            <form
              onSubmit={(e) => { e.preventDefault(); handleRename() }}
              className="flex items-center gap-2 flex-1"
            >
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={account.name}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 flex-1 outline-none focus:border-gray-600"
              />
              <button type="submit" className="text-xs text-green-400 hover:text-green-300">Save</button>
              <button type="button" onClick={() => setRenaming(false)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
            </form>
          ) : (
            <h2 className="text-lg font-semibold text-gray-100 flex-1">
              {account.name || 'Account'}
              <button
                onClick={() => { setNewName(account.name || ''); setRenaming(true) }}
                className="ml-2 text-xs text-gray-500 hover:text-gray-300"
              >
                rename
              </button>
            </h2>
          )}
        </div>
        <div className="flex items-center justify-between">
          <Address address={account.id} full className="text-gray-400" />
          <BuyButton address={account.id} chainId={displayedBalances[0]?.chainId ?? 1} />
        </div>
      </div>

      {/* Signer info */}
      <section>
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Signer</h3>
        <div className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusDot status={signerStatus} />
            <span className="text-sm text-gray-200 capitalize">{signerType}</span>
            <span className="text-xs text-gray-500">{signerStatus}</span>
          </div>
          {isHardware && signerStatus === 'ok' && (
            <button
              onClick={handleVerify}
              className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-700"
            >
              Verify on device
            </button>
          )}
        </div>
      </section>

      {/* Balances */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Balances</h3>
          {totalUsd > 0 && (
            <span className="text-sm text-gray-300">${totalUsd.toFixed(2)}</span>
          )}
        </div>
        {displayedBalances.length === 0 ? (
          <div className="text-sm text-gray-500 py-3">No balances</div>
        ) : (
          <div className="space-y-1">
            {displayedBalances.map((b, i) => (
              <div key={`${b.chainId}-${b.address}-${i}`} className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-800/50">
                <ChainBadge
                  name={b.symbol}
                  primaryColor={networksMeta[b.chainId]?.primaryColor}
                />
                <Balance
                  symbol={b.symbol}
                  displayBalance={b.displayBalance}
                  displayValue={b.displayValue}
                  className="flex-1"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Permissions */}
      {permissionEntries.length > 0 && (
        <section>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Connected Origins</h3>
          <div className="space-y-1">
            {permissionEntries.map((perm) => {
              const origin = origins[perm.handlerId]
              return (
                <div key={perm.handlerId} className="flex items-center justify-between px-3 py-2 rounded hover:bg-gray-800/50">
                  <span className="text-sm text-gray-300">{origin?.name || perm.origin || perm.handlerId}</span>
                  <button
                    onClick={() => actions.removeOrigin(perm.handlerId)}
                    className="text-xs text-red-400/70 hover:text-red-400"
                  >
                    Revoke
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Actions */}
      <div className="pt-2 border-t border-gray-800">
        <button
          onClick={() => setConfirmRemove(true)}
          className="text-xs text-red-400/70 hover:text-red-400 transition-colors"
        >
          Remove Account
        </button>
      </div>

      <Modal open={confirmRemove} onClose={() => setConfirmRemove(false)} title="Remove Account">
        <p className="text-sm text-gray-300 mb-4">
          Are you sure you want to remove this account? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setConfirmRemove(false)}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleRemove}
            className="px-3 py-1.5 text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded"
          >
            Remove
          </button>
        </div>
      </Modal>
    </div>
  )
}
