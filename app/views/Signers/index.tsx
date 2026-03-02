import { useState } from 'react'
import SignerList from './SignerList'
import SignerDetail from './SignerDetail'

export default function SignersView() {
  const [selectedSigner, setSelectedSigner] = useState<string | null>(null)

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
