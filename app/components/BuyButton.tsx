import { useState, useEffect, useRef } from 'react'
import { actions } from '../ipc'

interface BuyButtonProps {
  address: string
  chainId?: number
}

interface Provider {
  name: string
  buildUrl: (address: string, chainId?: number) => string
}

const CHAIN_ASSETS_RAMP: Record<number, string> = {
  137: 'MATIC_MATIC',
  42161: 'ARBITRUM_ETH',
  10: 'OPTIMISM_ETH',
  8453: 'BASE_ETH'
}

const CHAIN_NETWORKS_TRANSAK: Record<number, string> = {
  137: 'polygon',
  42161: 'arbitrum',
  10: 'optimism',
  8453: 'base'
}

const providers: Provider[] = [
  {
    name: 'Ramp Network',
    buildUrl(address, chainId) {
      let url = `https://app.ramp.network/?userAddress=${address}&hostAppName=Frame`
      if (chainId && CHAIN_ASSETS_RAMP[chainId]) {
        url += `&defaultAsset=${CHAIN_ASSETS_RAMP[chainId]}`
      }
      return url
    }
  },
  {
    name: 'MoonPay',
    buildUrl(address) {
      return `https://buy.moonpay.com/?currencyCode=eth&walletAddress=${address}&baseCurrencyCode=usd`
    }
  },
  {
    name: 'Transak',
    buildUrl(address, chainId) {
      let url = `https://global.transak.com/?cryptoCurrencyCode=ETH&walletAddress=${address}&disableWalletAddressForm=true`
      if (chainId && CHAIN_NETWORKS_TRANSAK[chainId]) {
        url += `&network=${CHAIN_NETWORKS_TRANSAK[chainId]}`
      }
      return url
    }
  }
]

export default function BuyButton({ address, chainId }: BuyButtonProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSelect = (provider: Provider) => {
    actions.openExternal(provider.buildUrl(address, chainId))
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1.5 text-sm rounded bg-green-600 hover:bg-green-500 text-white transition-colors"
      >
        Buy
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-gray-900 border border-gray-800 rounded-lg shadow-xl z-50 py-1">
          {providers.map((p) => (
            <button
              key={p.name}
              onClick={() => handleSelect(p)}
              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-gray-100 transition-colors"
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
