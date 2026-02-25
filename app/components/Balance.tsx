interface BalanceProps {
  symbol: string
  displayBalance: string
  displayValue?: string
  className?: string
}

export default function Balance({ symbol, displayBalance, displayValue, className = '' }: BalanceProps) {
  return (
    <div className={`flex items-baseline gap-1.5 ${className}`}>
      <span className="text-gray-100 font-medium">{displayBalance}</span>
      <span className="text-gray-500 text-xs uppercase">{symbol}</span>
      {displayValue && displayValue !== '0' && (
        <span className="text-gray-400 text-xs ml-auto">${displayValue}</span>
      )}
    </div>
  )
}
