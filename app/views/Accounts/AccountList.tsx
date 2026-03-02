import { useMemo } from 'react'
import { useAccounts, useSigners, useAccountsMeta, useStore, useNetworksMeta } from '../../store'
import { accountSort } from '../../../resources/domain/account'
import { getSignerDisplayType } from '../../../resources/domain/signer'
import Address from '../../components/Address'
import StatusDot from '../../components/StatusDot'

interface AccountListProps {
  onAdd: () => void
}

export default function AccountList({ onAdd }: AccountListProps) {
  const accounts = useAccounts()
  const signers = useSigners()
  const accountsMeta = useAccountsMeta()
  const selectedAccount = useStore((s) => s.selectedAccount)
  const setSelectedAccount = useStore((s) => s.setSelectedAccount)

  const sortedAccounts = useMemo(() => {
    return Object.values(accounts).sort(accountSort)
  }, [accounts])

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Accounts</h2>
        <button
          onClick={onAdd}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors px-2 py-1 rounded hover:bg-gray-800"
        >
          + Add
        </button>
      </div>

      {sortedAccounts.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No accounts yet
        </div>
      ) : (
        sortedAccounts.map((account: any) => {
          const signer = account.signer ? signers[account.signer] : null
          const signerStatus = signer?.status ?? 'disconnected'
          const signerType = signer ? getSignerDisplayType(signer.type) : 'watch'
          const metaId = Object.keys(accountsMeta).find((key) => {
            const meta = accountsMeta[key]
            return meta?.name && account.name === meta.name
          })
          const displayName = metaId ? accountsMeta[metaId]?.name : account.name
          const isSelected = selectedAccount === account.id

          return (
            <button
              key={account.id}
              onClick={() => setSelectedAccount(account.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                isSelected
                  ? 'bg-gray-800 border border-gray-700'
                  : 'hover:bg-gray-800/50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <StatusDot status={signerStatus} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-100 truncate">
                      {displayName || 'Account'}
                    </span>
                    <span className="text-xs text-gray-500 capitalize">{signerType}</span>
                  </div>
                  <Address address={account.id} className="text-xs text-gray-500" />
                </div>
              </div>
            </button>
          )
        })
      )}
    </div>
  )
}
