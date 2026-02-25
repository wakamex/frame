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
  const color = primaryColor ? getColor(primaryColor as keyof ColorwayPalette, colorway as Colorway) : null

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${className}`}
    >
      {color && (
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: color.hex }}
        />
      )}
      <span className="text-gray-300">{name}</span>
    </span>
  )
}
