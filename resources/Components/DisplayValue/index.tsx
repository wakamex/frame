import React from 'react'
import { displayValueData } from '../../utils/displayValue'
import { MAX_HEX } from '../../constants'

import BigNumber from 'bignumber.js'

function isDisplayValueData(obj: any): boolean {
  return obj?.fiat && obj?.ether && obj?.gwei && obj?.wei && BigNumber.isBigNumber(obj.bn)
}

const ApproximateValue: React.FC<{ approximationSymbol: string }> = ({ approximationSymbol }) => (
  <span className='displayValueApprox'>{approximationSymbol}</span>
)

const FiatSymbol: React.FC<{ fiatSymbol: string }> = ({ fiatSymbol }) => <span className='displayValueFiat'>{fiatSymbol}</span>

const Symbol: React.FC<{ currencySymbol: string }> = ({ currencySymbol }) => (
  <span className='displayValueSymbol'>{currencySymbol.toUpperCase()}</span>
)

const Main: React.FC<{ displayValue: string }> = ({ displayValue }) => <span className='displayValueMain'>{displayValue}</span>

const Unit: React.FC<{ displayUnit: any }> = ({ displayUnit }) => <span className='displayValueUnit'>{displayUnit.shortName}</span>

interface DisplayCoinBalanceProps {
  amount: any
  symbol: string
  decimals: number
}

export const DisplayCoinBalance: React.FC<DisplayCoinBalanceProps> = ({ amount, symbol, decimals }) => (
  <DisplayValue
    type='ether'
    value={amount}
    currencySymbol={symbol}
    currencySymbolPosition='last'
    valueDataParams={{ decimals }}
  />
)

interface DisplayFiatPriceProps {
  decimals: number
  currencyRate: any
  isTestnet: boolean
}

export const DisplayFiatPrice: React.FC<DisplayFiatPriceProps> = ({ decimals, currencyRate, isTestnet }) => (
  <DisplayValue
    type='fiat'
    value={`1e${decimals}`}
    valueDataParams={{ decimals, currencyRate, isTestnet, displayFullValue: true }}
    currencySymbol='$'
  />
)

interface DisplayValueProps {
  value: any
  valueDataParams?: any
  currencySymbol?: string
  type?: string
  displayDecimals?: boolean
  currencySymbolPosition?: 'first' | 'last'
}

export const DisplayValue: React.FC<DisplayValueProps> = (props) => {
  const {
    value,
    valueDataParams,
    currencySymbol,
    type = 'ether',
    displayDecimals = true,
    currencySymbolPosition = 'first'
  } = props

  const data = isDisplayValueData(value) ? value : displayValueData(value, valueDataParams)

  const {
    approximationSymbol = '',
    displayValue,
    displayUnit = ''
  } = value === MAX_HEX ? { displayValue: 'Unlimited' } : data[type]({ displayDecimals })

  return (
    <div className='displayValue' data-testid='display-value'>
      {type === 'fiat' ? (
        <>
          {approximationSymbol && <ApproximateValue approximationSymbol={approximationSymbol} />}
          {currencySymbol && <FiatSymbol fiatSymbol={currencySymbol} />}
        </>
      ) : (
        <>
          {currencySymbol && currencySymbolPosition === 'first' && <Symbol currencySymbol={currencySymbol} />}
          {approximationSymbol && <ApproximateValue approximationSymbol={approximationSymbol} />}
        </>
      )}
      <Main displayValue={displayValue} />
      {displayUnit && <Unit displayUnit={displayUnit} />}
      {currencySymbol && currencySymbolPosition === 'last' && <Symbol currencySymbol={currencySymbol} />}
    </div>
  )
}
