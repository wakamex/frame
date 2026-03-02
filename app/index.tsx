import './styles.css'
import { createRoot } from 'react-dom/client'
import { useEffect } from 'react'

import { initializeApp, sendEvent, sendAction, actions } from './ipc'
import { useStore, useCurrentView, useAccounts, usePendingRequests } from './store'
import AccountsView from './views/Accounts'
import SignersView from './views/Signers'
import ChainsView from './views/Chains'
import TokensView from './views/Tokens'
import SettingsView from './views/Settings'
import RequestOverlay from './views/Requests'
import OnboardView from './views/Onboard'
import SendView from './views/Send'

function App() {
  const initialized = useStore((s) => s.initialized)
  const currentView = useCurrentView()
  const setView = useStore((s) => s.setView)
  const colorway = useStore((s) => s.main?.colorway)
  const accounts = useAccounts()
  const onboardingComplete = useStore((s) => s.main?.mute?.onboardingWindow)

  useEffect(() => {
    if (colorway) {
      document.documentElement.classList.remove('dark', 'light')
      document.documentElement.classList.add(colorway)
    }
  }, [colorway])

  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    )
  }

  // Show onboarding when no accounts exist and it hasn't been dismissed
  const hasAccounts = Object.keys(accounts).length > 0
  if (!hasAccounts && !onboardingComplete) {
    return (
      <div className="h-screen bg-gray-900">
        <OnboardView onComplete={() => sendAction('completeOnboarding')} />
      </div>
    )
  }

  const pendingRequests = usePendingRequests()
  const updateBadge = useStore((s) => s.main?.updater?.badge)

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      {/* Update banner */}
      {updateBadge && <UpdateBanner badge={updateBadge} />}

      <div className="flex flex-1 min-h-0">
      {/* Sidebar navigation */}
      <nav className="w-48 bg-gray-900 border-r border-gray-800 flex flex-col p-3 gap-1">
        <div className="text-lg font-semibold text-gray-100 px-3 py-2 mb-2">Frame</div>
        <NavItem label="Accounts" view="accounts" current={currentView} onClick={setView} />
        <NavItem label="Send" view="send" current={currentView} onClick={setView} />
        <NavItem label="Signers" view="signers" current={currentView} onClick={setView} />
        <NavItem label="Chains" view="chains" current={currentView} onClick={setView} />
        <NavItem label="Tokens" view="tokens" current={currentView} onClick={setView} />
        <div className="flex-1" />
        <NavItem label="Settings" view="settings" current={currentView} onClick={setView} />
      </nav>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto p-6">
        <ViewContent view={currentView} />
      </main>

      {/* Request overlay - shows when pending requests exist */}
      {pendingRequests.length > 0 && <RequestOverlay requests={pendingRequests} />}
    </div>
    </div>
  )
}

function NavItem({
  label,
  view,
  current,
  onClick
}: {
  label: string
  view: string
  current: string
  onClick: (view: any) => void
}) {
  const isActive = current === view
  return (
    <button
      onClick={() => onClick(view)}
      className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${
        isActive
          ? 'bg-gray-800 text-gray-100'
          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
      }`}
    >
      {label}
    </button>
  )
}

function ViewContent({ view }: { view: string }) {
  switch (view) {
    case 'accounts':
      return <AccountsView />
    case 'send':
      return <SendView />
    case 'signers':
      return <SignersView />
    case 'chains':
      return <ChainsView />
    case 'tokens':
      return <TokensView />
    case 'settings':
      return <SettingsView />
    default:
      return <AccountsView />
  }
}

function UpdateBanner({ badge }: { badge: { type: string; version: string } }) {
  const isReady = badge.type === 'updateReady'

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 text-sm">
      <span className="text-gray-300">
        {isReady
          ? `Update ${badge.version} is ready to install.`
          : `Update ${badge.version} is available.`}
      </span>
      <div className="flex gap-2">
        {isReady ? (
          <button
            onClick={() => actions.installUpdate()}
            className="px-3 py-1 rounded text-xs font-medium bg-gray-100 text-gray-900 hover:bg-white transition-colors"
          >
            Install & Restart
          </button>
        ) : (
          <button
            onClick={() => actions.installUpdate()}
            className="px-3 py-1 rounded text-xs font-medium bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors"
          >
            Download
          </button>
        )}
        <button
          onClick={() => actions.dismissUpdate(badge.version, false)}
          className="px-3 py-1 rounded text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

// Prevent drag-and-drop navigation
document.addEventListener('dragover', (e) => e.preventDefault())
document.addEventListener('drop', (e) => e.preventDefault())

// Context menu for dev tools
document.addEventListener('contextmenu', (e) =>
  sendEvent('*:contextmenu', e.clientX, e.clientY)
)

// Initialize app and render
initializeApp()
  .then(() => {
    const root = createRoot(document.getElementById('root')!)
    root.render(<App />)
  })
  .catch((err) => {
    console.error('Failed to initialize app:', err)
    const root = createRoot(document.getElementById('root')!)
    root.render(
      <div className="flex items-center justify-center h-screen text-red-400">
        Failed to connect to main process
      </div>
    )
  })
