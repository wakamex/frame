import { useSigners, useSavedSigners } from '../../store'
import { getSignerDisplayType } from '../../../resources/domain/signer'
import StatusDot from '../../components/StatusDot'

interface SignerListProps {
  selectedSigner: string | null
  onSelect: (id: string) => void
}

export default function SignerList({ selectedSigner, onSelect }: SignerListProps) {
  const signers = useSigners()
  const savedSigners = useSavedSigners()

  // Merge live signers with saved signers for display
  const allSigners = { ...savedSigners }
  for (const [id, signer] of Object.entries(signers)) {
    allSigners[id] = { ...(allSigners[id] || {}), ...signer, live: true }
  }

  const signerList = Object.entries(allSigners)

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">Signers</h2>

      {signerList.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No signers detected
        </div>
      ) : (
        signerList.map(([id, signer]: [string, any]) => {
          const signerType = getSignerDisplayType(signer.type || '')
          const status = signer.status || 'disconnected'
          const addressCount = signer.addresses?.length ?? 0
          const isSelected = selectedSigner === id

          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                isSelected
                  ? 'bg-gray-800 border border-gray-700'
                  : 'hover:bg-gray-800/50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <StatusDot status={status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-100 capitalize">{signerType}</span>
                    <span className="text-xs text-gray-500">{signer.name || ''}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {addressCount} {addressCount === 1 ? 'address' : 'addresses'} &middot; {status}
                  </div>
                </div>
              </div>
            </button>
          )
        })
      )}
    </div>
  )
}
