import { useState, useEffect, useCallback } from 'react'
import { useMainState, useNetworks, useGasAlerts, usePlatform } from '../../store'
import { actions, sendAction } from '../../ipc'
import { getDisplayShortcut, getShortcutFromKeyEvent, isShortcutKey } from '../../../resources/keyboard'
import Modal from '../../components/Modal'
import type { GasAlert } from '../../types'

export default function SettingsView() {
  const main = useMainState()
  const platform = usePlatform()
  const [confirmReset, setConfirmReset] = useState(false)

  if (!main) return null

  const toggle = (path: string, current: boolean) => {
    actions.syncPath(path, !current)
  }

  return (
    <div className="space-y-8 max-w-xl">
      {/* Appearance */}
      <Section title="Appearance">
        <ToggleRow
          label="Dark Mode"
          description="Use dark color scheme"
          value={main.colorway === 'dark'}
          onChange={() => actions.syncPath('main.colorway', main.colorway === 'dark' ? 'light' : 'dark')}
        />
      </Section>

      {/* Keyboard Shortcut */}
      <Section title="Keyboard Shortcut">
        <ShortcutConfigurator
          shortcut={main.shortcuts?.summon}
          platform={platform}
          label="Summon Framed"
        />
      </Section>

      {/* Behavior */}
      <Section title="Behavior">
        <ToggleRow
          label="Run on Startup"
          description="Start Framed when you log in"
          value={main.launch}
          onChange={() => toggle('main.launch', main.launch)}
        />
        <ToggleRow
          label="Auto-hide"
          description="Hide Framed when it loses focus"
          value={main.autohide}
          onChange={() => toggle('main.autohide', main.autohide)}
        />
        {platform === 'darwin' && (
          <ToggleRow
            label="Menubar Gas Price"
            description="Show gas price in the menu bar"
            value={main.menubarGasPrice}
            onChange={() => toggle('main.menubarGasPrice', main.menubarGasPrice)}
          />
        )}
      </Section>

      {/* Privacy */}
      <Section title="Privacy">
        <ToggleRow
          label="Show Local Name with ENS"
          description="Display local account names alongside ENS names"
          value={main.showLocalNameWithENS}
          onChange={() => toggle('main.showLocalNameWithENS', main.showLocalNameWithENS)}
        />
      </Section>

      {/* Hardware */}
      <Section title="Hardware">
        <SelectRow
          label="Ledger Derivation"
          value={main.ledger?.derivation || 'live'}
          options={[
            { value: 'live', label: 'Ledger Live' },
            { value: 'legacy', label: 'Legacy (MEW)' }
          ]}
          onChange={(v) => actions.syncPath('main.ledger.derivation', v)}
        />
        <NumberRow
          label="Ledger Account Limit"
          value={main.ledger?.liveAccountLimit ?? 5}
          min={1}
          max={20}
          onChange={(v) => actions.syncPath('main.ledger.liveAccountLimit', v)}
        />
        <SelectRow
          label="Trezor Derivation"
          value={main.trezor?.derivation || 'standard'}
          options={[
            { value: 'standard', label: 'Standard' },
            { value: 'legacy', label: 'Legacy' },
            { value: 'testnet', label: 'Testnet' }
          ]}
          onChange={(v) => actions.syncPath('main.trezor.derivation', v)}
        />
      </Section>

      {/* API Keys */}
      <Section title="API Keys">
        <p className="text-xs text-gray-500 mb-2">
          Optional keys for contract source lookups. Works without keys at reduced rate limits.
        </p>
        <TextRow
          label="Etherscan"
          placeholder="API key"
          value={main.apiKeys?.etherscan ?? ''}
          onChange={(v) => actions.syncPath('main.apiKeys.etherscan', v)}
        />
        <TextRow
          label="Polygonscan"
          placeholder="API key"
          value={main.apiKeys?.polygonscan ?? ''}
          onChange={(v) => actions.syncPath('main.apiKeys.polygonscan', v)}
        />
        <TextRow
          label="Arbiscan"
          placeholder="API key"
          value={main.apiKeys?.arbiscan ?? ''}
          onChange={(v) => actions.syncPath('main.apiKeys.arbiscan', v)}
        />
      </Section>

      {/* Gas Alerts */}
      <GasAlertsSection />

      {/* Danger zone */}
      <Section title="Danger Zone">
        <button
          onClick={() => setConfirmReset(true)}
          className="text-sm text-red-400/70 hover:text-red-400 transition-colors"
        >
          Reset All Settings
        </button>
      </Section>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset All Settings">
        <p className="text-sm text-gray-300 mb-4">
          This will reset all settings to defaults and restart Framed. Are you sure?
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setConfirmReset(false)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 rounded">Cancel</button>
          <button onClick={() => actions.resetAllSettings()} className="px-3 py-1.5 text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded">Reset</button>
        </div>
      </Modal>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function ToggleRow({ label, description, value, onChange }: {
  label: string; description: string; value: boolean; onChange: () => void
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="text-sm text-gray-200">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <button
        onClick={onChange}
        className={`w-10 h-5 rounded-full transition-colors ${value ? 'bg-green-600/40' : 'bg-gray-700'}`}
      >
        <span
          className={`block w-4 h-4 rounded-full transition-transform ${
            value ? 'translate-x-5 bg-green-400' : 'translate-x-0.5 bg-gray-500'
          }`}
        />
      </button>
    </div>
  )
}

function SelectRow({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="text-sm text-gray-200">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

function NumberRow({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="text-sm text-gray-200">{label}</div>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(parseInt(e.target.value) || min)}
        className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 outline-none text-center"
      />
    </div>
  )
}

function TextRow({ label, placeholder, value, onChange }: {
  label: string; placeholder?: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="text-sm text-gray-200">{label}</div>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-48 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 outline-none font-mono"
      />
    </div>
  )
}

function GasAlertsSection() {
  const networks = useNetworks()
  const gasAlerts = useGasAlerts() as Record<string, GasAlert>

  const chains = Object.values(networks).filter((c: any) => c.on && !c.isTestnet)

  if (chains.length === 0) return null

  return (
    <Section title="Gas Price Alerts">
      <p className="text-xs text-gray-500 mb-2">
        Get notified when gas drops below your threshold (in gwei).
      </p>
      {chains.map((chain: any) => {
        const chainId = String(chain.id)
        const alert = gasAlerts[chainId]
        const threshold = alert?.threshold ?? 0
        const enabled = alert?.enabled ?? false

        return (
          <div key={chainId} className="flex items-center justify-between py-2 gap-3">
            <div className="text-sm text-gray-200 min-w-[100px]">{chain.name}</div>
            <input
              type="number"
              min={0}
              placeholder="gwei"
              value={threshold || ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0
                actions.setGasAlert(chainId, val, enabled || val > 0)
              }}
              className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 outline-none text-center"
            />
            <button
              onClick={() => {
                if (alert) {
                  actions.toggleGasAlert(chainId)
                } else {
                  actions.setGasAlert(chainId, threshold, true)
                }
              }}
              className={`w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-green-600/40' : 'bg-gray-700'}`}
            >
              <span
                className={`block w-4 h-4 rounded-full transition-transform ${
                  enabled ? 'translate-x-5 bg-green-400' : 'translate-x-0.5 bg-gray-500'
                }`}
              />
            </button>
          </div>
        )
      })}
    </Section>
  )
}

function ShortcutConfigurator({ shortcut, platform, label }: {
  shortcut: { modifierKeys: string[]; shortcutKey: string; enabled: boolean; configuring: boolean } | undefined
  platform: string
  label: string
}) {
  const [configuring, setConfiguring] = useState(false)
  const [pressedKeys, setPressedKeys] = useState<number[]>([])

  const display = shortcut ? getDisplayShortcut(platform as 'darwin' | 'win32' | 'linux', shortcut) : null

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()

    setPressedKeys((prev) => {
      if (!prev.includes(e.keyCode)) return [...prev, e.keyCode]
      return prev
    })

    const allowedModifiers = ['Meta', 'Alt', 'Control', 'Command']
    if (!allowedModifiers.includes(e.key) && isShortcutKey(e)) {
      const newShortcut = getShortcutFromKeyEvent(e, [...pressedKeys, e.keyCode], platform as 'darwin' | 'win32' | 'linux')
      sendAction('setShortcut', 'summon', {
        ...newShortcut,
        configuring: false,
        enabled: true
      })
      setConfiguring(false)
      setPressedKeys([])
    }
  }, [platform, pressedKeys])

  useEffect(() => {
    if (!configuring) return
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [configuring, handleKeyDown])

  if (!shortcut) return null

  const toggleEnabled = () => {
    sendAction('setShortcut', 'summon', {
      ...shortcut,
      enabled: !shortcut.enabled
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between py-2">
        <div>
          <div className="text-sm text-gray-200">{label}</div>
          <div className="text-xs text-gray-500">Global hotkey to show/hide Framed</div>
        </div>
        <button
          onClick={toggleEnabled}
          className={`w-10 h-5 rounded-full transition-colors ${shortcut.enabled ? 'bg-green-600/40' : 'bg-gray-700'}`}
        >
          <span
            className={`block w-4 h-4 rounded-full transition-transform ${
              shortcut.enabled ? 'translate-x-5 bg-green-400' : 'translate-x-0.5 bg-gray-500'
            }`}
          />
        </button>
      </div>

      {shortcut.enabled && (
        <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2.5">
          {configuring ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-300">Press a new shortcut...</span>
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {display && [...display.modifierKeys, display.shortcutKey].map((key, i, arr) => (
                <span key={i} className="flex items-center gap-1.5">
                  <kbd className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-gray-200 font-mono">
                    {key}
                  </kbd>
                  {i < arr.length - 1 && <span className="text-gray-600 text-xs">+</span>}
                </span>
              ))}
            </div>
          )}
          <button
            onClick={() => { setConfiguring(!configuring); setPressedKeys([]) }}
            className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-700 transition-colors"
          >
            {configuring ? 'Cancel' : 'Change'}
          </button>
        </div>
      )}
    </div>
  )
}
