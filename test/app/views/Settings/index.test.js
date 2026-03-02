/**
 * @jest-environment jsdom
 */
import { render, screen, act, waitFor, fireEvent } from '../../../componentSetup'
import SettingsView from '../../../../app/views/Settings/index'

// Mock IPC actions
const mockSyncPath = jest.fn()
const mockSendAction = jest.fn()
const mockRpc = jest.fn()
const mockSetGasAlert = jest.fn()
const mockToggleGasAlert = jest.fn()
const mockResetAllSettings = jest.fn()

jest.mock('../../../../app/ipc', () => ({
  actions: {
    syncPath: (...args) => mockSyncPath(...args),
    setGasAlert: (...args) => mockSetGasAlert(...args),
    toggleGasAlert: (...args) => mockToggleGasAlert(...args),
    resetAllSettings: (...args) => mockResetAllSettings(...args)
  },
  sendAction: (...args) => mockSendAction(...args),
  rpc: (...args) => mockRpc(...args)
}))

// Mock the store hooks
const mockMainState = {
  colorway: 'dark',
  launch: true,
  autohide: false,
  menubarGasPrice: false,
  showLocalNameWithENS: false,
  privacy: { errorReporting: true },
  ledger: { derivation: 'live', liveAccountLimit: 5 },
  trezor: { derivation: 'standard' },
  apiKeys: { etherscan: '', polygonscan: '', arbiscan: '' },
  shortcuts: {
    summon: { modifierKeys: ['Meta'], shortcutKey: 'F', enabled: true, configuring: false }
  },
  gasAlerts: {
    '1': { threshold: 20, enabled: true },
    '137': { threshold: 0, enabled: false }
  }
}

const mockNetworks = {
  '1': { id: 1, name: 'Ethereum', on: true, isTestnet: false },
  '137': { id: 137, name: 'Polygon', on: true, isTestnet: false },
  '5': { id: 5, name: 'Goerli', on: true, isTestnet: true },
  '10': { id: 10, name: 'Optimism', on: false, isTestnet: false }
}

const mockGasAlerts = {
  '1': { threshold: 20, enabled: true },
  '137': { threshold: 0, enabled: false }
}

let mockPlatform = 'linux'

jest.mock('../../../../app/store', () => ({
  useMainState: () => mockMainState,
  useNetworks: () => mockNetworks,
  useGasAlerts: () => mockGasAlerts,
  usePlatform: () => mockPlatform
}))

// Mock keyboard resource
jest.mock('../../../../resources/keyboard', () => ({
  getDisplayShortcut: () => ({ modifierKeys: ['⌘'], shortcutKey: 'F' }),
  getShortcutFromKeyEvent: jest.fn(),
  isShortcutKey: jest.fn(() => true)
}))

// Helper: find the toggle button associated with a label text
// Structure: <div class="flex..."><div><div>LABEL</div><div>desc</div></div><button>...</button></div>
function getToggleForLabel(labelText) {
  return screen.getByText(labelText).parentElement.nextElementSibling
}

beforeEach(() => {
  mockSyncPath.mockReset()
  mockSendAction.mockReset()
  mockRpc.mockReset()
  mockSetGasAlert.mockReset()
  mockToggleGasAlert.mockReset()
  mockResetAllSettings.mockReset()
  mockPlatform = 'linux'
})

describe('SettingsView', () => {
  it('renders all section headers', () => {
    render(<SettingsView />)
    expect(screen.getByText('Appearance')).toBeDefined()
    expect(screen.getByText('Behavior')).toBeDefined()
    expect(screen.getByText('Privacy')).toBeDefined()
    expect(screen.getByText('Hardware')).toBeDefined()
    expect(screen.getByText('API Keys')).toBeDefined()
    expect(screen.getByText('Gas Price Alerts')).toBeDefined()
  })

  it('renders the Keyboard Shortcut section', () => {
    render(<SettingsView />)
    expect(screen.getByText('Keyboard Shortcut')).toBeDefined()
    expect(screen.getByText('Summon Frame')).toBeDefined()
  })

  it('Dark Mode toggle calls syncPath with correct colorway', async () => {
    const { user } = render(<SettingsView />)
    // current colorway is 'dark', clicking should switch to 'light'
    await user.click(getToggleForLabel('Dark Mode'))
    expect(mockSyncPath).toHaveBeenCalledWith('main.colorway', 'light')
  })

  it('Run on Startup toggle calls syncPath with correct path', async () => {
    const { user } = render(<SettingsView />)
    // current launch is true, toggling should set to false
    await user.click(getToggleForLabel('Run on Startup'))
    expect(mockSyncPath).toHaveBeenCalledWith('main.launch', false)
  })

  it('Auto-hide toggle calls syncPath with correct path', async () => {
    const { user } = render(<SettingsView />)
    // current autohide is false, toggling should set to true
    await user.click(getToggleForLabel('Auto-hide'))
    expect(mockSyncPath).toHaveBeenCalledWith('main.autohide', true)
  })

  it('Error Reporting toggle calls syncPath with correct path', async () => {
    const { user } = render(<SettingsView />)
    // current errorReporting is true, toggling should set to false
    await user.click(getToggleForLabel('Error Reporting'))
    expect(mockSyncPath).toHaveBeenCalledWith('main.privacy.errorReporting', false)
  })

  it('Dark Mode toggle uses its own path, not startup path', async () => {
    const { user } = render(<SettingsView />)
    await user.click(getToggleForLabel('Dark Mode'))
    expect(mockSyncPath).not.toHaveBeenCalledWith('main.launch', expect.anything())
    expect(mockSyncPath).toHaveBeenCalledWith('main.colorway', expect.any(String))
  })

  it('Auto-hide uses its own path, not launch path', async () => {
    const { user } = render(<SettingsView />)
    await user.click(getToggleForLabel('Auto-hide'))
    expect(mockSyncPath).not.toHaveBeenCalledWith('main.launch', expect.anything())
    expect(mockSyncPath).toHaveBeenCalledWith('main.autohide', expect.any(Boolean))
  })

  it('Etherscan API key input calls syncPath on change', () => {
    render(<SettingsView />)
    const etherscanInput = screen.getAllByPlaceholderText('API key')[0]
    fireEvent.change(etherscanInput, { target: { value: 'my-api-key' } })
    expect(mockSyncPath).toHaveBeenCalledWith('main.apiKeys.etherscan', 'my-api-key')
  })

  it('Gas Alerts section renders chains that are on and not testnet', () => {
    render(<SettingsView />)
    // Ethereum and Polygon are on + not testnet
    expect(screen.getByText('Ethereum')).toBeDefined()
    expect(screen.getByText('Polygon')).toBeDefined()
    // Goerli is testnet — should not appear in Gas Alerts
    expect(screen.queryByText('Goerli')).toBeNull()
    // Optimism is off — should not appear
    expect(screen.queryByText('Optimism')).toBeNull()
  })

  it('Gas alert threshold change calls setGasAlert', () => {
    render(<SettingsView />)
    const thresholdInputs = screen.getAllByPlaceholderText('gwei')
    // First input is for Ethereum (chain id '1')
    fireEvent.change(thresholdInputs[0], { target: { value: '30' } })
    expect(mockSetGasAlert).toHaveBeenCalled()
    const lastCall = mockSetGasAlert.mock.calls[mockSetGasAlert.mock.calls.length - 1]
    expect(lastCall[0]).toBe('1')
    expect(lastCall[1]).toBe(30)
  })

  it('Gas alert toggle calls toggleGasAlert when alert exists', async () => {
    const { user } = render(<SettingsView />)
    // Ethereum chain (id 1) has an alert, clicking its toggle should call toggleGasAlert
    const gasSectionHeader = screen.getByText('Gas Price Alerts')
    const gasSection = gasSectionHeader.closest('section')
    const toggleButtons = gasSection.querySelectorAll('button')
    await user.click(toggleButtons[0])
    expect(mockToggleGasAlert).toHaveBeenCalledWith('1')
  })

  it('Reset All Settings button shows confirmation modal', async () => {
    const { user } = render(<SettingsView />)
    await user.click(screen.getByText('Reset All Settings'))
    expect(screen.getByText('Reset All Settings', { selector: 'h2' })).toBeDefined()
    expect(screen.getByText(/Are you sure/)).toBeDefined()
  })

  it('Reset modal Cancel closes without calling reset action', async () => {
    const { user } = render(<SettingsView />)
    await user.click(screen.getByText('Reset All Settings'))
    // Modal is open, click Cancel
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mockResetAllSettings).not.toHaveBeenCalled()
    // Modal should be closed
    expect(screen.queryByText(/Are you sure/)).toBeNull()
  })

  it('Reset modal Reset button calls resetAllSettings', async () => {
    const { user } = render(<SettingsView />)
    await user.click(screen.getByText('Reset All Settings'))
    // Click the Reset button in the modal
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(mockResetAllSettings).toHaveBeenCalledTimes(1)
  })

  it('Menubar Gas Price does not render on non-darwin platform', () => {
    mockPlatform = 'linux'
    render(<SettingsView />)
    expect(screen.queryByText('Menubar Gas Price')).toBeNull()
  })

  it('Menubar Gas Price renders on darwin platform', () => {
    mockPlatform = 'darwin'
    render(<SettingsView />)
    expect(screen.getByText('Menubar Gas Price')).toBeDefined()
  })

  it('Menubar Gas Price toggle calls syncPath with correct path on darwin', async () => {
    mockPlatform = 'darwin'
    const { user } = render(<SettingsView />)
    // current menubarGasPrice is false, toggling should set to true
    await user.click(getToggleForLabel('Menubar Gas Price'))
    expect(mockSyncPath).toHaveBeenCalledWith('main.menubarGasPrice', true)
  })
})
