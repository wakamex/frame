type Status = 'ok' | 'connected' | 'ready' | 'locked' | 'loading' | 'disconnected' | 'off' | 'error' | string

interface StatusDotProps {
  status: Status
  className?: string
}

const statusColors: Record<string, string> = {
  ok: 'bg-green-400',
  connected: 'bg-green-400',
  ready: 'bg-green-400',
  locked: 'bg-yellow-400',
  loading: 'bg-yellow-400',
  standby: 'bg-yellow-400',
  disconnected: 'bg-red-400',
  off: 'bg-gray-600',
  error: 'bg-red-400',
  declined: 'bg-red-400',
  pending: 'bg-yellow-400'
}

export default function StatusDot({ status, className = '' }: StatusDotProps) {
  const color = statusColors[status] ?? 'bg-gray-600'
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${color} ${className}`}
      title={status}
    />
  )
}
