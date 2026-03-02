import { useState } from 'react'
import { useSigners, useSavedSigners } from '../../store'
import { actions } from '../../ipc'
import { getSignerDisplayType, isHardwareSigner } from '../../../resources/domain/signer'
import Address from '../../components/Address'
import StatusDot from '../../components/StatusDot'
import Modal from '../../components/Modal'

interface SignerDetailProps {
  signerId: string | null
}

export default function SignerDetail({ signerId }: SignerDetailProps) {
  const signers = useSigners()
  const savedSigners = useSavedSigners()
  const [password, setPassword] = useState('')
  const [unlockError, setUnlockError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)

  if (!signerId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Select a signer to view details
      </div>
    )
  }

  const signer = signers[signerId] || savedSigners[signerId]
  if (!signer) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Signer not found
      </div>
    )
  }

  const signerType = getSignerDisplayType(signer.type || '')
  const status = signer.status || 'disconnected'
  const isHardware = isHardwareSigner(signer.type || '')
  const isLocked = status === 'locked'
  const isReady = status === 'ok'
  const addresses = signer.addresses || []

  const handleUnlock = async () => {
    setUnlockError('')
    try {
      await actions.unlockSigner(signerId, password)
      setPassword('')
    } catch (err: any) {
      setUnlockError(err?.message || 'Failed to unlock')
    }
  }

  const handleLock = async () => {
    try {
      await actions.lockSigner(signerId)
    } catch (err: any) {
      console.error('Failed to lock signer:', err)
    }
  }

  const handleRemove = () => {
    actions.removeSigner(signerId)
    setConfirmRemove(false)
  }

  const handleReload = () => {
    actions.reloadSigner(signerId)
  }

  const handleVerify = () => {
    actions.verifyAddress()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <StatusDot status={status} />
          <h2 className="text-lg font-semibold text-gray-100 capitalize">{signerType}</h2>
          <span className="text-xs text-gray-500 capitalize">{status}</span>
        </div>
        {signer.name && (
          <div className="text-sm text-gray-400">{signer.name}</div>
        )}
        {signer.model && (
          <div className="text-xs text-gray-500">{signer.model}</div>
        )}
      </div>

      {/* Unlock (hot signers only) */}
      {!isHardware && isLocked && (
        <section>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Unlock</h3>
          <form
            onSubmit={(e) => { e.preventDefault(); handleUnlock() }}
            className="flex gap-2"
          >
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-600"
            />
            <button
              type="submit"
              disabled={!password}
              className="px-4 py-2 text-sm bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 disabled:opacity-40 transition-colors"
            >
              Unlock
            </button>
          </form>
          {unlockError && <p className="text-red-400 text-xs mt-1">{unlockError}</p>}
        </section>
      )}

      {/* Addresses */}
      <section>
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Addresses ({addresses.length})
        </h3>
        {addresses.length === 0 ? (
          <div className="text-sm text-gray-500 py-3">No addresses available</div>
        ) : (
          <div className="space-y-1">
            {addresses.map((addr: string, i: number) => (
              <div key={addr} className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-800/50">
                <span className="text-xs text-gray-600 w-6">{i + 1}</span>
                <Address address={addr} className="text-gray-300" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Actions */}
      <section className="flex flex-wrap gap-2 pt-2 border-t border-gray-800">
        {!isHardware && isReady && (
          <button
            onClick={handleLock}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 rounded hover:bg-gray-800 transition-colors"
          >
            Lock
          </button>
        )}
        {isHardware && (
          <button
            onClick={handleReload}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 rounded hover:bg-gray-800 transition-colors"
          >
            Reload
          </button>
        )}
        {isHardware && isReady && (
          <button
            onClick={handleVerify}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 rounded hover:bg-gray-800 transition-colors"
          >
            Verify Address
          </button>
        )}
        <button
          onClick={() => setConfirmRemove(true)}
          className="px-3 py-1.5 text-xs text-red-400/70 hover:text-red-400 rounded hover:bg-gray-800 transition-colors"
        >
          Remove
        </button>
      </section>

      <Modal open={confirmRemove} onClose={() => setConfirmRemove(false)} title="Remove Signer">
        <p className="text-sm text-gray-300 mb-4">
          Remove this {signerType} signer? Associated accounts will lose their signer connection.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setConfirmRemove(false)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 rounded">Cancel</button>
          <button onClick={handleRemove} className="px-3 py-1.5 text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded">Remove</button>
        </div>
      </Modal>
    </div>
  )
}
