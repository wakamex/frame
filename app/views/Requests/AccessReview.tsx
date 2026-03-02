import { actions } from '../../ipc'

interface AccessReviewProps {
  request: any
}

export default function AccessReview({ request }: AccessReviewProps) {
  const origin = request.origin || 'Unknown'
  const status = request.status || 'pending'
  const isPending = status === 'pending'

  const handleApprove = () => actions.giveAccess(request, true)
  const handleDecline = () => actions.giveAccess(request, false)

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-gray-100">Account Access</h3>

      <div className="bg-gray-800/50 rounded-lg p-4 text-center space-y-2">
        <div className="text-sm text-gray-200 font-medium">{origin}</div>
        <div className="text-xs text-gray-500">wants to connect to your account</div>
      </div>

      {isPending && (
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleDecline}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Deny
          </button>
          <button
            onClick={handleApprove}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-green-600/20 text-green-400 border border-green-600/30 hover:bg-green-600/30 transition-colors"
          >
            Allow
          </button>
        </div>
      )}
    </div>
  )
}
