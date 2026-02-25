import { useState } from 'react'
import { useStore } from '../../store'
import { useCompact } from '../../hooks/useCompact'
import AccountList from './AccountList'
import AccountDetail from './AccountDetail'
import AddAccount from './AddAccount'

export default function AccountsView() {
  const [showAdd, setShowAdd] = useState(false)
  const compact = useCompact()
  const selectedAccount = useStore((s) => s.selectedAccount)

  if (showAdd) {
    return <AddAccount onClose={() => setShowAdd(false)} />
  }

  // On compact layout, show list or detail — not both
  if (compact) {
    if (selectedAccount) {
      return (
        <div className="h-full overflow-y-auto">
          <button
            onClick={() => useStore.getState().setSelectedAccount(null)}
            className="text-xs text-gray-500 hover:text-gray-300 mb-3"
          >
            &larr; All Accounts
          </button>
          <AccountDetail />
        </div>
      )
    }
    return (
      <div className="h-full overflow-y-auto">
        <AccountList onAdd={() => setShowAdd(true)} />
      </div>
    )
  }

  return (
    <div className="flex gap-6 h-full">
      <div className="w-72 shrink-0 overflow-y-auto">
        <AccountList onAdd={() => setShowAdd(true)} />
      </div>
      <div className="flex-1 overflow-y-auto">
        <AccountDetail />
      </div>
    </div>
  )
}
