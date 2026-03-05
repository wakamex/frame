/**
 * @jest-environment jsdom
 */
import { render, screen } from '../../../componentSetup'
import GasView from '../../../../app/views/Gas/index'

// --- Mock store hooks ---
let mockNetworksRef = () => ({})
let mockNetworksMetaRef = () => ({})

jest.mock('../../../../app/store', () => ({
  useNetworks: () => mockNetworksRef(),
  useNetworksMeta: () => mockNetworksMetaRef()
}))

jest.mock('../../../../resources/utils/chains', () => ({
  isNetworkConnected: (chain) => {
    return !!(
      (chain.connection?.primary && chain.connection.primary.connected) ||
      (chain.connection?.secondary && chain.connection.secondary.connected)
    )
  }
}))

jest.mock('../../../../resources/utils', () => ({
  weiToGwei: (wei) => wei / 1e9,
  hexToInt: (hex) => parseInt(hex, 16),
  roundGwei: (gwei) => Math.round(gwei * 100) / 100
}))

// --- Helpers ---

function makeConnection(overrides = {}) {
  return {
    on: true,
    current: 'public',
    status: 'connected',
    connected: true,
    custom: '',
    ...overrides
  }
}

function gweiToHex(gwei) {
  return '0x' + (gwei * 1e9).toString(16)
}

const connectedChain = {
  id: 1,
  name: 'Mainnet',
  on: true,
  isTestnet: false,
  connection: {
    primary: makeConnection(),
    secondary: makeConnection({ on: false, connected: false })
  }
}

const connectedMeta = {
  blockHeight: 19000000,
  primaryColor: '#627eea',
  nativeCurrency: { symbol: 'ETH', name: 'Ether', decimals: 18, icon: '', usd: { price: 3000, change24hr: 1.5 } },
  gas: {
    price: {
      selected: 'fast',
      levels: {
        fast: gweiToHex(30)
      },
      fees: {
        nextBaseFee: gweiToHex(12),
        maxBaseFeePerGas: gweiToHex(15),
        maxPriorityFeePerGas: gweiToHex(2),
        maxFeePerGas: gweiToHex(17)
      }
    },
    samples: [
      {
        label: 'Send ETH',
        estimates: {
          low: { gasEstimate: '0x' + (21000 * 30e9).toString(16), cost: { usd: 1.89 } },
          high: { gasEstimate: '0x' + (21000 * 30e9).toString(16), cost: { usd: 1.89 } }
        }
      },
      {
        label: 'Send Tokens',
        estimates: {
          low: { gasEstimate: '0x' + (65000 * 30e9).toString(16), cost: { usd: 5.85 } },
          high: { gasEstimate: '0x' + (65000 * 30e9).toString(16), cost: { usd: 5.85 } }
        }
      }
    ]
  }
}

beforeEach(() => {
  mockNetworksRef = () => ({})
  mockNetworksMetaRef = () => ({})
})

describe('GasView', () => {
  it('1. shows empty state when no chains are connected', () => {
    render(<GasView />)
    expect(screen.getByText(/no connected chains/i)).toBeTruthy()
  })

  it('2. shows gas price for connected chain', () => {
    mockNetworksRef = () => ({ 1: connectedChain })
    mockNetworksMetaRef = () => ({ 1: connectedMeta })

    render(<GasView />)

    expect(screen.getAllByText('Mainnet').length).toBeGreaterThanOrEqual(1)
    // Should show single gas price (30 gwei)
    expect(screen.getByText('30')).toBeTruthy()
  })

  it('3. shows base fee and priority fee columns', () => {
    mockNetworksRef = () => ({ 1: connectedChain })
    mockNetworksMetaRef = () => ({ 1: connectedMeta })

    render(<GasView />)

    expect(screen.getByText('Gas Price')).toBeTruthy()
    expect(screen.getByText('Base')).toBeTruthy()
    expect(screen.getByText('Priority')).toBeTruthy()
    // Base fee = 12 gwei, priority = 2 gwei
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('4. shows dashes for chain with no gas data', () => {
    const emptyMeta = {
      ...connectedMeta,
      gas: {
        price: {
          selected: 'standard',
          levels: { slow: '', standard: '', fast: '', asap: '' }
        },
        samples: []
      }
    }
    mockNetworksRef = () => ({ 1: connectedChain })
    mockNetworksMetaRef = () => ({ 1: emptyMeta })

    render(<GasView />)

    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(3)
  })

  it('5. shows tx cost estimates with USD and gwei', () => {
    mockNetworksRef = () => ({ 1: connectedChain })
    mockNetworksMetaRef = () => ({ 1: connectedMeta })

    render(<GasView />)

    expect(screen.getByText('Estimated Transaction Costs')).toBeTruthy()
    expect(screen.getByText('Send ETH')).toBeTruthy()
    expect(screen.getByText('Send Tokens')).toBeTruthy()

    expect(screen.getByText('$1.89')).toBeTruthy()
    expect(screen.getByText('$5.85')).toBeTruthy()

    // Gwei values in tx cost table
    const gweiElements = screen.getAllByText(/g$/)
    expect(gweiElements.length).toBeGreaterThan(0)
  })

  it('6. hides testnets', () => {
    const testnet = { ...connectedChain, id: 11155111, name: 'Sepolia', isTestnet: true }
    mockNetworksRef = () => ({ 11155111: testnet })
    mockNetworksMetaRef = () => ({ 11155111: connectedMeta })

    render(<GasView />)

    expect(screen.getByText(/no connected chains/i)).toBeTruthy()
  })

  it('7. hides chains that are off', () => {
    const offChain = { ...connectedChain, on: false }
    mockNetworksRef = () => ({ 1: offChain })
    mockNetworksMetaRef = () => ({ 1: connectedMeta })

    render(<GasView />)

    expect(screen.getByText(/no connected chains/i)).toBeTruthy()
  })
})
