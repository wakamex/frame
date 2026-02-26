import React from 'react'

// Stub — old SVG icon components were removed with the tray UI.
// Minimal stubs for components that still reference svg icons.
const svg: Record<string, (...args: any[]) => React.ReactNode> = {
  octicon: () => null,
  check: () => null
}

export default svg
