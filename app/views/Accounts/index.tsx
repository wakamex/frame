import { useState } from 'react'
import AccountList from './AccountList'
import AccountDetail from './AccountDetail'
import AddAccount from './AddAccount'

export default function AccountsView() {
  const [showAdd, setShowAdd] = useState(false)

  if (showAdd) {
    return <AddAccount onClose={() => setShowAdd(false)} />
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
