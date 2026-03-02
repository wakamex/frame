import { useState, useEffect } from 'react'
import TransactionReview from './TransactionReview'
import SignatureReview from './SignatureReview'
import AccessReview from './AccessReview'
import ChainTokenReview from './ChainTokenReview'

interface RequestOverlayProps {
  requests: any[]
}

export default function RequestOverlay({ requests }: RequestOverlayProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  // Reset index if requests change
  useEffect(() => {
    if (currentIndex >= requests.length) {
      setCurrentIndex(Math.max(0, requests.length - 1))
    }
  }, [requests.length, currentIndex])

  if (requests.length === 0) return null

  const current = requests[currentIndex]
  if (!current) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
        {/* Queue indicator */}
        {requests.length > 1 && (
          <div className="flex items-center justify-between px-5 py-2 border-b border-gray-800 bg-gray-800/50">
            <button
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30"
            >
              &larr; Prev
            </button>
            <span className="text-xs text-gray-500">
              Request {currentIndex + 1} of {requests.length}
            </span>
            <button
              onClick={() => setCurrentIndex(Math.min(requests.length - 1, currentIndex + 1))}
              disabled={currentIndex === requests.length - 1}
              className="text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30"
            >
              Next &rarr;
            </button>
          </div>
        )}

        <div className="p-5">
          <RequestRouter request={current} />
        </div>
      </div>
    </div>
  )
}

function RequestRouter({ request }: { request: any }) {
  switch (request.type) {
    case 'transaction':
      return <TransactionReview request={request} />
    case 'sign':
    case 'signTypedData':
    case 'signErc20Permit':
      return <SignatureReview request={request} />
    case 'access':
      return <AccessReview request={request} />
    case 'addChain':
    case 'addToken':
    case 'switchChain':
      return <ChainTokenReview request={request} />
    default:
      return (
        <div className="text-center text-gray-500 text-sm py-8">
          Unknown request type: {request.type}
        </div>
      )
  }
}
