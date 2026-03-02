/**
 * @jest-environment jsdom
 */
import { render, screen, act, waitFor, fireEvent, within } from '../../../componentSetup'
import SettingsView from '../../../../app/views/Settings/index'

// ─── IPC mocks ───────────────────────────────────────────────────────────────
const mockSyncPath = jest.fn()
const mockSetGasAlert = jest.fn()
const mockToggleGasAlert = jest.fn()
const mockResetAllSettings = jest.fn()
const mockSendAction = jest.fn()

jest.mock('../../../../app/ipc', () => ({
  actions: {
    syncPath: (...args) => mockSyncPath(...args),
    setGasAlert: (...args) => mockSetGasAlert(...args),
    toggleGasAlert: (...args) => mockToggleGasAlert(...args),
    resetAllSettings: (...args) => mockResetAllSettings(...args)
  },
  sendAction: (...args) => mockSendAction(...args),
  rpc: jest.fn()
}))

// ─── Keyboard resource mock ───────────────────────────────────────────────────
jest.mock('../../../../resources/keyboard', () => ({
  getDisplayShortcut: jest.fn(() => ({ modifierKeys: ['Meta'], shortcutKey: 'Space' })),
  getShortcutFromKeyEvent: jest.fn(() => ({ modifierKeys: [], shortcutKey: 'Space' })),
  isShortcutKey: jest.fn(() => false)
}))

// ─── Store mocks ──────────────────────────────────────────────────────────────
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
    summon: {
      modifierKeys: ['Meta'],
      shortcutKey: 'Space',
      enabled: true,
      configuring: false
    }
  }
}

const mockNetworks = {
  1: { id: 1, name: 'Ethereum', on: true, isTestnet: false },
  5: { id: 5, name: 'Goerli', on: true, isTestnet: true },
  10: { id: 10, name: 'Optimism', on: false, isTestnet: false }
}

const mockGasAlerts = {
  1: { threshold: 20, enabled: true }
}

jest.mock('../../../../app/store', () => ({
  useMainState: jest.fn(),
  useNetworks: jest.fn(),
  useGasAlerts: jest.fn(),
  usePlatform: jest.fn()
}))

// Import after mocking so we get the mocked versions
const { useMainState, useNetworks, useGasAlerts, usePlatform } = require('../../../../app/store')

describe('SettingsView', () => {
  beforeEach(() => {
    useMainState.mockReturnValue(mockMainState)
    useNetworks.mockReturnValue(mockNetworks)
    useGasAlerts.mockReturnValue(mockGasAlerts)
    usePlatform.mockReturnValue('linux')
  })

  // ── Test 1: renders all section headers ──────────────────────────────────────
  it('renders all section headers', () => {
    render(<SettingsView />)

    expect(screen.getByText('Appearance')).toBeDefined()
    expect(screen.getByText('Keyboard Shortcut')).toBeDefined()
    expect(screen.getByText('Behavior')).toBeDefined()
    expect(screen.getByText('Privacy')).toBeDefined()
    expect(screen.getByText('Hardware')).toBeDefined()
    expect(screen.getByText('API Keys')).toBeDefined()
    expect(screen.getByText('Gas Price Alerts')).toBeDefined()
  })

  // ── Test 2: Dark Mode toggle ─────────────────────────────────────────────────
  it('Dark Mode toggle calls actions.syncPath with colorway path', async () => {
    const { user } = render(<SettingsView />)

    // Find the Dark Mode row and click its toggle button
    const darkModeText = screen.getByText('Dark Mode')
    const row = darkModeText.parentElement.parentElement
    const toggleBtn = within(row).getByRole('button')

    await user.click(toggleBtn)

    // colorway is 'dark' in mock, so toggling should set it to 'light'
    expect(mockSyncPath).toHaveBeenCalledWith('main.colorway', 'light')
  })

  // ── Test 3: Run on Startup toggle ────────────────────────────────────────────
  it('Run on Startup toggle calls correct syncPath', async () => {
    const { user } = render(<SettingsView />)

    const label = screen.getByText('Run on Startup')
    const row = label.parentElement.parentElement
    const toggleBtn = within(row).getByRole('button')

    await user.click(toggleBtn)

    // launch is true in mock, so toggling should set to false
    expect(mockSyncPath).toHaveBeenCalledWith('main.launch', false)
  })

  // ── Test 4: Auto-hide toggle ──────────────────────────────────────────────────
  it('Auto-hide toggle calls correct syncPath', async () => {
    const { user } = render(<SettingsView />)

    const label = screen.getByText('Auto-hide')
    const row = label.parentElement.parentElement
    const toggleBtn = within(row).getByRole('button')

    await user.click(toggleBtn)

    // autohide is false in mock, so toggling should set to true
    expect(mockSyncPath).toHaveBeenCalledWith('main.autohide', true)
  })

  // ── Test 5: Error Reporting toggle ──────────────────────────────────────────
  it('Error Reporting toggle calls correct syncPath', async () => {
    const { user } = render(<SettingsView />)

    const label = screen.getByText('Error Reporting')
    const row = label.parentElement.parentElement
    const toggleBtn = within(row).getByRole('button')

    await user.click(toggleBtn)

    // errorReporting is true in mock, so toggling should set to false
    expect(mockSyncPath).toHaveBeenCalledWith('main.privacy.errorReporting', false)
  })

  // ── Test 6: Etherscan API key input ──────────────────────────────────────────
  it('typing in Etherscan field calls syncPath with key value', () => {
    render(<SettingsView />)

    const etherscanRow = screen.getByText('Etherscan').parentElement
    const input = etherscanRow.querySelector('input')

    fireEvent.change(input, { target: { value: 'my-etherscan-key' } })

    expect(mockSyncPath).toHaveBeenCalledWith('main.apiKeys.etherscan', 'my-etherscan-key')
  })

  // ── Test 7: Gas Alerts section renders chains that are on + not testnet ──────
  it('Gas Alerts section renders chains that are on and not testnet', () => {
    render(<SettingsView />)

    // Ethereum: on=true, isTestnet=false — should appear
    expect(screen.getByText('Ethereum')).toBeDefined()

    // Goerli: on=true, isTestnet=true — should NOT appear
    expect(screen.queryByText('Goerli')).toBeNull()

    // Optimism: on=false, isTestnet=false — should NOT appear
    expect(screen.queryByText('Optimism')).toBeNull()
  })

  // ── Test 8: Gas alert threshold ──────────────────────────────────────────────
  it('changing gas alert threshold calls actions.setGasAlert', () => {
    render(<SettingsView />)

    // Find Ethereum gas alert row (chain id 1, has existing alert)
    const ethereumLabel = screen.getByText('Ethereum')
    const alertRow = ethereumLabel.parentElement
    const thresholdInput = alertRow.querySelector('input[type="number"]')

    fireEvent.change(thresholdInput, { target: { value: '35' } })

    // alert exists and enabled=true, val=35>0 so enabled stays true
    expect(mockSetGasAlert).toHaveBeenCalledWith('1', 35, true)
  })

  // ── Test 9: Gas alert toggle ──────────────────────────────────────────────────
  it('clicking gas alert toggle calls actions.toggleGasAlert when alert exists', async () => {
    const { user } = render(<SettingsView />)

    const ethereumLabel = screen.getByText('Ethereum')
    const alertRow = ethereumLabel.parentElement
    const toggleBtn = within(alertRow).getByRole('button')

    await user.click(toggleBtn)

    // Alert exists for chain 1, so toggleGasAlert should be called
    expect(mockToggleGasAlert).toHaveBeenCalledWith('1')
  })

  // ── Test 10: Reset modal appears on click ────────────────────────────────────
  it('clicking Reset All Settings shows confirmation modal', async () => {
    const { user } = render(<SettingsView />)

    // Initially modal is not shown
    expect(screen.queryByText('This will reset all settings to defaults and restart Frame. Are you sure?')).toBeNull()

    await user.click(screen.getByText('Reset All Settings'))

    // Modal should appear
    expect(screen.getByText('This will reset all settings to defaults and restart Frame. Are you sure?')).toBeDefined()
  })

  // ── Test 11: Reset modal cancel ─────────────────────────────────────────────
  it('clicking Cancel in reset modal closes it without calling reset', async () => {
    const { user } = render(<SettingsView />)

    await user.click(screen.getByText('Reset All Settings'))
    expect(screen.getByText('This will reset all settings to defaults and restart Frame. Are you sure?')).toBeDefined()

    await user.click(screen.getByText('Cancel'))

    // Modal is closed
    expect(screen.queryByText('This will reset all settings to defaults and restart Frame. Are you sure?')).toBeNull()
    // Reset action was NOT called
    expect(mockResetAllSettings).not.toHaveBeenCalled()
  })

  // ── Test 12: Reset modal confirm ────────────────────────────────────────────
  it('clicking Reset in modal calls actions.resetAllSettings', async () => {
    const { user } = render(<SettingsView />)

    await user.click(screen.getByText('Reset All Settings'))

    // Click Reset button inside the modal
    await user.click(screen.getByText('Reset'))

    expect(mockResetAllSettings).toHaveBeenCalled()
  })

  // ── Test 13: Menubar Gas Price — darwin only ─────────────────────────────────
  it('Menubar Gas Price is not rendered on non-darwin platforms', () => {
    usePlatform.mockReturnValue('linux')
    render(<SettingsView />)

    expect(screen.queryByText('Menubar Gas Price')).toBeNull()
  })

  it('Menubar Gas Price is rendered on darwin', () => {
    usePlatform.mockReturnValue('darwin')
    render(<SettingsView />)

    expect(screen.getByText('Menubar Gas Price')).toBeDefined()
  })
})
