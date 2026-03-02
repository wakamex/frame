import { actions } from '../../ipc'
import { accountViewTitles } from '../../../resources/domain/request'
import useCountdown from '../../../resources/Hooks/useCountdown'

interface SignatureReviewProps {
  request: any
}

export default function SignatureReview({ request }: SignatureReviewProps) {
  const origin = request.origin || 'Unknown'
  const status = request.status || 'pending'
  const isPending = status === 'pending'
  const title = accountViewTitles[request.type as keyof typeof accountViewTitles] || 'Sign Request'

  const handleApprove = () => actions.approveRequest(request)
  const handleDecline = () => actions.declineRequest(request)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-100">{title}</h3>
        <span className="text-xs text-gray-500 capitalize">{status}</span>
      </div>

      <div className="text-xs text-gray-500">
        From <span className="text-gray-400">{origin}</span>
      </div>

      {/* Content varies by type */}
      {request.type === 'sign' && <PlainMessageView request={request} />}
      {request.type === 'signTypedData' && <TypedDataView request={request} />}
      {request.type === 'signErc20Permit' && <PermitView request={request} />}

      {/* Actions */}
      {isPending && (
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleDecline}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Decline
          </button>
          <button
            onClick={handleApprove}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-green-600/20 text-green-400 border border-green-600/30 hover:bg-green-600/30 transition-colors"
          >
            Sign
          </button>
        </div>
      )}
    </div>
  )
}

function PlainMessageView({ request }: { request: any }) {
  const message = request.data?.decodedMessage || request.payload?.params?.[1] || ''
  return (
    <div className="bg-gray-800/50 rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">Message</div>
      <pre className="text-sm text-gray-200 whitespace-pre-wrap break-all font-mono max-h-48 overflow-y-auto">
        {message}
      </pre>
    </div>
  )
}

function TypedDataView({ request }: { request: any }) {
  const typedMessage = request.typedMessage
  const data = typedMessage?.data

  return (
    <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
      <div className="text-xs text-gray-500 mb-1">Typed Data</div>
      {data?.primaryType && (
        <div className="text-sm text-gray-300">
          <span className="text-gray-500">Type:</span> {data.primaryType}
        </div>
      )}
      {data?.domain && (
        <div className="text-sm text-gray-300">
          <span className="text-gray-500">Domain:</span> {data.domain.name || 'Unknown'}
          {data.domain.chainId && ` (Chain ${data.domain.chainId})`}
        </div>
      )}
      {data?.message && (
        <pre className="text-xs text-gray-400 font-mono max-h-48 overflow-y-auto whitespace-pre-wrap">
          {JSON.stringify(data.message, null, 2)}
        </pre>
      )}
    </div>
  )
}

function PermitView({ request }: { request: any }) {
  const permit = request.permit
  const tokenData = request.tokenData
  const deadline = permit?.deadline

  return (
    <div className="space-y-3">
      {tokenData && (
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Token</div>
          <div className="text-sm text-gray-200">
            {tokenData.name || 'Unknown'} ({tokenData.symbol || '?'})
          </div>
        </div>
      )}
      {permit && (
        <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
          <div className="text-xs text-gray-500">Permit Details</div>
          {permit.spender && (
            <div className="text-sm text-gray-300">
              <span className="text-gray-500">Spender:</span>{' '}
              <span className="font-mono text-xs">
                {permit.spender.ens || permit.spender.address}
              </span>
            </div>
          )}
          {permit.value !== undefined && (
            <div className="text-sm text-gray-300">
              <span className="text-gray-500">Amount:</span> {permit.value.toString()}
            </div>
          )}
          {deadline && <PermitDeadline deadline={deadline} />}
        </div>
      )}
    </div>
  )
}

function PermitDeadline({ deadline }: { deadline: string | number }) {
  const deadlineDate = new Date(typeof deadline === 'string' ? parseInt(deadline) * 1000 : deadline * 1000)
  const countdown = useCountdown(deadlineDate)

  return (
    <div className="text-sm text-gray-300">
      <span className="text-gray-500">Expires:</span>{' '}
      <span className={countdown === 'EXPIRED' ? 'text-red-400' : ''}>{countdown}</span>
    </div>
  )
}
