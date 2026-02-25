import { useState } from 'react'
import { useCompact } from '../../hooks/useCompact'
import SignerList from './SignerList'
import SignerDetail from './SignerDetail'

export default function SignersView() {
  const [selectedSigner, setSelectedSigner] = useState<string | null>(null)
  const compact = useCompact()

  if (compact) {
    if (selectedSigner) {
      return (
        <div className="h-full overflow-y-auto">
          <button
            onClick={() => setSelectedSigner(null)}
            className="text-xs text-gray-500 hover:text-gray-300 mb-3"
          >
            &larr; All Signers
          </button>
          <SignerDetail signerId={selectedSigner} />
        </div>
      )
    }
    return (
      <div className="h-full overflow-y-auto">
        <SignerList selectedSigner={selectedSigner} onSelect={setSelectedSigner} />
      </div>
    )
  }

  return (
    <div className="flex gap-6 h-full">
      <div className="w-72 shrink-0 overflow-y-auto">
        <SignerList
          selectedSigner={selectedSigner}
          onSelect={setSelectedSigner}
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        <SignerDetail signerId={selectedSigner} />
      </div>
    </div>
  )
}
