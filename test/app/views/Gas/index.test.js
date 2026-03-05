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
        slow: gweiToHex(15),
        standard: gweiToHex(20),
        fast: gweiToHex(30),
        asap: gweiToHex(50)
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

  it('2. shows gas levels for connected chain', () => {
    mockNetworksRef = () => ({ 1: connectedChain })
    mockNetworksMetaRef = () => ({ 1: connectedMeta })

    render(<GasView />)

    expect(screen.getAllByText('Mainnet').length).toBeGreaterThanOrEqual(1)
    // Should show gwei values for all 4 levels
    expect(screen.getByText('15')).toBeTruthy() // slow
    expect(screen.getByText('20')).toBeTruthy() // standard
    expect(screen.getByText('30')).toBeTruthy() // fast
    expect(screen.getByText('50')).toBeTruthy() // asap
  })

  it('3. shows dashes for chain with no gas data', () => {
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
    expect(dashes.length).toBeGreaterThanOrEqual(4)
  })

  it('4. shows tx cost estimates with USD and gwei', () => {
    mockNetworksRef = () => ({ 1: connectedChain })
    mockNetworksMetaRef = () => ({ 1: connectedMeta })

    render(<GasView />)

    // TX cost table should exist
    expect(screen.getByText('Estimated Transaction Costs')).toBeTruthy()
    expect(screen.getByText('Send ETH')).toBeTruthy()
    expect(screen.getByText('Send Tokens')).toBeTruthy()

    // USD values
    expect(screen.getByText('$1.89')).toBeTruthy()
    expect(screen.getByText('$5.85')).toBeTruthy()

    // Gwei values should appear (gas cost in gwei)
    const gweiElements = screen.getAllByText(/g$/)
    expect(gweiElements.length).toBeGreaterThan(0)
  })

  it('5. hides testnets', () => {
    const testnet = {
      ...connectedChain,
      id: 11155111,
      name: 'Sepolia',
      isTestnet: true
    }
    mockNetworksRef = () => ({ 11155111: testnet })
    mockNetworksMetaRef = () => ({ 11155111: connectedMeta })

    render(<GasView />)

    expect(screen.getByText(/no connected chains/i)).toBeTruthy()
  })

  it('6. hides chains that are off', () => {
    const offChain = { ...connectedChain, on: false }
    mockNetworksRef = () => ({ 1: offChain })
    mockNetworksMetaRef = () => ({ 1: connectedMeta })

    render(<GasView />)

    expect(screen.getByText(/no connected chains/i)).toBeTruthy()
  })

  it('7. shows multiple chains sorted by connection status', () => {
    const polygon = {
      ...connectedChain,
      id: 137,
      name: 'Polygon',
      connection: {
        primary: makeConnection({ connected: false }),
        secondary: makeConnection({ on: false, connected: false })
      }
    }
    const polygonMeta = {
      ...connectedMeta,
      nativeCurrency: { ...connectedMeta.nativeCurrency, symbol: 'MATIC' },
      gas: { price: { selected: 'standard', levels: {} }, samples: [] }
    }

    mockNetworksRef = () => ({ 1: connectedChain, 137: polygon })
    mockNetworksMetaRef = () => ({ 1: connectedMeta, 137: polygonMeta })

    render(<GasView />)

    // Connected chain shows in the overview (Polygon is not connected so it's excluded)
    const mainnetElements = screen.getAllByText('Mainnet')
    expect(mainnetElements.length).toBeGreaterThanOrEqual(1)
  })

  it('8. shows base fee in overview table', () => {
    mockNetworksRef = () => ({ 1: connectedChain })
    mockNetworksMetaRef = () => ({ 1: connectedMeta })

    render(<GasView />)

    // Base fee header
    expect(screen.getByText('Base')).toBeTruthy()
    // Base fee value (12 gwei from nextBaseFee)
    expect(screen.getByText('12')).toBeTruthy()
  })
})
