import { useState, useEffect } from 'react'

const COMPACT_BREAKPOINT = 768

/**
 * Returns true when the window width is below the compact breakpoint (768px).
 * Used to switch between side-by-side and stacked layouts.
 */
export function useCompact(): boolean {
  const [compact, setCompact] = useState(() => window.innerWidth < COMPACT_BREAKPOINT)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${COMPACT_BREAKPOINT - 1}px)`)
    const handler = (e: MediaQueryListEvent) => setCompact(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return compact
}
