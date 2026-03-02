import { useState } from 'react'
import { actions } from '../../ipc'

type AccountType = 'phrase' | 'privateKey' | 'keystore' | 'address' | 'ledger' | 'trezor' | 'lattice'

interface AddAccountProps {
  onClose: () => void
}

export default function AddAccount({ onClose }: AddAccountProps) {
  const [accountType, setAccountType] = useState<AccountType | null>(null)

  if (!accountType) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold text-gray-100">Add Account</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-sm">Cancel</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {([
            { type: 'phrase' as const, label: 'Seed Phrase', desc: 'Import from mnemonic' },
            { type: 'privateKey' as const, label: 'Private Key', desc: 'Import a private key' },
            { type: 'keystore' as const, label: 'Keystore', desc: 'Import a keystore file' },
            { type: 'address' as const, label: 'Watch Address', desc: 'Watch-only account' },
            { type: 'ledger' as const, label: 'Ledger', desc: 'Connect Ledger device' },
            { type: 'trezor' as const, label: 'Trezor', desc: 'Connect Trezor device' },
            { type: 'lattice' as const, label: 'Lattice', desc: 'Connect GridPlus Lattice' },
          ]).map(({ type, label, desc }) => (
            <button
              key={type}
              onClick={() => setAccountType(type)}
              className="text-left p-3 rounded-lg border border-gray-800 hover:border-gray-700 hover:bg-gray-800/50 transition-colors"
            >
              <div className="text-sm font-medium text-gray-200">{label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const handleBack = () => setAccountType(null)

  switch (accountType) {
    case 'phrase': return <PhraseForm onBack={handleBack} onDone={onClose} />
    case 'privateKey': return <PrivateKeyForm onBack={handleBack} onDone={onClose} />
    case 'keystore': return <KeystoreForm onBack={handleBack} onDone={onClose} />
    case 'address': return <WatchAddressForm onBack={handleBack} onDone={onClose} />
    case 'ledger':
    case 'trezor':
    case 'lattice':
      return <HardwareInfo type={accountType} onBack={handleBack} />
    default:
      return null
  }
}

function FormHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <button onClick={onBack} className="text-gray-500 hover:text-gray-300 text-sm">&larr; Back</button>
      <h3 className="text-base font-semibold text-gray-100">{title}</h3>
    </div>
  )
}

function PhraseForm({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [phrase, setPhrase] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setError('')
    setLoading(true)
    try {
      await actions.createFromPhrase(phrase.trim(), password)
      onDone()
    } catch (err: any) {
      setError(err?.message || 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <FormHeader title="Import Seed Phrase" onBack={onBack} />
      <textarea
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        placeholder="Enter your seed phrase..."
        rows={3}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-600 resize-none"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Create password"
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-600"
      />
      <input
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Confirm password"
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-600"
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        type="submit"
        disabled={loading || !phrase.trim() || !password}
        className="w-full py-2 rounded-lg text-sm font-medium bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Importing...' : 'Import'}
      </button>
    </form>
  )
}

function PrivateKeyForm({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [key, setKey] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setError('')
    setLoading(true)
    try {
      await actions.createFromPrivateKey(key.trim(), password)
      onDone()
    } catch (err: any) {
      setError(err?.message || 'Failed to import key')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <FormHeader title="Import Private Key" onBack={onBack} />
      <input
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="Enter private key"
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-600 font-mono"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Create password"
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-600"
      />
      <input
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Confirm password"
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-600"
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        type="submit"
        disabled={loading || !key.trim() || !password}
        className="w-full py-2 rounded-lg text-sm font-medium bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Importing...' : 'Import'}
      </button>
    </form>
  )
}

function KeystoreForm({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [keystore, setKeystore] = useState<any>(null)
  const [keystorePassword, setKeystorePassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLocate = async () => {
    try {
      const ks = await actions.locateKeystore()
      setKeystore(ks)
    } catch (err: any) {
      setError(err?.message || 'Failed to load keystore')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setError('')
    setLoading(true)
    try {
      await actions.createFromKeystore(keystore, password, keystorePassword)
      onDone()
    } catch (err: any) {
      setError(err?.message || 'Failed to import keystore')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <FormHeader title="Import Keystore" onBack={onBack} />
      {!keystore ? (
        <button
          type="button"
          onClick={handleLocate}
          className="w-full py-6 rounded-lg border border-dashed border-gray-700 text-sm text-gray-400 hover:border-gray-600 hover:text-gray-300 transition-colors"
        >
          Select Keystore File
        </button>
      ) : (
        <div className="text-sm text-green-400 py-2">Keystore loaded (v{keystore.version})</div>
      )}
      {keystore && (
        <>
          <input
            type="password"
            value={keystorePassword}
            onChange={(e) => setKeystorePassword(e.target.value)}
            placeholder="Keystore password"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-600"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create new password"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-600"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm new password"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-600"
          />
        </>
      )}
      {error && <p className="text-red-400 text-xs">{error}</p>}
      {keystore && (
        <button
          type="submit"
          disabled={loading || !keystorePassword || !password}
          className="w-full py-2 rounded-lg text-sm font-medium bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Importing...' : 'Import'}
        </button>
      )}
    </form>
  )
}

function WatchAddressForm({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [address, setAddress] = useState('')
  const [resolvedAddress, setResolvedAddress] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resolving, setResolving] = useState(false)

  const isEns = address.includes('.')

  const handleResolve = async () => {
    if (!isEns) return
    setResolving(true)
    try {
      const resolved = await actions.resolveEnsName(address)
      if (resolved) {
        setResolvedAddress(resolved)
        if (!name) setName(address)
      } else {
        setError('Could not resolve ENS name')
      }
    } catch (err: any) {
      setError(err?.message || 'ENS resolution failed')
    } finally {
      setResolving(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const addr = resolvedAddress || address
    try {
      await actions.createFromAddress(addr, name || 'Watch Account')
      onDone()
    } catch (err: any) {
      setError(err?.message || 'Failed to add address')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <FormHeader title="Watch Address" onBack={onBack} />
      <div className="flex gap-2">
        <input
          value={address}
          onChange={(e) => { setAddress(e.target.value); setResolvedAddress('') }}
          placeholder="0x... or ENS name"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-600 font-mono"
        />
        {isEns && !resolvedAddress && (
          <button
            type="button"
            onClick={handleResolve}
            disabled={resolving}
            className="px-3 py-2 text-sm bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-40"
          >
            {resolving ? '...' : 'Resolve'}
          </button>
        )}
      </div>
      {resolvedAddress && (
        <div className="text-xs text-gray-400 font-mono truncate">Resolved: {resolvedAddress}</div>
      )}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Account name (optional)"
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-600"
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        type="submit"
        disabled={loading || (!address && !resolvedAddress)}
        className="w-full py-2 rounded-lg text-sm font-medium bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Adding...' : 'Add'}
      </button>
    </form>
  )
}

function HardwareInfo({ type, onBack }: { type: string; onBack: () => void }) {
  const labels: Record<string, string> = {
    ledger: 'Ledger',
    trezor: 'Trezor',
    lattice: 'GridPlus Lattice'
  }

  return (
    <div className="space-y-4">
      <FormHeader title={`Connect ${labels[type]}`} onBack={onBack} />
      <div className="text-sm text-gray-400 space-y-2">
        <p>Connect your {labels[type]} device to your computer.</p>
        <p>Frame will automatically detect connected hardware wallets and display them in the Signers view.</p>
        <p className="text-gray-500 text-xs mt-4">
          Hardware wallet accounts will appear once the device is connected and unlocked.
        </p>
      </div>
    </div>
  )
}
