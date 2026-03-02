import { actions } from '../../ipc'

interface ChainTokenReviewProps {
  request: any
}

export default function ChainTokenReview({ request }: ChainTokenReviewProps) {
  const status = request.status || 'pending'
  const isPending = status === 'pending'
  const origin = request.origin || 'Unknown'

  if (request.type === 'addChain') return <AddChainReview request={request} isPending={isPending} origin={origin} />
  if (request.type === 'addToken') return <AddTokenReview request={request} isPending={isPending} origin={origin} />
  if (request.type === 'switchChain') return <SwitchChainReview request={request} isPending={isPending} origin={origin} />
  return null
}

function AddChainReview({ request, isPending, origin }: { request: any; isPending: boolean; origin: string }) {
  const chain = request.chain || {}
  const handleApprove = () => actions.addChain(chain)
  const handleDecline = () => actions.rejectRequest(request)

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-gray-100">Add Chain</h3>
      <div className="text-xs text-gray-500">
        <span className="text-gray-400">{origin}</span> wants to add a network
      </div>
      <div className="bg-gray-800/50 rounded-lg p-3 space-y-1">
        <div className="text-sm text-gray-200">{chain.name || 'Unknown Chain'}</div>
        <div className="text-xs text-gray-500">Chain ID: {chain.id}</div>
        {chain.symbol && <div className="text-xs text-gray-500">Symbol: {chain.symbol}</div>}
        {chain.explorer && <div className="text-xs text-gray-500">Explorer: {chain.explorer}</div>}
      </div>
      {isPending && (
        <div className="flex gap-3 pt-2">
          <button onClick={handleDecline} className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors">Decline</button>
          <button onClick={handleApprove} className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-green-600/20 text-green-400 border border-green-600/30 hover:bg-green-600/30 transition-colors">Add Chain</button>
        </div>
      )}
    </div>
  )
}

function AddTokenReview({ request, isPending, origin }: { request: any; isPending: boolean; origin: string }) {
  const token = request.token || {}
  const handleApprove = () => actions.addToken(token, request)
  const handleDecline = () => actions.rejectRequest(request)

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-gray-100">Add Token</h3>
      <div className="text-xs text-gray-500">
        <span className="text-gray-400">{origin}</span> wants to add a token
      </div>
      <div className="bg-gray-800/50 rounded-lg p-3 space-y-1">
        <div className="text-sm text-gray-200">{token.name || 'Unknown Token'}</div>
        <div className="text-xs text-gray-500">Symbol: {token.symbol || '?'}</div>
        <div className="text-xs text-gray-500 font-mono">Address: {token.address}</div>
        <div className="text-xs text-gray-500">Chain: {token.chainId}</div>
      </div>
      {isPending && (
        <div className="flex gap-3 pt-2">
          <button onClick={handleDecline} className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors">Decline</button>
          <button onClick={handleApprove} className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-green-600/20 text-green-400 border border-green-600/30 hover:bg-green-600/30 transition-colors">Add Token</button>
        </div>
      )}
    </div>
  )
}

function SwitchChainReview({ request, isPending, origin }: { request: any; isPending: boolean; origin: string }) {
  const chainId = request.payload?.params?.[0]?.chainId
  const handleApprove = () => actions.switchChain('ethereum', parseInt(chainId, 16), request)
  const handleDecline = () => actions.rejectRequest(request)

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-gray-100">Switch Chain</h3>
      <div className="text-xs text-gray-500">
        <span className="text-gray-400">{origin}</span> wants to switch network
      </div>
      <div className="bg-gray-800/50 rounded-lg p-3">
        <div className="text-sm text-gray-200">Chain ID: {chainId ? parseInt(chainId, 16) : '?'}</div>
      </div>
      {isPending && (
        <div className="flex gap-3 pt-2">
          <button onClick={handleDecline} className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors">Decline</button>
          <button onClick={handleApprove} className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-green-600/20 text-green-400 border border-green-600/30 hover:bg-green-600/30 transition-colors">Switch</button>
        </div>
      )}
    </div>
  )
}
