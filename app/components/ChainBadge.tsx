import { getColor, Colorway } from '../../resources/colors'
import type { ColorwayPalette } from '../../main/store/state'
import { useColorway } from '../store'

interface ChainBadgeProps {
  name: string
  primaryColor?: keyof ColorwayPalette | string
  className?: string
}

export default function ChainBadge({ name, primaryColor, className = '' }: ChainBadgeProps) {
  const colorway = useColorway()

  // primaryColor can be a palette key (e.g. 'accent1') or a raw hex string (e.g. '#627EEA')
  let hex: string | null = null
  if (primaryColor) {
    if (primaryColor.startsWith('#')) {
      hex = primaryColor
    } else {
      const resolved = getColor(primaryColor as keyof ColorwayPalette, colorway as Colorway)
      if (resolved) hex = resolved.hex
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${className}`}
    >
      {hex && (
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: hex }}
        />
      )}
      <span className="text-gray-300">{name}</span>
    </span>
  )
}
