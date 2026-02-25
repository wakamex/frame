import { useState } from 'react'
import { actions } from '../ipc'
import { ADDRESS_DISPLAY_CHARS } from '../../resources/constants'
import { getAddress } from '../../resources/utils'

interface AddressProps {
  address: string
  full?: boolean
  className?: string
}

export default function Address({ address, full, className = '' }: AddressProps) {
  const [copied, setCopied] = useState(false)

  const checksummed = getAddress(address)
  const display = full
    ? checksummed
    : `${checksummed.slice(0, ADDRESS_DISPLAY_CHARS + 2)}...${checksummed.slice(-ADDRESS_DISPLAY_CHARS)}`

  const copy = () => {
    actions.clipboardData(checksummed)
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }

  return (
    <button
      onClick={copy}
      className={`font-mono text-sm cursor-pointer hover:text-gray-200 transition-colors ${className}`}
      title={copied ? 'Copied!' : checksummed}
    >
      {copied ? (
        <span className="text-green-400">Copied</span>
      ) : (
        display
      )}
    </button>
  )
}
