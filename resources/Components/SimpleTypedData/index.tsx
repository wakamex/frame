import React from 'react'

interface SimpleJSONProps {
  json: Record<string, any>
}

const SimpleJSON: React.FC<SimpleJSONProps> = ({ json }) => {
  return (
    <div className='simpleJson'>
      {Object.keys(json).map((key, o) => {
        const value = json[key]
        return (
          <div key={key + o} className='simpleJsonChild'>
            <div className='simpleJsonKey simpleJsonKeyTx'>{key.replace(/([A-Z])/g, ' $1').trim()}</div>
            <div className='simpleJsonValue'>
              {!!value && typeof value === 'object' ? <SimpleJSON json={value} key={key} /> : value}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const SimpleTypedDataInner: React.FC<{ typedData: any }> = ({ typedData }) =>
  typedData.domain ? (
    <div className='signTypedDataInner'>
      <div className='simpleJsonHeader'>Domain</div>
      <SimpleJSON json={typedData.domain} />
      <div className='simpleJsonHeader'>Message</div>
      <SimpleJSON json={typedData.message} />
    </div>
  ) : (
    <div className='signTypedDataSection'>
      <SimpleJSON
        json={typedData.reduce((data: Record<string, any>, elem: any) => {
          data[elem.name] = elem.value
          return data
        }, {})}
      />
    </div>
  )

export const SimpleTypedData: React.FC<{ req: any }> = ({ req }) => {
  const type = req.type
  const typedData = req.typedMessage.data || {}

  return type === 'signTypedData' || type === 'signErc20Permit' ? (
    <div className='accountViewScroll cardShow'>
      <div className='txViewData'>
        <div className='txViewDataHeader'>{'Raw Typed Data'}</div>
        <SimpleTypedDataInner {...{ typedData }} />
      </div>
    </div>
  ) : (
    <div className='unknownType'>{'Unknown: ' + req.type}</div>
  )
}
