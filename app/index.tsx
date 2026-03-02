import 'tailwindcss'
import { createRoot } from 'react-dom/client'
import { useEffect } from 'react'

import { initializeApp, sendEvent } from './ipc'
import { useStore, useCurrentView, usePendingRequests } from './store'
import AccountsView from './views/Accounts'
import SignersView from './views/Signers'
import ChainsView from './views/Chains'
import TokensView from './views/Tokens'
import SettingsView from './views/Settings'
import RequestOverlay from './views/Requests'

function App() {
  const initialized = useStore((s) => s.initialized)
  const currentView = useCurrentView()
  const setView = useStore((s) => s.setView)
  const colorway = useStore((s) => s.main?.colorway)

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

  const pendingRequests = usePendingRequests()

  return (
    <div className="flex h-screen">
      {/* Sidebar navigation */}
      <nav className="w-48 bg-gray-900 border-r border-gray-800 flex flex-col p-3 gap-1">
        <div className="text-lg font-semibold text-gray-100 px-3 py-2 mb-2">Frame</div>
        <NavItem label="Accounts" view="accounts" current={currentView} onClick={setView} />
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
