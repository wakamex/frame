/**
 * @jest-environment jsdom
 */
import { render, screen, act, waitFor } from '../../../componentSetup'
import ChainsView from '../../../../app/views/Chains/index'
import ChainDiscovery from '../../../../app/views/Chains/ChainDiscovery'

// --- Mock IPC ---
const mockSendAction = jest.fn()
const mockFetchChainlist = jest.fn()
const mockAddChain = jest.fn()
const mockOpenExplorer = jest.fn()

jest.mock('../../../../app/ipc', () => ({
  sendAction: (...args) => mockSendAction(...args),
  actions: {
    fetchChainlist: (...args) => mockFetchChainlist(...args),
    addChain: (...args) => mockAddChain(...args),
    openExplorer: (...args) => mockOpenExplorer(...args)
  }
}))

// --- Mock store hooks ---
const mockNetworks = {}
const mockNetworksMeta = {}

jest.mock('../../../../app/store', () => ({
  useNetworks: () => mockNetworksRef(),
  useNetworksMeta: () => mockNetworksMetaRef()
}))

// Use refs so we can mutate per-test
let mockNetworksRef = () => mockNetworks
let mockNetworksMetaRef = () => mockNetworksMeta

// --- Mock useCompact ---
let mockCompactValue = false
jest.mock('../../../../app/hooks/useCompact', () => ({
  useCompact: () => mockCompactValue
}))

// --- Mock utility functions ---
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
  roundGwei: (gwei) => Math.round(gwei)
}))

// --- Shared mock data ---

function makeConnection(overrides = {}) {
  return {
    on: true,
    current: 'infura',
    status: 'connected',
    connected: true,
    custom: '',
    type: 'ethereum',
    network: '1',
    ...overrides
  }
}

function makeChain(id, overrides = {}) {
  return {
    id,
    type: 'ethereum',
    name: `Chain ${id}`,
    isTestnet: false,
    on: true,
    explorer: `https://explorer${id}.com`,
    connection: {
      primary: makeConnection({ network: String(id) }),
      secondary: makeConnection({ network: String(id), connected: false, on: false })
    },
    ...overrides
  }
}

function makeChainMeta(overrides = {}) {
  return {
    blockHeight: 12345678,
    primaryColor: '#627EEA',
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ether',
      icon: '',
      decimals: 18,
      usd: { price: 2000, change24hr: 1.5 }
    },
    gas: {
      price: {
        selected: 'fast',
        levels: {
          slow: '0x3B9ACA00',    // 1 gwei
          standard: '0x77359400', // 2 gwei
          fast: '0xB2D05E00',    // 3 gwei
          asap: '0xEE6B2800',    // 4 gwei
          custom: '0x0'
        }
      }
    },
    ...overrides
  }
}

// Three chains: mainnet, L2, testnet
const ETHEREUM = makeChain('1', { name: 'Ethereum', isTestnet: false })
const POLYGON = makeChain('137', { name: 'Polygon', isTestnet: false })
const GOERLI = makeChain('5', { name: 'Goerli', isTestnet: true })

const ETHEREUM_META = makeChainMeta({ primaryColor: '#627EEA' })
const POLYGON_META = makeChainMeta({ primaryColor: '#8247E5' })
const GOERLI_META = makeChainMeta()

const TEST_NETWORKS = { '1': ETHEREUM, '137': POLYGON, '5': GOERLI }
const TEST_NETWORKS_META = { '1': ETHEREUM_META, '137': POLYGON_META, '5': GOERLI_META }

// --- ChainsView Tests ---

describe('ChainsView', () => {
  beforeEach(() => {
    mockNetworksRef = () => TEST_NETWORKS
    mockNetworksMetaRef = () => TEST_NETWORKS_META
    mockCompactValue = false
    mockSendAction.mockReset()
    mockOpenExplorer.mockReset()
  })

  it('1. renders chain list sorted mainnets first then by name', () => {
    render(<ChainsView />)
    const items = screen.getAllByRole('button', { name: /ethereum|polygon|goerli/i })
    // Find all chain name text elements
    const allText = screen.getAllByText(/Ethereum|Polygon|Goerli/)
    const names = allText.map((el) => el.textContent)
    // Ethereum and Polygon (mainnets) should appear before Goerli (testnet)
    const ethereumIdx = names.findIndex((n) => n === 'Ethereum')
    const polygonIdx = names.findIndex((n) => n === 'Polygon')
    const goerliIdx = names.findIndex((n) => n === 'Goerli')
    expect(ethereumIdx).toBeLessThan(goerliIdx)
    expect(polygonIdx).toBeLessThan(goerliIdx)
  })

  it('2. shows testnet badge for test networks', () => {
    render(<ChainsView />)
    expect(screen.getByText('test')).toBeDefined()
    // Mainnet chains should not have the badge
    const testBadges = screen.queryAllByText('test')
    expect(testBadges).toHaveLength(1)
  })

  it('3. chain toggle calls sendAction with activateNetwork', async () => {
    const { user } = render(<ChainsView />)
    // Each chain row has a toggle button (inner button) - find Ethereum's toggle
    // The chain row is a button that selects, the toggle is an inner button
    // We click the toggle for Ethereum (chain id 1, currently on=true)
    const toggles = screen.getAllByRole('button').filter(
      (btn) => btn.className && btn.className.includes('rounded-full')
    )
    expect(toggles.length).toBeGreaterThan(0)
    await user.click(toggles[0])
    expect(mockSendAction).toHaveBeenCalledWith('activateNetwork', 'ethereum', expect.any(Number), false)
  })

  it('4. selecting a chain shows detail panel', async () => {
    const { user } = render(<ChainsView />)
    const ethereumBtn = screen.getByText('Ethereum').closest('button')
    await user.click(ethereumBtn)
    // Detail panel should show chain name as heading
    expect(screen.getByRole('heading', { name: 'Ethereum' })).toBeDefined()
    expect(screen.getByText(/Chain ID:/)).toBeDefined()
  })

  it('5. detail panel shows RPC connection status', async () => {
    const { user } = render(<ChainsView />)
    const ethereumBtn = screen.getByText('Ethereum').closest('button')
    await user.click(ethereumBtn)
    expect(screen.getByText('Primary')).toBeDefined()
    expect(screen.getByText('Secondary')).toBeDefined()
  })

  it('6. detail panel shows gas prices', async () => {
    const { user } = render(<ChainsView />)
    const ethereumBtn = screen.getByText('Ethereum').closest('button')
    await user.click(ethereumBtn)
    // Gas section should show the level labels
    expect(screen.getByText('slow')).toBeDefined()
    expect(screen.getByText('fast')).toBeDefined()
    expect(screen.getByText('asap')).toBeDefined()
  })

  it('7. explorer button calls openExplorer', async () => {
    const { user } = render(<ChainsView />)
    const ethereumBtn = screen.getByText('Ethereum').closest('button')
    await user.click(ethereumBtn)
    const explorerBtn = screen.getByText('Open Explorer')
    await user.click(explorerBtn)
    expect(mockOpenExplorer).toHaveBeenCalledWith({ type: 'ethereum', id: 1 })
  })

  it('8. compact mode shows only list (no detail) when no chain selected', () => {
    mockCompactValue = true
    render(<ChainsView />)
    expect(screen.getByText('Ethereum')).toBeDefined()
    // No detail panel heading expected
    expect(screen.queryByRole('heading', { name: 'Ethereum' })).toBeNull()
  })

  it('8b. compact mode shows only detail when chain is selected', async () => {
    mockCompactValue = true
    const { user } = render(<ChainsView />)
    const ethereumBtn = screen.getByText('Ethereum').closest('button')
    await user.click(ethereumBtn)
    // Should now show detail, back button visible
    expect(screen.getByText(/All Networks/)).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Ethereum' })).toBeDefined()
  })
})

// --- ChainDiscovery Tests ---

const CHAINLIST_DATA = [
  { chainId: 1, name: 'Ethereum', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpc: ['https://mainnet.infura.io/v3/key'], explorers: [{ name: 'etherscan', url: 'https://etherscan.io' }], testnet: false },
  { chainId: 137, name: 'Polygon', nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }, rpc: ['https://rpc-mainnet.matic.network'], explorers: [], testnet: false },
  { chainId: 5, name: 'Goerli', nativeCurrency: { name: 'Goerli Ether', symbol: 'GOR', decimals: 18 }, rpc: ['https://rpc.goerli.mudit.blog'], explorers: [], testnet: true },
  { chainId: 10, name: 'Optimism', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpc: ['https://mainnet.optimism.io'], explorers: [], testnet: false },
  { chainId: 42161, name: 'Arbitrum One', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpc: ['https://arb1.arbitrum.io/rpc'], explorers: [], testnet: false }
]

// Generate 60 chains for the "max 50 results" test
const LARGE_CHAINLIST = Array.from({ length: 60 }, (_, i) => ({
  chainId: 9000 + i,
  name: `TestChain ${9000 + i}`,
  nativeCurrency: { name: 'Token', symbol: 'TKN', decimals: 18 },
  rpc: [`https://rpc${i}.example.com`],
  explorers: [],
  testnet: false
}))

describe('ChainDiscovery', () => {
  beforeEach(() => {
    mockNetworksRef = () => ({ '1': ETHEREUM }) // only Ethereum is "existing"
    mockFetchChainlist.mockReset()
    mockAddChain.mockReset()
  })

  it('9. renders search input', async () => {
    mockFetchChainlist.mockResolvedValue(CHAINLIST_DATA)
    render(<ChainDiscovery open={true} onClose={jest.fn()} />)
    await act(async () => { jest.runAllTimers() })
    expect(screen.getByPlaceholderText(/search by name or chain id/i)).toBeDefined()
  })

  it('10. search by name filters results correctly', async () => {
    mockFetchChainlist.mockResolvedValue(CHAINLIST_DATA)
    const { user } = render(<ChainDiscovery open={true} onClose={jest.fn()} />)
    await act(async () => { jest.runAllTimers() })
    await waitFor(() => expect(screen.getByText('Ethereum')).toBeDefined())

    const input = screen.getByPlaceholderText(/search by name or chain id/i)
    await user.type(input, 'optim')
    expect(screen.getByText('Optimism')).toBeDefined()
    expect(screen.queryByText('Ethereum')).toBeNull()
    expect(screen.queryByText('Polygon')).toBeNull()
  })

  it('11. search by chain ID filters results correctly', async () => {
    mockFetchChainlist.mockResolvedValue(CHAINLIST_DATA)
    const { user } = render(<ChainDiscovery open={true} onClose={jest.fn()} />)
    await act(async () => { jest.runAllTimers() })
    await waitFor(() => expect(screen.getByText('Ethereum')).toBeDefined())

    const input = screen.getByPlaceholderText(/search by name or chain id/i)
    await user.type(input, '137')
    expect(screen.getByText('Polygon')).toBeDefined()
    expect(screen.queryByText('Ethereum')).toBeNull()
  })

  it('12. shows Added badge for chains already in config', async () => {
    mockFetchChainlist.mockResolvedValue(CHAINLIST_DATA)
    render(<ChainDiscovery open={true} onClose={jest.fn()} />)
    await act(async () => { jest.runAllTimers() })
    await waitFor(() => expect(screen.getByText('Ethereum')).toBeDefined())

    // Chain ID 1 (Ethereum) is already in networks
    const addedBadges = screen.getAllByText('Added')
    expect(addedBadges.length).toBeGreaterThanOrEqual(1)
  })

  it('13. shows Add button for chains not in config', async () => {
    mockFetchChainlist.mockResolvedValue(CHAINLIST_DATA)
    render(<ChainDiscovery open={true} onClose={jest.fn()} />)
    await act(async () => { jest.runAllTimers() })
    await waitFor(() => expect(screen.getByText('Polygon')).toBeDefined())

    // Polygon (137) is not in networks
    const addButtons = screen.getAllByRole('button', { name: 'Add' })
    expect(addButtons.length).toBeGreaterThan(0)
  })

  it('14. clicking Add calls actions.addChain with correct data', async () => {
    mockFetchChainlist.mockResolvedValue(CHAINLIST_DATA)
    const { user } = render(<ChainDiscovery open={true} onClose={jest.fn()} />)
    await act(async () => { jest.runAllTimers() })
    await waitFor(() => expect(screen.getByText('Polygon')).toBeDefined())

    // Click Add for Polygon
    const addButtons = screen.getAllByRole('button', { name: 'Add' })
    await user.click(addButtons[0])

    expect(mockAddChain).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(Number),
        type: 'ethereum',
        name: expect.any(String)
      })
    )
  })

  it('15. shows max 50 results', async () => {
    mockFetchChainlist.mockResolvedValue(LARGE_CHAINLIST)
    render(<ChainDiscovery open={true} onClose={jest.fn()} />)
    await act(async () => { jest.runAllTimers() })
    await waitFor(() => expect(screen.getByText('TestChain 9000')).toBeDefined())

    // Count rendered chain rows by looking for TestChain names
    const chainNames = screen.getAllByText(/^TestChain \d+$/)
    expect(chainNames.length).toBeLessThanOrEqual(50)
    expect(chainNames.length).toBe(50)
  })
})
