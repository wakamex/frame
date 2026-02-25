import React from 'react'

interface RequestHeaderProps {
  chain: string
  children: React.ReactNode
  chainColor: string
}

const RequestHeader: React.FC<RequestHeaderProps> = ({ chain, children, chainColor }) => (
  <div className='_txDescriptionSummary'>
    {children}
    <div className='_txDescriptionSummaryTag' style={{ color: `var(--${chainColor})` }}>
      {`on ${chain}`}
    </div>
  </div>
)

export default RequestHeader
