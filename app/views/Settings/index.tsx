import { useState } from 'react'
import { useMainState, usePlatform, useStore } from '../../store'
import { actions } from '../../ipc'
import Modal from '../../components/Modal'

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

      {/* Behavior */}
      <Section title="Behavior">
        <ToggleRow
          label="Run on Startup"
          description="Start Frame when you log in"
          value={main.launch}
          onChange={() => toggle('main.launch', main.launch)}
        />
        <ToggleRow
          label="Auto-hide"
          description="Hide Frame when it loses focus"
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
          label="Error Reporting"
          description="Send anonymous error reports to help improve Frame"
          value={main.privacy?.errorReporting ?? false}
          onChange={() => toggle('main.privacy.errorReporting', main.privacy?.errorReporting ?? false)}
        />
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
          This will reset all settings to defaults and restart Frame. Are you sure?
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
