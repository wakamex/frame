import './styles.css'
import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'

import { initializeApp, sendEvent, sendAction, actions } from './ipc'
import { useSnapshot } from 'valtio'
import { state, useCurrentView, useAccounts, usePendingRequests, setView as setViewAction } from './store'
import { useCompact } from './hooks/useCompact'
import AccountsView from './views/Accounts'
import SignersView from './views/Signers'
import ChainsView from './views/Chains'
import TokensView from './views/Tokens'
import SettingsView from './views/Settings'
import RequestOverlay from './views/Requests'
import OnboardView from './views/Onboard'
import SendView from './views/Send'
import PortfolioView from './views/Portfolio'
import AddressBookView from './views/AddressBook'
import HistoryView from './views/History'

function App() {
  const snap = useSnapshot(state)
  const initialized = snap.initialized
  const colorway = snap.main?.colorway
  const accounts = useAccounts()
  const onboardingComplete = snap.main?.mute?.onboardingWindow

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

  return <AppShell />
}

// Inner component — only mounts after initialization and accounts exist.
// Separated from App to avoid hooks violations from early returns above.
function AppShell() {
  const snap = useSnapshot(state)
  const currentView = useCurrentView()
  const pendingRequests = usePendingRequests()
  const compact = useCompact()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const updateBadge = snap.main?.updater?.badge

  // Close sidebar when switching views on compact layout
  const handleViewChange = (view: string) => {
    setViewAction(view)
    if (compact) setSidebarOpen(false)
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      {/* Update banner */}
      {updateBadge && <UpdateBanner badge={updateBadge} />}

      <div className="flex flex-1 min-h-0">
      {/* Sidebar navigation */}
      {(!compact || sidebarOpen) && (
        <nav className={`${compact ? 'absolute inset-y-0 left-0 z-30' : ''} w-48 bg-gray-900 border-r border-gray-800 flex flex-col p-3 gap-1`}>
          <div className="flex items-center justify-between px-3 py-2 mb-2">
            <span className="text-lg font-semibold text-gray-100">Framed</span>
            {compact && (
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-gray-500 hover:text-gray-300 text-sm"
              >
                &times;
              </button>
            )}
          </div>
          <NavItem label="Accounts" view="accounts" current={currentView} onClick={handleViewChange} />
          <NavItem label="Portfolio" view="portfolio" current={currentView} onClick={handleViewChange} />
          <NavItem label="Send" view="send" current={currentView} onClick={handleViewChange} />
          <NavItem label="Contacts" view="contacts" current={currentView} onClick={handleViewChange} />
          <NavItem label="Signers" view="signers" current={currentView} onClick={handleViewChange} />
          <NavItem label="History" view="history" current={currentView} onClick={handleViewChange} />
          <NavItem label="Chains" view="chains" current={currentView} onClick={handleViewChange} />
          <NavItem label="Tokens" view="tokens" current={currentView} onClick={handleViewChange} />
          <div className="flex-1" />
          <NavItem label="Settings" view="settings" current={currentView} onClick={handleViewChange} />
        </nav>
      )}

      {/* Sidebar overlay backdrop on compact */}
      {compact && sidebarOpen && (
        <div
          className="absolute inset-0 z-20 bg-black/40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {compact && !sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="mb-3 text-sm text-gray-400 hover:text-gray-200"
          >
            &#9776; Menu
          </button>
        )}
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
  onClick: (view: string) => void
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
    case 'portfolio':
      return <PortfolioView />
    case 'send':
      return <SendView />
    case 'contacts':
      return <AddressBookView />
    case 'signers':
      return <SignersView />
    case 'chains':
      return <ChainsView />
    case 'tokens':
      return <TokensView />
    case 'history':
      return <HistoryView />
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
