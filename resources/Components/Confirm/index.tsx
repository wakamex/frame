import React, { useState } from 'react'

interface ConfirmDialogProps {
  prompt: string
  acceptText?: string
  declineText?: string
  onAccept: () => void
  onDecline: () => void
}

export default function ConfirmDialog({
  prompt,
  acceptText = 'OK',
  declineText = 'Decline',
  onAccept,
  onDecline
}: ConfirmDialogProps) {
  const [submitted, setSubmitted] = useState(false)

  const clickHandler = (evt: React.MouseEvent, onClick: () => void) => {
    if (evt.button === 0 && !submitted) {
      setSubmitted(true)
      onClick()
    }
  }

  const ResponseButton: React.FC<{ text: string; onClick: () => void }> = ({ text, onClick }) => {
    return (
      <div role='button' className='confirmButton' onClick={(evt) => clickHandler(evt, onClick)}>
        {text}
      </div>
    )
  }

  return (
    <div id='confirmationDialog' className='confirmDialog'>
      <div role='heading' className='confirmText'>
        {prompt}
      </div>

      <div className='confirmButtonOptions'>
        <ResponseButton text={declineText} onClick={onDecline} />
        <ResponseButton text={acceptText} onClick={onAccept} />
      </div>
    </div>
  )
}
