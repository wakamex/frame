import { useState } from 'react'
import AddAccount from '../Accounts/AddAccount'

type Step = 'welcome' | 'create' | 'done'

export default function OnboardView({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>('welcome')

  if (step === 'welcome') {
    return (
      <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center gap-6">
        <div className="text-2xl font-semibold text-gray-100">Welcome to Framed</div>
        <div className="text-sm text-gray-400 space-y-2">
          <p>A privacy-focused Ethereum wallet that runs as a native desktop application.</p>
          <p>Framed provides a system-wide web3 provider, letting any browser or application interact with your accounts.</p>
        </div>
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => setStep('create')}
            className="px-5 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-900 hover:bg-white transition-colors"
          >
            Get Started
          </button>
          <button
            onClick={onComplete}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center gap-6">
        <div className="text-2xl font-semibold text-gray-100">You're all set</div>
        <div className="text-sm text-gray-400">
          Your account has been created. Framed is now ready to use as your system-wide web3 provider.
        </div>
        <button
          onClick={onComplete}
          className="px-5 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-900 hover:bg-white transition-colors"
        >
          Open Framed
        </button>
      </div>
    )
  }

  // step === 'create'
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="w-full max-w-md">
        <AddAccount
          onClose={() => setStep('done')}
        />
      </div>
    </div>
  )
}
