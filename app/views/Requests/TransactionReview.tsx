import { useState } from 'react'
import { actions } from '../../ipc'
import { useNetworks, useNetworksMeta } from '../../store'
import Address from '../../components/Address'
import { weiToGwei, hexToInt, roundGwei, weiIntToEthInt } from '../../../resources/utils'
import { accountViewTitles } from '../../../resources/domain/request'

interface TransactionReviewProps {
  request: any
}

export default function TransactionReview({ request }: TransactionReviewProps) {
  const networks = useNetworks()
  const networksMeta = useNetworksMeta()
  const [adjustingFees, setAdjustingFees] = useState(false)

  const tx = request.data || {}
  const chainId = tx.chainId ? parseInt(tx.chainId, 16) : 1
  const chain = networks[chainId]
  const chainMeta = networksMeta[chainId]
  const chainName = chain?.name || `Chain ${chainId}`

  const to = tx.to || request.payload?.params?.[0]?.to
  const value = tx.value ? weiIntToEthInt(hexToInt(tx.value)) : 0
  const gasLimit = tx.gasLimit ? hexToInt(tx.gasLimit) : 0

  // Gas display
  const maxFeePerGas = tx.maxFeePerGas ? roundGwei(weiToGwei(hexToInt(tx.maxFeePerGas))) : null
  const maxPriorityFee = tx.maxPriorityFeePerGas ? roundGwei(weiToGwei(hexToInt(tx.maxPriorityFeePerGas))) : null
  const gasPrice = tx.gasPrice ? roundGwei(weiToGwei(hexToInt(tx.gasPrice))) : null

  const isEIP1559 = maxFeePerGas !== null

  const status = request.status || 'pending'
  const origin = request.origin || 'Unknown'
  const isPending = status === 'pending'
  const notice = request.notice || ''

  const handleApprove = () => actions.approveRequest(request)
  const handleDecline = () => actions.declineRequest(request)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-100">
          {accountViewTitles.transaction}
        </h3>
        <span className="text-xs text-gray-500 capitalize">{status}</span>
      </div>

      {/* Origin */}
      <div className="text-xs text-gray-500">
        From <span className="text-gray-400">{origin}</span> on{' '}
        <span className="text-gray-400">{chainName}</span>
      </div>

      {/* Recipient */}
      {to && (
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">To</div>
          <Address address={to} full className="text-gray-300 text-xs" />
        </div>
      )}

      {/* Value */}
      {value > 0 && (
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Value</div>
          <div className="text-sm text-gray-100">{value.toFixed(6)} ETH</div>
        </div>
      )}

      {/* Recognized actions */}
      {request.recognizedActions?.length > 0 && (
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Actions</div>
          {request.recognizedActions.map((action: any, i: number) => (
            <div key={i} className="text-sm text-gray-300">{action.type}</div>
          ))}
        </div>
      )}

      {/* Gas */}
      <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">Gas</div>
          {isPending && (
            <button
              onClick={() => setAdjustingFees(!adjustingFees)}
              className="text-xs text-gray-400 hover:text-gray-200"
            >
              {adjustingFees ? 'Done' : 'Adjust'}
            </button>
          )}
        </div>
        {isEIP1559 ? (
          <div className="flex gap-4">
            <div>
              <div className="text-xs text-gray-500">Max Fee</div>
              <div className="text-sm text-gray-200">{maxFeePerGas} gwei</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Priority</div>
              <div className="text-sm text-gray-200">{maxPriorityFee} gwei</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Limit</div>
              <div className="text-sm text-gray-200">{gasLimit}</div>
            </div>
          </div>
        ) : (
          <div className="flex gap-4">
            <div>
              <div className="text-xs text-gray-500">Gas Price</div>
              <div className="text-sm text-gray-200">{gasPrice} gwei</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Limit</div>
              <div className="text-sm text-gray-200">{gasLimit}</div>
            </div>
          </div>
        )}

        {adjustingFees && isPending && (
          <GasAdjuster
            request={request}
            isEIP1559={isEIP1559}
          />
        )}
      </div>

      {/* Fee update notice */}
      {request.automaticFeeUpdateNotice && !request.feesUpdatedByUser && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-xs text-yellow-400">
          Gas fees have been automatically updated
          <button
            onClick={() => actions.removeFeeUpdateNotice(request.handlerId)}
            className="ml-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Notice */}
      {notice && (
        <div className="text-xs text-gray-400 text-center">{notice}</div>
      )}

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
            Approve
          </button>
        </div>
      )}

      {/* Post-approval status */}
      {!isPending && (
        <div className="text-center py-3">
          {request.tx?.hash && (
            <button
              onClick={() => {
                const chain = { type: 'ethereum', id: chainId }
                actions.openExplorer(chain, request.tx.hash)
              }}
              className="text-xs text-gray-400 hover:text-gray-200 underline"
            >
              View on explorer
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function GasAdjuster({ request, isEIP1559 }: { request: any; isEIP1559: boolean }) {
  const [baseFee, setBaseFee] = useState('')
  const [priorityFee, setPriorityFee] = useState('')
  const [gasPrice, setGasPrice] = useState('')
  const [gasLimit, setGasLimit] = useState('')

  const applyBaseFee = () => {
    if (baseFee) actions.setBaseFee(baseFee, request.handlerId)
  }
  const applyPriorityFee = () => {
    if (priorityFee) actions.setPriorityFee(priorityFee, request.handlerId)
  }
  const applyGasPrice = () => {
    if (gasPrice) actions.setGasPrice(gasPrice, request.handlerId)
  }
  const applyGasLimit = () => {
    if (gasLimit) actions.setGasLimit(gasLimit, request.handlerId)
  }

  return (
    <div className="space-y-2 pt-2 border-t border-gray-700">
      {isEIP1559 ? (
        <>
          <div className="flex gap-2 items-center">
            <input
              value={baseFee}
              onChange={(e) => setBaseFee(e.target.value)}
              placeholder="Base fee (gwei)"
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 outline-none"
            />
            <button onClick={applyBaseFee} className="text-xs text-gray-400 hover:text-gray-200 px-2">Set</button>
          </div>
          <div className="flex gap-2 items-center">
            <input
              value={priorityFee}
              onChange={(e) => setPriorityFee(e.target.value)}
              placeholder="Priority fee (gwei)"
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 outline-none"
            />
            <button onClick={applyPriorityFee} className="text-xs text-gray-400 hover:text-gray-200 px-2">Set</button>
          </div>
        </>
      ) : (
        <div className="flex gap-2 items-center">
          <input
            value={gasPrice}
            onChange={(e) => setGasPrice(e.target.value)}
            placeholder="Gas price (gwei)"
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 outline-none"
          />
          <button onClick={applyGasPrice} className="text-xs text-gray-400 hover:text-gray-200 px-2">Set</button>
        </div>
      )}
      <div className="flex gap-2 items-center">
        <input
          value={gasLimit}
          onChange={(e) => setGasLimit(e.target.value)}
          placeholder="Gas limit"
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 outline-none"
        />
        <button onClick={applyGasLimit} className="text-xs text-gray-400 hover:text-gray-200 px-2">Set</button>
      </div>
    </div>
  )
}
